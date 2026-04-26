import * as Phaser from "phaser";
import { Fighter, type FighterSide } from "../objects/Fighter";
import { HealthBar } from "../objects/HealthBar";
import {
  ensureFxTextures,
  spawnHitSpark,
  spawnSpecialFlash,
  spawnMoveNameText,
  spawnGambleResult,
  spawnComboCounter,
  type GambleResult,
} from "../objects/SpecialEffect";
import { buildStage } from "./Stages";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GROUND_Y,
  COLORS,
  type StageId,
} from "../config/gameConfig";
import type { Move, GamblingMove, Difficulty, Winner, NetAction } from "../../types/game";

export interface BattleSceneInput {
  p1: {
    name: string;
    moves: Move[];
    gamblingMove: GamblingMove;
    hasPhoto: boolean;
  };
  p2: {
    name: string;
    moves: Move[];
    gamblingMove: GamblingMove;
    hasPhoto: boolean;
  };
  stage: StageId;
  mode: "ai" | "online";
  difficulty?: Difficulty;
  mySlot: "player1" | "player2";
  onFinish?: (winner: Winner, finalHp: { p1: number; p2: number }) => void;
  onLocalAction?: (action: NetAction) => void;
}

const BATTLE_DURATION = 60000;
const MOVE_SPEED = 180;
const ATTACK_RANGES = {
  punch: 70,
  kick: 80,
  special: 90,
  gambling: 100,
};

interface PlayerCtx {
  fighter: Fighter;
  hpBar: HealthBar;
  hp: number;
  moves: Move[];
  gamblingMove: GamblingMove;
  cooldowns: Record<string, number>;
  gamblingUsesLeft: number;
  gamblingCooldownEnd: number;
  stunnedUntil: number;
  side: FighterSide;
  slot: "player1" | "player2";
  comboCount: number;
  lastHitAt: number;
}

export class BattleScene extends Phaser.Scene {
  private p1!: PlayerCtx;
  private p2!: PlayerCtx;
  private battleInput!: BattleSceneInput;
  private timerText!: Phaser.GameObjects.Text;
  private timerEndAt = 0;
  private isOver = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private aiTimer?: Phaser.Time.TimerEvent;
  private lastSentMoveDir: "forward" | "back" | "stop" = "stop";
  private lastSentGuard = false;
  private lastPositionPushAt = 0;
  private remoteMoveDir: "forward" | "back" | "stop" = "stop";
  private touchInput: TouchInputState = {
    moveLeft: false,
    moveRight: false,
    punch: false,
    kick: false,
    guard: false,
    s1: false,
    s2: false,
    s3: false,
    gamble: false,
  };

  constructor() {
    super({ key: "Battle" });
  }

  init(data: BattleSceneInput | undefined) {
    const fromRegistry = this.game.registry.get("battleInput") as BattleSceneInput | undefined;
    this.battleInput = data?.p1 ? data : fromRegistry!;
    this.isOver = false;
  }

  create() {
    ensureFxTextures(this);
    buildStage(this, this.battleInput.stage);

    // ファイター生成
    this.p1 = this.makePlayer({
      ctxData: this.battleInput.p1,
      x: 200,
      y: GROUND_Y,
      side: "left",
      slot: "player1",
      photoKey: this.battleInput.p1.hasPhoto ? "photo_p1" : null,
      colors: { body: COLORS.player1Body, accent: COLORS.player1Accent },
    });
    this.p2 = this.makePlayer({
      ctxData: this.battleInput.p2,
      x: GAME_WIDTH - 200,
      y: GROUND_Y,
      side: "right",
      slot: "player2",
      photoKey: this.battleInput.p2.hasPhoto ? "photo_p2" : null,
      colors: { body: COLORS.player2Body, accent: COLORS.player2Accent },
    });

    // HPバー
    this.p1.hpBar = new HealthBar({
      scene: this,
      x: 20,
      y: 28,
      width: 320,
      height: 16,
      alignment: "left",
      name: this.battleInput.p1.name,
      accentColor: COLORS.player1Accent,
    });
    this.p2.hpBar = new HealthBar({
      scene: this,
      x: GAME_WIDTH - 20 - 320,
      y: 28,
      width: 320,
      height: 16,
      alignment: "right",
      name: this.battleInput.p2.name,
      accentColor: COLORS.player2Accent,
    });

    // タイマー
    this.timerText = this.add.text(GAME_WIDTH / 2, 28, "60", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "32px",
      color: "#ffd700",
      fontStyle: "900",
      stroke: "#000",
      strokeThickness: 4,
    });
    this.timerText.setOrigin(0.5, 0);
    this.timerText.setDepth(20);

    this.timerEndAt = this.time.now + BATTLE_DURATION;

    // キー入力
    this.keys = this.input1Keys();

    // バーチャルパッド（タッチ可能環境のみ）
    if (this.sys.game.device.input.touch) {
      new VirtualPad(this, this.touchInput, this.battleInput.p1.moves);
    }

    // FIGHT! 演出
    this.showFightStart();

    // CPU AI（オンラインの場合は startAi を呼ばない）
    if (this.battleInput.mode === "ai") {
      this.startAi();
    }
  }

  private emitNet(action: NetAction) {
    if (this.battleInput.mode !== "online") return;
    this.battleInput.onLocalAction?.(action);
  }

  /** PhaserGame.tsx から呼ばれる：相手プレイヤーの操作を受信して再生する */
  public applyRemoteAction(action: NetAction) {
    if (this.isOver) return;
    const remote = this.battleInput.mySlot === "player1" ? this.p2 : this.p1;
    const me = this.battleInput.mySlot === "player1" ? this.p1 : this.p2;
    if (!remote) return;

    switch (action.kind) {
      case "punch":
        this.attemptBasic(remote, me, "punch", action.damage);
        break;
      case "kick":
        this.attemptBasic(remote, me, "kick", action.damage);
        break;
      case "special":
        if (action.moveIndex !== undefined) {
          this.attemptSpecial(remote, me, action.moveIndex);
        }
        break;
      case "gamble":
        if (action.gambleResult) {
          this.attemptGamble(remote, me, action.gambleResult);
        }
        break;
      case "guard":
        remote.fighter.setState("guard");
        break;
      case "guard_release":
        if (remote.fighter.state === "guard") remote.fighter.setState("idle");
        break;
      case "move":
        this.remoteMoveDir = action.direction ?? "stop";
        break;
      case "move_stop":
        this.remoteMoveDir = "stop";
        break;
      case "position":
        if (typeof action.x === "number") {
          // 補間しすぎないよう距離が大きいときだけスナップ
          const dx = Math.abs(action.x - remote.fighter.worldX());
          if (dx > 30) {
            remote.fighter.setX(action.x);
          } else {
            remote.fighter.setX(remote.fighter.worldX() * 0.7 + action.x * 0.3);
          }
        }
        break;
    }
  }

  private input1Keys(): Record<string, Phaser.Input.Keyboard.Key> {
    if (!this.input2Keyboard()) return {} as Record<string, Phaser.Input.Keyboard.Key>;
    const kb = this.input.keyboard!;
    return {
      A: kb.addKey("A"),
      D: kb.addKey("D"),
      J: kb.addKey("J"),
      K: kb.addKey("K"),
      L: kb.addKey("L"),
      U: kb.addKey("U"),
      I: kb.addKey("I"),
      O: kb.addKey("O"),
      H: kb.addKey("H"),
    };
  }

  private input2Keyboard(): boolean {
    return !!(this.input as any).keyboard;
  }

  private makePlayer(opts: {
    ctxData: BattleSceneInput["p1"];
    x: number;
    y: number;
    side: FighterSide;
    slot: "player1" | "player2";
    photoKey: string | null;
    colors: { body: number; accent: number };
  }): PlayerCtx {
    const fighter = new Fighter({
      scene: this,
      x: opts.x,
      y: opts.y,
      side: opts.side,
      photoTextureKey: opts.photoKey,
      colors: opts.colors,
      name: opts.ctxData.name,
    });
    return {
      fighter,
      hpBar: null as unknown as HealthBar,
      hp: 100,
      moves: opts.ctxData.moves,
      gamblingMove: opts.ctxData.gamblingMove,
      cooldowns: {},
      gamblingUsesLeft: 2,
      gamblingCooldownEnd: 0,
      stunnedUntil: 0,
      side: opts.side,
      slot: opts.slot,
      comboCount: 0,
      lastHitAt: 0,
    };
  }

  update(time: number, delta: number) {
    if (this.isOver) {
      this.p1.fighter.update(time, delta);
      this.p2.fighter.update(time, delta);
      return;
    }

    // 向き合わせ
    this.p1.fighter.faceTarget(this.p2.fighter.worldX());
    this.p2.fighter.faceTarget(this.p1.fighter.worldX());

    // 自プレイヤー入力（mySlotがplayer1なら左、player2なら右）
    const me = this.battleInput.mySlot === "player1" ? this.p1 : this.p2;
    const opp = this.battleInput.mySlot === "player1" ? this.p2 : this.p1;

    this.handleHumanInput(me, opp, delta);

    // オンライン時：リモートプレイヤーの移動を反映
    if (this.battleInput.mode === "online") {
      const remote = this.battleInput.mySlot === "player1" ? this.p2 : this.p1;
      const remoteDir = remote.side === "left" ? 1 : -1;
      if (this.remoteMoveDir === "forward") {
        remote.fighter.setX(remote.fighter.worldX() + (remoteDir * MOVE_SPEED * delta) / 1000);
        if (!this.isTransientState(remote.fighter.state)) {
          remote.fighter.setState("walk_forward");
        }
      } else if (this.remoteMoveDir === "back") {
        remote.fighter.setX(remote.fighter.worldX() - (remoteDir * MOVE_SPEED * delta) / 1000);
        if (!this.isTransientState(remote.fighter.state)) {
          remote.fighter.setState("walk_back");
        }
      } else if (
        remote.fighter.state === "walk_forward" ||
        remote.fighter.state === "walk_back"
      ) {
        remote.fighter.setState("idle");
      }
      remote.fighter.setX(Phaser.Math.Clamp(remote.fighter.worldX(), 60, GAME_WIDTH - 60));
    }

    this.p1.fighter.update(time, delta);
    this.p2.fighter.update(time, delta);

    // タイマー
    const remain = Math.max(0, this.timerEndAt - time);
    this.timerText.setText(Math.ceil(remain / 1000).toString());
    if (remain <= 0) {
      this.finishByTime();
    }

    // コンボ自動リセット
    [this.p1, this.p2].forEach((p) => {
      if (p.comboCount > 0 && time - p.lastHitAt > 1500) {
        p.comboCount = 0;
      }
    });
  }

  private handleHumanInput(me: PlayerCtx, opp: PlayerCtx, delta: number) {
    if (this.time.now < me.stunnedUntil) {
      me.fighter.setState("hit");
      return;
    }

    const k = this.keys;
    const t = this.touchInput;

    const dir = me.side === "left" ? 1 : -1;
    const movingForward =
      (k.D?.isDown && me.side === "left") ||
      (k.A?.isDown && me.side === "right") ||
      t.moveRight;
    const movingBack =
      (k.A?.isDown && me.side === "left") ||
      (k.D?.isDown && me.side === "right") ||
      t.moveLeft;

    let isMoving = false;
    let currMoveDir: "forward" | "back" | "stop" = "stop";
    if (movingForward) {
      me.fighter.setX(me.fighter.worldX() + (dir * MOVE_SPEED * delta) / 1000);
      me.fighter.setState("walk_forward");
      isMoving = true;
      currMoveDir = "forward";
    } else if (movingBack) {
      me.fighter.setX(me.fighter.worldX() - (dir * MOVE_SPEED * delta) / 1000);
      me.fighter.setState("walk_back");
      isMoving = true;
      currMoveDir = "back";
    }

    me.fighter.setX(Phaser.Math.Clamp(me.fighter.worldX(), 60, GAME_WIDTH - 60));

    if (currMoveDir !== this.lastSentMoveDir) {
      if (currMoveDir === "stop") {
        this.emitNet({ kind: "move_stop", ts: Date.now() });
      } else {
        this.emitNet({ kind: "move", direction: currMoveDir, ts: Date.now() });
      }
      this.lastSentMoveDir = currMoveDir;
    }

    // 位置スナップショット（200msごと）
    if (Date.now() - this.lastPositionPushAt > 200) {
      this.lastPositionPushAt = Date.now();
      this.emitNet({ kind: "position", x: me.fighter.worldX(), ts: Date.now() });
    }

    // ガード
    const guarding = k.L?.isDown || t.guard;
    if (guarding && !isMoving) {
      me.fighter.setState("guard");
    }
    if (guarding !== this.lastSentGuard) {
      this.emitNet({ kind: guarding ? "guard" : "guard_release", ts: Date.now() });
      this.lastSentGuard = !!guarding;
    }

    // パンチ・キック・必殺技・賭け技
    const justDown = (key?: Phaser.Input.Keyboard.Key) =>
      key ? Phaser.Input.Keyboard.JustDown(key) : false;
    if (justDown(k.J) || this.consumeTouch("punch")) {
      const dmg = this.attemptBasic(me, opp, "punch");
      if (dmg !== null) this.emitNet({ kind: "punch", damage: dmg, ts: Date.now() });
    } else if (justDown(k.K) || this.consumeTouch("kick")) {
      const dmg = this.attemptBasic(me, opp, "kick");
      if (dmg !== null) this.emitNet({ kind: "kick", damage: dmg, ts: Date.now() });
    } else if (justDown(k.U) || this.consumeTouch("s1")) {
      if (this.attemptSpecial(me, opp, 0)) {
        this.emitNet({ kind: "special", moveIndex: 0, ts: Date.now() });
      }
    } else if (justDown(k.I) || this.consumeTouch("s2")) {
      if (this.attemptSpecial(me, opp, 1)) {
        this.emitNet({ kind: "special", moveIndex: 1, ts: Date.now() });
      }
    } else if (justDown(k.O) || this.consumeTouch("s3")) {
      if (this.attemptSpecial(me, opp, 2)) {
        this.emitNet({ kind: "special", moveIndex: 2, ts: Date.now() });
      }
    } else if (justDown(k.H) || this.consumeTouch("gamble")) {
      const result = this.attemptGamble(me, opp);
      if (result) {
        this.emitNet({ kind: "gamble", gambleResult: result, ts: Date.now() });
      }
    }

    // 何もしてなければidle
    if (!isMoving && !guarding && me.fighter.state === "idle") {
      // 既にidle、保持
    } else if (!isMoving && !guarding && this.isTransientState(me.fighter.state)) {
      // 攻撃中は維持
    } else if (!isMoving && !guarding) {
      me.fighter.setState("idle");
    }
  }

  private isTransientState(s: string): boolean {
    return ["punch", "kick", "special_1", "special_2", "special_3", "gambling", "hit"].includes(s);
  }

  private consumeTouch(key: keyof TouchInputState): boolean {
    if (this.touchInput[key]) {
      this.touchInput[key] = false;
      return true;
    }
    return false;
  }

  private attemptBasic(
    attacker: PlayerCtx,
    defender: PlayerCtx,
    kind: "punch" | "kick",
    forcedDmg?: number
  ): number | null {
    if (this.isTransientState(attacker.fighter.state)) return null;
    attacker.fighter.setState(kind);
    const dmg =
      forcedDmg ??
      (kind === "punch"
        ? Phaser.Math.Between(8, 15)
        : Phaser.Math.Between(12, 22));
    const range = kind === "punch" ? ATTACK_RANGES.punch : ATTACK_RANGES.kick;
    this.time.delayedCall(kind === "punch" ? 140 : 180, () => {
      this.resolveHit(attacker, defender, dmg, range, kind);
    });
    return dmg;
  }

  private attemptSpecial(attacker: PlayerCtx, defender: PlayerCtx, idx: number): boolean {
    if (this.isTransientState(attacker.fighter.state)) return false;
    const move = attacker.moves[idx];
    if (!move) return false;
    const cdEnd = attacker.cooldowns[move.id] ?? 0;
    if (this.time.now < cdEnd) return false;
    attacker.cooldowns[move.id] = this.time.now + move.cooldown * 1000;

    const stateMap = ["special_1", "special_2", "special_3"] as const;
    attacker.fighter.setState(stateMap[idx]);

    spawnMoveNameText(this, move.name, move.flavor_text, attacker.side);
    spawnSpecialFlash(this, attacker.side === "left" ? COLORS.player1Accent : COLORS.player2Accent);

    const range = move.range === "long" ? GAME_WIDTH : ATTACK_RANGES.special;
    this.time.delayedCall(280, () => {
      this.resolveHit(attacker, defender, move.power, range, "special", true);
    });
    return true;
  }

  private attemptGamble(
    attacker: PlayerCtx,
    defender: PlayerCtx,
    forcedResult?: GambleResult
  ): GambleResult | null {
    if (this.isTransientState(attacker.fighter.state)) return null;
    if (attacker.gamblingUsesLeft <= 0) return null;
    if (this.time.now < attacker.gamblingCooldownEnd) return null;

    attacker.gamblingUsesLeft -= 1;
    attacker.gamblingCooldownEnd = this.time.now + 20000;
    attacker.fighter.setState("gambling");

    const result = forcedResult ?? this.rollGamble();
    const gm = attacker.gamblingMove;
    spawnMoveNameText(this, gm.name, gm.flavor_text, attacker.side);

    this.time.delayedCall(450, () => {
      spawnGambleResult(this, result);

      const { damage, selfDamage } = this.calculateGambleDamage(
        gm.basePower,
        result,
        gm.selfDamageReduction
      );

      if (damage > 0) {
        this.applyDamage(attacker, defender, damage, true);
        spawnHitSpark(this, defender.fighter.attackPoint().x, defender.fighter.centerY(), true);
      }
      if (selfDamage > 0) {
        this.applyDamage(defender, attacker, selfDamage, true);
        spawnHitSpark(this, attacker.fighter.attackPoint().x, attacker.fighter.centerY(), true);
      }
      if (result === "JACKPOT") {
        defender.stunnedUntil = this.time.now + 1000;
      }
    });
    return result;
  }

  private resolveHit(
    attacker: PlayerCtx,
    defender: PlayerCtx,
    baseDmg: number,
    range: number,
    _kind: string,
    isSpecial = false
  ) {
    const dx = Math.abs(attacker.fighter.worldX() - defender.fighter.worldX());
    if (dx > range) return; // 空振り

    const isGuarding = defender.fighter.state === "guard";
    const dmg = isGuarding ? Math.round(baseDmg * 0.15) : baseDmg;

    this.applyDamage(attacker, defender, dmg, isSpecial);

    const hit = defender.fighter.attackPoint();
    spawnHitSpark(this, hit.x, defender.fighter.centerY(), isSpecial);

    if (!isGuarding) {
      defender.fighter.setState("hit");
      defender.fighter.flashHit(isSpecial ? 1.5 : 1);
    }

    // コンボ
    if (this.time.now - attacker.lastHitAt < 1500) {
      attacker.comboCount += 1;
    } else {
      attacker.comboCount = 1;
    }
    attacker.lastHitAt = this.time.now;
    if (attacker.comboCount >= 2) {
      spawnComboCounter(this, attacker.comboCount);
    }
  }

  private applyDamage(attacker: PlayerCtx, defender: PlayerCtx, dmg: number, _big: boolean) {
    void attacker;
    defender.hp = Math.max(0, defender.hp - dmg);
    defender.hpBar.setHp(defender.hp);
    if (defender.hp <= 0) {
      this.finishKO(defender.slot);
    }
  }

  private rollGamble(): GambleResult {
    const r = Math.random();
    if (r < 0.1) return "JACKPOT";
    if (r < 0.4) return "HIT";
    if (r < 0.7) return "OK";
    if (r < 0.9) return "MISS";
    return "BACKFIRE";
  }

  private calculateGambleDamage(
    basePower: number,
    result: GambleResult,
    selfReduction: number
  ): { damage: number; selfDamage: number } {
    switch (result) {
      case "JACKPOT":
        return { damage: Math.round(basePower * 2), selfDamage: 0 };
      case "HIT":
        return { damage: Math.round(basePower * 1.5), selfDamage: 0 };
      case "OK":
        return { damage: Math.round(basePower), selfDamage: 0 };
      case "MISS":
        return { damage: 0, selfDamage: 0 };
      case "BACKFIRE":
        return {
          damage: 0,
          selfDamage: Math.round(basePower * 0.5 * (1 - selfReduction)),
        };
    }
  }

  private finishKO(loserSlot: "player1" | "player2") {
    if (this.isOver) return;
    this.isOver = true;
    const winner: Winner = loserSlot === "player1" ? "player2" : "player1";
    this.endBattle(winner);
  }

  private finishByTime() {
    if (this.isOver) return;
    this.isOver = true;
    let winner: Winner;
    if (this.p1.hp > this.p2.hp) winner = "player1";
    else if (this.p2.hp > this.p1.hp) winner = "player2";
    else winner = "draw";
    this.endBattle(winner);
  }

  private endBattle(winner: Winner) {
    this.aiTimer?.remove();

    if (winner === "player1") {
      this.p1.fighter.setState("win");
      this.p2.fighter.knockdown();
    } else if (winner === "player2") {
      this.p2.fighter.setState("win");
      this.p1.fighter.knockdown();
    } else {
      this.p1.fighter.setState("lose");
      this.p2.fighter.setState("lose");
    }

    const label = winner === "draw" ? "DRAW" : winner === this.battleInput.mySlot ? "YOU WIN!" : "K.O.";
    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, label, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "80px",
      color: winner === "draw" ? "#cccccc" : winner === this.battleInput.mySlot ? "#ffd700" : "#ff4444",
      fontStyle: "900",
      stroke: "#000",
      strokeThickness: 8,
    });
    t.setOrigin(0.5);
    t.setDepth(100);
    t.setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 350, ease: "Back.easeOut" });
    this.cameras.main.flash(400, 255, 255, 255);
    this.cameras.main.shake(500, 0.02);

    this.time.delayedCall(2200, () => {
      this.battleInput.onFinish?.(winner, { p1: this.p1.hp, p2: this.p2.hp });
    });
  }

  private showFightStart() {
    const ready = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "READY?", {
      fontSize: "64px",
      color: "#ffffff",
      fontStyle: "900",
      stroke: "#000",
      strokeThickness: 6,
    });
    ready.setOrigin(0.5);
    ready.setDepth(100);
    ready.setScale(0.3);
    this.tweens.add({ targets: ready, scale: 1, duration: 300, ease: "Back.easeOut" });
    this.time.delayedCall(900, () => {
      ready.destroy();
      const fight = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, "FIGHT!", {
        fontSize: "84px",
        color: "#ffd700",
        fontStyle: "900",
        stroke: "#000",
        strokeThickness: 8,
      });
      fight.setOrigin(0.5);
      fight.setDepth(100);
      this.cameras.main.flash(200, 255, 255, 255);
      this.tweens.add({
        targets: fight,
        scale: 2,
        alpha: 0,
        duration: 700,
        onComplete: () => fight.destroy(),
      });
    });
  }

  private startAi() {
    const ai = this.battleInput.mySlot === "player1" ? this.p2 : this.p1;
    const opp = this.battleInput.mySlot === "player1" ? this.p1 : this.p2;
    const interval =
      this.battleInput.difficulty === "EASY"
        ? 2500
        : this.battleInput.difficulty === "NORMAL"
        ? 1800
        : 1200;

    this.aiTimer = this.time.addEvent({
      delay: interval,
      loop: true,
      callback: () => {
        if (this.isOver) return;
        if (this.time.now < ai.stunnedUntil) return;
        if (this.isTransientState(ai.fighter.state)) return;

        const dx = Math.abs(ai.fighter.worldX() - opp.fighter.worldX());
        const aiDir = ai.side === "left" ? 1 : -1;

        // 距離詰め
        if (dx > 100) {
          const move = MOVE_SPEED * 0.5;
          ai.fighter.setX(ai.fighter.worldX() + aiDir * move * 0.3);
          ai.fighter.setState("walk_forward");
          return;
        }

        const useGamble =
          this.battleInput.difficulty === "HARD"
            ? Math.random() < 0.3
            : this.battleInput.difficulty === "NORMAL"
            ? Math.random() < 0.1
            : false;
        if (
          useGamble &&
          ai.gamblingUsesLeft > 0 &&
          this.time.now >= ai.gamblingCooldownEnd
        ) {
          this.attemptGamble(ai, opp);
          return;
        }

        const availableSpecials = ai.moves
          .map((m, i) => ({ m, i }))
          .filter(({ m }) => this.time.now >= (ai.cooldowns[m.id] ?? 0));
        if (availableSpecials.length > 0 && Math.random() < 0.5) {
          const pick =
            availableSpecials[Math.floor(Math.random() * availableSpecials.length)];
          this.attemptSpecial(ai, opp, pick.i);
          return;
        }

        if (Math.random() < 0.15) {
          ai.fighter.setState("guard");
          this.time.delayedCall(500, () => {
            if (ai.fighter.state === "guard") ai.fighter.setState("idle");
          });
          return;
        }

        this.attemptBasic(ai, opp, Math.random() < 0.5 ? "punch" : "kick");
      },
    });
  }
}

interface TouchInputState {
  moveLeft: boolean;
  moveRight: boolean;
  punch: boolean;
  kick: boolean;
  guard: boolean;
  s1: boolean;
  s2: boolean;
  s3: boolean;
  gamble: boolean;
}

class VirtualPad {
  scene: Phaser.Scene;
  state: TouchInputState;

  constructor(scene: Phaser.Scene, state: TouchInputState, specials: Move[]) {
    this.scene = scene;
    this.state = state;

    const padY = GAME_HEIGHT - 60;

    // 左：移動
    this.makeHoldButton(60, padY, 44, "◀", () => (state.moveLeft = true), () => (state.moveLeft = false));
    this.makeHoldButton(140, padY, 44, "▶", () => (state.moveRight = true), () => (state.moveRight = false));

    // 右側：攻撃
    const rightX = GAME_WIDTH - 60;
    this.makeTapButton(rightX, padY, 38, "P", "#73b8ff", () => (state.punch = true));
    this.makeTapButton(rightX - 80, padY, 38, "K", "#73b8ff", () => (state.kick = true));
    this.makeHoldButton(rightX - 160, padY, 38, "G", () => (state.guard = true), () => (state.guard = false));

    // 必殺技列（上）
    const specialY = GAME_HEIGHT - 130;
    if (specials[0])
      this.makeTapButton(rightX - 160, specialY, 30, "1", "#aa44ff", () => (state.s1 = true));
    if (specials[1])
      this.makeTapButton(rightX - 80, specialY, 30, "2", "#aa44ff", () => (state.s2 = true));
    if (specials[2])
      this.makeTapButton(rightX, specialY, 30, "3", "#aa44ff", () => (state.s3 = true));

    // 賭け技
    this.makeTapButton(GAME_WIDTH / 2, GAME_HEIGHT - 35, 28, "🎲", "#ffd700", () => (state.gamble = true));
  }

  private makeHoldButton(
    x: number,
    y: number,
    radius: number,
    label: string,
    onDown: () => void,
    onUp: () => void
  ) {
    const c = this.scene.add.container(x, y);
    c.setDepth(90);
    const bg = this.scene.add.circle(0, 0, radius, 0x000000, 0.5);
    bg.setStrokeStyle(2, 0xffffff, 0.7);
    bg.setInteractive({ useHandCursor: true });
    const t = this.scene.add.text(0, 0, label, {
      fontSize: `${Math.floor(radius * 0.7)}px`,
      color: "#ffffff",
      fontStyle: "bold",
    });
    t.setOrigin(0.5);
    c.add(bg);
    c.add(t);
    bg.on("pointerdown", () => {
      onDown();
      bg.setFillStyle(0xffffff, 0.3);
    });
    bg.on("pointerup", () => {
      onUp();
      bg.setFillStyle(0x000000, 0.5);
    });
    bg.on("pointerout", () => {
      onUp();
      bg.setFillStyle(0x000000, 0.5);
    });
  }

  private makeTapButton(
    x: number,
    y: number,
    radius: number,
    label: string,
    color: string,
    onTap: () => void
  ) {
    const c = this.scene.add.container(x, y);
    c.setDepth(90);
    const bg = this.scene.add.circle(0, 0, radius, 0x000000, 0.5);
    bg.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(color).color, 0.9);
    bg.setInteractive({ useHandCursor: true });
    const t = this.scene.add.text(0, 0, label, {
      fontSize: `${Math.floor(radius * 0.7)}px`,
      color,
      fontStyle: "bold",
    });
    t.setOrigin(0.5);
    c.add(bg);
    c.add(t);
    bg.on("pointerdown", () => {
      onTap();
      this.scene.tweens.add({ targets: c, scale: 0.85, duration: 80, yoyo: true });
    });
  }
}
