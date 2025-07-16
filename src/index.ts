import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { GameRoom } from './rooms/GameRoom';
import { EVENTS, GAME_CONFIG } from '../shared/constants';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5176'
    ],
    methods: ['GET', 'POST']
  }
});

const rooms = new Map<string, GameRoom>();
const defaultRoom = new GameRoom('default', io);
rooms.set('default', defaultRoom);

io.on('connection', (socket) => {
  // console.log('Player connected:', socket.id);
  defaultRoom.addPlayer(socket);
  
  socket.on('disconnect', () => {
    // console.log('Player disconnected:', socket.id);
    defaultRoom.removePlayer(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  // console.log(`🚀 Server running on port ${PORT}`);
  // console.log(`🎮 Game tick rate: ${GAME_CONFIG.TICK_RATE} Hz`);
  // console.log(`🌐 Network rate: ${GAME_CONFIG.NETWORK_RATE} Hz`);
});
