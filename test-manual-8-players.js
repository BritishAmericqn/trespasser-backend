const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testManual8Players() {
  console.log('\n=== Manual 8-Player Test ===');
  console.log('This test will connect players one by one with status checks\n');
  
  const players = [];
  let lobbyId = null;
  
  for (let i = 0; i < 8; i++) {
    const playerNum = i + 1;
    console.log(`\n--- Connecting Player ${playerNum} ---`);
    
    const player = io(SERVER_URL, { transports: ['websocket'] });
    players.push(player);
    
    // Setup event handlers
    player.on('connect', () => {
      console.log(`Player ${playerNum}: Connected to server`);
      player.emit('find_match', { gameMode: 'deathmatch' });
    });
    
    player.on('lobby_joined', (data) => {
      console.log(`Player ${playerNum}: Joined lobby ${data.lobbyId || 'unknown'}`);
      console.log(`  Current players: ${data.playerCount}/${data.maxPlayers}`);
      console.log(`  Status: ${data.status}`);
      if (!lobbyId && data.lobbyId) {
        lobbyId = data.lobbyId;
      }
    });
    
    player.on('match_starting', (data) => {
      console.log(`Player ${playerNum}: COUNTDOWN ${data.countdown} seconds`);
    });
    
    player.on('match_started', () => {
      console.log(`Player ${playerNum}: MATCH STARTED!`);
    });
    
    player.on('matchmaking_failed', (data) => {
      console.log(`Player ${playerNum}: MATCHMAKING FAILED - ${data.reason}`);
    });
    
    // Wait for this player to fully join before adding next
    await sleep(1000);
    
    // Check if we should continue
    if (i === 7) {
      console.log('\n⚠️  About to add 8th player - this should trigger immediate start');
    }
  }
  
  // Wait to see final results
  console.log('\n--- Waiting for match events ---');
  await sleep(5000);
  
  // Disconnect all
  console.log('\n--- Disconnecting all players ---');
  for (const player of players) {
    if (player.connected) {
      player.disconnect();
    }
  }
  
  console.log('\n=== Test Complete ===\n');
  process.exit(0);
}

// Run test
testManual8Players().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
