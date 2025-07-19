const io = require('socket.io-client');

console.log(`
╔═══════════════════════════════════════╗
║   WEAPON SYSTEM QUICK CHECK           ║
╚═══════════════════════════════════════╝

This will test if weapons are working...
`);

const socket = io('http://localhost:3000', {
    auth: { password: 'MyGamePassword123' }
});

let testsPassed = 0;
let testsFailed = 0;

socket.on('connect', () => {
    console.log('✅ Test 1 PASSED: Connected to server');
    testsPassed++;
    
    // Send authentication
    socket.emit('authenticate', { password: 'MyGamePassword123' });
});

socket.on('authenticated', () => {
    console.log('✅ Test 2 PASSED: Authenticated');
    testsPassed++;
    // Player is automatically added to game after auth
});

socket.on('game:state', (data) => {
    console.log('✅ Test 3 PASSED: Received initial game state');
    testsPassed++;
    
    // Send player:join with loadout (NEW!)
    console.log('\n🔫 Sending player:join with loadout...');
    socket.emit('player:join', {
        loadout: {
            primary: 'rifle',
            secondary: 'pistol',
            support: ['grenade'],
            team: 'blue'
        },
        timestamp: Date.now()
    });
});

socket.on('weapon:equipped', (data) => {
    console.log('✅ Test 4 PASSED: Weapons equipped');
    console.log(`   Weapons: ${data.weapons.join(', ')}`);
    testsPassed++;
    
    // Test weapon fire
    console.log('\n🎯 Testing weapon fire...');
    socket.emit('weapon:fire', {
        weaponType: 'rifle',
        position: {x: 240, y: 135},
        targetPosition: {x: 300, y: 135},
        direction: 0,
        isADS: false,
        timestamp: Date.now(),
        sequence: 1
    });
});

socket.on('weapon:fired', (data) => {
    console.log('✅ Test 5 PASSED: Weapon fired event received');
    console.log(`   Weapon: ${data.weaponType}, Ammo: ${data.ammoRemaining}`);
    testsPassed++;
});

socket.on('weapon:hit', (data) => {
    console.log('✅ Test 6 PASSED: Weapon hit event received');
    testsPassed++;
    showResults();
});

socket.on('weapon:miss', (data) => {
    console.log('✅ Test 6 PASSED: Weapon miss event received');
    testsPassed++;
    showResults();
});

socket.on('connect_error', (error) => {
    console.log('❌ FAILED: Cannot connect to server');
    console.log('   Make sure server is running: npm start');
    testsFailed++;
    process.exit(1);
});

function showResults() {
    console.log(`
╔═══════════════════════════════════════╗
║            TEST RESULTS               ║
╚═══════════════════════════════════════╝

Tests Passed: ${testsPassed}
Tests Failed: ${testsFailed}

${testsPassed >= 5 ? '🎉 WEAPONS ARE WORKING!' : '❌ WEAPONS HAVE ISSUES'}

${testsPassed >= 5 ? 'The backend weapon system is fully functional!' : 'Some issues detected.'}
`);
    process.exit(0);
}

// Timeout after 5 seconds
setTimeout(() => {
    console.log('\n⏱️ Test timed out');
    console.log(`Tests passed: ${testsPassed}/6`);
    
    if (testsPassed === 0) {
        console.log('\n❌ Server is not running or not responding');
        console.log('Make sure to run: npm start');
    } else if (testsPassed < 4) {
        console.log('\n❌ Connection works but weapons not equipping');
    } else if (testsPassed < 6) {
        console.log('\n⚠️ Weapons equip but firing has issues');
    }
    
    process.exit(1);
}, 5000); 