global.fetch = require('node-fetch');
const { Midjourney } = require('midjourney');

const dotenv = require("dotenv");
dotenv.config();

class MidjourneyManipulator {

    constructor() {
        this.client = new Midjourney({
            ServerId: process.env.SERVER_ID,
            ChannelId: process.env.CHANNEL_ID,
            SalaiToken: process.env.SALAI_TOKEN,
            Debug: true,
            Ws: true,
        });
    }

    async connect() {
        await this.client.init();
    }

    async generateImage(prompt) {
        return await this.client.Imagine(prompt, (uri, progress) => {
            console.log("Imagine.loading", uri, "progress", progress);
        });
    }

    async upscale(imagineResult) {
        const U1CustomID = imagineResult.options?.find((o) => o.label === "U1")?.custom;
        if (!U1CustomID) {
            console.error("No U1");
            return null;
        }
        return await this.client.Custom({
            msgId: imagineResult.id,
            flags: imagineResult.flags,
            customId: U1CustomID,
            loading: (uri, progress) => {
                console.log("loading", uri, "progress", progress);
            },
        });
    }

    async customZoom(upscaled, prompt) {

        console.log("zoom: looking in... ", { upscaled});
        const pan = upscaled?.options?.find((o) => o.label === "Custom Zoom");
        console.log("zoom: found: ", pan);
        let con = `${prompt} --zoom 2`;

        const customArg = {
            msgId: upscaled.id,
            flags: upscaled.flags,
            content: con,
            customId: pan.custom,
            loading: (uri, progress) => {
                console.log("loading", uri, "progress", progress);
            }
        };
        console.log("zoom: creating custom arg: ", customArg);
        return await this.client.Custom(customArg);
    }

    async customPan(upscaled, prompt) {

        console.log("pan: looking in... ", { upscaled});
        const pan = upscaled?.options?.find((o) => o.label === "➡️");
        console.log("pan: found: ", pan);
        let con = `${prompt}`; // tried: zoom 2  pan_right 2   pan 2s

        const customArg = {
            msgId: upscaled.id,
            flags: upscaled.flags,
            content: con,
            customId: pan.custom,
            loading: (uri, progress) => {
                console.log("loading", uri, "progress", progress);
            }
        };
        console.log("pan: creating custom arg: ", customArg);
        return await this.client.Custom(customArg);
    }

    async generateVariation(imagine, prompt) {
        return await this.client.Variation({
            index: 1,
            msgId: imagine.id,
            hash: imagine.hash,
            flags: imagine.flags,
            content: prompt,
            loading: (uri, progress) => {
                console.log(`Variation loading`, uri, "progress", progress);
            }
        });
    }

    async log(io, var1, var2)
    {
        io.emit(`chat message`, `[MIDJOURNEY] ${var1}<br>${var2}<br><br>`);
        console.error("SUCCESS.  "+var1, var2);
    }

    async handleMidjourney(io) {

        const sex = ["man", "woman"][Math.floor(Math.random() * 2)];
        const descriptor = ["scifi captain", "space pirate", "space pirate", "space pirate", "space deckhand", "scifi politician"][Math.floor(Math.random() * 6)];
        const detail = ["freckled", "Horned", "Pierced", "bald", "Chubby", "fat", "obese", "strong", "blue haired", "smooth green skin", "tattooed", "orange haired", "blonde", "cheerful", "dirty", "hunchback", "cyclops", "alien humanoid"][Math.floor(Math.random() * 9)];
        //const detail = "freckled";
        const combo = `${detail} ${descriptor} ${sex}`;

        io.emit(`chat message`, `[MIDJOURNEY] ${combo} <br><br>`);

        let prompts = [
            `wide angle. full body shot facing the camera:: ${combo} sitting at bar::4 space station bar :: ${sex} :: style of artist Craig Mullins :: --ar 1:1`, //style of artist Craig Mullins ::10
            `${combo} sitting at bar::4 ${detail} ::10 ${sex} :: style of artist Craig Mullins :: --ar 16:9`, //10 style of artist Craig Mullins ::10
            `empty :: space station bar with a window view of stars in space :: window view of stars in space ::2 style of artist Craig Mullins :: --ar 16:9`,
            `empty :: space station bar with a window view of stars in space :: window view of stars in space ::2 style of artist Craig Mullins :: --ar 16:9`,
            `empty :: space station bar ::2 style of artist Craig Mullins :: --ar 16:9`,
            `quiet bar :: inside a space station bar :: bar :: space station :: style of artist Craig Mullins :: --zoom 2`,
            `empty :: space station bar ::2 style of artist Craig Mullins :: --ar 16:9`,    
        ];

        await this.connect();

    const DISCORD_EPOCH = 1420070400000n; // Note the 'n' at the end for BigInt

class SnowflakeGenerator {
    constructor(workerId = Math.floor(Math.random() * 1024), processId = Math.floor(Math.random() * 32)) {
        this.workerId = BigInt(workerId);
        this.processId = BigInt(processId);
        this.increment = 0n;
    }

    generate() {
        const timestamp = BigInt(Date.now()) - DISCORD_EPOCH;

        if (this.increment >= 64n) this.increment = 0n;

        const snowflake = 
            (timestamp << 22n) | 
            (this.workerId << 12n) |
            (this.processId << 7n) |
            this.increment;

        this.increment++;

        return snowflake.toString();
    }
}

const generator = new SnowflakeGenerator();
               
        //let result = await this.generateImage(prompts[0]);
        //result = await this.upscale(result); // not needed if variation is next
        //this.log(io, `SUCCESS. ${combo} Result 1 - USE THIS - (character)):`, JSON.stringify(result));

        //result = await this.generateVariation(result, prompts[1]);
        //result = await this.upscale(result);
        //this.log(io, `SUCCESS. ${combo} Result 2 (variation)):`, result.uri);

        //result = await this.customZoom(result, "psychedelic countryside in pop art style");
        //result = await this.upscale(result);
        //this.log(io, `SUCCESS. ${combo} Result 4 (zoom out):`, result.uri);
        
        //result = await this.customPan(result, "psychedelic countryside in pop art style");
        //result = await this.upscale(result);
        //this.log(io, `SUCCESS. ${combo} Result 3 (pan):`, result.uri);

        this.client.Close();
        return;
    }
}

module.exports = {
    MidjourneyManipulator
};