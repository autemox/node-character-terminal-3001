const db = require('./db');

function fromCharacter(name)
{
    let character = db.getCharacter(name);
    
    // have chatgpt generate a midjourney prompt
    //??
    
    // get midjourney to create
    //??

    // once its done, save url to db
    //??
}


module.exports = {
    fromCharacter,
};
