const PineconeClient = require("@pinecone-database/pinecone").PineconeClient;
const OpenAIEmbeddings = require("langchain/embeddings/openai").OpenAIEmbeddings;
const RecursiveCharacterTextSplitter = require("langchain/text_splitter").RecursiveCharacterTextSplitter;
const OpenAI = require("langchain/llms/openai").OpenAI;
const loadQAStuffChain = require("langchain/chains").loadQAStuffChain;
const Document = require("langchain/document").Document;
const { DirectoryLoader } = require("langchain/document_loaders/fs/directory");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const dotenv = require("dotenv");
dotenv.config();

async function reloadDocsToPinecone(client, indexName)
{
    try {
    const loader = new DirectoryLoader("./documents", {
        ".txt": (path) => new TextLoader(path),
        ".pdf": (path) => new PDFLoader(path),
    });
    const docs = await loader.load();
    const vectorDimension = 1536;
    await createPineconeFromDocument(client, indexName, vectorDimension);
    await updateLoreToPinecone(client, indexName, docs);
    }catch (error) { console.error('An error occurred in reloadDocsToPinecone(): ', error.message); }
}

async function newClient()
{
    const client = new PineconeClient();
    await client.init({apiKey: process.env.PINECONE_API_KEY, environment: process.env.PINECONE_ENVIRONMENT});
    return client;
}

async function getRelaventData(state, query, id)
{
    try {
        const client = await newClient();
        const indexName=process.env.PINECONE_INDEX_NAME;
        return await queryPinecone(state, client, indexName, query, [`character-${state.characterNames[id]}`]);

    } catch (error) {
      console.error('An error occurred in getRelaventData(): ', error.message);
      return "Unable to query pinecone.";
    }
}



// Create Pinecone index from the document
async function createPineconeFromDocument (client, indexName, vectorDimension) {
    console.log(`Checking "${indexName}"...`);
    const existingIndexes = await client.listIndexes();
    if(!existingIndexes.includes(indexName)) {
        // create the index
        const createClient = await client.createIndex({
            createRequest: {
                name: indexName,
                dimension: vectorDimension,
                metric: "cosine",
            },
        });
        console.log(`Index did not exist.  Created new index ${indexName} with client `, createClient);
        await new Promise((resolve) => setTimeout(resolve, 60000));
    } else {
        console.log(`"${indexName}" already exists.`);
    }
};

class PriorityDoubleNewLineSplitter extends RecursiveCharacterTextSplitter {
    async splitText(text) {
        const separator = "\r\n\r\n";
        const initialSplits = text.split(separator);
        const finalChunks = [];
        for (const split of initialSplits) {
            if (split.length > this.chunkSize) { 
                const furtherSplits = await super.splitText(split); 
                finalChunks.push(...furtherSplits);
            } else {
                finalChunks.push(split); // If it's smaller or equal to chunkSize, just add it to the final chunks
            }
        }
        return finalChunks;
    }
}

// Update Pinecone with documents
async function updateLoreToPinecone (client, indexName, docs) {
    try {
        const index = client.Index(indexName);
        for (const doc of docs) {
            const txtPath = doc.metadata.source;
            console.log(`Updating to pinecone: "${txtPath}"...`);
            const text = doc.pageContent;
            const textSplitter = new PriorityDoubleNewLineSplitter({ chunkSize: 1000 });
            const chunks = await textSplitter.createDocuments([text]);
            const embeddingsArrays = await new OpenAIEmbeddings().embedDocuments(
                chunks.map(chunk => chunk.pageContent.replace(/\n/g, " "))
            );
            const batchSize = 100;
            let batch = [];
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const vector = {
                    id: `${txtPath}_${i}`,
                    values: embeddingsArrays[i],
                    metadata: {
                        ...chunk.metadata,
                        loc: JSON.stringify(chunk.metadata.loc),
                        content: chunk.pageContent,
                        txtPath: txtPath,
                        label: 'world_lore',
                    },
                };
                batch.push(vector);
                if (batch.length === batchSize || i === chunks.length - 1) {
                    await index.upsert({ upsertRequest: { vectors: batch } });
                    batch = [];
                }
            }
        }
        console.log(`Update Lore To Pinecone is Complete.`);
    }catch (error) { console.error('An error occurred in updateLoreToPinecone(): ', error.message); }
};

async function updateMemoriesToPinecone(state, id) {
    try {
        const client = await newClient();
        const indexName=process.env.PINECONE_INDEX_NAME;
        const characterName = state.characterNames[id];

        const sheet=state.characterSheets[id];
        const doc = sheet._doc;
        const memories = doc.memories;
        let contentArr = memories.map(memory => memory.name); // make a simple string array from memories
        console.log(`Character ${characterName} has ${contentArr.length} memories to update to pinecone`);
        if(contentArr.length==0) return;
        const label = "character-"+characterName;
        const embeddings = new OpenAIEmbeddings();
        const index = client.Index(indexName);

        try { await index._delete({ deleteRequest: { filter: { "label": {"$eq": label} } } }); } // delete old memories
        catch (error) { console.error(`${error.message} (likely no such label ${label})`); }
        contentArr = contentArr.map(str => characterName+" remembers: " + str);                  // fix memories
        const embeddingsArrays = await embeddings.embedDocuments(contentArr);    // generate embeddings

        const vectors = [];
        for (let i = 0; i < contentArr.length; i++) {
            const vector = {
                id: `${label}-${i + 1}`,  // IDs like "character-Zeus-1", "character-Zeus-2", etc.
                values: embeddingsArrays[i],
                metadata: {
                    content: contentArr[i],
                    label: label,
                },
            };
            vectors.push(vector);
            console.log(`Updating ${vector.id}`, {content: vector.metadata.content});
        }

        // Upsert the new vectors into Pinecone
        await index.upsert({ upsertRequest: { vectors: vectors } });
        console.log(`Upsert for label ${label} complete.`);
        
    } catch (error) {
        console.error(`An error occurred in updateMemoriesToPinecone(): ${error.message}`);
        return "Unable to update Pinecone.";
    }
}

// Query Pinecone and retrieve results
async function queryPinecone (state, client, indexName, queryStr, labelArr=[]) {
    try {
    const index = client.Index(indexName);
    const queryEmbedding = await new OpenAIEmbeddings().embedQuery(queryStr);
    
    const filterCriteria = { "metadata.label": { "$in": labelArr } };
    let relevantDocs = await index.query({
        queryRequest: {
            topK: 5,
            vector: queryEmbedding,
            includeMetadata: true,
            includeValues: true,
        },
    });
    matches = relevantDocs.matches.map(match => match.metadata.content);
    console.log(`Pinecone Matches: ${matches}`);
    return matches;
    
    } catch (error) { console.error(`An error occurred in queryPinecone(): ${error.message}`); }
};

module.exports = {
    reloadDocsToPinecone,
    createPineconeFromDocument,
    updateMemoriesToPinecone,
    updateLoreToPinecone,
    queryPinecone,
    getRelaventData,
    PriorityDoubleNewLineSplitter,
};