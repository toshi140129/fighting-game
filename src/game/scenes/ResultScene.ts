import * as Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config/gameConfig";
import type { Winner } from "../../types/game";

export interface ResultSceneInput {
  winner: Winner;
  mySlot: "player1" | "player2";
  onContinue: () => void;
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: "Result" });
  }

  create(data: ResultSceneInput) {
    const isDraw = data.winner === "draw";
    const isMyWin = data.winner === data.mySlot;

    this.cameras.main.setBackgroundColor("#000");

    const label = isDraw ? "DRAW" : isMyWin ? "VICTORY" : "DEFEAT";
    const color = isDraw ? "#cccccc" : isMyWin ? "#ffd700" : "#ff4444";

    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, label, {
      fontSize: "72px",
      color,
      fontStyle: "900",
      stroke: "#000",
      strokeThickness: 8,
    });
    t.setOrigin(0.5);

    this.time.delayedCall(1500, () => {
      data.onContinue();
    });
  }
}
