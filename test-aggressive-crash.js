const io = require('socket.io-client');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAggressiveCrash() {
  console.log('🧪 Testing Aggressive Multi-Lobby Scenarios');
  console.log('===========================================');
  
  try {
    // Scenario 1: Fill first lobby completely, then add more players
    console.log('\n📍 Scenario 1: Fill lobby to capacity then overflow...');
    
    const maxPlayers = 8;
    const clients = [];
    
    // Create exactly 8 players to fill first lobby
    for (let i = 1; i <= maxPlayers; i++) {
      const client = io('http://localhost:3000', { forceNew: true });
      
      client.on('connect', () => {
        console.log(`✅ Client ${i} connected`);
        client.emit('find_match', { gameMode: 'deathmatch' });
      });
      
      client.on('lobby_joined', (data) => {
        console.log(`🎮 Client ${i} joined lobby - Players: ${data.playerCount}/${data.maxPlayers}`);
      });
      
      client.on('match_started', (data) => {
        console.log(`🚀 Client ${i} - match started!`);
      });
      
      client.on('error', (error) => {
        console.log(`❌ Client ${i} error:`, error);
      });
      
      clients.push(client);
      await delay(200); // Small delay between connections
    }
    
    // Wait for lobby to fill and match to start
    console.log('\n⏰ Waiting for first lobby to fill and start...');
    await delay(8000);
    
    // Check server status
    let response = await fetch('http://localhost:3000/debug/lobbies');
    let data = await response.json();
    console.log(`📊 After filling: ${data.totalLobbies} lobbies, ${data.stats.totalPlayers} players`);
    
    // NOW add 9th player - this should create second lobby
    console.log('\n📍 Adding 9th player (should trigger new lobby creation)...');
    
    const client9 = io('http://localhost:3000', { forceNew: true });
    
    client9.on('connect', () => {
      console.log('✅ Client 9 connected');
      client9.emit('find_match', { gameMode: 'deathmatch' });
    });
    
    client9.on('lobby_joined', (data) => {
      console.log(`🎮 Client 9 joined lobby - Players: ${data.playerCount}/${data.maxPlayers}`);
    });
    
    client9.on('matchmaking_failed', (data) => {
      console.log('❌ Client 9 matchmaking failed:', data);
    });
    
    await delay(3000);
    
    // Check if server survived
    try {
      response = await fetch('http://localhost:3000/debug/lobbies');
      data = await response.json();
      console.log(`📊 After 9th player: ${data.totalLobbies} lobbies, ${data.stats.totalPlayers} players`);
      console.log('✅ Server survived 9th player');
    } catch (error) {
      console.log('❌ CRASH DETECTED: Server stopped responding after 9th player!');
      return;
    }
    
    // Scenario 2: Rapid simultaneous connections
    console.log('\n📍 Scenario 2: Rapid simultaneous connections...');
    
    const rapidClients = [];
    for (let i = 10; i <= 15; i++) {
      const client = io('http://localhost:3000', { forceNew: true });
      
      client.on('connect', () => {
        console.log(`⚡ Rapid client ${i} connected`);
        client.emit('find_match', { gameMode: 'deathmatch' });
      });
      
      client.on('lobby_joined', (data) => {
        console.log(`⚡ Rapid client ${i} joined lobby`);
      });
      
      rapidClients.push(client);
      // NO delay - all connect simultaneously
    }
    
    await delay(5000);
    
    // Final server check
    try {
      response = await fetch('http://localhost:3000/debug/lobbies');
      data = await response.json();
      console.log(`📊 Final state: ${data.totalLobbies} lobbies, ${data.stats.totalPlayers} players`);
      
      data.lobbies.forEach((lobby, index) => {
        console.log(`  Lobby ${index + 1}: ${lobby.playerCount}/${lobby.maxPlayers} players - ${lobby.status}`);
      });
      
      console.log('\n✅ All scenarios completed without crash');
      
    } catch (error) {
      console.log('❌ CRASH DETECTED: Server stopped responding!');
      console.log('   Error:', error.message);
    }
    
    // Cleanup
    clients.forEach(client => client.disconnect());
    rapidClients.forEach(client => client.disconnect());
    client9.disconnect();
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
  
  process.exit(0);
}

setTimeout(() => {
  console.log('⏰ Test timeout');
  process.exit(1);
}, 30000);

testAggressiveCrash().catch(console.error);
