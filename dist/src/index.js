"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const GameRoom_1 = require("./rooms/GameRoom");
const constants_1 = require("../shared/constants");
dotenv_1.default.config();
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:5176'
        ],
        methods: ['GET', 'POST']
    }
});
const rooms = new Map();
const defaultRoom = new GameRoom_1.GameRoom('default', io);
rooms.set('default', defaultRoom);
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    defaultRoom.addPlayer(socket);
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        defaultRoom.removePlayer(socket.id);
    });
});
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🎮 Game tick rate: ${constants_1.GAME_CONFIG.TICK_RATE} Hz`);
    console.log(`🌐 Network rate: ${constants_1.GAME_CONFIG.NETWORK_RATE} Hz`);
});
