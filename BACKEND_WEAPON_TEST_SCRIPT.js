// Backend Weapon Event Test Script
// Run this to test if your backend properly handles all weapon events

const io = require('socket.io-client');

// Test all 15 weapons
const WEAPON_TESTS = [
  // Primary
  { type: 'rifle', category: 'primary', expectHit: true },
  { type: 'smg', category: 'primary', expectHit: true },
  { type: 'shotgun', category: 'primary', expectHit: true, pelletCount: 8 },
  { type: 'battlerifle', category: 'primary', expectHit: true },
  { type: 'sniperrifle', category: 'primary', expectHit: true },
  
  // Secondary
  { type: 'pistol', category: 'secondary', expectHit: true },
  { type: 'revolver', category: 'secondary', expectHit: true },
  { type: 'suppressedpistol', category: 'secondary', expectHit: true },
  
  // Support - Projectiles
  { type: 'grenade', category: 'support', expectProjectile: true, chargeLevel: 3 },
  { type: 'smokegrenade', category: 'support', expectProjectile: true, chargeLevel: 1 },
  { type: 'flashbang', category: 'support', expectProjectile: true, chargeLevel: 1 },
  { type: 'grenadelauncher', category: 'support', expectProjectile: true },
  { type: 'rocket', category: 'support', expectProjectile: true },
  
  // Support - Special
  { type: 'machinegun', category: 'support', expectHit: true },
  { type: 'antimaterialrifle', category: 'support', expectHit: true }
];

class WeaponTestRunner {
  constructor() {
    this.socket = null;
    this.playerId = null;
    this.currentTest = 0;
    this.results = [];
    this.testTimeout = null;
  }

  async run() {
    console.log('🔫 Backend Weapon Test Suite\n');
    console.log('Testing all 15 weapon types...\n');
    
    await this.connect();
    await this.spawn();
    await this.runAllTests();
    this.showResults();
    process.exit(this.results.some(r => !r.passed) ? 1 : 0);
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = io('http://localhost:3000', {
        auth: { password: 'dev' }
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to server');
      });

      this.socket.on('auth:success', () => {
        console.log('✅ Authenticated');
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        reject(new Error(`Connection failed: ${err.message}`));
      });

      // Set up event listeners
      this.setupEventListeners();
    });
  }

  spawn() {
    return new Promise((resolve) => {
      this.socket.emit('player:spawn', { name: 'WeaponTester' });
      
      this.socket.once('player:spawned', (data) => {
        this.playerId = data.playerId;
        console.log(`✅ Spawned with ID: ${this.playerId}\n`);
        resolve();
      });
    });
  }

  setupEventListeners() {
    // Listen for expected responses
    this.socket.on('weapon:hit', (data) => {
      this.handleResponse('hit', data);
    });

    this.socket.on('weapon:miss', (data) => {
      this.handleResponse('miss', data);
    });

    this.socket.on('wall:damaged', (data) => {
      this.handleResponse('wall', data);
    });

    this.socket.on('projectile:created', (data) => {
      this.handleResponse('projectile', data);
    });

    this.socket.on('weapon:equipped', (data) => {
      console.log(`   Equipped: ${data.weapons.join(', ')}`);
    });
  }

  handleResponse(type, data) {
    if (this.currentTest >= WEAPON_TESTS.length) return;
    
    const test = WEAPON_TESTS[this.currentTest];
    clearTimeout(this.testTimeout);
    
    const result = {
      weapon: test.type,
      passed: false,
      response: type,
      message: ''
    };

    // Check if response matches expectation
    if (test.expectHit && (type === 'hit' || type === 'miss' || type === 'wall')) {
      result.passed = true;
      result.message = `Got ${type} response`;
    } else if (test.expectProjectile && type === 'projectile') {
      result.passed = data.type === test.type;
      result.message = result.passed ? 
        'Projectile created with correct type' : 
        `Wrong projectile type: ${data.type}`;
    } else {
      result.message = `Expected ${test.expectHit ? 'hit/miss' : 'projectile'}, got ${type}`;
    }

    this.results.push(result);
    console.log(`   ${result.passed ? '✅' : '❌'} ${result.message}`);
    
    // Continue to next test
    setTimeout(() => this.nextTest(), 500);
  }

  async runAllTests() {
    for (let i = 0; i < WEAPON_TESTS.length; i++) {
      await this.runSingleTest(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  runSingleTest(index) {
    return new Promise((resolve) => {
      this.currentTest = index;
      const test = WEAPON_TESTS[index];
      
      console.log(`\nTesting ${test.type}...`);
      
      // First equip the weapon
      const loadout = {};
      if (test.category === 'primary') {
        loadout.primary = test.type;
        loadout.secondary = 'pistol';
        loadout.support = [];
      } else if (test.category === 'secondary') {
        loadout.primary = 'rifle';
        loadout.secondary = test.type;
        loadout.support = [];
      } else {
        loadout.primary = 'rifle';
        loadout.secondary = 'pistol';
        loadout.support = [test.type];
      }
      
      this.socket.emit('weapon:equip', loadout);
      
      // Wait a bit then fire
      setTimeout(() => {
        const fireData = {
          weaponType: test.type,
          position: { x: 240, y: 135 },
          targetPosition: { x: 300, y: 135 },
          direction: 0,
          isADS: false,
          timestamp: Date.now(),
          sequence: Date.now()
        };
        
        // Add weapon-specific fields
        if (test.pelletCount) {
          fireData.pelletCount = test.pelletCount;
        }
        if (test.chargeLevel) {
          fireData.chargeLevel = test.chargeLevel;
        }
        
        this.socket.emit('weapon:fire', fireData);
        
        // Set timeout for no response
        this.testTimeout = setTimeout(() => {
          this.results.push({
            weapon: test.type,
            passed: false,
            response: 'none',
            message: 'No response received (timeout)'
          });
          console.log(`   ❌ No response received`);
          resolve();
        }, 2000);
      }, 500);
      
      // Use handleResponse to resolve
      this.nextTest = resolve;
    });
  }

  showResults() {
    console.log('\n' + '='.repeat(50));
    console.log('TEST RESULTS');
    console.log('='.repeat(50) + '\n');
    
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    
    this.results.forEach(r => {
      console.log(`${r.passed ? '✅' : '❌'} ${r.weapon.padEnd(20)} ${r.message}`);
    });
    
    console.log('\n' + '='.repeat(50));
    console.log(`TOTAL: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);
    console.log('='.repeat(50) + '\n');
    
    if (passed === total) {
      console.log('🎉 All weapons working correctly!');
    } else {
      console.log('❌ Some weapons need fixes. Check the implementation.');
    }
  }
}

// Run the tests
const runner = new WeaponTestRunner();
runner.run().catch(console.error); 