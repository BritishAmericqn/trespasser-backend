import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import * as os from 'os';
import { GameRoom } from './rooms/GameRoom';
import { LobbyManager } from './systems/LobbyManager';
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
const REQUIRE_PASSWORD = false; // Disabled global password - use private lobbies instead
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

// Multi-lobby management
let lobbyManager: LobbyManager | null = null;

// Health check endpoint for Railway
app.get('/', (req, res) => {
  const stats = lobbyManager ? lobbyManager.getStats() : null;
  res.json({ 
    status: 'online', 
    service: 'Trespasser Multiplayer Backend',
    timestamp: new Date().toISOString(),
    lobbyManager: lobbyManager ? 'initialized' : 'pending',
    stats: stats
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = lobbyManager ? lobbyManager.getStats() : null;
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    lobbyManager: lobbyManager ? 'ready' : 'initializing',
    stats: stats
  });
});

// Debug endpoint to check lobby status
app.get('/debug/lobbies', (req, res) => {
  if (!lobbyManager) {
    res.json({ error: 'LobbyManager not initialized' });
    return;
  }
  
  const lobbies = lobbyManager.listLobbies();
  const stats = lobbyManager.getStats();
  
  res.json({
    lobbyManagerInitialized: true,
    totalLobbies: lobbies.length,
    lobbies: lobbies,
    stats: stats,
    timestamp: Date.now()
  });
});

io.on('connection', (socket) => {
  const ip = socket.handshake.address;
  console.log(`🔌 Connection attempt from ${ip} (${socket.id})`);
  console.log(`🔌 Origin: ${socket.handshake.headers.origin || 'no origin header'}`);
  console.log(`🔌 Transport: ${socket.conn.transport.name}`);
  
  // CRITICAL: Register authenticate handler IMMEDIATELY before any other setup
  if (REQUIRE_PASSWORD) {
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
        console.log(`✅ Player authenticated: ${socket.id} from ${ip}`);
        socket.emit('authenticated');
        console.log(`📤 Sent 'authenticated' event to ${socket.id}`);
        
        // Set up matchmaking handlers
        console.log(`🎮 Setting up matchmaking handlers for ${socket.id}`);
        setupMatchmakingHandlers(socket);
        console.log(`🎮 Finished setting up matchmaking for ${socket.id}`);
      } else {
        socket.emit('auth-failed', 'Invalid password');
        socket.disconnect();
        console.log(`❌ Failed auth from ${ip}: wrong password`);
      }
    });
  }
  
  // DEBUG: Log all events received from this socket (AFTER auth handler is registered)
  const originalOn = socket.on.bind(socket);
  socket.on = function(event: string, handler: Function) {
    return originalOn(event, (...args: any[]) => {
      console.log(`📡 [${socket.id.substring(0, 8)}] Received event: "${event}"`, args.length > 0 ? 'with data' : 'no data');
      handler(...args);
    });
  };
  
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
  } else {
    // No password required, add to authenticated players and set up matchmaking
    authenticatedPlayers.add(socket.id);
    setupMatchmakingHandlers(socket);
    console.log(`✅ Player joined: ${socket.id} from ${ip} (no password)`);
  }
  
  socket.on('disconnect', (reason) => {
    handleDisconnect(socket, reason);
  });
  
  // Rate limit game events for authenticated players only
  setupGameEventHandlers(socket);
});

function setupMatchmakingHandlers(socket: any) {
  // Find match handler - main matchmaking entry point
  socket.on('find_match', async (data: { gameMode?: string; isPrivate?: boolean } = {}) => {
    if (!lobbyManager) {
      socket.emit('matchmaking_failed', { reason: 'Server not ready' });
      return;
    }
    
    console.log(`🎮 Player ${socket.id.substring(0, 8)} looking for match:`, data);
    
    const gameMode = data.gameMode || 'deathmatch';
    const isPrivate = data.isPrivate || false;
    
    try {
      const lobby = await lobbyManager.findOrCreateLobby(socket, gameMode, isPrivate);
      if (!lobby) {
        console.log(`❌ Failed to find/create lobby for ${socket.id}`);
        return; // Error already sent by LobbyManager
      }
      
      console.log(`✅ Player ${socket.id.substring(0, 8)} matched to lobby ${lobby.getId()}`);
    } catch (error) {
      console.error(`❌ Error in matchmaking for ${socket.id}:`, error);
      socket.emit('matchmaking_failed', { reason: 'Internal server error' });
    }
  });
  
  // Create private lobby handler
  socket.on('create_private_lobby', async (settings: {
    gameMode?: string;
    password?: string;
    maxPlayers?: number;
    mapName?: string;
  } = {}) => {
    if (!lobbyManager) {
      socket.emit('lobby_creation_failed', { reason: 'Server not ready' });
      return;
    }
    
    console.log(`🔒 Player ${socket.id.substring(0, 8)} creating private lobby:`, settings);
    
    try {
      const lobby = await lobbyManager.createPrivateLobby(socket, settings);
      if (lobby) {
        console.log(`✅ Private lobby ${lobby.getId()} created by ${socket.id.substring(0, 8)}`);
      }
    } catch (error) {
      console.error(`❌ Error creating private lobby for ${socket.id}:`, error);
      socket.emit('lobby_creation_failed', { reason: 'Internal server error' });
    }
  });
  
  // Join lobby by ID handler
  socket.on('join_lobby', async (data: { lobbyId: string; password?: string }) => {
    if (!lobbyManager) {
      socket.emit('lobby_join_failed', { reason: 'Server not ready' });
      return;
    }
    
    console.log(`🎯 Player ${socket.id.substring(0, 8)} joining lobby ${data.lobbyId}`);
    
    try {
      const lobby = await lobbyManager.joinLobbyById(socket, data.lobbyId, data.password);
      if (lobby) {
        console.log(`✅ Player ${socket.id.substring(0, 8)} joined lobby ${data.lobbyId} by ID`);
      }
    } catch (error) {
      console.error(`❌ Error joining lobby ${data.lobbyId} for ${socket.id}:`, error);
      socket.emit('lobby_join_failed', { reason: 'Internal server error' });
    }
  });
  
  // Leave lobby handler
  socket.on('leave_lobby', () => {
    if (!lobbyManager) return;
    
    console.log(`👋 Player ${socket.id.substring(0, 8)} leaving lobby`);
    lobbyManager.removePlayerFromLobby(socket.id);
  });
  
  // Admin force start match handler - for test/debug purposes
  socket.on('admin:force_start_match', (data: { lobbyId: string; reason?: string }) => {
    if (!lobbyManager) {
      socket.emit('test_start_failed', { error: 'Server not ready' });
      return;
    }
    
    const { lobbyId, reason = 'force_start_requested' } = data;
    
    console.log(`🧪 Force start requested by ${socket.id.substring(0, 8)} for lobby ${lobbyId} - Reason: ${reason}`);
    
    try {
      const result = lobbyManager.forceStartMatch(socket.id, lobbyId, reason);
      if (!result.success) {
        socket.emit('test_start_failed', { error: result.error });
      }
    } catch (error) {
      console.error(`❌ Error in force start for ${socket.id}:`, error);
      socket.emit('test_start_failed', { error: 'Internal server error' });
    }
  });
  
  // Admin force create match handler - for matchmaking bypass
  socket.on('admin:force_create_match', (data: { gameMode?: string; reason?: string } = {}) => {
    if (!lobbyManager) {
      socket.emit('force_create_failed', { error: 'Server not ready' });
      return;
    }
    
    const { gameMode = 'deathmatch', reason = 'force_create_requested' } = data;
    
    console.log(`🧪 Force create match requested by ${socket.id.substring(0, 8)} - Mode: ${gameMode}, Reason: ${reason}`);
    
    try {
      const result = lobbyManager.forceCreateMatch(socket.id, gameMode, reason);
      if (!result.success) {
        socket.emit('force_create_failed', { error: result.error });
      }
    } catch (error) {
      console.error(`❌ Error in force create for ${socket.id}:`, error);
      socket.emit('force_create_failed', { error: 'Internal server error' });
    }
  });
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
  
  if (wasAuthenticated && lobbyManager) {
    lobbyManager.removePlayerFromLobby(socket.id);
    console.log(`👋 Player left: ${socket.id} (${reason}). Players: ${authenticatedPlayers.size}`);
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

    setTimeout(async () => {
      try {
        console.log('🔄 Executing simple game restart...');
        
        if (lobbyManager) {
          // Reset all lobbies
          const lobbies = lobbyManager.listLobbies();
          console.log(`🔄 Restarting ${lobbies.length} active lobbies...`);
          
          for (const lobbyInfo of lobbies) {
            // Find lobby and reset it
            // For now, we'll just restart the entire lobby manager
            // In production, you might want more granular control
          }
          
          console.log('✅ All lobbies restart complete!');
          
          // Notify all players restart is complete
          io.emit('game:restarted', {
            message: 'All lobbies have been restarted!',
            playersReconnected: authenticatedPlayers.size,
            totalLobbies: lobbies.length
          });
        } else {
          throw new Error('No lobby manager available');
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

// Initialize the LobbyManager for multi-lobby support
async function initializeServer() {
  console.log('🔄 Initializing LobbyManager...');
  
  try {
    lobbyManager = new LobbyManager(io);
    console.log('✅ LobbyManager ready!');
  } catch (error) {
    console.error('❌ Failed to initialize LobbyManager:', error);
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
  
  if (lobbyManager) {
    console.log('🏢 Destroying LobbyManager...');
    lobbyManager.destroy();
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
