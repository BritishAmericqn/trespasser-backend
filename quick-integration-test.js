// Quick test of the exact frontend events
const { io } = require('socket.io-client');

console.log('🔌 Testing Frontend Integration Events...\n');

const socket = io('http://localhost:3000', {
  auth: { password: 'gauntlet' }
});

socket.on('connect', () => {
  console.log('✅ Connected to backend at http://localhost:3000');
});

socket.on('authenticated', () => {
  console.log('✅ Authentication successful with password "gauntlet"');
  console.log('\n📤 TESTING: socket.emit("find_match", { gameMode: "deathmatch" })');
  
  // EXACTLY what frontend will emit
  socket.emit('find_match', { gameMode: 'deathmatch' });
});

// EXACTLY what frontend will listen for
socket.on('lobby_joined', (data) => {
  console.log('\n📥 RECEIVED: lobby_joined event');
  console.log('   ✅ Frontend should: Show waiting room');
  console.log('   📊 Data:', {
    lobbyId: data.lobbyId,
    playerCount: data.playerCount,
    maxPlayers: data.maxPlayers,
    gameMode: data.gameMode
  });
  
  console.log('\n⏱️  Waiting for match to auto-start (5 seconds)...');
});

socket.on('match_started', (data) => {
  console.log('\n📥 RECEIVED: match_started event');
  console.log('   ✅ Frontend should: Start game with kill counter');
  console.log('   🎯 Kill Target:', data.killTarget);
  console.log('   📊 Data:', {
    lobbyId: data.lobbyId,
    killTarget: data.killTarget,
    startTime: data.startTime
  });
  
  console.log('\n✅ INTEGRATION TEST SUCCESSFUL!');
  console.log('\n🎯 CONFIRMED WORKING:');
  console.log('   📤 socket.emit("find_match") → 📥 socket.on("lobby_joined")');
  console.log('   📥 socket.on("lobby_joined") → 📥 socket.on("match_started")');
  console.log('\n🚀 Backend is ready for frontend integration!');
  
  setTimeout(() => process.exit(0), 1000);
});

socket.on('match_ended', (data) => {
  console.log('\n📥 RECEIVED: match_ended event');
  console.log('   ✅ Frontend should: Show results screen');
  console.log('   🏆 Winner:', data.winnerTeam);
});

socket.on('matchmaking_failed', (data) => {
  console.log('\n❌ RECEIVED: matchmaking_failed event');
  console.log('   Reason:', data.reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('\n⏰ Test timeout - server may be slow');
  process.exit(1);
}, 10000);
