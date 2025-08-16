import { Socket, Server } from 'socket.io';
import { GameRoom } from '../rooms/GameRoom';
import { EVENTS, GAME_CONFIG } from '../../shared/constants';

export interface LobbyInfo {
  id: string;
  playerCount: number;
  maxPlayers: number;
  gameMode: string;
  mapName: string;
  isPrivate: boolean;
  passwordRequired: boolean;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: number;
  lastActivity: number;
}

export interface MatchEndData {
  lobbyId: string;
  winnerTeam: 'red' | 'blue';
  redKills: number;
  blueKills: number;
  duration: number;
  playerStats: Array<{
    playerId: string;
    playerName: string;
    team: 'red' | 'blue';
    kills: number;
    deaths: number;
    damageDealt: number;
  }>;
}

export class LobbyManager {
  private lobbies: Map<string, GameRoom> = new Map();
  private playerLobbyMap: Map<string, string> = new Map(); // socketId -> lobbyId
  private lobbyCleanupInterval: NodeJS.Timeout;
  private io: Server;
  private pendingStarts: Set<string> = new Set(); // Track lobbies with pending match starts
  
  // Configuration
  private readonly maxLobbiesPerNode = parseInt(process.env.MAX_LOBBIES_PER_NODE || '100');
  private readonly maxPlayersPerLobby = parseInt(process.env.MAX_PLAYERS_PER_LOBBY || '8');
  private readonly lobbyIdleTimeout = parseInt(process.env.LOBBY_IDLE_TIMEOUT || '300000'); // 5 minutes
  private readonly maxLobbyAge = parseInt(process.env.MAX_LOBBY_AGE || '3600000'); // 1 hour
  
  constructor(io: Server) {
    this.io = io;
    
    // Set up periodic cleanup of stale lobbies
    this.lobbyCleanupInterval = setInterval(() => {
      this.cleanupStaleLobbies();
    }, 60000); // Check every minute
    
    console.log(`🏢 LobbyManager initialized - Max lobbies: ${this.maxLobbiesPerNode}, Max players per lobby: ${this.maxPlayersPerLobby}`);
  }
  
  /**
   * Find or create a lobby for matchmaking
   */
  async findOrCreateLobby(socket: Socket, gameMode: string = 'deathmatch', isPrivate: boolean = false): Promise<GameRoom | null> {
    try {
      // Check if player is already in a lobby
      const existingLobbyId = this.playerLobbyMap.get(socket.id);
      if (existingLobbyId) {
        const existingLobby = this.lobbies.get(existingLobbyId);
        if (existingLobby) {
          console.log(`🔄 Player ${socket.id.substring(0, 8)} already in lobby ${existingLobbyId}`);
          return existingLobby;
        } else {
          // Clean up stale mapping
          this.playerLobbyMap.delete(socket.id);
        }
      }
      
      let targetLobby: GameRoom | null = null;
      
      if (!isPrivate) {
        // Find existing lobby with space
        for (const [lobbyId, lobby] of this.lobbies) {
          const lobbyInfo = this.getLobbyInfo(lobbyId);
          if (lobbyInfo && 
              lobbyInfo.gameMode === gameMode && 
              !lobbyInfo.isPrivate && 
              lobbyInfo.playerCount < this.maxPlayersPerLobby &&
              lobbyInfo.status === 'waiting') {
            targetLobby = lobby;
            console.log(`🎯 Found existing lobby ${lobbyId} with ${lobbyInfo.playerCount}/${this.maxPlayersPerLobby} players`);
            break;
          }
        }
      }
      
      // Create new lobby if none found
      if (!targetLobby) {
        if (this.lobbies.size >= this.maxLobbiesPerNode) {
          console.log(`❌ Cannot create lobby - max lobbies reached (${this.maxLobbiesPerNode})`);
          socket.emit('matchmaking_failed', { reason: 'Server capacity reached' });
          return null;
        }
        
        const lobbyId = this.generateLobbyId(gameMode);
        targetLobby = new GameRoom(lobbyId, this.io);
        this.lobbies.set(lobbyId, targetLobby);
        
        console.log(`🆕 Created new lobby ${lobbyId} for gameMode: ${gameMode}, isPrivate: ${isPrivate}`);
        
        // Set up lobby-specific event handlers
        this.setupLobbyEventHandlers(targetLobby);
      }
      
      // Add player to lobby
      targetLobby.addPlayer(socket);
      this.playerLobbyMap.set(socket.id, targetLobby.getId());
      
      // Wait a moment for the player to be actually added (in case room is initializing)
      // Then emit lobby joined event with correct count
      setTimeout(() => {
        const currentPlayerCount = targetLobby.getPlayerCount();
        
        // Send lobby_joined to the joining player with accurate count
        socket.emit('lobby_joined', {
          lobbyId: targetLobby.getId(),
          playerCount: currentPlayerCount,
          maxPlayers: this.maxPlayersPerLobby,
          gameMode: gameMode,
          status: 'waiting'
        });
        
        // If a match is already starting, notify the new player
        if (this.pendingStarts.has(targetLobby.getId())) {
          socket.emit('match_starting', {
            lobbyId: targetLobby.getId(),
            countdown: 3 // Approximate remaining time
          });
        }
      }, 200); // Slightly longer delay to ensure player is fully added
      
      // Update lobby activity
      const lobbyInfo = this.getLobbyInfo(targetLobby.getId());
      if (lobbyInfo) {
        lobbyInfo.lastActivity = Date.now();
        
        // Check if lobby is ready to start
        if (lobbyInfo.playerCount >= 2 && lobbyInfo.status === 'waiting') {
          // Use synchronized match start
          this.scheduleMatchStart(targetLobby.getId());
        }
      }
      
      console.log(`✅ Player ${socket.id.substring(0, 8)} joined lobby ${targetLobby.getId()}`);
      return targetLobby;
      
    } catch (error) {
      console.error(`❌ Error in findOrCreateLobby:`, error);
      socket.emit('matchmaking_failed', { reason: 'Internal server error' });
      return null;
    }
  }
  
  /**
   * Create a private lobby with custom settings
   */
  async createPrivateLobby(socket: Socket, settings: {
    gameMode?: string;
    password?: string;
    maxPlayers?: number;
    mapName?: string;
  }): Promise<GameRoom | null> {
    try {
      if (this.lobbies.size >= this.maxLobbiesPerNode) {
        socket.emit('lobby_creation_failed', { reason: 'Server capacity reached' });
        return null;
      }
      
      const gameMode = settings.gameMode || 'deathmatch';
      const lobbyId = this.generateLobbyId(gameMode, true);
      const lobby = new GameRoom(lobbyId, this.io);
      
      // Configure private lobby settings
      if (settings.password) {
        lobby.setPassword(settings.password);
      }
      if (settings.maxPlayers && settings.maxPlayers <= this.maxPlayersPerLobby) {
        lobby.setMaxPlayers(settings.maxPlayers);
      }
      
      this.lobbies.set(lobbyId, lobby);
      this.setupLobbyEventHandlers(lobby);
      
      // Add creator to lobby
      lobby.addPlayer(socket);
      this.playerLobbyMap.set(socket.id, lobbyId);
      
      console.log(`🔒 Created private lobby ${lobbyId} by ${socket.id.substring(0, 8)}`);
      
      // Emit private lobby created event
      socket.emit('private_lobby_created', {
        lobbyId: lobbyId,
        inviteCode: lobbyId, // Could be a separate invite code system
        maxPlayers: settings.maxPlayers || this.maxPlayersPerLobby
      });
      
      // CRITICAL: Also emit lobby_joined so frontend transitions to waiting room
      // Wait a moment for addPlayer to complete, then emit with correct count
      setTimeout(() => {
        socket.emit('lobby_joined', {
          lobbyId: lobbyId,
          playerCount: lobby.getPlayerCount(),
          maxPlayers: lobby.getMaxPlayers(),
          gameMode: gameMode,
          isPrivate: true
        });
      }, 50);
      
      return lobby;
      
    } catch (error) {
      console.error(`❌ Error creating private lobby:`, error);
      socket.emit('lobby_creation_failed', { reason: 'Internal server error' });
      return null;
    }
  }
  
  /**
   * Join a specific lobby by ID (for private lobbies)
   */
  async joinLobbyById(socket: Socket, lobbyId: string, password?: string): Promise<GameRoom | null> {
    try {
      const lobby = this.lobbies.get(lobbyId);
      if (!lobby) {
        socket.emit('lobby_join_failed', { reason: 'Lobby not found' });
        return null;
      }
      
      // Check password if required
      if (lobby.hasPassword() && !lobby.verifyPassword(password || '')) {
        socket.emit('lobby_join_failed', { reason: 'Invalid password' });
        return null;
      }
      
      // Check capacity
      if (lobby.getPlayerCount() >= lobby.getMaxPlayers()) {
        socket.emit('lobby_join_failed', { reason: 'Lobby is full' });
        return null;
      }
      
      // Add player to lobby
      lobby.addPlayer(socket);
      this.playerLobbyMap.set(socket.id, lobbyId);
      
      // Wait a moment for the player to be actually added (in case room is initializing)
      setTimeout(() => {
        const currentPlayerCount = lobby.getPlayerCount();
        
        // Send lobby_joined to the joining player with accurate count
        socket.emit('lobby_joined', {
          lobbyId: lobbyId,
          playerCount: currentPlayerCount,
          maxPlayers: lobby.getMaxPlayers(),
          status: lobby.getStatus(),  // FIX: Use actual status instead of hardcoded 'waiting'
          gameMode: lobby.getGameMode(),
          isInProgress: lobby.getStatus() === 'playing'
        });
        
        // If a match is already starting, notify the new player
        if (this.pendingStarts.has(lobbyId)) {
          socket.emit('match_starting', {
            lobbyId: lobbyId,
            countdown: 3 // Approximate remaining time
          });
        }
      }, 200); // Slightly longer delay to ensure player is fully added
      
      console.log(`✅ Player ${socket.id.substring(0, 8)} joined lobby ${lobbyId} by ID`);
      return lobby;
      
    } catch (error) {
      console.error(`❌ Error joining lobby by ID:`, error);
      socket.emit('lobby_join_failed', { reason: 'Internal server error' });
      return null;
    }
  }
  
  /**
   * Remove player from their current lobby
   */
  removePlayerFromLobby(socketId: string): void {
    const lobbyId = this.playerLobbyMap.get(socketId);
    if (!lobbyId) return;
    
    const lobby = this.lobbies.get(lobbyId);
    if (lobby) {
      lobby.removePlayer(socketId);
      console.log(`👋 Player ${socketId.substring(0, 8)} removed from lobby ${lobbyId}`);
      
      // Check if lobby should be destroyed
      if (lobby.getPlayerCount() === 0) {
        this.destroyLobby(lobbyId);
      }
    }
    
    this.playerLobbyMap.delete(socketId);
  }
  
  /**
   * Get lobby information
   */
  getLobbyInfo(lobbyId: string): LobbyInfo | null {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return null;
    
    // Get fresh player count from lobby
    const currentPlayerCount = lobby.getPlayerCount();
    
    return {
      id: lobbyId,
      playerCount: currentPlayerCount,
      maxPlayers: lobby.getMaxPlayers(),
      gameMode: lobby.getGameMode(),
      mapName: lobby.getMapName(),
      isPrivate: lobby.isPrivate(),
      passwordRequired: lobby.hasPassword(),
      status: lobby.getStatus(),
      createdAt: lobby.getCreatedAt(),
      lastActivity: lobby.getLastActivity()
    };
  }
  
  /**
   * List all active lobbies (for debug/admin purposes)
   */
  listLobbies(): LobbyInfo[] {
    const lobbies: LobbyInfo[] = [];
    for (const [lobbyId] of this.lobbies) {
      const info = this.getLobbyInfo(lobbyId);
      if (info) {
        lobbies.push(info);
      }
    }
    return lobbies;
  }
  
  /**
   * Get joinable lobbies based on filters for server browser
   */
  getJoinableLobbies(filters?: {
    showPrivate?: boolean;
    showFull?: boolean;
    showInProgress?: boolean;
    gameMode?: string;
  }): LobbyInfo[] {
    const joinableLobbies: LobbyInfo[] = [];
    
    for (const [lobbyId, lobby] of this.lobbies) {
      const info = this.getLobbyInfo(lobbyId);
      if (!info) continue;
      
      // Apply filters if provided
      if (filters) {
        // Skip private lobbies unless explicitly requested
        if (!filters.showPrivate && info.isPrivate) continue;
        
        // Skip full lobbies unless explicitly requested
        if (!filters.showFull && info.playerCount >= info.maxPlayers) continue;
        
        // Skip in-progress games unless explicitly requested
        if (!filters.showInProgress && info.status === 'playing') continue;
        
        // Filter by game mode if specified
        if (filters.gameMode && info.gameMode !== filters.gameMode) continue;
      } else {
        // Default filters: show only public, not-full, not-finished lobbies
        if (info.isPrivate) continue;
        if (info.playerCount >= info.maxPlayers) continue;
        if (info.status === 'finished') continue;
      }
      
      joinableLobbies.push(info);
    }
    
    // Sort by: waiting games first, then by player count (fuller lobbies first for better matchmaking)
    return joinableLobbies.sort((a, b) => {
      // Prioritize waiting lobbies
      if (a.status === 'waiting' && b.status !== 'waiting') return -1;
      if (b.status === 'waiting' && a.status !== 'waiting') return 1;
      
      // Then sort by player count (higher is better for quick matches)
      return b.playerCount - a.playerCount;
    });
  }
  
  /**
   * Get current lobby statistics
   */
  getStats(): {
    totalLobbies: number;
    totalPlayers: number;
    averagePlayersPerLobby: number;
    lobbiesByStatus: Record<string, number>;
  } {
    const stats = {
      totalLobbies: this.lobbies.size,
      totalPlayers: 0,
      averagePlayersPerLobby: 0,
      lobbiesByStatus: { waiting: 0, playing: 0, finished: 0 }
    };
    
    for (const [lobbyId] of this.lobbies) {
      const info = this.getLobbyInfo(lobbyId);
      if (info) {
        stats.totalPlayers += info.playerCount;
        stats.lobbiesByStatus[info.status]++;
      }
    }
    
    stats.averagePlayersPerLobby = stats.totalLobbies > 0 ? stats.totalPlayers / stats.totalLobbies : 0;
    
    return stats;
  }
  
  /**
   * Start a match in a lobby
   */
  private startMatch(lobbyId: string): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    
    const info = this.getLobbyInfo(lobbyId);
    if (!info || info.status !== 'waiting') return;
    
    console.log(`🎮 Starting match in lobby ${lobbyId} with ${info.playerCount} players`);
    
    // Update lobby status
    lobby.setStatus('playing');
    
    // NOTE: Don't broadcast match_starting here - that's done by scheduleMatchStart
    // Just start the game logic
    lobby.startMatch();
    
    // Broadcast that match has actually started (frontend expects minimal data)
    lobby.broadcastToLobby('match_started', {
      lobbyId: lobbyId,
      killTarget: 50  // Or get from config
    });
  }
  
  /**
   * Schedule a synchronized match start with countdown
   */
  private scheduleMatchStart(lobbyId: string): void {
    if (this.pendingStarts.has(lobbyId)) return;
    
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    
    const info = this.getLobbyInfo(lobbyId);
    if (!info || info.status !== 'waiting') return;
    
    this.pendingStarts.add(lobbyId);
    const countdown = 5;
    
    console.log(`⏱️ Scheduling match start for lobby ${lobbyId} in ${countdown} seconds`);
    
    // Broadcast countdown start to all players (frontend expects minimal data)
    lobby.broadcastToLobby('match_starting', {
      lobbyId,
      countdown
    });
    
    // Schedule the actual start
    setTimeout(() => {
      this.pendingStarts.delete(lobbyId);
      
      // Verify conditions still met
      const currentInfo = this.getLobbyInfo(lobbyId);
      if (currentInfo && currentInfo.playerCount >= 2 && currentInfo.status === 'waiting') {
        this.startMatch(lobbyId);
      } else {
        console.log(`❌ Match start cancelled for lobby ${lobbyId} - conditions no longer met`);
        lobby.broadcastToLobby('match_start_cancelled', {
          lobbyId,
          reason: 'Not enough players'
        });
      }
    }, countdown * 1000);
  }
  
  /**
   * Cancel a pending match start
   */
  private cancelPendingStart(lobbyId: string): void {
    if (!this.pendingStarts.has(lobbyId)) return;
    
    this.pendingStarts.delete(lobbyId);
    
    const lobby = this.lobbies.get(lobbyId);
    if (lobby) {
      console.log(`❌ Cancelling pending match start for lobby ${lobbyId}`);
      lobby.broadcastToLobby('match_start_cancelled', {
        lobbyId,
        reason: 'Not enough players'
      });
    }
  }
  
  /**
   * Force start a match bypassing player count requirements (for testing/admin)
   */
  public forceStartMatch(socketId: string, lobbyId: string, reason: string): { success: boolean; error?: string } {
    // Find the lobby
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) {
      return { success: false, error: 'Lobby not found' };
    }
    
    // Verify the requesting player is actually in this lobby (security check)
    const playerLobby = this.playerLobbyMap.get(socketId);
    if (playerLobby !== lobbyId) {
      return { success: false, error: 'Not in this lobby' };
    }
    
    const info = this.getLobbyInfo(lobbyId);
    if (!info) {
      return { success: false, error: 'Lobby info not found' };
    }
    
    // Check if lobby is in correct state to force start
    if (info.status !== 'waiting') {
      return { success: false, error: `Cannot force start - lobby status is '${info.status}'` };
    }
    
    // Ensure there's at least one player
    if (info.playerCount === 0) {
      return { success: false, error: 'Cannot start empty lobby' };
    }
    
    // Additional check: verify the requesting player is actually counted
    const actualPlayerCount = lobby.getPlayerCount();
    console.log(`🧪 Force start validation - Info count: ${info.playerCount}, Actual count: ${actualPlayerCount}`);
    
    if (actualPlayerCount === 0) {
      return { success: false, error: 'Lobby has no active players' };
    }
    
    console.log(`🧪 Force starting match in lobby ${lobbyId} with ${info.playerCount} players - Reason: ${reason}`);
    
    // Cancel any pending start first
    this.cancelPendingStart(lobbyId);
    
    // Schedule immediate start with short countdown
    this.pendingStarts.add(lobbyId);
    const countdown = 3; // Shorter countdown for force start
    
    // Notify players that match is force starting (frontend expects minimal data)
    lobby.broadcastToLobby('match_starting', {
      lobbyId: lobbyId,
      countdown
    });
    
    // Schedule the actual start
    setTimeout(() => {
      this.pendingStarts.delete(lobbyId);
      
      // Use the centralized startMatch method which handles status and broadcasts
      this.startMatch(lobbyId);
    }, countdown * 1000);
    
    return { success: true };
  }
  
  /**
   * Force create a new match and start it immediately (for testing/admin)
   * This bypasses normal matchmaking and creates a new lobby that starts right away
   */
  public forceCreateMatch(socketId: string, gameMode: string, reason: string): { success: boolean; error?: string; lobbyId?: string } {
    try {
      // Check server capacity
      if (this.lobbies.size >= this.maxLobbiesPerNode) {
        return { success: false, error: 'Server capacity reached' };
      }
      
      console.log(`🧪 Force creating and starting match for ${socketId.substring(0, 8)} - Mode: ${gameMode}, Reason: ${reason}`);
      
      // Create new lobby
      const lobbyId = this.generateLobbyId(gameMode);
      const lobby = new GameRoom(lobbyId, this.io);
      this.lobbies.set(lobbyId, lobby);
      
      // Set up lobby event handlers
      this.setupLobbyEventHandlers(lobby);
      
      // Add the requesting player to the lobby
      const socket = this.findSocketById(socketId);
      if (!socket) {
        // Clean up the lobby we just created
        this.destroyLobby(lobbyId);
        return { success: false, error: 'Player socket not found' };
      }
      
      lobby.addPlayer(socket);
      this.playerLobbyMap.set(socketId, lobbyId);
      
      console.log(`🧪 Force created lobby ${lobbyId} with player ${socketId.substring(0, 8)}`);
      
      // Emit lobby joined event
      socket.emit('lobby_joined', {
        lobbyId: lobbyId,
        playerCount: 1,
        maxPlayers: this.maxPlayersPerLobby,
        gameMode: gameMode,
        forceCreated: true,
        reason: reason
      });
      
      // Wait a moment for GameRoom to initialize, then start the match with countdown
      setTimeout(() => {
        if (lobby.isInitialized()) {
          console.log(`🧪 Starting force created match in lobby ${lobbyId}`);
          
          // Schedule immediate start with short countdown
          this.pendingStarts.add(lobbyId);
          const countdown = 3; // Short countdown for force created match
          
          // Notify that match is force starting (frontend expects minimal data)
          lobby.broadcastToLobby('match_starting', {
            lobbyId: lobbyId,
            countdown
          });
          
          // Schedule the actual start
          setTimeout(() => {
            this.pendingStarts.delete(lobbyId);
            
            // Use the centralized startMatch method
            this.startMatch(lobbyId);
          }, countdown * 1000);
        } else {
          console.warn(`⚠️ GameRoom ${lobbyId} not yet initialized, retrying...`);
          // Retry after another delay
          setTimeout(() => {
            if (lobby.isInitialized()) {
              this.pendingStarts.add(lobbyId);
              const countdown = 3;
              
              lobby.broadcastToLobby('match_starting', {
                lobbyId: lobbyId,
                countdown
              });
              
              setTimeout(() => {
                this.pendingStarts.delete(lobbyId);
                this.startMatch(lobbyId);
              }, countdown * 1000);
            } else {
              console.error(`❌ GameRoom ${lobbyId} failed to initialize for force create`);
            }
          }, 1000);
        }
      }, 500);
      
      return { success: true, lobbyId: lobbyId };
      
    } catch (error) {
      console.error(`❌ Error in forceCreateMatch:`, error);
      return { success: false, error: 'Internal server error' };
    }
  }
  
  /**
   * Find a socket by ID (helper method for force create)
   */
  private findSocketById(socketId: string): any {
    // Get all connected sockets from the IO instance
    const sockets = this.io.sockets.sockets;
    return sockets.get(socketId);
  }
  
  /**
   * Handle match end
   */
  private handleMatchEnd(lobbyId: string, matchData: MatchEndData): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    
    console.log(`🏁 Match ended in lobby ${lobbyId} - Winner: ${matchData.winnerTeam}`);
    
    // Update lobby status
    lobby.setStatus('finished');
    
    // Broadcast match results
    lobby.broadcastToLobby('match_ended', matchData);
    
    // Schedule lobby restart or destruction
    setTimeout(() => {
      if (lobby.getPlayerCount() > 0) {
        // Restart lobby for new match
        lobby.resetForNewMatch();
        lobby.setStatus('waiting');
        console.log(`🔄 Lobby ${lobbyId} reset for new match`);
      } else {
        // Destroy empty lobby
        this.destroyLobby(lobbyId);
      }
    }, 10000); // 10 second delay to show results
  }
  
  /**
   * Generate unique lobby ID
   */
  private generateLobbyId(gameMode: string, isPrivate: boolean = false): string {
    const prefix = isPrivate ? 'private' : gameMode;
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${timestamp}_${random}`;
  }
  
  /**
   * Set up event handlers for a lobby
   */
  private setupLobbyEventHandlers(lobby: GameRoom): void {
    // Listen for match end events
    lobby.onMatchEnd((matchData: MatchEndData) => {
      this.handleMatchEnd(lobby.getId(), matchData);
    });
    
    // Listen for player count changes
    lobby.onPlayerCountChange((count: number) => {
      const info = this.getLobbyInfo(lobby.getId());
      if (info) {
        info.lastActivity = Date.now();
        
        // CRITICAL FIX: Broadcast lobby state to all players on count change
        lobby.broadcastLobbyState();
        
        // Auto-start if conditions met
        if (count >= 2 && info.status === 'waiting' && !this.pendingStarts.has(lobby.getId())) {
          this.scheduleMatchStart(lobby.getId());
        } else if (count < 2 && this.pendingStarts.has(lobby.getId())) {
          // Cancel pending start if player count drops below minimum
          this.cancelPendingStart(lobby.getId());
        }
      }
    });
  }
  
  /**
   * Destroy a lobby and clean up resources
   */
  private destroyLobby(lobbyId: string): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    
    console.log(`🧹 Destroying lobby ${lobbyId}`);
    
    // Remove all players from the lobby mapping
    for (const [socketId, mappedLobbyId] of this.playerLobbyMap) {
      if (mappedLobbyId === lobbyId) {
        this.playerLobbyMap.delete(socketId);
      }
    }
    
    // Destroy the lobby
    lobby.destroy();
    this.lobbies.delete(lobbyId);
  }
  
  /**
   * Clean up stale lobbies
   */
  private cleanupStaleLobbies(): void {
    const now = Date.now();
    const lobbiesDestroyed: string[] = [];
    
    for (const [lobbyId, lobby] of this.lobbies) {
      const info = this.getLobbyInfo(lobbyId);
      if (!info) continue;
      
      const isIdle = (now - info.lastActivity) > this.lobbyIdleTimeout;
      const isTooOld = (now - info.createdAt) > this.maxLobbyAge;
      const isEmpty = info.playerCount === 0;
      
      if (isEmpty && isIdle) {
        lobbiesDestroyed.push(lobbyId);
        this.destroyLobby(lobbyId);
      } else if (isTooOld && info.status === 'finished') {
        lobbiesDestroyed.push(lobbyId);
        this.destroyLobby(lobbyId);
      }
    }
    
    if (lobbiesDestroyed.length > 0) {
      console.log(`🧹 Cleaned up ${lobbiesDestroyed.length} stale lobbies: ${lobbiesDestroyed.join(', ')}`);
    }
  }
  
  /**
   * Destroy the lobby manager and clean up resources
   */
  destroy(): void {
    console.log('🧹 Destroying LobbyManager...');
    
    // Clear cleanup interval
    if (this.lobbyCleanupInterval) {
      clearInterval(this.lobbyCleanupInterval);
    }
    
    // Destroy all lobbies
    for (const [lobbyId] of this.lobbies) {
      this.destroyLobby(lobbyId);
    }
    
    // Clear maps
    this.lobbies.clear();
    this.playerLobbyMap.clear();
    
    console.log('✅ LobbyManager destroyed');
  }
}
