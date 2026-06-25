import Phaser from "phaser";

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: "UIScene", active: true });
    this.room = null;
    this.goldText = null;
    this.waveText = null;
    this.livesText = null;
    this.statusText = null;
  }

  create() {
    const bg = this.add.rectangle(0, 0, 800, 40, 0x0d0d1a, 0.9).setOrigin(0, 0);

    this.goldText  = this.add.text(10,  10, "Gold: --",  { fontSize: "16px", fill: "#f1c40f" });
    this.waveText  = this.add.text(200, 10, "Wave: --",  { fontSize: "16px", fill: "#ecf0f1" });
    this.livesText = this.add.text(350, 10, "Lives: --", { fontSize: "16px", fill: "#e74c3c" });
    this.statusText = this.add.text(400, 300, "Connecting to server...", {
      fontSize: "20px", fill: "#ecf0f1"
    }).setOrigin(0.5).setDepth(10);

    // Place Tower button
    const btn = this.add.rectangle(650, 20, 130, 30, 0x3498db).setInteractive({ useHandCursor: true });
    const btnText = this.add.text(650, 20, "Place Tower (50g)", {
      fontSize: "12px", fill: "#fff"
    }).setOrigin(0.5);

    btn.on("pointerover", () => btn.setFillStyle(0x2980b9));
    btn.on("pointerout",  () => btn.setFillStyle(0x3498db));
    btn.on("pointerdown", () => this.game.events.emit("place_tower_mode"));

    // Start Wave button
    const waveBtn = this.add.rectangle(650, 570, 130, 30, 0x27ae60).setInteractive({ useHandCursor: true });
    const waveBtnText = this.add.text(650, 570, "Start Wave", {
      fontSize: "14px", fill: "#fff"
    }).setOrigin(0.5);

    waveBtn.on("pointerover", () => waveBtn.setFillStyle(0x229954));
    waveBtn.on("pointerout",  () => waveBtn.setFillStyle(0x27ae60));
    waveBtn.on("pointerdown", () => {
      if (this.room) this.room.send("start_wave");
    });

    // Receive room reference from GameScene
    this.game.events.on("room_joined", (room) => {
      this.room = room;
      this.statusText.setVisible(false);

      room.state.listen("gold",  (val) => this.goldText.setText(`Gold: ${val}`));
      room.state.listen("wave",  (val) => this.waveText.setText(`Wave: ${val}`));
      room.state.listen("lives", (val) => this.livesText.setText(`Lives: ${val}`));
      room.state.listen("gameOver", (val) => {
        if (val) {
          this.add.rectangle(400, 300, 400, 100, 0x000000, 0.8).setDepth(20);
          this.add.text(400, 300, "GAME OVER", {
            fontSize: "48px", fill: "#e74c3c"
          }).setOrigin(0.5).setDepth(21);
        }
      });
    });
  }
}
