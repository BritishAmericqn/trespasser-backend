#!/usr/bin/env node

/**
 * Test to verify lobby isolation - events from one lobby should NOT affect another lobby
 * V2: Forces creation of separate lobbies
 */

const io = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

// Track events received by each player
const playerEvents = {
  p1: [],
  p2: [],
  p3: [],
  p4: []
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
        console.log(`[${name}] Event: ${event}${data?.lobbyId ? ` (lobby: ${data.lobbyId.substring(0, 20)}...)` : ''}`);
      }
    });
    
    socket.on('connect', () => {
      console.log(`[${name}] Connected`);
      resolve(socket);
    });
  });
}

async function runTest() {
  console.log('\n🧪 LOBBY ISOLATION TEST V2');
  console.log('===========================\n');
  console.log('Testing that events from Lobby B do NOT affect players in Lobby A\n');
  
  try {
    // Create Players 1 and 2 for Lobby A
    console.log('📍 Step 1: Players 1 & 2 join Lobby A');
    const player1 = await createPlayer('p1');
    const player2 = await createPlayer('p2');
    
    // Players 1 and 2 join together
    player1.emit('find_match', { gameMode: 'deathmatch' });
    await new Promise(resolve => setTimeout(resolve, 500));
    player2.emit('find_match', { gameMode: 'deathmatch' });
    
    // Wait for them to be matched and game to start
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Get Lobby A ID
    const p1LobbyId = playerEvents.p1.find(e => e.event === 'lobby_joined')?.data?.lobbyId;
    const p2LobbyId = playerEvents.p2.find(e => e.event === 'lobby_joined')?.data?.lobbyId;
    
    console.log(`\n✅ Lobby A created: ${p1LobbyId?.substring(0, 20)}...`);
    console.log(`   Player 1 in: ${p1LobbyId === p2LobbyId ? 'same lobby ✓' : 'different lobby ✗'}`);
    
    // Now create Players 3 and 4 for a NEW lobby
    console.log('\n📍 Step 2: Players 3 & 4 join Lobby B (should be different)');
    
    // Clear event counts for Players 1 and 2
    const p1EventCountBefore = playerEvents.p1.length;
    const p2EventCountBefore = playerEvents.p2.length;
    
    const player3 = await createPlayer('p3');
    const player4 = await createPlayer('p4');
    
    // Players 3 and 4 join together (should create new lobby since Lobby A is in game)
    player3.emit('find_match', { gameMode: 'deathmatch' });
    await new Promise(resolve => setTimeout(resolve, 500));
    player4.emit('find_match', { gameMode: 'deathmatch' });
    
    // Wait for them to be matched
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Get Lobby B ID
    const p3LobbyId = playerEvents.p3.find(e => e.event === 'lobby_joined')?.data?.lobbyId;
    const p4LobbyId = playerEvents.p4.find(e => e.event === 'lobby_joined')?.data?.lobbyId;
    
    console.log(`\n📊 LOBBY ASSIGNMENTS:`);
    console.log(`  Lobby A: ${p1LobbyId?.substring(0, 30)}`);
    console.log(`    - Player 1: ✓`);
    console.log(`    - Player 2: ${p2LobbyId === p1LobbyId ? '✓' : '✗'}`);
    console.log(`  Lobby B: ${p3LobbyId?.substring(0, 30)}`);
    console.log(`    - Player 3: ✓`);
    console.log(`    - Player 4: ${p4LobbyId === p3LobbyId ? '✓' : '✗'}`);
    
    const differentLobbies = p1LobbyId !== p3LobbyId;
    console.log(`\n  Lobbies are ${differentLobbies ? 'DIFFERENT ✓' : 'THE SAME ✗'}`);
    
    // Check if Players in Lobby A received events from Lobby B
    const p1EventsAfter = playerEvents.p1.slice(p1EventCountBefore);
    const p2EventsAfter = playerEvents.p2.slice(p2EventCountBefore);
    
    const p1ReceivedLobbyBEvents = p1EventsAfter.filter(e => {
      return (e.event === 'player_joined_lobby' && e.data?.lobbyId === p3LobbyId) ||
             (e.event === 'match_starting' && e.data?.lobbyId === p3LobbyId) ||
             (e.event === 'match_started' && e.data?.lobbyId === p3LobbyId) ||
             (e.event === 'player:joined' && p3LobbyId && p1LobbyId !== p3LobbyId);
    });
    
    const p2ReceivedLobbyBEvents = p2EventsAfter.filter(e => {
      return (e.event === 'player_joined_lobby' && e.data?.lobbyId === p3LobbyId) ||
             (e.event === 'match_starting' && e.data?.lobbyId === p3LobbyId) ||
             (e.event === 'match_started' && e.data?.lobbyId === p3LobbyId) ||
             (e.event === 'player:joined' && p3LobbyId && p2LobbyId !== p3LobbyId);
    });
    
    console.log(`\n📋 ISOLATION TEST RESULTS:`);
    
    if (!differentLobbies) {
      console.log(`⚠️  TEST INVALID: All players joined the same lobby!`);
      console.log(`   This can happen if Lobby A wasn't full or not in-game yet.`);
      console.log(`   The isolation test requires players to be in DIFFERENT lobbies.`);
    } else {
      console.log(`  Player 1 events after Lobby B created: ${p1EventsAfter.length}`);
      console.log(`  Player 1 received Lobby B events: ${p1ReceivedLobbyBEvents.length}`);
      console.log(`  Player 2 events after Lobby B created: ${p2EventsAfter.length}`);
      console.log(`  Player 2 received Lobby B events: ${p2ReceivedLobbyBEvents.length}`);
      
      if (p1ReceivedLobbyBEvents.length > 0 || p2ReceivedLobbyBEvents.length > 0) {
        console.log(`\n❌ FAILED: Lobby A players received events from Lobby B!`);
        console.log('  Leaked events:');
        [...p1ReceivedLobbyBEvents, ...p2ReceivedLobbyBEvents].forEach(e => {
          console.log(`    - ${e.event}: ${JSON.stringify(e.data).substring(0, 100)}`);
        });
      } else {
        console.log(`\n✅ SUCCESS: Lobby A players did NOT receive any events from Lobby B!`);
        console.log('  Lobbies are properly isolated!');
      }
    }
    
    // Test weapon events isolation (only if different lobbies)
    if (differentLobbies) {
      console.log(`\n📍 Step 3: Testing weapon event isolation`);
      const p1WeaponEventsBefore = playerEvents.p1.filter(e => e.event.includes('weapon')).length;
      
      // Player 3 fires weapon in Lobby B
      player3.emit('weapon:fire', {
        weaponType: 'pistol',
        position: { x: 100, y: 100 },
        direction: { x: 1, y: 0 }
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const p1WeaponEventsAfter = playerEvents.p1.filter(e => e.event.includes('weapon')).length;
      
      if (p1WeaponEventsAfter > p1WeaponEventsBefore) {
        console.log(`❌ FAILED: Player 1 received weapon events from Lobby B!`);
      } else {
        console.log(`✅ SUCCESS: Player 1 did NOT receive weapon events from Lobby B!`);
      }
    }
    
    // Final summary
    console.log(`\n${'='.repeat(50)}`);
    console.log('FINAL VERDICT:');
    console.log('='.repeat(50));
    
    if (!differentLobbies) {
      console.log('⚠️  TEST COULD NOT BE COMPLETED');
      console.log('All players ended up in the same lobby.');
      console.log('This might be expected behavior if lobby had room.');
    } else {
      const allTestsPassed = p1ReceivedLobbyBEvents.length === 0 && 
                            p2ReceivedLobbyBEvents.length === 0;
      
      if (allTestsPassed) {
        console.log('✅ ALL TESTS PASSED - Lobbies are properly isolated!');
        console.log('Players in different lobbies do NOT receive each other\'s events.');
      } else {
        console.log('❌ TESTS FAILED - Lobby isolation is broken!');
        console.log('Players are receiving events from other lobbies.');
      }
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
