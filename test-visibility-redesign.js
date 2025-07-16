const io = require('socket.io-client');

// Connect to the server
const socket = io('http://localhost:3000');

let playerId = null;

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  // Wait a bit for game state to initialize
  setTimeout(() => {
    // Test different viewing directions
    testVisibility();
  }, 1000);
});

socket.on('playerJoined', (data) => {
  playerId = data.playerId;
  console.log('✅ Joined as player:', playerId);
});

socket.on('gameState', (state) => {
  // Look for debug logs in server console
  if (state.players[playerId]) {
    const player = state.players[playerId];
    console.log(`📍 Player at (${player.x.toFixed(0)}, ${player.y.toFixed(0)}) looking ${(player.rotation * 180 / Math.PI).toFixed(0)}°`);
  }
});

function testVisibility() {
  console.log('\n🧪 Testing visibility polygon with different view angles...\n');
  
  const testAngles = [
    { angle: 0, name: 'Right (0°)' },
    { angle: Math.PI / 2, name: 'Down (90°)' },
    { angle: Math.PI, name: 'Left (180°)' },
    { angle: -Math.PI / 2, name: 'Up (-90°)' },
    { angle: 0.1, name: 'Slightly down from right (5.7°)' },
    { angle: Math.PI - 0.1, name: 'Slightly up from left (174.3°)' }
  ];
  
  let index = 0;
  const interval = setInterval(() => {
    if (index >= testAngles.length) {
      clearInterval(interval);
      console.log('\n✅ Test complete! Check server console for [CornerDebug] and [VisibilityPolygon] logs');
      process.exit(0);
      return;
    }
    
    const test = testAngles[index];
    console.log(`\n🎯 Testing ${test.name}`);
    
    // Send input to rotate player
    socket.emit('player:input', {
      keys: { w: false, a: false, s: false, d: false },
      mouse: { 
        x: 240 + Math.cos(test.angle) * 100, 
        y: 135 + Math.sin(test.angle) * 100 
      },
      timestamp: Date.now(),
      sequenceNumber: index
    });
    
    index++;
  }, 1500); // Test each angle for 1.5 seconds
}

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
}); 