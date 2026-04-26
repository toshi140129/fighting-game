import * as Phaser from "phaser";
import { GROUND_Y } from "../config/gameConfig";

export type FighterState =
  | "idle"
  | "walk_forward"
  | "walk_back"
  | "punch"
  | "kick"
  | "special_1"
  | "special_2"
  | "special_3"
  | "gambling"
  | "guard"
  | "hit"
  | "knockdown"
  | "win"
  | "lose";

export type FighterSide = "left" | "right";

export interface FighterColors {
  body: number;
  accent: number;
}

export interface FighterOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  side: FighterSide;
  photoTextureKey: string | null;
  colors: FighterColors;
  name: string;
}

const SPRITE_HEIGHT = 200;
const STICK_BODY_HEIGHT = 60;
const STICK_HEAD_RADIUS = 26;
const STICK_LIMB_THICK = 8;
const STICK_ARM_LEN = 32;
const STICK_LEG_LEN = 36;

export class Fighter {
  scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  // スプライト方式の場合に使う
  sprite: Phaser.GameObjects.Image | null = null;
  shieldGfx: Phaser.GameObjects.Graphics | null = null;
  // 棒人間方式の場合に使う
  body: Phaser.GameObjects.Graphics | null = null;
  head: Phaser.GameObjects.Image | Phaser.GameObjects.Arc | null = null;
  nameTag: Phaser.GameObjects.Text;
  side: FighterSide;
  colors: FighterColors;
  state: FighterState = "idle";
  private animTime = 0;
  private stateStartedAt = 0;
  private facing: 1 | -1;
  private idleBob = 0;
  private hasSprite = false;
  private spriteBaseScale = 1;
  private spriteBaseY = 0;

  constructor(opts: FighterOptions) {
    this.scene = opts.scene;
    this.side = opts.side;
    this.colors = opts.colors;
    this.facing = opts.side === "left" ? 1 : -1;

    this.container = opts.scene.add.container(opts.x, opts.y);

    if (opts.photoTextureKey && opts.scene.textures.exists(opts.photoTextureKey)) {
      this.hasSprite = true;
      this.buildSpriteFighter(opts);
    } else {
      this.buildStickFighter();
    }

    this.nameTag = opts.scene.add.text(
      0,
      this.hasSprite ? -SPRITE_HEIGHT - 14 : -STICK_BODY_HEIGHT - STICK_HEAD_RADIUS * 2 - 14,
      opts.name,
      {
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        color: opts.side === "left" ? "#73b8ff" : "#ff9090",
        fontStyle: "bold",
        stroke: "#000",
        strokeThickness: 3,
      }
    );
    this.nameTag.setOrigin(0.5, 1);
    this.container.add(this.nameTag);
  }

  private buildSpriteFighter(opts: FighterOptions) {
    const img = opts.scene.add.image(0, 0, opts.photoTextureKey!);
    // 高さを SPRITE_HEIGHT に揃える。足元が0(=container.y)に来るように調整
    const scale = SPRITE_HEIGHT / img.height;
    img.setScale(scale);
    img.setOrigin(0.5, 1); // 足元を原点に
    img.y = 0;
    this.spriteBaseScale = scale;
    this.spriteBaseY = 0;

    // 影
    const shadow = opts.scene.add.graphics();
    shadow.fillStyle(0x000000, 0.45);
    shadow.fillEllipse(0, 4, img.displayWidth * 0.6, 12);
    this.container.add(shadow);

    this.container.add(img);
    this.sprite = img;

    // ガード時に出すシールド
    this.shieldGfx = opts.scene.add.graphics();
    this.shieldGfx.setVisible(false);
    this.container.add(this.shieldGfx);
  }

  private buildStickFighter() {
    this.body = this.scene.add.graphics();
    this.container.add(this.body);
    this.head = this.scene.add.circle(
      0,
      -STICK_BODY_HEIGHT - STICK_HEAD_RADIUS,
      STICK_HEAD_RADIUS,
      this.colors.body
    );
    (this.head as Phaser.GameObjects.Arc).setStrokeStyle(3, this.colors.accent);
    this.container.add(this.head);
    this.drawStick();
  }

  destroy() {
    this.container.destroy();
  }

  setState(s: FighterState) {
    if (this.state === s) return;
    this.state = s;
    this.stateStartedAt = this.scene.time.now;
    if (this.hasSprite) this.applySpriteEnter(s);
  }

  faceTarget(targetX: number) {
    this.facing = targetX < this.container.x ? -1 : 1;
    if (this.hasSprite && this.sprite) {
      this.sprite.flipX = this.facing < 0;
    }
  }

  update(_time: number, deltaMs: number) {
    this.animTime += deltaMs;
    this.idleBob = Math.sin(this.animTime / 250) * 2;

    const elapsed = this.scene.time.now - this.stateStartedAt;
    const transient: Record<string, number> = {
      punch: 320,
      kick: 380,
      special_1: 500,
      special_2: 500,
      special_3: 500,
      gambling: 700,
      hit: 350,
    };
    if (transient[this.state] && elapsed > transient[this.state]) {
      this.setState("idle");
    }

    if (this.hasSprite) {
      this.updateSprite();
    } else {
      this.drawStick();
    }
  }

  // ====== スプライト方式のアニメーション ======

  private applySpriteEnter(s: FighterState) {
    if (!this.sprite) return;
    const sp = this.sprite;
    const sc = this.scene;
    const dir = this.facing;

    // 進行中のtweenを停止して状態をリセット
    sc.tweens.killTweensOf(sp);
    sp.setScale(this.spriteBaseScale);
    sp.setAngle(0);
    sp.x = 0;
    sp.y = this.spriteBaseY;
    sp.setAlpha(1);
    sp.clearTint();
    if (this.shieldGfx) this.shieldGfx.setVisible(false);

    switch (s) {
      case "punch":
        // 前方に15px → 戻る（合計0.3秒）
        sc.tweens.add({
          targets: sp,
          x: 15 * dir,
          duration: 150,
          ease: "Quad.easeOut",
          yoyo: true,
        });
        break;
      case "kick":
        // 15度傾けて戻る
        sc.tweens.add({
          targets: sp,
          angle: 15 * dir,
          duration: 180,
          yoyo: true,
          ease: "Quad.easeOut",
        });
        break;
      case "guard":
        sp.setAlpha(0.6);
        if (this.shieldGfx) {
          this.shieldGfx.clear();
          this.shieldGfx.fillStyle(0x44aaff, 0.3);
          this.shieldGfx.fillCircle(20 * dir, -SPRITE_HEIGHT / 2, 50);
          this.shieldGfx.lineStyle(3, 0x66ccff, 0.9);
          this.shieldGfx.strokeCircle(20 * dir, -SPRITE_HEIGHT / 2, 50);
          this.shieldGfx.setVisible(true);
        }
        break;
      case "hit":
        // 赤くフラッシュ＋後退
        sp.setTint(0xff4444);
        sc.tweens.add({
          targets: sp,
          x: -25 * dir,
          duration: 140,
          ease: "Quad.easeOut",
          yoyo: true,
          onComplete: () => sp.clearTint(),
        });
        break;
      case "special_1":
      case "special_2":
      case "special_3":
        // 1.3倍に拡大しながら前進、エフェクトオーラ
        sc.tweens.add({
          targets: sp,
          scale: this.spriteBaseScale * 1.3,
          x: 30 * dir,
          duration: 200,
          ease: "Quad.easeOut",
          yoyo: true,
        });
        sp.setTint(this.colors.accent);
        sc.time.delayedCall(450, () => sp.clearTint());
        break;
      case "gambling":
        // 一回転してから突進
        sc.tweens.add({
          targets: sp,
          angle: 360,
          duration: 400,
          ease: "Linear",
          onComplete: () => {
            sp.setAngle(0);
            sc.tweens.add({
              targets: sp,
              x: 40 * dir,
              duration: 200,
              ease: "Quad.easeOut",
              yoyo: true,
            });
          },
        });
        break;
      case "win":
        // 上下にジャンプ繰り返し
        sc.tweens.add({
          targets: sp,
          y: this.spriteBaseY - 25,
          duration: 350,
          ease: "Quad.easeOut",
          yoyo: true,
          repeat: -1,
        });
        break;
      case "lose":
        // 横に倒れる
        sc.tweens.add({
          targets: sp,
          angle: 90 * dir,
          y: this.spriteBaseY - 10,
          duration: 600,
          ease: "Quad.easeIn",
        });
        break;
      case "knockdown":
        sc.tweens.add({
          targets: sp,
          angle: 90 * dir,
          duration: 500,
          ease: "Quad.easeIn",
        });
        break;
      case "walk_forward":
      case "walk_back":
      case "idle":
        // 待機・歩行はupdateSprite側でhandle
        break;
    }
  }

  private updateSprite() {
    if (!this.sprite) return;
    const sp = this.sprite;

    // 待機/歩行のアイドル揺れ（tweenが動いていないときのみ）
    const isAnimatingState =
      this.state === "punch" ||
      this.state === "kick" ||
      this.state === "special_1" ||
      this.state === "special_2" ||
      this.state === "special_3" ||
      this.state === "gambling" ||
      this.state === "hit" ||
      this.state === "win" ||
      this.state === "lose" ||
      this.state === "knockdown";
    if (isAnimatingState) return;

    if (this.state === "idle") {
      sp.y = this.spriteBaseY + Math.sin(this.animTime / 250) * 3;
    } else if (this.state === "walk_forward" || this.state === "walk_back") {
      // 歩行：上下と左右ロール
      sp.y = this.spriteBaseY + Math.abs(Math.sin(this.animTime / 100)) * -4;
      sp.setAngle(Math.sin(this.animTime / 100) * 4 * (this.state === "walk_forward" ? 1 : -1));
    } else if (this.state === "guard") {
      // ガード中はスケールを少し縮める
      sp.setScale(this.spriteBaseScale * 0.95);
    }
  }

  // ====== 棒人間方式（フォールバック） ======

  private drawStick() {
    if (!this.body || !this.head) return;
    const g = this.body;
    g.clear();

    const bobY = this.state === "idle" ? this.idleBob : 0;
    this.head.y = -STICK_BODY_HEIGHT - STICK_HEAD_RADIUS + bobY;

    const f = this.facing;
    const bodyTop = -STICK_BODY_HEIGHT + bobY;
    const bodyBottom = 0;
    const hipX = 0;
    const shoulderY = bodyTop + 6;

    g.lineStyle(STICK_LIMB_THICK + 2, this.colors.body, 1);
    g.beginPath();
    g.moveTo(hipX, bodyBottom);
    g.lineTo(hipX, bodyTop);
    g.strokePath();

    g.fillStyle(this.colors.accent, 1);
    g.fillRect(-12, bodyTop + 18, 24, 4);

    const elapsed = this.scene.time.now - this.stateStartedAt;

    let leftArmAngle = 0.7;
    let rightArmAngle = -0.7;
    let leftArmLen = STICK_ARM_LEN;
    let rightArmLen = STICK_ARM_LEN;
    let leftLegAngle = 0.25;
    let rightLegAngle = -0.25;

    switch (this.state) {
      case "walk_forward":
      case "walk_back": {
        const t = Math.sin(this.animTime / 100);
        leftArmAngle = 0.7 + t * 0.6;
        rightArmAngle = -0.7 - t * 0.6;
        leftLegAngle = 0.25 + t * 0.5;
        rightLegAngle = -0.25 - t * 0.5;
        break;
      }
      case "punch": {
        const p = Math.min(1, elapsed / 160);
        const back = elapsed > 160 ? Math.max(0, 1 - (elapsed - 160) / 160) : 1;
        rightArmAngle = -1.5 + (1.5 - Math.PI / 2 - 0.2) * p * back;
        rightArmLen = STICK_ARM_LEN + 18 * p * back;
        leftArmAngle = 1.0;
        break;
      }
      case "kick": {
        const p = Math.min(1, elapsed / 200);
        const back = elapsed > 200 ? Math.max(0, 1 - (elapsed - 200) / 180) : 1;
        rightLegAngle = -1.6 * p * back - 0.2;
        leftLegAngle = 0.4;
        rightArmAngle = -0.4;
        leftArmAngle = 1.2;
        break;
      }
      case "special_1":
      case "special_2":
      case "special_3": {
        const p = (elapsed % 500) / 500;
        rightArmAngle = -Math.PI / 2 + Math.sin(p * Math.PI * 2) * 0.6;
        rightArmLen = STICK_ARM_LEN + 24;
        leftArmAngle = -Math.PI / 2 + 0.4;
        leftArmLen = STICK_ARM_LEN + 16;
        break;
      }
      case "gambling": {
        const p = elapsed / 700;
        rightArmAngle = -Math.PI / 2 - p * 0.6;
        leftArmAngle = -Math.PI / 2 + p * 0.6;
        leftArmLen = rightArmLen = STICK_ARM_LEN + 30 * Math.sin(p * Math.PI);
        break;
      }
      case "guard": {
        rightArmAngle = -1.3;
        leftArmAngle = -1.8;
        rightArmLen = STICK_ARM_LEN - 4;
        leftArmLen = STICK_ARM_LEN - 4;
        break;
      }
      case "hit": {
        const p = elapsed / 350;
        leftArmAngle = 1.4 + p * 0.5;
        rightArmAngle = -1.4 - p * 0.5;
        break;
      }
      case "knockdown": {
        this.container.setRotation(Math.min(Math.PI / 2, elapsed / 500));
        break;
      }
      case "win": {
        const t = Math.sin(this.animTime / 200);
        leftArmAngle = -Math.PI / 2 + t * 0.3;
        rightArmAngle = -Math.PI / 2 - t * 0.3;
        break;
      }
      case "lose": {
        leftArmAngle = 1.5;
        rightArmAngle = -1.5;
        break;
      }
    }

    if (this.state !== "knockdown") {
      this.container.setRotation(0);
    }

    g.lineStyle(STICK_LIMB_THICK, this.colors.body, 1);
    const leftHand = this.drawLimb(g, -8, shoulderY, leftArmAngle * f, leftArmLen);
    const rightHand = this.drawLimb(g, 8, shoulderY, rightArmAngle * f, rightArmLen);

    g.fillStyle(this.colors.accent, 1);
    g.fillCircle(leftHand.x, leftHand.y, STICK_LIMB_THICK / 2 + 1);
    g.fillCircle(rightHand.x, rightHand.y, STICK_LIMB_THICK / 2 + 1);

    g.lineStyle(STICK_LIMB_THICK, this.colors.body, 1);
    this.drawLimb(g, -6, bodyBottom, Math.PI - leftLegAngle * f, STICK_LEG_LEN);
    this.drawLimb(g, 6, bodyBottom, Math.PI - rightLegAngle * f, STICK_LEG_LEN);

    if (this.state === "guard") {
      g.fillStyle(0xffffff, 0.2);
      g.fillCircle(20 * f, bodyTop + 30, 28);
      g.lineStyle(2, this.colors.accent, 0.8);
      g.strokeCircle(20 * f, bodyTop + 30, 28);
    }
  }

  private drawLimb(
    g: Phaser.GameObjects.Graphics,
    fromX: number,
    fromY: number,
    angle: number,
    length: number
  ) {
    const ex = fromX + Math.cos(angle) * length;
    const ey = fromY + Math.sin(angle) * length;
    g.beginPath();
    g.moveTo(fromX, fromY);
    g.lineTo(ex, ey);
    g.strokePath();
    return { x: ex, y: ey };
  }

  // ====== 共通API ======

  attackPoint(): { x: number; y: number } {
    const reach = this.state === "kick" ? 50 : 60;
    const heightCenter = this.hasSprite ? -SPRITE_HEIGHT / 2 : -STICK_BODY_HEIGHT * 0.6;
    return {
      x: this.container.x + reach * this.facing,
      y: this.container.y + heightCenter,
    };
  }

  worldX() {
    return this.container.x;
  }

  setX(x: number) {
    this.container.x = x;
  }

  centerY() {
    const h = this.hasSprite ? SPRITE_HEIGHT : STICK_BODY_HEIGHT;
    return this.container.y - h / 2;
  }

  knockdown() {
    this.setState("knockdown");
  }

  groundLock() {
    this.container.y = GROUND_Y;
  }

  flashHit(amount = 1) {
    this.scene.tweens.add({
      targets: this.container,
      x: this.container.x - 8 * this.facing * amount,
      duration: 60,
      yoyo: true,
      repeat: 1,
    });
    this.scene.cameras.main.shake(80, 0.005 * amount);
  }
}
