#!/usr/bin/env node

/**
 * Comprehensive end-to-end test for the complete user flow
 * Tests: Connection → Matchmaking → Lobby → Game Start → In-Game Events
 */

const io = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const NUM_PLAYERS = 2; // Minimum for auto-start

// Track what events each player receives
const playerEvents = {};
const testResults = {
  passed: [],
  failed: [],
  warnings: []
};

// Color codes for output
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

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(test) {
  log(`✅ ${test}`, colors.green);
  testResults.passed.push(test);
}

function fail(test, reason) {
  log(`❌ ${test}: ${reason}`, colors.red);
  testResults.failed.push(`${test}: ${reason}`);
}

function warn(message) {
  log(`⚠️  ${message}`, colors.yellow);
  testResults.warnings.push(message);
}

function createPlayer(id) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      reconnection: false,
      timeout: 5000
    });
    
    const player = {
      id,
      socket,
      events: [],
      lobbyId: null,
      playerCount: null,
      gameState: null,
      inGame: false
    };
    
    playerEvents[id] = player;
    
    // Track ALL events
    socket.onAny((eventName, ...args) => {
      player.events.push({
        event: eventName,
        data: args[0],
        timestamp: Date.now()
      });
      
      // Don't log ping/pong or state updates
      if (!eventName.includes('ping') && 
          !eventName.includes('pong') && 
          !eventName.includes('game:state')) {
        console.log(`[Player ${id}] Event: ${eventName}`, 
          args[0] ? `(${JSON.stringify(args[0]).substring(0, 100)}...)` : '');
      }
    });
    
    // Critical lobby events
    socket.on('lobby_joined', (data) => {
      player.lobbyId = data.lobbyId;
      player.playerCount = data.playerCount;
      log(`[Player ${id}] Joined lobby: ${data.lobbyId} (${data.playerCount}/${data.maxPlayers})`, colors.cyan);
    });
    
    socket.on('player_joined_lobby', (data) => {
      player.playerCount = data.playerCount;
      log(`[Player ${id}] Another player joined, count: ${data.playerCount}`, colors.blue);
    });
    
    socket.on('player_left_lobby', (data) => {
      player.playerCount = data.playerCount;
      log(`[Player ${id}] Player left, count: ${data.playerCount}`, colors.yellow);
    });
    
    socket.on('match_starting', (data) => {
      log(`[Player ${id}] Match starting in ${data.countdown}s`, colors.magenta);
    });
    
    socket.on('match_started', (data) => {
      player.inGame = true;
      log(`[Player ${id}] Match started!`, colors.bright);
    });
    
    // Game events
    socket.on('game:state', (state) => {
      player.gameState = state;
      player.inGame = true;
      // Only log once
      if (!player.gameStateLogged) {
        log(`[Player ${id}] Received game state with ${Object.keys(state.players || {}).length} players`, colors.green);
        player.gameStateLogged = true;
      }
    });
    
    socket.on('player:joined', (data) => {
      log(`[Player ${id}] Player joined game: ${data.id || data.playerId}`, colors.blue);
    });
    
    socket.on('connect', () => {
      log(`[Player ${id}] Connected to server`, colors.green);
      resolve(player);
    });
    
    socket.on('connect_error', (err) => {
      log(`[Player ${id}] Connection error: ${err.message}`, colors.red);
      reject(err);
    });
    
    socket.on('error', (err) => {
      log(`[Player ${id}] Socket error: ${err}`, colors.red);
    });
  });
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log(`\n${colors.bright}=== COMPREHENSIVE END-TO-END TEST ===${colors.reset}`);
  console.log(`Testing complete flow: Connection → Lobby → Game\n`);
  
  const players = [];
  
  try {
    // ===== PHASE 1: Connection =====
    console.log(`\n${colors.bright}PHASE 1: Connection${colors.reset}\n`);
    
    for (let i = 0; i < NUM_PLAYERS; i++) {
      const player = await createPlayer(i);
      players.push(player);
      await delay(100);
    }
    
    // Verify all connected
    const allConnected = players.every(p => p.socket.connected);
    if (allConnected) {
      success('All players connected');
    } else {
      fail('Connection', 'Not all players connected');
    }
    
    // ===== PHASE 2: Matchmaking =====
    console.log(`\n${colors.bright}PHASE 2: Matchmaking${colors.reset}\n`);
    
    // Players join matchmaking sequentially
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      log(`Player ${i} searching for match...`, colors.yellow);
      player.socket.emit('find_match', { gameMode: 'deathmatch' });
      await delay(500); // Stagger joins
    }
    
    // Wait for lobby formation
    await delay(1000);
    
    // ===== PHASE 3: Verify Lobby State =====
    console.log(`\n${colors.bright}PHASE 3: Lobby Verification${colors.reset}\n`);
    
    // Check lobby_joined events
    for (let i = 0; i < players.length; i++) {
      const player = playerEvents[i];
      const lobbyJoined = player.events.find(e => e.event === 'lobby_joined');
      
      if (lobbyJoined) {
        success(`Player ${i} received lobby_joined`);
        if (lobbyJoined.data.playerCount === undefined) {
          fail(`Player ${i} lobby_joined`, 'Missing playerCount field');
        }
      } else {
        fail(`Player ${i} lobby_joined`, 'Never received event');
      }
    }
    
    // Check if all players are in the same lobby
    const lobbyIds = players.map(p => playerEvents[p.id].lobbyId);
    const allSameLobby = lobbyIds.every(id => id === lobbyIds[0]);
    
    if (allSameLobby && lobbyIds[0]) {
      success(`All players in same lobby: ${lobbyIds[0]}`);
    } else {
      fail('Lobby consistency', `Players in different lobbies: ${lobbyIds.join(', ')}`);
    }
    
    // Check player counts
    const playerCounts = players.map(p => playerEvents[p.id].playerCount);
    const allSameCount = playerCounts.every(count => count === playerCounts[0]);
    
    if (allSameCount && playerCounts[0] === NUM_PLAYERS) {
      success(`All players see correct count: ${playerCounts[0]}`);
    } else {
      fail('Player count sync', `Counts don't match: ${playerCounts.join(', ')}`);
    }
    
    // Check join notifications
    for (let i = 0; i < players.length - 1; i++) {
      const player = playerEvents[i];
      const joinEvents = player.events.filter(e => e.event === 'player_joined_lobby');
      
      if (joinEvents.length > 0) {
        success(`Player ${i} received ${joinEvents.length} join notification(s)`);
      } else {
        warn(`Player ${i} received no join notifications`);
      }
    }
    
    // ===== PHASE 4: Match Start =====
    console.log(`\n${colors.bright}PHASE 4: Match Start (waiting up to 10s)${colors.reset}\n`);
    
    // Wait for match to auto-start
    await delay(6000);
    
    // Check match_starting events
    const matchStartingEvents = players.map(p => 
      playerEvents[p.id].events.find(e => e.event === 'match_starting')
    );
    
    const allReceivedStarting = matchStartingEvents.every(e => e !== undefined);
    if (allReceivedStarting) {
      success('All players received match_starting');
      
      // Check countdown values
      const countdowns = matchStartingEvents.map(e => e?.data?.countdown);
      if (countdowns.every(c => c !== undefined)) {
        success(`All players received countdown: ${countdowns.join(', ')}`);
      } else {
        fail('Countdown', 'Some players missing countdown value');
      }
    } else {
      fail('Match starting', 'Not all players received match_starting event');
    }
    
    // Check match_started events
    const matchStartedEvents = players.map(p => 
      playerEvents[p.id].events.find(e => e.event === 'match_started')
    );
    
    const allReceivedStarted = matchStartedEvents.every(e => e !== undefined);
    if (allReceivedStarted) {
      success('All players received match_started');
    } else {
      fail('Match started', 'Not all players received match_started event');
    }
    
    // ===== PHASE 5: Game State =====
    console.log(`\n${colors.bright}PHASE 5: Game State Verification${colors.reset}\n`);
    
    await delay(1000); // Let game state settle
    
    // Check game state reception
    for (let i = 0; i < players.length; i++) {
      const player = playerEvents[i];
      
      if (player.gameState) {
        const state = player.gameState;
        const playerCount = Object.keys(state.players || {}).length;
        const wallCount = Object.keys(state.walls || {}).length;
        
        if (playerCount > 0) {
          success(`Player ${i} has game state with ${playerCount} players, ${wallCount} walls`);
        } else {
          fail(`Player ${i} game state`, 'No players in state');
        }
        
        // Check if player sees themselves
        const myId = players[i].socket.id;
        if (state.players && state.players[myId]) {
          success(`Player ${i} sees themselves in game state`);
        } else {
          fail(`Player ${i} self visibility`, 'Cannot see self in game state');
        }
      } else {
        fail(`Player ${i} game state`, 'Never received game:state');
      }
    }
    
    // Check if all players see each other
    const allPlayerIds = players.map(p => p.socket.id);
    let allSeeEachOther = true;
    
    for (let i = 0; i < players.length; i++) {
      const state = playerEvents[i].gameState;
      if (state && state.players) {
        for (const id of allPlayerIds) {
          if (!state.players[id]) {
            allSeeEachOther = false;
            fail(`Player ${i} visibility`, `Cannot see player ${id}`);
          }
        }
      }
    }
    
    if (allSeeEachOther) {
      success('All players see each other in game');
    }
    
    // ===== PHASE 6: In-Game Events =====
    console.log(`\n${colors.bright}PHASE 6: In-Game Event Testing${colors.reset}\n`);
    
    // Test player movement
    log('Testing player movement...', colors.yellow);
    players[0].socket.emit('player:input', {
      movement: { x: 1, y: 0 },
      sequence: 1
    });
    
    await delay(500);
    
    // Test weapon equip
    log('Testing weapon equip...', colors.yellow);
    players[0].socket.emit('weapon:equip', {
      weaponId: 'pistol'
    });
    
    await delay(500);
    
    // Check if other players received updates
    const player1Updates = playerEvents[1].events.filter(e => 
      e.event === 'game:state' || e.event === 'player:updated'
    );
    
    if (player1Updates.length > 0) {
      success(`Player 1 received ${player1Updates.length} game updates`);
    } else {
      warn('Player 1 may not be receiving game updates');
    }
    
    // ===== PHASE 7: Player Leave =====
    console.log(`\n${colors.bright}PHASE 7: Player Leave Testing${colors.reset}\n`);
    
    log(`Player ${NUM_PLAYERS - 1} leaving...`, colors.yellow);
    players[NUM_PLAYERS - 1].socket.emit('leave_lobby');
    
    await delay(1000);
    
    // Check if others received leave notification
    for (let i = 0; i < players.length - 1; i++) {
      const leaveEvents = playerEvents[i].events.filter(e => 
        e.event === 'player_left_lobby' || e.event === 'player:left'
      );
      
      if (leaveEvents.length > 0) {
        success(`Player ${i} received leave notification`);
      } else {
        fail(`Player ${i} leave notification`, 'No leave event received');
      }
    }
    
  } catch (error) {
    fail('Test execution', error.message);
  } finally {
    // Cleanup
    console.log(`\n${colors.bright}=== CLEANUP ===${colors.reset}\n`);
    
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
    
    // Overall result
    console.log(`\n${colors.bright}=== OVERALL RESULT ===${colors.reset}`);
    if (testResults.failed.length === 0) {
      console.log(`${colors.green}✅ ALL CRITICAL TESTS PASSED${colors.reset}`);
      console.log('Users are properly passing through the entire system!');
    } else {
      console.log(`${colors.red}❌ SOME TESTS FAILED${colors.reset}`);
      console.log('There are issues in the user flow that need attention.');
    }
    
    process.exit(testResults.failed.length > 0 ? 1 : 0);
  }
}

// Run the tests
console.log(`${colors.bright}Starting End-to-End Test Suite${colors.reset}`);
console.log(`Server: ${SERVER_URL}`);
console.log(`Testing with ${NUM_PLAYERS} players\n`);

runTests().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});
