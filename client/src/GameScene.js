import Phaser from "phaser";
import * as Colyseus from "colyseus.js";

// Must match the waypoints in GameRoom.js
const WAYPOINTS = [
  { x: 0,   y: 300 },
  { x: 200, y: 300 },
  { x: 200, y: 100 },
  { x: 500, y: 100 },
  { x: 500, y: 450 },
  { x: 800, y: 450 },
];

const TOWER_COST = 50;
const TOWER_RANGE = 120;
const SERVER_URL = "ws://localhost:2567";

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
    this.room = null;
    this.enemySprites = {};
    this.towerSprites = {};
    this.placingTower = false;
  }

  preload() {}

  create() {
    this._drawPath();
    this._setupInput();
    this._connectToServer();

    // Listen for UI scene telling us to enter tower-placement mode
    this.game.events.on("place_tower_mode", () => {
      this.placingTower = true;
      this.input.setDefaultCursor("crosshair");
    });
  }

  update() {
    if (!this.room) return;

    // Sync enemy sprites with server state
    const serverEnemyIds = new Set();
    this.room.state.enemies.forEach((enemy, id) => {
      serverEnemyIds.add(id);
      if (!this.enemySprites[id]) {
        this._createEnemySprite(id, enemy);
      }
      const sprite = this.enemySprites[id];
      sprite.body_rect.setPosition(enemy.x, enemy.y);
      sprite.hp_bar_bg.setPosition(enemy.x, enemy.y - 20);
      sprite.hp_bar.setPosition(enemy.x - 15, enemy.y - 20);
      const hpPct = enemy.hp / enemy.maxHp;
      sprite.hp_bar.setScale(hpPct, 1);
    });

    // Remove sprites for enemies no longer on server
    for (const id in this.enemySprites) {
      if (!serverEnemyIds.has(id)) {
        this.enemySprites[id].body_rect.destroy();
        this.enemySprites[id].hp_bar_bg.destroy();
        this.enemySprites[id].hp_bar.destroy();
        delete this.enemySprites[id];
      }
    }

    // Sync tower sprites
    const serverTowerIds = new Set();
    this.room.state.towers.forEach((tower, id) => {
      serverTowerIds.add(id);
      if (!this.towerSprites[id]) {
        this._createTowerSprite(id, tower);
      }
    });
    for (const id in this.towerSprites) {
      if (!serverTowerIds.has(id)) {
        this.towerSprites[id].destroy();
        delete this.towerSprites[id];
      }
    }
  }

  _drawPath() {
    const gfx = this.add.graphics();
    gfx.lineStyle(40, 0x4a4a6a, 1);
    gfx.beginPath();
    gfx.moveTo(WAYPOINTS[0].x, WAYPOINTS[0].y);
    for (let i = 1; i < WAYPOINTS.length; i++) {
      gfx.lineTo(WAYPOINTS[i].x, WAYPOINTS[i].y);
    }
    gfx.strokePath();

    // Draw waypoint dots for clarity
    gfx.fillStyle(0x6a6a9a, 1);
    WAYPOINTS.forEach(wp => gfx.fillCircle(wp.x, wp.y, 8));
  }

  _createEnemySprite(id, enemy) {
    const rect = this.add.rectangle(enemy.x, enemy.y, 24, 24, 0xe74c3c);
    const bg = this.add.rectangle(enemy.x, enemy.y - 20, 30, 6, 0x333333);
    const bar = this.add.rectangle(enemy.x - 15, enemy.y - 20, 30, 6, 0x2ecc71);
    bar.setOrigin(0, 0.5);
    this.enemySprites[id] = { body_rect: rect, hp_bar_bg: bg, hp_bar: bar };
  }

  _createTowerSprite(id, tower) {
    const gfx = this.add.graphics();
    // Range circle
    gfx.lineStyle(1, 0x3498db, 0.3);
    gfx.strokeCircle(tower.x, tower.y, TOWER_RANGE);
    // Tower body
    gfx.fillStyle(0x3498db, 1);
    gfx.fillRect(tower.x - 14, tower.y - 14, 28, 28);
    // Barrel
    gfx.fillStyle(0x1a6ea8, 1);
    gfx.fillRect(tower.x - 4, tower.y - 24, 8, 14);
    this.towerSprites[id] = gfx;
  }

  _setupInput() {
    this.input.on("pointerdown", (pointer) => {
      if (!this.placingTower || !this.room) return;
      this.room.send("place_tower", { x: Math.round(pointer.x), y: Math.round(pointer.y) });
      this.placingTower = false;
      this.input.setDefaultCursor("default");
    });
  }

  async _connectToServer() {
    try {
      const client = new Colyseus.Client(SERVER_URL);
      this.room = await client.joinOrCreate("game");
      console.log("Joined room:", this.room.sessionId);

      // Let the UIScene know we're connected
      this.game.events.emit("room_joined", this.room);
    } catch (e) {
      console.error("Could not connect to server:", e);
    }
  }
}
