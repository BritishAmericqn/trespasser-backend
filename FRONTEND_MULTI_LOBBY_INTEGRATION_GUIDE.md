# 🎮 Frontend Multi-Lobby Integration Guide

## **🎯 OVERVIEW**

The backend has been upgraded from a **single-room system** to a **multi-lobby architecture** supporting **unlimited concurrent lobbies**. This guide provides everything the frontend team needs to integrate with the new system.

---

## **📋 BREAKING CHANGES**

### **⚠️ CRITICAL: What Changed**
- **No automatic game joining** - players must explicitly request matchmaking
- **New event system** - `find_match` replaces automatic room joining
- **Lobby-based gameplay** - each match is isolated in its own lobby
- **Victory conditions** - matches end when a team reaches 50 kills
- **Match lifecycle** - games have distinct waiting → playing → finished states

### **🔄 Migration Required**
The frontend **must** be updated to use the new event system. The old single-room approach will not work.

---

## **🚀 NEW EVENT SYSTEM**

### **📤 Events Frontend MUST Emit**

#### **1. Matchmaking Events**
```javascript
// PRIMARY: Find a match (replaces automatic joining)
socket.emit('find_match', {
  gameMode: 'deathmatch',  // Optional: defaults to 'deathmatch'
  isPrivate: false         // Optional: defaults to false
});

// Create private lobby
socket.emit('create_private_lobby', {
  gameMode: 'deathmatch',    // Optional
  password: 'secret123',     // Optional
  maxPlayers: 4,            // Optional: 1-8, defaults to 8
  mapName: 'yourmap2'       // Optional
});

// Join specific lobby
socket.emit('join_lobby', {
  lobbyId: 'deathmatch_abc123_xyz789',  // Required
  password: 'secret123'                 // Required if lobby has password
});

// Leave current lobby
socket.emit('leave_lobby');
```

#### **2. Existing Game Events (Unchanged)**
```javascript
// These events work exactly the same within lobbies
socket.emit('player:input', inputData);
socket.emit('weapon:fire', weaponData);
socket.emit('weapon:reload', reloadData);
// ... all other gameplay events remain the same
```

### **📥 Events Frontend MUST Listen For**

#### **1. Matchmaking Response Events**
```javascript
// Successfully joined a lobby
socket.on('lobby_joined', (data) => {
  /*
  data = {
    lobbyId: 'deathmatch_abc123_xyz789',
    playerCount: 3,
    maxPlayers: 8,
    gameMode: 'deathmatch'
  }
  */
  console.log(`Joined lobby ${data.lobbyId} with ${data.playerCount}/${data.maxPlayers} players`);
  
  // UPDATE UI: Show "Waiting for players..." or "In Lobby" state
  showLobbyWaitingScreen(data);
});

// Matchmaking failed
socket.on('matchmaking_failed', (data) => {
  /*
  data = {
    reason: 'Server capacity reached' | 'Internal server error'
  }
  */
  console.error('Matchmaking failed:', data.reason);
  
  // UPDATE UI: Show error message, return to main menu
  showMatchmakingError(data.reason);
});

// Private lobby creation result
socket.on('private_lobby_created', (data) => {
  /*
  data = {
    lobbyId: 'private_abc123_xyz789',
    inviteCode: 'private_abc123_xyz789', // Can be shared with friends
    maxPlayers: 4
  }
  */
  console.log('Private lobby created:', data.lobbyId);
  
  // UPDATE UI: Show lobby created screen with invite code
  showPrivateLobbyCreated(data);
});

// Failed to create/join lobby
socket.on('lobby_creation_failed', (data) => { /* Handle error */ });
socket.on('lobby_join_failed', (data) => { /* Handle error */ });
```

#### **2. Match Lifecycle Events**
```javascript
// Match is starting
socket.on('match_started', (data) => {
  /*
  data = {
    lobbyId: 'deathmatch_abc123_xyz789',
    startTime: 1640995200000,
    killTarget: 50
  }
  */
  console.log(`Match started! First team to ${data.killTarget} kills wins`);
  
  // UPDATE UI: Hide lobby screen, show game UI with kill counter
  startGameplay(data);
  showKillCounter(data.killTarget);
});

// Match ended with results
socket.on('match_ended', (data) => {
  /*
  data = {
    lobbyId: 'deathmatch_abc123_xyz789',
    winnerTeam: 'red' | 'blue',
    redKills: 50,
    blueKills: 23,
    duration: 180000, // milliseconds
    playerStats: [
      {
        playerId: 'player123',
        playerName: 'Player 12345678',
        team: 'red',
        kills: 12,
        deaths: 8,
        damageDealt: 0  // TODO: Not implemented yet
      },
      // ... more player stats
    ]
  }
  */
  console.log(`Match ended! Winner: ${data.winnerTeam}`);
  
  // UPDATE UI: Show scoreboard with match results
  showMatchResults(data);
});
```

#### **3. Existing Game Events (Unchanged)**
```javascript
// These events work exactly the same
socket.on('game:state', (gameState) => { /* Handle as before */ });
socket.on('player:joined', (playerData) => { /* Handle as before */ });
socket.on('player:left', (playerData) => { /* Handle as before */ });
// ... all other gameplay events remain the same
```

---

## **🎨 UI/UX IMPLEMENTATION**

### **📱 Required UI Screens**

#### **1. Main Menu (Updated)**
```javascript
// Example React component structure
function MainMenu() {
  const [isConnected, setIsConnected] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  return (
    <div>
      <h1>Trespasser</h1>
      {isAuthenticated ? (
        <div>
          <button onClick={() => findMatch('deathmatch')}>
            🎯 Find Deathmatch
          </button>
          <button onClick={() => showPrivateLobbyDialog()}>
            🔒 Create Private Lobby
          </button>
          <button onClick={() => showJoinLobbyDialog()}>
            🎮 Join Lobby by ID
          </button>
        </div>
      ) : (
        <AuthenticationForm />
      )}
    </div>
  );
}

function findMatch(gameMode) {
  socket.emit('find_match', { gameMode });
  // Show loading screen: "Finding match..."
  showMatchmakingLoading();
}
```

#### **2. Lobby Waiting Screen (New)**
```javascript
function LobbyWaitingScreen({ lobbyData }) {
  const [playerCount, setPlayerCount] = useState(lobbyData.playerCount);
  const [countdown, setCountdown] = useState(null);
  
  // Listen for player count updates
  useEffect(() => {
    socket.on('lobby_joined', (data) => {
      setPlayerCount(data.playerCount);
    });
    
    socket.on('match_starting', (data) => {
      setCountdown(data.countdown);
    });
  }, []);
  
  return (
    <div className="lobby-waiting">
      <h2>Lobby: {lobbyData.lobbyId}</h2>
      <p>Players: {playerCount}/{lobbyData.maxPlayers}</p>
      <p>Game Mode: {lobbyData.gameMode}</p>
      
      {countdown ? (
        <div className="match-starting">
          <h3>Match starting in {countdown}s...</h3>
        </div>
      ) : (
        <div className="waiting">
          <h3>Waiting for players...</h3>
          <p>Match will start automatically when enough players join</p>
        </div>
      )}
      
      <button onClick={() => leaveLobby()}>
        Leave Lobby
      </button>
    </div>
  );
}

function leaveLobby() {
  socket.emit('leave_lobby');
  // Return to main menu
  showMainMenu();
}
```

#### **3. In-Game HUD (Updated)**
```javascript
function GameHUD({ gameState, killTarget = 50 }) {
  // Calculate team kill counts
  const teamKills = calculateTeamKills(gameState.players);
  
  return (
    <div className="game-hud">
      {/* Existing HUD elements */}
      <HealthBar health={gameState.players[myPlayerId]?.health} />
      <WeaponInfo weapon={currentWeapon} />
      
      {/* NEW: Kill Counter */}
      <div className="kill-counter">
        <h3>Race to {killTarget} Kills!</h3>
        <div className="team-scores">
          <div className="red-team">
            Red: {teamKills.red}/{killTarget}
            <div className="progress-bar">
              <div 
                className="progress" 
                style={{ width: `${(teamKills.red / killTarget) * 100}%` }}
              />
            </div>
          </div>
          <div className="blue-team">
            Blue: {teamKills.blue}/{killTarget}
            <div className="progress-bar">
              <div 
                className="progress" 
                style={{ width: `${(teamKills.blue / killTarget) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function calculateTeamKills(players) {
  const teamKills = { red: 0, blue: 0 };
  Object.values(players).forEach(player => {
    if (player.team === 'red') teamKills.red += player.kills;
    if (player.team === 'blue') teamKills.blue += player.kills;
  });
  return teamKills;
}
```

#### **4. Match Results Screen (New)**
```javascript
function MatchResultsScreen({ matchData }) {
  const { winnerTeam, playerStats, duration } = matchData;
  
  // Sort players by kills
  const sortedStats = [...playerStats].sort((a, b) => b.kills - a.kills);
  
  return (
    <div className="match-results">
      <div className="winner-announcement">
        <h1>{winnerTeam.toUpperCase()} TEAM WINS!</h1>
        <p>Match Duration: {formatDuration(duration)}</p>
      </div>
      
      <div className="team-scores">
        <div className="red-team">
          <h3>Red Team: {matchData.redKills} kills</h3>
        </div>
        <div className="blue-team">
          <h3>Blue Team: {matchData.blueKills} kills</h3>
        </div>
      </div>
      
      <div className="scoreboard">
        <h3>Player Statistics</h3>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Team</th>
              <th>Kills</th>
              <th>Deaths</th>
              <th>K/D</th>
            </tr>
          </thead>
          <tbody>
            {sortedStats.map(player => (
              <tr key={player.playerId} className={`team-${player.team}`}>
                <td>{player.playerName}</td>
                <td>{player.team}</td>
                <td>{player.kills}</td>
                <td>{player.deaths}</td>
                <td>{(player.kills / Math.max(player.deaths, 1)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="post-match-actions">
        <button onClick={() => findMatch(matchData.gameMode)}>
          Play Again
        </button>
        <button onClick={() => showMainMenu()}>
          Main Menu
        </button>
      </div>
    </div>
  );
}
```

#### **5. Private Lobby Creation (New)**
```javascript
function PrivateLobbyDialog({ onClose }) {
  const [settings, setSettings] = useState({
    gameMode: 'deathmatch',
    password: '',
    maxPlayers: 8
  });
  
  function createLobby() {
    socket.emit('create_private_lobby', settings);
    onClose();
  }
  
  return (
    <div className="modal">
      <div className="private-lobby-form">
        <h2>Create Private Lobby</h2>
        
        <label>
          Game Mode:
          <select 
            value={settings.gameMode}
            onChange={(e) => setSettings({...settings, gameMode: e.target.value})}
          >
            <option value="deathmatch">Deathmatch</option>
            {/* Add more game modes as they're implemented */}
          </select>
        </label>
        
        <label>
          Password (optional):
          <input 
            type="password"
            value={settings.password}
            onChange={(e) => setSettings({...settings, password: e.target.value})}
            placeholder="Leave empty for no password"
          />
        </label>
        
        <label>
          Max Players:
          <select
            value={settings.maxPlayers}
            onChange={(e) => setSettings({...settings, maxPlayers: parseInt(e.target.value)})}
          >
            {[2,3,4,5,6,7,8].map(num => (
              <option key={num} value={num}>{num} players</option>
            ))}
          </select>
        </label>
        
        <div className="actions">
          <button onClick={createLobby}>Create Lobby</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
```

---

## **🔧 IMPLEMENTATION STEPS**

### **Step 1: Update Connection Flow**
```javascript
// OLD (Single Room - Remove This)
socket.on('authenticated', () => {
  // ❌ DON'T: Automatically join game
  // ❌ socket.emit('player:join');
});

// NEW (Multi-Lobby - Use This)
socket.on('authenticated', () => {
  // ✅ Show main menu with matchmaking options
  showMainMenu();
});
```

### **Step 2: Implement Matchmaking**
```javascript
// Add to your socket event handlers
function setupMatchmakingEvents() {
  // Successful lobby join
  socket.on('lobby_joined', (data) => {
    currentLobby = data;
    showLobbyWaitingScreen(data);
  });
  
  // Match lifecycle
  socket.on('match_started', (data) => {
    hideAllMenus();
    showGameplay();
    showKillCounter(data.killTarget);
  });
  
  socket.on('match_ended', (data) => {
    hideGameplay();
    showMatchResults(data);
  });
  
  // Error handling
  socket.on('matchmaking_failed', (data) => {
    showError(`Matchmaking failed: ${data.reason}`);
    showMainMenu();
  });
}
```

### **Step 3: Update Game State Handling**
```javascript
// The game state event handler remains mostly the same
socket.on('game:state', (gameState) => {
  // ✅ All existing game rendering code works unchanged
  updatePlayerPositions(gameState.players);
  updateWalls(gameState.walls);
  updateProjectiles(gameState.projectiles);
  
  // ✅ NEW: Update kill counter if in match
  if (currentLobby && gameState.matchActive) {
    updateKillCounter(gameState.players);
  }
});
```

### **Step 4: Add Kill Tracking**
```javascript
function updateKillCounter(players) {
  const teamKills = { red: 0, blue: 0 };
  
  Object.values(players).forEach(player => {
    if (player.team === 'red') teamKills.red += player.kills;
    if (player.team === 'blue') teamKills.blue += player.kills;
  });
  
  // Update UI
  document.getElementById('red-kills').textContent = `${teamKills.red}/50`;
  document.getElementById('blue-kills').textContent = `${teamKills.blue}/50`;
  
  // Update progress bars
  document.getElementById('red-progress').style.width = `${(teamKills.red / 50) * 100}%`;
  document.getElementById('blue-progress').style.width = `${(teamKills.blue / 50) * 100}%`;
}
```

---

## **🎨 CSS STYLING EXAMPLES**

### **Lobby Waiting Screen**
```css
.lobby-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a1a, #2d2d2d);
  color: white;
  text-align: center;
}

.lobby-waiting h2 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: #4CAF50;
}

.match-starting {
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}
```

### **Kill Counter HUD**
```css
.kill-counter {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  padding: 15px;
  border-radius: 10px;
  color: white;
  z-index: 1000;
}

.team-scores {
  display: flex;
  gap: 30px;
  margin-top: 10px;
}

.red-team, .blue-team {
  flex: 1;
  text-align: center;
}

.progress-bar {
  width: 150px;
  height: 10px;
  background: #333;
  border-radius: 5px;
  overflow: hidden;
  margin: 5px auto;
}

.red-team .progress { background: #ff4444; }
.blue-team .progress { background: #4444ff; }

.progress {
  height: 100%;
  transition: width 0.3s ease;
}
```

### **Match Results Screen**
```css
.match-results {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  z-index: 2000;
}

.winner-announcement h1 {
  font-size: 4rem;
  margin-bottom: 1rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
}

.scoreboard table {
  background: rgba(255, 255, 255, 0.1);
  border-collapse: collapse;
  border-radius: 10px;
  overflow: hidden;
  margin: 20px 0;
}

.scoreboard th,
.scoreboard td {
  padding: 12px 20px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.team-red { background: rgba(255, 68, 68, 0.2); }
.team-blue { background: rgba(68, 68, 255, 0.2); }
```

---

## **🐛 ERROR HANDLING**

### **Common Error Scenarios**
```javascript
function handleMatchmakingErrors() {
  socket.on('matchmaking_failed', (data) => {
    switch(data.reason) {
      case 'Server capacity reached':
        showError('Server is full. Please try again later.');
        break;
      case 'Internal server error':
        showError('Server error. Please try again.');
        break;
      default:
        showError('Matchmaking failed. Please try again.');
    }
  });
  
  socket.on('lobby_join_failed', (data) => {
    switch(data.reason) {
      case 'Lobby not found':
        showError('Lobby not found. It may have ended.');
        break;
      case 'Invalid password':
        showError('Incorrect lobby password.');
        break;
      case 'Lobby is full':
        showError('Lobby is full.');
        break;
    }
  });
  
  // Handle disconnections during matches
  socket.on('disconnect', () => {
    if (currentLobby) {
      showError('Disconnected from server. Returning to main menu...');
      currentLobby = null;
      setTimeout(() => showMainMenu(), 3000);
    }
  });
}
```

---

## **🧪 TESTING INSTRUCTIONS**

### **Test Scenarios to Validate**

#### **1. Basic Matchmaking**
1. Click "Find Match" → Should show "Finding match..." loading
2. Get `lobby_joined` event → Should show lobby waiting screen
3. After 5 seconds → Should automatically start match
4. Should see kill counter showing 0/50 for both teams

#### **2. Private Lobbies**
1. Click "Create Private Lobby" → Form should appear
2. Set password and create → Should get `private_lobby_created` event
3. Share lobby ID with friend → They should be able to join with password
4. Wrong password → Should get `lobby_join_failed` error

#### **3. Match End Flow**
1. Simulate/trigger 50 kills for one team
2. Should receive `match_ended` event with scoreboard data
3. Should show results screen with winner announcement
4. Click "Play Again" → Should start new matchmaking

#### **4. Error Handling**
1. Try joining non-existent lobby → Should show error
2. Disconnect during match → Should return to main menu
3. Server restart → Should handle reconnection gracefully

---

## **📊 MONITORING & DEBUGGING**

### **Debug Information**
```javascript
// Add debug logging for development
function addDebugLogging() {
  socket.onAny((eventName, ...args) => {
    console.log(`🔍 Received: ${eventName}`, args);
  });
  
  // Log lobby state changes
  socket.on('lobby_joined', (data) => {
    console.log(`🏢 Joined lobby ${data.lobbyId} (${data.playerCount}/${data.maxPlayers})`);
  });
  
  socket.on('match_started', (data) => {
    console.log(`🚀 Match started in ${data.lobbyId}`);
  });
  
  socket.on('match_ended', (data) => {
    console.log(`🏁 Match ended: ${data.winnerTeam} wins (${data.redKills}v${data.blueKills})`);
  });
}
```

### **Health Checks**
```javascript
// Monitor server health
async function checkServerHealth() {
  try {
    const response = await fetch('/health');
    const health = await response.json();
    console.log('Server health:', health);
    
    // Update UI with lobby statistics
    updateServerStats(health.stats);
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

// Check every 30 seconds
setInterval(checkServerHealth, 30000);
```

---

## **🎯 PERFORMANCE CONSIDERATIONS**

### **Optimization Tips**
1. **Lobby Caching**: Cache lobby list to avoid repeated API calls
2. **Event Debouncing**: Debounce rapid `game:state` updates during intense gameplay
3. **Memory Management**: Clean up event listeners when leaving lobbies
4. **Asset Preloading**: Preload match result animations during gameplay
5. **Network Efficiency**: Batch UI updates to reduce DOM manipulation

### **Memory Management**
```javascript
function cleanupLobby() {
  // Remove lobby-specific event listeners
  socket.off('lobby_joined');
  socket.off('match_started');
  socket.off('match_ended');
  
  // Clear lobby data
  currentLobby = null;
  
  // Reset UI state
  hideAllLobbyScreens();
}
```

---

## **📚 SUMMARY CHECKLIST**

### **✅ Frontend Implementation Checklist**

#### **🔄 Migration Tasks**
- [ ] Remove automatic game joining on authentication
- [ ] Add main menu with matchmaking options
- [ ] Implement `find_match` event emission
- [ ] Create lobby waiting screen
- [ ] Add match results screen

#### **🎮 New Features**
- [ ] Kill counter HUD (0/50 progress)
- [ ] Private lobby creation form
- [ ] Join lobby by ID functionality
- [ ] Match end celebration/scoreboard
- [ ] Error handling for all matchmaking scenarios

#### **🔧 Technical Updates**
- [ ] Update event listeners for new lobby events
- [ ] Add proper cleanup for lobby state
- [ ] Implement debug logging for development
- [ ] Add server health monitoring
- [ ] Update CSS for new UI screens

#### **🧪 Testing Requirements**
- [ ] Test basic matchmaking flow
- [ ] Test private lobby creation and joining
- [ ] Test match end scenarios
- [ ] Test error handling and edge cases
- [ ] Test with multiple players simultaneously

---

**🎮 The backend is fully ready and tested. Once the frontend implements these changes, Trespasser will support unlimited concurrent lobbies with proper matchmaking, victory conditions, and match end flow! 🚀**
