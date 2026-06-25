# Tower Defense — Game Jam Project

Co-op tower defense game built with Phaser.js + Colyseus.

## Setup

### Server
```bash
cd server
npm install
npm run dev
```

### Client (in a separate terminal)
```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Open it in two tabs to test multiplayer.

## Team areas
- **Person A** → `server/GameRoom.js` — game logic, enemies, waves, towers
- **Person B** → `client/src/GameScene.js` — rendering, visuals
- **Person C** → `client/src/UIScene.js` — HUD, buttons, menus

## Git workflow (jam day)
1. Pull before you start: `git pull`
2. Work in your file
3. Commit often: `git add . && git commit -m "what I did"`
4. Push when it works: `git push`
5. If there's a conflict, shout — we resolve it together
