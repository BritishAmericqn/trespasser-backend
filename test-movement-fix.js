const io = require('socket.io-client');

console.log('🔍 Testing Movement Processing');
console.log('================================\n');

const socket = io('http://localhost:3000', {
  transports: ['websocket']
});

let playerPosition = null;
let positionHistory = [];

socket.on('connect', () => {
  console.log('✅ Connected to backend\n');
  console.log('🎮 Creating private lobby...\n');
  
  socket.emit('create_private_lobby', { gameMode: 'deathmatch' });
});

socket.on('lobby_joined', (data) => {
  console.log('🏠 Lobby joined:', data.lobbyId);
  console.log('📤 Sending player:join...\n');
  
  socket.emit('player:join', {
    loadout: {
      primary: 'rifle',
      secondary: 'pistol',
      support: ['grenade'],
      team: 'blue'
    },
    timestamp: Date.now()
  });
  
  // Start sending movement input after a short delay
  setTimeout(() => {
    console.log('🎮 Starting movement test - sending input to move RIGHT\n');
    
    let inputCount = 0;
    const inputInterval = setInterval(() => {
      inputCount++;
      
      // Send movement input to move right
      socket.emit('player:input', {
        movement: { x: 1, y: 0 },  // Move right
        mouse: { x: 250, y: 150 },
        keys: { 
          w: false, 
          a: false, 
          s: false, 
          d: true,  // D key pressed (move right)
          shift: false,
          ctrl: false
        },
        sequence: inputCount,
        timestamp: Date.now()
      });
      
      if (inputCount % 20 === 0) {
        console.log(`📤 Sent ${inputCount} movement inputs`);
      }
      
      if (inputCount >= 100) {
        clearInterval(inputInterval);
        console.log('\n⏹️ Stopped sending input after 100 messages');
        
        // Analyze position history
        setTimeout(() => {
          console.log('\n📊 POSITION ANALYSIS:');
          console.log('====================');
          
          if (positionHistory.length > 0) {
            const firstPos = positionHistory[0];
            const lastPos = positionHistory[positionHistory.length - 1];
            
            console.log(`Start Position: (${firstPos.x.toFixed(2)}, ${firstPos.y.toFixed(2)})`);
            console.log(`End Position: (${lastPos.x.toFixed(2)}, ${lastPos.y.toFixed(2)})`);
            console.log(`X Movement: ${(lastPos.x - firstPos.x).toFixed(2)}`);
            console.log(`Y Movement: ${(lastPos.y - firstPos.y).toFixed(2)}`);
            
            if (Math.abs(lastPos.x - firstPos.x) < 1) {
              console.log('\n❌ PLAYER DID NOT MOVE! Movement system is BROKEN!');
            } else {
              console.log('\n✅ Player moved successfully!');
            }
          } else {
            console.log('❌ No position data received!');
          }
          
          process.exit(0);
        }, 1000);
      }
    }, 50); // Send input every 50ms (20Hz)
  }, 1000);
});

socket.on('game:state', (state) => {
  // Find our player in the state
  const players = Object.values(state.players || {});
  if (players.length > 0) {
    const player = players[0];
    const newPos = player.transform ? player.transform.position : player.position;
    
    if (newPos) {
      if (!playerPosition) {
        playerPosition = { ...newPos };
        positionHistory.push({ ...newPos });
        console.log(`📍 Initial Position: (${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)})`);
      } else if (newPos.x !== playerPosition.x || newPos.y !== playerPosition.y) {
        const deltaX = newPos.x - playerPosition.x;
        const deltaY = newPos.y - playerPosition.y;
        console.log(`🏃 POSITION CHANGED! Delta: (${deltaX.toFixed(2)}, ${deltaY.toFixed(2)}) → New: (${newPos.x.toFixed(2)}, ${newPos.y.toFixed(2)})`);
        playerPosition = { ...newPos };
        positionHistory.push({ ...newPos });
      }
    }
  }
});

socket.on('disconnect', (reason) => {
  console.log('\n❌ Disconnected:', reason);
  process.exit(1);
});

// Auto-exit after 10 seconds
setTimeout(() => {
  console.log('\n⏰ Test timeout after 10 seconds');
  process.exit(0);
}, 10000);
