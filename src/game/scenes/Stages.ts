import * as Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, GROUND_Y, type StageId } from "../config/gameConfig";

export const buildStage = (scene: Phaser.Scene, id: StageId) => {
  const layer = scene.add.container(0, 0);
  layer.setDepth(-10);

  if (id === "STREET") {
    // 夜空グラデ
    const sky = scene.add.graphics();
    sky.fillGradientStyle(0x0a0820, 0x150b30, 0x2a0a55, 0x12061f, 1);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    layer.add(sky);

    // ネオン窓
    for (let i = 0; i < 28; i++) {
      const x = Phaser.Math.Between(0, GAME_WIDTH);
      const y = Phaser.Math.Between(60, 280);
      const c = Phaser.Utils.Array.GetRandom([0xff44ff, 0x44ffff, 0xffe566, 0xff8866]);
      const w = scene.add.rectangle(x, y, 6, 10, c, 0.85);
      w.setBlendMode(Phaser.BlendModes.ADD);
      layer.add(w);
    }

    // ビル群シルエット
    for (let i = 0; i < 8; i++) {
      const w = Phaser.Math.Between(60, 130);
      const h = Phaser.Math.Between(140, 260);
      const x = Phaser.Math.Between(-20, GAME_WIDTH);
      const b = scene.add.rectangle(x, GAME_HEIGHT - 70, w, h, 0x05030a, 1);
      b.setOrigin(0.5, 1);
      layer.add(b);
    }

    // 道路
    const road = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 35, GAME_WIDTH, 90, 0x0d0815);
    layer.add(road);
    const stripe = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 30, GAME_WIDTH, 3, 0xffe566, 0.6);
    layer.add(stripe);

    // 上部ネオンサイン点滅
    const neon = scene.add.text(GAME_WIDTH - 50, 20, "夜の街", {
      fontSize: "20px",
      color: "#ff44ff",
      fontStyle: "bold",
    });
    neon.setOrigin(1, 0);
    layer.add(neon);
    scene.tweens.add({ targets: neon, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });

    // パーティクル：ネオン粒子
    if (scene.textures.exists("fx_spark")) {
      const e = scene.add.particles(GAME_WIDTH / 2, GAME_HEIGHT, "fx_spark", {
        x: { min: 0, max: GAME_WIDTH },
        y: GAME_HEIGHT + 10,
        lifespan: 4000,
        speedY: { min: -40, max: -20 },
        scale: { start: 0.2, end: 0 },
        alpha: { start: 0.6, end: 0 },
        tint: [0xff66ff, 0x66ffff],
        frequency: 200,
        blendMode: "ADD",
      });
      layer.add(e);
    }
  } else if (id === "DOJO") {
    // 壁
    const wall = scene.add.graphics();
    wall.fillGradientStyle(0x3a2814, 0x4a3318, 0x2a1810, 0x1a0e08, 1);
    wall.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT - 90);
    layer.add(wall);

    // 障子格子
    for (let x = 80; x < GAME_WIDTH; x += 110) {
      const panel = scene.add.rectangle(x, 130, 90, 200, 0xf3e4c6, 0.85);
      layer.add(panel);
      const frame = scene.add.graphics();
      frame.lineStyle(3, 0x2a1808, 1);
      frame.strokeRect(x - 45, 30, 90, 200);
      frame.lineBetween(x - 45, 130, x + 45, 130);
      frame.lineBetween(x, 30, x, 230);
      layer.add(frame);
    }

    // 木目床
    const floor = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 45, GAME_WIDTH, 90, 0x6b3f1f);
    layer.add(floor);
    const planks = scene.add.graphics();
    planks.lineStyle(1, 0x3a2010, 0.8);
    for (let x = 0; x < GAME_WIDTH; x += 60) {
      planks.lineBetween(x, GAME_HEIGHT - 90, x, GAME_HEIGHT);
    }
    layer.add(planks);

    // 提灯
    for (let i = 0; i < 3; i++) {
      const x = 150 + i * 250;
      const lantern = scene.add.circle(x, 60, 16, 0xff4444, 1);
      layer.add(lantern);
      const string = scene.add.rectangle(x, 30, 1, 60, 0x1a0808);
      layer.add(string);
      scene.tweens.add({ targets: lantern, alpha: 0.7, duration: 1500, yoyo: true, repeat: -1, delay: i * 300 });
    }

    // 文字
    const ki = scene.add.text(GAME_WIDTH / 2, 35, "気", {
      fontSize: "32px",
      color: "#ffffff",
      fontStyle: "bold",
    });
    ki.setOrigin(0.5);
    layer.add(ki);
  } else {
    // ROOFTOP - 夕焼け
    const sky = scene.add.graphics();
    sky.fillGradientStyle(0xff7733, 0xff9966, 0xffcc99, 0xffaa66, 1);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT - 120);
    layer.add(sky);

    // 太陽
    const sun = scene.add.circle(GAME_WIDTH * 0.7, 130, 50, 0xffeebb, 1);
    sun.setBlendMode(Phaser.BlendModes.ADD);
    layer.add(sun);
    const halo = scene.add.circle(GAME_WIDTH * 0.7, 130, 80, 0xffffff, 0.3);
    halo.setBlendMode(Phaser.BlendModes.ADD);
    layer.add(halo);

    // 遠景ビル
    for (let i = 0; i < 12; i++) {
      const w = Phaser.Math.Between(40, 80);
      const h = Phaser.Math.Between(90, 180);
      const x = i * 70 + Phaser.Math.Between(-20, 20);
      const b = scene.add.rectangle(x, GAME_HEIGHT - 120, w, h, 0x6a3a3a, 1);
      b.setOrigin(0.5, 1);
      layer.add(b);
    }

    // 屋上の床
    const rooftop = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 60, GAME_WIDTH, 120, 0x444455);
    layer.add(rooftop);

    // フェンス
    for (let x = 20; x < GAME_WIDTH; x += 24) {
      const post = scene.add.rectangle(x, GAME_HEIGHT - 105, 2, 30, 0x222233);
      layer.add(post);
    }
    const top = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 120, GAME_WIDTH, 3, 0x222233);
    layer.add(top);

    // 雲
    if (scene.textures.exists("fx_spark")) {
      const e = scene.add.particles(0, 0, "fx_spark", {
        x: { min: -50, max: GAME_WIDTH + 50 },
        y: { min: 30, max: 150 },
        lifespan: 8000,
        speedX: { min: 15, max: 35 },
        scale: { start: 1.2, end: 0 },
        alpha: { start: 0.5, end: 0 },
        tint: 0xffffff,
        frequency: 800,
      });
      layer.add(e);
    }
  }

  // 共通：地面の影（キャラ足元）
  const groundShadow = scene.add.graphics();
  groundShadow.fillStyle(0x000000, 0.4);
  groundShadow.fillEllipse(0, 0, 80, 12);
  groundShadow.setVisible(false);
  return { layer, groundY: GROUND_Y };
};
