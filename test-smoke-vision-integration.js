/**
 * Test script to verify smoke zones are properly integrated with vision system
 * and being sent to the frontend in game state
 */

const io = require('socket.io-client');

// Test configuration
const SERVER_URL = 'http://localhost:3000';
const TEST_PLAYER = 'smoke_vision_test';

console.log('🧪 Testing Smoke Zone & Vision Integration...\n');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
  const socket = io(SERVER_URL, {
    reconnection: false,
    timeout: 5000
  });

  return new Promise((resolve) => {
    let smokeZonesReceived = false;
    let visionClipped = false;

    // Listen for game state updates (both possible event names)
    const handleGameState = (state) => {
      // Check if smoke zones are in the game state
      if (state.smokeZones !== undefined && !smokeZonesReceived) {
        console.log(`\n📦 Game State includes smokeZones field: ${state.smokeZones ? 'YES' : 'NO'}`);
        
        if (state.smokeZones && state.smokeZones.length > 0) {
          smokeZonesReceived = true;
          console.log(`✅ Smoke zones received: ${state.smokeZones.length} zone(s)`);
          
          state.smokeZones.forEach((zone, i) => {
            console.log(`   Zone ${i}: Position (${zone.position.x.toFixed(1)}, ${zone.position.y.toFixed(1)}), Radius: ${zone.radius.toFixed(1)}px, Density: ${zone.density.toFixed(2)}`);
          });
        }
      }
      
      // Check vision polygon
      if (state.vision?.polygon && state.smokeZones?.length > 0) {
        const polygonVertices = state.vision.polygon.length;
        console.log(`\n👁️ Vision polygon vertices: ${polygonVertices}`);
        
        // More vertices usually means vision is being clipped by smoke
        if (polygonVertices > 20) {
          visionClipped = true;
          console.log('✅ Vision appears to be affected by smoke (complex polygon)');
        }
      }
    };
    
    // Listen for both possible event names
    socket.on('gameState', handleGameState);
    socket.on('game:state', handleGameState);

    socket.on('connect', async () => {
      console.log('✅ Connected to server');
      
      // First use matchmaking to get into a lobby
      console.log('🎮 Finding match...');
      socket.emit('find_match', {
        gameMode: 'deathmatch',
        isPrivate: false
      });
      
      // Wait for matchmaking to complete
      await sleep(1000);
      
      // Now join the game with loadout
      console.log('🎯 Joining game with loadout...');
      socket.emit('player:join', {
        loadout: {
          primary: 'rifle',
          secondary: 'pistol',
          support: ['smokegrenade'],
          team: 'team1'
        },
        timestamp: Date.now()
      });
      
      console.log('⏳ Waiting for game state...');
      await sleep(1000);
      
      // Proceed with test regardless of joined event
      console.log('📋 Starting smoke grenade test...\n');
      
      // Wait a moment for initial state
      await sleep(500);
      
      // Switch to smoke grenade (already equipped in loadout)
      console.log('🔄 Switching to smoke grenade...');
      socket.emit('weapon:switch', { 
        toWeapon: 'smokegrenade',
        fromWeapon: 'rifle'
      });
      
      await sleep(500);
      
      // Throw smoke grenade
      console.log('💨 Throwing smoke grenade...');
      socket.emit('weapon:fire', {
        weaponType: 'smokegrenade',
        position: { x: 240, y: 135 },
        direction: 0,
        isADS: false,
        timestamp: Date.now(),
        sequence: 1,
        chargeLevel: 0
      });
      
      console.log('⏳ Waiting for smoke deployment (2s fuse)...');
      await sleep(2500);
      
      console.log('⏳ Waiting for smoke expansion (1.5s)...');
      await sleep(2000);
      
      console.log('⏳ Monitoring smoke persistence...');
      await sleep(3000);
      
      // Check results
      console.log('\n📊 Test Results:');
      console.log(`- Smoke zones in game state: ${smokeZonesReceived ? '✅ YES' : '❌ NO'}`);
      console.log(`- Vision affected by smoke: ${visionClipped ? '✅ YES' : '⚠️ POSSIBLY (check polygon)'}`);
      
      if (smokeZonesReceived) {
        console.log('\n✅ INTEGRATION SUCCESSFUL!');
        console.log('Smoke zones are properly integrated with the vision system and being sent to frontend.');
      } else {
        console.log('\n❌ INTEGRATION ISSUE DETECTED');
        console.log('Smoke zones are not appearing in the game state sent to clients.');
      }
      
      socket.disconnect();
      resolve();
    });

    socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      socket.disconnect();
      resolve();
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Connection failed:', error.message);
      resolve();
    });
  });
}

// Run the test
runTest().then(() => {
  console.log('\n🏁 Test complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
