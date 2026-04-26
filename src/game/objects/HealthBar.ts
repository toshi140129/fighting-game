import * as Phaser from "phaser";
import { COLORS } from "../config/gameConfig";

export interface HealthBarOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  alignment: "left" | "right";
  name: string;
  accentColor: number;
}

export class HealthBar {
  scene: Phaser.Scene;
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  fill: Phaser.GameObjects.Graphics;
  shadow: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
  alignment: "left" | "right";
  width: number;
  height: number;
  shadowHp = 100;
  hp = 100;

  constructor(opts: HealthBarOptions) {
    this.scene = opts.scene;
    this.alignment = opts.alignment;
    this.width = opts.width;
    this.height = opts.height;

    this.container = opts.scene.add.container(opts.x, opts.y);

    this.bg = opts.scene.add.graphics();
    this.shadow = opts.scene.add.graphics();
    this.fill = opts.scene.add.graphics();

    this.container.add(this.bg);
    this.container.add(this.shadow);
    this.container.add(this.fill);

    this.nameText = opts.scene.add.text(0, -opts.height - 4, opts.name, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#000",
      strokeThickness: 3,
    });
    this.nameText.setOrigin(opts.alignment === "left" ? 0 : 1, 1);
    this.nameText.x = opts.alignment === "left" ? 0 : opts.width;
    this.container.add(this.nameText);

    this.hpText = opts.scene.add.text(0, opts.height + 2, "100 / 100", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "11px",
      color: "#ffffff",
      stroke: "#000",
      strokeThickness: 2,
    });
    this.hpText.setOrigin(opts.alignment === "left" ? 0 : 1, 0);
    this.hpText.x = opts.alignment === "left" ? 0 : opts.width;
    this.container.add(this.hpText);

    this.drawAll();
  }

  setHp(hp: number, max = 100) {
    const clamped = Math.max(0, Math.min(max, hp));
    this.hp = clamped;
    this.hpText.setText(`${clamped} / ${max}`);
    this.drawFill();
    this.scene.tweens.add({
      targets: this,
      shadowHp: clamped,
      duration: 350,
      ease: "Cubic.easeOut",
      onUpdate: () => this.drawShadow(),
    });
  }

  private drawAll() {
    this.drawBg();
    this.drawShadow();
    this.drawFill();
  }

  private drawBg() {
    const g = this.bg;
    g.clear();
    g.fillStyle(0x000000, 0.7);
    g.fillRect(-2, -2, this.width + 4, this.height + 4);
    g.lineStyle(2, 0xffffff, 0.6);
    g.strokeRect(0, 0, this.width, this.height);
  }

  private drawShadow() {
    const g = this.shadow;
    g.clear();
    const w = (this.shadowHp / 100) * this.width;
    g.fillStyle(0xffffaa, 0.6);
    if (this.alignment === "left") {
      g.fillRect(0, 0, w, this.height);
    } else {
      g.fillRect(this.width - w, 0, w, this.height);
    }
  }

  private drawFill() {
    const g = this.fill;
    g.clear();
    const pct = this.hp / 100;
    const w = pct * this.width;
    const color = pct > 0.5 ? COLORS.hpGood : pct > 0.25 ? COLORS.hpMid : COLORS.hpBad;
    g.fillStyle(color, 1);
    if (this.alignment === "left") {
      g.fillRect(0, 0, w, this.height);
    } else {
      g.fillRect(this.width - w, 0, w, this.height);
    }
  }

  destroy() {
    this.container.destroy();
  }
}
