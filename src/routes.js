/* 
this routes the user to 1 of 3 places:
1. / -> list of characters to chat with
2. /characterName -> chatroom with that character
3. /characterName/generateImage -> generates an image of that character
*/

const express = require('express');
const router = express.Router();
const path = require('path');
const generateImage = require('./generateImage');

router.get('/', (req, res) => {
    let html = '<h1>Language Teachers:</h1>';
    characters=[ {name: "Stew", description: "English"}, {name: "Isabella", description: "Spanish"}];
    characters.forEach(character => {
        html += `<p><a href="/${character.name}">${character.name} - ${character.description}</a></p>`;
    });

    res.send(html);
});

// Render a specific character do not allow . in character names
router.get('/:characterName', (req, res, next) => {
    if (req.params.characterName.includes('.')) {
        return next();  // Skip this middleware if the name contains a dot
    }
    res.render('index', { characterName: req.params.characterName });
});

router.get('/:characterName/generateImage', (req, res) => {
    const characterName = req.params.characterName;
    const character = characters.find((c) => c.name === characterName);

    if (character) {
        const image = generateImage.fromCharacter(character);
        res.send(image);
    } else {
        res.status(404).send("Character not found");
    }
});

module.exports = router;
