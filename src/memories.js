const db = require('./db');
const openai = require('./openaiSetup');
const utils = require('./openaiUtils');

async function processAndSaveMessages(state, id) // process messages from chatgpt and save to long term memories
{
    // dont save memories for github assistants
    if(state.characterSheets[id]._doc.title.toLowerCase() == "assistant" && state.characterSheets[id]._doc.location.toLowerCase().substring(0,18) == "https://github.com/".substring(0,18)) return;

    // prepare a string version of the conversation
    let characterName = state.characterNames[id];
    console.log("[processAndSaveMessages()] Creating a memory for: "+characterName);
    let messages = state.messagesByCharacter[characterName];
    const chat = require('./chat');
    messages=chat.updateSystemDirective(state, messages, ""); // clear directive
    let strConversation = utils.messagesToString(messages, state.characterNames[id]);

    // create memory string by summarizing conversation using chatgpt
    let model = utils.estimateTokens(strConversation) < 8000 ? "gpt-4-0613" : "gpt-3.5-turbo-16k"; // in future, break memory up if its long
    if(state.MEMORIES_SUMMARIZER_USE_GPT3) model = "gpt-3.5-turbo-16k";
    let query = "Please summarize the following conversation between user and "+characterName+" to 1-3 setences (no more), including participant emotions and motivation aside from neutral, friendly, or helpful.  Include details like names and locations whenever possible, especially details about a persons life, family, and friends. If no details are available, don't write more than 1 sentence. Here is the content to summarize: "+strConversation;
    let memoryString =  await utils.simpleQuery(query, model);

    // save memory
    db.saveNewMemory(state, `At ${state.characterSheets[id]._doc.location}, ${memoryString}`, id);
}

module.exports = {
    processAndSaveMessages,
};


