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

const HEAD_RADIUS = 26;
const BODY_HEIGHT = 60;
const LIMB_THICK = 8;
const ARM_LEN = 32;
const LEG_LEN = 36;

export class Fighter {
  scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Graphics;
  head: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  nameTag: Phaser.GameObjects.Text;
  side: FighterSide;
  colors: FighterColors;
  state: FighterState = "idle";
  private animTime = 0;
  private stateStartedAt = 0;
  private facing: 1 | -1;
  private idleBob = 0;

  constructor(opts: FighterOptions) {
    this.scene = opts.scene;
    this.side = opts.side;
    this.colors = opts.colors;
    this.facing = opts.side === "left" ? 1 : -1;

    this.container = opts.scene.add.container(opts.x, opts.y);
    this.body = opts.scene.add.graphics();
    this.container.add(this.body);

    if (opts.photoTextureKey && opts.scene.textures.exists(opts.photoTextureKey)) {
      const img = opts.scene.add.image(0, -BODY_HEIGHT - HEAD_RADIUS, opts.photoTextureKey);
      const scale = (HEAD_RADIUS * 2) / Math.max(img.width, img.height);
      img.setScale(scale);
      img.setOrigin(0.5);
      this.head = img;
      const ring = opts.scene.add.graphics();
      ring.lineStyle(3, this.colors.accent, 1);
      ring.strokeCircle(0, -BODY_HEIGHT - HEAD_RADIUS, HEAD_RADIUS + 1);
      this.container.add(ring);
    } else {
      this.head = opts.scene.add.circle(0, -BODY_HEIGHT - HEAD_RADIUS, HEAD_RADIUS, this.colors.body);
      (this.head as Phaser.GameObjects.Arc).setStrokeStyle(3, this.colors.accent);
    }
    this.container.add(this.head);

    this.nameTag = opts.scene.add.text(0, -BODY_HEIGHT - HEAD_RADIUS * 2 - 14, opts.name, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "12px",
      color: opts.side === "left" ? "#73b8ff" : "#ff9090",
      fontStyle: "bold",
      stroke: "#000",
      strokeThickness: 3,
    });
    this.nameTag.setOrigin(0.5, 1);
    this.container.add(this.nameTag);

    this.draw();
  }

  destroy() {
    this.container.destroy();
  }

  setState(s: FighterState) {
    if (this.state === s) return;
    this.state = s;
    this.stateStartedAt = this.scene.time.now;
  }

  faceTarget(targetX: number) {
    this.facing = targetX < this.container.x ? -1 : 1;
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

    this.draw();
  }

  private draw() {
    const g = this.body;
    g.clear();

    const bobY = this.state === "idle" ? this.idleBob : 0;
    this.head.y = -BODY_HEIGHT - HEAD_RADIUS + bobY;
    this.nameTag.y = -BODY_HEIGHT - HEAD_RADIUS * 2 - 14 + bobY;

    const f = this.facing;
    const bodyTop = -BODY_HEIGHT + bobY;
    const bodyBottom = 0;
    const hipX = 0;
    const shoulderY = bodyTop + 6;

    // 胴体
    g.lineStyle(LIMB_THICK + 2, this.colors.body, 1);
    g.beginPath();
    g.moveTo(hipX, bodyBottom);
    g.lineTo(hipX, bodyTop);
    g.strokePath();

    // 武装ベルト
    g.fillStyle(this.colors.accent, 1);
    g.fillRect(-12, bodyTop + 18, 24, 4);

    const elapsed = this.scene.time.now - this.stateStartedAt;

    // 腕の描画
    let leftArmAngle = 0.7;
    let rightArmAngle = -0.7;
    let leftArmLen = ARM_LEN;
    let rightArmLen = ARM_LEN;
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
        rightArmLen = ARM_LEN + 18 * p * back;
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
      case "special_1": {
        const p = (elapsed % 500) / 500;
        rightArmAngle = -Math.PI / 2 + Math.sin(p * Math.PI * 2) * 0.6;
        rightArmLen = ARM_LEN + 24;
        leftArmAngle = -Math.PI / 2 + 0.4;
        leftArmLen = ARM_LEN + 16;
        break;
      }
      case "special_2": {
        const p = elapsed / 500;
        rightArmAngle = -Math.PI / 2 - 0.5 + Math.sin(p * 8) * 0.3;
        leftArmAngle = -Math.PI / 2 + 0.5;
        leftArmLen = rightArmLen = ARM_LEN + 28;
        break;
      }
      case "special_3": {
        const t = elapsed / 100;
        leftArmAngle = Math.sin(t) * 1.2 - Math.PI / 2;
        rightArmAngle = -Math.sin(t) * 1.2 - Math.PI / 2;
        leftArmLen = rightArmLen = ARM_LEN + 24;
        break;
      }
      case "gambling": {
        const p = elapsed / 700;
        rightArmAngle = -Math.PI / 2 - p * 0.6;
        leftArmAngle = -Math.PI / 2 + p * 0.6;
        leftArmLen = rightArmLen = ARM_LEN + 30 * Math.sin(p * Math.PI);
        break;
      }
      case "guard": {
        rightArmAngle = -1.3;
        leftArmAngle = -1.8;
        rightArmLen = ARM_LEN - 4;
        leftArmLen = ARM_LEN - 4;
        break;
      }
      case "hit": {
        const p = elapsed / 350;
        leftArmAngle = 1.4 + p * 0.5;
        rightArmAngle = -1.4 - p * 0.5;
        break;
      }
      case "knockdown": {
        // 倒れる回転
        this.container.setRotation(Math.min(Math.PI / 2, elapsed / 500));
        break;
      }
      case "win": {
        const t = Math.sin(this.animTime / 200);
        leftArmAngle = -Math.PI / 2 + t * 0.3;
        rightArmAngle = -Math.PI / 2 - t * 0.3;
        leftArmLen = rightArmLen = ARM_LEN;
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

    // 腕
    g.lineStyle(LIMB_THICK, this.colors.body, 1);
    const leftHand = this.drawLimb(g, -8, shoulderY, leftArmAngle * f, leftArmLen);
    const rightHand = this.drawLimb(g, 8, shoulderY, rightArmAngle * f, rightArmLen);

    // 拳/エフェクトスポット
    g.fillStyle(this.colors.accent, 1);
    g.fillCircle(leftHand.x, leftHand.y, LIMB_THICK / 2 + 1);
    g.fillCircle(rightHand.x, rightHand.y, LIMB_THICK / 2 + 1);

    // 脚
    g.lineStyle(LIMB_THICK, this.colors.body, 1);
    this.drawLimb(g, -6, bodyBottom, Math.PI - leftLegAngle * f, LEG_LEN);
    this.drawLimb(g, 6, bodyBottom, Math.PI - rightLegAngle * f, LEG_LEN);

    // ガードシールド
    if (this.state === "guard") {
      g.fillStyle(0xffffff, 0.2);
      g.fillCircle(20 * f, bodyTop + 30, 28);
      g.lineStyle(2, this.colors.accent, 0.8);
      g.strokeCircle(20 * f, bodyTop + 30, 28);
    }
  }

  /** 関節を描画してエンドポイントを返す。angle=0は右、Math.PI/2は下。 */
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

  /** 攻撃ヒットボックスのワールド座標。前腕の届く位置。 */
  attackPoint(): { x: number; y: number } {
    const reach = this.state === "kick" ? 50 : 60;
    return {
      x: this.container.x + reach * this.facing,
      y: this.container.y - BODY_HEIGHT * 0.6,
    };
  }

  worldX() {
    return this.container.x;
  }

  setX(x: number) {
    this.container.x = x;
  }

  /** 中央位置（HPバー下のゲージで使うかも） */
  centerY() {
    return this.container.y - BODY_HEIGHT / 2;
  }

  knockdown() {
    this.setState("knockdown");
  }

  /** 着地位置を強制 */
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
