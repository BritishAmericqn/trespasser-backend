#!/usr/bin/env node

/**
 * Debug test to understand why server browser events aren't working
 */

const io = require('socket.io-client');

const SERVER_URL = 'http://localhost:3000';

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testDebug() {
  console.log('🔍 DEBUG TEST: Server Browser Events');
  console.log('=====================================\n');
  
  // Create a simple client
  const client = io(SERVER_URL, { reconnection: false });
  
  // Log ALL events
  client.onAny((eventName, ...args) => {
    console.log(`📥 Received event: "${eventName}"`, args);
  });
  
  // Track what we emit
  const originalEmit = client.emit.bind(client);
  client.emit = function(eventName, ...args) {
    console.log(`📤 Emitting event: "${eventName}"`, args);
    return originalEmit(eventName, ...args);
  };
  
  await new Promise((resolve) => {
    client.on('connect', () => {
      console.log(`✅ Connected: ${client.id}`);
      resolve();
    });
  });
  
  console.log('\n--- Test 1: Get empty lobby list ---');
  client.emit('get_lobby_list');
  await delay(1000);
  
  console.log('\n--- Test 2: Find match ---');
  client.emit('find_match', { gameMode: 'deathmatch' });
  await delay(2000);
  
  console.log('\n--- Test 3: Get lobby list with lobby ---');
  client.emit('get_lobby_list');
  await delay(1000);
  
  console.log('\n--- Test 4: Create private lobby ---');
  client.emit('create_private_lobby', { password: 'test123' });
  await delay(2000);
  
  console.log('\n--- Test 5: Get all lobbies including private ---');
  client.emit('get_lobby_list', { showPrivate: true });
  await delay(1000);
  
  console.log('\n--- Disconnecting ---');
  client.disconnect();
  
  console.log('\n✅ Debug test complete');
}

testDebug().catch(err => {
  console.error('❌ Debug test failed:', err);
  process.exit(1);
});
