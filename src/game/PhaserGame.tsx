import { useEffect, useRef, useState } from "react";
import * as Phaser from "phaser";
import { buildGameConfig, type StageId } from "./config/gameConfig";
import { BootScene } from "./scenes/BootScene";
import { BattleScene, type BattleSceneInput } from "./scenes/BattleScene";
import type {
  Character,
  Difficulty,
  GameMode,
  PlayerState,
  Winner,
  NetAction,
} from "../types/game";
import {
  pushNetAction,
  subscribeNetActions,
  clearNetActions,
} from "../lib/firebase";

interface Props {
  myCharacter: Character;
  mode: GameMode;
  mySlot: "player1" | "player2";
  difficulty?: Difficulty;
  remoteOpponent?: PlayerState | null;
  roomCode?: string;
  stage?: StageId;
  onFinish: (winner: Winner, p1: PlayerState, p2: PlayerState) => void;
}

const characterToPlayerState = (c: Character): PlayerState => ({
  name: c.name,
  photoUrl: c.photoUrl,
  hp: 100,
  moves: c.moves,
  gamblingMove: c.gamblingMove,
  cooldowns: {},
  gamblingUsesLeft: 2,
  gamblingCooldownEnd: 0,
  isStunned: false,
  stunnedUntil: 0,
  actions: [],
});

const buildAiCharacter = (myChar: Character, difficulty: Difficulty): Character => {
  const labels = ["猛打", "閃光", "爆裂"];
  const flavors = ["くらえ！", "撃破！", "粉砕！"];
  return {
    name: difficulty === "EASY" ? "CPU初級" : difficulty === "NORMAL" ? "CPU中級" : "CPU上級",
    photoUrl: "",
    personality: { appearance: "", hobby: "", job: "" },
    moves: myChar.moves.map((m, i) => ({
      ...m,
      id: `ai-move${i + 1}`,
      name: `CPU・${labels[i]}`,
      flavor_text: flavors[i],
    })),
    gamblingMove: {
      name: "CPU・運命の一撃",
      description: "CPUの賭け技",
      flavor_text: "賭ける！",
      animation_hint: "突進",
      basePower: difficulty === "HARD" ? 35 : 25,
      selfDamageReduction: 0.1,
    },
  };
};

const STAGES: StageId[] = ["STREET", "DOJO", "ROOFTOP"];

export const PhaserGame = ({
  myCharacter,
  mode,
  mySlot,
  difficulty = "NORMAL",
  remoteOpponent,
  roomCode,
  stage,
  onFinish,
}: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [chosenStage, setChosenStage] = useState<StageId | null>(stage ?? null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!chosenStage) return;
    if (gameRef.current) return;

    const opponentCharacter: Character =
      mode === "ai"
        ? buildAiCharacter(myCharacter, difficulty)
        : remoteOpponent
        ? {
            name: remoteOpponent.name,
            photoUrl: remoteOpponent.photoUrl,
            personality: { appearance: "", hobby: "", job: "" },
            moves: remoteOpponent.moves,
            gamblingMove: remoteOpponent.gamblingMove,
          }
        : buildAiCharacter(myCharacter, difficulty);

    const p1Char = mySlot === "player1" ? myCharacter : opponentCharacter;
    const p2Char = mySlot === "player1" ? opponentCharacter : myCharacter;

    const isOnline = mode === "online" && !!roomCode;
    const opponentSlot: "player1" | "player2" =
      mySlot === "player1" ? "player2" : "player1";

    const battleInput: BattleSceneInput = {
      p1: {
        name: p1Char.name,
        moves: p1Char.moves,
        gamblingMove: p1Char.gamblingMove,
        hasPhoto: !!p1Char.photoUrl,
      },
      p2: {
        name: p2Char.name,
        moves: p2Char.moves,
        gamblingMove: p2Char.gamblingMove,
        hasPhoto: !!p2Char.photoUrl,
      },
      stage: chosenStage,
      mode,
      difficulty,
      mySlot,
      onFinish: (winner, finalHp) => {
        const p1State = characterToPlayerState(p1Char);
        const p2State = characterToPlayerState(p2Char);
        p1State.hp = finalHp.p1;
        p2State.hp = finalHp.p2;
        onFinish(winner, p1State, p2State);
      },
      onLocalAction: isOnline
        ? (action: NetAction) => {
            void pushNetAction(roomCode, mySlot, action).catch((e) =>
              console.warn("netAction push failed", e)
            );
          }
        : undefined,
    };

    const game = new Phaser.Game(
      buildGameConfig(containerRef.current, [])
    );

    game.scene.add("Boot", BootScene);
    game.scene.add("Battle", BattleScene);

    game.registry.set("battleInput", battleInput);

    game.scene.start("Boot", {
      player1Photo: p1Char.photoUrl || null,
      player2Photo: p2Char.photoUrl || null,
    });

    gameRef.current = game;

    let unsubNet: (() => void) | undefined;
    if (isOnline) {
      // 既存ノイズをクリアしてから購読
      void clearNetActions(roomCode);
      unsubNet = subscribeNetActions(roomCode, opponentSlot, (action) => {
        const battle = game.scene.getScene("Battle") as BattleScene | undefined;
        if (battle && (battle as any).applyRemoteAction) {
          battle.applyRemoteAction(action);
        }
      });
    }

    return () => {
      unsubNet?.();
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, [chosenStage, myCharacter, mode, mySlot, difficulty, remoteOpponent, roomCode, onFinish]);

  if (!chosenStage) {
    return <StagePicker onPick={setChosenStage} />;
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div
        ref={containerRef}
        className="w-full"
        style={{ maxWidth: "100vw", maxHeight: "100vh" }}
      />
    </div>
  );
};

const STAGE_LABELS: Record<StageId, { name: string; desc: string; color: string }> = {
  STREET: { name: "STREET", desc: "夜の路地裏・ネオン", color: "from-purple-600 to-pink-600" },
  DOJO: { name: "DOJO", desc: "和風道場・木目床", color: "from-amber-600 to-red-600" },
  ROOFTOP: { name: "ROOFTOP", desc: "夕焼けの屋上", color: "from-orange-500 to-red-500" },
};

const StagePicker = ({ onPick }: { onPick: (id: StageId) => void }) => (
  <div className="min-h-screen bg-gradient-to-b from-slate-900 to-purple-900 text-white p-4 flex flex-col items-center justify-center">
    <h2 className="text-3xl font-bold mb-8">ステージ選択</h2>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full">
      {STAGES.map((id) => (
        <button
          key={id}
          onClick={() => onPick(id)}
          className={`bg-gradient-to-br ${STAGE_LABELS[id].color} hover:brightness-110 rounded-2xl p-6 border-2 border-white/30 text-left aspect-video`}
        >
          <p className="text-3xl font-black mb-2">{STAGE_LABELS[id].name}</p>
          <p className="text-sm opacity-90">{STAGE_LABELS[id].desc}</p>
        </button>
      ))}
    </div>
  </div>
);
