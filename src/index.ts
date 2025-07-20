import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import * as os from 'os';
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
// Use Railway's assigned PORT
const PORT = parseInt(process.env.PORT || '3000');

// Debug Railway port configuration
console.log(`🔧 Railway Port Debug:`);
console.log(`   process.env.PORT = "${process.env.PORT}"`);
console.log(`   Final PORT = ${PORT}`);
console.log(`   NODE_ENV = "${process.env.NODE_ENV}"`);

// Rate limiting and connection tracking
const connectionAttempts = new Map<string, { count: number; lastAttempt: number }>();
const authenticatedPlayers = new Set<string>();
const authTimeouts = new Map<string, NodeJS.Timeout>();

// Socket.io server with open CORS for friend play
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      console.log(`🌐 CORS check for origin: ${origin}`);
      // Always allow for now to debug
      callback(null, true);
    },
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

// Health check endpoint for Railway
app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    service: 'Trespasser Multiplayer Backend',
    timestamp: new Date().toISOString(),
    gameRoom: defaultRoom ? 'initialized' : 'pending'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    gameRoom: defaultRoom ? 'ready' : 'initializing'
  });
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
  console.log(`🔌 Origin: ${socket.handshake.headers.origin || 'no origin header'}`);
  console.log(`🔌 Transport: ${socket.conn.transport.name}`);
  
  // Check player limit
  if (authenticatedPlayers.size >= MAX_PLAYERS) {
    socket.emit('error', 'Server is full');
    socket.disconnect();
    console.log(`❌ Server full, rejected ${ip}`);
    return;
  }
  
  if (REQUIRE_PASSWORD) {
    // Set authentication timeout (increased from 5s to 30s for debugging)
    const timeout = setTimeout(() => {
      if (!authenticatedPlayers.has(socket.id)) {
        console.log(`⏰ Auth timeout for ${ip} - Socket ID: ${socket.id}`);
        console.log(`⏰ Authenticated players: ${Array.from(authenticatedPlayers)}`);
        socket.emit('auth-timeout', 'Authentication timeout');
        socket.disconnect();
      } else {
        console.log(`✅ Auth timeout fired but player ${socket.id} is already authenticated`);
      }
    }, 30000); // Increased to 30 seconds
    
    authTimeouts.set(socket.id, timeout);
    console.log(`⏰ Set auth timeout for ${socket.id}`);
    
    // Wait for password
    socket.on('authenticate', (data: any) => {
      console.log(`🔐 Authenticate event received for ${socket.id}`);
      const timeout = authTimeouts.get(socket.id);
      if (timeout) {
        clearTimeout(timeout);
        authTimeouts.delete(socket.id);
        console.log(`✅ Cleared auth timeout for ${socket.id}`);
      } else {
        console.log(`⚠️ No timeout found for ${socket.id} during auth`);
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
  // Debug logging
  console.log(`🎮 [joinGame] Called for ${socket.id}`);
  console.log(`🎮 [joinGame] defaultRoom status:`, {
    exists: !!defaultRoom,
    initialized: defaultRoom?.isInitialized ? defaultRoom.isInitialized() : 'method not available'
  });
  
  // Room should already be created during server startup
  if (!defaultRoom) {
    console.error('❌ Game room not initialized! This should not happen.');
    socket.emit('error', 'Server not ready');
    socket.disconnect();
    return;
  }
  
  // Add player to game
  defaultRoom.addPlayer(socket);
  
  console.log(`✅ Player ${socket.id} added to game room`);
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

  // Simple admin check - you can customize this logic
  function isAdmin(socket: any): boolean {
    // Option 1: Use environment variable for admin password
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminPassword) {
      return socket.adminAuthenticated === true;
    }
    
    // Option 2: First connected player is admin (simple approach)
    const allSockets = Array.from(authenticatedPlayers);
    return allSockets.length > 0 && allSockets[0] === socket.id;
    
    // Option 3: Always allow (remove this in production)
    // return true;
  }

  // Admin authentication for restart commands
  socket.on('admin:authenticate', (password: string) => {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (adminPassword && password === adminPassword) {
      socket.adminAuthenticated = true;
      socket.emit('admin:authenticated');
      console.log(`🔑 Admin authenticated: ${socket.id}`);
    } else {
      socket.emit('admin:auth-failed');
      console.log(`❌ Admin auth failed: ${socket.id}`);
    }
  });

    // Game restart functionality - SIMPLE APPROACH
  socket.on('admin:restart_game', (data: { countdown?: number } = {}) => {
    if (!authenticatedPlayers.has(socket.id)) {
      return; // Not authenticated
    }
    
    if (!isAdmin(socket)) {
      socket.emit('error', 'Admin privileges required');
      console.log(`❌ Restart denied - not admin: ${socket.id}`);
      return;
    }

    const countdown = data.countdown || 3;
    console.log(`🔄 GAME RESTART requested by admin ${socket.id} - ${countdown}s countdown`);
    
    // Notify all players of restart
    io.emit('game:restarting', { 
      countdown,
      message: `Game restarting in ${countdown} seconds...`,
      adminId: socket.id
    });

    setTimeout(() => {
      try {
        console.log('🔄 Executing simple game restart...');
        
        if (defaultRoom) {
          // Simple state reset - no system recreation!
          defaultRoom.resetGame();
          
          console.log('✅ Game restart complete!');
          
          // Notify all players restart is complete
          io.emit('game:restarted', {
            message: 'Game has been restarted!',
            playersReconnected: authenticatedPlayers.size,
            totalPlayers: authenticatedPlayers.size
          });
        } else {
          throw new Error('No game room available');
        }
        
      } catch (error) {
        console.error('❌ Game restart failed:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        io.emit('game:restart_failed', {
          error: errorMessage,
          message: 'Game restart failed - please try again'
        });
      }
    }, countdown * 1000);
  });

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
  
  try {
    defaultRoom = new GameRoom('default', io);
    rooms.set('default', defaultRoom);
    
    // Wait for room to be fully initialized with timeout
    await Promise.race([
      new Promise(resolve => {
        const checkInit = setInterval(() => {
          if (defaultRoom && defaultRoom.isInitialized()) {
            clearInterval(checkInit);
            resolve(true);
          }
        }, 100);
      }),
      // Add 30 second timeout for Railway
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Game room initialization timeout')), 30000);
      })
    ]);
    
    console.log('✅ Game room ready!');
  } catch (error) {
    console.error('❌ Failed to initialize game room:', error);
    console.log('🔄 Continuing with basic server...');
    // Continue anyway for Railway deployment
  }
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
    
    // Simplified network detection for Railway compatibility
    try {
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
      
      if (lanIPs.length > 0) {
        console.log('\n🏠 FOR LAN PLAY:');
        console.log(`Share any of these URLs with friends on your network:`);
        lanIPs.forEach(ip => console.log(`   http://${ip}:${PORT}`));
      }
    } catch (error) {
      console.log('   (Network interface detection skipped in container)');
    }
    
    console.log('\n🌐 FOR INTERNET PLAY:');
    console.log(`1. Port forward TCP port ${PORT} to this computer`);
    console.log(`2. Find your public IP: curl ifconfig.me`);
    console.log(`3. Share: http://[YOUR-PUBLIC-IP]:${PORT}`);
    
    console.log('\n🎯 GAME INFO:');
    console.log(`   Tick Rate: ${GAME_CONFIG.TICK_RATE} Hz`);
    console.log(`   Network Rate: ${GAME_CONFIG.NETWORK_RATE} Hz`);
    console.log('='.repeat(50) + '\n');
    
    // Railway-friendly troubleshooting
    console.log('💡 SERVER STATUS: READY TO ACCEPT CONNECTIONS');
    console.log('🌐 Railway Health Check: Server is responding on all interfaces');
    console.log('');
  });
}).catch(error => {
  console.error('❌ Failed to initialize server:', error);
  // Start HTTP server anyway for Railway health checks
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 HTTP Server started on port ${PORT} (game room failed to initialize)`);
    console.log('💡 SERVER STATUS: READY TO ACCEPT CONNECTIONS (LIMITED MODE)');
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Server shutting down (SIGINT)...');
  gracefulShutdown();
});

// Handle Railway's SIGTERM signal
process.on('SIGTERM', () => {
  console.log('\n🛑 Server shutting down (SIGTERM - Railway container stop)...');
  gracefulShutdown();
});

function gracefulShutdown() {
  console.log('🔄 Starting graceful shutdown...');
  
  if (defaultRoom) {
    console.log('🎮 Destroying game room...');
    defaultRoom.destroy();
  }
  
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
    console.log('✅ Graceful shutdown complete');
    process.exit(0);
  });
  
  // Force exit after 5 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.log('⚠️ Force exit after timeout');
    process.exit(1);
  }, 5000);
}

// Clean up rate limits every minute
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of connectionAttempts.entries()) {
    if (now - data.lastAttempt > 60000) {
      connectionAttempts.delete(ip);
    }
  }
}, 60000);
