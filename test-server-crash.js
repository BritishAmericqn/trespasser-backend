const io = require('socket.io-client');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testServerCrash() {
  console.log('🧪 Testing Server Crash Scenario');
  console.log('=================================');
  console.log('1. Create lobby with 2 players and start match');
  console.log('2. Try to have 3rd player find match (should create new lobby)');
  console.log('3. Check if server crashes');
  
  try {
    // Step 1: Create first lobby with 2 players
    console.log('\n📍 Phase 1: Creating first lobby...');
    
    const client1 = io('http://localhost:3000');
    const client2 = io('http://localhost:3000');
    
    let lobby1Id = null;
    let matchStarted = false;
    
    client1.on('connect', () => {
      console.log('✅ Client 1 connected:', client1.id.substring(0, 8));
      client1.emit('find_match', { gameMode: 'deathmatch' });
    });
    
    client1.on('lobby_joined', (data) => {
      lobby1Id = data.lobbyId;
      console.log(`🎮 Client 1 joined lobby ${lobby1Id.substring(-8)} - Players: ${data.playerCount}`);
    });
    
    client1.on('match_started', (data) => {
      matchStarted = true;
      console.log(`✅ Match started in lobby ${data.lobbyId.substring(-8)}`);
    });
    
    client2.on('connect', () => {
      console.log('✅ Client 2 connected:', client2.id.substring(0, 8));
      client2.emit('find_match', { gameMode: 'deathmatch' });
    });
    
    client2.on('lobby_joined', (data) => {
      console.log(`🎮 Client 2 joined lobby ${data.lobbyId.substring(-8)} - Players: ${data.playerCount}`);
    });
    
    client2.on('match_started', (data) => {
      console.log(`✅ Client 2 confirmed match started in lobby ${data.lobbyId.substring(-8)}`);
    });
    
    // Wait for clients to connect and match to start
    await delay(2000);
    console.log('\n⏰ Waiting for match to start...');
    await delay(6000); // Wait for match start countdown
    
    if (!matchStarted) {
      console.log('⚠️ Match may not have started yet, continuing anyway...');
    }
    
    // Check server status before attempting 3rd player
    console.log('\n📊 Server status before 3rd player:');
    try {
      const response = await fetch('http://localhost:3000/debug/lobbies');
      const data = await response.json();
      console.log(`  Lobbies: ${data.totalLobbies}, Players: ${data.stats.totalPlayers}`);
      console.log(`  Status breakdown:`, data.stats.lobbiesByStatus);
    } catch (error) {
      console.log('❌ Server may already be crashed:', error.message);
      return;
    }
    
    // Step 2: Add 3rd player - THIS SHOULD TRIGGER THE CRASH
    console.log('\n📍 Phase 2: Adding 3rd player (crash trigger)...');
    console.log('🚨 This should create a new lobby but may crash the server...');
    
    const client3 = io('http://localhost:3000', {
      timeout: 5000
    });
    
    let client3Connected = false;
    let client3JoinedLobby = false;
    
    client3.on('connect', () => {
      client3Connected = true;
      console.log('✅ Client 3 connected:', client3.id.substring(0, 8));
      console.log('📍 Client 3 requesting match...');
      client3.emit('find_match', { gameMode: 'deathmatch' });
    });
    
    client3.on('lobby_joined', (data) => {
      client3JoinedLobby = true;
      console.log(`🎮 Client 3 joined lobby ${data.lobbyId.substring(-8)} - Players: ${data.playerCount}`);
      if (data.lobbyId === lobby1Id) {
        console.log('⚠️ Client 3 joined EXISTING lobby (unexpected if match is running)');
      } else {
        console.log('✅ Client 3 joined NEW lobby (expected behavior)');
      }
    });
    
    client3.on('matchmaking_failed', (data) => {
      console.log('❌ Client 3 matchmaking failed:', data);
    });
    
    client3.on('error', (error) => {
      console.log('❌ Client 3 error:', error);
    });
    
    client3.on('disconnect', (reason) => {
      console.log(`👋 Client 3 disconnected: ${reason}`);
    });
    
    // Wait for 3rd client to attempt joining
    await delay(5000);
    
    // Check if server is still responding
    console.log('\n📊 Server status after 3rd player attempt:');
    try {
      const response = await fetch('http://localhost:3000/debug/lobbies');
      const data = await response.json();
      console.log(`  Lobbies: ${data.totalLobbies}, Players: ${data.stats.totalPlayers}`);
      console.log(`  Status breakdown:`, data.stats.lobbiesByStatus);
      
      if (client3JoinedLobby) {
        console.log('\n✅ SUCCESS: 3rd player joined successfully, no crash occurred');
      } else if (client3Connected) {
        console.log('\n⚠️ WARNING: 3rd player connected but did not join lobby');
      } else {
        console.log('\n❌ ISSUE: 3rd player could not connect');
      }
      
    } catch (error) {
      console.log('❌ CONFIRMED: Server appears to have crashed!');
      console.log('   Error:', error.message);
      console.log('   This confirms the bug you reported.');
    }
    
    // Cleanup
    client1.disconnect();
    client2.disconnect();
    client3.disconnect();
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
  
  process.exit(0);
}

setTimeout(() => {
  console.log('⏰ Test timeout - server may have crashed or hung');
  process.exit(1);
}, 20000);

testServerCrash().catch(console.error);
