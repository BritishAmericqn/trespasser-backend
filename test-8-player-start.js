const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test8PlayerStart() {
  console.log('\n=== Testing 8-Player Immediate Start ===\n');
  
  const players = [];
  let immediateStartCount = 0;
  let regularCountdownCount = 0;
  
  // Connect 8 players sequentially
  for (let i = 0; i < 8; i++) {
    console.log(`Connecting player ${i + 1}...`);
    
    const player = io(SERVER_URL, { transports: ['websocket'] });
    players.push(player);
    
    const playerNum = i + 1;
    
    player.on('connect', () => {
      console.log(`  Player ${playerNum} connected`);
      player.emit('find_match', { gameMode: 'deathmatch' });
    });
    
    player.on('lobby_joined', (data) => {
      console.log(`  Player ${playerNum} joined lobby: ${data.playerCount}/${data.maxPlayers} players`);
    });
    
    player.on('match_starting', (data) => {
      console.log(`  Player ${playerNum} received: Match starting in ${data.countdown} seconds`);
      if (data.countdown === 1) {
        immediateStartCount++;
      } else if (data.countdown === 10) {
        regularCountdownCount++;
      }
    });
    
    player.on('match_started', () => {
      console.log(`  Player ${playerNum}: MATCH STARTED!`);
    });
    
    // Wait for connection and join
    await sleep(500);
  }
  
  // Wait to see what happens
  await sleep(3000);
  
  console.log('\n=== Results ===');
  console.log(`Regular 10-second countdowns: ${regularCountdownCount}`);
  console.log(`Immediate 1-second starts: ${immediateStartCount}`);
  
  if (immediateStartCount > 0) {
    console.log('✓ SUCCESS: 8 players triggered immediate match start');
  } else {
    console.log('✗ FAILED: 8 players did not trigger immediate start');
  }
  
  // Disconnect all
  for (const player of players) {
    player.disconnect();
  }
  
  // Test timer reset
  await sleep(2000);
  console.log('\n\n=== Testing Timer Reset on New Player Join ===\n');
  
  const resetPlayers = [];
  let resetDetected = false;
  let countdownHistory = [];
  
  // Connect 2 players first
  for (let i = 0; i < 2; i++) {
    const player = io(SERVER_URL, { transports: ['websocket'] });
    resetPlayers.push(player);
    
    const playerNum = i + 1;
    
    player.on('connect', () => {
      console.log(`Player ${playerNum} connected`);
      player.emit('find_match', { gameMode: 'deathmatch' });
    });
    
    player.on('lobby_joined', (data) => {
      console.log(`Player ${playerNum} joined: ${data.playerCount}/${data.maxPlayers}`);
    });
    
    player.on('match_starting', (data) => {
      const msg = `Player ${playerNum}: Countdown ${data.countdown}s`;
      console.log(msg);
      countdownHistory.push({ player: playerNum, countdown: data.countdown, time: Date.now() });
    });
    
    await sleep(500);
  }
  
  // Wait for initial countdown to start
  await sleep(2000);
  console.log('\nAdding 3rd player during countdown...');
  
  // Add 3rd player during countdown
  const player3 = io(SERVER_URL, { transports: ['websocket'] });
  resetPlayers.push(player3);
  
  player3.on('connect', () => {
    console.log('Player 3 connected');
    player3.emit('find_match', { gameMode: 'deathmatch' });
  });
  
  player3.on('lobby_joined', (data) => {
    console.log(`Player 3 joined: ${data.playerCount}/${data.maxPlayers}`);
  });
  
  player3.on('match_starting', (data) => {
    console.log(`Player 3: Countdown ${data.countdown}s`);
    countdownHistory.push({ player: 3, countdown: data.countdown, time: Date.now() });
  });
  
  await sleep(3000);
  
  // Analyze countdown history
  console.log('\n=== Timer Reset Analysis ===');
  
  // Check if we got multiple 10-second countdowns
  const tenSecondCountdowns = countdownHistory.filter(h => h.countdown === 10);
  if (tenSecondCountdowns.length >= 2) {
    // Check if they happened at different times (indicating a reset)
    const times = [...new Set(tenSecondCountdowns.map(h => Math.floor(h.time / 1000)))];
    if (times.length >= 2) {
      console.log('✓ Timer reset detected - countdown restarted when player 3 joined');
      resetDetected = true;
    }
  }
  
  if (!resetDetected) {
    console.log('✗ Timer reset not detected');
  }
  
  // Disconnect all
  for (const player of resetPlayers) {
    player.disconnect();
  }
  
  console.log('\n=== All Tests Complete ===\n');
  process.exit(0);
}

// Run test
setTimeout(() => {
  test8PlayerStart().catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
}, 1000);
