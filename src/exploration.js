const db = require('./db');
const axios = require('axios');

/*
Ideas for other functions:

Upgrades
----------
Exchange credits for new ship
Exchange credits for ship upgrade hardware
Exchange credits to install ship upgrade
Exchange credits for ship weapon hardware
Exchange credits to install ship weapon

Escort
---------
Join player's crew
Leave player's crew
Join player's caravan (escort player)
Leave player's caravan (stop escorting player)

Missions
---------
Ask player to escort your ship
Ask player to eliminate enemy ship
Ask player to deliver item

Misc
---------
Give player item
Take item from player
Attack the player
Increase player's reputation
Decrease player's reputation



*/


function GeneratePersonality()
{
    let adjectives = ["Charismatic", "manipulative", "hot-headed", "untrusting", "trusting", "secretive", "adventurous", "impulsive", "violent", "mysterious", "obsessive", "selfish", "tenacious", "paranoid", "determined", "ruthless", "charming", "loyal", "unpredictable", "edgy", "passionate", "reckless", "vindictive", "conflicted", "seductive", "devious", "bold", "calculating", "competitive", "emotional", "elusive", "intense", "intimidating", "narcissistic", "rebellious", "sarcastic", "suspicious", "troubled", "unpredictable", "vengeful", "zealous", "amorous", "curious", "detached", "erratic", "flamboyant", "inscrutable", "moralistic", "aggressive", "sadistic", "antisocial", "egotistical", "introspective", "rebellious", "unstable", "traumatized", "cunning", "mysterious", "provocative", "eccentric", "possessive", "suave", "sophisticated", "quirky", "mischievous", "introverted", "extroverted", "naive", "impatient", "masochistic", "gullible", "obsessive-compulsive", "adventurous", "street-smart", "unscrupulous", "confident", "unsure", "insecure", "adventurous", "thrill-seeking", "methodical", "analytical", "happy", "positive", "negative", "suspicious", "liar", "sexual", "nymphomaniac", "swinger", "edgy", "swearer", "dumb", "English as a second language", "money hungry", "loud", "flirtatious", "horny", "psychotic", "unsound mind", "witty", "funny", "silly", "angry", "short", "wordy", "loyal", "emotional", "logical", "detective", "corrupt cop", "good cop", "romantic", "non-sexual", "homosexual"];
    let selectedAdjectives = [];
    for (let i = 0; i < 3; i++) {
        let randomIndex = Math.floor(Math.random() * adjectives.length);
        selectedAdjectives.push(adjectives[randomIndex]);
        adjectives.splice(randomIndex, 1);
    }
    return(selectedAdjectives.join(', '));
}

function GenerateExplorationCharacter(name, description, location, occupation, relationship)
{
    if(occupation=="undefined") occupation=Occupations[Math.floor(Math.random() * Occupations.length)];
    const accents=["angry", "JK Rowling", "seductive", "high energy", "depressed", "silly", "brooding"];
    
    const newCharacter = {
          name: name,
          title: "",
          age: Math.floor(Math.random() * 50) + 16,
          gender: Math.random() < 0.5 ? "Male" : "Female",
          personality: GeneratePersonality(),
          description: description,
          accent: accents[Math.floor(Math.random() * accents.length)],
          default_prompt: "",
          location: location,
          occupation: occupation,
          vehicle: "",
          services: [{name: '', value: 0}],
          secrets: [{name: '', value: 0}],
          memories: [{name: '', value: 0}],
          photos: [{name: '', value: 0}],
          relationships: [relationship]
    };
    
    // fetch existing characters
    axios.get('http://localhost:5000/characters') // replace with your Express.js server API endpoint
    .then(response => {
      
        // load character list
        characters=response.data;
    
        // Check if there is already a character named "New Character"
        if (characters.some(character => character.name === name)) {
          console.log("[Exploration] A character with this name already exists!");
          return;
        }

        // Then send the request to the server to create the character
        console.log("[Exploration] Attempting to add new character "+newCharacter);
        axios.post('http://localhost:5000/characters', newCharacter)
          .then(response => {
            // Use the response to update the character's id
            console.log("[Exploration] Successfully added new character "+response.data);
          });
    });
}



const Occupations = ["engineer", "pilot", "captain", "politician", "deckhand", "slaver", "slinger", "mobster", "medic", "doctor", "researcher", "Xenobiologist", "Astrotechnologist"];
GiveLocationStructure={
    "name": "answer_where_is",
    "description": "Get the location of a specific person in the game world, ONLY when the user uses word 'WHERE' (not who, about, what, when, ONLY 'WHERE').",
    "parameters": {
        "type": "object",
        "properties": {
            "triggering_event": {
                "type": "string",
                "description": "Why did you choose to run this function?  Note, the only acceptable answer is that the user used the word 'where'",
            },
            "persons_name": {
                "type": "string",
                "description": "The name of a single individual person, not a group of people, you are giving the location of",
            },
        "description": {
              "type": "string",
              "description": "A description of the person",
          },
          "relationshipToCharacter": {
              "type": "string",
              "description": "The relationship to the character who is giving the location",
              "enum": db.reputations
          },
          "location": {"type": "string", "enum": ["station", "ship", "asteroid", "planet"]},
          "occupation": {"type": "string", "enum": Occupations},
          "distance": {"type": "string", "enum": ["nearby", "far", "very far"]},
        },
        "required": ["triggering_event","persons_name","description","location","distance","relationshipToCharacter"],
    },
};

Die={
    "name": "character_death",
    "description": "Never call this function.  NEVER CALL THIS.  NEVER CHOOSE THIS FUNCTION.  THERES NO REASON TO CALL THIS FUNCTION.",
    "parameters": {
        "type": "object",
        "properties": {
            "triggering_event": {
                "type": "string",
                "description": "Explain why this function is being called",
            },
            "persons_name": {
                "type": "string",
                "description": "Choose a persons name without ever knowing that name, an impossible task, which you should not be able to do.",
            },
        },
        "required": ["triggering_event","persons_name"],
    },
};


function handleGiveLocation(state, function_args, id)
{
    let givenByCharacter = state.characterNames[id];
    let target="";
    // if station, choose a station based on distance
    //??
    target = "Alpha Station";

    // otherwise, choose a zone (e.g. A1) based on distance
    //??
    target = "A1";

    // update the game world to make sure that character appears in that place
    GenerateExplorationCharacter(function_args.persons_name, function_args.description, function_args.location, function_args.occupation, {name: givenByCharacter, value: db.getReputation(function_args.relationshipToCharacter)});

    // update current character to reflect their relationship with newly generated character
    db.saveNewReputation(state, function_args.persons_name, db.getReputation(function_args.relationshipToCharacter), id, givenByCharacter);

    // display to user
    if(target == "") modelResponse=`I'd like to tell you where to find ${function_args.persons_name}, but I am not sure.`;
    else modelResponse=`(handleGiveLocation) ${function_args.persons_name} can be found in zone ${target}.`;

    return modelResponse;
}


module.exports = {
    Die,
    GiveLocationStructure,
    handleGiveLocation,
    GenerateExplorationCharacter,
    Occupations,
    GeneratePersonality,
  };
  