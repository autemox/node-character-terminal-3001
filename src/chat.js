// this handles interaction with openai upon user sending a message

const memories = require('./memories');
const qdrantMemories = require('./qdrant-memories');
const exploration = require('./exploration');
const qdrant = require('./qdrant');
const db = require('./db');
const openai = require('./openaiSetup');
const utils = require('./openaiUtils');
const chatCommands = require('./chatCommands');

//CONFIG: TWILIO API USAGE
var apiCalls=0;
var twilio = require('twilio');
const { model } = require('mongoose');
var client = new twilio(process.env.TWILIO_ACCOUNT, process.env.TWILIO_AUTH);  // as of 2023-06-22
var twilioPhone = process.env.TWILIO_PHONE;
var phoneAlertNumber= process.env.TWILIO_ALERT_PHONE;

function handleDisconnect(state, id)
{
    if (state.userTimeouts[id]) {
        clearTimeout(state.userTimeouts[id]);
        memories.processAndSaveMessages(state, id); // If user disconnects, process and save the messages for this user
      }
}

// FUNCTION: SYSTEMDIRECTIVES
function updateSystemDirective(state, messages, directiveMsg)
{
  if(!messages) 
  {
    console.error("[updateSystemDirective()] messages is undefined (possibly after an update to character sheet?)");
    return;
  }
  
  // clear premessage headers
  messages.forEach(message => {
    if (message.content.includes(state.preMsgHeader)) {
        message.content = message.content.replace(state.preMsgHeader, '').trim();
    }
  });

  // clear directive
	for (let i = messages.length - 1; i >= 0; i--) {     // clear previous directive messages, only one needs to be included and it will be the current one
	  if (messages[i].role === "user"&&messages[i].content.substring(0,10)=="Directive:") {
      console.log("Clearing Directive: ", { directive: messages[i].content });
		  messages.splice(i, 1);
	  }
	}
	if(directiveMsg!="") 
  {
    messages.push({ role: "user", content: "Directive: "+directiveMsg });            // remember the current directive and keep it at forefront
    state.systemDirective=directiveMsg;
  }
  return messages;
}

async function initializeCharacter(state, characterName, id)
{
  state.messagesByCharacter[characterName]=[]; 
  await qdrantMemories.reloadCharacter(characterName);
}

async function receiveChatObject(state, obj, id, io)
{
  if (!(obj.to in state.messagesByCharacter)) initializeCharacter(state, obj.to, id);   // create message thread if neeeded
  let messages=state.messagesByCharacter[obj.to];

  // update mappings
  state.userNames[id] = obj.from;
  state.characterNames[id] = obj.to;
  if (state.userTimeouts[id]) clearTimeout(state.userTimeouts[id]);
  state.userTimeouts[id] = setTimeout(() => { memories.processAndSaveMessages(state, id); }, 60000); // messages will be processed and saved to memory after 1 minute

  // send message to all users and save to messages history
  console.log(`[${obj.from}] to [${obj.to}] ${obj.message}`);
  io.emit(`chat message`, `${obj.from}<br> ${obj.message}<br><br>`);
  
  // prepare system message using relavent character data from mongodb and qdrant
  state.characterSheets[id] = await db.getCharacter(obj.to);
  if(await chatCommands.handleUserMessage(state, id, io, obj.message)) return;  // look for commands from user, and do not continue if one is found
  let similarityQuery = utils.messagesToString(messages, obj.to, "User", 3)+" \n User: "+obj.message; // shorter version of messages
  
  // filters differ depending on the title of the character
  let filter;
  if(state.characterSheets[id]._doc.title == state.TITLE_SS_EXPLORATION_CHARACTER) filter = { should: [ { key: "label", match: { value: "lore" } }, { key: "title", match: { value: obj.to } } ] };
  else filter = { should: [ { key: "title", match: { value: obj.to } } ] };

  let memoriesAndKnowledge = await qdrant.getFromQdrant(qdrant.client, similarityQuery, filter);
  if(memoriesAndKnowledge) memoriesAndKnowledgeString = `Utilize characters memory and game world knowledge by using these Facts:  Fact: ${memoriesAndKnowledge.join(".  Fact: ")}`;
  else memoriesAndKnowledgeString=`No memories or knowledge.`;
  
  // create new directive
  state.systemDirectiveHeader = db.updateSystemDirectiveHeader(state, state.characterSheets[id]);
  let newDirective=`${state.systemDirectiveHeader} ${db.characterToString(state.characterSheets[id])}.  ${memoriesAndKnowledgeString}`;
  messages=updateSystemDirective(state, messages, newDirective);
  state.systemDirective = newDirective;

  // add to messages history
  messages.push({ role: "user", content: state.preMsgHeader + obj.message });  // add to messages history

  // shorten message history if needed
  checkMessageLength(state, io, obj.to, state.MAX_TOKENS);

  try {
  
    // EXECUTE: TWILIO API USAGE
    console.log("Twilio counts "+apiCalls+" API calls performed this session (%10: "+(apiCalls%10)+")");
    if(apiCalls%10==1)
    {
      client.messages.create({
          body: 'ChatGPTx10@'+state.PORT+" "+JSON.stringify(messages[messages.length-1]).substring(0,100)+"... ("+apiCalls+" API calls performed)",
          to: phoneAlertNumber,  // Text this number
          from: twilioPhone      // From a valid Twilio number
      })
      .then((message) => console.log(`Twilio message sent.  ${message.sid}`))
      .catch((error) => console.error(error));
    }
    apiCalls++;

    // determine what functions to allow
    functionsList=[];
    const lowerCaseStr = obj.message.toLowerCase();
    if(lowerCaseStr.includes("where") || lowerCaseStr.includes("give me")) functionsList.push(GiveLocationStructure);

    await utils.sleep(500);
    console.log("Attempting to get response from ChatGPT (messages is approx "+utils.estimateTokens(messages)+" token)")
    
    // Send message to ChatGPT Api
    let modelResponse;
    let model = state.EXPLORATION_CHARACTERS_USE_GPT3 && state.characterSheets[id]._doc.title == state.TITLE_SS_EXPLORATION_CHARACTER ? "gpt-3.5-turbo-16k" : state.ASSISTANTS_USE_GPT3 && state.characterSheets[id]._doc.title == "assistant" ? "gpt-3.5-turbo-16k" : state.CHARACTERS_USE_GPT3 && state.characterSheets[id]._doc.title == state.TITLE_SS_EXPLORATION_CHARACTER && state.characterSheets[id]._doc.title != "assistant" ? "gpt-3.5-turbo-16k" : "gpt-4-0613"; // gpt-3.5-turbo-16k  or   gpt-4-0613
    const query = { model: model, messages: messages };
    if(functionsList.length>0) { query.functions = functionsList; query.function_call="auto"; } // send in functions
    const response = await openai.createChatCompletion(query);

      // EXPRESS: ON RECEIVE MESSAGE FROM CHATGPT
      let unprocessedMessage = response.data.choices[0].message;

      // HANDLE FUNCTION CALLS
      if (unprocessedMessage.function_call) {
        let answer_where_is = () => {};
        let character_death = () => {};
        let available_functions = {
          "answer_where_is": answer_where_is,
          "character_death": character_death,
        }; 
        let function_name = unprocessedMessage.function_call.name;
        let function_to_call = available_functions[function_name];
        let function_args = JSON.parse(unprocessedMessage.function_call.arguments);
        
        console.log("[FUNCTION] "+function_name+" function_args: " +JSON.stringify(function_args));
        if(function_name=="answer_where_is") modelResponse = exploration.handleGiveLocation(state, function_args, id);
        else if(function_name=="character_death") modelResponse = "I'd rather die.  "+function_args.triggering_event;
        else modelResponse = "Function error.";
      }
      else if(state.characterSheets[id]._doc.title.trim().toLowerCase() == "assistant")
      {
        // assistants can write as much as they want
        modelResponse = unprocessedMessage.content.trim();
      }
      else 
      {
        // characters who are not assistants are limited to one line
        const parts = unprocessedMessage.content.trim().split("\n");
        modelResponse = parts[0];
        if (parts.length > 1) {
            const errorMessage = parts.slice(1).join("\n");
            console.error("[receiveChatObject()] Extra content removed:", errorMessage);
        }
      }

    // Send the model's response to all clients
    console.log(`[${obj.to}] to [User] ${modelResponse}`);
    io.emit(`chat message`, `${obj.to}<br> ${modelResponse}<br><br>`);
    state.messagesByCharacter[obj.to].push({ role: "system", content: modelResponse });  // add to messages history
    checkMessageLength(state, io, obj.to, state.MAX_TOKENS*0.8);

  } catch (error) {
    console.error(`Error in receiveChatObject(): ${error.response}`, error);
    io.emit(`chat message`, `[ERROR: ${error.response != null ? error.response.statusText : error}]<br><br>`); // send html to clients with twilio or chatgpt error
  }
}

async function checkMessageLength(state, io, characterName, maxTokens)
{
  try{
    let messages = state.messagesByCharacter[characterName];
    if(messages.length<2) return;
    let tokens = utils.estimateTokens(messages);
    if (tokens > maxTokens) {
        await utils.sleep(500);
        messages = updateSystemDirective(state, messages, ""); // clear directive
        let directiveTokens = tokens-utils.estimateTokens(messages);
        messages = await utils.shortenMessages(messages);
        io.emit(`chat message`, `[SHORTENED MESSAGES TO ${utils.estimateTokens(messages)+directiveTokens} TOKENS.  NOTE DIRECTIVE IS ${directiveTokens} TOKENS]<br><br>`);
    }
  } catch (error) {
    console.error("[checkMessageLength()] "+error+"<Br>");
    io.emit(`chat message`, `[ERROR: ${error.response != null ? error.response.statusText : error}]<br><br>`); // send html to clients with twilio or chatgpt error
  }
}

    
module.exports = {
    handleDisconnect,
    receiveChatObject,
    checkMessageLength,
    updateSystemDirective,
};
