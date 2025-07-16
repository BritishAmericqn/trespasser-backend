const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  socket.emit('player:join', {
    username: 'GrenadeBounceTest'
  });
});

socket.on('game:joined', (data) => {
  console.log('✅ Joined game as player:', data.playerId);
  
  setTimeout(() => {
    console.log('\n🎯 Testing IMPROVED bounce physics (24-96 px/s)...\n');
    
    // Test 1: Direct wall hit
    console.log('Test 1: Direct wall hit (45° angle)');
    socket.emit('weapon:fire', {
      weaponType: 'grenade',
      position: { x: 100, y: 100 },
      direction: Math.PI * 0.25, // 45 degrees
      chargeLevel: 3, // 60 px/s
      isADS: false,
      timestamp: Date.now(),
      sequence: 1
    });
    
    // Test 2: Corner bounce
    setTimeout(() => {
      console.log('\nTest 2: Corner bounce test');
      socket.emit('weapon:fire', {
        weaponType: 'grenade',
        position: { x: 240, y: 50 },
        direction: Math.PI * 0.6, // Aimed at corner
        chargeLevel: 2, // 42 px/s
        isADS: false,
        timestamp: Date.now(),
        sequence: 2
      });
    }, 2000);
    
    // Test 3: High speed wall hit
    setTimeout(() => {
      console.log('\nTest 3: High speed wall hit (max charge)');
      socket.emit('weapon:fire', {
        weaponType: 'grenade',
        position: { x: 240, y: 200 },
        direction: Math.PI, // Left
        chargeLevel: 5, // 96 px/s - max speed
        isADS: false,
        timestamp: Date.now(),
        sequence: 3
      });
    }, 4000);
    
    // Test 4: Shallow angle bounce
    setTimeout(() => {
      console.log('\nTest 4: Shallow angle (should slide smoothly)');
      socket.emit('weapon:fire', {
        weaponType: 'grenade',
        position: { x: 100, y: 230 },
        direction: Math.PI * 0.1, // Very shallow angle
        chargeLevel: 4, // 78 px/s
        isADS: false,
        timestamp: Date.now(),
        sequence: 4
      });
    }, 6000);
    
    // Monitor grenades
    let frameCount = 0;
    socket.on('game:state', (state) => {
      if (state.projectiles && frameCount % 20 === 0) { // Log every 20 frames
        const grenades = Object.values(state.projectiles).filter(p => p.type === 'grenade');
        if (grenades.length > 0) {
          console.log('\n📊 Active grenades:');
          grenades.forEach((g, i) => {
            const speed = Math.sqrt(g.velocity.x ** 2 + g.velocity.y ** 2);
            console.log(`  ${i+1}: Pos(${g.position.x.toFixed(0)},${g.position.y.toFixed(0)}) Speed: ${speed.toFixed(1)} px/s`);
          });
        }
      }
      frameCount++;
    });
    
    // Exit after tests
    setTimeout(() => {
      console.log('\n✅ Tests complete!');
      console.log('\nExpected behavior:');
      console.log('- Natural bounce angles (not erratic)');
      console.log('- Clean corner bounces');
      console.log('- No wall sticking');
      console.log('- Smooth sliding on shallow angles');
      console.log('- No phasing at 96 px/s');
      console.log('\nSpeed reference:');
      console.log('- Charge 1: 24 px/s');
      console.log('- Charge 2: 42 px/s');
      console.log('- Charge 3: 60 px/s');
      console.log('- Charge 4: 78 px/s');
      console.log('- Charge 5: 96 px/s');
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