import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { GameRoom } from './rooms/GameRoom';
import { EVENTS, GAME_CONFIG } from '../shared/constants';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Add CORS middleware for Express endpoints
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Configuration
const GAME_PASSWORD = process.env.GAME_PASSWORD || '';
const REQUIRE_PASSWORD = GAME_PASSWORD.length > 0;
const MAX_PLAYERS = parseInt(process.env.MAX_PLAYERS || '8');
const PORT = parseInt(process.env.PORT || '3000');

// Rate limiting and connection tracking
const connectionAttempts = new Map<string, { count: number; lastAttempt: number }>();
const authenticatedPlayers = new Set<string>();
const authTimeouts = new Map<string, NodeJS.Timeout>();

// Socket.io server with open CORS for friend play
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow connections from anywhere
    methods: ['GET', 'POST'],
    credentials: true
  },
  connectTimeout: 10000,
  pingTimeout: 5000,
  pingInterval: 2000
});

// Rate limiting middleware
io.use((socket, next) => {
  const ip = socket.handshake.address;
  const now = Date.now();
  
  // Clean old attempts (older than 1 minute)
  const entry = connectionAttempts.get(ip);
  if (entry && now - entry.lastAttempt > 60000) {
    connectionAttempts.delete(ip);
  }
  
  // Check rate limit
  const current = connectionAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  if (current.count >= 10) {
    console.log(`❌ Rate limit exceeded for ${ip}`);
    return next(new Error('Too many connection attempts. Please wait.'));
  }
  
  // Update attempt count
  connectionAttempts.set(ip, { 
    count: current.count + 1, 
    lastAttempt: now 
  });
  
  next();
});

// Game room management
const rooms = new Map<string, GameRoom>();
let defaultRoom: GameRoom | null = null;

// Status endpoint for frontend to check server info
app.get('/', (req, res) => {
  res.json({
    game: 'Trespasser',
    status: 'online',
    version: '1.0.0',
    players: authenticatedPlayers.size,
    maxPlayers: MAX_PLAYERS,
    passwordRequired: REQUIRE_PASSWORD,
    uptime: process.uptime()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to check game state
app.get('/debug/gamestate', (req, res) => {
  if (!defaultRoom) {
    res.json({ error: 'No game room initialized' });
    return;
  }
  
  // Get a sample game state
  const gameState = defaultRoom.getGameState();
  const walls = gameState.getDestructionSystem().getWalls();
  
  res.json({
    roomInitialized: defaultRoom.isInitialized(),
    wallCount: walls.size,
    wallIds: Array.from(walls.keys()).slice(0, 5),
    playerCount: gameState.getPlayers().size,
    playerIds: Array.from(gameState.getPlayers().keys()),
    timestamp: Date.now()
  });
});

io.on('connection', (socket) => {
  const ip = socket.handshake.address;
  console.log(`🔌 Connection attempt from ${ip} (${socket.id})`);
  
  // Check player limit
  if (authenticatedPlayers.size >= MAX_PLAYERS) {
    socket.emit('error', 'Server is full');
    socket.disconnect();
    console.log(`❌ Server full, rejected ${ip}`);
    return;
  }
  
  if (REQUIRE_PASSWORD) {
    // Set authentication timeout
    const timeout = setTimeout(() => {
      if (!authenticatedPlayers.has(socket.id)) {
        socket.emit('auth-timeout', 'Authentication timeout');
        socket.disconnect();
        console.log(`⏰ Auth timeout for ${ip}`);
      }
    }, 5000);
    
    authTimeouts.set(socket.id, timeout);
    
    // Wait for password
    socket.on('authenticate', (data: any) => {
      const timeout = authTimeouts.get(socket.id);
      if (timeout) {
        clearTimeout(timeout);
        authTimeouts.delete(socket.id);
      }
      
      // Handle both string and object formats
      const password = typeof data === 'string' ? data : data?.password;
      
      if (password === GAME_PASSWORD) {
        authenticatedPlayers.add(socket.id);
        socket.emit('authenticated');
        joinGame(socket);
        console.log(`✅ Player authenticated: ${socket.id} from ${ip}`);
      } else {
        socket.emit('auth-failed', 'Invalid password');
        socket.disconnect();
        console.log(`❌ Failed auth from ${ip}: wrong password`);
      }
    });
  } else {
    // No password required, join immediately
    joinGame(socket);
    console.log(`✅ Player joined: ${socket.id} from ${ip} (no password)`);
  }
  
  socket.on('disconnect', (reason) => {
    handleDisconnect(socket, reason);
  });
  
  // Rate limit game events for authenticated players only
  setupGameEventHandlers(socket);
});

function joinGame(socket: any) {
  // Room should already be created during server startup
  if (!defaultRoom) {
    console.error('❌ Game room not initialized! This should not happen.');
    socket.emit('error', 'Server not ready');
    socket.disconnect();
    return;
  }
  
  // Add player to game
  defaultRoom.addPlayer(socket);
}

function handleDisconnect(socket: any, reason: string) {
  const wasAuthenticated = authenticatedPlayers.has(socket.id);
  
  // Cleanup
  authenticatedPlayers.delete(socket.id);
  const timeout = authTimeouts.get(socket.id);
  if (timeout) {
    clearTimeout(timeout);
    authTimeouts.delete(socket.id);
  }
  
  if (wasAuthenticated && defaultRoom) {
    defaultRoom.removePlayer(socket.id);
    console.log(`👋 Player left: ${socket.id} (${reason}). Players: ${authenticatedPlayers.size}`);
    
    // Don't destroy the room - keep it persistent for new connections
    // Clean up empty room
    /*
    if (authenticatedPlayers.size === 0 && defaultRoom) {
      defaultRoom.destroy();
      defaultRoom = null;
      rooms.delete('default');
      console.log('🧹 Game room destroyed (empty)');
    }
    */
  }
}

function setupGameEventHandlers(socket: any) {
  // Rate limiting for individual events
  const eventLimits = new Map<string, number>();
  
  function isEventRateLimited(eventName: string, maxPerSecond: number): boolean {
    const key = `${socket.id}:${eventName}`;
    const now = Date.now();
    const lastTime = eventLimits.get(key) || 0;
    
    if (now - lastTime < (1000 / maxPerSecond)) {
      return true;
    }
    
    eventLimits.set(key, now);
    return false;
  }
  
  // Only handle game events from authenticated players
  const originalOn = socket.on.bind(socket);
  socket.on = function(event: string, handler: Function) {
    if (event.startsWith('player:') || event.startsWith('weapon:') || event.startsWith('grenade:')) {
      return originalOn(event, (...args: any[]) => {
        if (!authenticatedPlayers.has(socket.id)) {
          return; // Ignore events from unauthenticated players
        }
        
        // Rate limit critical events
        if (event === 'player:input' && isEventRateLimited('input', 60)) {
          return; // Max 60 inputs per second
        }
        if (event.startsWith('weapon:') && isEventRateLimited('weapon', 10)) {
          return; // Max 10 weapon actions per second
        }
        
        handler(...args);
      });
    }
    return originalOn(event, handler);
  };
}

// Graceful error handling for port conflicts
httpServer.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    console.error(`💡 Try: lsof -ti:${PORT} | xargs kill -9`);
    console.error(`💡 Or use a different port: PORT=${parseInt(PORT.toString()) + 1} npm start`);
    process.exit(1);
  }
  console.error(`❌ Server error:`, err);
});

// Pre-create the default game room to avoid initialization delays
async function initializeServer() {
  console.log('🔄 Initializing game room...');
  defaultRoom = new GameRoom('default', io);
  rooms.set('default', defaultRoom);
  
  // Wait for room to be fully initialized
  await new Promise(resolve => {
    const checkInit = setInterval(() => {
      if (defaultRoom && defaultRoom.isInitialized()) {
        clearInterval(checkInit);
        resolve(true);
      }
    }, 100);
  });
  console.log('✅ Game room ready!');
}

// Initialize the server BEFORE starting to accept connections
initializeServer().then(() => {
  // Start server
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(50));
    console.log('🎮 TRESPASSER MULTIPLAYER SERVER STARTED');
    console.log('='.repeat(50));
    console.log(`🚀 Status: ONLINE`);
    console.log(`🔧 Port: ${PORT}`);
    console.log(`👥 Max Players: ${MAX_PLAYERS}`);
    console.log(`🔐 Password: ${REQUIRE_PASSWORD ? '✅ Required' : '❌ Not required'}`);
    
    if (REQUIRE_PASSWORD) {
      console.log(`🔑 Password: "${GAME_PASSWORD}"`);
    }
    
    console.log('\n📱 CONNECTION METHODS:');
    console.log(`   Local:    http://localhost:${PORT}`);
    console.log(`   Local:    http://127.0.0.1:${PORT}`);
    
    // Show all network interfaces
    const os = require('os');
    const nets = os.networkInterfaces();
    const lanIPs: string[] = [];
    
    Object.keys(nets).forEach(name => {
      nets[name]?.forEach((net: any) => {
        if (net.family === 'IPv4' && !net.internal) {
          const lanUrl = `http://${net.address}:${PORT}`;
          console.log(`   LAN (${name}): ${lanUrl}`);
          lanIPs.push(net.address);
        }
      });
    });
    
    console.log('\n🌐 FOR INTERNET PLAY:');
    console.log(`1. Port forward TCP port ${PORT} to this computer`);
    console.log(`2. Find your public IP: curl ifconfig.me`);
    console.log(`3. Share: http://[YOUR-PUBLIC-IP]:${PORT}`);
    
    if (lanIPs.length > 0) {
      console.log('\n🏠 FOR LAN PLAY:');
      console.log(`Share any of these URLs with friends on your network:`);
      lanIPs.forEach(ip => console.log(`   http://${ip}:${PORT}`));
    }
    
    console.log('\n🎯 GAME INFO:');
    console.log(`   Tick Rate: ${GAME_CONFIG.TICK_RATE} Hz`);
    console.log(`   Network Rate: ${GAME_CONFIG.NETWORK_RATE} Hz`);
    console.log('='.repeat(50) + '\n');
    
    // Show quick troubleshooting tips
    console.log('💡 TROUBLESHOOTING:');
    console.log(`   • Test server: curl http://localhost:${PORT}`);
    console.log(`   • Kill conflicting process: lsof -ti:${PORT} | xargs kill -9`);
    console.log(`   • Use different port: PORT=3001 npm start`);
    console.log('');
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Server shutting down...');
  if (defaultRoom) {
    defaultRoom.destroy();
  }
  httpServer.close(() => {
    console.log('✅ Server stopped');
    process.exit(0);
  });
});

// Clean up rate limits every minute
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of connectionAttempts.entries()) {
    if (now - data.lastAttempt > 60000) {
      connectionAttempts.delete(ip);
    }
  }
}, 60000);
