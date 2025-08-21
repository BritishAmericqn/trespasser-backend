// Test script to verify grenade projectile events are being sent
const io = require('socket.io-client');

const socket = io('http://localhost:5173', {
  transports: ['websocket']
});

let projectileEvents = {
  created: 0,
  updated: 0,
  exploded: 0
};

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  // Create a test lobby
  socket.emit('lobby:create', {
    name: 'Grenade Event Test',
    maxPlayers: 2,
    isPublic: false
  });
});

socket.on('lobby:created', (lobby) => {
  console.log('✅ Lobby created');
  
  // Join the game with grenades
  socket.emit('player:join', {
    loadout: {
      primary: 'rifle',
      secondary: 'pistol',
      equipment: ['grenade', 'grenade']
    },
    playerName: 'GrenadeTest'
  });
});

socket.on('player:join:success', () => {
  console.log('✅ Joined game');
  console.log('\n🎆 Testing grenade throw...\n');
  
  // Equip grenade
  socket.emit('weapon:switch', { weaponType: 'grenade' });
  
  setTimeout(() => {
    // Throw grenade via G key
    console.log('🎯 Pressing G to throw grenade...');
    socket.emit('player:input', {
      keys: {
        w: false, a: false, s: false, d: false,
        g: true,  // G key pressed to throw grenade
        shift: false, ctrl: false
      },
      mouse: {
        x: 960,
        y: 540,
        buttons: 0,
        leftPressed: false,
        rightPressed: false
      },
      sequence: 1,
      timestamp: Date.now()
    });
  }, 500);
  
  // Check results after 4 seconds (grenade has 3 second fuse)
  setTimeout(() => {
    console.log('\n📊 RESULTS:');
    console.log('================================');
    console.log(`projectile:created events: ${projectileEvents.created}`);
    console.log(`projectile:updated events: ${projectileEvents.updated}`);
    console.log(`projectile:exploded events: ${projectileEvents.exploded}`);
    console.log('================================\n');
    
    if (projectileEvents.created > 0) {
      console.log('✅ SUCCESS: Backend is now sending projectile:created!');
    } else {
      console.log('❌ FAILED: Still not receiving projectile:created events');
    }
    
    if (projectileEvents.updated > 0) {
      console.log('✅ Projectile updates working');
    }
    
    if (projectileEvents.exploded > 0) {
      console.log('✅ Projectile explosion working');
    }
    
    process.exit(0);
  }, 4000);
});

// Listen for projectile events
socket.on('projectile:created', (data) => {
  projectileEvents.created++;
  console.log('🚀 PROJECTILE:CREATED received!', data);
});

socket.on('projectile:updated', (data) => {
  projectileEvents.updated++;
  // Only log first update to avoid spam
  if (projectileEvents.updated === 1) {
    console.log('📍 projectile:updated received (first of many)');
  }
});

socket.on('projectile:exploded', (data) => {
  projectileEvents.exploded++;
  console.log('💥 projectile:exploded received!', data);
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});
