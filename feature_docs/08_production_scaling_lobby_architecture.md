# Production Scaling & Lobby Architecture
# Supporting 10,000 Concurrent Players Across 2,500 Lobbies

## Overview
This document outlines the production-ready architecture for scaling Trespasser from a single-lobby prototype to a multi-lobby game supporting 10,000+ concurrent players across 2,500+ independent 4v4 lobbies. The architecture focuses on horizontal scaling, automated server management, robust authentication, and custom server support.

## Core Concepts

### Lobby-Based Architecture
**Key Insight**: Unlike massive persistent worlds, lobby-based games scale linearly:
- **Each lobby**: 8 players maximum (4v4)
- **Each server node**: 100-200 lobbies (~800-1600 players)
- **Total capacity**: 25-50 server nodes for 10k+ players

### Horizontal Scaling Model
```typescript
// Scaling Formula
const scalingModel = {
  playersPerLobby: 8,
  lobbiesPerNode: 100,
  playersPerNode: 800,
  targetPlayers: 10000,
  requiredNodes: Math.ceil(10000 / 800) // = 13 nodes
};
```

## System Architecture

### 1. Authentication & Session Management

#### Centralized Auth Service
```typescript
interface AuthService {
  // JWT-based authentication
  authenticate(credentials: LoginCredentials): Promise<AuthToken>;
  validateToken(token: string): Promise<PlayerProfile>;
  refreshToken(refreshToken: string): Promise<AuthToken>;
  
  // Session management
  createPlayerSession(playerId: string): PlayerSession;
  getActiveSession(playerId: string): PlayerSession | null;
  terminateSession(sessionId: string): void;
}

interface AuthToken {
  playerId: string;
  displayName: string;
  region: string;
  permissions: string[];
  expiresAt: number;
  refreshToken: string;
}
```

#### Regional Session Affinity
- **JWT claims include preferred region**
- **Sticky routing** to nearest server cluster
- **Cross-region fallback** if local servers full

### 2. Server Management & Orchestration

#### Server Node Architecture
```typescript
class GameServerNode {
  nodeId: string;
  region: string;
  maxLobbies: number = 100;
  currentLobbies: Map<string, GameLobby> = new Map();
  
  // Health monitoring
  cpuUsage: number;
  memoryUsage: number;
  activeConnections: number;
  
  // Lifecycle management
  async startup(): Promise<void>;
  async shutdown(): Promise<void>;
  async gracefulRestart(): Promise<void>;
}
```

#### Load Balancer & Service Discovery
```typescript
interface LoadBalancer {
  // Find optimal server for new lobby
  findAvailableNode(region: string): Promise<ServerNode>;
  
  // Health checking
  performHealthCheck(node: ServerNode): Promise<HealthStatus>;
  
  // Load distribution
  redistributeLoad(): Promise<void>;
  markNodeUnavailable(nodeId: string): void;
}

enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  MAINTENANCE = 'maintenance'
}
```

### 3. Lobby Management System

#### Lobby Lifecycle
```typescript
interface LobbyManager {
  // Lobby creation
  createPublicLobby(gameMode: GameMode): Promise<LobbyInfo>;
  createPrivateLobby(hostId: string, settings: LobbySettings): Promise<LobbyInfo>;
  
  // Matchmaking
  findMatch(player: Player, preferences: MatchmakingPrefs): Promise<LobbyInfo>;
  
  // Lobby operations
  joinLobby(lobbyId: string, playerId: string): Promise<JoinResult>;
  leaveLobby(lobbyId: string, playerId: string): Promise<void>;
  
  // End of match
  handleMatchEnd(lobbyId: string, results: MatchResults): Promise<void>;
}

interface LobbyInfo {
  lobbyId: string;
  serverNodeId: string;
  gameMode: GameMode;
  currentPlayers: number;
  maxPlayers: number;
  settings: LobbySettings;
  state: LobbyState;
  region: string;
}

enum LobbyState {
  WAITING_FOR_PLAYERS = 'waiting',
  STARTING = 'starting',
  IN_PROGRESS = 'active',
  ENDING = 'ending',
  COMPLETED = 'completed'
}
```

#### Match End & Restart System
```typescript
interface MatchEndHandler {
  // Victory conditions
  checkVictoryCondition(lobby: GameLobby): VictoryResult | null;
  
  // End of match flow
  async endMatch(lobby: GameLobby, results: MatchResults): Promise<void> {
    // 1. Stop accepting new inputs
    lobby.state = LobbyState.ENDING;
    
    // 2. Calculate final scores
    const finalStats = this.calculateFinalStats(lobby);
    
    // 3. Show scoreboard for 15 seconds
    lobby.broadcastScoreboard(finalStats, 15000);
    
    // 4. Reset or restart
    await this.restartOrClose(lobby);
  }
  
  // Restart logic
  private async restartOrClose(lobby: GameLobby): Promise<void> {
    const playersStaying = lobby.getPlayersWantingRestart();
    
    if (playersStaying.length >= 2) {
      await lobby.restart();
    } else {
      await lobby.close();
    }
  }
}

interface MatchResults {
  winningTeam: 'red' | 'blue' | 'draw';
  finalScores: { red: number; blue: number };
  playerStats: PlayerMatchStats[];
  duration: number;
  reason: 'score_limit' | 'time_limit' | 'forfeit';
}

interface VictoryCondition {
  type: 'first_to_kills' | 'time_limit' | 'elimination';
  target: number; // 50 kills, 10 minutes, etc.
}
```

### 4. Automated Server Management

#### Auto-Scaling System
```typescript
interface AutoScaler {
  // Monitoring
  monitorServerLoad(): Promise<ClusterHealth>;
  
  // Scaling decisions
  shouldScaleUp(metrics: ClusterMetrics): boolean;
  shouldScaleDown(metrics: ClusterMetrics): boolean;
  
  // Scaling actions
  scaleUp(region: string, count: number): Promise<ServerNode[]>;
  scaleDown(nodeIds: string[]): Promise<void>;
  
  // Graceful operations
  drainServer(nodeId: string): Promise<void>;
  migrateLobbies(fromNode: string, toNode: string): Promise<void>;
}

interface ClusterMetrics {
  totalNodes: number;
  activeLobbies: number;
  totalPlayers: number;
  averageCpuUsage: number;
  averageMemoryUsage: number;
  queuedPlayers: number;
  regionBreakdown: RegionMetrics[];
}
```

#### Health Monitoring & Recovery
```typescript
interface HealthMonitor {
  // Node health
  checkNodeHealth(nodeId: string): Promise<NodeHealth>;
  
  // Automatic recovery
  recoverUnhealthyNode(nodeId: string): Promise<RecoveryResult>;
  
  // Alerting
  sendAlert(severity: AlertSeverity, message: string): void;
}

interface NodeHealth {
  nodeId: string;
  status: HealthStatus;
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
    activeConnections: number;
    errorRate: number;
  };
  lastHeartbeat: number;
}

enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}
```

#### Automated Restarts & Maintenance
```typescript
interface MaintenanceScheduler {
  // Scheduled maintenance
  scheduleNodeRestart(nodeId: string, delayMinutes: number): void;
  scheduleRollingUpdate(updateConfig: UpdateConfig): Promise<void>;
  
  // Emergency restarts
  emergencyRestart(nodeId: string): Promise<void>;
  
  // Graceful shutdown
  async gracefulNodeShutdown(nodeId: string): Promise<void> {
    // 1. Stop accepting new lobbies
    await this.stopNewLobbies(nodeId);
    
    // 2. Wait for matches to complete (max 20 minutes)
    await this.waitForMatchCompletion(nodeId, 20 * 60 * 1000);
    
    // 3. Force close remaining lobbies
    await this.forceCloseLobbies(nodeId);
    
    // 4. Shutdown node
    await this.shutdownNode(nodeId);
  }
}

interface UpdateConfig {
  targetVersion: string;
  maxConcurrentUpdates: number;
  rollbackOnFailure: boolean;
  healthCheckTimeout: number;
}
```

## Custom Server Support (Stretch Goal)

### Private Lobby System
```typescript
interface PrivateLobbyService {
  // Lobby creation
  createPrivateLobby(hostId: string, settings: PrivateLobbySettings): Promise<PrivateLobby>;
  
  // Access control
  invitePlayer(lobbyId: string, playerId: string): Promise<InviteResult>;
  setLobbyPassword(lobbyId: string, password: string): Promise<void>;
  
  // Custom rules
  updateLobbySettings(lobbyId: string, settings: PrivateLobbySettings): Promise<void>;
  
  // Hosting controls
  kickPlayer(lobbyId: string, hostId: string, targetId: string): Promise<void>;
  transferHost(lobbyId: string, currentHost: string, newHost: string): Promise<void>;
}

interface PrivateLobbySettings extends LobbySettings {
  // Access control
  isPrivate: boolean;
  password?: string;
  allowedPlayers?: string[];
  
  // Custom game rules
  killLimit: number; // Default: 50
  timeLimit?: number; // Optional time limit
  friendlyFire: boolean;
  
  // Map settings
  mapName: string;
  allowMapVoting: boolean;
  
  // Host controls
  hostId: string;
  allowHostMigration: boolean;
}
```

### Dedicated Server Support
```typescript
interface DedicatedServerAPI {
  // Server registration
  registerDedicatedServer(serverInfo: DedicatedServerInfo): Promise<ServerToken>;
  
  // Server management
  updateServerStatus(serverId: string, status: ServerStatus): Promise<void>;
  reportPlayerActivity(serverId: string, activity: PlayerActivity[]): Promise<void>;
  
  // Anti-cheat integration
  reportSuspiciousActivity(serverId: string, report: CheatReport): Promise<void>;
}

interface DedicatedServerInfo {
  serverName: string;
  region: string;
  maxLobbies: number;
  supportedGameModes: GameMode[];
  version: string;
  adminContact: string;
}
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
**Priority: Authentication & Basic Scaling**

#### 1.1 Authentication Service
- JWT-based login system
- Session management
- Regional routing setup

#### 1.2 Basic Multi-Lobby Support
- Extend current `GameRoom.ts` to support multiple rooms
- Simple lobby browser
- Basic matchmaking (fill first available lobby)

```typescript
// Extend current server.js
const lobbies = new Map<string, GameRoom>();
const maxLobbiesPerNode = 100;

io.on('connection', (socket) => {
  socket.on('find_match', async (gameMode) => {
    const lobby = await findOrCreateLobby(gameMode);
    lobby.addPlayer(socket);
  });
});

async function findOrCreateLobby(gameMode: GameMode): Promise<GameRoom> {
  // Find lobby with open slots
  for (const [id, lobby] of lobbies) {
    if (lobby.hasOpenSlots() && lobby.gameMode === gameMode) {
      return lobby;
    }
  }
  
  // Create new lobby if under limit
  if (lobbies.size < maxLobbiesPerNode) {
    const newLobby = new GameRoom(generateLobbyId(), io);
    lobbies.set(newLobby.id, newLobby);
    return newLobby;
  }
  
  throw new Error('Server full');
}
```

### Phase 2: Match Completion & Restart (Week 3)
**Priority: Game End Flow**

#### 2.1 Victory Conditions
```typescript
// Add to GameStateSystem.ts
class VictoryChecker {
  checkWinCondition(gameState: GameState): VictoryResult | null {
    const redKills = this.getTotalKills('red');
    const blueKills = this.getTotalKills('blue');
    
    if (redKills >= 50) {
      return { winner: 'red', score: { red: redKills, blue: blueKills } };
    }
    if (blueKills >= 50) {
      return { winner: 'blue', score: { red: redKills, blue: blueKills } };
    }
    
    return null; // Game continues
  }
}
```

#### 2.2 End Game Flow
- Scoreboard display (15 seconds)
- Player voting for restart
- Automatic lobby restart or closure

### Phase 3: Production Deployment (Week 4-5)
**Priority: Multi-Node Architecture**

#### 3.1 Load Balancer Setup
- NGINX or cloud load balancer
- Health check endpoints
- Sticky session configuration

#### 3.2 Server Orchestration
- Docker containerization
- Kubernetes or Docker Swarm
- Auto-scaling rules

### Phase 4: Advanced Features (Week 6-8)
**Priority: Custom Servers & Management**

#### 4.1 Private Lobby System
- Password-protected lobbies
- Friend invitations
- Custom game settings

#### 4.2 Automated Management
- Health monitoring dashboard
- Automatic restart system
- Performance metrics

## Performance Considerations

### Server Resource Planning
```typescript
const resourcePlanning = {
  // Per server node
  cpu: '4 vCPU',
  memory: '8 GB RAM',
  storage: '50 GB SSD',
  bandwidth: '1 Gbps',
  
  // Capacity per node
  maxLobbies: 100,
  maxPlayers: 800,
  avgMemoryPerLobby: '80 MB',
  avgCpuPerLobby: '4%'
};
```

### Database Architecture
```sql
-- Core tables for lobby scaling
CREATE TABLE players (
    player_id UUID PRIMARY KEY,
    username VARCHAR(255) UNIQUE,
    email VARCHAR(255),
    created_at TIMESTAMP,
    last_login TIMESTAMP
);

CREATE TABLE lobbies (
    lobby_id UUID PRIMARY KEY,
    server_node_id VARCHAR(255),
    game_mode VARCHAR(50),
    state VARCHAR(20),
    created_at TIMESTAMP,
    player_count INTEGER DEFAULT 0
);

CREATE TABLE lobby_players (
    lobby_id UUID REFERENCES lobbies(lobby_id),
    player_id UUID REFERENCES players(player_id),
    team VARCHAR(10),
    joined_at TIMESTAMP,
    PRIMARY KEY (lobby_id, player_id)
);

CREATE TABLE match_results (
    match_id UUID PRIMARY KEY,
    lobby_id UUID REFERENCES lobbies(lobby_id),
    winning_team VARCHAR(10),
    duration INTEGER,
    red_score INTEGER,
    blue_score INTEGER,
    completed_at TIMESTAMP
);
```

### Network Optimization
- **Regional CDN** for static assets
- **WebSocket compression** enabled
- **Connection pooling** for database
- **Redis caching** for session data

## Common Pitfalls & Solutions

### Pitfall 1: Server Node Failures
**Problem**: Hardware failures take down multiple lobbies
**Solution**: 
- Health monitoring with automatic failover
- Graceful degradation (finish current matches)
- Quick replacement node provisioning

### Pitfall 2: Uneven Load Distribution
**Problem**: Some servers overloaded while others idle
**Solution**:
- Smart load balancing based on actual load, not just lobby count
- Dynamic lobby migration during low-traffic periods
- Regional auto-scaling

### Pitfall 3: Database Bottlenecks
**Problem**: Central database becomes bottleneck at scale
**Solution**:
- Read replicas for player lookups
- Redis for session data and matchmaking queues
- Sharded database for match history

### Pitfall 4: Split-Brain During Network Issues
**Problem**: Load balancer thinks server is down but players still connected
**Solution**:
- Multiple health check methods (HTTP + WebSocket ping)
- Grace periods before marking servers unavailable
- Client-side reconnection logic

## Future Considerations

### Advanced Matchmaking
- **Skill-based matching** using ELO ratings
- **Connection quality** prioritization
- **Regional preferences** with fallbacks
- **Party system** for playing with friends

### Analytics & Monitoring
- **Real-time dashboards** for operations team
- **Player behavior analytics** for game balance
- **Performance metrics** for optimization
- **Cost tracking** for infrastructure scaling

### Security & Anti-Cheat
- **Server-side validation** of all game actions
- **Anomaly detection** for suspicious behavior
- **Rate limiting** on API endpoints
- **DDoS protection** for game servers

## Implementation Timeline

### Immediate (Week 1-2): Core Infrastructure
- [ ] Multi-lobby support in current server
- [ ] Basic authentication system
- [ ] Simple matchmaking
- [ ] Victory conditions and match end flow

### Short-term (Week 3-5): Production Ready
- [ ] Multi-server deployment
- [ ] Load balancing setup
- [ ] Automated restarts
- [ ] Health monitoring

### Medium-term (Week 6-8): Advanced Features
- [ ] Private lobby system
- [ ] Custom server support
- [ ] Advanced matchmaking
- [ ] Analytics dashboard

### Long-term (Month 3+): Scale & Polish
- [ ] Multi-region deployment
- [ ] Advanced anti-cheat
- [ ] Mobile client support
- [ ] Competitive ranking system

## Success Metrics

### Technical Metrics
- **Server utilization**: 70-80% average CPU/memory
- **Match completion rate**: >95%
- **Connection success rate**: >99%
- **Average matchmaking time**: <30 seconds

### Business Metrics
- **Concurrent players**: 10,000+ peak
- **Matches per hour**: 5,000+
- **Player retention**: 60% day-1, 30% day-7
- **Infrastructure cost**: <$0.10 per player-hour

## Conclusion

The lobby-based architecture dramatically simplifies scaling compared to persistent world games. By leveraging the existing `GameRoom` architecture and extending it horizontally across multiple server nodes, Trespasser can efficiently support 10,000+ concurrent players across thousands of independent 4v4 matches.

The key advantages of this approach:
- **Linear scaling**: More players = more servers (predictable)
- **Fault isolation**: Server failures only affect one node's lobbies
- **Resource efficiency**: Each lobby uses well-understood resources
- **Proven architecture**: Similar to Counter-Strike, Rocket League, etc.

This foundation supports the transition from prototype to production-ready multiplayer game while maintaining the excellent gameplay experience of the core 4v4 mechanics.

---

*This document provides the technical foundation for scaling Trespasser to support thousands of concurrent players while maintaining the high-quality, low-latency gameplay experience that makes the core game compelling.*
