const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  socket.emit('player:join', {
    username: 'PhasingTest'
  });
});

socket.on('game:joined', (data) => {
  console.log('✅ Joined game as player:', data.playerId);
  
  setTimeout(() => {
    console.log('\n🎯 Testing PHASING PREVENTION (no grenades should pass through walls)...\n');
    
    // Test 1: High speed direct hit
    console.log('Test 1: Max speed direct hit at wall');
    socket.emit('weapon:fire', {
      weaponType: 'grenade',
      position: { x: 50, y: 135 },
      direction: 0, // Straight right
      chargeLevel: 5, // 96 px/s - max speed
      isADS: false,
      timestamp: Date.now(),
      sequence: 1
    });
    
    // Test 2: High speed at thin wall edge
    setTimeout(() => {
      console.log('\nTest 2: High speed at wall edge/corner');
      socket.emit('weapon:fire', {
        weaponType: 'grenade',
        position: { x: 200, y: 70 },
        direction: Math.PI * 0.4, // Angled at corner
        chargeLevel: 5, // 96 px/s
        isADS: false,
        timestamp: Date.now(),
        sequence: 2
      });
    }, 2000);
    
    // Test 3: Multiple rapid grenades
    setTimeout(() => {
      console.log('\nTest 3: Rapid fire test (3 grenades)');
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          socket.emit('weapon:fire', {
            weaponType: 'grenade',
            position: { x: 100 + i * 20, y: 200 },
            direction: Math.PI * 1.5, // Up
            chargeLevel: 4, // 78 px/s
            isADS: false,
            timestamp: Date.now(),
            sequence: 3 + i
          });
        }, i * 200);
      }
    }, 4000);
    
    // Monitor grenades
    let frameCount = 0;
    socket.on('game:state', (state) => {
      if (state.projectiles && frameCount % 30 === 0) {
        const grenades = Object.values(state.projectiles).filter(p => p.type === 'grenade');
        if (grenades.length > 0) {
          console.log(`\n📊 Active grenades: ${grenades.length}`);
          grenades.forEach((g, i) => {
            // Check if any grenade is way outside bounds (phased through)
            if (g.position.x < -50 || g.position.x > 530 || 
                g.position.y < -50 || g.position.y > 320) {
              console.log(`  ⚠️ GRENADE ${i+1} PHASED THROUGH! Pos: (${g.position.x.toFixed(0)}, ${g.position.y.toFixed(0)})`);
            }
          });
        }
      }
      frameCount++;
    });
    
    // Exit after tests
    setTimeout(() => {
      console.log('\n✅ Tests complete!');
      console.log('\nExpected behavior:');
      console.log('- NO grenades should pass through walls');
      console.log('- All grenades should bounce properly');
      console.log('- High speed grenades (96 px/s) should still collide');
      console.log('- Corner/edge hits should work correctly');
      console.log('- No "phased through" warnings should appear');
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