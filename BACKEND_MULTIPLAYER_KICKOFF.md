# 🚀 BACKEND MULTIPLAYER IMPLEMENTATION KICKOFF

## Context
You are implementing a minimal multiplayer system for Trespasser, a 2D destructible environment shooter. The goal is to enable friends to play together by hosting their own servers and connecting via IP address with optional password protection.

## Current State
- ✅ Single-player game mechanics work perfectly
- ✅ Server runs locally on port 3000
- ✅ All game systems (physics, weapons, destruction) are functional
- ❌ CORS locked to localhost only
- ❌ No password protection
- ❌ No rate limiting
- ❌ No connection management beyond basic Socket.io

## Your Mission
Transform the existing single-player server into a secure multiplayer server that friends can host and join. Keep it simple - one server instance = one game room. No lobbies, no matchmaking, just direct IP connections.

## Technical Requirements

### 1. Core Features (Must Have)
- **Open CORS** to accept connections from any origin
- **Password protection** via environment variable (optional - empty = no password)
- **Basic rate limiting** (10 connection attempts per minute per IP)
- **Player limit** (8 maximum concurrent players)
- **Connection status endpoint** (GET / returns JSON with server info)
- **Clear server logs** showing all connection methods (localhost, LAN IPs, instructions)

### 2. Security Measures
- Rate limit individual socket events (especially player:input)
- Track authenticated players separately
- Add 5-second timeout for authentication
- Remove debug endpoints in production
- Graceful handling of port conflicts

### 3. Implementation Constraints
- Keep the single "default" room approach - it's perfect for this use case
- Minimize changes to existing game logic
- No database or persistent storage needed
- No user accounts or profiles
- No SSL/HTTPS required (friends trust each other)

## Implementation Steps

### Step 1: Update src/index.ts
Replace the current basic server with one that:
1. Accepts connections from anywhere (CORS wildcard)
2. Implements password authentication flow
3. Adds rate limiting per IP
4. Shows helpful connection info on startup
5. Provides status endpoint

### Step 2: Security Hardening
1. Add authentication timeout
2. Track authenticated players
3. Limit events from unauthenticated sockets
4. Add per-event rate limiting

### Step 3: Testing & Polish
1. Test with actual LAN connections
2. Verify password protection works
3. Ensure graceful handling of edge cases
4. Create clear error messages

## Code Architecture

### Key Components Needed:
```typescript
// Rate limiting
const connectionAttempts = new Map<string, number>();

// Authentication tracking  
const authenticatedPlayers = new Set<string>();

// Environment config
const GAME_PASSWORD = process.env.GAME_PASSWORD || '';
const PORT = process.env.PORT || 3000;
```

### Socket Event Flow:
1. Client connects → Rate limit check
2. If password required → Wait for 'authenticate' event
3. On successful auth → Add to game room
4. On disconnect → Clean up player data

## Success Criteria
- [ ] Friends can connect via LAN IP
- [ ] Friends can connect via internet (with port forwarding)
- [ ] Password protection works when enabled
- [ ] Server doesn't crash under normal use
- [ ] Clear feedback for all error cases
- [ ] Connection succeeds in < 3 seconds

## Deliverables
1. Updated `src/index.ts` with multiplayer support
2. `.env.example` file with configuration options
3. Frontend handover document with:
   - All socket events and their payloads
   - Connection flow diagram
   - Example client code
   - Error codes and meanings

## Non-Goals (Don't Implement)
- Multiple rooms or lobbies
- Matchmaking
- User profiles or persistence  
- Voice/text chat
- Spectator mode
- Reconnection support
- Server browser

## Time Estimate
- Core implementation: 4-6 hours
- Testing & refinement: 2-3 hours
- Documentation: 1-2 hours
- **Total: 1-2 days**

## First Task
Start by fixing the EADDRINUSE error, then update the CORS configuration to accept external connections. Once you can connect from another machine on your LAN, proceed with password protection and rate limiting.

Remember: Keep it simple! This is for friends to play together, not a public game server. Focus on making it work reliably rather than handling every edge case. 