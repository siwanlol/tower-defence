import Phaser from "phaser";
import { GameScene } from "./GameScene.js";
import { UIScene } from "./UIScene.js";

const config = {
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  backgroundColor: "#1a1a2e",
  scene: [GameScene, UIScene],
};

new Phaser.Game(config);
