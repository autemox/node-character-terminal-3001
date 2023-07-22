const socketIO = require('socket.io');

async function handleSockets (server, chat, state)
{
  const io = socketIO(server);

  // SOCKET: ON CONNECT
  io.on('connection', (socket) => {
    console.log('[CONNECTIONS] A user connected');
  
    // SOCKET: ON DISCONNECT
    socket.on('disconnect', () => {
      console.log('[CONNECTIONS] User disconnected');
      
      chat.handleDisconnect(state, socket.id);
    });
  
    // SOCKET: ON RECEIVE MESSAGE FROM CLIENT/USER
    socket.on('chat object', async (obj) => {

      chat.receiveChatObject(state, obj, socket.id, io);
      
    });

    return io;
  });
}

module.exports = {
    handleSockets,
};
