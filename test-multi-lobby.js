#!/usr/bin/env node

// Simple test script for multi-lobby functionality
const io = require('socket.io-client');

console.log('🧪 Testing Multi-Lobby System');
console.log('==============================');

const GAME_PASSWORD = 'gauntlet'; // Default password
const SERVER_URL = 'http://localhost:3000';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createClient(clientId) {
  const client = io(SERVER_URL);
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Client ${clientId} connection timeout`));
    }, 10000);

    client.on('connect', () => {
      console.log(`✅ Client ${clientId} connected: ${client.id.substring(0, 8)}`);
      
      // Authenticate
      client.emit('authenticate', GAME_PASSWORD);
    });

    client.on('authenticated', () => {
      console.log(`🔐 Client ${clientId} authenticated`);
      clearTimeout(timeout);
      resolve(client);
    });

    client.on('auth-failed', (reason) => {
      console.log(`❌ Client ${clientId} auth failed: ${reason}`);
      clearTimeout(timeout);
      reject(new Error(`Auth failed: ${reason}`));
    });

    client.on('lobby_joined', (data) => {
      console.log(`🎮 Client ${clientId} joined lobby:`, data);
    });

    client.on('matchmaking_failed', (data) => {
      console.log(`❌ Client ${clientId} matchmaking failed:`, data);
    });

    client.on('match_started', (data) => {
      console.log(`🚀 Client ${clientId} match started in lobby ${data.lobbyId}`);
    });

    client.on('match_ended', (data) => {
      console.log(`🏁 Client ${clientId} match ended in lobby ${data.lobbyId}, winner: ${data.winnerTeam}`);
    });

    client.on('error', (error) => {
      console.log(`❌ Client ${clientId} error:`, error);
      clearTimeout(timeout);
      reject(error);
    });

    client.on('disconnect', (reason) => {
      console.log(`👋 Client ${clientId} disconnected: ${reason}`);
    });
  });
}

async function testMultiLobby() {
  try {
    console.log('\n📊 Step 1: Check initial server state');
    const healthResponse = await fetch('http://localhost:3000/health');
    const health = await healthResponse.json();
    console.log('Server health:', health);

    console.log('\n🔗 Step 2: Create multiple clients');
    const clients = [];
    
    // Create 4 clients
    for (let i = 1; i <= 4; i++) {
      console.log(`Creating client ${i}...`);
      try {
        const client = await createClient(i);
        clients.push({ id: i, client });
        await delay(500); // Small delay between connections
      } catch (error) {
        console.error(`Failed to create client ${i}:`, error.message);
      }
    }

    console.log(`\n✅ Successfully connected ${clients.length} clients`);

    if (clients.length === 0) {
      throw new Error('No clients connected successfully');
    }

    console.log('\n🎯 Step 3: Test matchmaking');
    
    // First two clients find match for deathmatch
    console.log('Clients 1-2 finding deathmatch lobby...');
    clients.slice(0, 2).forEach(({id, client}) => {
      client.emit('find_match', { gameMode: 'deathmatch' });
    });

    await delay(2000);

    // Next two clients find match (should join same lobby or create new one)
    console.log('Clients 3-4 finding deathmatch lobby...');
    clients.slice(2, 4).forEach(({id, client}) => {
      client.emit('find_match', { gameMode: 'deathmatch' });
    });

    await delay(3000);

    console.log('\n📊 Step 4: Check lobby status');
    const lobbyResponse = await fetch('http://localhost:3000/debug/lobbies');
    const lobbyData = await lobbyResponse.json();
    console.log('Lobby status:', JSON.stringify(lobbyData, null, 2));

    console.log('\n⏰ Step 5: Wait for potential match start...');
    await delay(8000); // Wait for match to potentially start

    console.log('\n📊 Step 6: Final lobby status');
    const finalLobbyResponse = await fetch('http://localhost:3000/debug/lobbies');
    const finalLobbyData = await finalLobbyResponse.json();
    console.log('Final lobby status:', JSON.stringify(finalLobbyData, null, 2));

    console.log('\n🧹 Step 7: Cleanup');
    clients.forEach(({id, client}) => {
      client.disconnect();
    });

    console.log('\n🎉 Multi-lobby test completed!');
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`- Clients created: ${clients.length}`);
    console.log(`- Final lobbies: ${finalLobbyData.totalLobbies}`);
    console.log(`- Total players: ${finalLobbyData.stats.totalPlayers}`);
    console.log(`- Lobbies by status:`, finalLobbyData.stats.lobbiesByStatus);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMultiLobby().then(() => {
  console.log('\n✅ Test script completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Test script failed:', error);
  process.exit(1);
});
