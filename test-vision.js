const io = require('socket.io-client');

// Create two test clients
const player1 = io('http://localhost:3000');
const player2 = io('http://localhost:3000');

let p1State = null;
let p2State = null;
let p1SeesP2 = false;
let p2SeesP1 = false;

console.log('🔍 VISION SYSTEM TEST');
console.log('====================');
console.log('Testing fog of war and player visibility...\n');

// Player 1 handlers
player1.on('connect', () => {
  console.log('✅ Player 1 connected');
});

player1.on('game:state', (state) => {
  const players = Object.fromEntries(state.players || []);
  p1State = players[player1.id];
  
  // Check if P1 can see P2
  const seesP2 = player2.id && players[player2.id] !== undefined;
  if (seesP2 !== p1SeesP2) {
    p1SeesP2 = seesP2;
    console.log(`👁️ P1 vision: ${p1SeesP2 ? 'CAN SEE' : 'CANNOT SEE'} P2`);
  }
  
  // Log visible player count
  const visibleCount = Object.keys(players).length;
  if (Math.random() < 0.1) { // 10% chance to reduce spam
    console.log(`👁️ P1 sees ${visibleCount} player(s) total`);
  }
});

// Player 2 handlers
player2.on('connect', () => {
  console.log('✅ Player 2 connected');
  console.log('\n📋 TEST SCENARIOS:');
  console.log('[1] Move P1 north (out of P2 vision)');
  console.log('[2] Move P1 south (into P2 vision)');
  console.log('[3] Turn P1 to face P2');
  console.log('[4] Turn P1 away from P2');
  console.log('[5] Move both players close');
  console.log('[6] Destroy wall between players');
  console.log('[Q] Quit\n');
});

player2.on('game:state', (state) => {
  const players = Object.fromEntries(state.players || []);
  p2State = players[player2.id];
  
  // Check if P2 can see P1
  const seesP1 = player1.id && players[player1.id] !== undefined;
  if (seesP1 !== p2SeesP1) {
    p2SeesP1 = seesP1;
    console.log(`👁️ P2 vision: ${p2SeesP1 ? 'CAN SEE' : 'CANNOT SEE'} P1`);
  }
});

// Test scenarios
const scenarios = {
  '1': () => {
    console.log('\n🎮 TEST 1: Moving P1 north (away from P2)');
    // Move P1 north
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        player1.emit('player:input', {
          keys: { w: true, a: false, s: false, d: false },
          mouse: { x: 240, y: 50 },
          shift: false,
          ctrl: false,
          timestamp: Date.now(),
          sequence: i
        });
      }, i * 100);
    }
    
    // Stop after 1 second
    setTimeout(() => {
      player1.emit('player:input', {
        keys: { w: false, a: false, s: false, d: false },
        mouse: { x: 240, y: 50 },
        shift: false,
        ctrl: false,
        timestamp: Date.now(),
        sequence: 10
      });
      console.log('✅ P1 movement complete');
    }, 1000);
  },
  
  '2': () => {
    console.log('\n🎮 TEST 2: Moving P1 south (toward P2)');
    // Move P1 south
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        player1.emit('player:input', {
          keys: { w: false, a: false, s: true, d: false },
          mouse: { x: 240, y: 200 },
          shift: false,
          ctrl: false,
          timestamp: Date.now(),
          sequence: i + 20
        });
      }, i * 100);
    }
    
    // Stop after 1 second
    setTimeout(() => {
      player1.emit('player:input', {
        keys: { w: false, a: false, s: false, d: false },
        mouse: { x: 240, y: 200 },
        shift: false,
        ctrl: false,
        timestamp: Date.now(),
        sequence: 30
      });
      console.log('✅ P1 movement complete');
    }, 1000);
  },
  
  '3': () => {
    console.log('\n🎮 TEST 3: Turning P1 to face P2');
    player1.emit('player:input', {
      keys: { w: false, a: false, s: false, d: false },
      mouse: { x: 300, y: 200 }, // Face towards P2's likely position
      shift: false,
      ctrl: false,
      timestamp: Date.now(),
      sequence: 40
    });
    console.log('✅ P1 rotation complete');
  },
  
  '4': () => {
    console.log('\n🎮 TEST 4: Turning P1 away from P2');
    player1.emit('player:input', {
      keys: { w: false, a: false, s: false, d: false },
      mouse: { x: 100, y: 50 }, // Face away from P2
      shift: false,
      ctrl: false,
      timestamp: Date.now(),
      sequence: 50
    });
    console.log('✅ P1 rotation complete');
  },
  
  '5': () => {
    console.log('\n🎮 TEST 5: Moving both players close together');
    // Move P1 to center
    player1.emit('player:input', {
      keys: { w: false, a: false, s: false, d: false },
      mouse: { x: 240, y: 135 },
      shift: false,
      ctrl: false,
      timestamp: Date.now(),
      sequence: 60
    });
    
    // Move P2 close to P1
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        player2.emit('player:input', {
          keys: { w: true, a: true, s: false, d: false },
          mouse: { x: 240, y: 135 },
          shift: false,
          ctrl: false,
          timestamp: Date.now(),
          sequence: i + 70
        });
      }, i * 100);
    }
    
    setTimeout(() => {
      player2.emit('player:input', {
        keys: { w: false, a: false, s: false, d: false },
        mouse: { x: 240, y: 135 },
        shift: false,
        ctrl: false,
        timestamp: Date.now(),
        sequence: 75
      });
      console.log('✅ Both players moved');
    }, 500);
  },
  
  '6': () => {
    console.log('\n🎮 TEST 6: Shooting wall to test vision through destroyed sections');
    // Fire rockets at wall
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        player1.emit('weapon:fire', {
          weaponType: 'rocket',
          position: p1State?.transform.position || { x: 240, y: 135 },
          direction: 0, // East
          isADS: false,
          timestamp: Date.now(),
          sequence: i + 80
        });
      }, i * 500);
    }
    console.log('💥 Firing rockets at wall...');
  }
};

// Handle input
process.stdin.on('data', (data) => {
  const key = data.toString().trim().toLowerCase();
  
  if (key === 'q') {
    console.log('\n👋 Exiting vision test...');
    process.exit(0);
  }
  
  if (scenarios[key]) {
    scenarios[key]();
  }
});

// Status display
setInterval(() => {
  if (p1State && p2State) {
    console.log(`\n📊 STATUS:`);
    console.log(`P1 @ (${Math.floor(p1State.transform.position.x)}, ${Math.floor(p1State.transform.position.y)}) angle: ${(p1State.transform.rotation * 180 / Math.PI).toFixed(0)}°`);
    console.log(`P2 @ (${Math.floor(p2State.transform.position.x)}, ${Math.floor(p2State.transform.position.y)}) angle: ${(p2State.transform.rotation * 180 / Math.PI).toFixed(0)}°`);
    console.log(`Vision: P1→P2: ${p1SeesP2 ? '✅' : '❌'}  P2→P1: ${p2SeesP1 ? '✅' : '❌'}`);
  }
}, 3000);

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n👋 Cleaning up...');
  player1.disconnect();
  player2.disconnect();
  process.exit(0);
}); 