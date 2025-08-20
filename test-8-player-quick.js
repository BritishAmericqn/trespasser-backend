const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test8PlayerQuick() {
  console.log('\n=== Testing 8-Player Immediate Start (Quick Connection) ===\n');
  
  const players = [];
  let immediateStartDetected = false;
  
  // Create all 8 sockets first
  for (let i = 0; i < 8; i++) {
    const player = io(SERVER_URL, { 
      transports: ['websocket'],
      autoConnect: false  // Don't connect yet
    });
    
    const playerNum = i + 1;
    
    player.on('connect', () => {
      console.log(`Player ${playerNum} connected`);
      // Emit find_match immediately on connect
      player.emit('find_match', { gameMode: 'deathmatch' });
    });
    
    player.on('lobby_joined', (data) => {
      console.log(`Player ${playerNum} joined: ${data.playerCount}/${data.maxPlayers}`);
    });
    
    player.on('match_starting', (data) => {
      console.log(`Player ${playerNum}: Match starting in ${data.countdown}s`);
      if (data.countdown === 1) {
        immediateStartDetected = true;
      }
    });
    
    player.on('match_started', () => {
      console.log(`Player ${playerNum}: MATCH STARTED!`);
    });
    
    players.push(player);
  }
  
  // Connect all players with minimal delay
  console.log('Connecting all 8 players rapidly...\n');
  for (let i = 0; i < 8; i++) {
    players[i].connect();
    await sleep(100); // Very short delay
  }
  
  // Wait to see results
  await sleep(3000);
  
  console.log('\n=== Results ===');
  if (immediateStartDetected) {
    console.log('✓ SUCCESS: 8 players triggered immediate match start (1 second countdown)');
  } else {
    console.log('✗ FAILED: 8 players did not trigger immediate start');
  }
  
  // Disconnect all
  for (const player of players) {
    if (player.connected) {
      player.disconnect();
    }
  }
  
  console.log('\n=== Test Complete ===\n');
  process.exit(0);
}

// Run test
setTimeout(() => {
  test8PlayerQuick().catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
}, 1000);
