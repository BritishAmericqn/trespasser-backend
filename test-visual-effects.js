// Quick test to verify visual effects are working
const io = require('socket.io-client');

const socket = io('http://localhost:5173', {
  transports: ['websocket']
});

let fireCount = 0;
let eventCount = 0;

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  // Join a test lobby
  socket.emit('lobby:create', {
    name: 'Visual Effects Test',
    maxPlayers: 2,
    isPublic: false
  });
});

socket.on('lobby:created', (lobby) => {
  console.log('✅ Lobby created:', lobby.id);
  
  // Join the game
  socket.emit('player:join', {
    loadout: {
      primary: 'rifle',
      secondary: 'pistol',
      equipment: ['grenade', 'grenade']
    },
    playerName: 'TestPlayer'
  });
});

socket.on('player:join:success', () => {
  console.log('✅ Joined game successfully');
  console.log('\n🔫 Testing weapon fire events...\n');
  
  // Fire 10 shots rapidly to test rate limiting
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      fireCount++;
      console.log(`→ Sending weapon:fire #${fireCount}`);
      socket.emit('weapon:fire', {
        weaponType: 'rifle',
        position: { x: 100, y: 100 },
        direction: 0,
        timestamp: Date.now(),
        sequence: i
      });
    }, i * 50); // 50ms apart = 20 shots/sec (faster than rifle rate)
  }
  
  // Check results after 2 seconds
  setTimeout(() => {
    console.log('\n📊 RESULTS:');
    console.log(`Shots fired: ${fireCount}`);
    console.log(`Events received: ${eventCount}`);
    console.log(`Rate limited: ${fireCount - eventCount}`);
    
    if (eventCount > 0) {
      console.log('\n✅ Visual effects should be working!');
    } else {
      console.log('\n❌ No events received - visual effects broken!');
    }
    
    process.exit(0);
  }, 2000);
});

// Count events that trigger visual effects
socket.on('weapon:hit', (data) => {
  eventCount++;
  console.log(`  ← weapon:hit received (event #${eventCount})`);
});

socket.on('weapon:miss', (data) => {
  eventCount++;
  console.log(`  ← weapon:miss received (event #${eventCount})`);
});

socket.on('weapon:fired', (data) => {
  console.log(`  ← weapon:fired received`);
});

socket.on('weapon:rate_limited', (data) => {
  console.log(`  ← weapon:rate_limited (next shot: ${data.nextFireTime})`);
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});
