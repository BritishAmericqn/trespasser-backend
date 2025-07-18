# Frontend LAN Connection Fix Required

## Summary
The backend multiplayer server is working correctly and supports LAN play. However, the frontend is hardcoded to connect to `localhost:3000`, preventing LAN connections from working properly.

## The Problem

When accessing the game via LAN:
- Frontend loads from: `http://192.168.1.238:5173`
- Socket.IO connects to: `http://localhost:3000` (WRONG!)
- Result: Cross-origin connection issues prevent game state from being received

### Symptoms
- Player can authenticate and spawn
- Console shows "No walls found!" 
- Backend logs show it's sending 79 walls continuously
- Socket appears connected but events are blocked

## The Solution

The frontend needs to dynamically determine the backend URL based on how it was accessed:

```javascript
// Instead of hardcoding:
const socket = io('http://localhost:3000');

// Use dynamic URL detection:
const getBackendUrl = () => {
  const hostname = window.location.hostname;
  
  // If accessed via localhost/127.0.0.1, use localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }
  
  // Otherwise use the same hostname the frontend was loaded from
  return `http://${hostname}:3000`;
};

const socket = io(getBackendUrl());
```

## Alternative Solutions

### Option 1: Environment Variable (Recommended)
```javascript
// Use Vite env variable
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const socket = io(BACKEND_URL);
```

Then users can run:
```bash
# For LAN play
VITE_BACKEND_URL=http://192.168.1.238:3000 npm run dev -- --host
```

### Option 2: Relative URL (Simplest)
If the backend can be proxied through Vite:
```javascript
// This assumes backend is proxied through same origin
const socket = io();
```

## Testing LAN Connection

1. Start backend: `npm start` (runs on port 3000)
2. Start frontend with host flag: `npm run dev -- --host`
3. Access via LAN IP: `http://192.168.1.238:5173`
4. Verify Socket.IO connects to `192.168.1.238:3000` (not localhost)

## Backend Status

✅ **The backend is fully ready for LAN play:**
- CORS configured to accept any origin
- Password protection working
- Map loading correctly (79 walls from yourmap2.png)
- Rate limiting active
- Broadcasting game state properly

## What Frontend Needs to Check

1. **Socket.IO Connection URL**: Find where the Socket.IO client is initialized
2. **Environment Configuration**: Check if there's already an env system in place
3. **Build Process**: Ensure the solution works in both dev and production builds

## Example Implementation

```typescript
// services/socket.ts or similar
import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  
  connect(password?: string) {
    const backendUrl = this.getBackendUrl();
    console.log(`Connecting to backend at: ${backendUrl}`);
    
    this.socket = io(backendUrl, {
      auth: {
        password: password || ''
      }
    });
    
    return this.socket;
  }
  
  private getBackendUrl(): string {
    const hostname = window.location.hostname;
    
    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    
    // LAN or external access - use same hostname as frontend
    return `http://${hostname}:3000`;
  }
}
```

## Verification

Once implemented, you should see in the browser console:
```
Connecting to backend at: http://192.168.1.238:3000
```

And the game should load with all 79 walls visible when connecting via LAN. 