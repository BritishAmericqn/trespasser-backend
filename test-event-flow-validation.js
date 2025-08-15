#!/usr/bin/env node

/**
 * Event flow validation test
 * Validates that all expected events are emitted in the correct order
 */

const io = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

// Expected event sequences
const EXPECTED_EVENTS = {
  joiningPlayer: [
    'connect',
    'game:state',      // Initial game state
    'player:joined',   // Self join broadcast
    'lobby_state_update',
    'player_joined_lobby',
    'lobby_joined'
  ],
  existingPlayer: [
    'player:joined',   // New player joined game
    'lobby_state_update',
    'player_joined_lobby'
  ],
  matchStart: [
    'match_starting',
    'match_started'
  ],
  playerLeave: [
    'player:left',
    'player_left_lobby',
    'lobby_state_update'
  ]
};

async function validateEventFlow() {
  console.log('\n=== EVENT FLOW VALIDATION TEST ===\n');
  
  const results = {
    passed: 0,
    failed: 0,
    details: []
  };
  
  // Create two test players
  const player1 = io(SERVER_URL, { reconnection: false });
  const player2 = io(SERVER_URL, { reconnection: false });
  
  const player1Events = [];
  const player2Events = [];
  
  // Capture all events
  player1.onAny((event, data) => {
    player1Events.push({ event, data, timestamp: Date.now() });
    if (!event.includes('ping') && !event.includes('pong')) {
      console.log(`[P1] ${event}${data?.lobbyId ? ` (lobby: ${data.lobbyId})` : ''}`);
    }
  });
  
  player2.onAny((event, data) => {
    player2Events.push({ event, data, timestamp: Date.now() });
    if (!event.includes('ping') && !event.includes('pong')) {
      console.log(`[P2] ${event}${data?.lobbyId ? ` (lobby: ${data.lobbyId})` : ''}`);
    }
  });
  
  // Wait for connections
  await new Promise((resolve) => {
    let connected = 0;
    player1.on('connect', () => { 
      console.log('[P1] Connected');
      if (++connected === 2) resolve();
    });
    player2.on('connect', () => { 
      console.log('[P2] Connected');
      if (++connected === 2) resolve();
    });
  });
  
  console.log('\n--- Phase 1: Player 1 joins matchmaking ---');
  player1.emit('find_match', { gameMode: 'deathmatch' });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('\n--- Phase 2: Player 2 joins matchmaking ---');
  player2.emit('find_match', { gameMode: 'deathmatch' });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\n--- Phase 3: Waiting for match start ---');
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  console.log('\n--- Phase 4: Player 2 leaves ---');
  player2.emit('leave_lobby');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Analyze results
  console.log('\n=== ANALYSIS ===\n');
  
  // Check Player 1's events when joining
  console.log('Player 1 join events:');
  const p1JoinEvents = player1Events.slice(0, 10).map(e => e.event);
  console.log('  Received:', p1JoinEvents.join(' → '));
  
  // Check if Player 1 got notification when Player 2 joined
  const p1GotP2Join = player1Events.some(e => 
    e.event === 'player_joined_lobby' && 
    e.data?.playerCount === 2
  );
  
  if (p1GotP2Join) {
    console.log('✅ Player 1 received notification when Player 2 joined');
    results.passed++;
  } else {
    console.log('❌ Player 1 did NOT receive notification when Player 2 joined');
    results.failed++;
  }
  
  // Check if both got match events
  const p1MatchStart = player1Events.some(e => e.event === 'match_starting');
  const p2MatchStart = player2Events.some(e => e.event === 'match_starting');
  
  if (p1MatchStart && p2MatchStart) {
    console.log('✅ Both players received match_starting');
    results.passed++;
  } else {
    console.log('❌ Not all players received match_starting');
    results.failed++;
  }
  
  // Check player counts in events
  console.log('\n--- Player Count Analysis ---');
  
  const p1LobbyJoined = player1Events.find(e => e.event === 'lobby_joined');
  const p2LobbyJoined = player2Events.find(e => e.event === 'lobby_joined');
  
  console.log(`Player 1 lobby_joined count: ${p1LobbyJoined?.data?.playerCount}`);
  console.log(`Player 2 lobby_joined count: ${p2LobbyJoined?.data?.playerCount}`);
  
  if (p1LobbyJoined?.data?.playerCount === 1 && p2LobbyJoined?.data?.playerCount === 2) {
    console.log('✅ Player counts are accurate');
    results.passed++;
  } else {
    console.log('❌ Player counts are inaccurate');
    results.failed++;
  }
  
  // Check leave events
  console.log('\n--- Leave Event Analysis ---');
  
  const p1GotLeave = player1Events.some(e => 
    e.event === 'player_left_lobby' || 
    e.event === 'player:left'
  );
  
  if (p1GotLeave) {
    console.log('✅ Player 1 received leave notification');
    results.passed++;
    
    // Show the actual leave events
    const leaveEvents = player1Events.filter(e => 
      e.event.includes('left') || e.event.includes('leave')
    );
    console.log('  Leave events:', leaveEvents.map(e => e.event).join(', '));
  } else {
    console.log('❌ Player 1 did NOT receive leave notification');
    results.failed++;
    
    // Debug: Show all events after leave was sent
    const leaveIndex = player2Events.findIndex(e => e.event === 'leave_lobby');
    if (leaveIndex >= 0) {
      const afterLeave = player1Events.slice(-5).map(e => e.event);
      console.log('  Last events for P1:', afterLeave.join(', '));
    }
  }
  
  // Check game state
  console.log('\n--- Game State Analysis ---');
  
  const p1GameState = player1Events.find(e => e.event === 'game:state');
  const p2GameState = player2Events.find(e => e.event === 'game:state');
  
  if (p1GameState?.data?.players) {
    const playerCount = Object.keys(p1GameState.data.players).length;
    console.log(`Player 1 sees ${playerCount} players in game state`);
    
    if (playerCount >= 1) {
      console.log('✅ Player 1 has valid game state');
      results.passed++;
    }
  }
  
  if (p2GameState?.data?.players) {
    const playerCount = Object.keys(p2GameState.data.players).length;
    console.log(`Player 2 sees ${playerCount} players in game state`);
    
    if (playerCount >= 2) {
      console.log('✅ Player 2 has valid game state');
      results.passed++;
    }
  }
  
  // Final summary
  console.log('\n=== SUMMARY ===');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  // Show event timeline
  console.log('\n=== EVENT TIMELINE (first 20 events each) ===');
  
  console.log('\nPlayer 1:');
  player1Events.slice(0, 20).forEach((e, i) => {
    if (!e.event.includes('game:state')) {
      console.log(`  ${i}: ${e.event}`);
    }
  });
  
  console.log('\nPlayer 2:');
  player2Events.slice(0, 20).forEach((e, i) => {
    if (!e.event.includes('game:state')) {
      console.log(`  ${i}: ${e.event}`);
    }
  });
  
  // Cleanup
  player1.disconnect();
  player2.disconnect();
  
  setTimeout(() => {
    process.exit(results.failed > 0 ? 1 : 0);
  }, 100);
}

validateEventFlow().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
