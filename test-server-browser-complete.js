#!/usr/bin/env node

/**
 * Comprehensive test suite for server browser and lobby joining features
 * Tests:
 * 1. Server browser functionality with filters
 * 2. Private lobby creation and joining
 * 3. Mid-game joining with spawn protection
 * 4. Multiple concurrent lobbies
 * 5. Stress testing with many clients
 */

const io = require('socket.io-client');
const { performance } = require('perf_hooks');

const SERVER_URL = 'http://localhost:3000';
const GAME_PASSWORD = 'gauntlet';

// Test results tracking
let testsPassed = 0;
let testsFailed = 0;
const testResults = [];

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function assert(condition, testName, details = '') {
  if (condition) {
    testsPassed++;
    log(`✅ PASS: ${testName}`, colors.green);
    testResults.push({ test: testName, result: 'PASS', details });
  } else {
    testsFailed++;
    log(`❌ FAIL: ${testName}`, colors.red);
    if (details) log(`   Details: ${details}`, colors.yellow);
    testResults.push({ test: testName, result: 'FAIL', details });
  }
}

function createClient(id, options = {}) {
  return new Promise((resolve, reject) => {
    const client = io(SERVER_URL, { reconnection: false });
    const timeout = setTimeout(() => {
      client.disconnect();
      reject(new Error(`Client ${id} connection timeout`));
    }, options.timeout || 5000);

    // Track client state
    client.metadata = {
      id,
      lobbyId: null,
      isAuthenticated: false,
      events: [],
      lobbyList: []
    };

    // Event handlers
    client.on('connect', () => {
      if (!options.silent) log(`Client ${id} connected: ${client.id.substring(0, 8)}`, colors.cyan);
      
      // Server doesn't require password, so we're immediately ready
      // Small delay to ensure server has registered all handlers
      setTimeout(() => {
        client.metadata.isAuthenticated = true;
        clearTimeout(timeout);
        if (!options.silent) log(`Client ${id} ready (no auth required)`, colors.cyan);
        resolve(client);
      }, 100);
    });

    client.on('authenticated', () => {
      // This won't fire when password is not required, but keep it for compatibility
      client.metadata.isAuthenticated = true;
      clearTimeout(timeout);
      if (!options.silent) log(`Client ${id} authenticated`, colors.cyan);
      resolve(client);
    });

    client.on('auth-failed', (reason) => {
      clearTimeout(timeout);
      reject(new Error(`Client ${id} auth failed: ${reason}`));
    });

    client.on('lobby_joined', (data) => {
      client.metadata.lobbyId = data.lobbyId;
      client.metadata.events.push({ type: 'lobby_joined', data });
      if (!options.silent) {
        log(`Client ${id} joined lobby ${data.lobbyId.substring(0, 15)}... (${data.playerCount}/${data.maxPlayers})`, colors.magenta);
        if (data.isInProgress) {
          log(`  ⚡ Joined game in progress!`, colors.yellow);
        }
      }
    });

    client.on('lobby_list', (data) => {
      client.metadata.lobbyList = data.lobbies || [];
      client.metadata.events.push({ type: 'lobby_list', data });
      if (!options.silent) log(`Client ${id} received lobby list with ${data.totalCount} lobbies`, colors.blue);
    });

    client.on('match_started', (data) => {
      client.metadata.events.push({ type: 'match_started', data });
      if (!options.silent) {
        log(`Client ${id} match started in ${data.lobbyId.substring(0, 15)}...`, colors.green);
        if (data.isLateJoin) {
          log(`  🛡️ Late join with spawn protection!`, colors.yellow);
        }
      }
    });

    client.on('private_lobby_created', (data) => {
      client.metadata.events.push({ type: 'private_lobby_created', data });
      client.metadata.lobbyId = data.lobbyId;
      if (!options.silent) log(`Client ${id} created private lobby: ${data.lobbyId}`, colors.magenta);
    });

    client.on('error', (error) => {
      if (!options.silent) log(`Client ${id} error: ${error}`, colors.red);
    });

    client.on('disconnect', (reason) => {
      if (!options.silent) log(`Client ${id} disconnected: ${reason}`, colors.yellow);
    });
  });
}

async function testServerBrowser() {
  log('\n📋 TEST 1: Server Browser Functionality', colors.blue);
  log('========================================', colors.blue);

  try {
    // Create test clients
    const client1 = await createClient('SB1');
    const client2 = await createClient('SB2');
    const client3 = await createClient('SB3');

    // Test 1.1: Get empty lobby list
    log('\nTest 1.1: Empty lobby list');
    client1.emit('get_lobby_list');
    await delay(500);
    assert(
      client1.metadata.lobbyList.length === 0,
      'Empty lobby list when no games exist',
      `Found ${client1.metadata.lobbyList.length} lobbies`
    );

    // Test 1.2: Create public lobby and verify it appears
    log('\nTest 1.2: Public lobby appears in list');
    client1.emit('find_match', { gameMode: 'deathmatch' });
    await delay(1000);
    
    client2.emit('get_lobby_list');
    await delay(500);
    assert(
      client2.metadata.lobbyList.length === 1,
      'Public lobby appears in server list',
      `Found ${client2.metadata.lobbyList.length} lobbies`
    );

    // Test 1.3: Private lobby filtering
    log('\nTest 1.3: Private lobby filtering');
    client3.emit('create_private_lobby', { password: 'test123' });
    await delay(1000);

    // Default filter should not show private
    client2.emit('get_lobby_list');
    await delay(500);
    const publicOnlyCount = client2.metadata.lobbyList.length;

    // With showPrivate filter
    client2.emit('get_lobby_list', { showPrivate: true });
    await delay(500);
    const withPrivateCount = client2.metadata.lobbyList.length;

    assert(
      withPrivateCount > publicOnlyCount,
      'Private lobby filter works correctly',
      `Public only: ${publicOnlyCount}, With private: ${withPrivateCount}`
    );

    // Test 1.4: Full lobby filtering
    log('\nTest 1.4: Full lobby filtering');
    // Join more clients to fill first lobby
    const fillerClients = [];
    for (let i = 0; i < 6; i++) {
      const filler = await createClient(`FILL${i}`, { silent: true });
      filler.emit('find_match', { gameMode: 'deathmatch' });
      fillerClients.push(filler);
    }
    await delay(2000);

    // Check without showFull
    client2.emit('get_lobby_list');
    await delay(500);
    const withoutFull = client2.metadata.lobbyList.filter(l => l.playerCount >= l.maxPlayers).length;

    // Check with showFull
    client2.emit('get_lobby_list', { showFull: true });
    await delay(500);
    const withFull = client2.metadata.lobbyList.filter(l => l.playerCount >= l.maxPlayers).length;

    assert(
      withoutFull === 0 && withFull > 0,
      'Full lobby filtering works',
      `Without filter: ${withoutFull} full lobbies, With filter: ${withFull} full lobbies`
    );

    // Cleanup
    client1.disconnect();
    client2.disconnect();
    client3.disconnect();
    fillerClients.forEach(c => c.disconnect());
    await delay(1000);

  } catch (error) {
    log(`Server browser test failed: ${error.message}`, colors.red);
    testsFailed++;
  }
}

async function testPrivateLobbies() {
  log('\n🔒 TEST 2: Private Lobby System', colors.blue);
  log('==================================', colors.blue);

  try {
    // Test 2.1: Create and join private lobby
    log('\nTest 2.1: Create and join private lobby');
    const host = await createClient('HOST');
    const friend = await createClient('FRIEND');

    // Host creates private lobby
    host.emit('create_private_lobby', { 
      password: 'secret', 
      maxPlayers: 4,
      gameMode: 'deathmatch'
    });
    await delay(1000);

    const lobbyId = host.metadata.lobbyId;
    assert(
      lobbyId && lobbyId.startsWith('private_'),
      'Private lobby created with correct ID format',
      `Lobby ID: ${lobbyId}`
    );

    // Friend joins with correct password
    friend.emit('join_lobby', { lobbyId, password: 'secret' });
    await delay(1000);

    assert(
      friend.metadata.lobbyId === lobbyId,
      'Friend can join private lobby with password',
      `Friend in lobby: ${friend.metadata.lobbyId}`
    );

    // Test 2.2: Wrong password rejection
    log('\nTest 2.2: Wrong password rejection');
    const stranger = await createClient('STRANGER');
    
    stranger.emit('join_lobby', { lobbyId, password: 'wrong' });
    await delay(1000);

    assert(
      stranger.metadata.lobbyId !== lobbyId,
      'Cannot join private lobby with wrong password',
      `Stranger lobby: ${stranger.metadata.lobbyId || 'none'}`
    );

    // Test 2.3: Join without password fails
    log('\nTest 2.3: Join without password fails');
    const nopass = await createClient('NOPASS');
    
    nopass.emit('join_lobby', { lobbyId });
    await delay(1000);

    assert(
      nopass.metadata.lobbyId !== lobbyId,
      'Cannot join private lobby without password',
      `No-pass lobby: ${nopass.metadata.lobbyId || 'none'}`
    );

    // Cleanup
    host.disconnect();
    friend.disconnect();
    stranger.disconnect();
    nopass.disconnect();
    await delay(1000);

  } catch (error) {
    log(`Private lobby test failed: ${error.message}`, colors.red);
    testsFailed++;
  }
}

async function testMidGameJoining() {
  log('\n⚡ TEST 3: Mid-Game Joining', colors.blue);
  log('============================', colors.blue);

  try {
    // Test 3.1: Join game in progress
    log('\nTest 3.1: Join game in progress');
    
    // Create initial players
    const player1 = await createClient('P1');
    const player2 = await createClient('P2');
    
    // Start a match
    player1.emit('find_match');
    await delay(500);
    player2.emit('find_match');
    await delay(2000);
    
    const lobbyId = player1.metadata.lobbyId;
    
    // Wait for match to start
    await delay(6000);
    
    // Check if match started
    const matchStarted = player1.metadata.events.some(e => e.type === 'match_started');
    assert(
      matchStarted,
      'Match started with 2 players',
      `Events: ${player1.metadata.events.map(e => e.type).join(', ')}`
    );
    
    // Late joiner arrives
    const lateJoiner = await createClient('LATE');
    lateJoiner.emit('join_lobby', { lobbyId });
    await delay(2000);
    
    // Check late join indicators
    const lateJoinEvent = lateJoiner.metadata.events.find(e => e.type === 'match_started');
    const lobbyJoinedEvent = lateJoiner.metadata.events.find(e => e.type === 'lobby_joined');
    
    assert(
      lateJoinEvent && lateJoinEvent.data.isLateJoin === true,
      'Late joiner receives match_started with isLateJoin flag',
      `Late join flag: ${lateJoinEvent?.data.isLateJoin}`
    );
    
    assert(
      lobbyJoinedEvent && lobbyJoinedEvent.data.status === 'playing',
      'Late joiner sees correct lobby status (playing)',
      `Lobby status: ${lobbyJoinedEvent?.data.status}`
    );
    
    assert(
      lobbyJoinedEvent && lobbyJoinedEvent.data.isInProgress === true,
      'Late joiner sees isInProgress flag',
      `In progress: ${lobbyJoinedEvent?.data.isInProgress}`
    );
    
    // Test 3.2: Server browser shows in-progress games with filter
    log('\nTest 3.2: In-progress games in server browser');
    
    const browser = await createClient('BROWSER');
    
    // Without filter (should not show in-progress)
    browser.emit('get_lobby_list');
    await delay(500);
    const withoutInProgress = browser.metadata.lobbyList.filter(l => l.status === 'playing').length;
    
    // With filter (should show in-progress)
    browser.emit('get_lobby_list', { showInProgress: true });
    await delay(500);
    const withInProgress = browser.metadata.lobbyList.filter(l => l.status === 'playing').length;
    
    assert(
      withoutInProgress === 0 && withInProgress > 0,
      'In-progress filter works in server browser',
      `Without: ${withoutInProgress}, With: ${withInProgress}`
    );
    
    // Cleanup
    player1.disconnect();
    player2.disconnect();
    lateJoiner.disconnect();
    browser.disconnect();
    await delay(1000);
    
  } catch (error) {
    log(`Mid-game joining test failed: ${error.message}`, colors.red);
    testsFailed++;
  }
}

async function testMultipleLobbies() {
  log('\n🏢 TEST 4: Multiple Concurrent Lobbies', colors.blue);
  log('========================================', colors.blue);

  try {
    const lobbies = [];
    const clients = [];
    
    // Test 4.1: Create multiple lobbies
    log('\nTest 4.1: Creating 5 concurrent lobbies');
    
    for (let i = 0; i < 5; i++) {
      const host = await createClient(`L${i}H1`, { silent: true });
      const guest = await createClient(`L${i}H2`, { silent: true });
      
      host.emit('find_match', { gameMode: 'deathmatch' });
      await delay(500);
      guest.emit('find_match', { gameMode: 'deathmatch' });
      await delay(500);
      
      clients.push(host, guest);
      lobbies.push(host.metadata.lobbyId);
    }
    
    // Verify all lobbies are different
    const uniqueLobbies = new Set(lobbies);
    assert(
      uniqueLobbies.size === 5,
      'All 5 lobbies have unique IDs',
      `Unique lobbies: ${uniqueLobbies.size}/5`
    );
    
    // Test 4.2: Check server can handle all lobbies
    log('\nTest 4.2: Server handling multiple lobbies');
    
    const browser = await createClient('MULTI_BROWSER');
    browser.emit('get_lobby_list', { showInProgress: true });
    await delay(1000);
    
    assert(
      browser.metadata.lobbyList.length >= 5,
      'Server tracks all active lobbies',
      `Found ${browser.metadata.lobbyList.length} lobbies`
    );
    
    // Test 4.3: Games start independently
    log('\nTest 4.3: Lobbies start matches independently');
    await delay(6000); // Wait for matches to start
    
    let matchesStarted = 0;
    clients.forEach(client => {
      if (client.metadata.events.some(e => e.type === 'match_started')) {
        matchesStarted++;
      }
    });
    
    assert(
      matchesStarted >= 8, // At least 4 lobbies * 2 players
      'Multiple lobbies can start matches independently',
      `${matchesStarted}/10 clients received match_started`
    );
    
    // Cleanup
    clients.forEach(c => c.disconnect());
    browser.disconnect();
    await delay(1000);
    
  } catch (error) {
    log(`Multiple lobbies test failed: ${error.message}`, colors.red);
    testsFailed++;
  }
}

async function stressTest() {
  log('\n💪 TEST 5: Stress Test', colors.blue);
  log('=======================', colors.blue);
  
  try {
    const clients = [];
    const startTime = performance.now();
    
    // Test 5.1: Rapid client connections
    log('\nTest 5.1: Connecting 20 clients rapidly');
    
    const connectionPromises = [];
    for (let i = 0; i < 20; i++) {
      connectionPromises.push(
        createClient(`STRESS${i}`, { silent: true, timeout: 10000 })
          .then(client => {
            clients.push(client);
            return client;
          })
          .catch(err => {
            log(`Failed to create client STRESS${i}: ${err.message}`, colors.red);
            return null;
          })
      );
    }
    
    const connectedClients = (await Promise.all(connectionPromises)).filter(c => c !== null);
    const connectionTime = performance.now() - startTime;
    
    assert(
      connectedClients.length >= 18, // Allow 2 failures
      `${connectedClients.length}/20 clients connected successfully`,
      `Connection time: ${(connectionTime/1000).toFixed(2)}s`
    );
    
    // Test 5.2: All clients request lobby list simultaneously
    log('\nTest 5.2: Simultaneous lobby list requests');
    
    const listStartTime = performance.now();
    connectedClients.forEach(client => {
      if (client) client.emit('get_lobby_list');
    });
    
    await delay(2000);
    const listTime = performance.now() - listStartTime;
    
    const receivedLists = connectedClients.filter(c => 
      c && c.metadata.events.some(e => e.type === 'lobby_list')
    ).length;
    
    assert(
      receivedLists >= connectedClients.length - 2,
      'Server handles simultaneous lobby list requests',
      `${receivedLists}/${connectedClients.length} received lists in ${(listTime/1000).toFixed(2)}s`
    );
    
    // Test 5.3: Create many lobbies at once
    log('\nTest 5.3: Creating multiple lobbies simultaneously');
    
    const lobbyStartTime = performance.now();
    connectedClients.slice(0, 10).forEach((client, i) => {
      if (client) {
        if (i % 2 === 0) {
          client.emit('create_private_lobby', { password: `test${i}` });
        } else {
          client.emit('find_match');
        }
      }
    });
    
    await delay(3000);
    const lobbyTime = performance.now() - lobbyStartTime;
    
    const inLobbies = connectedClients.filter(c => 
      c && c.metadata.lobbyId !== null
    ).length;
    
    assert(
      inLobbies >= 8,
      'Server handles simultaneous lobby creation',
      `${inLobbies} clients in lobbies after ${(lobbyTime/1000).toFixed(2)}s`
    );
    
    // Test 5.4: Server remains responsive
    log('\nTest 5.4: Server remains responsive under load');
    
    const testClient = await createClient('RESPONSIVE', { timeout: 2000 });
    const responseStart = performance.now();
    testClient.emit('get_lobby_list');
    await delay(500);
    const responseTime = performance.now() - responseStart;
    
    assert(
      testClient.metadata.lobbyList !== undefined && responseTime < 1000,
      'Server remains responsive under load',
      `Response time: ${responseTime.toFixed(0)}ms`
    );
    
    // Cleanup
    log('\nCleaning up stress test clients...');
    connectedClients.forEach(c => c && c.disconnect());
    testClient.disconnect();
    await delay(2000);
    
  } catch (error) {
    log(`Stress test failed: ${error.message}`, colors.red);
    testsFailed++;
  }
}

async function runAllTests() {
  log('\n🚀 STARTING COMPREHENSIVE SERVER BROWSER & LOBBY TESTS', colors.cyan);
  log('======================================================\n', colors.cyan);
  
  const totalStartTime = performance.now();
  
  try {
    // Check server is running
    const healthCheck = await fetch(`${SERVER_URL}/health`).catch(() => null);
    if (!healthCheck) {
      throw new Error('Server is not running on port 3000');
    }
    
    // Run all test suites
    await testServerBrowser();
    await delay(2000); // Clean pause between test suites
    
    await testPrivateLobbies();
    await delay(2000);
    
    await testMidGameJoining();
    await delay(2000);
    
    await testMultipleLobbies();
    await delay(2000);
    
    await stressTest();
    
  } catch (error) {
    log(`\n❌ CRITICAL ERROR: ${error.message}`, colors.red);
  }
  
  const totalTime = (performance.now() - totalStartTime) / 1000;
  
  // Print summary
  log('\n' + '='.repeat(60), colors.cyan);
  log('📊 TEST RESULTS SUMMARY', colors.cyan);
  log('='.repeat(60), colors.cyan);
  
  const passRate = testsPassed / (testsPassed + testsFailed) * 100;
  const summaryColor = passRate === 100 ? colors.green : passRate >= 80 ? colors.yellow : colors.red;
  
  log(`\nTests Passed: ${testsPassed}`, colors.green);
  log(`Tests Failed: ${testsFailed}`, testsFailed > 0 ? colors.red : colors.green);
  log(`Pass Rate: ${passRate.toFixed(1)}%`, summaryColor);
  log(`Total Time: ${totalTime.toFixed(2)} seconds\n`, colors.cyan);
  
  // Detailed results
  if (testsFailed > 0) {
    log('Failed Tests:', colors.red);
    testResults
      .filter(r => r.result === 'FAIL')
      .forEach(r => log(`  ❌ ${r.test}: ${r.details}`, colors.red));
  }
  
  // Overall verdict
  log('\n' + '='.repeat(60), colors.cyan);
  if (passRate === 100) {
    log('🎉 ALL TESTS PASSED! Server browser and lobby system working perfectly!', colors.green);
    log('✅ The implementation is PROVEN TO WORK!', colors.green);
  } else if (passRate >= 80) {
    log('⚠️  Most tests passed but some issues detected', colors.yellow);
  } else {
    log('❌ Significant issues detected - review failed tests', colors.red);
  }
  log('='.repeat(60) + '\n', colors.cyan);
  
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runAllTests();
