const io = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  // Wait for game state then fire weapon
  setTimeout(() => {
    console.log('🔫 Testing weapon fire...');
    
    // Fire at a wall to the right
    socket.emit('weapon:fire', {
      timestamp: Date.now(),
      weaponId: 'rifle',
      position: { x: 240, y: 135 },
      direction: { x: 1, y: 0 },
      mousePosition: { x: 300, y: 135 }
    });
  }, 1000);
});

socket.on('weapon:fired', (data) => {
  console.log('✅ Weapon fired:', data);
});

socket.on('wall:damaged', (data) => {
  console.log('💥 Wall damaged!', {
    wall: data.wallId,
    slice: data.sliceIndex,
    health: data.newHealth,
    destroyed: data.isDestroyed
  });
});

socket.on('projectile:created', (data) => {
  console.log('🚀 Projectile created:', data);
});

setTimeout(() => process.exit(0), 3000); 