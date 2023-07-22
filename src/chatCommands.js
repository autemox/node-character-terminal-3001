const qdrant = require('./qdrant');
const loadFromGithub = require('./loadFromGithub');

async function handleUserMessage(state, id, io, newMessage)
{
    try {
        // display-directive
        if(newMessage.includes(state.TRIGGER_DISPLAY_DIRECTIVE))
            {
            io.emit(`chat message`, `[DIRECTIVE]<br>${state.systemDirective}<br><br><br>`);
            return true;
        }

        // update-qdrant
        if(newMessage.includes(state.TRIGGER_RELOAD_QDRANT_DB)) 
        {
            io.emit(`chat message`, `[INITIATING RELOAD QDRANT]<br><br>`);
            await qdrant.reloadCollection();
            io.emit(`chat message`, `[COMPLETED RELOAD QDRANT]<br><br>`);
            return true;
        }

        // load-github
        if(newMessage.includes(state.TRIGGER_LOAD_GITHUB_TO_MEMORIES)) 
        {
            const isValidURL = str => { try { new URL(str); return true; } catch (_) { return false; } };

            if(!isValidURL(state.characterSheets[id]._doc.location)) io.emit(`chat message`, `[UNABLE TO LOAD GITHUB TO MEMORIES- PLACE REPO URL UNDER 'LOCATION']<br><br>`);
            else
            {
                io.emit(`chat message`, `[INITIATING LOAD GITHUB TO MEMORIES]<br>`);
                await loadFromGithub.begin(state, io, id, state.characterSheets[id]._doc.location); // completed message will occur in here
            }
            return true;
        }
    } catch (error) {
        console.error(`Failed to execute chat command in ${newMessage} ${error}`);
        return true;
    }
    return false;
}

module.exports = {
    handleUserMessage,
};
