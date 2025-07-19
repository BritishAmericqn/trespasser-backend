const io = require('socket.io-client');

const WEAPON_LIST = {
  primary: ['rifle', 'smg', 'shotgun', 'battlerifle', 'sniperrifle'],
  secondary: ['pistol', 'revolver', 'suppressedpistol'],
  support: ['rocket', 'grenadelauncher', 'machinegun', 'antimaterialrifle'],
  throwable: ['grenade', 'smokegrenade', 'flashbang']
};

async function testAllWeapons() {
  console.log('🔫 Starting comprehensive weapon test...\n');
  
  const socket = io('http://localhost:3000', {
    auth: { password: 'dev' }
  });

  let playerId = null;
  let currentWeapon = null;
  let testIndex = 0;
  const allWeapons = [...WEAPON_LIST.primary, ...WEAPON_LIST.secondary, ...WEAPON_LIST.support];

  socket.on('connect', () => {
    console.log('✅ Connected to server');
  });

  socket.on('auth:success', () => {
    console.log('✅ Authentication successful');
    socket.emit('player:spawn', { name: 'WeaponTester' });
  });

  socket.on('player:spawned', (data) => {
    console.log(`✅ Player spawned with ID: ${data.playerId}`);
    playerId = data.playerId;
    
    // Start weapon testing
    testNextWeapon();
  });

  socket.on('weapon:equipped', (data) => {
    console.log(`📦 Equipped ${data.weaponType}:`, data.weapon);
    currentWeapon = data.weaponType;
    
    // Test firing after a short delay
    setTimeout(() => {
      console.log(`🎯 Testing fire for ${currentWeapon}...`);
      socket.emit('weapon:fire', {
        playerId,
        weaponType: currentWeapon,
        position: { x: 240, y: 135 },
        direction: 0,
        isADS: false,
        timestamp: Date.now(),
        sequence: 1,
        pelletCount: currentWeapon === 'shotgun' ? 8 : undefined
      });
    }, 500);
  });

  socket.on('weapon:fired', (data) => {
    console.log(`✅ ${data.weaponType} fired successfully! Ammo: ${data.ammoRemaining}`);
    
    // Test next weapon after a delay
    setTimeout(() => {
      testNextWeapon();
    }, 1000);
  });

  socket.on('weapon:hit', (data) => {
    console.log(`💥 Hit registered for ${data.weaponType}:`, data);
  });

  socket.on('projectile:created', (data) => {
    console.log(`🚀 Projectile created: ${data.type} (ID: ${data.id})`);
  });

  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });

  function testNextWeapon() {
    if (testIndex >= allWeapons.length) {
      console.log('\n✅ All weapons tested!');
      process.exit(0);
      return;
    }
    
    const weaponToTest = allWeapons[testIndex];
    testIndex++;
    
    console.log(`\n📋 Testing weapon ${testIndex}/${allWeapons.length}: ${weaponToTest}`);
    
    // Give the weapon via debug command
    socket.emit('message', {
      type: 'debug:give_weapon',
      data: weaponToTest
    });
  }

  // Test throwables separately
  socket.on('grenade:thrown', (data) => {
    console.log(`💣 ${data.weaponType} thrown! Remaining: ${data.ammoRemaining}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    process.exit(1);
  });
}

// Run the test
testAllWeapons().catch(console.error); 