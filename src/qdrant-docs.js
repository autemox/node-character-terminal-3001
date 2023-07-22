const { DirectoryLoader } = require("langchain/document_loaders/fs/directory");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const RecursiveCharacterTextSplitter = require("langchain/text_splitter").RecursiveCharacterTextSplitter;
const dotenv = require("dotenv");
dotenv.config();

async function reload(label)
{
    try {
        const loader = new DirectoryLoader("./documents", {
            ".txt": (path) => new TextLoader(path),
        });
        const docs = await loader.load();

        let batch = [];
        for (const doc of docs) {

            const textSplitter = new PriorityDoubleNewLineSplitter({ chunkSize: 1000 });
            const chunks = await textSplitter.createDocuments([doc.pageContent]);
            
            for(let i=0; i<chunks.length; i++) 
            {
                batch.push({ label: label, title: doc.metadata.source.split('\\').pop().split('.').shift(), content: chunks[i].pageContent });
            }
        }
        console.log(`Created batch of ${batch.length} label/title/content objects`, batch);
        
        const qdrant = require('./qdrant');
        if(batch.length > 0) qdrant.saveBatchToQdrant(qdrant.client, batch);

    }catch (error) { console.error('An error occurred in reload(): ', error); }
}

class PriorityDoubleNewLineSplitter extends RecursiveCharacterTextSplitter {
    async splitText(text) {
        const separator = "\r\n\r\n";
        const initialSplits = text.split(separator);
        const finalChunks = [];
        for (const split of initialSplits) {
            if (split.length > this.chunkSize) { 
                const furtherSplits = await super.splitText(split); 
                finalChunks.push(...furtherSplits);
            } else {
                finalChunks.push(split); // If it's smaller or equal to chunkSize, just add it to the final chunks
            }
        }
        return finalChunks;
    }
}


module.exports = {
    reload,
    PriorityDoubleNewLineSplitter,
};