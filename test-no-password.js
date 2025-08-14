#!/usr/bin/env node

/**
 * Test No-Password Access
 * Verifies that players can connect without authentication
 */

const { io } = require('socket.io-client');

console.log('🔓 Testing No-Password Access to Trespasser Backend');
console.log('===================================================\n');

const socket = io('http://localhost:3000', {
  // No auth required now!
});

let connected = false;

socket.on('connect', () => {
  connected = true;
  console.log('✅ Connected to server without password!');
  console.log(`🔌 Socket ID: ${socket.id}`);
  
  // Try to find a match immediately
  console.log('\n🎯 Testing immediate matchmaking...');
  socket.emit('find_match', { gameMode: 'deathmatch' });
});

socket.on('lobby_joined', (data) => {
  console.log('✅ Successfully joined lobby without authentication!');
  console.log('📊 Lobby Data:', JSON.stringify(data, null, 2));
  
  console.log('\n🎉 SUCCESS: No-password access is working!');
  console.log('🎮 Players can now join Trespasser directly!');
  
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 1000);
});

socket.on('match_started', (data) => {
  console.log('🚀 Match started!', data);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
});

socket.on('auth-timeout', () => {
  console.log('❌ Authentication timeout (this should not happen)');
  process.exit(1);
});

socket.on('auth-failed', () => {
  console.log('❌ Authentication failed (this should not happen)');
  process.exit(1);
});

socket.on('disconnect', () => {
  if (connected) {
    console.log('🔌 Disconnected successfully');
  } else {
    console.log('❌ Disconnected before connection was established');
  }
});

// Timeout after 10 seconds
setTimeout(() => {
  if (!connected) {
    console.log('❌ Test timeout - connection failed');
    process.exit(1);
  }
}, 10000);
