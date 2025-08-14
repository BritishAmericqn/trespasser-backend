# Backend Scaling Implementation Guide
# Your Responsibilities for 10k+ CCU Production Launch

## Overview
This document outlines the backend-specific implementation tasks for scaling Trespasser to support 10,000+ concurrent players across 2,500+ lobbies. As the backend developer, you own the entire server-side architecture, infrastructure, and game logic systems.

## Your Core Responsibilities

### Phase 1: Foundation Systems (Week 1-2)

#### 1.1 Multi-Lobby Server Architecture
**Extend your current `GameRoom.ts` to support multiple concurrent lobbies**

```typescript
// Extend your current server.js
class LobbyManager {
  private lobbies: Map<string, GameRoom> = new Map();
  private maxLobbiesPerNode: number = 100;
  
  async createLobby(gameMode: GameMode): Promise<GameRoom> {
    if (this.lobbies.size >= this.maxLobbiesPerNode) {
      throw new Error('Server at capacity');
    }
    
    const lobbyId = this.generateLobbyId();
    const lobby = new GameRoom(lobbyId, this.io);
    
    // Set up lobby lifecycle handlers
    lobby.onEmpty(() => this.destroyLobby(lobbyId));
    lobby.onMatchEnd((results) => this.handleMatchEnd(lobbyId, results));
    
    this.lobbies.set(lobbyId, lobby);
    return lobby;
  }
  
  private generateLobbyId(): string {
    return `lobby_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async destroyLobby(lobbyId: string): Promise<void> {
    const lobby = this.lobbies.get(lobbyId);
    if (lobby) {
      lobby.destroy();
      this.lobbies.delete(lobbyId);
      console.log(`🗑️ Destroyed empty lobby: ${lobbyId}`);
    }
  }
}
```

#### 1.2 Authentication & Session Management
**Build JWT-based authentication system**

```typescript
// New file: src/auth/AuthService.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export class AuthService {
  private jwtSecret: string = process.env.JWT_SECRET!;
  private sessionStore: Map<string, PlayerSession> = new Map();
  
  async authenticate(email: string, password: string): Promise<AuthResult> {
    // 1. Validate credentials against database
    const player = await this.validateCredentials(email, password);
    if (!player) {
      throw new Error('Invalid credentials');
    }
    
    // 2. Generate JWT token
    const token = jwt.sign({
      playerId: player.id,
      displayName: player.displayName,
      region: this.determineRegion(player),
      permissions: player.permissions
    }, this.jwtSecret, { expiresIn: '24h' });
    
    // 3. Create session
    const session = this.createPlayerSession(player.id);
    
    return {
      token,
      refreshToken: session.refreshToken,
      player: {
        id: player.id,
        displayName: player.displayName,
        stats: player.stats
      }
    };
  }
  
  validateToken(token: string): PlayerProfile | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      const session = this.sessionStore.get(decoded.playerId);
      
      if (!session || session.expiresAt < Date.now()) {
        return null;
      }
      
      return {
        playerId: decoded.playerId,
        displayName: decoded.displayName,
        region: decoded.region,
        permissions: decoded.permissions
      };
    } catch (error) {
      return null;
    }
  }
  
  private async validateCredentials(email: string, password: string): Promise<Player | null> {
    // Database query to validate email/password
    const player = await this.database.findPlayerByEmail(email);
    if (!player) return null;
    
    const isValid = await bcrypt.compare(password, player.passwordHash);
    return isValid ? player : null;
  }
}
```

#### 1.3 Victory Conditions & Match End Flow
**Extend your `GameStateSystem.ts` with match completion logic**

```typescript
// Add to your existing GameStateSystem.ts
export class GameStateSystem {
  private matchState: MatchState = {
    isActive: true,
    startTime: Date.now(),
    killLimit: 50,
    redKills: 0,
    blueKills: 0
  };
  
  // Call this after every kill
  private checkVictoryCondition(): VictoryResult | null {
    if (this.matchState.redKills >= this.matchState.killLimit) {
      return {
        winner: 'red',
        finalScores: { red: this.matchState.redKills, blue: this.matchState.blueKills },
        duration: Date.now() - this.matchState.startTime,
        reason: 'score_limit'
      };
    }
    
    if (this.matchState.blueKills >= this.matchState.killLimit) {
      return {
        winner: 'blue',
        finalScores: { red: this.matchState.redKills, blue: this.matchState.blueKills },
        duration: Date.now() - this.matchState.startTime,
        reason: 'score_limit'
      };
    }
    
    return null;
  }
  
  // Handle player kill and check for victory
  handlePlayerKill(killerId: string, victimId: string): void {
    const killer = this.players.get(killerId);
    const victim = this.players.get(victimId);
    
    if (!killer || !victim) return;
    
    // Increment team kill count
    if (killer.team === 'red') {
      this.matchState.redKills++;
    } else {
      this.matchState.blueKills++;
    }
    
    // Check for victory
    const victory = this.checkVictoryCondition();
    if (victory) {
      this.endMatch(victory);
    }
  }
  
  private async endMatch(results: VictoryResult): Promise<void> {
    this.matchState.isActive = false;
    
    // Calculate final player stats
    const playerStats = this.calculateFinalStats();
    
    // Broadcast scoreboard to all players
    this.broadcastScoreboard(results, playerStats);
    
    // Wait 15 seconds for players to see results
    setTimeout(() => {
      this.handlePostMatchVoting();
    }, 15000);
  }
  
  private broadcastScoreboard(results: VictoryResult, stats: PlayerMatchStats[]): void {
    const scoreboardData = {
      type: 'match_end',
      results,
      playerStats: stats,
      displayTime: 15000
    };
    
    // Broadcast to all players in the lobby
    this.io.to(this.roomId).emit('scoreboard', scoreboardData);
  }
  
  private calculateFinalStats(): PlayerMatchStats[] {
    return Array.from(this.players.values()).map(player => ({
      playerId: player.id,
      displayName: player.displayName,
      team: player.team,
      kills: player.kills,
      deaths: player.deaths,
      score: player.kills * 100 - player.deaths * 50
    }));
  }
}
```

### Phase 2: Database & Infrastructure (Week 2-3)

#### 2.1 Database Schema Setup
**Create the production database structure**

```sql
-- Core player authentication and profiles
CREATE TABLE players (
    player_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    total_kills INTEGER DEFAULT 0,
    total_deaths INTEGER DEFAULT 0,
    total_matches INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0
);

-- Lobby tracking and management
CREATE TABLE lobbies (
    lobby_id VARCHAR(255) PRIMARY KEY,
    server_node_id VARCHAR(255) NOT NULL,
    game_mode VARCHAR(50) NOT NULL,
    state VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    kill_limit INTEGER DEFAULT 50,
    max_players INTEGER DEFAULT 8
);

-- Player participation in lobbies
CREATE TABLE lobby_players (
    lobby_id VARCHAR(255) REFERENCES lobbies(lobby_id),
    player_id UUID REFERENCES players(player_id),
    team VARCHAR(10) NOT NULL,
    joined_at TIMESTAMP DEFAULT NOW(),
    left_at TIMESTAMP,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    PRIMARY KEY (lobby_id, player_id)
);

-- Match results for statistics
CREATE TABLE match_results (
    match_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lobby_id VARCHAR(255) REFERENCES lobbies(lobby_id),
    winning_team VARCHAR(10),
    red_score INTEGER DEFAULT 0,
    blue_score INTEGER DEFAULT 0,
    duration_seconds INTEGER,
    completed_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_players_email ON players(email);
CREATE INDEX idx_lobbies_state ON lobbies(state);
CREATE INDEX idx_lobbies_server_node ON lobbies(server_node_id);
CREATE INDEX idx_lobby_players_lobby ON lobby_players(lobby_id);
CREATE INDEX idx_match_results_completed ON match_results(completed_at);
```

#### 2.2 Redis Configuration
**Set up Redis for sessions and matchmaking queues**

```typescript
// New file: src/redis/RedisService.ts
import Redis from 'ioredis';

export class RedisService {
  private redis: Redis;
  private pubClient: Redis;
  private subClient: Redis;
  
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.pubClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.subClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  
  // Session management
  async setPlayerSession(playerId: string, session: PlayerSession): Promise<void> {
    await this.redis.setex(
      `session:${playerId}`, 
      86400, // 24 hours
      JSON.stringify(session)
    );
  }
  
  async getPlayerSession(playerId: string): Promise<PlayerSession | null> {
    const data = await this.redis.get(`session:${playerId}`);
    return data ? JSON.parse(data) : null;
  }
  
  // Matchmaking queues
  async addToMatchmakingQueue(playerId: string, preferences: MatchmakingPreferences): Promise<void> {
    const queueKey = `queue:${preferences.gameMode}:${preferences.region}`;
    await this.redis.zadd(queueKey, Date.now(), JSON.stringify({
      playerId,
      preferences,
      queueTime: Date.now()
    }));
  }
  
  async getNextPlayersFromQueue(gameMode: string, region: string, count: number): Promise<QueuedPlayer[]> {
    const queueKey = `queue:${gameMode}:${region}`;
    const players = await this.redis.zrange(queueKey, 0, count - 1);
    
    if (players.length > 0) {
      await this.redis.zrem(queueKey, ...players);
    }
    
    return players.map(p => JSON.parse(p));
  }
  
  // Server node coordination
  async registerServerNode(nodeId: string, nodeInfo: ServerNodeInfo): Promise<void> {
    await this.redis.hset('server_nodes', nodeId, JSON.stringify({
      ...nodeInfo,
      lastHeartbeat: Date.now()
    }));
  }
  
  async getAvailableServerNodes(): Promise<ServerNodeInfo[]> {
    const nodes = await this.redis.hgetall('server_nodes');
    const now = Date.now();
    
    return Object.values(nodes)
      .map(data => JSON.parse(data))
      .filter(node => now - node.lastHeartbeat < 30000); // 30 seconds timeout
  }
}
```

### Phase 3: Production Deployment (Week 3-4)

#### 3.1 Docker Configuration
**Containerize your application**

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY shared/ ./shared/
COPY maps/ ./maps/

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the server
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml for development
version: '3.8'
services:
  trespasser-backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/trespasser
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=your-secret-key
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=trespasser
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    
volumes:
  postgres_data:
```

#### 3.2 Load Balancer Configuration
**NGINX configuration for multiple server nodes**

```nginx
# nginx.conf
upstream trespasser_backend {
    # Use IP hash for sticky sessions
    ip_hash;
    
    server trespasser-node-1:3000 max_fails=3 fail_timeout=30s;
    server trespasser-node-2:3000 max_fails=3 fail_timeout=30s;
    server trespasser-node-3:3000 max_fails=3 fail_timeout=30s;
    
    # Add more nodes as needed
}

server {
    listen 80;
    server_name api.trespasser.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.trespasser.com;
    
    # SSL configuration
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # WebSocket support
    location /socket.io/ {
        proxy_pass http://trespasser_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout settings for long-lived connections
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
    
    # Regular HTTP API endpoints
    location /api/ {
        proxy_pass http://trespasser_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://trespasser_backend;
        access_log off;
    }
}
```

### Phase 4: Monitoring & Operations (Week 4)

#### 4.1 Health Monitoring System
**Add comprehensive health checks to your server**

```typescript
// Add to your main server file
class HealthMonitor {
  private startTime: number = Date.now();
  private activeConnections: number = 0;
  private totalRequests: number = 0;
  private errorCount: number = 0;
  
  // Health check endpoint
  setupHealthEndpoints(app: Express): void {
    app.get('/health', (req, res) => {
      const health = this.getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    });
    
    app.get('/metrics', (req, res) => {
      res.json(this.getMetrics());
    });
  }
  
  private getHealthStatus(): HealthStatus {
    const memoryUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;
    
    const checks = {
      memory: memoryUsage.heapUsed < 1024 * 1024 * 1024, // < 1GB
      uptime: uptime > 0,
      database: this.isDatabaseHealthy(),
      redis: this.isRedisHealthy(),
      errorRate: this.errorCount / this.totalRequests < 0.05 // < 5% error rate
    };
    
    const isHealthy = Object.values(checks).every(check => check);
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: Date.now(),
      uptime,
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        usage: memoryUsage.heapUsed / memoryUsage.heapTotal
      },
      connections: this.activeConnections,
      lobbies: this.lobbyManager.getActiveLobbyCount(),
      checks
    };
  }
  
  private getMetrics(): Metrics {
    return {
      requests_total: this.totalRequests,
      errors_total: this.errorCount,
      active_connections: this.activeConnections,
      active_lobbies: this.lobbyManager.getActiveLobbyCount(),
      active_players: this.lobbyManager.getTotalPlayerCount(),
      uptime_seconds: (Date.now() - this.startTime) / 1000,
      memory_usage_bytes: process.memoryUsage().heapUsed
    };
  }
}
```

#### 4.2 Logging & Error Tracking
**Implement structured logging**

```typescript
// New file: src/logging/Logger.ts
import winston from 'winston';

export class Logger {
  private logger: winston.Logger;
  
  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'trespasser-backend' },
      transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }
  
  // Game-specific logging methods
  logPlayerJoin(playerId: string, lobbyId: string): void {
    this.logger.info('Player joined lobby', {
      event: 'player_join',
      playerId,
      lobbyId,
      timestamp: Date.now()
    });
  }
  
  logMatchEnd(lobbyId: string, results: MatchResults): void {
    this.logger.info('Match completed', {
      event: 'match_end',
      lobbyId,
      winner: results.winningTeam,
      duration: results.duration,
      scores: results.finalScores
    });
  }
  
  logError(error: Error, context?: any): void {
    this.logger.error('Application error', {
      message: error.message,
      stack: error.stack,
      context
    });
  }
}
```

### Phase 5: Security & Anti-Cheat (Week 5)

#### 5.1 Input Validation & Rate Limiting
**Secure your endpoints against abuse**

```typescript
// New file: src/security/SecurityMiddleware.ts
import rateLimit from 'express-rate-limit';

export class SecurityMiddleware {
  
  // Rate limiting for authentication
  static authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false
  });
  
  // Rate limiting for general API
  static apiRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many requests, please try again later'
  });
  
  // Input validation for player actions
  static validatePlayerInput(input: any): boolean {
    // Validate input structure
    if (!input || typeof input !== 'object') return false;
    
    // Validate sequence numbers (prevent replay attacks)
    if (typeof input.sequence !== 'number' || input.sequence < 0) return false;
    
    // Validate timestamps (prevent old/future inputs)
    const now = Date.now();
    if (Math.abs(now - input.timestamp) > 5000) return false; // 5 second tolerance
    
    // Validate mouse position bounds
    if (input.mouse) {
      const { x, y } = input.mouse;
      if (x < 0 || x > 480 || y < 0 || y > 270) return false;
    }
    
    return true;
  }
  
  // Anti-cheat: Detect impossible actions
  static detectSuspiciousActivity(playerId: string, action: PlayerAction): boolean {
    const player = this.getPlayerState(playerId);
    if (!player) return true; // Suspicious if player doesn't exist
    
    switch (action.type) {
      case 'move':
        // Check if movement speed is possible
        const distance = this.calculateDistance(player.lastPosition, action.position);
        const timeDelta = action.timestamp - player.lastActionTime;
        const maxSpeed = 150; // pixels per second (running speed)
        const maxDistance = (maxSpeed * timeDelta) / 1000;
        
        if (distance > maxDistance * 1.1) { // 10% tolerance
          this.reportSuspiciousActivity(playerId, 'impossible_movement_speed', {
            distance,
            timeDelta,
            maxExpected: maxDistance
          });
          return true;
        }
        break;
        
      case 'shoot':
        // Check fire rate limits
        const weapon = player.currentWeapon;
        const minTimeBetweenShots = 60000 / weapon.fireRate; // Convert RPM to ms
        
        if (action.timestamp - player.lastShotTime < minTimeBetweenShots * 0.9) {
          this.reportSuspiciousActivity(playerId, 'excessive_fire_rate', {
            actualInterval: action.timestamp - player.lastShotTime,
            minExpected: minTimeBetweenShots
          });
          return true;
        }
        break;
    }
    
    return false;
  }
}
```

## Critical Launch Requirements (Your Responsibility)

### 1. Content Moderation System
```typescript
// New file: src/moderation/ModerationService.ts
export class ModerationService {
  private bannedWords: Set<string>;
  private playerReports: Map<string, PlayerReport[]> = new Map();
  
  async filterChatMessage(message: string): Promise<string> {
    // Basic profanity filter
    let filtered = message;
    for (const word of this.bannedWords) {
      const regex = new RegExp(word, 'gi');
      filtered = filtered.replace(regex, '*'.repeat(word.length));
    }
    return filtered;
  }
  
  async reportPlayer(reporterId: string, targetId: string, reason: string): Promise<void> {
    const report: PlayerReport = {
      reporterId,
      targetId,
      reason,
      timestamp: Date.now()
    };
    
    const existingReports = this.playerReports.get(targetId) || [];
    existingReports.push(report);
    this.playerReports.set(targetId, existingReports);
    
    // Auto-ban if player gets 5 reports in 24 hours
    const recentReports = existingReports.filter(
      r => Date.now() - r.timestamp < 24 * 60 * 60 * 1000
    );
    
    if (recentReports.length >= 5) {
      await this.temporaryBan(targetId, 24 * 60 * 60 * 1000); // 24 hour ban
    }
  }
}
```

### 2. Admin Tools & Dashboard
```typescript
// New file: src/admin/AdminService.ts
export class AdminService {
  async banPlayer(adminId: string, targetId: string, duration: number, reason: string): Promise<void> {
    // Verify admin permissions
    if (!await this.isAdmin(adminId)) {
      throw new Error('Insufficient permissions');
    }
    
    // Apply ban
    await this.database.createBan({
      targetId,
      adminId,
      expiresAt: Date.now() + duration,
      reason
    });
    
    // Kick player from current lobby
    await this.kickPlayerFromCurrentLobby(targetId);
    
    this.logger.logAdminAction('player_banned', { adminId, targetId, duration, reason });
  }
  
  async getPlayerStats(playerId: string): Promise<PlayerStats> {
    return {
      totalKills: await this.database.getTotalKills(playerId),
      totalDeaths: await this.database.getTotalDeaths(playerId),
      winRate: await this.database.getWinRate(playerId),
      recentActivity: await this.database.getRecentMatches(playerId, 10),
      reports: await this.database.getPlayerReports(playerId)
    };
  }
}
```

## Implementation Timeline & Priorities

### Week 1: Core Foundation
- [ ] Multi-lobby support (extend GameRoom.ts)
- [ ] JWT authentication system
- [ ] Basic database schema setup
- [ ] Victory conditions implementation

### Week 2: Database & Sessions
- [ ] PostgreSQL production setup
- [ ] Redis for sessions and queues
- [ ] Player registration/login endpoints
- [ ] Match end flow with scoreboard

### Week 3: Production Infrastructure
- [ ] Docker containerization
- [ ] Load balancer configuration
- [ ] Health monitoring endpoints
- [ ] Basic logging system

### Week 4: Testing & Security
- [ ] Load testing infrastructure
- [ ] Basic anti-cheat measures
- [ ] Content moderation system
- [ ] Admin tools for player management

### Week 5: Launch Preparation
- [ ] Performance optimization
- [ ] Error handling and recovery
- [ ] Monitoring dashboards
- [ ] Documentation and runbooks

## Performance Targets (Your Benchmarks)

```typescript
const performanceTargets = {
  // Per server node
  maxLobbiesPerNode: 100,
  maxPlayersPerNode: 800,
  
  // Response times
  authenticationTime: '<200ms',
  lobbyJoinTime: '<500ms',
  gameTickRate: '30Hz consistent',
  
  // Resource usage
  memoryPerLobby: '<80MB',
  cpuPerLobby: '<4%',
  databaseConnections: '<100 per node',
  
  // Reliability
  uptime: '>99.9%',
  matchCompletionRate: '>95%',
  playerConnectionSuccess: '>99%'
};
```

## Success Metrics You'll Monitor

- **Technical Metrics**: Server response times, error rates, resource usage
- **Game Metrics**: Match completion rates, player counts per lobby, queue times
- **Security Metrics**: Failed login attempts, banned players, reported incidents
- **Business Metrics**: Player retention, peak concurrent users, revenue (if applicable)

---

*This document provides your complete backend implementation roadmap. Focus on building these systems incrementally and testing thoroughly at each phase. The lobby-based architecture makes this much more manageable than a persistent world game.*
