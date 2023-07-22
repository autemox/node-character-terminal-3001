const Character = require('./models/Character'); // update this to the path where your character model is defined

async function getAllCharacters() {
    let characters = await Character.find({});  // retrieves all characters
    if (!characters || characters.length === 0) console.log(`[ERROR] No characters found in the database.`);
    return characters;
}

async function getCharacter(characterName)
{
    let character = await Character.findOne({ name: characterName }); 
    if (!character) console.log(`[ERROR] No such character: ${characterName}`);
    return character;
}

function updateSystemDirectiveHeader(state, character)
{
    if(character.title.trim().toLowerCase() == "assistant") return state.assistantDirective; // check character title for assistant
    else return state.characterDirective;
}

const reputations = ["enemy", "dislike", "neutral", "friend", "close friend"];
function getReputation(textOrNum)
{
    if(typeof textOrNum === 'number') return reputations[textOrNum-1];
    else return reputations.indexOf(textOrNum) + 1; 
}

function characterToString(character) {
    console.log("Converting character to string: ", character._doc);

    let relationships = character._doc.relationships.map(relationship => {
        return `${relationship.name} is a ${getReputation(relationship.value)}`;
    });
    character._doc.relationships = relationships;

    let characterAttributes = Object.entries(character._doc).map(([key, value]) => {
        if (key === "memories" || key === "photos" || key === "_id" || key === "title") return null;
        if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === 'string' && value.trim() === '')) return null; // Return null for empty strings or arrays
        
        if (Array.isArray(value)) {
            if (typeof value[0] === 'object' && value[0].hasOwnProperty('name')) return `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value.map(item => item.name).join(', ')}`;    
            else return `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value.join(', ')}`; 
        } 
        else return `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`;
    }).filter(Boolean);

    return characterAttributes.join('. ');
}

async function saveNewMemory(state, memoryString, id)
{
        if (!state.characterSheets[id]) { console.error(`[saveNewMemory()] No character sheet found for id: ${id}`); return; } // error out
        let memoryEntry = {
            name: memoryString.replace("the system", state.characterNames[id]), // You need to provide the location information
            value: Math.floor(Date.now() / 1000) // Current Unix timestamp in seconds
        };
        console.log(`Adding memory to ${state.characterNames[id]}: `,memoryEntry);
        let character = await getCharacter(state.characterNames[id]); // update character from database in case its changed since it was saved to characterSheets[id]
        character.memories.push(memoryEntry);
        character.markModified('memories'); // Mark the memories array as modified
        await character.save();
}

async function clearAllMemories(state, id) {
    try {
        if (!state.characterSheets[id]) {
            console.error(`[clearAllMemories()] No character sheet found for id: ${id}`);
            return;
        }

        let characterName = state.characterNames[id];
        console.log(`[clearAllMemories()] Clearing all memories from ${characterName}`);

        let character = await getCharacter(characterName); // Fetch the character from the database
        character.memories = []; // Set the memories array to empty
        character.markModified('memories'); // Mark the memories array as modified
        await character.save();
        console.log(`[CLEARED ALL MEMORIES FROM ${characterName}]`);
    } catch (error) {
        console.error(`Failed in clearAllMemories(): ${error}`);
    }
}


async function saveNewReputation(state, characterName, reputationScore, id, givenByCharacter)
{
    if (!state.characterSheets[id]) { console.error(`[ProcessAndSaveMessage()] No character sheet found for id: ${id}`); return; } // error out
    let reputationEntry = { name: characterName, value: reputationScore };
    let character = await getCharacter(givenByCharacter); // update character from database in case its changed since it was saved to characterSheets[id]
    let existingEntry = character.relationships.find(entry => entry.name === characterName);
    if (!existingEntry) {
        character.relationships.push(reputationEntry);
        console.log(`[ADDED RELATIONSHIP TO ${givenByCharacter}] `, characterName);
    }
    character.markModified('relationships'); // Mark the memories array as modified
    await character.save();
}

module.exports = {
    reputations,
    getCharacter,
    getReputation,
    characterToString,
    saveNewMemory,
    saveNewReputation,
    updateSystemDirectiveHeader,
    clearAllMemories,
    getAllCharacters,
};
