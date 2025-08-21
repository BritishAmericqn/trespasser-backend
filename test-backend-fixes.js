#!/usr/bin/env node

/**
 * Test script to verify all backend fixes:
 * 1. Kill counting (should only increment by 1)
 * 2. Respawn events (should be sent immediately)
 * 3. Debug handlers (should respond properly)
 */

const io = require('socket.io-client');

async function testBackendFixes() {
  console.log('🧪 Testing Backend Fixes...\n');
  
  const client1 = io('http://localhost:3000');
  const client2 = io('http://localhost:3000');
  
  return new Promise((resolve, reject) => {
    let lobby1Id = null;
    let player1Connected = false;
    let player2Connected = false;
    let testResults = {
      debugEvents: false,
      respawnEvent: false,
      killCounting: false
    };
    
    // Client 1 setup
    client1.on('connect', async () => {
      console.log('✅ Client 1 connected');
      player1Connected = true;
      
      // Join lobby
      client1.emit('find_match', { gameMode: 'deathmatch' });
    });
    
    client1.on('lobby_joined', (data) => {
      console.log(`✅ Client 1 joined lobby: ${data.lobbyId}`);
      lobby1Id = data.lobbyId;
      
      // Join game
      client1.emit('player:join', {
        loadout: {
          primary: 'rifle',
          secondary: 'pistol',
          support: ['grenade'],
          team: 'red'
        },
        playerName: 'Player1',
        timestamp: Date.now()
      });
    });
    
    // Test 1: Debug events
    client1.on('game:state', () => {
      if (!testResults.debugEvents) {
        console.log('\n📝 Test 1: Debug Events');
        client1.emit('debug:request_match_state');
      }
    });
    
    client1.on('debug:match_state', (state) => {
      console.log('✅ Debug event received!');
      console.log(`  Status: ${state.status}, Players: ${state.playerCount}`);
      testResults.debugEvents = true;
      
      // Connect client 2 for kill test
      connectClient2();
    });
    
    // Test 2: Respawn events
    client1.on('backend:player:died', (data) => {
      console.log('\n📝 Test 2: Respawn Event');
      console.log('  Player died, requesting respawn in 3 seconds...');
      
      setTimeout(() => {
        client1.emit('player:respawn');
      }, 3100);
    });
    
    client1.on('backend:player:respawned', (data) => {
      console.log('✅ Respawn event received!');
      console.log(`  Position: (${data.position.x}, ${data.position.y})`);
      testResults.respawnEvent = true;
      
      // All tests complete
      checkTestsComplete();
    });
    
    // Test 3: Kill counting
    let initialKills = 0;
    let killsReceived = false;
    
    client1.on('backend:player:died', (data) => {
      if (data.killerId && !killsReceived) {
        console.log('\n📝 Test 3: Kill Counting');
        console.log('  Checking kill count...');
        killsReceived = true;
        
        // Request match state to check kills
        setTimeout(() => {
          client1.emit('debug:request_match_state');
        }, 100);
      }
    });
    
    client1.on('debug:match_state', (state) => {
      if (killsReceived && !testResults.killCounting) {
        const killer = state.players.find(p => p.playerId === client2.id);
        if (killer) {
          console.log(`  Killer has ${killer.kills} kills`);
          if (killer.kills === 1) {
            console.log('✅ Kill count correct (1 kill, not doubled)!');
            testResults.killCounting = true;
          } else {
            console.log(`❌ Kill count incorrect! Expected 1, got ${killer.kills}`);
            testResults.killCounting = false;
          }
        }
      }
    });
    
    // Client 2 setup
    function connectClient2() {
      console.log('\n🔫 Connecting Client 2 for combat test...');
      
      client2.on('connect', () => {
        console.log('✅ Client 2 connected');
        player2Connected = true;
        
        // Join same lobby
        client2.emit('join_lobby', { lobbyId: lobby1Id });
      });
      
      client2.on('lobby_joined', (data) => {
        console.log(`✅ Client 2 joined lobby: ${data.lobbyId}`);
        
        // Join game as blue team
        client2.emit('player:join', {
          loadout: {
            primary: 'rifle',
            secondary: 'pistol',
            support: ['grenade'],
            team: 'blue'
          },
          playerName: 'Player2',
          timestamp: Date.now()
        });
      });
      
      client2.on('game:state', (gameState) => {
        if (!player2Connected) return;
        
        // Find player 1's position and shoot them
        const player1 = gameState.players[client1.id];
        if (player1 && player1.health > 0) {
          console.log('  Client 2 shooting at Client 1...');
          
          // Fire multiple shots to ensure kill
          for (let i = 0; i < 5; i++) {
            client2.emit('weapon:fire', {
              playerId: client2.id,
              position: gameState.players[client2.id].transform.position,
              direction: Math.atan2(
                player1.transform.position.y - gameState.players[client2.id].transform.position.y,
                player1.transform.position.x - gameState.players[client2.id].transform.position.x
              ),
              weaponType: 'rifle',
              timestamp: Date.now()
            });
          }
        }
      });
    }
    
    // Check if all tests complete
    function checkTestsComplete() {
      console.log('\n📊 Test Results:');
      console.log(`  Debug Events: ${testResults.debugEvents ? '✅' : '❌'}`);
      console.log(`  Respawn Event: ${testResults.respawnEvent ? '✅' : '❌'}`);
      console.log(`  Kill Counting: ${testResults.killCounting ? '✅' : '❌'}`);
      
      const allPassed = testResults.debugEvents && 
                       testResults.respawnEvent && 
                       testResults.killCounting;
      
      client1.disconnect();
      client2.disconnect();
      
      if (allPassed) {
        console.log('\n✅ All backend fixes verified!');
        resolve();
      } else {
        console.log('\n❌ Some tests failed');
        reject(new Error('Backend fixes incomplete'));
      }
    }
    
    // Timeout
    setTimeout(() => {
      console.error('\n❌ Test timed out');
      client1.disconnect();
      client2.disconnect();
      reject(new Error('Test timeout'));
    }, 15000);
  });
}

// Run the test
if (require.main === module) {
  testBackendFixes()
    .then(() => {
      console.log('\n✅ Backend fixes complete and verified!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testBackendFixes };

