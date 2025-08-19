const io = require('socket.io-client');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testWithErrorHandling() {
  console.log('🧪 Testing Rapid Connections with Error Handling');
  console.log('===============================================');
  
  const clients = [];
  
  for (let i = 1; i <= 4; i++) {
    console.log(`📍 Creating client ${i}...`);
    
    const client = io('http://localhost:3000', {
      reconnection: false,
      timeout: 5000,
      forceNew: true
    });
    
    let hasJoinedLobby = false;
    
    client.on('connect', () => {
      console.log(`✅ Client ${i} connected: ${client.id.substring(0, 8)}`);
      console.log(`📍 Client ${i} requesting match...`);
      client.emit('find_match', { gameMode: 'deathmatch' });
    });
    
    client.on('lobby_joined', (data) => {
      hasJoinedLobby = true;
      console.log(`🎮 Client ${i} joined lobby ${data.lobbyId.substring(-8)} - Players: ${data.playerCount}`);
    });
    
    client.on('matchmaking_failed', (data) => {
      console.log(`❌ Client ${i} matchmaking failed:`, data);
    });
    
    client.on('error', (error) => {
      console.log(`❌ Client ${i} error:`, error);
    });
    
    client.on('disconnect', (reason) => {
      if (!hasJoinedLobby) {
        console.log(`⚠️ Client ${i} disconnected without joining lobby: ${reason}`);
      }
    });
    
    clients.push({ id: i, client, hasJoinedLobby: hasJoinedLobby });
    
    // Very short delay to simulate rapid connections
    await delay(100);
  }
  
  console.log('✅ All clients created, waiting for results...');
  await delay(5000);
  
  // Check which clients successfully joined
  console.log('\n📊 Results Analysis:');
  let successCount = 0;
  clients.forEach(({id, hasJoinedLobby}) => {
    const status = hasJoinedLobby ? '✅ SUCCESS' : '❌ FAILED';
    console.log(`  Client ${id}: ${status}`);
    if (hasJoinedLobby) successCount++;
  });
  
  console.log(`\nSuccess rate: ${successCount}/${clients.length} clients joined lobbies`);
  
  if (successCount < clients.length) {
    console.log('\n❌ CONFIRMED: Race condition in rapid matchmaking requests');
    console.log('   Some clients failed to join lobbies during rapid connection attempts');
  }
  
  // Check server lobby status
  const response = await fetch('http://localhost:3000/debug/lobbies');
  const data = await response.json();
  console.log(`\n📊 Server shows: ${data.stats.totalPlayers} players in ${data.totalLobbies} lobbies`);
  
  // Cleanup
  clients.forEach(({client}) => client.disconnect());
  process.exit(0);
}

setTimeout(() => {
  console.log('⏰ Test timeout');
  process.exit(1);
}, 15000);

testWithErrorHandling().catch(console.error);
