#!/usr/bin/env node

/**
 * Test script that validates backend events match frontend expectations
 * Based on the explicit requirements from frontend team
 */

const io = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

// Track what each player sees
const playerViews = {
  A: { playerCount: null, events: [] },
  B: { playerCount: null, events: [] }
};

// Create Player A
const playerA = io(SERVER_URL, {
  reconnection: false,
  timeout: 5000
});

// Create Player B
const playerB = io(SERVER_URL, {
  reconnection: false,
  timeout: 5000
});

// Setup event listeners for Player A
playerA.on('lobby_joined', (data) => {
  console.log('Player A received lobby_joined:', data);
  playerViews.A.playerCount = data.playerCount;
  playerViews.A.events.push({ event: 'lobby_joined', playerCount: data.playerCount });
});

playerA.on('player_joined_lobby', (data) => {
  console.log('Player A received player_joined_lobby:', data);
  if (data.playerCount !== undefined) {
    playerViews.A.playerCount = data.playerCount;
    playerViews.A.events.push({ event: 'player_joined_lobby', playerCount: data.playerCount });
  } else {
    console.error('❌ Player A: player_joined_lobby missing playerCount field!');
  }
});

playerA.on('player_left_lobby', (data) => {
  console.log('Player A received player_left_lobby:', data);
  if (data.playerCount !== undefined) {
    playerViews.A.playerCount = data.playerCount;
    playerViews.A.events.push({ event: 'player_left_lobby', playerCount: data.playerCount });
  }
});

// Setup event listeners for Player B
playerB.on('lobby_joined', (data) => {
  console.log('Player B received lobby_joined:', data);
  playerViews.B.playerCount = data.playerCount;
  playerViews.B.events.push({ event: 'lobby_joined', playerCount: data.playerCount });
});

playerB.on('player_joined_lobby', (data) => {
  console.log('Player B received player_joined_lobby:', data);
  if (data.playerCount !== undefined) {
    playerViews.B.playerCount = data.playerCount;
    playerViews.B.events.push({ event: 'player_joined_lobby', playerCount: data.playerCount });
  } else {
    console.error('❌ Player B: player_joined_lobby missing playerCount field!');
  }
});

playerB.on('player_left_lobby', (data) => {
  console.log('Player B received player_left_lobby:', data);
  if (data.playerCount !== undefined) {
    playerViews.B.playerCount = data.playerCount;
    playerViews.B.events.push({ event: 'player_left_lobby', playerCount: data.playerCount });
  }
});

// Test sequence
async function runTest() {
  console.log('\n=== FRONTEND EVENT STRUCTURE TEST ===\n');
  
  // Wait for connections
  await new Promise(resolve => {
    let connected = 0;
    playerA.on('connect', () => {
      console.log('✅ Player A connected');
      connected++;
      if (connected === 2) resolve();
    });
    playerB.on('connect', () => {
      console.log('✅ Player B connected');
      connected++;
      if (connected === 2) resolve();
    });
  });
  
  console.log('\n--- TEST 1: Player A joins lobby ---');
  playerA.emit('find_match', { gameMode: 'deathmatch' });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('\n--- TEST 2: Player B joins same lobby ---');
  playerB.emit('find_match', { gameMode: 'deathmatch' });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\n=== RESULTS ===\n');
  
  // Check what each player sees
  console.log('Player A sees:', playerViews.A.playerCount, 'players');
  console.log('Player A events:', playerViews.A.events);
  console.log('');
  console.log('Player B sees:', playerViews.B.playerCount, 'players');
  console.log('Player B events:', playerViews.B.events);
  
  // Validate
  if (playerViews.A.playerCount === playerViews.B.playerCount) {
    console.log('\n✅ SUCCESS: Both players see the same count:', playerViews.A.playerCount);
  } else {
    console.log('\n❌ FAILURE: Players see different counts!');
    console.log('   Player A:', playerViews.A.playerCount);
    console.log('   Player B:', playerViews.B.playerCount);
  }
  
  // Check if Player A received notification when B joined
  const playerAJoinEvents = playerViews.A.events.filter(e => e.event === 'player_joined_lobby');
  if (playerAJoinEvents.length > 0) {
    console.log('✅ Player A received player_joined_lobby when B joined');
  } else {
    console.log('❌ Player A did NOT receive player_joined_lobby when B joined');
  }
  
  // Check final state
  if (playerViews.A.playerCount === 2 && playerViews.B.playerCount === 2) {
    console.log('\n🎉 TEST PASSED: Both players correctly see 2 players');
  } else {
    console.log('\n💀 TEST FAILED: Desync detected!');
  }
  
  // Cleanup
  playerA.disconnect();
  playerB.disconnect();
  
  setTimeout(() => process.exit(0), 100);
}

// Run the test
runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
