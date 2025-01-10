const { Server } = require('socket.io');

let io;

module.exports = {
  init: (server) => {
    io = new Server(server, {
      cors: {
        origin: ["http://localhost:5173","http://localhost:5500"], // Adjust for your frontend
        methods: ["GET", "POST"],
      },
    });

    io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Join a specific room
      socket.on('joinRoom', (userId) => {
        socket.join(userId);
        console.log(`User ${socket.id} joined room: ${userId}`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
      });
    });

    return io;
  },

  getIO: () => {
    if (!io) {
      throw new Error("Socket.IO not initialized!");
    }
    return io;
  },
};
