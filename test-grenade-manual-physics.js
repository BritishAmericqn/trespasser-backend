const io = require('socket.io-client');
const socket = io('http://localhost:3000');

// ANSI color codes
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

let frameCount = 0;
let lastGrenadePositions = new Map();
let grenadeVelocities = new Map();

socket.on('connect', () => {
  console.log('✅ Connected to server');
  socket.emit('game:join', { playerName: 'GrenadeTester' });
});

socket.on('game:joined', (data) => {
  console.log('✅ Joined game as player:', data.playerId);
  
  console.log(`\n${colors.cyan}🧪 TESTING MANUAL GRENADE PHYSICS${colors.reset}\n`);
  
  // Run test sequence
  runTestSequence();
});

function runTestSequence() {
  console.log(`${colors.yellow}📋 Test Suite:${colors.reset}`);
  console.log('1. Direct wall bounce (90°)');
  console.log('2. Angled wall bounce (45°)');
  console.log('3. Shallow angle slide');
  console.log('4. Corner bounce');
  console.log('5. Boundary bounce');
  console.log('6. Multiple bounces');
  console.log('7. Slow speed damping\n');
  
  let testIndex = 0;
  const tests = [
    // Test 1: Direct wall bounce
    {
      name: "Direct wall bounce",
      position: { x: 100, y: 135 },
      direction: 0, // Right
      chargeLevel: 3,
      expectedBehavior: "Should bounce directly back"
    },
    
    // Test 2: 45-degree bounce
    {
      name: "45° angle bounce",
      position: { x: 100, y: 100 },
      direction: Math.PI * 0.25, // 45 degrees
      chargeLevel: 3,
      expectedBehavior: "Should reflect at opposite angle"
    },
    
    // Test 3: Shallow angle
    {
      name: "Shallow angle slide",
      position: { x: 100, y: 240 },
      direction: Math.PI * 0.1, // Very shallow
      chargeLevel: 4,
      expectedBehavior: "Should slide along wall smoothly"
    },
    
    // Test 4: Corner bounce
    {
      name: "Corner bounce",
      position: { x: 50, y: 50 },
      direction: Math.PI * 0.25, // Towards corner
      chargeLevel: 3,
      expectedBehavior: "Should bounce off corner correctly"
    },
    
    // Test 5: Boundary bounce
    {
      name: "Boundary bounce",
      position: { x: 20, y: 135 },
      direction: Math.PI, // Left into boundary
      chargeLevel: 2,
      expectedBehavior: "Should bounce off game boundary"
    },
    
    // Test 6: Multiple bounces
    {
      name: "Multiple bounces",
      position: { x: 240, y: 50 },
      direction: Math.PI * 0.75, // Down-left
      chargeLevel: 5,
      expectedBehavior: "Should handle multiple bounces"
    },
    
    // Test 7: Slow speed damping
    {
      name: "Slow speed damping",
      position: { x: 200, y: 200 },
      direction: 0,
      chargeLevel: 1, // Minimum speed
      expectedBehavior: "Should stop quickly after bounce"
    }
  ];
  
  function runNextTest() {
    if (testIndex >= tests.length) {
      console.log(`\n${colors.green}✅ All tests launched!${colors.reset}`);
      console.log('Monitoring grenade physics...\n');
      return;
    }
    
    const test = tests[testIndex];
    console.log(`\n${colors.blue}Test ${testIndex + 1}: ${test.name}${colors.reset}`);
    console.log(`Position: (${test.position.x}, ${test.position.y})`);
    console.log(`Direction: ${(test.direction * 180 / Math.PI).toFixed(0)}°`);
    console.log(`Charge: ${test.chargeLevel}`);
    console.log(`Expected: ${test.expectedBehavior}`);
    
    socket.emit('weapon:fire', {
      weaponType: 'grenade',
      position: test.position,
      direction: test.direction,
      chargeLevel: test.chargeLevel,
      isADS: false,
      timestamp: Date.now(),
      sequence: testIndex + 1
    });
    
    testIndex++;
    setTimeout(runNextTest, 2000); // 2 seconds between tests
  }
  
  runNextTest();
}

// Monitor grenade updates
socket.on('game:state', (gameState) => {
  frameCount++;
  
  if (gameState.projectiles && gameState.projectiles.length > 0) {
    gameState.projectiles.forEach(projectile => {
      const lastPos = lastGrenadePositions.get(projectile.id);
      
      if (lastPos) {
        // Calculate velocity
        const dx = projectile.position.x - lastPos.x;
        const dy = projectile.position.y - lastPos.y;
        const dt = 0.05; // 50ms between updates
        
        const vx = dx / dt;
        const vy = dy / dt;
        const speed = Math.sqrt(vx * vx + vy * vy);
        
        // Check for significant velocity changes (bounces)
        const lastVel = grenadeVelocities.get(projectile.id);
        if (lastVel) {
          const velChange = Math.sqrt(
            Math.pow(vx - lastVel.vx, 2) + 
            Math.pow(vy - lastVel.vy, 2)
          );
          
          if (velChange > 10) { // Significant change
            console.log(`\n${colors.magenta}🎾 BOUNCE DETECTED!${colors.reset}`);
            console.log(`Grenade ${projectile.id.substring(0, 8)}`);
            console.log(`Position: (${projectile.position.x.toFixed(0)}, ${projectile.position.y.toFixed(0)})`);
            console.log(`Velocity before: (${lastVel.vx.toFixed(0)}, ${lastVel.vy.toFixed(0)}) = ${lastVel.speed.toFixed(0)} px/s`);
            console.log(`Velocity after: (${vx.toFixed(0)}, ${vy.toFixed(0)}) = ${speed.toFixed(0)} px/s`);
            console.log(`Energy retained: ${(speed / lastVel.speed * 100).toFixed(0)}%`);
          }
        }
        
        // Store current velocity
        grenadeVelocities.set(projectile.id, { vx, vy, speed });
        
        // Log every 20 frames (~1 second)
        if (frameCount % 20 === 0) {
          console.log(`${colors.green}Grenade ${projectile.id.substring(0, 8)}:${colors.reset} ` +
            `pos(${projectile.position.x.toFixed(0)}, ${projectile.position.y.toFixed(0)}) ` +
            `speed: ${speed.toFixed(1)} px/s`);
        }
      }
      
      lastGrenadePositions.set(projectile.id, { ...projectile.position });
    });
  }
});

// Track explosions
socket.on('grenade:explode', (data) => {
  console.log(`\n${colors.red}💥 EXPLOSION!${colors.reset}`);
  console.log(`Position: (${data.position.x.toFixed(0)}, ${data.position.y.toFixed(0)})`);
  console.log(`Radius: ${data.radius}`);
  
  // Clean up tracking for this grenade
  lastGrenadePositions.delete(data.id);
  grenadeVelocities.delete(data.id);
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from server');
  process.exit(0);
});

// Exit handler
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down test client...');
  socket.disconnect();
  process.exit(0);
});

console.log('🎮 Manual Grenade Physics Test Client');
console.log('====================================');
console.log('This tests the new manual physics implementation');
console.log('Watch for proper bouncing, sliding, and damping');
console.log('\nConnecting to server...'); 