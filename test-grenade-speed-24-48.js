const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  // Join game
  socket.emit('player:join', {
    username: 'GrenadeSpeed24-48Test'
  });
});

socket.on('game:joined', (data) => {
  console.log('✅ Joined game as player:', data.playerId);
  
  setTimeout(() => {
    console.log('\n🎯 Testing NEW grenade speeds: 24-48 px/s\n');
    
    // Fire grenades at each charge level
    for (let charge = 1; charge <= 5; charge++) {
      setTimeout(() => {
        const expectedSpeed = 18 + (charge * 6); // Should be 24, 30, 36, 42, 48
        console.log(`\nTest ${charge}: Charge level ${charge} (expecting ${expectedSpeed} px/s)`);
        
        socket.emit('weapon:fire', {
          weaponType: 'grenade',
          position: { x: 50 + (charge * 80), y: 135 },
          direction: 0, // Straight right
          chargeLevel: charge,
          isADS: false,
          timestamp: Date.now(),
          sequence: charge
        });
      }, (charge - 1) * 1000);
    }
    
    // Monitor speeds
    let lastPrint = 0;
    socket.on('game:state', (state) => {
      if (state.projectiles && Date.now() - lastPrint > 500) {
        const grenades = Object.values(state.projectiles).filter(p => p.type === 'grenade');
        
        if (grenades.length > 0) {
          console.log('\n📊 Current grenade speeds:');
          grenades.forEach(grenade => {
            const speed = Math.sqrt(grenade.velocity.x ** 2 + grenade.velocity.y ** 2);
            console.log(`   Grenade: ${speed.toFixed(1)} px/s`);
          });
          lastPrint = Date.now();
        }
      }
    });
    
    // Exit after tests
    setTimeout(() => {
      console.log('\n✅ Tests complete!');
      console.log('\nExpected speeds by charge level:');
      console.log('Charge 1: 24 px/s (no charge)');
      console.log('Charge 2: 30 px/s');
      console.log('Charge 3: 36 px/s');
      console.log('Charge 4: 42 px/s');
      console.log('Charge 5: 48 px/s (fully charged)');
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