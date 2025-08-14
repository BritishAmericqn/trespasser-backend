# Frontend Scaling Implementation Guide
# Frontend Team Responsibilities for 10k+ CCU Production Launch

## Overview
This document outlines the frontend-specific implementation tasks for scaling Trespasser to support the new lobby-based architecture with 10,000+ concurrent players. The frontend team is responsible for all user-facing interfaces, client-side systems, and user experience flows that support the multi-lobby gameplay.

## Frontend Core Responsibilities

### Phase 1: Authentication & User Management (Week 1-2)

#### 1.1 Authentication Flow Implementation
**Build complete login/registration system**

```typescript
// Frontend auth service
class AuthService {
  private apiBase = 'https://api.trespasser.com';
  private currentToken: string | null = null;
  
  async register(email: string, password: string, displayName: string): Promise<AuthResult> {
    const response = await fetch(`${this.apiBase}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    const result = await response.json();
    this.storeToken(result.token);
    return result;
  }
  
  async login(email: string, password: string): Promise<AuthResult> {
    const response = await fetch(`${this.apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    const result = await response.json();
    this.storeToken(result.token);
    return result;
  }
  
  private storeToken(token: string): void {
    this.currentToken = token;
    localStorage.setItem('auth_token', token);
  }
  
  getToken(): string | null {
    return this.currentToken || localStorage.getItem('auth_token');
  }
  
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }
}
```

#### 1.2 User Interface Components
**Create authentication UI components**

```tsx
// React component example (adapt to your framework)
import React, { useState } from 'react';

export const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      await authService.login(email, password);
      // Redirect to lobby browser
      window.location.href = '/lobbies';
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="login-form">
      <h2>Login to Trespasser</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      <p>
        Don't have an account? <a href="/register">Sign up</a>
      </p>
    </div>
  );
};
```

### Phase 2: Lobby Browser & Matchmaking (Week 2-3)

#### 2.1 Lobby Browser Interface
**Create the main lobby discovery and joining interface**

```typescript
class LobbyBrowserService {
  private socket: Socket;
  
  async getAvailableLobbies(): Promise<LobbyInfo[]> {
    return new Promise((resolve) => {
      this.socket.emit('get_lobbies');
      this.socket.once('lobbies_list', resolve);
    });
  }
  
  async joinLobby(lobbyId: string): Promise<JoinResult> {
    return new Promise((resolve, reject) => {
      this.socket.emit('join_lobby', lobbyId);
      this.socket.once('join_result', (result) => {
        if (result.success) {
          resolve(result);
        } else {
          reject(new Error(result.error));
        }
      });
    });
  }
  
  async createPrivateLobby(settings: LobbySettings): Promise<LobbyInfo> {
    return new Promise((resolve, reject) => {
      this.socket.emit('create_private_lobby', settings);
      this.socket.once('lobby_created', resolve);
      this.socket.once('create_failed', reject);
    });
  }
}
```

```tsx
// Lobby Browser Component
export const LobbyBrowser: React.FC = () => {
  const [lobbies, setLobbies] = useState<LobbyInfo[]>([]);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [selectedGameMode, setSelectedGameMode] = useState('deathmatch');
  
  useEffect(() => {
    const loadLobbies = async () => {
      const availableLobbies = await lobbyService.getAvailableLobbies();
      setLobbies(availableLobbies);
    };
    
    loadLobbies();
    const interval = setInterval(loadLobbies, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);
  
  const handleQuickMatch = async () => {
    setIsMatchmaking(true);
    try {
      await lobbyService.findQuickMatch(selectedGameMode);
    } catch (error) {
      console.error('Matchmaking failed:', error);
      setIsMatchmaking(false);
    }
  };
  
  return (
    <div className="lobby-browser">
      <div className="header">
        <h1>Find a Match</h1>
        <div className="game-mode-selector">
          <select 
            value={selectedGameMode} 
            onChange={(e) => setSelectedGameMode(e.target.value)}
          >
            <option value="deathmatch">Deathmatch</option>
            <option value="team_deathmatch">Team Deathmatch</option>
            <option value="capture_flag">Capture the Flag</option>
          </select>
        </div>
      </div>
      
      <div className="quick-match">
        <button 
          onClick={handleQuickMatch} 
          disabled={isMatchmaking}
          className="quick-match-btn"
        >
          {isMatchmaking ? 'Finding Match...' : 'Quick Match'}
        </button>
      </div>
      
      <div className="lobby-list">
        <h3>Available Lobbies</h3>
        {lobbies.map(lobby => (
          <LobbyCard 
            key={lobby.lobbyId} 
            lobby={lobby} 
            onJoin={() => lobbyService.joinLobby(lobby.lobbyId)}
          />
        ))}
      </div>
      
      <div className="private-lobby">
        <button onClick={() => setShowCreateLobby(true)}>
          Create Private Lobby
        </button>
      </div>
    </div>
  );
};
```

#### 2.2 Matchmaking Queue Interface
**Handle the matchmaking wait experience**

```tsx
export const MatchmakingQueue: React.FC = () => {
  const [queueTime, setQueueTime] = useState(0);
  const [estimatedWait, setEstimatedWait] = useState(30);
  const [playersInQueue, setPlayersInQueue] = useState(0);
  
  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      setQueueTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    // Listen for queue updates
    socket.on('queue_update', (data) => {
      setEstimatedWait(data.estimatedWait);
      setPlayersInQueue(data.playersInQueue);
    });
    
    return () => {
      clearInterval(timer);
      socket.off('queue_update');
    };
  }, []);
  
  const cancelMatchmaking = () => {
    socket.emit('cancel_matchmaking');
    // Return to lobby browser
  };
  
  return (
    <div className="matchmaking-queue">
      <div className="queue-status">
        <h2>Finding Match...</h2>
        <div className="timer">
          Queue Time: {Math.floor(queueTime / 60)}:{(queueTime % 60).toString().padStart(2, '0')}
        </div>
        <div className="estimate">
          Estimated Wait: {estimatedWait}s
        </div>
        <div className="players-count">
          Players in Queue: {playersInQueue}
        </div>
      </div>
      
      <div className="queue-actions">
        <button onClick={cancelMatchmaking} className="cancel-btn">
          Cancel Search
        </button>
      </div>
      
      <div className="tips">
        <h3>Pro Tips</h3>
        <ul>
          <li>Use cover and destructible walls to your advantage</li>
          <li>Coordinate with your team for maximum effectiveness</li>
          <li>Different weapons excel at different ranges</li>
        </ul>
      </div>
    </div>
  );
};
```

### Phase 3: In-Lobby Experience (Week 3-4)

#### 3.1 Pre-Game Lobby Interface
**Create the waiting room experience before match starts**

```tsx
export const GameLobby: React.FC = () => {
  const [lobbyState, setLobbyState] = useState<LobbyState>();
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isHost, setIsHost] = useState(false);
  
  useEffect(() => {
    socket.on('lobby_state_update', setLobbyState);
    socket.on('players_update', setPlayers);
    socket.on('chat_message', (message) => {
      setChatMessages(prev => [...prev, message]);
    });
    
    return () => {
      socket.off('lobby_state_update');
      socket.off('players_update');
      socket.off('chat_message');
    };
  }, []);
  
  const sendChatMessage = (message: string) => {
    socket.emit('lobby_chat', { message });
  };
  
  const toggleReady = () => {
    socket.emit('toggle_ready');
  };
  
  const startMatch = () => {
    if (isHost) {
      socket.emit('start_match');
    }
  };
  
  return (
    <div className="game-lobby">
      <div className="lobby-header">
        <h2>Lobby: {lobbyState?.lobbyId}</h2>
        <div className="game-mode">{lobbyState?.gameMode}</div>
      </div>
      
      <div className="teams">
        <div className="team red-team">
          <h3>Red Team</h3>
          {players.filter(p => p.team === 'red').map(player => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
        
        <div className="team blue-team">
          <h3>Blue Team</h3>
          {players.filter(p => p.team === 'blue').map(player => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      </div>
      
      <div className="lobby-controls">
        <button onClick={toggleReady} className="ready-btn">
          {players.find(p => p.id === currentPlayerId)?.isReady ? 'Not Ready' : 'Ready'}
        </button>
        
        {isHost && (
          <button onClick={startMatch} className="start-btn">
            Start Match
          </button>
        )}
      </div>
      
      <div className="lobby-chat">
        <div className="messages">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className="message">
              <span className="player">{msg.playerName}:</span>
              <span className="text">{msg.text}</span>
            </div>
          ))}
        </div>
        <ChatInput onSend={sendChatMessage} />
      </div>
    </div>
  );
};
```

#### 3.2 Team Selection & Loadout
**Allow players to choose teams and customize loadouts**

```tsx
export const LoadoutSelector: React.FC = () => {
  const [selectedLoadout, setSelectedLoadout] = useState<Loadout>();
  const [availableWeapons, setAvailableWeapons] = useState<Weapon[]>([]);
  
  useEffect(() => {
    // Load available weapons from server
    socket.emit('get_available_weapons');
    socket.once('weapons_list', setAvailableWeapons);
  }, []);
  
  const updateLoadout = (slot: WeaponSlot, weaponId: string) => {
    const newLoadout = { ...selectedLoadout };
    newLoadout[slot] = weaponId;
    setSelectedLoadout(newLoadout);
    
    // Send to server
    socket.emit('update_loadout', newLoadout);
  };
  
  return (
    <div className="loadout-selector">
      <h3>Choose Your Loadout</h3>
      
      <div className="weapon-slots">
        <div className="primary-slot">
          <h4>Primary Weapon</h4>
          <WeaponSelect
            weapons={availableWeapons.filter(w => w.category === 'primary')}
            selected={selectedLoadout?.primary}
            onSelect={(weaponId) => updateLoadout('primary', weaponId)}
          />
        </div>
        
        <div className="secondary-slot">
          <h4>Secondary Weapon</h4>
          <WeaponSelect
            weapons={availableWeapons.filter(w => w.category === 'secondary')}
            selected={selectedLoadout?.secondary}
            onSelect={(weaponId) => updateLoadout('secondary', weaponId)}
          />
        </div>
        
        <div className="support-slots">
          <h4>Support Items (3 slots)</h4>
          <SupportItemSelector
            maxSlots={3}
            selectedItems={selectedLoadout?.support || []}
            onUpdate={(items) => updateLoadout('support', items)}
          />
        </div>
      </div>
      
      <div className="loadout-preview">
        <LoadoutPreview loadout={selectedLoadout} />
      </div>
    </div>
  );
};
```

### Phase 4: End Game Experience (Week 4)

#### 4.1 Scoreboard & Match Results
**Display detailed match results and statistics**

```tsx
export const MatchEndScoreboard: React.FC<{ results: MatchResults }> = ({ results }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [voteRestart, setVoteRestart] = useState(false);
  const [countdown, setCountdown] = useState(15);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Auto-return to lobby browser if no restart vote
          if (!voteRestart) {
            window.location.href = '/lobbies';
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [voteRestart]);
  
  const handleRestartVote = () => {
    setVoteRestart(true);
    socket.emit('vote_restart');
  };
  
  const returnToLobbyBrowser = () => {
    socket.emit('leave_lobby');
    window.location.href = '/lobbies';
  };
  
  return (
    <div className="match-end-scoreboard">
      <div className="victory-banner">
        <h1 className={`victory ${results.winningTeam}`}>
          {results.winningTeam === 'red' ? 'Red Team' : 'Blue Team'} Wins!
        </h1>
        <div className="final-score">
          {results.finalScores.red} - {results.finalScores.blue}
        </div>
      </div>
      
      <div className="player-stats">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Team</th>
              <th>Kills</th>
              <th>Deaths</th>
              <th>K/D</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {results.playerStats.map(player => (
              <tr key={player.playerId} className={player.team}>
                <td>{player.displayName}</td>
                <td className={`team-badge ${player.team}`}>{player.team}</td>
                <td>{player.kills}</td>
                <td>{player.deaths}</td>
                <td>{(player.kills / Math.max(player.deaths, 1)).toFixed(1)}</td>
                <td>{player.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {showDetails && (
        <div className="detailed-stats">
          <MatchDetailedStats results={results} />
        </div>
      )}
      
      <div className="match-actions">
        <button onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
        
        <button onClick={handleRestartVote} disabled={voteRestart}>
          {voteRestart ? 'Voted to Restart' : 'Vote Restart'}
        </button>
        
        <button onClick={returnToLobbyBrowser}>
          Return to Lobby Browser
        </button>
      </div>
      
      <div className="countdown">
        Returning to lobby browser in {countdown}s
      </div>
    </div>
  );
};
```

#### 4.2 Post-Match Progression
**Show XP gained, stats, and progression**

```tsx
export const PostMatchProgression: React.FC = () => {
  const [progression, setProgression] = useState<ProgressionData>();
  const [isAnimating, setIsAnimating] = useState(true);
  
  useEffect(() => {
    // Fetch progression data
    socket.emit('get_post_match_progression');
    socket.once('progression_data', (data) => {
      setProgression(data);
      // Animate XP gain
      setTimeout(() => setIsAnimating(false), 2000);
    });
  }, []);
  
  return (
    <div className="post-match-progression">
      <h3>Match Complete</h3>
      
      <div className="xp-gain">
        <div className="xp-bar">
          <div className="xp-fill" style={{ width: `${progression?.xpPercent}%` }}>
            <AnimatedNumber 
              value={progression?.xpGained || 0}
              duration={1500}
              prefix="+"
              suffix=" XP"
            />
          </div>
        </div>
        <div className="level-info">
          Level {progression?.currentLevel} 
          {progression?.leveledUp && <span className="level-up">LEVEL UP!</span>}
        </div>
      </div>
      
      <div className="achievements">
        {progression?.achievementsUnlocked?.map(achievement => (
          <div key={achievement.id} className="achievement-unlock">
            <img src={achievement.icon} alt={achievement.name} />
            <div>
              <h4>{achievement.name}</h4>
              <p>{achievement.description}</p>
            </div>
          </div>
        ))}
      </div>
      
      <div className="stats-summary">
        <div className="stat">
          <label>Total Kills</label>
          <span>{progression?.totalKills}</span>
        </div>
        <div className="stat">
          <label>Win Rate</label>
          <span>{progression?.winRate}%</span>
        </div>
        <div className="stat">
          <label>Matches Played</label>
          <span>{progression?.totalMatches}</span>
        </div>
      </div>
    </div>
  );
};
```

### Phase 5: Settings & Customization (Week 5)

#### 5.1 Game Settings Interface
**Comprehensive settings for graphics, audio, and controls**

```tsx
export const GameSettings: React.FC = () => {
  const [settings, setSettings] = useState<GameSettings>();
  
  const updateSetting = (category: string, key: string, value: any) => {
    const newSettings = { ...settings };
    newSettings[category][key] = value;
    setSettings(newSettings);
    
    // Apply setting immediately and save to localStorage
    applyGameSetting(category, key, value);
    localStorage.setItem('game_settings', JSON.stringify(newSettings));
  };
  
  return (
    <div className="game-settings">
      <div className="settings-tabs">
        <button className="tab active">Graphics</button>
        <button className="tab">Audio</button>
        <button className="tab">Controls</button>
        <button className="tab">Network</button>
      </div>
      
      <div className="settings-content">
        <div className="graphics-settings">
          <h3>Graphics Settings</h3>
          
          <div className="setting">
            <label>Resolution Scale</label>
            <select value={settings?.graphics?.resolutionScale}>
              <option value={1}>1x (480x270)</option>
              <option value={2}>2x (960x540)</option>
              <option value={3}>3x (1440x810)</option>
              <option value={4}>4x (1920x1080)</option>
            </select>
          </div>
          
          <div className="setting">
            <label>Frame Rate Limit</label>
            <select value={settings?.graphics?.frameRateLimit}>
              <option value={60}>60 FPS</option>
              <option value={120}>120 FPS</option>
              <option value={144}>144 FPS</option>
              <option value={0}>Unlimited</option>
            </select>
          </div>
          
          <div className="setting">
            <label>Visual Effects</label>
            <input 
              type="range" 
              min={0} 
              max={100} 
              value={settings?.graphics?.effectsQuality}
              onChange={(e) => updateSetting('graphics', 'effectsQuality', parseInt(e.target.value))}
            />
          </div>
          
          <div className="setting">
            <label>Show FPS Counter</label>
            <input 
              type="checkbox" 
              checked={settings?.graphics?.showFps}
              onChange={(e) => updateSetting('graphics', 'showFps', e.target.checked)}
            />
          </div>
        </div>
        
        <div className="audio-settings">
          <h3>Audio Settings</h3>
          
          <div className="setting">
            <label>Master Volume</label>
            <input 
              type="range" 
              min={0} 
              max={100} 
              value={settings?.audio?.masterVolume}
              onChange={(e) => updateSetting('audio', 'masterVolume', parseInt(e.target.value))}
            />
          </div>
          
          <div className="setting">
            <label>Sound Effects</label>
            <input 
              type="range" 
              min={0} 
              max={100} 
              value={settings?.audio?.sfxVolume}
            />
          </div>
          
          <div className="setting">
            <label>Music Volume</label>
            <input 
              type="range" 
              min={0} 
              max={100} 
              value={settings?.audio?.musicVolume}
            />
          </div>
          
          <div className="setting">
            <label>3D Audio</label>
            <input 
              type="checkbox" 
              checked={settings?.audio?.spatialAudio}
            />
          </div>
        </div>
      </div>
      
      <div className="settings-actions">
        <button onClick={resetToDefaults}>Reset to Defaults</button>
        <button onClick={saveSettings}>Save Settings</button>
      </div>
    </div>
  );
};
```

#### 5.2 Key Binding Customization
**Allow players to customize their controls**

```tsx
export const KeyBindings: React.FC = () => {
  const [bindings, setBindings] = useState<KeyBindings>();
  const [isRebinding, setIsRebinding] = useState<string | null>(null);
  
  const startRebinding = (action: string) => {
    setIsRebinding(action);
    
    const handleKeyPress = (e: KeyboardEvent) => {
      e.preventDefault();
      
      const newBindings = { ...bindings };
      newBindings[action] = e.code;
      setBindings(newBindings);
      setIsRebinding(null);
      
      // Save to localStorage and apply
      localStorage.setItem('key_bindings', JSON.stringify(newBindings));
      
      document.removeEventListener('keydown', handleKeyPress);
    };
    
    document.addEventListener('keydown', handleKeyPress);
  };
  
  return (
    <div className="key-bindings">
      <h3>Key Bindings</h3>
      
      <div className="binding-categories">
        <div className="movement-bindings">
          <h4>Movement</h4>
          <KeyBindingRow 
            label="Move Forward" 
            currentKey={bindings?.moveForward}
            onRebind={() => startRebinding('moveForward')}
            isRebinding={isRebinding === 'moveForward'}
          />
          <KeyBindingRow 
            label="Move Backward" 
            currentKey={bindings?.moveBackward}
            onRebind={() => startRebinding('moveBackward')}
            isRebinding={isRebinding === 'moveBackward'}
          />
          <KeyBindingRow 
            label="Move Left" 
            currentKey={bindings?.moveLeft}
            onRebind={() => startRebinding('moveLeft')}
            isRebinding={isRebinding === 'moveLeft'}
          />
          <KeyBindingRow 
            label="Move Right" 
            currentKey={bindings?.moveRight}
            onRebind={() => startRebinding('moveRight')}
            isRebinding={isRebinding === 'moveRight'}
          />
          <KeyBindingRow 
            label="Sprint" 
            currentKey={bindings?.sprint}
            onRebind={() => startRebinding('sprint')}
            isRebinding={isRebinding === 'sprint'}
          />
          <KeyBindingRow 
            label="Sneak" 
            currentKey={bindings?.sneak}
            onRebind={() => startRebinding('sneak')}
            isRebinding={isRebinding === 'sneak'}
          />
        </div>
        
        <div className="combat-bindings">
          <h4>Combat</h4>
          <KeyBindingRow 
            label="Fire" 
            currentKey="Mouse1"
            disabled={true}
          />
          <KeyBindingRow 
            label="Aim Down Sights" 
            currentKey="Mouse2"
            disabled={true}
          />
          <KeyBindingRow 
            label="Reload" 
            currentKey={bindings?.reload}
            onRebind={() => startRebinding('reload')}
            isRebinding={isRebinding === 'reload'}
          />
        </div>
      </div>
      
      <div className="binding-actions">
        <button onClick={resetToDefaults}>Reset to Defaults</button>
        <button onClick={saveBindings}>Save Bindings</button>
      </div>
    </div>
  );
};
```

## Critical Launch Requirements (Frontend Responsibility)

### 1. Error Handling & User Feedback
```tsx
export const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setError(new Error(event.message));
      
      // Report error to analytics
      analytics.reportError('frontend_error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  
  if (hasError) {
    return (
      <div className="error-boundary">
        <h2>Something went wrong</h2>
        <p>We're sorry, but something unexpected happened.</p>
        <button onClick={() => window.location.reload()}>
          Reload Page
        </button>
        <button onClick={() => window.location.href = '/'}>
          Return Home
        </button>
        {process.env.NODE_ENV === 'development' && (
          <pre>{error?.stack}</pre>
        )}
      </div>
    );
  }
  
  return <>{children}</>;
};
```

### 2. Connection Management
```typescript
class ConnectionManager {
  private socket: Socket;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  constructor() {
    this.socket = io('wss://api.trespasser.com', {
      auth: {
        token: authService.getToken()
      },
      transports: ['websocket']
    });
    
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.reconnectAttempts = 0;
      this.showConnectionStatus('connected');
    });
    
    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      this.showConnectionStatus('disconnected');
      
      if (reason === 'io server disconnect') {
        // Server kicked us, don't auto-reconnect
        this.showErrorMessage('Connection lost. Please refresh the page.');
      }
    });
    
    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      console.error('Connection error:', error);
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.showErrorMessage('Unable to connect to server. Please check your internet connection.');
      } else {
        this.showConnectionStatus('reconnecting');
      }
    });
  }
  
  private showConnectionStatus(status: 'connected' | 'disconnected' | 'reconnecting'): void {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
      statusElement.className = `connection-status ${status}`;
      statusElement.textContent = {
        connected: 'Connected',
        disconnected: 'Disconnected',
        reconnecting: 'Reconnecting...'
      }[status];
    }
  }
}
```

### 3. Performance Optimization
```typescript
class PerformanceManager {
  private frameRate = 60;
  private lastFrameTime = 0;
  private frameCount = 0;
  private fpsDisplay: HTMLElement | null = null;
  
  constructor() {
    this.fpsDisplay = document.getElementById('fps-counter');
    this.startMonitoring();
  }
  
  private startMonitoring(): void {
    const measureFrame = (timestamp: number) => {
      if (this.lastFrameTime > 0) {
        const delta = timestamp - this.lastFrameTime;
        this.frameRate = 1000 / delta;
        this.frameCount++;
        
        // Update FPS display every 30 frames
        if (this.frameCount % 30 === 0 && this.fpsDisplay) {
          this.fpsDisplay.textContent = `${Math.round(this.frameRate)} FPS`;
        }
      }
      
      this.lastFrameTime = timestamp;
      requestAnimationFrame(measureFrame);
    };
    
    requestAnimationFrame(measureFrame);
  }
  
  optimizeForPerformance(): void {
    // Disable expensive visual effects if performance is poor
    if (this.frameRate < 30) {
      this.disableParticleEffects();
      this.reduceVisualQuality();
    }
    
    // Enable performance mode if consistently low FPS
    if (this.frameRate < 20) {
      this.enablePerformanceMode();
    }
  }
  
  private disableParticleEffects(): void {
    document.body.classList.add('low-performance');
  }
  
  private enablePerformanceMode(): void {
    document.body.classList.add('performance-mode');
    // Reduce resolution scale, disable effects, etc.
  }
}
```

## Implementation Timeline & Priorities

### Week 1: Authentication & Core UI
- [ ] Login/registration forms with validation
- [ ] Main navigation and routing
- [ ] Basic error handling and user feedback
- [ ] Responsive design for different screen sizes

### Week 2: Lobby System
- [ ] Lobby browser with real-time updates
- [ ] Quick match and matchmaking queue interface
- [ ] Private lobby creation form
- [ ] Team selection and balancing UI

### Week 3: In-Game UI Enhancements
- [ ] Improved HUD with lobby information
- [ ] In-game chat system
- [ ] Player list with team indicators
- [ ] Connection status indicators

### Week 4: End Game & Polish
- [ ] Match end scoreboard with animations
- [ ] Post-match progression and stats
- [ ] Settings panels for all game options
- [ ] Key binding customization

### Week 5: Performance & Launch Prep
- [ ] Performance monitoring and optimization
- [ ] Error tracking and reporting
- [ ] Accessibility improvements
- [ ] Mobile-responsive design

## Success Metrics (Frontend)

- **User Experience**: < 3 second load times, > 95% uptime, < 5% error rate
- **Conversion**: > 80% registration completion, > 60% return rate after first match
- **Performance**: 60+ FPS on target hardware, < 500ms response to user inputs
- **Accessibility**: Full keyboard navigation, screen reader compatibility

## Launch Readiness Checklist

### Technical Requirements
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness (tablet and phone)
- [ ] Offline handling and reconnection logic
- [ ] Error reporting and analytics integration

### User Experience
- [ ] Onboarding flow for new players
- [ ] Help/tutorial system
- [ ] Feedback forms and bug reporting
- [ ] Social features (friend lists, recent players)

### Performance
- [ ] Asset optimization and compression
- [ ] Code splitting and lazy loading
- [ ] CDN setup for static assets
- [ ] Caching strategies for API responses

---

*This document provides the complete frontend implementation roadmap to support the new lobby-based architecture. Focus on user experience and seamless integration with the backend systems described in the backend implementation guide.*
