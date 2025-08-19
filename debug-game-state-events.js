#!/usr/bin/env node

/**
 * Debug Game State Events
 * 
 * Simple test to see what events the server is actually sending
 */

const io = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

function log(message) {
  console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
}

async function debugGameStateEvents() {
  log('🔍 Debugging Game State Events');
  log(`📡 Connecting to: ${SERVER_URL}`);

  const client = io(SERVER_URL, {
    transports: ['websocket'],
    timeout: 5000
  });

  client.on('connect', () => {
    log('✅ Connected to server');
    log(`📋 Client ID: ${client.id}`);
    
    // Listen for ANY event from the server
    client.onAny((eventName, ...args) => {
      log(`📥 Received event: "${eventName}"`);
      if (eventName === 'game:state' || eventName === 'GAME_STATE') {
        log(`🎮 Game state received:`, JSON.stringify(args[0], null, 2));
      } else {
        log(`📦 Event data:`, args);
      }
    });

    // Send player join
    log('📤 Sending player:join event');
    client.emit('player:join', {
      loadout: {
        primary: 'rifle',
        secondary: 'pistol',
        support: ['grenade'],
        team: 'red'
      },
      timestamp: Date.now()
    });

    // Request game state explicitly
    setTimeout(() => {
      log('📤 Requesting game state explicitly');
      client.emit('request_game_state');
    }, 1000);

    // Disconnect after 5 seconds
    setTimeout(() => {
      log('👋 Disconnecting');
      client.disconnect();
      process.exit(0);
    }, 5000);
  });

  client.on('connect_error', (error) => {
    log(`❌ Connection error: ${error.message}`);
    process.exit(1);
  });

  client.on('disconnect', () => {
    log('👋 Disconnected from server');
  });
}

debugGameStateEvents();
