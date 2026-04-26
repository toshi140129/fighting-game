import * as Phaser from "phaser";

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 450;
export const GROUND_Y = 360;

export type StageId = "STREET" | "DOJO" | "ROOFTOP";

export const buildGameConfig = (
  parent: HTMLElement,
  scenes: Phaser.Types.Scenes.SceneType[]
): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#000",
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 600 },
      debug: false,
    },
  },
  fps: {
    target: 60,
    forceSetTimeOut: true,
  },
  scene: scenes,
});

export const COLORS = {
  player1Body: 0x4a90e2,
  player1Accent: 0x73b8ff,
  player2Body: 0xe24a4a,
  player2Accent: 0xff8080,
  ground: 0x2a1a3a,
  hpGood: 0x00ff66,
  hpMid: 0xffd233,
  hpBad: 0xff3344,
  hitSpark: 0xffe600,
  hitSparkRed: 0xff4400,
  jackpot: 0xffd700,
  hit: 0xff8800,
  miss: 0x888888,
  backfire: 0xff0033,
};
