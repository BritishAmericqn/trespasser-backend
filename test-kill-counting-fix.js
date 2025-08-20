#!/usr/bin/env node

/**
 * Test script to verify the kill counting double-increment bug is fixed
 * This simulates kills and checks that kills are counted only once
 */

const io = require('socket.io-client');

async function testKillCountingFix() {
  console.log('🧪 Testing Kill Counting Bug Fix...\n');
  
  const clients = [];
  
  try {
    // Create two clients on different teams
    console.log('📝 Step 1: Creating two players on different teams...');
    
    const client1 = io('http://localhost:3000');
    const client2 = io('http://localhost:3000');
    clients.push(client1, client2);
    
    // Player 1 setup
    await new Promise((resolve) => {
      client1.on('connect', () => {
        console.log('✅ Player 1 connected');
        client1.emit('find_match', { gameMode: 'deathmatch' });
        
        client1.on('lobby_joined', () => {
          client1.emit('player:join', {
            loadout: {
              primary: 'rifle',
              secondary: 'pistol',
              support: ['grenade'],
              team: 'red'
            },
            playerName: 'TestPlayer_Red',
            timestamp: Date.now()
          });
          resolve();
        });
      });
    });
    
    // Player 2 setup  
    await new Promise((resolve) => {
      client2.on('connect', () => {
        console.log('✅ Player 2 connected');
        client2.emit('find_match', { gameMode: 'deathmatch' });
        
        client2.on('lobby_joined', () => {
          client2.emit('player:join', {
            loadout: {
              primary: 'rifle',
              secondary: 'pistol', 
              support: ['grenade'],
              team: 'blue'
            },
            playerName: 'TestPlayer_Blue',
            timestamp: Date.now()
          });
          resolve();
        });
      });
    });
    
    console.log('📝 Step 2: Starting match...');
    
    // Force start match
    client1.emit('force_start_match', { reason: 'Testing kill counting' });
    
    await new Promise((resolve) => {
      client1.on('match_started', () => {
        console.log('✅ Match started');
        resolve();
      });
    });
    
    // Wait for both players to get game state
    await new Promise((resolve) => {
      let gameStatesReceived = 0;
      
      const handleGameState = (gameState) => {
        gameStatesReceived++;
        if (gameStatesReceived >= 2) {
          console.log('✅ Both players received initial game state');
          resolve();
        }
      };
      
      client1.on('game:state', handleGameState);
      client2.on('game:state', handleGameState);
      
      // Timeout
      setTimeout(() => {
        if (gameStatesReceived < 2) {
          console.log(`⚠️ Only ${gameStatesReceived}/2 players received game state`);
          resolve();
        }
      }, 3000);
    });
    
    console.log('📝 Step 3: Testing kill counting...');
    
    // Track kill counts from game state updates
    let lastRedKills = 0;
    let lastBlueKills = 0;
    let killEvents = [];
    
    const trackKills = (gameState, playerName) => {
      let redKills = 0;
      let blueKills = 0;
      
      Object.values(gameState.players).forEach(player => {
        if (player.team === 'red') {
          redKills += player.kills;
        } else if (player.team === 'blue') {
          blueKills += player.kills;
        }
      });
      
      if (redKills !== lastRedKills || blueKills !== lastBlueKills) {
        console.log(`📊 [${playerName}] KILL TOTALS - RED: ${redKills}, BLUE: ${blueKills}`);
        
        // Check for double-counting
        if (redKills - lastRedKills > 1) {
          console.log(`🚨 DOUBLE-COUNT BUG DETECTED! Red kills jumped by ${redKills - lastRedKills}`);
        }
        if (blueKills - lastBlueKills > 1) {
          console.log(`🚨 DOUBLE-COUNT BUG DETECTED! Blue kills jumped by ${blueKills - lastBlueKills}`);
        }
        
        killEvents.push({
          timestamp: Date.now(),
          observer: playerName,
          redKills,
          blueKills,
          redDelta: redKills - lastRedKills,
          blueDelta: blueKills - lastBlueKills
        });
        
        lastRedKills = redKills;
        lastBlueKills = blueKills;
      }
    };
    
    client1.on('game:state', (gameState) => trackKills(gameState, 'Player1'));
    client2.on('game:state', (gameState) => trackKills(gameState, 'Player2'));
    
    // Simulate Player 1 killing Player 2
    console.log('📝 Step 4: Player 1 shooting Player 2...');
    
    // Get Player 2's position for targeting
    await new Promise((resolve) => {
      client1.on('game:state', (gameState) => {
        const player2 = Object.values(gameState.players).find(p => p.name === 'TestPlayer_Blue');
        if (player2) {
          // Simulate shooting at Player 2's position
          const weaponFireEvent = {
            weaponType: 'rifle',
            position: { x: 100, y: 100 }, // Player 1 position
            direction: Math.atan2(player2.position.y - 100, player2.position.x - 100),
            isADS: false,
            timestamp: Date.now(),
            sequence: 1
          };
          
          console.log(`🔫 Player 1 firing at Player 2's position (${player2.position.x.toFixed(1)}, ${player2.position.y.toFixed(1)})`);
          client1.emit('weapon:fire', weaponFireEvent);
          
          setTimeout(resolve, 2000); // Wait 2 seconds to see results
        }
      });
    });
    
    console.log('📝 Step 5: Checking final kill counts...');
    
    // Request final match state
    client1.emit('debug:request_match_state');
    
    await new Promise((resolve) => {
      client1.on('debug:match_state', (state) => {
        console.log('\n📊 FINAL KILL COUNT VERIFICATION:');
        console.log('  Red Team Kills:', state.redKills);
        console.log('  Blue Team Kills:', state.blueKills);
        console.log('  Individual Players:');
        state.players.forEach(p => {
          console.log(`    ${p.playerName} (${p.team}): ${p.kills} kills, ${p.deaths} deaths`);
        });
        
        // Analyze kill events for double-counting
        console.log('\n📈 KILL EVENT ANALYSIS:');
        if (killEvents.length === 0) {
          console.log('  ⚠️ No kill events detected');
        } else {
          killEvents.forEach((event, i) => {
            console.log(`  Event ${i + 1}: Red +${event.redDelta}, Blue +${event.blueDelta} (by ${event.observer})`);
            if (event.redDelta > 1 || event.blueDelta > 1) {
              console.log(`    🚨 SUSPICIOUS: Kill count jumped by more than 1!`);
            }
          });
        }
        
        // Final verdict
        const hasDoubleCounting = killEvents.some(e => e.redDelta > 1 || e.blueDelta > 1);
        if (hasDoubleCounting) {
          console.log('\n❌ DOUBLE-COUNTING BUG STILL EXISTS!');
        } else {
          console.log('\n✅ KILL COUNTING APPEARS TO BE FIXED!');
        }
        
        resolve();
      });
    });
    
    console.log('\n🧪 Kill counting test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    clients.forEach(client => client.disconnect());
  }
}

// Run the test
if (require.main === module) {
  testKillCountingFix()
    .then(() => {
      console.log('\n✅ Test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testKillCountingFix };
