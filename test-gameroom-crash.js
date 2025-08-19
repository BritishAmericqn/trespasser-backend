const io = require('socket.io-client');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testGameRoomCrash() {
  console.log('🧪 Testing GameRoom Initialization Race Condition');
  console.log('===============================================');
  console.log('Attempting to trigger crashes during GameRoom creation...');
  
  // Strategy: Force creation of multiple lobbies simultaneously
  // This should create multiple GameRooms in parallel, which might trigger the race condition
  
  const clients = [];
  
  // Create 6 clients that will force creation of multiple lobbies
  // (Since lobbies start matches with 2 players, these should create 3 separate lobbies)
  console.log('\n📍 Creating 6 clients to force multiple lobby creation...');
  
  for (let i = 1; i <= 6; i++) {
    const client = io('http://localhost:3000', { 
      forceNew: true,
      timeout: 3000
    });
    
    let connected = false;
    let joined = false;
    
    client.on('connect', () => {
      connected = true;
      console.log(`✅ Client ${i} connected: ${client.id.substring(0, 8)}`);
      
      // Request PRIVATE lobbies to force new lobby creation
      client.emit('find_match', { 
        gameMode: 'deathmatch',
        isPrivate: false  // Public but each pair should create new lobby after match starts
      });
    });
    
    client.on('lobby_joined', (data) => {
      joined = true;
      console.log(`🎮 Client ${i} joined lobby ${data.lobbyId.substring(-8)} - Players: ${data.playerCount}`);
    });
    
    client.on('matchmaking_failed', (data) => {
      console.log(`❌ Client ${i} matchmaking failed:`, data);
    });
    
    client.on('error', (error) => {
      console.log(`❌ Client ${i} socket error:`, error);
    });
    
    client.on('disconnect', (reason) => {
      if (connected && !joined) {
        console.log(`⚠️ Client ${i} disconnected without joining: ${reason}`);
      }
    });
    
    clients.push({ id: i, client, connected: () => connected, joined: () => joined });
    
    // Small delay to stagger connections slightly
    await delay(50);
  }
  
  console.log('\n⏰ Waiting for lobby creation and matches to start...');
  await delay(8000);
  
  // Check server status
  try {
    const response = await fetch('http://localhost:3000/debug/lobbies');
    const data = await response.json();
    
    console.log('\n📊 Server Status:');
    console.log(`  Total lobbies: ${data.totalLobbies}`);
    console.log(`  Total players: ${data.stats.totalPlayers}`);
    console.log(`  Status breakdown:`, data.stats.lobbiesByStatus);
    
    data.lobbies.forEach((lobby, index) => {
      console.log(`  Lobby ${index + 1}: ${lobby.id.substring(-8)} - ${lobby.playerCount}/${lobby.maxPlayers} players - ${lobby.status}`);
    });
    
    // Count successful connections
    const connectedCount = clients.filter(c => c.connected()).length;
    const joinedCount = clients.filter(c => c.joined()).length;
    
    console.log(`\n📈 Results:`);
    console.log(`  Clients connected: ${connectedCount}/6`);
    console.log(`  Clients joined lobbies: ${joinedCount}/6`);
    
    if (joinedCount < connectedCount) {
      console.log(`\n⚠️ WARNING: ${connectedCount - joinedCount} clients connected but failed to join lobbies`);
      console.log('   This could indicate GameRoom initialization issues');
    }
    
    if (connectedCount < 6) {
      console.log(`\n❌ ISSUE: Only ${connectedCount}/6 clients connected`);
      console.log('   This could indicate server crashes or connection issues');
    }
    
    if (joinedCount === connectedCount && connectedCount === 6) {
      console.log('\n✅ All clients connected and joined successfully - no crash detected');
    }
    
  } catch (error) {
    console.log('\n❌ CRASH DETECTED: Server stopped responding!');
    console.log('   Error:', error.message);
    console.log('   This suggests a server crash during GameRoom creation');
  }
  
  // Cleanup
  clients.forEach(({client}) => {
    try {
      client.disconnect();
    } catch (e) {
      // Ignore cleanup errors
    }
  });
  
  process.exit(0);
}

setTimeout(() => {
  console.log('⏰ Test timeout');
  process.exit(1);
}, 20000);

testGameRoomCrash().catch(console.error);
