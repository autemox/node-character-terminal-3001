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
        await this.client.Connect();
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

    async panRight(imagineResult, prompt, index) {
        return await this.client.Variation({
            index: index,
            msgId: imagineResult.id,
            hash: imagineResult.hash,
            flags: imagineResult.flags,
            content: prompt,
            loading: (uri, progress) => {
                console.log("Variation.loading", uri, "progress", progress);
            },
        });
    }

    async makeSquare(imagineResult, prompt) {
        const zoomout = imagineResult.options?.find((o) => o.label === "Custom Zoom");
        if (!zoomout) {
            console.error("No zoomout");
            return null;
        }
        return await this.client.Custom({
            msgId: imagineResult.id,
            flags: imagineResult.flags,
            content: `${prompt} --zoom 2`,
            customId: zoomout.custom,
            loading: (uri, progress) => {
                console.log("loading", uri, "progress", progress);
            },
        });
    }

    async begin(prompts) {
        return;
        prompts = [
            "wide angle. full body shot facing the camera:: humanoid alien space pirate woman at bar::4 space station bar :: alien humanoid ::2 style of artist Craig Mullins ::10",
            "wide angle. full body shot facing the camera:: humanoid alien space pirate woman at bar::4 space station bar :: alien humanoid ::2 style of artist Craig Mullins ::10",
            "quiet dark ::4 space station bar :: window view of space ::2 style of artist Craig Mullins ::10",
            "quiet dark ::4 space station bar :: window view of space ::2 style of artist Craig Mullins ::10",
            "space station bar ::2 style of artist Craig Mullins ::10",
        ];

        await this.connect();

        // 1. Generate an image with the first prompt
        const result1 = await this.generateImage(prompts[0]);
        console.log("Result 1 (face):", result1.uri);

        // 2. Upscale the result
        const upscaled = await this.upscale(result1);
        console.log("Result 2 (face, upscaled):", result1.uri);

        // 3. Pan right with the next three prompts
        const panned1 = await this.panRight(upscaled, prompts[1], 1);
        console.log("Result 3 (panning):", result1.uri);
        const panned2 = await this.panRight(panned1, prompts[2], 2);
        console.log("Result 4 (panning):", result1.uri);
        const panned3 = await this.panRight(panned2, prompts[3], 3);
        console.log("Result 5 (panning):", result1.uri);

        // 4. Make the image square
        const squaredImage = await this.makeSquare(panned3, prompts[4]);
        console.log("Final result:", squaredImage.uri);

        this.client.Close();
        return squaredImage;
    }
}

module.exports = {
    MidjourneyManipulator
};