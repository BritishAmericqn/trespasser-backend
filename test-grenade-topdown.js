const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  // Join game
  socket.emit('player:join', {
    username: 'GrenadePhysicsTest'
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
        console.log(`   Distance: ${grenade.traveledDistance.toFixed(1)}/${grenade.range}`);
      });
      console.log('---');
    }
  }
});

socket.on('game:joined', (data) => {
  console.log('✅ Joined game as player:', data.playerId);
  
  setTimeout(() => {
    console.log('\n🎯 Testing TOP-DOWN grenade physics (no gravity)...\n');
    
    // Test 1: Low charge horizontal throw
    console.log('Test 1: Charge 1 horizontal throw (5 px/s)');
    socket.emit('weapon:fire', {
      weaponType: 'grenade',
      position: { x: 100, y: 135 },
      direction: 0, // Right
      chargeLevel: 1,
      isADS: false,
      timestamp: Date.now(),
      sequence: 1
    });
    
    // Test 2: Medium charge diagonal throw
    setTimeout(() => {
      console.log('\nTest 2: Charge 3 diagonal throw (13 px/s)');
      socket.emit('weapon:fire', {
        weaponType: 'grenade',
        position: { x: 200, y: 135 },
        direction: Math.PI / 4, // 45 degrees
        chargeLevel: 3,
        isADS: false,
        timestamp: Date.now(),
        sequence: 2
      });
    }, 1500);
    
    // Test 3: High charge at wall
    setTimeout(() => {
      console.log('\nTest 3: Charge 5 at wall (21 px/s) - should bounce');
      socket.emit('weapon:fire', {
        weaponType: 'grenade',
        position: { x: 400, y: 100 },
        direction: Math.PI / 2, // Down towards wall
        chargeLevel: 5,
        isADS: false,
        timestamp: Date.now(),
        sequence: 3
      });
    }, 3000);
    
    // Test 4: Corner shot
    setTimeout(() => {
      console.log('\nTest 4: Corner shot to test phasing fix');
      socket.emit('weapon:fire', {
        weaponType: 'grenade',
        position: { x: 50, y: 50 },
        direction: Math.PI * 0.25, // 45 degrees towards corner
        chargeLevel: 4,
        isADS: false,
        timestamp: Date.now(),
        sequence: 4
      });
    }, 4500);
    
    // Exit after tests
    setTimeout(() => {
      console.log('\n✅ Tests complete!');
      console.log('Expected behavior:');
      console.log('- Grenades roll on ground (no gravity arc)');
      console.log('- Gradual slowdown from friction');
      console.log('- Clean bounces off walls');
      console.log('- No phasing through corners');
      process.exit(0);
    }, 8000);
  }, 1000);
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
}); 