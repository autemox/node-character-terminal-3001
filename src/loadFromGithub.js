const axios = require('axios');
const dotenv = require("dotenv");
const utils = require("./openaiUtils");
const memories = require("./memories");
const qdrantMemories = require("./qdrant-memories");
const db = require('./db');
dotenv.config();


function getFileExtension(filename) {
    return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}

async function handleLoadFromGithub(state, io, id, url) {
    try {
        console.log(`Starting handleLoadFromGithub()`);
        let fileCount=0;
        
        // Extract owner, repo, and path from URL
        const match = url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/tree\/main\/(.+)/);
        if (!match) {
            throw new Error(`Invalid GitHub URL ${url}  Make sure it includes http, .com, and /contents/, then the path of your src folder`);
        }
        const [_, owner, repo, path] = match;

        // clear memories
        db.clearAllMemories(state, id);

        // Call the recursive function to process files and subdirectories
        fileCount = await processGitHubFolder(state, io, id, `https://api.github.com/repos/${owner}/${repo}/contents/${path}`, process.env.GITHUB_TOKEN, fileCount);
        
        if(fileCount>process.env.GITHUB_MAX_FILES)  io.emit(`chat message`, `[GITHUB MAX FILES REACHED: ${process.env.GITHUB_MAX_FILES} FILES]<br><br>`);
        else io.emit(`chat message`, `[LOAD GITHUB TO MEMORIES COMPLETE: ${fileCount} FILES]<br><br>`);

        // update default_prompt with a total summary
        console.log(`Summarizing all memories from {state.characterNames[id]} and setting to default_prompt`);
        let summary = await memories.summarizeAllMemories(state, id, "Please summarize this project, focusing on big picture overview of what each class does and key variables and functions.");
        db.saveDefaultPrompt(state, id, "You are here to answer questions about and help work on character-terminal  Here is a summary of what that is: "+summary);

        io.emit(`chat message`, `[UPDATED DEFAULT_PROMPT WITH FULL PROJECT SUMMARY]<br><br>`);

    } catch (error) {
        console.error(`Failed in handleLoadFromGithub(): ${error}`);
        io.emit(`chat message`, `[LOAD GITHUB TO MEMORIES FAILED: ${error}<br><br>`);
    }
}

async function processGitHubFolder(state, io, id, url, githubToken, fileCount) {
    try {

        console.log(`Requesting list of github files...`, { Url: url });
        const response = await axios.get(url, {
            headers: {
                'Authorization': `token ${githubToken}`,
            },
        });

        for (const item of response.data) {
            if(fileCount>=process.env.GITHUB_MAX_FILES) { fileCount++; continue; }

            if (item.type === 'file' && state.ALLOWED_EXTENSIONS.includes(getFileExtension(item.name))) {
                const fileContent = await axios.get(item.download_url, {
                    headers: {
                        'Authorization': `token ${githubToken}`,
                    },
                });

                // do something with the files here
                fileCount = await processGitHubFile(state, io, id, item.name, fileContent.data, fileCount);

                } else if (item.type === 'dir') {
                    fileCount = await processGitHubFolder(state, io, id, item.url, githubToken, fileCount);
            }
        }

        // push memories to qdrant
        qdrantMemories.reloadCharacter(state.characterNames[id]);

    }catch (error) { console.error(`Failed in processGitHubFolder(): ${error.message}`, error); }

    return fileCount;
}

async function processGitHubFile(state, io, id, filename, content, fileCount)
{
    try
    {
        // summarize the file
        console.log(`Summarizing ${filename} and saving to memories...`);
        let model = utils.estimateTokens(content) < 8000 ? "gpt-4-0613" : "gpt-3.5-turbo-16k"; // in future, break memory up if its long
        if(state.GITHUB_SUMMARIZER_USE_GPT3) model = "gpt-3.5-turbo-16k";
        let query = "Please summarize the following code.  Include details like functions (what they return, arugments to pass in, and what they do) and variables (type and what they do).  Here is the content to summarize: "+content;
        let memoryString =  await utils.simpleQuery(query, model);
        db.saveNewMemory(state, `${filename} Summary: ${memoryString}`, id);  // save to memories
        io.emit(`chat message`, `${filename} ...`);
        
    }catch (error) { console.error(`Failed in processGitHubFile(): ${error}`); }

    return ++fileCount;
}


module.exports = {
    handleLoadFromGithub,
};
