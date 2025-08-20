const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('\n🧪 COMPREHENSIVE MATCH START TESTS\n');

// Test 1: 2 Players - 10 second countdown
async function test2Players() {
  console.log('='.repeat(50));
  console.log('TEST 1: Two Players - 10 second countdown');
  console.log('='.repeat(50));
  
  const p1 = io(SERVER_URL, { transports: ['websocket'] });
  const p2 = io(SERVER_URL, { transports: ['websocket'] });
  
  let countdown = null;
  
  p1.on('connect', () => {
    console.log('Player 1 connected');
    p1.emit('find_match', { gameMode: 'deathmatch' });
  });
  
  p2.on('connect', () => {
    console.log('Player 2 connected');
    p2.emit('find_match', { gameMode: 'deathmatch' });
  });
  
  p1.on('match_starting', (data) => {
    countdown = data.countdown;
    console.log(`Player 1: Countdown received: ${data.countdown} seconds`);
  });
  
  p2.on('match_starting', (data) => {
    countdown = data.countdown;
    console.log(`Player 2: Countdown received: ${data.countdown} seconds`);
  });
  
  // Wait for both connections and match start
  await sleep(3000);
  
  if (countdown === 10) {
    console.log('✅ PASS: 10-second countdown for 2 players');
  } else {
    console.log(`❌ FAIL: Expected 10 seconds, got ${countdown}`);
  }
  
  p1.disconnect();
  p2.disconnect();
  await sleep(1000);
}

// Test 2: Timer reset when 3rd player joins
async function testTimerReset() {
  console.log('\n' + '='.repeat(50));
  console.log('TEST 2: Timer Reset on 3rd Player Join');
  console.log('='.repeat(50));
  
  const players = [];
  let resetCount = 0;
  
  for (let i = 0; i < 2; i++) {
    const p = io(SERVER_URL, { transports: ['websocket'] });
    players.push(p);
    
    p.on('connect', () => {
      console.log(`Player ${i + 1} connected`);
      p.emit('find_match', { gameMode: 'deathmatch' });
    });
    
    p.on('match_starting', () => {
      resetCount++;
    });
    
    await sleep(500);
  }
  
  console.log('Initial countdown started');
  await sleep(2000);
  
  // Add 3rd player
  console.log('Adding 3rd player...');
  const p3 = io(SERVER_URL, { transports: ['websocket'] });
  players.push(p3);
  
  p3.on('connect', () => {
    console.log('Player 3 connected');
    p3.emit('find_match', { gameMode: 'deathmatch' });
  });
  
  await sleep(2000);
  
  // Should have gotten multiple countdown events due to reset
  if (resetCount > 2) {
    console.log(`✅ PASS: Timer reset detected (${resetCount} countdown events)`);
  } else {
    console.log(`❌ FAIL: Timer reset not detected (only ${resetCount} events)`);
  }
  
  players.forEach(p => p.disconnect());
  await sleep(1000);
}

// Test 3: 8 Players - immediate start
async function test8Players() {
  console.log('\n' + '='.repeat(50));
  console.log('TEST 3: Eight Players - Immediate Start');
  console.log('='.repeat(50));
  
  const players = [];
  let immediateStart = false;
  
  for (let i = 0; i < 8; i++) {
    const p = io(SERVER_URL, { transports: ['websocket'] });
    players.push(p);
    
    const playerNum = i + 1;
    
    p.on('connect', () => {
      console.log(`Player ${playerNum} connected`);
      p.emit('find_match', { gameMode: 'deathmatch' });
    });
    
    p.on('match_starting', (data) => {
      if (playerNum === 8 && data.countdown === 1) {
        immediateStart = true;
        console.log('8th player triggered immediate start!');
      }
    });
    
    await sleep(100);
  }
  
  await sleep(2000);
  
  if (immediateStart) {
    console.log('✅ PASS: 8 players triggered immediate start');
  } else {
    console.log('❌ FAIL: 8 players did not trigger immediate start');
  }
  
  players.forEach(p => p.disconnect());
  await sleep(1000);
}

// Test 4: Player leaves, drops below minimum
async function testPlayerLeave() {
  console.log('\n' + '='.repeat(50));
  console.log('TEST 4: Player Leaves - Countdown Cancel');
  console.log('='.repeat(50));
  
  const p1 = io(SERVER_URL, { transports: ['websocket'] });
  const p2 = io(SERVER_URL, { transports: ['websocket'] });
  
  let countdownCancelled = false;
  
  p1.on('connect', () => {
    console.log('Player 1 connected');
    p1.emit('find_match', { gameMode: 'deathmatch' });
  });
  
  p2.on('connect', () => {
    console.log('Player 2 connected');
    p2.emit('find_match', { gameMode: 'deathmatch' });
  });
  
  p1.on('match_start_cancelled', () => {
    countdownCancelled = true;
    console.log('Countdown cancelled!');
  });
  
  await sleep(2000);
  console.log('Countdown started, now removing player 2...');
  
  p2.disconnect();
  await sleep(2000);
  
  if (countdownCancelled) {
    console.log('✅ PASS: Countdown cancelled when dropped below 2 players');
  } else {
    console.log('❌ FAIL: Countdown not cancelled');
  }
  
  p1.disconnect();
  await sleep(1000);
}

// Run all tests
async function runAllTests() {
  await test2Players();
  await testTimerReset();
  await test8Players();
  await testPlayerLeave();
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ ALL TESTS COMPLETE');
  console.log('='.repeat(50) + '\n');
  
  process.exit(0);
}

// Start tests
setTimeout(() => {
  runAllTests().catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
}, 1000);
