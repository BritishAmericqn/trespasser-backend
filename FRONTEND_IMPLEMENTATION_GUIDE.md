# 🎮 Frontend Implementation Guide - Server Browser & Friend System

## ✅ STATUS: VERIFIED WORKING & READY FOR FRONTEND

**All backend features have been tested and proven to work correctly!**

## Quick Start: What's New

The backend now supports:
- **Server Browser** - See and join available games ✅ TESTED
- **Private Lobbies** - Password-protected games for friends ✅ TESTED
- **Join by ID** - Share lobby codes with friends ✅ TESTED
- **Mid-Game Joining** - Join matches already in progress ✅ TESTED
- **Lobby Filtering** - Filter by private/full/in-progress ✅ TESTED

---

## 📤 Events to EMIT (Frontend → Backend)

### 1. Quickplay (Unchanged)
```javascript
// Automatically find or create a game
socket.emit('find_match', {
  gameMode: 'deathmatch'  // Optional, defaults to 'deathmatch'
});
```

### 2. Get Lobby List (NEW)
```javascript
// Get list of available lobbies for server browser
socket.emit('get_lobby_list', {
  showPrivate: false,     // Include private lobbies (default: false)
  showFull: false,        // Include full lobbies (default: false)
  showInProgress: false,  // Include games in progress (default: false)
  gameMode: 'deathmatch'  // Filter by game mode (optional)
});

// Examples:
// Show all public lobbies that aren't full
socket.emit('get_lobby_list');

// Show everything including private and in-progress games
socket.emit('get_lobby_list', { 
  showPrivate: true, 
  showFull: true, 
  showInProgress: true 
});
```

### 3. Create Private Lobby (NEW)
```javascript
// Create a password-protected lobby for friends
socket.emit('create_private_lobby', {
  password: 'secret123',    // Required for private
  maxPlayers: 4,           // 1-8, defaults to 8
  gameMode: 'deathmatch',  // Optional
  mapName: 'yourmap2'      // Optional
});
```

### 4. Join Specific Lobby (NEW)
```javascript
// Join a lobby by ID (for friends or server browser)
socket.emit('join_lobby', {
  lobbyId: 'private_abc123_xyz789',  // Required
  password: 'secret123'               // Required only for private lobbies
});
```

### 5. Leave Current Lobby
```javascript
// Leave the current lobby
socket.emit('leave_lobby');
```

---

## 📥 Events to LISTEN FOR (Backend → Frontend)

### 1. Lobby List Response (NEW)
```javascript
socket.on('lobby_list', (data) => {
  console.log(`Found ${data.totalCount} lobbies`);
  
  data.lobbies.forEach(lobby => {
    console.log({
      id: lobby.id,                    // Lobby ID to join
      playerCount: lobby.playerCount,  // Current players
      maxPlayers: lobby.maxPlayers,    // Max capacity
      gameMode: lobby.gameMode,        // Game mode
      status: lobby.status,            // 'waiting'|'playing'|'finished'
      isPrivate: lobby.isPrivate,      // Private lobby?
      passwordRequired: lobby.passwordRequired,  // Needs password?
      mapName: lobby.mapName,          // Map being played
      createdAt: lobby.createdAt,      // When created (timestamp)
      lastActivity: lobby.lastActivity // Last activity (timestamp)
    });
  });
  
  // Update your server browser UI
  updateServerBrowser(data.lobbies);
});
```

### 2. Successfully Joined Lobby
```javascript
socket.on('lobby_joined', (data) => {
  console.log(`Joined lobby: ${data.lobbyId}`);
  console.log(`Players: ${data.playerCount}/${data.maxPlayers}`);
  console.log(`Status: ${data.status}`);  // 'waiting' or 'playing'
  
  if (data.isInProgress) {
    console.log('Joining game already in progress!');
    // Player will spawn with protection
  }
  
  // Show lobby/waiting room UI
  showLobbyScreen(data);
});
```

### 3. Private Lobby Created (NEW)
```javascript
socket.on('private_lobby_created', (data) => {
  console.log(`Created private lobby: ${data.lobbyId}`);
  console.log(`Share this code with friends: ${data.inviteCode}`);
  
  // Show invite code to user
  displayInviteCode(data.inviteCode);
  
  // Enable copy-to-clipboard
  copyToClipboard(data.inviteCode);
});
```

### 4. Match Starting/Started
```javascript
// Match is about to start (3-second countdown)
socket.on('match_starting', (data) => {
  console.log(`Match starting in ${data.countdown} seconds!`);
  showCountdown(data.countdown);
});

// Match has started
socket.on('match_started', (data) => {
  console.log(`Match started! First to ${data.killTarget} kills wins`);
  
  if (data.isLateJoin) {
    console.log('You joined mid-game with spawn protection!');
    showNotification('Spawn Protection Active: 3 seconds');
  }
  
  // Switch from lobby to game UI
  startGame(data);
});
```

### 5. Error Handlers
```javascript
// Failed to join lobby
socket.on('lobby_join_failed', (data) => {
  console.error(`Failed to join: ${data.reason}`);
  // Reasons: 'Lobby not found', 'Invalid password', 'Lobby is full'
  showError(data.reason);
});

// Failed to create lobby
socket.on('lobby_creation_failed', (data) => {
  console.error(`Failed to create: ${data.reason}`);
  showError(data.reason);
});

// Matchmaking failed
socket.on('matchmaking_failed', (data) => {
  console.error(`Matchmaking failed: ${data.reason}`);
  showError(data.reason);
});
```

### 6. Existing Game Events (Unchanged)
```javascript
// These work exactly the same within lobbies
socket.on('player:joined', (playerData) => { /* ... */ });
socket.on('game:state', (gameState) => { /* ... */ });
socket.on('match_ended', (results) => { /* ... */ });
// etc...
```

---

## 🎨 UI Components Needed

### 1. Main Menu
```javascript
// Main menu with all options
function MainMenu() {
  return (
    <div className="main-menu">
      <button onClick={quickPlay}>Quick Play</button>
      <button onClick={showServerBrowser}>Browse Servers</button>
      <button onClick={showCreatePrivate}>Create Private Game</button>
      <button onClick={showJoinPrivate}>Join Private Game</button>
    </div>
  );
}
```

### 2. Server Browser
```javascript
function ServerBrowser() {
  const [lobbies, setLobbies] = useState([]);
  const [filters, setFilters] = useState({
    showPrivate: false,
    showFull: false,
    showInProgress: false
  });
  
  // Request lobby list
  const refreshLobbies = () => {
    socket.emit('get_lobby_list', filters);
  };
  
  // Listen for lobby list
  useEffect(() => {
    socket.on('lobby_list', (data) => {
      setLobbies(data.lobbies);
    });
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(refreshLobbies, 5000);
    return () => clearInterval(interval);
  }, [filters]);
  
  return (
    <div className="server-browser">
      <div className="filters">
        <label>
          <input 
            type="checkbox" 
            checked={filters.showPrivate}
            onChange={(e) => setFilters({...filters, showPrivate: e.target.checked})}
          />
          Show Private
        </label>
        <label>
          <input 
            type="checkbox" 
            checked={filters.showFull}
            onChange={(e) => setFilters({...filters, showFull: e.target.checked})}
          />
          Show Full
        </label>
        <label>
          <input 
            type="checkbox" 
            checked={filters.showInProgress}
            onChange={(e) => setFilters({...filters, showInProgress: e.target.checked})}
          />
          Show In Progress
        </label>
      </div>
      
      <div className="lobby-list">
        {lobbies.map(lobby => (
          <LobbyCard 
            key={lobby.id}
            lobby={lobby}
            onJoin={() => joinLobby(lobby)}
          />
        ))}
      </div>
      
      <button onClick={refreshLobbies}>Refresh</button>
    </div>
  );
}
```

### 3. Lobby Card Component
```javascript
function LobbyCard({ lobby, onJoin }) {
  const canJoin = lobby.playerCount < lobby.maxPlayers;
  const needsPassword = lobby.passwordRequired;
  
  return (
    <div className={`lobby-card ${lobby.status}`}>
      <div className="lobby-info">
        <h3>{lobby.gameMode}</h3>
        <p>Players: {lobby.playerCount}/{lobby.maxPlayers}</p>
        <p>Status: {lobby.status}</p>
        {lobby.isPrivate && <span className="badge">Private</span>}
        {needsPassword && <span className="badge">🔒</span>}
      </div>
      
      <button 
        onClick={onJoin}
        disabled={!canJoin && !filters.showFull}
      >
        {lobby.status === 'playing' ? 'Join In Progress' : 'Join'}
      </button>
    </div>
  );
}
```

### 4. Private Lobby Creation
```javascript
function CreatePrivateLobby() {
  const [settings, setSettings] = useState({
    password: '',
    maxPlayers: 8,
    gameMode: 'deathmatch'
  });
  
  const createLobby = () => {
    socket.emit('create_private_lobby', settings);
  };
  
  // Listen for creation success
  useEffect(() => {
    socket.on('private_lobby_created', (data) => {
      showInviteScreen(data.inviteCode);
    });
  }, []);
  
  return (
    <div className="create-private">
      <input 
        type="password"
        placeholder="Lobby Password"
        value={settings.password}
        onChange={(e) => setSettings({...settings, password: e.target.value})}
      />
      
      <select 
        value={settings.maxPlayers}
        onChange={(e) => setSettings({...settings, maxPlayers: parseInt(e.target.value)})}
      >
        {[2,3,4,5,6,7,8].map(n => (
          <option key={n} value={n}>{n} Players</option>
        ))}
      </select>
      
      <button onClick={createLobby}>Create Private Game</button>
    </div>
  );
}
```

### 5. Join Private by Code
```javascript
function JoinPrivateLobby() {
  const [lobbyId, setLobbyId] = useState('');
  const [password, setPassword] = useState('');
  
  const joinLobby = () => {
    socket.emit('join_lobby', { lobbyId, password });
  };
  
  return (
    <div className="join-private">
      <input 
        type="text"
        placeholder="Lobby Code (e.g., private_abc123_xyz789)"
        value={lobbyId}
        onChange={(e) => setLobbyId(e.target.value)}
      />
      
      <input 
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      
      <button onClick={joinLobby}>Join Game</button>
    </div>
  );
}
```

### 6. Lobby/Waiting Room
```javascript
function LobbyWaitingRoom({ lobbyData }) {
  return (
    <div className="waiting-room">
      <h2>Lobby: {lobbyData.lobbyId}</h2>
      <p>Players: {lobbyData.playerCount}/{lobbyData.maxPlayers}</p>
      
      {lobbyData.status === 'waiting' ? (
        <p>Waiting for players... Match starts at 2+ players</p>
      ) : (
        <p>Match in progress - Joining...</p>
      )}
      
      <button onClick={() => socket.emit('leave_lobby')}>
        Leave Lobby
      </button>
    </div>
  );
}
```

---

## 🔄 Complete Flow Examples

### Example 1: Quick Play
```javascript
// User clicks "Quick Play"
socket.emit('find_match');

// Server responds
socket.on('lobby_joined', (data) => {
  showWaitingRoom(data);
});

socket.on('match_started', (data) => {
  startGame();
});
```

### Example 2: Browse and Join
```javascript
// User opens server browser
socket.emit('get_lobby_list');

socket.on('lobby_list', (data) => {
  displayLobbies(data.lobbies);
});

// User clicks join on a lobby
socket.emit('join_lobby', { 
  lobbyId: selectedLobby.id 
});

socket.on('lobby_joined', (data) => {
  if (data.isInProgress) {
    // Joining mid-game
    startGame();
  } else {
    showWaitingRoom(data);
  }
});
```

### Example 3: Create and Share Private Game
```javascript
// Host creates private game
socket.emit('create_private_lobby', {
  password: 'friends123',
  maxPlayers: 4
});

socket.on('private_lobby_created', (data) => {
  // Show code to share
  displayShareCode(data.inviteCode);
  // Example: "Share this code: private_meednwtc_jpjnib"
});

// Friend joins with code
socket.emit('join_lobby', {
  lobbyId: 'private_meednwtc_jpjnib',
  password: 'friends123'
});

socket.on('lobby_joined', (data) => {
  showWaitingRoom(data);
});
```

---

## 🛡️ Important Implementation Notes

### 1. Connection Flow
```javascript
// On initial connection, DON'T auto-join a game
socket.on('connect', () => {
  console.log('Connected to server');
  // Show main menu, not game
  showMainMenu();
});
```

### 2. Error Handling
```javascript
// Always handle join failures
socket.on('lobby_join_failed', (data) => {
  if (data.reason === 'Invalid password') {
    promptForPassword();
  } else if (data.reason === 'Lobby is full') {
    showError('Game is full');
  } else if (data.reason === 'Lobby not found') {
    showError('Game no longer exists');
  }
});
```

### 3. Mid-Game Join Handling
```javascript
socket.on('lobby_joined', (data) => {
  if (data.isInProgress) {
    // Game already started
    console.log('Joining game in progress');
    // Will receive match_started with isLateJoin flag
  } else {
    // Normal lobby waiting
    showWaitingRoom(data);
  }
});

socket.on('match_started', (data) => {
  if (data.isLateJoin) {
    // Player joined mid-game
    showNotification('Spawn Protection: 3 seconds');
  }
  startGame(data);
});
```

### 4. Auto-Refresh Server Browser
```javascript
// Refresh lobby list periodically
useEffect(() => {
  const refreshInterval = setInterval(() => {
    if (isServerBrowserOpen) {
      socket.emit('get_lobby_list', currentFilters);
    }
  }, 5000); // Every 5 seconds
  
  return () => clearInterval(refreshInterval);
}, [isServerBrowserOpen, currentFilters]);
```

---

## ✅ Testing Checklist

Before going live, test these scenarios:

1. **Server Browser**
   - [ ] Can see list of available lobbies
   - [ ] Filters work (private/full/in-progress)
   - [ ] Can join from browser
   - [ ] List auto-refreshes

2. **Private Lobbies**
   - [ ] Can create with password
   - [ ] Invite code displays and copies
   - [ ] Friends can join with code
   - [ ] Wrong password shows error

3. **Mid-Game Joining**
   - [ ] Can join games in progress
   - [ ] Spawn protection notification shows
   - [ ] Correct status displayed

4. **Error Cases**
   - [ ] Full lobby shows appropriate message
   - [ ] Invalid lobby code handled
   - [ ] Network disconnection handled

---

## 📚 Quick Reference

### Events to Emit
- `find_match` - Quick play
- `get_lobby_list` - Get available lobbies
- `create_private_lobby` - Create private game
- `join_lobby` - Join specific lobby
- `leave_lobby` - Leave current lobby

### Events to Listen For
- `lobby_list` - List of lobbies
- `lobby_joined` - Successfully joined
- `private_lobby_created` - Private lobby created
- `match_starting` - Countdown
- `match_started` - Game begins
- `lobby_join_failed` - Join error
- `matchmaking_failed` - Matchmaking error

---

## 🎉 You're Ready!

With these events and components, you can implement:
- Full server browser with filtering
- Private games with password protection
- Friend invites via lobby codes
- Mid-game joining with spawn protection
- Proper error handling

The backend is fully functional and tested. Just follow this guide to integrate!
