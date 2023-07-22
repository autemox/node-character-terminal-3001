const openai = require('./openaiSetup');

// Converts openai messages array to a string
function messagesToString(messages, systemName = "System", userName = "User", limit = 0) {
    
    const filteredMessages = messages.filter(message => !message.content.startsWith("Directive:")); // Filter out messages that start with "Directive:"
    const recentMessages = (limit > 0 && limit < filteredMessages.length) ? filteredMessages.slice(-limit) : filteredMessages; // Get only the most recent messages based on the limit
    
    return recentMessages.map(message => `${message.role}: ${message.content}`)
        .join(' \n ') // Add newline between messages
        .replace(/system/g, systemName)
        .replace(/user/g, userName);
}

function stringToMessages(str) {
    const pairs = str.split(/\s(?=(system|user):)/i);  // Split on spaces that are followed by either "system:" or "user:"
    return pairs.map(pair => {
        const [role, ...contentArr] = pair.split(':');
        return {
            role: role.trim().toLowerCase(),
            content: contentArr.join(':').trim()
        };
    });
}

// estimates the # of tokens in a string or messages
function estimateTokens(strOrMsg) 
{
    let str = Array.isArray(strOrMsg) ? messagesToString(strOrMsg) : strOrMsg;
    const tokens = str.split(/[\s.,!?;"'(){}\[\]:]+/);
    const nonEmptyTokens = tokens.filter(token => token.length > 0);
    return nonEmptyTokens.length;
}

// uses chatgpt to turn long messages into short ones
async function shortenMessages(messages)
{
    // split messages into 2 equally sized arrays
    const totalContentLength = messages.reduce((sum, item) => sum + item.content.length, 0);
    let firstArray = [];
    let secondArray = [];
    let firstArrayContentLength = 0;
    for (let item of messages) {
        if (firstArrayContentLength + item.content.length <= totalContentLength / 2) {
            firstArray.push(item);
            firstArrayContentLength += item.content.length;
        } else {
            secondArray.push(item);
        }
    }

    // call to chatgpt to summarize the first array
    let model = LONG_CONVERSATION_SUMMARIZER_USE_GPT3 ? "gpt-3.5-turbo-16k" : "gpt-4-0613";
    let shortStr = await simpleQuery("Shorten this conversation preserving only key details (names, actions, emotions), but keep it in conversation format: " + messagesToString(firstArray), model);
    firstArray = stringToMessages(shortStr);

    // recombine arrays
    return firstArray.concat(secondArray);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function simpleQuery(query, model) {

    model = (model == 3 || model == "3") ? "gpt-3.5-turbo-16k" : (model == 4 || model == "4") ? "gpt-4-0613" : model;
    const response = await openai.createChatCompletion({
      model: model,
      messages: [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": query}
      ]
    });
    return response.data.choices[0].message.content.trim();  // get response
  }

module.exports = {
    simpleQuery,
    shortenMessages,
    estimateTokens,
    stringToMessages,
    messagesToString,
    sleep,
};
