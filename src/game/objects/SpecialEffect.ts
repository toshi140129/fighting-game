import * as Phaser from "phaser";
import { COLORS, GAME_WIDTH, GAME_HEIGHT } from "../config/gameConfig";

const SPARK_TEX = "fx_spark";

export const ensureFxTextures = (scene: Phaser.Scene) => {
  if (!scene.textures.exists(SPARK_TEX)) {
    const g = scene.add.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 8);
    g.generateTexture(SPARK_TEX, 16, 16);
    g.destroy();
  }
};

export const spawnHitSpark = (scene: Phaser.Scene, x: number, y: number, big = false) => {
  ensureFxTextures(scene);
  const colors = [COLORS.hitSpark, COLORS.hitSparkRed, 0xffffff];
  const emitter = scene.add.particles(x, y, SPARK_TEX, {
    speed: { min: big ? 200 : 120, max: big ? 420 : 240 },
    angle: { min: 0, max: 360 },
    lifespan: big ? 500 : 280,
    quantity: big ? 18 : 8,
    scale: { start: big ? 0.8 : 0.5, end: 0 },
    alpha: { start: 1, end: 0 },
    blendMode: "ADD",
    tint: colors,
    emitting: false,
  });
  emitter.explode(big ? 18 : 8, x, y);
  scene.time.delayedCall(big ? 600 : 350, () => emitter.destroy());

  // ヒットフラッシュ円
  const flash = scene.add.circle(x, y, big ? 36 : 20, 0xffffff, 0.85);
  flash.setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: flash,
    scale: big ? 2.4 : 1.7,
    alpha: 0,
    duration: big ? 300 : 180,
    onComplete: () => flash.destroy(),
  });
};

export const spawnSpecialFlash = (scene: Phaser.Scene, color = 0xffffff) => {
  const flash = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, color, 0.6);
  flash.setBlendMode(Phaser.BlendModes.ADD);
  flash.setDepth(50);
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 220,
    onComplete: () => flash.destroy(),
  });
};

export const spawnMoveNameText = (
  scene: Phaser.Scene,
  text: string,
  flavorText: string,
  side: "left" | "right"
) => {
  const x = side === "left" ? 30 : GAME_WIDTH - 30;
  const baseY = 110;
  const c = scene.add.container(side === "left" ? x - 200 : x + 200, baseY);
  c.setDepth(60);

  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.7);
  bg.fillRoundedRect(-180, -28, 360, 56, 8);
  bg.lineStyle(2, side === "left" ? COLORS.player1Accent : COLORS.player2Accent, 1);
  bg.strokeRoundedRect(-180, -28, 360, 56, 8);
  c.add(bg);

  const name = scene.add.text(0, -10, text, {
    fontFamily: "system-ui, sans-serif",
    fontSize: "20px",
    color: "#ffffff",
    fontStyle: "bold",
    stroke: "#000",
    strokeThickness: 3,
  });
  name.setOrigin(0.5);
  c.add(name);

  if (flavorText) {
    const flavor = scene.add.text(0, 12, `「${flavorText}」`, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "12px",
      color: "#ffeb99",
    });
    flavor.setOrigin(0.5);
    c.add(flavor);
  }

  scene.tweens.add({
    targets: c,
    x: side === "left" ? x + 200 : x - 200,
    duration: 300,
    ease: "Cubic.easeOut",
  });
  scene.time.delayedCall(900, () => {
    scene.tweens.add({
      targets: c,
      alpha: 0,
      y: baseY - 20,
      duration: 350,
      onComplete: () => c.destroy(),
    });
  });
};

export type GambleResult = "JACKPOT" | "HIT" | "OK" | "MISS" | "BACKFIRE";

export const spawnGambleResult = (scene: Phaser.Scene, result: GambleResult) => {
  const labelMap: Record<GambleResult, { text: string; color: number; sub: string; flash: number }> = {
    JACKPOT: { text: "JACKPOT!!", color: COLORS.jackpot, sub: "大当たり！", flash: 0xfff080 },
    HIT: { text: "HIT!!", color: COLORS.hit, sub: "命中！", flash: 0xffaa44 },
    OK: { text: "OK", color: 0xffffff, sub: "成功", flash: 0xffffff },
    MISS: { text: "MISS...", color: COLORS.miss, sub: "外れ", flash: 0x666666 },
    BACKFIRE: { text: "BACKFIRE!!", color: COLORS.backfire, sub: "自爆！", flash: 0xff2222 },
  };
  const conf = labelMap[result];

  spawnSpecialFlash(scene, conf.flash);

  const c = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  c.setDepth(80);

  const main = scene.add.text(0, -10, conf.text, {
    fontFamily: "system-ui, sans-serif",
    fontSize: "62px",
    color: `#${conf.color.toString(16).padStart(6, "0")}`,
    fontStyle: "900",
    stroke: "#000",
    strokeThickness: 6,
  });
  main.setOrigin(0.5);
  c.add(main);

  const sub = scene.add.text(0, 38, conf.sub, {
    fontFamily: "system-ui, sans-serif",
    fontSize: "16px",
    color: "#ffffff",
    stroke: "#000",
    strokeThickness: 3,
  });
  sub.setOrigin(0.5);
  c.add(sub);

  c.setScale(0.4);
  scene.tweens.add({
    targets: c,
    scale: 1,
    duration: 220,
    ease: "Back.easeOut",
  });
  scene.cameras.main.shake(180, result === "JACKPOT" || result === "BACKFIRE" ? 0.02 : 0.008);

  scene.time.delayedCall(1300, () => {
    scene.tweens.add({
      targets: c,
      alpha: 0,
      scale: 1.4,
      duration: 320,
      onComplete: () => c.destroy(),
    });
  });
};

export const spawnComboCounter = (scene: Phaser.Scene, count: number) => {
  const existing = scene.children.getByName("comboLabel") as Phaser.GameObjects.Text | null;
  existing?.destroy();
  const t = scene.add.text(GAME_WIDTH / 2, 70, `${count} HIT COMBO!`, {
    fontFamily: "system-ui, sans-serif",
    fontSize: "32px",
    color: "#ffd700",
    fontStyle: "900",
    stroke: "#000",
    strokeThickness: 5,
  });
  t.setOrigin(0.5);
  t.setName("comboLabel");
  t.setDepth(70);
  t.setScale(1.4);
  scene.tweens.add({
    targets: t,
    scale: 1,
    duration: 200,
    ease: "Back.easeOut",
  });
  scene.time.delayedCall(1500, () => {
    scene.tweens.add({
      targets: t,
      alpha: 0,
      duration: 300,
      onComplete: () => t.destroy(),
    });
  });
};
