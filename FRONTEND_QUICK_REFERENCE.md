# 🎮 Frontend Quick Reference - Multi-Lobby System

## **🚨 CRITICAL CHANGES**
- **NO automatic game joining** - players must use `find_match`
- **NEW victory condition** - first team to 50 kills wins
- **NEW lobby system** - each match is isolated

---

## **📤 EMIT THESE EVENTS**

### **Start Playing**
```javascript
// Replace automatic joining with this:
socket.emit('find_match', { gameMode: 'deathmatch' });
```

### **Private Lobbies**
```javascript
// Create private lobby
socket.emit('create_private_lobby', {
  password: 'secret123',
  maxPlayers: 4
});

// Join by ID
socket.emit('join_lobby', {
  lobbyId: 'lobby_id_here',
  password: 'secret123'
});
```

---

## **📥 LISTEN FOR THESE EVENTS**

### **Core Lobby Events**
```javascript
socket.on('lobby_joined', (data) => {
  // Show waiting screen: "Players: 3/8"
});

socket.on('match_started', (data) => {
  // Hide menus, show game, display kill counter
});

socket.on('match_ended', (data) => {
  // Show scoreboard with winner: data.winnerTeam
});
```

### **Error Handling**
```javascript
socket.on('matchmaking_failed', (data) => {
  // Show error: data.reason
});
```

---

## **🎨 REQUIRED UI SCREENS**

1. **Main Menu** - Find Match, Create Private, Join by ID buttons
2. **Lobby Waiting** - "Players: X/8, Waiting for match..."
3. **Kill Counter HUD** - "Red: 23/50, Blue: 31/50" with progress bars  
4. **Match Results** - Winner announcement + scoreboard
5. **Private Lobby Form** - Password, max players settings

---

## **⚡ QUICK IMPLEMENTATION**

### **1. Update Connection (REQUIRED)**
```javascript
// OLD - Remove this:
// socket.on('authenticated', () => socket.emit('player:join'));

// NEW - Use this:
socket.on('authenticated', () => showMainMenu());
```

### **2. Add Kill Counter (REQUIRED)**
```javascript
function updateKillCounter(players) {
  const redKills = Object.values(players)
    .filter(p => p.team === 'red')
    .reduce((sum, p) => sum + p.kills, 0);
  
  const blueKills = Object.values(players)
    .filter(p => p.team === 'blue')  
    .reduce((sum, p) => sum + p.kills, 0);
    
  // Update UI: Red: X/50, Blue: Y/50
}
```

### **3. Essential Event Handlers**
```javascript
socket.on('lobby_joined', (data) => showLobbyWaiting(data));
socket.on('match_started', (data) => startGame(data));
socket.on('match_ended', (data) => showResults(data));
socket.on('matchmaking_failed', (data) => showError(data.reason));
```

---

## **🧪 TEST FLOW**

1. **Authentication** → Main menu appears
2. **Click "Find Match"** → Loading screen
3. **Get matched** → Lobby waiting screen  
4. **Auto-start** → Game with kill counter
5. **Reach 50 kills** → Results screen

---

## **💡 BACKEND HEALTH CHECK**
```javascript
// Check if backend is ready
fetch('/health').then(r => r.json()).then(data => {
  console.log('Lobbies:', data.stats.totalLobbies);
  console.log('Players:', data.stats.totalPlayers);
});
```

---

**📝 See `FRONTEND_MULTI_LOBBY_INTEGRATION_GUIDE.md` for complete details!**
