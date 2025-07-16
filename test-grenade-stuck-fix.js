const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  socket.emit('player:join', {
    username: 'StuckBounceTest'
  });
});

socket.on('game:joined', (data) => {
  console.log('✅ Joined game as player:', data.playerId);
  
  setTimeout(() => {
    console.log('\n🎯 Testing STUCK BOUNCE FIX (grenades should not oscillate at walls)...\n');
    
    // Test 1: Direct perpendicular hit
    console.log('Test 1: Direct perpendicular hit - should bounce cleanly');
    socket.emit('weapon:fire', {
      weaponType: 'grenade',
      position: { x: 100, y: 135 },
      direction: 0, // Straight right
      chargeLevel: 3, // 60 px/s
      isADS: false,
      timestamp: Date.now(),
      sequence: 1
    });
    
    // Test 2: Very shallow angle
    setTimeout(() => {
      console.log('\nTest 2: Very shallow angle - should slide along wall');
      socket.emit('weapon:fire', {
        weaponType: 'grenade',
        position: { x: 50, y: 80 },
        direction: Math.PI * 0.05, // ~9 degrees - very shallow
        chargeLevel: 2, // 42 px/s
        isADS: false,
        timestamp: Date.now(),
        sequence: 2
      });
    }, 2000);
    
    // Test 3: Corner shot
    setTimeout(() => {
      console.log('\nTest 3: Corner shot - should not get stuck at corner');
      socket.emit('weapon:fire', {
        weaponType: 'grenade',
        position: { x: 50, y: 50 },
        direction: Math.PI * 0.25, // 45 degrees to corner
        chargeLevel: 4, // 78 px/s
        isADS: false,
        timestamp: Date.now(),
        sequence: 3
      });
    }, 4000);
    
    // Monitor grenades for stuck behavior
    let positionHistory = new Map();
    let stuckCount = new Map();
    
    socket.on('game:state', (state) => {
      if (state.projectiles) {
        const grenades = Object.values(state.projectiles).filter(p => p.type === 'grenade');
        
        grenades.forEach(grenade => {
          const id = grenade.id;
          const pos = `${grenade.position.x.toFixed(1)},${grenade.position.y.toFixed(1)}`;
          
          // Track position history
          if (!positionHistory.has(id)) {
            positionHistory.set(id, []);
            stuckCount.set(id, 0);
          }
          
          const history = positionHistory.get(id);
          history.push(pos);
          
          // Keep last 10 positions
          if (history.length > 10) {
            history.shift();
          }
          
          // Check if oscillating (position repeating)
          if (history.length >= 4) {
            const recent = history.slice(-4);
            if (recent[0] === recent[2] && recent[1] === recent[3]) {
              stuckCount.set(id, stuckCount.get(id) + 1);
              if (stuckCount.get(id) === 5) { // Only report once
                console.log(`\n⚠️  GRENADE STUCK OSCILLATING!`);
                console.log(`   ID: ${id.substring(0, 8)}`);
                console.log(`   Pattern: ${recent[0]} ↔ ${recent[1]}`);
              }
            }
          }
        });
      }
    });
    
    // Exit after tests
    setTimeout(() => {
      console.log('\n✅ Tests complete!');
      console.log('\nExpected behavior:');
      console.log('- Grenades bounce away cleanly from walls');
      console.log('- No oscillating back and forth');
      console.log('- Shallow angles slide smoothly');
      console.log('- Corners don\'t trap grenades');
      console.log('- No "STUCK OSCILLATING" warnings should appear');
      
      // Report any stuck grenades
      let anyStuck = false;
      stuckCount.forEach((count, id) => {
        if (count > 0) {
          anyStuck = true;
          console.log(`\n❌ Grenade ${id.substring(0, 8)} oscillated ${count} times`);
        }
      });
      
      if (!anyStuck) {
        console.log('\n✅ No stuck grenades detected!');
      }
      
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