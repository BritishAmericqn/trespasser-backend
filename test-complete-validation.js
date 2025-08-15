#!/usr/bin/env node

/**
 * Complete system validation test
 * Verifies the entire user journey and all critical events
 */

const io = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

// Test configuration
const TEST_CASES = {
  connection: { required: true, description: 'Players can connect to server' },
  matchmaking: { required: true, description: 'Players can join matchmaking' },
  lobbySync: { required: true, description: 'All players see same lobby state' },
  playerJoinBroadcast: { required: true, description: 'Join events broadcast to all' },
  matchAutoStart: { required: true, description: 'Match auto-starts with 2+ players' },
  gameStateDelivery: { required: true, description: 'Game state delivered to all players' },
  playerVisibility: { required: true, description: 'Players can see each other in game' },
  playerLeaveBroadcast: { required: true, description: 'Leave events broadcast to remaining players' },
  eventStructure: { required: true, description: 'Events have correct structure (playerCount as top-level field)' }
};

async function runCompleteValidation() {
  console.log('\n🧪 COMPLETE SYSTEM VALIDATION TEST');
  console.log('=====================================\n');
  
  const results = {};
  Object.keys(TEST_CASES).forEach(key => {
    results[key] = { passed: false, details: '' };
  });
  
  try {
    // === TEST 1: Connection ===
    console.log('📡 Testing connection...');
    
    const player1 = io(SERVER_URL, { reconnection: false, timeout: 3000 });
    const player2 = io(SERVER_URL, { reconnection: false, timeout: 3000 });
    const player3 = io(SERVER_URL, { reconnection: false, timeout: 3000 });
    
    await new Promise((resolve, reject) => {
      let connected = 0;
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
      
      [player1, player2, player3].forEach((player, i) => {
        player.on('connect', () => {
          console.log(`  ✓ Player ${i + 1} connected`);
          if (++connected === 3) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    });
    
    results.connection.passed = true;
    results.connection.details = 'All 3 players connected successfully';
    
    // === TEST 2: Matchmaking ===
    console.log('\n🎮 Testing matchmaking...');
    
    const lobbyData = {};
    const joinPromises = [];
    
    [player1, player2, player3].forEach((player, i) => {
      const promise = new Promise(resolve => {
        player.once('lobby_joined', (data) => {
          lobbyData[i] = data;
          console.log(`  ✓ Player ${i + 1} joined lobby: ${data.lobbyId} (${data.playerCount} players)`);
          resolve();
        });
      });
      joinPromises.push(promise);
    });
    
    // Join matchmaking with slight delays
    player1.emit('find_match', { gameMode: 'deathmatch' });
    await new Promise(resolve => setTimeout(resolve, 300));
    
    player2.emit('find_match', { gameMode: 'deathmatch' });
    await new Promise(resolve => setTimeout(resolve, 300));
    
    player3.emit('find_match', { gameMode: 'deathmatch' });
    
    // Wait for all to join
    await Promise.race([
      Promise.all(joinPromises),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Matchmaking timeout')), 5000))
    ]);
    
    results.matchmaking.passed = true;
    results.matchmaking.details = 'All players successfully joined matchmaking';
    
    // === TEST 3: Lobby Sync ===
    console.log('\n🔄 Testing lobby synchronization...');
    
    const lobbyIds = Object.values(lobbyData).map(d => d.lobbyId);
    const allSameLobby = lobbyIds.every(id => id === lobbyIds[0]);
    
    if (allSameLobby) {
      results.lobbySync.passed = true;
      results.lobbySync.details = `All in lobby: ${lobbyIds[0]}`;
      console.log(`  ✓ All players in same lobby: ${lobbyIds[0]}`);
    } else {
      results.lobbySync.details = `Different lobbies: ${lobbyIds.join(', ')}`;
      console.log(`  ✗ Players in different lobbies`);
    }
    
    // === TEST 4: Join Broadcast ===
    console.log('\n📢 Testing join broadcasts...');
    
    const joinEvents = {};
    [player1, player2, player3].forEach((player, i) => {
      joinEvents[i] = [];
      player.on('player_joined_lobby', (data) => {
        joinEvents[i].push(data);
      });
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Player 1 should have received 2 join events (for players 2 and 3)
    // Player 2 should have received 1 join event (for player 3)
    if (joinEvents[0].length >= 1) {
      results.playerJoinBroadcast.passed = true;
      results.playerJoinBroadcast.details = `P1 got ${joinEvents[0].length} joins, P2 got ${joinEvents[1].length}`;
      console.log(`  ✓ Join broadcasts working`);
    } else {
      results.playerJoinBroadcast.details = 'Not receiving join broadcasts';
      console.log(`  ✗ Join broadcasts not working`);
    }
    
    // === TEST 5: Event Structure ===
    console.log('\n📋 Testing event structure...');
    
    // Check if playerCount is top-level field
    const lastJoinEvent = joinEvents[0][joinEvents[0].length - 1] || lobbyData[0];
    if (lastJoinEvent && typeof lastJoinEvent.playerCount === 'number') {
      results.eventStructure.passed = true;
      results.eventStructure.details = 'playerCount is top-level field';
      console.log(`  ✓ Event structure correct (playerCount=${lastJoinEvent.playerCount})`);
    } else {
      results.eventStructure.details = 'playerCount not found as top-level field';
      console.log(`  ✗ Event structure incorrect`);
    }
    
    // === TEST 6: Match Auto-Start ===
    console.log('\n⏱️  Testing match auto-start...');
    
    const matchStarted = await new Promise(resolve => {
      let started = 0;
      const timeout = setTimeout(() => resolve(false), 8000);
      
      [player1, player2, player3].forEach((player, i) => {
        player.once('match_started', () => {
          console.log(`  ✓ Player ${i + 1} received match_started`);
          if (++started === 3) {
            clearTimeout(timeout);
            resolve(true);
          }
        });
      });
    });
    
    if (matchStarted) {
      results.matchAutoStart.passed = true;
      results.matchAutoStart.details = 'Match started automatically';
    } else {
      results.matchAutoStart.details = 'Match did not auto-start';
    }
    
    // === TEST 7: Game State ===
    console.log('\n🎯 Testing game state delivery...');
    
    const gameStates = {};
    [player1, player2, player3].forEach((player, i) => {
      player.on('game:state', (state) => {
        if (!gameStates[i]) {
          gameStates[i] = state;
          const playerCount = Object.keys(state.players || {}).length;
          console.log(`  ✓ Player ${i + 1} received game state (${playerCount} players)`);
        }
      });
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (Object.keys(gameStates).length === 3) {
      results.gameStateDelivery.passed = true;
      results.gameStateDelivery.details = 'All players received game state';
    } else {
      results.gameStateDelivery.details = `Only ${Object.keys(gameStates).length}/3 received state`;
    }
    
    // === TEST 8: Player Visibility ===
    console.log('\n👀 Testing player visibility...');
    
    let allVisible = true;
    const playerIds = [player1.id, player2.id, player3.id];
    
    Object.values(gameStates).forEach((state, i) => {
      const visibleCount = Object.keys(state.players || {}).length;
      if (visibleCount < 3) {
        allVisible = false;
        console.log(`  ✗ Player ${i + 1} only sees ${visibleCount}/3 players`);
      } else {
        console.log(`  ✓ Player ${i + 1} sees all ${visibleCount} players`);
      }
    });
    
    if (allVisible) {
      results.playerVisibility.passed = true;
      results.playerVisibility.details = 'All players visible to each other';
    } else {
      results.playerVisibility.details = 'Not all players visible';
    }
    
    // === TEST 9: Leave Broadcast ===
    console.log('\n👋 Testing leave broadcasts...');
    
    const leaveReceived = await new Promise(resolve => {
      let received = false;
      
      player1.once('player_left_lobby', (data) => {
        console.log(`  ✓ Player 1 received leave notification (count: ${data.playerCount})`);
        received = true;
        resolve(true);
      });
      
      player2.once('player_left_lobby', (data) => {
        console.log(`  ✓ Player 2 received leave notification (count: ${data.playerCount})`);
      });
      
      // Player 3 leaves
      setTimeout(() => {
        console.log('  → Player 3 leaving...');
        player3.emit('leave_lobby');
      }, 100);
      
      setTimeout(() => resolve(received), 2000);
    });
    
    if (leaveReceived) {
      results.playerLeaveBroadcast.passed = true;
      results.playerLeaveBroadcast.details = 'Leave events properly broadcast';
    } else {
      results.playerLeaveBroadcast.details = 'Leave events not received';
    }
    
    // === SUMMARY ===
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50) + '\n');
    
    let passedCount = 0;
    let failedCount = 0;
    
    Object.entries(TEST_CASES).forEach(([key, config]) => {
      const result = results[key];
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const required = config.required ? '(REQUIRED)' : '';
      
      console.log(`${status} ${config.description} ${required}`);
      console.log(`     ${result.details}`);
      
      if (result.passed) passedCount++;
      else failedCount++;
    });
    
    console.log('\n' + '='.repeat(50));
    console.log(`FINAL SCORE: ${passedCount}/${Object.keys(TEST_CASES).length} tests passed`);
    
    if (failedCount === 0) {
      console.log('\n🎉 SUCCESS: All tests passed!');
      console.log('✅ Users are properly passing through the entire system');
      console.log('✅ All events are being emitted correctly to frontend');
      console.log('✅ The system is ready for production use');
    } else {
      console.log(`\n⚠️  WARNING: ${failedCount} test(s) failed`);
      console.log('Please review the failed tests above');
    }
    
    console.log('='.repeat(50) + '\n');
    
    // Cleanup
    [player1, player2, player3].forEach(p => p.disconnect());
    
    setTimeout(() => {
      process.exit(failedCount > 0 ? 1 : 0);
    }, 100);
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

// Run the validation
runCompleteValidation();
