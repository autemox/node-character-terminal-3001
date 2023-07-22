const OpenAIEmbeddings = require("langchain/embeddings/openai").OpenAIEmbeddings;
const OpenAI = require("langchain/llms/openai").OpenAI;
const loadQAStuffChain = require("langchain/chains").loadQAStuffChain;
const {QdrantClient} = require("@qdrant/qdrant-js");
const dotenv = require("dotenv");
const utils = require('./openaiUtils');
const qdrantDocs = require('./qdrant-docs');
const qdrantMemories = require('./qdrant-memories');
const { v4: uuidv4 } = require('uuid');
dotenv.config();

const client = new QdrantClient({
    url: 'https://9eb91553-32b2-4d4a-b17f-3684506553c5.us-east-1-0.aws.cloud.qdrant.io:6333',
    apiKey: process.env.QDRANT_API,
});

async function reloadCollection()
{
    try {

        await createCollection(client, true); // do destroy collection if exists
        await qdrantDocs.reload("lore");
        await qdrantMemories.reloadAll("memories");

        return client;

    } catch (error) { console.error('Error in start(): ', error.message); }
}

async function saveToQdrant(client, label, title, content)
{
    try {
    // get embedding data from chatgpt all at once
    let batch = [{ label: label, title: title, content: content }]; // batch of 1
    console.log(`Saving single entry to quadrant: `, batch);
    await saveBatchToQdrant(client, batch);
    
    } catch (error) { console.error('Error in saveToQdrant(): ', error.message); }
}

async function saveBatchToQdrant(client, batch) {
    try {
        // send to openai to get vectors/embeddings
        console.log(`Processing batch of size ${batch.length}, still need to get vectors and save to Qdrant`, batch);
        let vectors = await getVectorsFromOpenAi(batch);
        if(vectors.length == 0) return;

        // create a list of points to save in Qdrant
        let points = [];
        for(let i=0; i<vectors.length; i++) {
            let metadata = batch[i];
            let vector = vectors[i];

            points.push({
                id: uuidv4(),
                vector: vector,
                payload: {
                    label: metadata.label,
                    title: metadata.title,
                    content: metadata.content
                }
            });
        }

        // save to qdrant
        let result = await client.upsert(process.env.QDRANT_COLLECTION_NAME, {
            wait: true,
            points: points
        });
        console.log('Upserted ${points.length} points (made of vectors: ${vectors.length}, metadata: ${batch.length}) into Qdrant: ', { points: points, vectors: vectors, metadata: batch, results: result});

    } catch (error) { console.error('Error in saveBatchToQdrant(): ', error); }
}

function limitArrChars(arr, maxChar) {
    return arr.join('|x|').substr(0, maxChar).split('|x|').filter(Boolean);
}

async function getVectorsFromOpenAi(batch)
{
    try {
        embeddings=limitArrChars(batch.map(item => item.content), 999999999);  // limit to characters being sent in to openai.  also cleans the arrays somehow but confused why it prevents an error
        if(!embeddings || !Array.isArray(embeddings)) return; // empty batch or batch with empty content
        const embeddingsArrays = await new OpenAIEmbeddings().embedDocuments(embeddings);
        console.log("Emeddings/vectors created from contents of batch. ", {embeddingArrays: embeddingsArrays, Embeddings: embeddings});
        return embeddingsArrays;
    }catch (error) { console.error('Error in getVectorFromOpenAi(): ', error); }
}

async function getFromQdrant(client, query, filter=undefined) {
    try {
        let relaventContentArray = [];

        console.log(`Getting Vectors from OpenAi based on query:`, { query: query });
        const queryVector = await getVectorsFromOpenAi([{content: query}]);
        const vectorObj = {
            vector: queryVector[0],
            limit: 10,
        };
        if(filter) vectorObj.filter = filter;
        console.log(`Searching Qdrant for match...`, vectorObj);
        const res = await client.search(process.env.QDRANT_COLLECTION_NAME, vectorObj);
        for(let item of res) {
            relaventContentArray.push(item.payload.content); // assuming you want to extract content from results
        }

        return relaventContentArray;
        
    } catch (error) {
        console.error('Error in getFromQdrant(): ', error);
    }
}

async function createCollection(client, destroyIfExists=false) {
    try {
        const collectionName=process.env.QDRANT_COLLECTION_NAME;
        const response = await client.getCollections();
        const collectionNames = response.collections.map((collection) => collection.name);
        
        if (collectionNames.includes(collectionName)) {

            if(destroyIfExists)
            {
                console.log(`${collectionName} already exists. Deleting existing collection...`);
                await client.deleteCollection(collectionName);
                await utils.sleep(500);
            }
            else       
            {
                console.log(`${collectionName} already exists. Skipping creation.`);
                return;
            }
        }
        
        console.log(`Creating collection: ${collectionName}`);
        const options = {
            vectors: {
                size: parseInt(process.env.QDRANT_VECTOR_DIMENSION, 10), 
                distance: 'Cosine',
            },
            optimizers_config: {
                default_segment_number: 2,
            },
            replication_factor: 2,
        };
        await client.createCollection(collectionName, options);

        console.log(`${collectionName} created successfully.`);
    } catch (error) {
        console.error(`Error in createCollectionIfNotExists(): `, error);
    }
}

module.exports = {
    reloadCollection,
    saveToQdrant,
    getFromQdrant,
    getVectorsFromOpenAi,
    saveBatchToQdrant,
    client,
}