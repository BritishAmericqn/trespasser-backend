// Comprehensive test for ALL weapon events (bullets, grenades, etc)
const io = require('socket.io-client');

const socket = io('http://localhost:5173', {
  transports: ['websocket']
});

let events = {
  // Weapon events
  'weapon:fired': 0,
  'weapon:hit': 0,
  'weapon:miss': 0,
  // Projectile events
  'projectile:created': 0,
  'projectile:updated': 0,
  'projectile:exploded': 0,
  // Grenade events
  'grenade:thrown': 0,
  // Wall events
  'wall:damaged': 0,
  'wall:destroyed': 0
};

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  socket.emit('lobby:create', {
    name: 'Weapon Event Test',
    maxPlayers: 2,
    isPublic: false
  });
});

socket.on('lobby:created', (lobby) => {
  console.log('✅ Lobby created');
  
  socket.emit('player:join', {
    loadout: {
      primary: 'rifle',
      secondary: 'pistol',
      equipment: ['grenade', 'grenade']
    },
    playerName: 'EventTest'
  });
});

socket.on('player:join:success', () => {
  console.log('✅ Joined game');
  console.log('\n=== TESTING ALL WEAPON EVENTS ===\n');
  
  // Test 1: Regular weapon fire (rifle)
  console.log('📍 TEST 1: Firing rifle via mouse input...');
  socket.emit('player:input', {
    keys: { w: false, a: false, s: false, d: false },
    mouse: {
      x: 960, y: 540,
      buttons: 1,  // Left click
      leftPressed: true,
      rightPressed: false
    },
    sequence: 1,
    timestamp: Date.now()
  });
  
  // Test 2: Grenade throw via G key
  setTimeout(() => {
    console.log('\n📍 TEST 2: Throwing grenade via G key...');
    socket.emit('weapon:switch', { weaponType: 'grenade' });
    
    setTimeout(() => {
      socket.emit('player:input', {
        keys: { g: true },  // G key
        mouse: { x: 960, y: 540, buttons: 0 },
        sequence: 2,
        timestamp: Date.now()
      });
    }, 100);
  }, 500);
  
  // Test 3: Grenade throw via mouse click
  setTimeout(() => {
    console.log('\n📍 TEST 3: Throwing grenade via mouse click...');
    socket.emit('player:input', {
      keys: {},
      mouse: {
        x: 960, y: 540,
        buttons: 1,
        leftPressed: true
      },
      sequence: 3,
      timestamp: Date.now()
    });
  }, 1000);
  
  // Check results
  setTimeout(() => {
    console.log('\n=== RESULTS ===');
    console.log('Event Type              | Count');
    console.log('------------------------|-------');
    for (const [event, count] of Object.entries(events)) {
      const status = count > 0 ? '✅' : '❌';
      console.log(`${event.padEnd(23)} | ${count} ${status}`);
    }
    console.log('\n=== ANALYSIS ===');
    
    // Check critical events
    if (events['weapon:fired'] === 0) {
      console.log('❌ CRITICAL: No weapon:fired events (affects muzzle flash)');
    }
    if (events['weapon:hit'] === 0 && events['weapon:miss'] === 0) {
      console.log('❌ CRITICAL: No hit/miss events (affects bullet trails)');
    }
    if (events['projectile:created'] === 0) {
      console.log('❌ CRITICAL: No projectile:created (affects grenade tracers)');
    }
    
    process.exit(0);
  }, 5000);
});

// Listen for ALL events
Object.keys(events).forEach(eventName => {
  socket.on(eventName, (data) => {
    events[eventName]++;
    if (eventName === 'projectile:updated' && events[eventName] === 1) {
      console.log(`📡 ${eventName} (first of many)`);
    } else if (eventName !== 'projectile:updated') {
      console.log(`✅ ${eventName} received!`, 
        data.id ? `ID: ${data.id}` : 
        data.playerId ? `Player: ${data.playerId.substring(0, 8)}` : '');
    }
  });
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});
