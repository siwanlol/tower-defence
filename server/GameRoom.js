const { Room } = require("colyseus");
const { Schema, MapSchema, ArraySchema, type } = require("@colyseus/schema");

// --- Schema definitions (shared state synced to all clients) ---

class Enemy extends Schema {}
type("number")(Enemy.prototype, "x");
type("number")(Enemy.prototype, "y");
type("number")(Enemy.prototype, "hp");
type("number")(Enemy.prototype, "maxHp");
type("number")(Enemy.prototype, "waypointIndex");
type("boolean")(Enemy.prototype, "alive");

class Tower extends Schema {}
type("number")(Tower.prototype, "x");
type("number")(Tower.prototype, "y");
type("string")(Tower.prototype, "ownerId");

class GameState extends Schema {}
type({ map: Enemy })(GameState.prototype, "enemies");
type({ map: Tower })(GameState.prototype, "towers");
type("number")(GameState.prototype, "gold");
type("number")(GameState.prototype, "wave");
type("number")(GameState.prototype, "lives");
type("boolean")(GameState.prototype, "gameOver");

// --- Waypoints: the path enemies follow (pixel coords matching the client canvas) ---
const WAYPOINTS = [
  { x: 0,   y: 300 },
  { x: 200, y: 300 },
  { x: 200, y: 100 },
  { x: 500, y: 100 },
  { x: 500, y: 450 },
  { x: 800, y: 450 },
];

const ENEMY_SPEED = 80;       // pixels per second
const TICK_RATE = 20;         // server ticks per second
const TICK_MS = 1000 / TICK_RATE;
const TOWER_COST = 50;
const TOWER_RANGE = 120;
const TOWER_DAMAGE = 10;
const TOWER_FIRE_RATE = 1000; // ms between shots
const START_GOLD = 200;
const START_LIVES = 20;

class GameRoom extends Room {
  onCreate(options) {
    this.setState(new GameState());
    this.state.enemies = new MapSchema();
    this.state.towers = new MapSchema();
    this.state.gold = START_GOLD;
    this.state.wave = 0;
    this.state.lives = START_LIVES;
    this.state.gameOver = false;

    this._enemyCounter = 0;
    this._towerCooldowns = {};   // towerId -> last fire timestamp
    this._waveActive = false;
    this._enemiesThisWave = 0;
    this._enemiesSpawned = 0;
    this._spawnTimer = 0;

    this.setSimulationInterval((dt) => this._tick(dt), TICK_MS);

    this.onMessage("place_tower", (client, data) => {
      this._placeTower(client, data.x, data.y);
    });

    this.onMessage("start_wave", (client) => {
      this._startWave();
    });

    console.log("GameRoom created");
  }

  onJoin(client, options) {
    console.log(`${client.sessionId} joined`);
  }

  onLeave(client) {
    console.log(`${client.sessionId} left`);
  }

  // --- Wave management ---
  _startWave() {
    if (this._waveActive || this.state.gameOver) return;
    this.state.wave += 1;
    this._waveActive = true;
    this._enemiesThisWave = 5 + (this.state.wave - 1) * 3;
    this._enemiesSpawned = 0;
    this._spawnTimer = 0;
    console.log(`Wave ${this.state.wave} started — ${this._enemiesThisWave} enemies`);
  }

  // --- Main game tick ---
  _tick(dt) {
    if (this.state.gameOver) return;

    // Spawn enemies
    if (this._waveActive && this._enemiesSpawned < this._enemiesThisWave) {
      this._spawnTimer += dt;
      if (this._spawnTimer >= 1500) {
        this._spawnTimer = 0;
        this._spawnEnemy();
      }
    }

    // Move enemies
    this.state.enemies.forEach((enemy, id) => {
      if (!enemy.alive) return;
      this._moveEnemy(enemy, id, dt / 1000);
    });

    // Towers shoot
    const now = Date.now();
    this.state.towers.forEach((tower, towerId) => {
      const lastFire = this._towerCooldowns[towerId] || 0;
      if (now - lastFire < TOWER_FIRE_RATE) return;

      const target = this._findTarget(tower);
      if (target) {
        this._towerCooldowns[towerId] = now;
        target.hp -= TOWER_DAMAGE;
        if (target.hp <= 0) {
          target.alive = false;
          this.state.gold += 25;
        }
      }
    });

    // Remove dead enemies
    const toRemove = [];
    this.state.enemies.forEach((enemy, id) => {
      if (!enemy.alive) toRemove.push(id);
    });
    toRemove.forEach(id => this.state.enemies.delete(id));

    // Check wave complete
    if (
      this._waveActive &&
      this._enemiesSpawned >= this._enemiesThisWave &&
      this.state.enemies.size === 0
    ) {
      this._waveActive = false;
      this.state.gold += 50; // wave clear bonus
      console.log(`Wave ${this.state.wave} complete`);
    }
  }

  _spawnEnemy() {
    const id = `e${this._enemyCounter++}`;
    const enemy = new Enemy();
    enemy.x = WAYPOINTS[0].x;
    enemy.y = WAYPOINTS[0].y;
    enemy.maxHp = 50 + (this.state.wave - 1) * 20;
    enemy.hp = enemy.maxHp;
    enemy.waypointIndex = 1;
    enemy.alive = true;
    this.state.enemies.set(id, enemy);
    this._enemiesSpawned++;
  }

  _moveEnemy(enemy, id, dtSec) {
    if (enemy.waypointIndex >= WAYPOINTS.length) {
      // Reached the end — deal damage
      enemy.alive = false;
      this.state.lives = Math.max(0, this.state.lives - 1);
      if (this.state.lives <= 0) {
        this.state.gameOver = true;
        console.log("Game over!");
      }
      return;
    }

    const target = WAYPOINTS[enemy.waypointIndex];
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = ENEMY_SPEED * dtSec;

    if (dist <= step) {
      enemy.x = target.x;
      enemy.y = target.y;
      enemy.waypointIndex++;
    } else {
      enemy.x += (dx / dist) * step;
      enemy.y += (dy / dist) * step;
    }
  }

  _findTarget(tower) {
    let closest = null;
    let closestDist = TOWER_RANGE;
    this.state.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      const dx = enemy.x - tower.x;
      const dy = enemy.y - tower.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = enemy;
      }
    });
    return closest;
  }

  _placeTower(client, x, y) {
    if (this.state.gold < TOWER_COST) return;
    const id = `t${client.sessionId}_${Date.now()}`;
    const tower = new Tower();
    tower.x = x;
    tower.y = y;
    tower.ownerId = client.sessionId;
    this.state.towers.set(id, tower);
    this.state.gold -= TOWER_COST;
    console.log(`Tower placed at (${x}, ${y}) by ${client.sessionId}`);
  }
}

module.exports = { GameRoom };
