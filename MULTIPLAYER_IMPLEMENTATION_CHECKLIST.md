# 🎮 TRESPASSER MULTIPLAYER IMPLEMENTATION CHECKLIST

## Overview
Transform the single-player Trespasser into a password-protected multiplayer game where friends can host and join games via direct IP connection.

## 📋 Backend Implementation (Week 1)

### Day 1-2: Core Infrastructure ✅ COMPLETED
- [x] **Update CORS configuration** to accept connections from any origin
  - Change from localhost-only to wildcard origin
  - Add proper CORS headers for game assets
  
- [x] **Implement basic rate limiting**
  - Track connection attempts per IP
  - Limit to 10 attempts per minute
  - Auto-clear limits every 60 seconds
  
- [x] **Add password authentication system**
  - Read password from environment variable
  - Create authentication handshake flow
  - Track authenticated players
  
- [x] **Update server startup logs**
  - Display all available connection methods (localhost, LAN IPs)
  - Show password status
  - Add instructions for port forwarding

### Day 3: Connection Management ✅ COMPLETED
- [x] **Implement player tracking**
  - Maintain set of authenticated players
  - Handle disconnection cleanup
  - Add player count limits (8 max)
  
- [x] **Create status endpoint**
  - GET / returns server info JSON
  - Include player count, password requirement
  - Used by frontend to check server before connecting

### Day 4: Testing & Documentation ✅ COMPLETED
- [x] **Test LAN connectivity**
  - Verify connections work across local network
  - Test with multiple simultaneous players
  
- [x] **Test password authentication**
  - Verify failed auth disconnects properly
  - Test empty password (no auth) mode
  
- [x] **Create frontend handover document**
  - List all socket events
  - Provide connection flow diagram
  - Include example client code

## 📱 Frontend Implementation (Week 2)

### Day 1: UI Components
- [ ] **Add "Join Game" screen**
  - Server address input field
  - Password input field (shown conditionally)
  - Connect button
  - Back button
  
- [ ] **Add "Host Game" screen**
  - Display server connection info
  - Show current player count
  - Copy IP button
  - Back button

### Day 2: Connection Logic
- [ ] **Implement server connection flow**
  - Connect to provided server address
  - Check if password required via status endpoint
  - Handle authentication if needed
  
- [ ] **Add connection state management**
  - Connecting, Connected, Failed states
  - Show appropriate UI feedback
  - Handle reconnection scenarios

### Day 3: Error Handling
- [ ] **Connection error handling**
  - Timeout errors
  - Invalid address errors
  - Wrong password errors
  - Server full errors
  
- [ ] **User feedback**
  - Loading spinners during connection
  - Clear error messages
  - Retry mechanisms

### Day 4: Polish & Testing
- [ ] **Save recent servers**
  - Store last 5 successful connections
  - Quick connect from history
  
- [ ] **Improve UX**
  - Auto-focus input fields
  - Enter key submits forms
  - Proper tab order

## 🚀 Deployment Checklist

### Backend Deployment
- [ ] Create production .env file
- [ ] Set secure password
- [ ] Configure firewall rules
- [ ] Test port forwarding
- [ ] Create systemd service (Linux) or PM2 config

### Documentation
- [ ] Write player hosting guide
- [ ] Create troubleshooting FAQ
- [ ] Document port forwarding steps for common routers

## 📊 Success Metrics
- [ ] 8 players can connect simultaneously
- [ ] Connection succeeds within 3 seconds
- [ ] Password rejection works correctly
- [ ] No crashes under normal gameplay
- [ ] Clear error messages for all failure cases 