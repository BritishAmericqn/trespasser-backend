const io = require('socket.io-client');

console.log('🔍 Frontend-Backend Debug Test');
console.log('================================');

const socket = io('http://localhost:3000', {
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('✅ Connected to backend');
  console.log('🎮 Creating private lobby...');
  
  socket.emit('create_private_lobby', { gameMode: 'deathmatch' });
});

socket.on('lobby_joined', (data) => {
  console.log('🏠 Lobby joined:', data);
  console.log('🎯 Sending player:join...');
  
  socket.emit('player:join', {
    loadout: {
      primary: 'rifle',
      secondary: 'pistol', 
      support: ['grenade'],
      team: 'blue'
    },
    timestamp: Date.now()
  });
});

socket.on('game:state', (state) => {
  console.log('📊 GAME STATE RECEIVED!');
  console.log('  Players:', Object.keys(state.players || {}).length);
  console.log('  VisiblePlayers:', Object.keys(state.visiblePlayers || {}).length);
  console.log('  Walls:', Object.keys(state.walls || {}).length);
  console.log('  Vision:', !!state.vision);
  if (state.vision) {
    console.log('    Vision Type:', state.vision.type);
    console.log('    Vision Points:', state.vision.polygon?.length || 'N/A');
  }
  console.log('---');
});

socket.on('weapon:equipped', (data) => {
  console.log('🔫 Weapon equipped:', data);
});

socket.onAny((eventName, data) => {
  if (eventName !== 'game:state') {
    console.log(`📨 Event: ${eventName}`, data);
  }
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected');
  process.exit(0);
});

// Auto-exit after 10 seconds
setTimeout(() => {
  console.log('⏰ Test complete - exiting');
  process.exit(0);
}, 10000);
