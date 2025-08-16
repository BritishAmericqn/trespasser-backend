#!/usr/bin/env node

/**
 * PROOF OF CONCEPT TEST
 * This test will clearly demonstrate each feature working
 * with detailed logging and verification
 */

const io = require('socket.io-client');
const SERVER_URL = 'http://localhost:3000';

// Color codes for clear output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createTestClient(name) {
  return new Promise((resolve, reject) => {
    const client = io(SERVER_URL, { reconnection: false });
    const timeout = setTimeout(() => {
      client.disconnect();
      reject(new Error(`${name} failed to connect`));
    }, 5000);
    
    client.once('connect', () => {
      clearTimeout(timeout);
      log(`✓ ${name} connected: ${client.id.substring(0, 8)}`, colors.green);
      resolve(client);
    });
    
    client.on('error', (error) => {
      log(`✗ ${name} error: ${error}`, colors.red);
    });
  });
}

async function testServerBrowser() {
  log('\n' + '='.repeat(60), colors.bold);
  log('TEST 1: SERVER BROWSER FUNCTIONALITY', colors.bold + colors.cyan);
  log('='.repeat(60), colors.bold);
  
  let success = true;
  
  try {
    // Create Alice who will create a lobby
    const alice = await createTestClient('Alice');
    
    // Alice creates a game via quickplay
    log('\n1. Alice creates a game via quickplay...', colors.yellow);
    const aliceJoined = new Promise((resolve) => {
      alice.once('lobby_joined', (data) => {
        log(`   ✓ Alice joined lobby: ${data.lobbyId}`, colors.green);
        log(`     Status: ${data.status}, Players: ${data.playerCount}/${data.maxPlayers}`, colors.cyan);
        resolve(data);
      });
    });
    
    alice.emit('find_match');
    const aliceData = await aliceJoined;
    
    await delay(1000);
    
    // Create Bob who will browse for lobbies
    const bob = await createTestClient('Bob');
    
    // Bob requests lobby list
    log('\n2. Bob requests lobby list...', colors.yellow);
    const lobbyListReceived = new Promise((resolve) => {
      bob.once('lobby_list', (data) => {
        if (data.error) {
          log(`   ✗ Error: ${data.error}`, colors.red);
          success = false;
        } else {
          log(`   ✓ Received ${data.lobbies.length} lobbies:`, colors.green);
          data.lobbies.forEach((lobby, i) => {
            log(`     ${i+1}. ${lobby.lobbyId}`, colors.cyan);
            log(`        Players: ${lobby.playerCount}/${lobby.maxPlayers}`, colors.cyan);
            log(`        Status: ${lobby.status}`, colors.cyan);
            log(`        Mode: ${lobby.gameMode}`, colors.cyan);
            log(`        Private: ${lobby.isPrivate}`, colors.cyan);
          });
          
          // Verify Alice's lobby is in the list
          const aliceLobby = data.lobbies.find(l => l.lobbyId === aliceData.lobbyId);
          if (aliceLobby) {
            log(`   ✓ Alice's lobby found in server browser!`, colors.green);
          } else {
            log(`   ✗ Alice's lobby NOT found in server browser!`, colors.red);
            success = false;
          }
        }
        resolve(data);
      });
    });
    
    bob.emit('get_lobby_list');
    await lobbyListReceived;
    
    // Clean up
    alice.disconnect();
    bob.disconnect();
    await delay(500);
    
    if (success) {
      log('\n✓ SERVER BROWSER TEST PASSED!', colors.bold + colors.green);
    } else {
      log('\n✗ SERVER BROWSER TEST FAILED!', colors.bold + colors.red);
    }
    
    return success;
  } catch (error) {
    log(`\n✗ SERVER BROWSER TEST FAILED: ${error.message}`, colors.bold + colors.red);
    return false;
  }
}

async function testPrivateLobbies() {
  log('\n' + '='.repeat(60), colors.bold);
  log('TEST 2: PRIVATE LOBBY WITH PASSWORD', colors.bold + colors.cyan);
  log('='.repeat(60), colors.bold);
  
  let success = true;
  
  try {
    // Host creates private lobby
    const host = await createTestClient('Host');
    
    log('\n1. Host creates private lobby with password...', colors.yellow);
    const lobbyCreated = new Promise((resolve) => {
      host.once('private_lobby_created', (data) => {
        log(`   ✓ Private lobby created: ${data.lobbyId}`, colors.green);
        log(`     Password set: "secret123"`, colors.cyan);
        log(`     Share code: ${data.lobbyId}`, colors.cyan);
        resolve(data);
      });
    });
    
    host.emit('create_private_lobby', {
      password: 'secret123',
      maxPlayers: 4,
      gameMode: 'deathmatch'
    });
    
    const lobbyData = await lobbyCreated;
    await delay(1000);
    
    // Friend tries to join with correct password
    const friend = await createTestClient('Friend');
    
    log('\n2. Friend joins with correct password...', colors.yellow);
    const friendJoined = new Promise((resolve) => {
      friend.once('lobby_joined', (data) => {
        log(`   ✓ Friend joined successfully!`, colors.green);
        log(`     Lobby: ${data.lobbyId}`, colors.cyan);
        log(`     Players: ${data.playerCount}/${data.maxPlayers}`, colors.cyan);
        resolve(true);
      });
      
      friend.once('join_error', (error) => {
        log(`   ✗ Friend rejected: ${error}`, colors.red);
        success = false;
        resolve(false);
      });
    });
    
    friend.emit('join_lobby', {
      lobbyId: lobbyData.lobbyId,
      password: 'secret123'
    });
    
    await friendJoined;
    await delay(500);
    
    // Stranger tries with wrong password
    const stranger = await createTestClient('Stranger');
    
    log('\n3. Stranger tries with wrong password...', colors.yellow);
    const strangerRejected = new Promise((resolve) => {
      stranger.once('join_error', (error) => {
        log(`   ✓ Stranger correctly rejected: ${error}`, colors.green);
        resolve(true);
      });
      
      stranger.once('lobby_joined', () => {
        log(`   ✗ Stranger incorrectly allowed in!`, colors.red);
        success = false;
        resolve(false);
      });
    });
    
    stranger.emit('join_lobby', {
      lobbyId: lobbyData.lobbyId,
      password: 'wrongpass'
    });
    
    await strangerRejected;
    
    // Clean up
    host.disconnect();
    friend.disconnect();
    stranger.disconnect();
    await delay(500);
    
    if (success) {
      log('\n✓ PRIVATE LOBBY TEST PASSED!', colors.bold + colors.green);
    } else {
      log('\n✗ PRIVATE LOBBY TEST FAILED!', colors.bold + colors.red);
    }
    
    return success;
  } catch (error) {
    log(`\n✗ PRIVATE LOBBY TEST FAILED: ${error.message}`, colors.bold + colors.red);
    return false;
  }
}

async function testMidGameJoining() {
  log('\n' + '='.repeat(60), colors.bold);
  log('TEST 3: MID-GAME JOINING', colors.bold + colors.cyan);
  log('='.repeat(60), colors.bold);
  
  let success = true;
  
  try {
    // Create two players to start a game
    const player1 = await createTestClient('Player1');
    const player2 = await createTestClient('Player2');
    
    log('\n1. Starting a game with 2 players...', colors.yellow);
    
    // Both join via quickplay
    const p1Joined = new Promise(resolve => {
      player1.once('lobby_joined', resolve);
    });
    const p2Joined = new Promise(resolve => {
      player2.once('lobby_joined', resolve);
    });
    
    player1.emit('find_match');
    const p1Data = await p1Joined;
    
    await delay(500);
    player2.emit('find_match');
    const p2Data = await p2Joined;
    
    log(`   ✓ Both players in lobby: ${p1Data.lobbyId}`, colors.green);
    
    // Wait for match to start
    log('\n2. Waiting for match to start...', colors.yellow);
    const matchStarted = new Promise(resolve => {
      player1.once('match_started', () => {
        log(`   ✓ Match started!`, colors.green);
        resolve();
      });
    });
    
    await Promise.race([
      matchStarted,
      delay(6000) // Match should start in 5 seconds
    ]);
    
    await delay(2000); // Let the game run for a bit
    
    // Late joiner attempts to join
    const lateJoiner = await createTestClient('LateJoiner');
    
    log('\n3. Late joiner attempts to join mid-game...', colors.yellow);
    const lateJoinResult = new Promise((resolve) => {
      lateJoiner.once('lobby_joined', (data) => {
        log(`   ✓ Late joiner successfully joined!`, colors.green);
        log(`     Status: ${data.status}`, colors.cyan);
        log(`     In Progress: ${data.isInProgress}`, colors.cyan);
        
        if (data.status === 'playing' || data.isInProgress) {
          log(`   ✓ Correctly identified as joining game in progress!`, colors.green);
        } else {
          log(`   ✗ Status incorrect - should show as in progress!`, colors.red);
          success = false;
        }
        resolve(true);
      });
      
      lateJoiner.once('late_join_notification', (data) => {
        log(`   ✓ Received late join notification:`, colors.green);
        log(`     Spawn protection: ${data.spawnProtectionSeconds}s`, colors.cyan);
        log(`     Safe spawn: ${JSON.stringify(data.spawnPoint)}`, colors.cyan);
      });
      
      lateJoiner.once('join_error', (error) => {
        log(`   ✗ Late joiner rejected: ${error}`, colors.red);
        success = false;
        resolve(false);
      });
    });
    
    lateJoiner.emit('join_lobby', {
      lobbyId: p1Data.lobbyId
    });
    
    await lateJoinResult;
    
    // Clean up
    player1.disconnect();
    player2.disconnect();
    lateJoiner.disconnect();
    await delay(500);
    
    if (success) {
      log('\n✓ MID-GAME JOINING TEST PASSED!', colors.bold + colors.green);
    } else {
      log('\n✗ MID-GAME JOINING TEST FAILED!', colors.bold + colors.red);
    }
    
    return success;
  } catch (error) {
    log(`\n✗ MID-GAME JOINING TEST FAILED: ${error.message}`, colors.bold + colors.red);
    return false;
  }
}

async function testLobbyFiltering() {
  log('\n' + '='.repeat(60), colors.bold);
  log('TEST 4: LOBBY FILTERING', colors.bold + colors.cyan);
  log('='.repeat(60), colors.bold);
  
  let success = true;
  
  try {
    // Create a private lobby
    const hostPrivate = await createTestClient('PrivateHost');
    
    log('\n1. Creating private lobby...', colors.yellow);
    const privateCreated = new Promise(resolve => {
      hostPrivate.once('private_lobby_created', resolve);
    });
    
    hostPrivate.emit('create_private_lobby', {
      password: 'test',
      maxPlayers: 2
    });
    
    const privateData = await privateCreated;
    log(`   ✓ Private lobby created: ${privateData.lobbyId}`, colors.green);
    
    // Create a public lobby
    const hostPublic = await createTestClient('PublicHost');
    
    log('\n2. Creating public lobby...', colors.yellow);
    const publicJoined = new Promise(resolve => {
      hostPublic.once('lobby_joined', resolve);
    });
    
    hostPublic.emit('find_match');
    const publicData = await publicJoined;
    log(`   ✓ Public lobby created: ${publicData.lobbyId}`, colors.green);
    
    await delay(1000);
    
    // Test filtering
    const browser = await createTestClient('Browser');
    
    log('\n3. Testing filter: default (no private lobbies)...', colors.yellow);
    const defaultList = await new Promise(resolve => {
      browser.once('lobby_list', (data) => {
        log(`   Received ${data.lobbies.length} lobbies`, colors.cyan);
        const hasPrivate = data.lobbies.some(l => l.isPrivate);
        if (!hasPrivate) {
          log(`   ✓ Correctly hides private lobbies by default!`, colors.green);
        } else {
          log(`   ✗ Private lobbies incorrectly shown!`, colors.red);
          success = false;
        }
        resolve();
      });
      browser.emit('get_lobby_list');
    });
    
    log('\n4. Testing filter: showPrivate=true...', colors.yellow);
    await new Promise(resolve => {
      browser.once('lobby_list', (data) => {
        log(`   Received ${data.lobbies.length} lobbies`, colors.cyan);
        const privateFound = data.lobbies.find(l => l.lobbyId === privateData.lobbyId);
        const publicFound = data.lobbies.find(l => l.lobbyId === publicData.lobbyId);
        
        if (privateFound && publicFound) {
          log(`   ✓ Both private and public lobbies shown!`, colors.green);
        } else {
          log(`   ✗ Missing lobbies in filtered list!`, colors.red);
          success = false;
        }
        resolve();
      });
      browser.emit('get_lobby_list', { showPrivate: true });
    });
    
    // Clean up
    hostPrivate.disconnect();
    hostPublic.disconnect();
    browser.disconnect();
    await delay(500);
    
    if (success) {
      log('\n✓ LOBBY FILTERING TEST PASSED!', colors.bold + colors.green);
    } else {
      log('\n✗ LOBBY FILTERING TEST FAILED!', colors.bold + colors.red);
    }
    
    return success;
  } catch (error) {
    log(`\n✗ LOBBY FILTERING TEST FAILED: ${error.message}`, colors.bold + colors.red);
    return false;
  }
}

async function runAllTests() {
  log('\n' + '█'.repeat(60), colors.bold + colors.magenta);
  log('  SERVER BROWSER & FRIEND SYSTEM - VERIFICATION SUITE', colors.bold + colors.magenta);
  log('█'.repeat(60) + '\n', colors.bold + colors.magenta);
  
  const results = {
    serverBrowser: false,
    privateLobbies: false,
    midGameJoining: false,
    lobbyFiltering: false
  };
  
  // Run tests sequentially with cleanup between
  results.serverBrowser = await testServerBrowser();
  await delay(2000);
  
  results.privateLobbies = await testPrivateLobbies();
  await delay(2000);
  
  results.midGameJoining = await testMidGameJoining();
  await delay(2000);
  
  results.lobbyFiltering = await testLobbyFiltering();
  
  // Final summary
  log('\n' + '='.repeat(60), colors.bold);
  log('FINAL RESULTS', colors.bold + colors.cyan);
  log('='.repeat(60), colors.bold);
  
  let totalPassed = 0;
  let totalTests = 0;
  
  Object.entries(results).forEach(([test, passed]) => {
    totalTests++;
    if (passed) {
      totalPassed++;
      log(`✓ ${test}: PASSED`, colors.green);
    } else {
      log(`✗ ${test}: FAILED`, colors.red);
    }
  });
  
  log('\n' + '='.repeat(60), colors.bold);
  if (totalPassed === totalTests) {
    log(`ALL TESTS PASSED! (${totalPassed}/${totalTests})`, colors.bold + colors.green);
    log('🎉 Server browser and friend system VERIFIED WORKING! 🎉', colors.bold + colors.green);
  } else {
    log(`SOME TESTS FAILED! (${totalPassed}/${totalTests})`, colors.bold + colors.red);
    log('Please check the implementation.', colors.yellow);
  }
  log('='.repeat(60) + '\n', colors.bold);
  
  process.exit(totalPassed === totalTests ? 0 : 1);
}

// Run the tests
runAllTests().catch(error => {
  log(`\nFATAL ERROR: ${error.message}`, colors.bold + colors.red);
  process.exit(1);
});
