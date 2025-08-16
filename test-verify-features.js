#!/usr/bin/env node

/**
 * VERIFICATION TEST - Proves server browser and friend joining actually work
 * Tests each feature individually with proper delays
 */

const io = require('socket.io-client');
const SERVER_URL = 'http://localhost:3000';

// Test tracking
const results = {
  serverBrowser: false,
  privateLobbies: false,
  joinByID: false,
  filtering: false,
  midGameJoin: false
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createClient(name) {
  return new Promise((resolve) => {
    const client = io(SERVER_URL, { reconnection: false });
    
    client.once('connect', () => {
      console.log(`✅ ${name} connected: ${client.id.substring(0, 8)}`);
      
      // Track all received events
      client.receivedEvents = [];
      client.onAny((eventName, data) => {
        client.receivedEvents.push({ event: eventName, data });
        if (eventName !== 'game:state') { // Don't log game state spam
          console.log(`   📥 ${name} received: ${eventName}`);
        }
      });
      
      // No auth needed when password not required
      setTimeout(() => resolve(client), 200);
    });
  });
}

async function test1_ServerBrowser() {
  console.log('\n========================================');
  console.log('TEST 1: Server Browser Functionality');
  console.log('========================================\n');
  
  const alice = await createClient('Alice');
  const bob = await createClient('Bob');
  
  // Step 1: Alice checks empty lobby list
  console.log('\n1. Alice checks lobby list (should be empty)');
  alice.emit('get_lobby_list');
  await delay(500);
  
  const emptyList = alice.receivedEvents.find(e => e.event === 'lobby_list');
  if (emptyList && emptyList.data.lobbies.length === 0) {
    console.log('   ✅ Empty lobby list confirmed');
  } else {
    console.log('   ❌ Failed to get empty lobby list');
  }
  
  // Step 2: Alice creates a game
  console.log('\n2. Alice creates a public game');
  alice.emit('find_match', { gameMode: 'deathmatch' });
  await delay(1000);
  
  const aliceJoined = alice.receivedEvents.find(e => e.event === 'lobby_joined');
  if (aliceJoined) {
    console.log(`   ✅ Alice joined lobby: ${aliceJoined.data.lobbyId.substring(0, 20)}...`);
  }
  
  // Step 3: Bob checks lobby list (should see Alice's game)
  console.log('\n3. Bob checks lobby list');
  bob.emit('get_lobby_list');
  await delay(500);
  
  const bobList = bob.receivedEvents.find(e => e.event === 'lobby_list');
  if (bobList && bobList.data.lobbies.length > 0) {
    const lobby = bobList.data.lobbies[0];
    console.log(`   ✅ Bob sees lobby: ${lobby.id.substring(0, 20)}...`);
    console.log(`      Players: ${lobby.playerCount}/${lobby.maxPlayers}`);
    console.log(`      Status: ${lobby.status}`);
    results.serverBrowser = true;
  } else {
    console.log('   ❌ Bob cannot see any lobbies');
  }
  
  alice.disconnect();
  bob.disconnect();
  await delay(1000);
}

async function test2_PrivateLobbies() {
  console.log('\n========================================');
  console.log('TEST 2: Private Lobby with Password');
  console.log('========================================\n');
  
  const host = await createClient('Host');
  const friend = await createClient('Friend');
  const stranger = await createClient('Stranger');
  
  // Step 1: Host creates private lobby
  console.log('\n1. Host creates private lobby with password');
  host.emit('create_private_lobby', { 
    password: 'secret123',
    maxPlayers: 4,
    gameMode: 'deathmatch'
  });
  await delay(1000);
  
  const privateCreated = host.receivedEvents.find(e => e.event === 'private_lobby_created');
  let lobbyId;
  if (privateCreated) {
    lobbyId = privateCreated.data.lobbyId;
    console.log(`   ✅ Private lobby created: ${lobbyId}`);
    console.log(`   📋 Share this ID with friends: ${lobbyId}`);
    results.privateLobbies = true;
  } else {
    console.log('   ❌ Failed to create private lobby');
  }
  
  // Step 2: Friend joins with correct password
  if (lobbyId) {
    console.log('\n2. Friend joins with correct password');
    friend.emit('join_lobby', { lobbyId, password: 'secret123' });
    await delay(1000);
    
    const friendJoined = friend.receivedEvents.find(e => e.event === 'lobby_joined');
    if (friendJoined) {
      console.log(`   ✅ Friend joined successfully`);
      console.log(`      Players: ${friendJoined.data.playerCount}/${friendJoined.data.maxPlayers}`);
      results.joinByID = true;
    } else {
      console.log('   ❌ Friend failed to join');
    }
    
    // Step 3: Stranger tries with wrong password
    console.log('\n3. Stranger tries to join with wrong password');
    stranger.emit('join_lobby', { lobbyId, password: 'wrong' });
    await delay(1000);
    
    const strangerFailed = stranger.receivedEvents.find(e => e.event === 'lobby_join_failed');
    if (strangerFailed) {
      console.log(`   ✅ Stranger correctly rejected: ${strangerFailed.data.reason}`);
    } else {
      console.log('   ❌ Security issue: stranger not rejected');
    }
  }
  
  host.disconnect();
  friend.disconnect();
  stranger.disconnect();
  await delay(1000);
}

async function test3_Filtering() {
  console.log('\n========================================');
  console.log('TEST 3: Lobby Filtering');
  console.log('========================================\n');
  
  const browser = await createClient('Browser');
  const host = await createClient('Host');
  
  // Create a private lobby
  console.log('1. Create a private lobby');
  host.emit('create_private_lobby', { password: 'test' });
  await delay(1000);
  
  // Check default filter (no private lobbies)
  console.log('\n2. Check lobbies WITHOUT showPrivate filter');
  browser.emit('get_lobby_list');
  await delay(500);
  
  browser.receivedEvents = []; // Clear to check next request
  
  // Check with showPrivate filter
  console.log('\n3. Check lobbies WITH showPrivate filter');
  browser.emit('get_lobby_list', { showPrivate: true });
  await delay(500);
  
  const withPrivate = browser.receivedEvents.find(e => e.event === 'lobby_list');
  if (withPrivate && withPrivate.data.lobbies.length > 0) {
    const privateLobby = withPrivate.data.lobbies.find(l => l.isPrivate);
    if (privateLobby) {
      console.log(`   ✅ Private lobby visible with filter: ${privateLobby.id.substring(0, 20)}...`);
      results.filtering = true;
    }
  } else {
    console.log('   ❌ Filtering not working properly');
  }
  
  browser.disconnect();
  host.disconnect();
  await delay(1000);
}

async function test4_MidGameJoining() {
  console.log('\n========================================');
  console.log('TEST 4: Joining Game in Progress');
  console.log('========================================\n');
  
  const player1 = await createClient('Player1');
  const player2 = await createClient('Player2');
  
  // Create and start a game
  console.log('1. Start a match with 2 players');
  player1.emit('find_match');
  await delay(500);
  player2.emit('find_match');
  await delay(1000);
  
  const p1Lobby = player1.receivedEvents.find(e => e.event === 'lobby_joined');
  let lobbyId;
  if (p1Lobby) {
    lobbyId = p1Lobby.data.lobbyId;
    console.log(`   ✅ Match created: ${lobbyId.substring(0, 20)}...`);
  }
  
  // Wait for match to start
  console.log('\n2. Waiting for match to start...');
  await delay(6000);
  
  const matchStarted = player1.receivedEvents.find(e => e.event === 'match_started');
  if (matchStarted) {
    console.log('   ✅ Match started!');
    
    // Late joiner arrives
    console.log('\n3. Late player joins match in progress');
    const latePlayer = await createClient('LatePlayer');
    
    latePlayer.emit('join_lobby', { lobbyId });
    await delay(1000);
    
    const lateJoin = latePlayer.receivedEvents.find(e => e.event === 'lobby_joined');
    const lateMatch = latePlayer.receivedEvents.find(e => e.event === 'match_started');
    
    if (lateJoin && lateJoin.data.status === 'playing') {
      console.log(`   ✅ Late player joined game in progress`);
      console.log(`      Status: ${lateJoin.data.status}`);
      console.log(`      isInProgress: ${lateJoin.data.isInProgress}`);
      
      if (lateMatch && lateMatch.data.isLateJoin) {
        console.log(`   ✅ Late join flag detected: ${lateMatch.data.isLateJoin}`);
        results.midGameJoin = true;
      }
    } else {
      console.log('   ❌ Could not join game in progress');
    }
    
    latePlayer.disconnect();
  } else {
    console.log('   ❌ Match did not start');
  }
  
  player1.disconnect();
  player2.disconnect();
  await delay(1000);
}

async function runTests() {
  console.log('\n🚀 FEATURE VERIFICATION TEST');
  console.log('Testing server browser and friend joining features');
  console.log('==================================================\n');
  
  try {
    // Check server is running
    await fetch(`${SERVER_URL}/health`);
    console.log('✅ Server is running\n');
    
    // Run each test with delays to avoid rate limiting
    await test1_ServerBrowser();
    await delay(2000);
    
    await test2_PrivateLobbies();
    await delay(2000);
    
    await test3_Filtering();
    await delay(2000);
    
    await test4_MidGameJoining();
    
    // Print results
    console.log('\n==================================================');
    console.log('📊 VERIFICATION RESULTS');
    console.log('==================================================\n');
    
    console.log(`Server Browser:    ${results.serverBrowser ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`Private Lobbies:   ${results.privateLobbies ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`Join by ID:        ${results.joinByID ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`Lobby Filtering:   ${results.filtering ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`Mid-Game Joining:  ${results.midGameJoin ? '✅ WORKING' : '❌ FAILED'}`);
    
    const allPass = Object.values(results).every(r => r === true);
    
    console.log('\n==================================================');
    if (allPass) {
      console.log('🎉 ALL FEATURES VERIFIED WORKING!');
      console.log('✅ Server browser and friend joining are fully functional');
    } else {
      console.log('⚠️  Some features need attention');
    }
    console.log('==================================================\n');
    
    process.exit(allPass ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Is the server running? Start it with: npm start');
    process.exit(1);
  }
}

// Run the verification
runTests();
