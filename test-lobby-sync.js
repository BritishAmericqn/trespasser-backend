#!/usr/bin/env node

/**
 * Test script for lobby synchronization
 * Tests that all players receive proper state updates
 */

const io = require('socket.io-client');

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const NUM_PLAYERS = 3;
const TEST_GAME_MODE = 'deathmatch';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Test state tracking
const testResults = {
  passed: [],
  failed: [],
  warnings: []
};

// Player connections
const players = [];
let currentLobbyId = null;
let lobbyStates = new Map(); // Track what each player sees

// Utility functions
function log(playerId, message, color = colors.reset) {
  const playerColors = [colors.cyan, colors.magenta, colors.yellow];
  const playerColor = playerColors[playerId % playerColors.length];
  console.log(`${playerColor}[Player ${playerId}]${colors.reset} ${color}${message}${colors.reset}`);
}

function success(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
  testResults.passed.push(message);
}

function error(message) {
  console.log(`${colors.red}❌ ${message}${colors.reset}`);
  testResults.failed.push(message);
}

function warn(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
  testResults.warnings.push(message);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Create a player connection
function createPlayer(playerId) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      reconnection: false,
      timeout: 5000
    });
    
    const player = {
      id: playerId,
      socket,
      lobbyId: null,
      lastLobbyState: null,
      events: []
    };
    
    // Track all lobby-related events
    socket.on('lobby_joined', (data) => {
      log(playerId, `Joined lobby: ${JSON.stringify(data)}`, colors.green);
      player.lobbyId = data.lobbyId;
      currentLobbyId = data.lobbyId;
      player.events.push({ event: 'lobby_joined', data, timestamp: Date.now() });
    });
    
    socket.on('lobby_state_update', (data) => {
      log(playerId, `Lobby state update: playerCount=${data.playerCount}, status=${data.status}`, colors.blue);
      player.lastLobbyState = data;
      lobbyStates.set(playerId, data);
      player.events.push({ event: 'lobby_state_update', data, timestamp: Date.now() });
    });
    
    socket.on('player_joined_lobby', (data) => {
      log(playerId, `Player joined: ${data.playerId?.substring(0, 8)}`, colors.green);
      player.events.push({ event: 'player_joined_lobby', data, timestamp: Date.now() });
    });
    
    socket.on('player_left_lobby', (data) => {
      log(playerId, `Player left: ${data.playerId?.substring(0, 8)}`, colors.yellow);
      player.events.push({ event: 'player_left_lobby', data, timestamp: Date.now() });
    });
    
    socket.on('match_starting', (data) => {
      log(playerId, `Match starting! Countdown: ${data.countdown}s`, colors.bright);
      player.events.push({ event: 'match_starting', data, timestamp: Date.now() });
    });
    
    socket.on('match_started', (data) => {
      log(playerId, `Match started!`, colors.bright);
      player.events.push({ event: 'match_started', data, timestamp: Date.now() });
    });
    
    socket.on('match_start_cancelled', (data) => {
      log(playerId, `Match start cancelled: ${data.reason}`, colors.yellow);
      player.events.push({ event: 'match_start_cancelled', data, timestamp: Date.now() });
    });
    
    socket.on('connect', () => {
      log(playerId, 'Connected to server', colors.green);
      resolve(player);
    });
    
    socket.on('connect_error', (err) => {
      log(playerId, `Connection error: ${err.message}`, colors.red);
      reject(err);
    });
    
    socket.on('error', (err) => {
      log(playerId, `Socket error: ${err}`, colors.red);
    });
    
    socket.on('disconnect', (reason) => {
      log(playerId, `Disconnected: ${reason}`, colors.yellow);
    });
    
    players.push(player);
  });
}

// Test: All players see the same lobby state
async function testLobbyStateSynchronization() {
  console.log(`\n${colors.bright}=== TEST: Lobby State Synchronization ===${colors.reset}\n`);
  
  // Wait for all players to receive state updates
  await delay(1000);
  
  // Check if all players see the same state
  const states = Array.from(lobbyStates.values());
  if (states.length !== NUM_PLAYERS) {
    error(`Not all players received lobby state updates (${states.length}/${NUM_PLAYERS})`);
    return false;
  }
  
  // Compare player counts
  const playerCounts = states.map(s => s.playerCount);
  const allCountsMatch = playerCounts.every(count => count === playerCounts[0]);
  
  if (allCountsMatch) {
    success(`All players see the same player count: ${playerCounts[0]}`);
  } else {
    error(`Player count mismatch: ${playerCounts.join(', ')}`);
    return false;
  }
  
  // Compare lobby IDs
  const lobbyIds = states.map(s => s.lobbyId);
  const allIdsMatch = lobbyIds.every(id => id === lobbyIds[0]);
  
  if (allIdsMatch) {
    success(`All players in the same lobby: ${lobbyIds[0]}`);
  } else {
    error(`Lobby ID mismatch: ${lobbyIds.join(', ')}`);
    return false;
  }
  
  return true;
}

// Test: Players receive join notifications
async function testPlayerJoinBroadcasts() {
  console.log(`\n${colors.bright}=== TEST: Player Join Broadcasts ===${colors.reset}\n`);
  
  // Check if earlier players received notifications about later joins
  for (let i = 0; i < players.length - 1; i++) {
    const player = players[i];
    const joinEvents = player.events.filter(e => e.event === 'player_joined_lobby');
    
    // Should have received notifications for players who joined after
    const expectedJoins = players.length - 1; // Total joins minus self
    
    if (joinEvents.length > 0) {
      success(`Player ${i} received ${joinEvents.length} join notification(s)`);
    } else {
      warn(`Player ${i} received no join notifications (expected some)`);
    }
  }
  
  return true;
}

// Test: Match start synchronization
async function testMatchStartSync() {
  console.log(`\n${colors.bright}=== TEST: Match Start Synchronization ===${colors.reset}\n`);
  
  // Check if all players received match_starting event
  const matchStartingEvents = players.map(p => 
    p.events.find(e => e.event === 'match_starting')
  );
  
  const allReceivedStart = matchStartingEvents.every(e => e !== undefined);
  
  if (allReceivedStart) {
    success('All players received match_starting event');
    
    // Check if countdown values match
    const countdowns = matchStartingEvents.map(e => e?.data?.countdown);
    const allCountdownsMatch = countdowns.every(c => c === countdowns[0]);
    
    if (allCountdownsMatch) {
      success(`All players received same countdown: ${countdowns[0]}s`);
    } else {
      error(`Countdown mismatch: ${countdowns.join(', ')}`);
    }
    
    // Check timing synchronization
    const timestamps = matchStartingEvents.map(e => e?.timestamp || 0);
    const maxDiff = Math.max(...timestamps) - Math.min(...timestamps);
    
    if (maxDiff < 100) { // Within 100ms
      success(`Match start events synchronized within ${maxDiff}ms`);
    } else {
      warn(`Match start events spread over ${maxDiff}ms`);
    }
  } else {
    const receivedCount = matchStartingEvents.filter(e => e !== undefined).length;
    error(`Only ${receivedCount}/${NUM_PLAYERS} players received match_starting event`);
  }
  
  return allReceivedStart;
}

// Main test execution
async function runTests() {
  console.log(`\n${colors.bright}🧪 Starting Lobby Synchronization Tests${colors.reset}`);
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Testing with ${NUM_PLAYERS} players\n`);
  
  try {
    // Phase 1: Connect all players
    console.log(`${colors.bright}=== Phase 1: Connecting Players ===${colors.reset}\n`);
    
    for (let i = 0; i < NUM_PLAYERS; i++) {
      await createPlayer(i);
      await delay(200); // Small delay between connections
    }
    
    success(`Connected ${NUM_PLAYERS} players`);
    
    // Phase 2: Join matchmaking
    console.log(`\n${colors.bright}=== Phase 2: Joining Matchmaking ===${colors.reset}\n`);
    
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      log(i, 'Searching for match...', colors.yellow);
      
      player.socket.emit('find_match', {
        gameMode: TEST_GAME_MODE
      });
      
      await delay(500); // Stagger joins to test incremental updates
    }
    
    // Wait for lobby formation
    await delay(2000);
    
    // Phase 3: Run synchronization tests
    console.log(`\n${colors.bright}=== Phase 3: Running Synchronization Tests ===${colors.reset}`);
    
    await testLobbyStateSynchronization();
    await testPlayerJoinBroadcasts();
    
    // Wait for match to start (should auto-start with 2+ players)
    console.log(`\n${colors.bright}=== Phase 4: Waiting for Match Start ===${colors.reset}\n`);
    console.log('Match should auto-start in ~5 seconds...');
    
    await delay(6000);
    
    await testMatchStartSync();
    
    // Phase 5: Test player leave
    console.log(`\n${colors.bright}=== Phase 5: Testing Player Leave ===${colors.reset}\n`);
    
    const leavingPlayer = players[NUM_PLAYERS - 1];
    log(leavingPlayer.id, 'Leaving lobby...', colors.yellow);
    leavingPlayer.socket.emit('leave_lobby');
    
    await delay(1000);
    
    // Check if other players received leave notification
    const leaveEvents = players.slice(0, -1).map(p => 
      p.events.filter(e => e.event === 'player_left_lobby').length
    );
    
    if (leaveEvents.every(count => count > 0)) {
      success('All remaining players received leave notification');
    } else {
      error('Some players did not receive leave notification');
    }
    
  } catch (err) {
    error(`Test execution failed: ${err.message}`);
  } finally {
    // Cleanup
    console.log(`\n${colors.bright}=== Cleaning Up ===${colors.reset}\n`);
    
    for (const player of players) {
      player.socket.disconnect();
    }
    
    // Print summary
    console.log(`\n${colors.bright}=== TEST SUMMARY ===${colors.reset}\n`);
    console.log(`${colors.green}Passed: ${testResults.passed.length}${colors.reset}`);
    console.log(`${colors.red}Failed: ${testResults.failed.length}${colors.reset}`);
    console.log(`${colors.yellow}Warnings: ${testResults.warnings.length}${colors.reset}`);
    
    if (testResults.failed.length > 0) {
      console.log(`\n${colors.red}Failed tests:${colors.reset}`);
      testResults.failed.forEach(test => console.log(`  - ${test}`));
    }
    
    if (testResults.warnings.length > 0) {
      console.log(`\n${colors.yellow}Warnings:${colors.reset}`);
      testResults.warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
    // Exit with appropriate code
    process.exit(testResults.failed.length > 0 ? 1 : 0);
  }
}

// Run the tests
runTests().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});
