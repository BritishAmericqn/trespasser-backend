# 🎮 TRESPASSER - Destructible 2D Multiplayer Shooter

> A tactical top-down shooter where destruction shapes the battlefield. Peek through bullet holes, blast through walls, and outmaneuver opponents in intense 1v1 to 4v4 matches.

![Game Preview](docs/preview.gif)

## 🚀 QUICK START (5 Minutes)

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/trespasser.git
cd trespasser

# 2. Install everything
npm install
cd server && npm install && cd ..

# 3. Create .env file
cp .env.example .env

# 4. Run the game!
npm run dev:all

# 🎮 Game is now running at http://localhost:5173
```

## 📋 First Day Checklist

- [ ] Run the game (see Quick Start above)
- [ ] Move player with WASD
- [ ] Test multiplayer in two browser tabs
- [ ] Read `docs/AI_OPTIMIZED_DEVELOPMENT_PLAN.md`
- [ ] Start with Day 1 tasks in `QUICK_START_GUIDE.md`

## 🛠️ Development Commands

```bash
# Development (both client and server)
npm run dev:all

# Client only
npm run dev

# Server only
npm run server:dev

# Production build
npm run build
npm run server:build

# Run tests
npm test

# Type checking
npm run type-check
```

## 📁 Project Structure

```
trespasser/
├── src/                # Client code
│   ├── client/        # Game systems
│   ├── assets/        # Sprites, sounds
│   └── main.ts        # Entry point
├── server/            # Server code
│   └── src/           # Server systems
├── shared/            # Shared types/constants
├── docs/              # All documentation
└── public/            # Static files
```

## 🎯 Core Features

- **Destructible Environments**: Walls break in 5 vertical slices
- **Vision System**: See through bullet holes, dynamic fog of war
- **3 Movement Speeds**: Sneak (Ctrl), Walk, Run (Shift)
- **Multiplayer**: Real-time 1v1 to 4v4 matches
- **Spatial Audio**: Sounds muffle through walls
- **Pixel Art**: Crisp 480x270 resolution

## 📚 Documentation

**Start Here:**
1. `docs/QUICK_START_GUIDE.md` - Get coding in 15 minutes
2. `docs/AI_OPTIMIZED_DEVELOPMENT_PLAN.md` - Complete development plan
3. `docs/DESTRUCTION_VISION_IMPLEMENTATION.md` - Core mechanics

**Deep Dives:**
- `docs/COMPLETE_PROJECT_STRUCTURE.md` - File organization
- `docs/SPATIAL_AUDIO_SYSTEM.md` - 3D sound implementation
- `docs/PHYSICS_ARCHITECTURE.md` - Server physics
- `docs/ERROR_HANDLING_BEST_PRACTICES.md` - Robust error handling

## 🤖 AI Development Tips

### Perfect Prompts for Each Feature:

**Movement System:**
```
"Implement the InputSystem using the IGameSystem interface from shared/interfaces/IGameSystem.ts. 
Capture WASD movement with 3 speeds: Ctrl=sneak (50%), normal (100%), Shift=run (150%, forward only).
Use Phaser 3 keyboard API and emit input events to NetworkSystem."
```

**Destruction System:**
```
"Create DestructionSystem that tracks wall health in 5 vertical slices per tile.
Each slice has 100 HP. Update sprite to show: intact (100%), cracked (50-99%), 
holes (1-49%), destroyed (0%). Sync with server using 'wallDamage' events."
```

**Vision System:**
```
"Implement VisionSystem with ray-casting at 480x270 resolution. Cast rays every 2 degrees
from player. Detect walls and holes. Small holes (1 slice) give 15° FOV, large holes
(2+ slices) give proportional vision. Update fog of war texture."
```

## 🎮 Controls

- **WASD**: Movement
- **Shift**: Run (forward only, loud)
- **Ctrl**: Sneak (slow, quiet)
- **Mouse**: Aim & extended vision
- **Left Click**: Fire weapon
- **R**: Reload
- **Tab**: Scoreboard
- **Esc**: Menu

## 🔧 Tech Stack

- **Frontend**: Phaser 3.80.1, TypeScript, Vite
- **Backend**: Node.js, Socket.io, Matter.js
- **Networking**: WebSockets with msgpack compression
- **Build**: Vite + TypeScript
- **Testing**: Vitest + Jest

## 📊 Performance Targets

- **FPS**: 60+ (120+ achievable)
- **Network**: <10 KB/s per player
- **Latency**: <100ms response time
- **Memory**: <100MB client RAM

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Phaser 3](https://phaser.io/)
- Networking by [Socket.io](https://socket.io/)
- Physics by [Matter.js](https://brm.io/matter-js/)

---

**Ready to build?** Start with `npm run dev:all` and begin coding! 🚀
