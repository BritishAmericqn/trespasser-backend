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

let lastGrenadeVelocity = null;
let explosionDetected = false;

socket.on('connect', () => {
  console.log('✅ Connected to server');
  socket.emit('game:join', { playerName: 'GrenadeTester' });
});

socket.on('game:joined', (data) => {
  console.log('✅ Joined game as player:', data.playerId);
  
  console.log(`\n${colors.cyan}🧪 TESTING GRENADE FIXES${colors.reset}\n`);
  console.log('1. Testing friction/slowdown');
  console.log('2. Testing explosion without crash\n');
  
  // Throw a grenade
  setTimeout(() => {
    console.log(`${colors.yellow}🎯 Throwing grenade...${colors.reset}`);
    socket.emit('weapon:fire', {
      weaponType: 'grenade',
      charge: 0.5,
      direction: { x: 1, y: 0 }
    });
  }, 500);
  
  // Test complete after 5 seconds
  setTimeout(() => {
    if (explosionDetected) {
      console.log(`\n${colors.green}✅ TEST PASSED: Grenade exploded without crashing!${colors.reset}`);
    } else {
      console.log(`\n${colors.red}❌ TEST FAILED: No explosion detected${colors.reset}`);
    }
    
    console.log('\nTest complete. Disconnecting...');
    socket.disconnect();
    process.exit(0);
  }, 5000);
});

socket.on('game:state', (gameState) => {
  // Track grenade velocity to check friction
  Object.values(gameState.projectiles || {}).forEach(projectile => {
    if (projectile.type === 'grenade') {
      const speed = Math.sqrt(projectile.velocity.x ** 2 + projectile.velocity.y ** 2);
      
      if (lastGrenadeVelocity !== null && speed < lastGrenadeVelocity) {
        console.log(`${colors.green}✓ Grenade slowing down: ${speed.toFixed(1)} px/s (was ${lastGrenadeVelocity.toFixed(1)})${colors.reset}`);
      }
      
      lastGrenadeVelocity = speed;
      
      // Show position
      console.log(`  Position: (${projectile.position.x.toFixed(1)}, ${projectile.position.y.toFixed(1)}), Speed: ${speed.toFixed(1)} px/s`);
    }
  });
});

socket.on('projectile:exploded', (data) => {
  console.log(`\n${colors.magenta}💥 EXPLOSION DETECTED!${colors.reset}`);
  console.log(`   Position: (${data.position.x.toFixed(1)}, ${data.position.y.toFixed(1)})`);
  console.log(`   Radius: ${data.radius}`);
  explosionDetected = true;
});

socket.on('game:explosions', (explosions) => {
  if (explosions && explosions.length > 0) {
    console.log(`\n${colors.magenta}💥 EXPLOSIONS EVENT!${colors.reset}`);
    explosions.forEach(exp => {
      console.log(`   Position: (${exp.position.x.toFixed(1)}, ${exp.position.y.toFixed(1)}), Radius: ${exp.radius}`);
    });
    explosionDetected = true;
  }
});

socket.on('error', (error) => {
  console.error(`${colors.red}❌ Socket error:${colors.reset}`, error);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
}); 