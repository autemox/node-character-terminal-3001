const { DirectoryLoader } = require("langchain/document_loaders/fs/directory");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const dotenv = require("dotenv");
const utils = require("./openaiUtils");
const axios = require('axios');
const db = require('./db');
const { UsAppToPersonListInstance } = require("twilio/lib/rest/messaging/v1/service/usAppToPerson");
dotenv.config();

async function reloadAll(label) {
    try {
        const qdrant = require('./qdrant');
        const client = qdrant.client;
        const collectionName = process.env.QDRANT_COLLECTION_NAME;
        const memoryPoints = await client.scroll(collectionName, {
            filter: { must: [ { key: 'label', match: { value: label } } ] }
        });
        if (memoryPoints && memoryPoints.length > 0)  await client.deletePoints(collectionName, { ids: memoryPoints.map(point => point.id) });
        let characters = await db.getAllCharacters();
        if (!characters || characters.length === 0) return;  // Nothing to process
        for (const character of characters) {
            await saveCharacterMemories(client, character, label);
        }
        console.log("All memories have been reloaded in Qdrant.");

    } catch (error) { console.error(`Failed in reloadAll(): ${error.message}`, error); }
}

async function reloadCharacter(characterName) {
    try {
        const qdrant = require('./qdrant');
        const client = qdrant.client;
        const collectionName = process.env.QDRANT_COLLECTION_NAME;
        const query = {
            filter: { must: [ { key: 'title', match: { value: characterName } } ] },
            limit: 1000,
        };
        console.log("Reloading Character Qdrant Memories from Mongo DB with Query:", query);

        // Erase the character's memories from Qdrant using the 'scroll' method for filtering
        const memoryPoints = await client.scroll(collectionName, query);
        if (memoryPoints && memoryPoints.points.length > 0) {
            console.log(`Deleting ${memoryPoints.points.length} ${characterName} Qdrant entries`);
            points=memoryPoints.points.map(point => point.id);
            await client.delete(collectionName, { points: points });
        }

        let character = await db.getCharacter(characterName);
        if (!character) return;  // Character not found
        await saveCharacterMemories(client, character, characterName);

        const memoryPoints2 = await client.scroll(collectionName, query); //?? this double check is not needed its for console log only
        console.log(`Loaded ${characterName} memories into Qdrant. There are now ${memoryPoints2.points.length} Qdrant entries with the title: ${characterName}`);
        await utils.sleep(250);

    } catch (error) { console.error(`Failed in reloadCharacter(): ${error.message}`, error); }
}

async function saveCharacterMemories(client, character, label) {
    try {
        const qdrant = require('./qdrant');
        
        let memories = character._doc.memories.map(memory => ({
            label: "memories",
            title: character._doc.name,
            content: memory.name
        }));
        console.log(`Character ${character.name} (title ${character.title}) has ${memories.length} to save to Qdrant`, memories);
        if(memories.length>0) await qdrant.saveBatchToQdrant(client, memories);
    } 
    catch (error) { console.error(`Failed in saveCharacterMemories(): ${error.message}`, error); }
}

module.exports = {
    reloadAll,
    reloadCharacter,
    saveCharacterMemories,
};