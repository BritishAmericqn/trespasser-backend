# Frontend Quick Fix for LAN Play

## The Issue
Frontend is hardcoded to `localhost:3000`. When accessed via LAN IP, it still connects to localhost instead of the LAN IP.

## The Fix
Find where Socket.IO connects (probably something like):
```javascript
const socket = io('http://localhost:3000');
```

Replace with:
```javascript
const socket = io(`http://${window.location.hostname}:3000`);
```

## That's it!
This will make the frontend connect to:
- `localhost:3000` when accessed via localhost
- `192.168.1.238:3000` when accessed via LAN IP
- Any other hostname:3000 when accessed externally

## Test It
1. Backend: `npm start`
2. Frontend: `npm run dev -- --host`
3. Open: `http://192.168.1.238:5173`
4. Should see 79 walls load properly!

## Note
The backend is already configured and working. It's sending the game data correctly. This frontend URL fix is all that's needed. 