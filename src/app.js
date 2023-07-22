const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const chat = require("./chat");
const middlewares = require('./middlewares');
const routes = require('./routes');
const socket = require('./socket');

const app = express();

// this is passed into modules
state = {

  TITLE_SS_EXPLORATION_CHARACTER: "spacefarer",
  TRIGGER_RELOAD_QDRANT_DB: "reload-qdrant",
  TRIGGER_DISPLAY_DIRECTIVE: "display-directive",
  TRIGGER_LOAD_GITHUB_TO_MEMORIES: "load-github",
  EXPLORATION_CHARACTERS_USE_GPT3: true,
  CHARACTERS_USE_GPT3: false,
  ASSISTANTS_USE_GPT3: false,
  MEMORIES_SUMMARIZER_USE_GPT3: true,
  GITHUB_SUMMARIZER_USE_GPT3: true,
  LONG_CONVERSATION_SUMMARIZER_USE_GPT3: true,
  
  MAX_TOKENS: 8000,
  PORT: process.env.PORT || 3001,
  userTimeouts: {},
  userNames: {},
  characterNames: {},
  characterSheets: {},
  messagesByCharacter:  {}, // this will hold our characters messages, each character gets their own messages array, each array has elements role and content
  preMsgHeader: "",
  systemDirective: "",
  characterDirective: "Follow this directive for your responses: You are not here to provide the user with assistance and information.  Do not ask the user how you can assist them.  Do not apologize for confusion.  You are to respond as your character would. Total reply should be 1-2 sentences only. Brainstorm interesting and unique things that character would say.  Be highly descriptive and think of new interesting information about the character as needed.  Here is information about the character you are playing, pay careful attention to and follow the default prompt, do not reveal secrets unless completely convinced, and remember to bring up memories when appropriate: ",
  systemDirectiveHeaderAssistant: "Follow this directive for your responses: You are an assistant and should respond as your character would, but slightly briefer than normal chatGPT does.  Here is information about the character you are playing, pay careful attention to and follow the default prompt, do not reveal secrets unless completely convinced, and remember to bring up memories when appropriate: ",
  
}

function initializeExpress() {
  app.use(middlewares.limiter);
  app.use(middlewares.basicAuthentication);
  app.use((req, res, next) => {
    console.log(`Request received for: ${req.url}`);
    next();
});
  app.use(middlewares.serveStaticFiles); 
  middlewares.setViewEngine(app);
  app.use('/', routes);
}

function initializeDatabase() {
  mongoose
    .connect(process.env.ATLAS_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(() => console.log("MongoDB Atlas connection established successfully!"))
    .catch((err) => console.error("Database Connection Error: ", err.message));
}

function initializeSockets(server) {
  state.io = socket.handleSockets(server, chat, state);
  state.emit = async function (state, msg) {
    const io = await state.io;
    io.emit('chat message', `${msg}<br><br>`);
  };
}

app.start = function() {
  initializeExpress();

  const server = http.createServer(app);

  initializeDatabase();
  initializeSockets(server);

  server.listen(state.PORT, () => console.log(`Server started on port ${state.PORT}`));
};
module.exports = app;

let debugCount = 0;
setInterval(() => {
  debugCount++;  // For debugging only (place breakpoint here)
}, 1000);


