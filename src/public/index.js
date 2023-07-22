const socket = io();
const messageBox = document.getElementById("message-box");
const chatBox = document.getElementById("chat-box");

messageBox.addEventListener("input", resizeMessageBox);
messageBox.addEventListener("keydown", handleEnterPress);

let characterName = document.body.dataset.characterName;

function handleEnterPress(e) {                                // ENTER KEY SENDS
  if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey) {                      // SHIFT AND CTRL KEY PREVENTS SEND
    e.preventDefault();
    sendMessage();
  }
}

function resizeMessageBox() {                                // DNYMAIC MESSAGE BOX SIZE
  messageBox.style.height = "4rem";
  messageBox.style.height = (messageBox.scrollHeight<400?messageBox.scrollHeight : 400) + "px";
}

const messagesContainer = document.getElementById("messages-container");
async function displayTextSlowly(text) { 
  //text=unescapeHtml(addImgTags(text));
  console.log("attempting to display: "+text);
  // The same logic from addTextOneWordAtATime function
  text = text.replaceAll("\n", "<br>");
  text = text.replaceAll("  ", "&nbsp;&nbsp;");
  text = text.replaceAll("</div><br>", "</div>");
  text = text.replaceAll("<div><br>", "<div>");
  text = text.replaceAll("<div>", " <div> ");
  text = text.replaceAll("</div>", " </div> ");
  text = text.replaceAll("<img", " <img");
  text = text.replaceAll("<img", " <img");

  let words = text.split(" ");
  let imageOrDivStartIndex = null;

  // Identify 'div' and 'img' tags and prevent them from being split
  ignoreNext=false;
  words = words.reduce((newWords, word, index) => {
      if(ignoreNext) { ignoreNext=false; return newWords; }

      if (word.startsWith("<div") || word.startsWith("<img")) {
          imageOrDivStartIndex = index;
          console.log("found a div at: "+index);
      }
      else if (word.endsWith("</div>") || word.endsWith(">") && imageOrDivStartIndex !== null) {
          newWords.push(words.slice(imageOrDivStartIndex, index + 1).join(" "));
          console.log("found the end of a div at: "+index);
          console.log("adding words between: "+imageOrDivStartIndex+" and "+index);
          console.log("adding words: "+words.slice(imageOrDivStartIndex, index + 1).join(" "));
          imageOrDivStartIndex = null;
          ignoreNext=true;
      } 
      else if (imageOrDivStartIndex === null) {
          newWords.push(word);
          console.log("no div found.  adding: "+word);
      }
      return newWords;
  }, []);

  const item = document.createElement("div");
  item.classList.add("rich-text-area");
  messagesContainer.appendChild(item);

  const textSpeed = text.length > 5000 ? 1 : text.length > 1000 ? 10 : text.length > 500 ? 25 : 50;

  for (const word of words) {
      item.innerHTML += word + " ";
      chatBox.scrollTop = chatBox.scrollHeight;
      await new Promise((resolve) => setTimeout(resolve, textSpeed));

      // Resize images to match textarea width
      const images = item.getElementsByTagName('img');
      for(let img of images) {
          img.style.width = "100%";
          img.style.height = "auto";
      }
  }
}


const spinner = document.getElementById("spinner");

function showSpinner() {
  spinner.classList.remove("hidden");
}

function hideSpinner() {
  spinner.classList.add("hidden");
}

// Inside the socket.on('chat message') event
socket.on("chat message", (msg) => {

  displayTextSlowly(msg);
  if(msg[0]!="U") hideSpinner();
});

function sendMessage() {
  const message = messageBox.value.trim();
  
  let obj = { message: message, from: "User", to: characterName }
 
  if (message) {
    socket.emit("chat object", obj);
    messageBox.value = "";
    resizeMessageBox();
  }
  messageBox.focus();
  showSpinner();
}
