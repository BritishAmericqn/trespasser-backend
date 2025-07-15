const io = require('socket.io-client');

const socket = io('http://localhost:3000');

// Player state
let position = { x: 240, y: 135 };
let sequence = 0;

socket.on('connect', () => {
  console.log('✅ Connected to server');
  console.log('📍 Starting position:', position);
  console.log('\n🎮 COLLISION TEST INSTRUCTIONS:');
  console.log('1. Use number keys to test different scenarios:');
  console.log('   [1] Move towards wall at (200, 100)');
  console.log('   [2] Try to slide along wall');
  console.log('   [3] Test diagonal movement into corner');
  console.log('   [4] Move to center and stop');
  console.log('   [5] Destroy wall and walk through');
  console.log('   [Q] Quit test\n');
});

socket.on('game:state', (state) => {
  // Find our player in the state
  const myPlayer = state.players[socket.id];
  if (myPlayer) {
    position = myPlayer.transform.position;
    console.log(`📍 Player position: (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
  }
});

// Test scenarios
const scenarios = {
  '1': () => {
    console.log('\n🧪 TEST 1: Moving towards wall at (200, 100)');
    sendMovement({ w: true }, 'Moving north towards wall');
    setTimeout(() => sendMovement({}, 'Stop'), 1000);
  },
  
  '2': () => {
    console.log('\n🧪 TEST 2: Sliding along wall');
    sendMovement({ w: true, d: true }, 'Moving northeast to slide');
    setTimeout(() => sendMovement({}, 'Stop'), 1500);
  },
  
  '3': () => {
    console.log('\n🧪 TEST 3: Diagonal into corner');
    sendMovement({ a: true, w: true }, 'Moving northwest into corner');
    setTimeout(() => sendMovement({}, 'Stop'), 2000);
  },
  
  '4': () => {
    console.log('\n🧪 TEST 4: Return to center');
    // Move to center position
    const movesToCenter = [];
    if (position.x < 240) movesToCenter.push('d');
    if (position.x > 240) movesToCenter.push('a');
    if (position.y < 135) movesToCenter.push('s');
    if (position.y > 135) movesToCenter.push('w');
    
    const keys = {};
    movesToCenter.forEach(key => keys[key] = true);
    sendMovement(keys, `Moving ${movesToCenter.join('+')} to center`);
    setTimeout(() => sendMovement({}, 'Stop at center'), 1000);
  },
  
  '5': () => {
    console.log('\n🧪 TEST 5: Destroy wall and walk through');
    // First destroy the wall
    socket.emit('debug:repair_walls');
    setTimeout(() => {
      console.log('🔫 Firing rocket at wall...');
      socket.emit('weapon:fire', {
        weaponType: 'rocket',
        position: position,
        direction: -Math.PI/2, // North
        isADS: false,
        timestamp: Date.now(),
        sequence: sequence++
      });
    }, 500);
    
    // Then try to walk through
    setTimeout(() => {
      console.log('🚶 Walking through destroyed area...');
      sendMovement({ w: true }, 'Moving north through destruction');
      setTimeout(() => sendMovement({}, 'Stop'), 1500);
    }, 1500);
  }
};

function sendMovement(keys, description) {
  const input = {
    keys: {
      w: false, a: false, s: false, d: false,
      shift: false, ctrl: false, r: false, g: false,
      '1': false, '2': false, '3': false, '4': false,
      ...keys
    },
    mouse: {
      x: position.x,
      y: position.y - 50, // Look north
      buttons: 0,
      leftPressed: false,
      rightPressed: false,
      leftReleased: false,
      rightReleased: false
    },
    sequence: sequence++,
    timestamp: Date.now()
  };
  
  socket.emit('player:input', input);
  console.log(`📤 ${description}`);
}

// Handle keyboard input
process.stdin.setRawMode(true);
process.stdin.on('data', (key) => {
  const char = key.toString();
  
  if (char === 'q' || char === 'Q' || key[0] === 3) { // Ctrl+C
    console.log('\n👋 Exiting collision test');
    process.exit();
  }
  
  if (scenarios[char]) {
    scenarios[char]();
  }
});

// Error handling
socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.log('Make sure the server is running on port 3000');
  process.exit(1);
});

socket.on('wall:damaged', (event) => {
  console.log(`💥 Wall damaged: ${event.wallId} slice ${event.sliceIndex}`);
});

socket.on('weapon:switched', (event) => {
  if (event.playerId === socket.id) {
    console.log(`🔄 Switched to ${event.toWeapon}`);
  }
});

console.log('🔧 Collision test client started...'); 