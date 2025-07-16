const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  // Join game
  socket.emit('player:join', {
    username: 'ParallelWallTest'
  });
});

socket.on('game:state', (state) => {
  // Look for grenades in the state
  if (state.projectiles) {
    const grenades = Object.values(state.projectiles).filter(p => p.type === 'grenade');
    
    if (grenades.length > 0) {
      grenades.forEach(grenade => {
        const speed = Math.sqrt(grenade.velocity.x ** 2 + grenade.velocity.y ** 2);
        console.log(`🎯 Grenade ${grenade.id.substring(0, 8)}:`);
        console.log(`   Position: (${grenade.position.x.toFixed(1)}, ${grenade.position.y.toFixed(1)})`);
        console.log(`   Velocity: (${grenade.velocity.x.toFixed(1)}, ${grenade.velocity.y.toFixed(1)}) = ${speed.toFixed(1)} px/s`);
      });
      console.log('---');
    }
  }
});

socket.on('game:joined', (data) => {
  console.log('✅ Joined game as player:', data.playerId);
  
  setTimeout(() => {
    console.log('\n🎯 Testing PARALLEL WALL MOVEMENT fix...\n');
    console.log('New speeds: 10-42 px/s (doubled from 5-21)\n');
    
    // Test 1: Near-parallel angle (should slide smoothly)
    console.log('Test 1: Near-parallel angle to wall');
    socket.emit('weapon:fire', {
      weaponType: 'grenade',
      position: { x: 100, y: 50 },
      direction: Math.PI * 0.45, // ~81 degrees - almost parallel to horizontal wall
      chargeLevel: 3, // 26 px/s
      isADS: false,
      timestamp: Date.now(),
      sequence: 1
    });
    
    // Test 2: Exact parallel (should slide without sticking)
    setTimeout(() => {
      console.log('\nTest 2: Exact parallel to wall');
      socket.emit('weapon:fire', {
        weaponType: 'grenade',
        position: { x: 50, y: 100 },
        direction: Math.PI / 2, // 90 degrees - exactly parallel to vertical wall
        chargeLevel: 2, // 18 px/s
        isADS: false,
        timestamp: Date.now(),
        sequence: 2
      });
    }, 2000);
    
    // Test 3: Direct hit (should bounce normally)
    setTimeout(() => {
      console.log('\nTest 3: Direct hit for comparison');
      socket.emit('weapon:fire', {
        weaponType: 'grenade',
        position: { x: 240, y: 100 },
        direction: Math.PI / 4, // 45 degrees - direct angle
        chargeLevel: 4, // 34 px/s
        isADS: false,
        timestamp: Date.now(),
        sequence: 3
      });
    }, 4000);
    
    // Test 4: High speed parallel
    setTimeout(() => {
      console.log('\nTest 4: High speed parallel (max charge)');
      socket.emit('weapon:fire', {
        weaponType: 'grenade',
        position: { x: 100, y: 200 },
        direction: Math.PI * 0.48, // ~86 degrees
        chargeLevel: 5, // 42 px/s - max speed
        isADS: false,
        timestamp: Date.now(),
        sequence: 4
      });
    }, 6000);
    
    // Exit after tests
    setTimeout(() => {
      console.log('\n✅ Tests complete!');
      console.log('Expected behavior:');
      console.log('- Grenades slide smoothly along walls when nearly parallel');
      console.log('- No 2-pixel gap between grenade and wall');
      console.log('- Direct hits bounce normally');
      console.log('- No grenades getting stuck');
      console.log('- Speeds: 10, 18, 26, 34, 42 px/s for charges 1-5');
      process.exit(0);
    }, 10000);
  }, 1000);
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
}); 