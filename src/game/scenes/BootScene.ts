import * as Phaser from "phaser";
import { ensureFxTextures } from "../objects/SpecialEffect";

export interface BootData {
  player1Photo: string | null;
  player2Photo: string | null;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "Boot" });
  }

  init(data: BootData) {
    this.data.set("p1photo", data.player1Photo);
    this.data.set("p2photo", data.player2Photo);
  }

  preload() {
    // 写真をテクスチャに登録（Base64 dataURL想定）
    const p1 = this.data.get("p1photo") as string | null;
    const p2 = this.data.get("p2photo") as string | null;
    if (p1) this.textures.addBase64("photo_p1", p1);
    if (p2) this.textures.addBase64("photo_p2", p2);
  }

  create() {
    ensureFxTextures(this);

    // 写真ロードはaddBase64が非同期。両方ロード済みになるのを待つ。
    const p1 = this.data.get("p1photo") as string | null;
    const p2 = this.data.get("p2photo") as string | null;

    const waitFor: Promise<void>[] = [];
    if (p1) waitFor.push(this.waitTexture("photo_p1"));
    if (p2) waitFor.push(this.waitTexture("photo_p2"));

    Promise.all(waitFor).finally(() => {
      this.scene.start("Battle");
    });
  }

  private waitTexture(key: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.textures.exists(key) && this.textures.get(key).getSourceImage()) {
        resolve();
        return;
      }
      const handler = (k: string) => {
        if (k === key) {
          this.textures.off(Phaser.Textures.Events.ADD, handler);
          resolve();
        }
      };
      this.textures.on(Phaser.Textures.Events.ADD, handler);
      // タイムアウトフォールバック
      setTimeout(() => resolve(), 1500);
    });
  }
}
