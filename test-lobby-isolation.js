#!/usr/bin/env node

/**
 * Test to verify lobby isolation - events from one lobby should NOT affect another lobby
 */

const io = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

// Track events received by each player
const playerEvents = {
  p1: [],
  p2: [],
  p3: []
};

async function createPlayer(name) {
  return new Promise((resolve) => {
    const socket = io(SERVER_URL, {
      reconnection: false,
      timeout: 5000
    });
    
    socket.onAny((event, data) => {
      // Don't log ping/pong or game:state
      if (!event.includes('ping') && !event.includes('pong') && !event.includes('game:state')) {
        playerEvents[name].push({ event, data, timestamp: Date.now() });
        console.log(`[${name}] Event: ${event}${data?.lobbyId ? ` (lobby: ${data.lobbyId})` : ''}`);
      }
    });
    
    socket.on('connect', () => {
      console.log(`[${name}] Connected`);
      resolve(socket);
    });
  });
}

async function runTest() {
  console.log('\n🧪 LOBBY ISOLATION TEST');
  console.log('=======================\n');
  console.log('Testing that events from Lobby B do NOT affect Player 1 in Lobby A\n');
  
  try {
    // Create Player 1 and join a match
    console.log('📍 Step 1: Player 1 joins match A');
    const player1 = await createPlayer('p1');
    player1.emit('find_match', { gameMode: 'deathmatch' });
    
    // Wait for Player 1 to get in game
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Player 1 should have received some events
    const p1InitialEvents = playerEvents.p1.filter(e => 
      e.event === 'lobby_joined' || 
      e.event === 'player_joined_lobby'
    );
    
    const p1LobbyId = p1InitialEvents.find(e => e.event === 'lobby_joined')?.data?.lobbyId;
    console.log(`✅ Player 1 in lobby: ${p1LobbyId}\n`);
    
    // Create Players 2 and 3, they should join a DIFFERENT lobby
    console.log('📍 Step 2: Players 2 and 3 join match B (different lobby)');
    const player2 = await createPlayer('p2');
    const player3 = await createPlayer('p3');
    
    // Clear Player 1's events before the test
    const p1EventCountBefore = playerEvents.p1.length;
    
    // Players 2 and 3 join
    player2.emit('find_match', { gameMode: 'deathmatch' });
    await new Promise(resolve => setTimeout(resolve, 500));
    player3.emit('find_match', { gameMode: 'deathmatch' });
    
    // Wait for them to join and match to start
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Check what lobby Players 2 and 3 are in
    const p2LobbyEvents = playerEvents.p2.filter(e => e.event === 'lobby_joined');
    const p3LobbyEvents = playerEvents.p3.filter(e => e.event === 'lobby_joined');
    
    const p2LobbyId = p2LobbyEvents[0]?.data?.lobbyId;
    const p3LobbyId = p3LobbyEvents[0]?.data?.lobbyId;
    
    console.log(`\n📊 LOBBY ASSIGNMENTS:`);
    console.log(`  Player 1: ${p1LobbyId}`);
    console.log(`  Player 2: ${p2LobbyId}`);
    console.log(`  Player 3: ${p3LobbyId}`);
    
    // Check if Player 1 received any events from Lobby B
    const p1EventsAfter = playerEvents.p1.slice(p1EventCountBefore);
    const p1ReceivedLobbyBEvents = p1EventsAfter.filter(e => {
      // Check if Player 1 received events about Players 2 or 3
      return (e.event === 'player_joined_lobby' && e.data?.playerId && 
              (e.data.playerId === player2.id || e.data.playerId === player3.id)) ||
             (e.event === 'match_starting' && e.data?.lobbyId === p2LobbyId) ||
             (e.event === 'match_started' && e.data?.lobbyId === p2LobbyId);
    });
    
    console.log(`\n📋 RESULTS:`);
    console.log(`  Player 1 total events after others joined: ${p1EventsAfter.length}`);
    console.log(`  Player 1 received Lobby B events: ${p1ReceivedLobbyBEvents.length}`);
    
    if (p1ReceivedLobbyBEvents.length > 0) {
      console.log(`\n❌ FAILED: Player 1 received events from Lobby B!`);
      console.log('  Leaked events:');
      p1ReceivedLobbyBEvents.forEach(e => {
        console.log(`    - ${e.event}: ${JSON.stringify(e.data).substring(0, 100)}`);
      });
    } else {
      console.log(`\n✅ SUCCESS: Player 1 did NOT receive any events from Lobby B!`);
      console.log('  Lobbies are properly isolated!');
    }
    
    // Check if Players 2 and 3 can see each other
    const p2SawP3 = playerEvents.p2.some(e => 
      e.event === 'player_joined_lobby' && e.data?.playerId === player3.id
    );
    const p3SawP2 = playerEvents.p3.some(e => 
      e.event === 'player_joined_lobby' && e.data?.playerId === player2.id
    );
    
    if (p2LobbyId === p3LobbyId && p2SawP3) {
      console.log(`✅ Players 2 & 3 are in same lobby and see each other`);
    } else if (p2LobbyId !== p3LobbyId) {
      console.log(`✅ Players 2 & 3 are in different lobbies (expected with only 1 player in first lobby)`);
    }
    
    // Test weapon events isolation
    console.log(`\n📍 Step 3: Testing weapon event isolation`);
    const p1WeaponEventsBefore = playerEvents.p1.filter(e => e.event.includes('weapon')).length;
    
    // Player 2 fires weapon
    player2.emit('weapon:fire', {
      weaponType: 'pistol',
      position: { x: 100, y: 100 },
      direction: { x: 1, y: 0 }
    });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const p1WeaponEventsAfter = playerEvents.p1.filter(e => e.event.includes('weapon')).length;
    
    if (p1WeaponEventsAfter > p1WeaponEventsBefore) {
      console.log(`❌ FAILED: Player 1 received weapon events from Player 2's lobby!`);
    } else {
      console.log(`✅ SUCCESS: Player 1 did NOT receive weapon events from other lobby!`);
    }
    
    // Final summary
    console.log(`\n${'='.repeat(50)}`);
    console.log('FINAL VERDICT:');
    console.log('='.repeat(50));
    
    const allTestsPassed = p1ReceivedLobbyBEvents.length === 0 && 
                          p1WeaponEventsAfter === p1WeaponEventsBefore;
    
    if (allTestsPassed) {
      console.log('✅ ALL TESTS PASSED - Lobbies are properly isolated!');
      console.log('Players in different lobbies do NOT receive each other\'s events.');
    } else {
      console.log('❌ TESTS FAILED - Lobby isolation is broken!');
      console.log('Players are receiving events from other lobbies.');
    }
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    // Give a moment to see final results
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.exit(0);
  }
}

// Run the test
runTest();
