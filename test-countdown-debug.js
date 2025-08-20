const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testCountdown() {
  console.log('\n=== Testing Match Countdown Logic ===\n');
  console.log('Connecting 2 players and monitoring countdown events...\n');
  
  const player1 = io(SERVER_URL, { transports: ['websocket'] });
  const player2 = io(SERVER_URL, { transports: ['websocket'] });
  
  let eventLog = [];
  
  // Setup player 1 events
  player1.on('connect', () => {
    eventLog.push('Player 1: Connected');
    player1.emit('find_match', { gameMode: 'deathmatch' });
  });
  
  player1.on('lobby_joined', (data) => {
    eventLog.push(`Player 1: Joined lobby (${data.playerCount}/${data.maxPlayers})`);
  });
  
  player1.on('match_starting', (data) => {
    eventLog.push(`Player 1: Match starting in ${data.countdown} seconds`);
  });
  
  player1.on('match_start_cancelled', (data) => {
    eventLog.push(`Player 1: Match cancelled - ${data.reason}`);
  });
  
  player1.on('match_started', () => {
    eventLog.push('Player 1: MATCH STARTED');
  });
  
  // Setup player 2 events
  player2.on('connect', () => {
    eventLog.push('Player 2: Connected');
    player2.emit('find_match', { gameMode: 'deathmatch' });
  });
  
  player2.on('lobby_joined', (data) => {
    eventLog.push(`Player 2: Joined lobby (${data.playerCount}/${data.maxPlayers})`);
  });
  
  player2.on('match_starting', (data) => {
    eventLog.push(`Player 2: Match starting in ${data.countdown} seconds`);
  });
  
  player2.on('match_start_cancelled', (data) => {
    eventLog.push(`Player 2: Match cancelled - ${data.reason}`);
  });
  
  player2.on('match_started', () => {
    eventLog.push('Player 2: MATCH STARTED');
  });
  
  // Connect player 1 first
  console.log('Connecting player 1...');
  await sleep(1000);
  
  // Connect player 2 after a delay
  console.log('Connecting player 2...');
  await sleep(2000);
  
  // Wait to see all events
  console.log('Waiting for countdown events...\n');
  await sleep(5000);
  
  // Print event log
  console.log('=== Event Log ===');
  eventLog.forEach((event, index) => {
    console.log(`${index + 1}. ${event}`);
  });
  
  // Analyze the countdown values
  console.log('\n=== Analysis ===');
  const countdowns = eventLog.filter(e => e.includes('Match starting'));
  console.log('Countdown events:', countdowns);
  
  if (countdowns.length > 0) {
    const firstCountdown = countdowns[0].match(/(\d+) seconds/);
    if (firstCountdown && firstCountdown[1] === '10') {
      console.log('✓ Initial countdown was 10 seconds');
    } else {
      console.log(`✗ Initial countdown was ${firstCountdown ? firstCountdown[1] : 'unknown'} seconds (expected 10)`);
    }
    
    if (countdowns.length > 2) {
      console.log('⚠ Multiple countdown events detected - possible timer reset issue');
    }
  }
  
  // Disconnect
  player1.disconnect();
  player2.disconnect();
  
  console.log('\n=== Test Complete ===\n');
  process.exit(0);
}

// Run test
setTimeout(() => {
  testCountdown().catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
}, 1000);
