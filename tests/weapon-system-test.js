const io = require('socket.io-client');

// Test configuration
const SERVER_URL = 'http://localhost:3000';
const TEST_DURATION = 10000; // 10 seconds

class WeaponSystemTest {
  constructor() {
    this.socket = null;
    this.playerId = null;
    this.testResults = [];
    this.gameState = null;
  }
  
  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = io(SERVER_URL);
      
      this.socket.on('connect', () => {
        this.playerId = this.socket.id;
        console.log(`✅ Connected as player: ${this.playerId}`);
        resolve();
      });
      
      this.socket.on('connect_error', (error) => {
        console.error('❌ Connection failed:', error);
        reject(error);
      });
      
      // Listen for game state updates
      this.socket.on('game:state', (state) => {
        this.gameState = state;
        // console.log('📊 Game state updated:', Object.keys(state));
      });
      
      // Listen for weapon events
      this.socket.on('weapon:fired', (data) => {
        console.log('🔫 Weapon fired:', data);
        this.testResults.push({ type: 'weapon:fired', success: true, data });
      });
      
      this.socket.on('weapon:hit', (data) => {
        console.log('🎯 Weapon hit:', data);
        this.testResults.push({ type: 'weapon:hit', success: true, data });
      });
      
      this.socket.on('weapon:miss', (data) => {
        console.log('💨 Weapon miss:', data);
        this.testResults.push({ type: 'weapon:miss', success: true, data });
      });
      
      this.socket.on('weapon:reloaded', (data) => {
        console.log('🔄 Weapon reloaded:', data);
        this.testResults.push({ type: 'weapon:reloaded', success: true, data });
      });
      
      this.socket.on('weapon:switched', (data) => {
        console.log('🔄 Weapon switched:', data);
        this.testResults.push({ type: 'weapon:switched', success: true, data });
      });
      
      this.socket.on('player:damaged', (data) => {
        console.log('💥 Player damaged:', data);
        this.testResults.push({ type: 'player:damaged', success: true, data });
      });
      
      this.socket.on('wall:damaged', (data) => {
        console.log('🧱 Wall damaged:', data);
        this.testResults.push({ type: 'wall:damaged', success: true, data });
      });
      
      this.socket.on('grenade:thrown', (data) => {
        console.log('💣 Grenade thrown:', data);
        this.testResults.push({ type: 'grenade:thrown', success: true, data });
      });
      
      this.socket.on('projectile:created', (data) => {
        console.log('🚀 Projectile created:', data);
        this.testResults.push({ type: 'projectile:created', success: true, data });
      });
      
      this.socket.on('explosion:created', (data) => {
        console.log('💥 Explosion created:', data);
        this.testResults.push({ type: 'explosion:created', success: true, data });
      });
    });
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      console.log('🔌 Disconnected');
    }
  }
  
  // Test weapon firing
  testWeaponFiring() {
    console.log('\n🔫 Testing weapon firing...');
    
    const weaponFireEvent = {
      playerId: this.playerId,
      weaponType: 'rifle',
      position: { x: 240, y: 135 },
      direction: 0, // pointing right
      isADS: false,
      timestamp: Date.now(),
      sequence: 1
    };
    
    this.socket.emit('weapon:fire', weaponFireEvent);
  }
  
  // Test weapon switching
  testWeaponSwitching() {
    console.log('\n🔄 Testing weapon switching...');
    
    const weapons = ['rifle', 'pistol', 'grenade', 'rocket'];
    let currentWeapon = 0;
    
    const switchInterval = setInterval(() => {
      currentWeapon = (currentWeapon + 1) % weapons.length;
      const weaponSwitchEvent = {
        playerId: this.playerId,
        fromWeapon: weapons[currentWeapon - 1 < 0 ? weapons.length - 1 : currentWeapon - 1],
        toWeapon: weapons[currentWeapon],
        timestamp: Date.now()
      };
      
      this.socket.emit('weapon:switch', weaponSwitchEvent);
    }, 1000);
    
    setTimeout(() => {
      clearInterval(switchInterval);
    }, 5000);
  }
  
  // Test weapon reloading
  testWeaponReloading() {
    console.log('\n🔄 Testing weapon reloading...');
    
    const weaponReloadEvent = {
      playerId: this.playerId,
      weaponType: 'rifle',
      timestamp: Date.now()
    };
    
    this.socket.emit('weapon:reload', weaponReloadEvent);
  }
  
  // Test grenade throwing
  testGrenadeThrow() {
    console.log('\n💣 Testing grenade throwing...');
    
    const grenadeThrowEvent = {
      playerId: this.playerId,
      position: { x: 240, y: 135 },
      direction: Math.PI / 4, // 45 degrees
      chargeLevel: 3,
      timestamp: Date.now()
    };
    
    this.socket.emit('grenade:throw', grenadeThrowEvent);
  }
  
  // Test rapid firing
  testRapidFiring() {
    console.log('\n🔫 Testing rapid firing...');
    
    let sequence = 100;
    const rapidFireInterval = setInterval(() => {
      const weaponFireEvent = {
        playerId: this.playerId,
        weaponType: 'rifle',
        position: { x: 240, y: 135 },
        direction: Math.random() * Math.PI * 2, // random direction
        isADS: Math.random() > 0.5,
        timestamp: Date.now(),
        sequence: sequence++
      };
      
      this.socket.emit('weapon:fire', weaponFireEvent);
    }, 100); // Fire every 100ms
    
    setTimeout(() => {
      clearInterval(rapidFireInterval);
    }, 2000);
  }
  
  // Test wall destruction
  testWallDestruction() {
    console.log('\n🧱 Testing wall destruction...');
    
    // Fire at wall position
    const weaponFireEvent = {
      playerId: this.playerId,
      weaponType: 'rifle',
      position: { x: 150, y: 100 },
      direction: 0.5, // Angle towards wall
      isADS: true,
      timestamp: Date.now(),
      sequence: 200
    };
    
    // Fire multiple shots at the same wall
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        this.socket.emit('weapon:fire', {
          ...weaponFireEvent,
          sequence: 200 + i,
          timestamp: Date.now()
        });
      }, i * 200);
    }
  }
  
  // Send input to move player
  sendPlayerInput(keys = {}, mouse = {}) {
    const input = {
      keys: {
        w: false,
        a: false,
        s: false,
        d: false,
        shift: false,
        ctrl: false,
        r: false,
        g: false,
        '1': false,
        '2': false,
        '3': false,
        '4': false,
        ...keys
      },
      mouse: {
        x: 960, // Center of scaled screen
        y: 540,
        buttons: 0,
        leftPressed: false,
        rightPressed: false,
        leftReleased: false,
        rightReleased: false,
        ...mouse
      },
      sequence: Date.now(),
      timestamp: Date.now()
    };
    
    this.socket.emit('player:input', input);
  }
  
  // Test complete weapon system
  async testWeaponSystem() {
    console.log('\n🚀 Starting weapon system test...');
    
    // Wait for initial game state
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test basic weapon firing
    this.testWeaponFiring();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test weapon switching
    this.testWeaponSwitching();
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test weapon reloading
    this.testWeaponReloading();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test grenade throwing
    this.testGrenadeThrow();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test rapid firing
    this.testRapidFiring();
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test wall destruction
    this.testWallDestruction();
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n✅ Weapon system test completed!');
  }
  
  // Print test results
  printResults() {
    console.log('\n📊 Test Results:');
    console.log('=================');
    
    const eventCounts = {};
    let totalEvents = 0;
    
    for (const result of this.testResults) {
      eventCounts[result.type] = (eventCounts[result.type] || 0) + 1;
      totalEvents++;
    }
    
    console.log(`Total events received: ${totalEvents}`);
    console.log('\nEvent breakdown:');
    for (const [eventType, count] of Object.entries(eventCounts)) {
      console.log(`  ${eventType}: ${count}`);
    }
    
    // Print final game state
    if (this.gameState) {
      console.log('\n🎮 Final Game State:');
      console.log(`  Players: ${Object.keys(this.gameState.players).length}`);
      console.log(`  Walls: ${Object.keys(this.gameState.walls).length}`);
      console.log(`  Projectiles: ${this.gameState.projectiles.length}`);
      
      // Print player weapons
      for (const [playerId, player] of Object.entries(this.gameState.players)) {
        console.log(`  Player ${playerId}:`);
        console.log(`    Current weapon: ${player.weaponId}`);
        console.log(`    Health: ${player.health}`);
        console.log(`    Kills: ${player.kills}`);
        console.log(`    Deaths: ${player.deaths}`);
      }
    }
  }
}

// Run the test
async function runTest() {
  const test = new WeaponSystemTest();
  
  try {
    await test.connect();
    await test.testWeaponSystem();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for final events
    
    test.printResults();
    test.disconnect();
  } catch (error) {
    console.error('❌ Test failed:', error);
    test.disconnect();
  }
  
  process.exit(0);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  process.exit(0);
});

// Run the test
runTest(); 