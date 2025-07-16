const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  socket.emit('player:join', {
    username: 'ReflectionTest'
  });
});

socket.on('game:joined', (data) => {
  console.log('✅ Joined game as player:', data.playerId);
  
  setTimeout(() => {
    console.log('\n🎯 Testing REFLECTION angles (grenades should bounce AWAY)...\n');
    
    // Test 1: 45° angle should reflect at 45° away
    console.log('Test 1: 45° angle - should bounce away at 45°');
    socket.emit('weapon:fire', {
      weaponType: 'grenade',
      position: { x: 100, y: 135 },
      direction: Math.PI * 0.25, // 45° down-right
      chargeLevel: 3, // 60 px/s
      isADS: false,
      timestamp: Date.now(),
      sequence: 1
    });
    
    // Test 2: Direct perpendicular hit
    setTimeout(() => {
      console.log('\nTest 2: Perpendicular hit - should bounce straight back');
      socket.emit('weapon:fire', {
        weaponType: 'grenade',
        position: { x: 240, y: 135 },
        direction: 0, // Straight right
        chargeLevel: 3, // 60 px/s
        isADS: false,
        timestamp: Date.now(),
        sequence: 2
      });
    }, 2000);
    
    // Test 3: Shallow angle
    setTimeout(() => {
      console.log('\nTest 3: Shallow 15° angle - should reflect at shallow angle');
      socket.emit('weapon:fire', {
        weaponType: 'grenade',
        position: { x: 100, y: 50 },
        direction: Math.PI * 0.08, // ~15° down
        chargeLevel: 4, // 78 px/s
        isADS: false,
        timestamp: Date.now(),
        sequence: 3
      });
    }, 4000);
    
    // Test 4: Steep angle
    setTimeout(() => {
      console.log('\nTest 4: Steep 75° angle - should reflect steeply');
      socket.emit('weapon:fire', {
        weaponType: 'grenade',
        position: { x: 50, y: 200 },
        direction: Math.PI * 0.42, // ~75° down-right
        chargeLevel: 2, // 42 px/s
        isADS: false,
        timestamp: Date.now(),
        sequence: 4
      });
    }, 6000);
    
    // Monitor grenades and their angles
    let frameCount = 0;
    socket.on('game:state', (state) => {
      if (state.projectiles && frameCount % 30 === 0) { // Log every 30 frames
        const grenades = Object.values(state.projectiles).filter(p => p.type === 'grenade');
        if (grenades.length > 0) {
          console.log('\n📊 Grenade trajectories:');
          grenades.forEach((g, i) => {
            const angle = Math.atan2(g.velocity.y, g.velocity.x) * 180 / Math.PI;
            const speed = Math.sqrt(g.velocity.x ** 2 + g.velocity.y ** 2);
            console.log(`  ${i+1}: Angle: ${angle.toFixed(1)}° Speed: ${speed.toFixed(1)} px/s`);
          });
        }
      }
      frameCount++;
    });
    
    // Exit after tests
    setTimeout(() => {
      console.log('\n✅ Tests complete!');
      console.log('\nExpected behavior:');
      console.log('- Grenades bounce AWAY from walls, not back at player');
      console.log('- 45° in = 45° out (mirrored)');
      console.log('- Perpendicular hits bounce straight back');
      console.log('- Shallow angles stay shallow');
      console.log('- Angle of incidence = angle of reflection');
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