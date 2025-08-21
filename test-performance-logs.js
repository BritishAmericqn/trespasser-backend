// Quick test to verify console logs are removed
const io = require('socket.io-client');

console.log('🧪 Performance Test - Checking for console log spam...\n');

const socket = io('http://localhost:5173', {
  transports: ['websocket']
});

let startTime;
let inputCount = 0;
let fireCount = 0;

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  // Create a test lobby
  socket.emit('lobby:create', {
    name: 'Performance Test',
    maxPlayers: 2,
    isPublic: false
  });
});

socket.on('lobby:created', (lobby) => {
  console.log('✅ Lobby created');
  
  // Join the game
  socket.emit('player:join', {
    loadout: {
      primary: 'rifle',
      secondary: 'pistol',
      equipment: ['grenade', 'grenade']
    },
    playerName: 'PerfTest'
  });
});

socket.on('player:join:success', () => {
  console.log('✅ Joined game');
  console.log('\n📊 Starting performance test...');
  console.log('Sending 60 inputs/sec and 10 weapon fires/sec for 5 seconds...\n');
  
  startTime = Date.now();
  
  // Simulate 60Hz input (movement)
  const inputInterval = setInterval(() => {
    inputCount++;
    socket.emit('player:input', {
      keys: {
        w: true,
        a: Math.random() > 0.5,
        s: false,
        d: Math.random() > 0.5,
        shift: false,
        ctrl: false
      },
      mouse: {
        x: Math.random() * 1920,
        y: Math.random() * 1080,
        buttons: 0,
        leftPressed: false,
        rightPressed: false
      },
      sequence: inputCount,
      timestamp: Date.now()
    });
  }, 1000 / 60); // 60Hz
  
  // Simulate weapon firing at 10Hz (rifle rate)
  const fireInterval = setInterval(() => {
    fireCount++;
    socket.emit('weapon:fire', {
      weaponType: 'rifle',
      position: { x: 100, y: 100 },
      direction: Math.random() * Math.PI * 2,
      timestamp: Date.now(),
      sequence: fireCount
    });
  }, 1000 / 10); // 10Hz
  
  // Stop after 5 seconds and show results
  setTimeout(() => {
    clearInterval(inputInterval);
    clearInterval(fireInterval);
    
    const elapsed = (Date.now() - startTime) / 1000;
    
    console.log('\n📊 PERFORMANCE TEST RESULTS:');
    console.log('================================');
    console.log(`Duration: ${elapsed.toFixed(1)} seconds`);
    console.log(`Inputs sent: ${inputCount} (${(inputCount/elapsed).toFixed(0)}/sec)`);
    console.log(`Weapon fires sent: ${fireCount} (${(fireCount/elapsed).toFixed(0)}/sec)`);
    console.log('\n✅ CHECK YOUR SERVER CONSOLE:');
    console.log('- Should see MINIMAL output during test');
    console.log('- No weapon debug logs');
    console.log('- No input processing logs');
    console.log('- No combat logs');
    console.log('\nIf you see spam, logs weren\'t properly removed!');
    
    process.exit(0);
  }, 5000);
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
  process.exit(1);
});
