#!/usr/bin/env node

/**
 * Simple test to verify server connection and debug handlers
 */

const io = require('socket.io-client');

async function testSimpleConnection() {
  console.log('🧪 Testing Simple Server Connection...\n');
  
  const client = io('http://localhost:3000');
  
  return new Promise((resolve, reject) => {
    let connected = false;
    
    client.on('connect', () => {
      console.log('✅ Connected to server');
      connected = true;
      
      // Test debug handlers immediately (don't join lobby first)
      console.log('\n📝 Testing debug handlers directly...');
      
      // Listen for debug responses
      client.on('debug:match_end_triggered', (data) => {
        console.log('✅ debug:match_end_triggered received:', data);
      });
      
      client.on('debug:match_end_failed', (data) => {
        console.log('✅ debug:match_end_failed received:', data);
      });
      
      client.on('debug:match_state', (data) => {
        console.log('✅ debug:match_state received:', data);
      });
      
      // Send debug commands
      setTimeout(() => {
        console.log('📤 Sending debug:request_match_state...');
        client.emit('debug:request_match_state');
      }, 1000);
      
      setTimeout(() => {
        console.log('📤 Sending debug:trigger_match_end...');
        client.emit('debug:trigger_match_end', { reason: 'Simple test' });
      }, 2000);
      
      // Give time for responses
      setTimeout(() => {
        console.log('\n🏁 Test completed');
        client.disconnect();
        resolve();
      }, 5000);
    });
    
    client.on('connect_error', (error) => {
      console.error('❌ Connection failed:', error.message);
      reject(error);
    });
    
    client.on('disconnect', (reason) => {
      if (connected) {
        console.log('👋 Disconnected from server:', reason);
      }
    });
    
    // Timeout
    setTimeout(() => {
      if (!connected) {
        console.error('❌ Connection timeout');
        client.disconnect();
        reject(new Error('Connection timeout'));
      }
    }, 10000);
  });
}

// Run the test
if (require.main === module) {
  testSimpleConnection()
    .then(() => {
      console.log('\n✅ Simple connection test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testSimpleConnection };

