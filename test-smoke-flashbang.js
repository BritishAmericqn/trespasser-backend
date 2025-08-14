#!/usr/bin/env node

/**
 * Smoke Grenade and Flashbang Test Script
 * Tests the new tactical equipment systems
 */

const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';
const TEST_PLAYER_1 = 'smoke_test_1';
const TEST_PLAYER_2 = 'flash_test_2';

let socket1, socket2;
let gameState = null;

console.log('🧪 Starting Smoke Grenade and Flashbang Test...\n');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createSocket(playerId) {
  const socket = io(SERVER_URL, {
    query: { playerId, team: Math.random() > 0.5 ? 'red' : 'blue' }
  });
  
  socket.on('connect', () => {
    console.log(`✅ ${playerId} connected`);
  });
  
  socket.on('disconnect', () => {
    console.log(`❌ ${playerId} disconnected`);
  });
  
  socket.on('game_state', (state) => {
    gameState = state;
    if (state.players && state.players[playerId]) {
      const player = state.players[playerId];
      console.log(`🎮 ${playerId} - Position: (${player.transform.position.x.toFixed(1)}, ${player.transform.position.y.toFixed(1)})`);
      
      // Log effect state if present
      if (player.effectState && player.effectState.flashbangIntensity > 0) {
        console.log(`⚡ ${playerId} - Flash Effect: ${(player.effectState.flashbangIntensity * 100).toFixed(1)}% intensity, Phase: ${player.effectState.flashbangRecoveryPhase}`);
      }
    }
  });
  
  socket.on('projectile_exploded', (data) => {
    if (data.type === 'smoke') {
      console.log(`💨 Smoke deployed at (${data.position.x.toFixed(1)}, ${data.position.y.toFixed(1)}) with radius ${data.radius}`);
    } else if (data.type === 'flash') {
      console.log(`⚡ Flashbang exploded at (${data.position.x.toFixed(1)}, ${data.position.y.toFixed(1)}) with radius ${data.radius}`);
    }
  });
  
  socket.on('FLASHBANG_EFFECT', (data) => {
    console.log(`⚡ Flashbang Effect Event:`);
    console.log(`   Position: (${data.position.x.toFixed(1)}, ${data.position.y.toFixed(1)})`);
    console.log(`   Affected Players: ${data.affectedPlayers.length}`);
    for (const affected of data.affectedPlayers) {
      console.log(`   - ${affected.playerId}: ${(affected.intensity * 100).toFixed(1)}% intensity, ${affected.duration}ms duration`);
    }
  });
  
  return socket;
}

function sendInput(socket, playerId, input) {
  socket.emit('player_input', {
    playerId,
    input: {
      keys: { w: false, a: false, s: false, d: false, shift: false, ctrl: false, r: false, g: false, '1': false, '2': false, '3': false, '4': false, ...input.keys },
      mouse: { x: 240, y: 135, buttons: 0, leftPressed: false, rightPressed: false, leftReleased: false, rightReleased: false, ...input.mouse },
      sequence: Date.now(),
      timestamp: Date.now()
    }
  });
}

async function runTest() {
  try {
    // Connect both players
    socket1 = createSocket(TEST_PLAYER_1);
    socket2 = createSocket(TEST_PLAYER_2);
    
    await sleep(2000); // Wait for connections
    
    console.log('\n🔄 Test Phase 1: Equipment Selection');
    
    // Switch both players to smoke grenades (support weapon slot 1)
    sendInput(socket1, TEST_PLAYER_1, { keys: { '3': true } });
    await sleep(500);
    
    // Switch player 2 to flashbangs
    sendInput(socket2, TEST_PLAYER_2, { keys: { '4': true } });
    await sleep(500);
    
    console.log('\n💨 Test Phase 2: Smoke Grenade Deployment');
    
    // Move player 1 to center and throw smoke grenade
    sendInput(socket1, TEST_PLAYER_1, { 
      keys: { w: true },
      mouse: { x: 240, y: 100 }
    });
    await sleep(1000);
    
    sendInput(socket1, TEST_PLAYER_1, { 
      keys: { g: true },
      mouse: { x: 260, y: 120 }
    });
    await sleep(500);
    
    console.log('   Smoke grenade thrown, waiting for deployment...');
    await sleep(3000); // Wait for smoke to deploy
    
    console.log('\n⚡ Test Phase 3: Flashbang Test');
    
    // Position player 2 and throw flashbang near player 1
    sendInput(socket2, TEST_PLAYER_2, {
      mouse: { x: 200, y: 100 }
    });
    await sleep(200);
    
    sendInput(socket2, TEST_PLAYER_2, { 
      keys: { g: true },
      mouse: { x: 250, y: 110 }
    });
    await sleep(500);
    
    console.log('   Flashbang thrown, waiting for detonation...');
    await sleep(2000); // Wait for flashbang to explode
    
    console.log('\n🔄 Test Phase 4: Effect Recovery');
    console.log('   Monitoring player recovery from flashbang...');
    await sleep(5000); // Monitor recovery
    
    console.log('\n💨 Test Phase 5: Smoke Zone Persistence');
    console.log('   Testing smoke zone duration and wind drift...');
    await sleep(10000); // Let smoke persist and test vision blocking
    
    console.log('\n✅ Test Complete!');
    console.log('\nExpected Results:');
    console.log('- Smoke grenade should deploy and expand over 3 seconds');
    console.log('- Smoke should drift with wind and fade after 15 seconds');
    console.log('- Vision should be blocked through smoke zones');
    console.log('- Flashbang should affect nearby players based on line-of-sight');
    console.log('- Flash effects should have blind → disoriented → recovering phases');
    console.log('- Effects should vary based on distance and viewing angle');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (socket1) socket1.disconnect();
    if (socket2) socket2.disconnect();
    process.exit(0);
  }
}

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  if (socket1) socket1.disconnect();
  if (socket2) socket2.disconnect();
  process.exit(0);
});

runTest();
