const io = require('socket.io-client');

// Connect to the server
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected to server');
  console.log('\n📍 Move your mouse in the game to trigger visibility calculations');
  console.log('💡 Watch the SERVER CONSOLE (npm run dev terminal) for:');
  console.log('   - [CornerDebug] messages showing corner counts');
  console.log('   - [VisibilityPolygon] messages showing polygon points');
  console.log('   - Arc intersections found (should be > 0 when walls cross the vision circle)');
  console.log('\nPress Ctrl+C to exit\n');
});

socket.on('playerJoined', (data) => {
  console.log('✅ Joined as player:', data.playerId);
});

// Keep the script running
process.stdin.resume(); 