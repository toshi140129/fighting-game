import { useState } from "react";
import { UploadScreen } from "./components/UploadScreen";
import { PersonalityInput } from "./components/PersonalityInput";
import { Matchmaking } from "./components/Matchmaking";
import { PhaserGame } from "./game/PhaserGame";
import { ResultScreen } from "./components/ResultScreen";
import type {
  Character,
  CharacterPersonality,
  GameMode,
  Difficulty,
  Move,
  GamblingMove,
  PlayerState,
  Winner,
} from "./types/game";
import "./App.css";

type Stage =
  | { name: "title" }
  | { name: "upload" }
  | { name: "personality"; partial: { name: string; photoUrl: string } }
  | { name: "matchmaking"; character: Character }
  | {
      name: "battle";
      character: Character;
      mode: GameMode;
      roomCode: string;
      slot: "player1" | "player2";
      difficulty?: Difficulty;
      remoteOpponent?: PlayerState | null;
    }
  | {
      name: "result";
      character: Character;
      winner: Winner;
      player1: PlayerState;
      player2: PlayerState;
      slot: "player1" | "player2";
      mode: GameMode;
      roomCode: string;
      difficulty?: Difficulty;
    };

function App() {
  const [stage, setStage] = useState<Stage>({ name: "title" });

  if (stage.name === "title") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 via-slate-900 to-black text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-5xl font-black text-center mb-2 bg-gradient-to-r from-yellow-300 to-red-500 bg-clip-text text-transparent">
          俺の必殺技
        </h1>
        <p className="text-purple-200 text-center mb-12">写真と個性で作る格闘ゲーム</p>
        <button
          onClick={() => setStage({ name: "upload" })}
          className="bg-gradient-to-r from-purple-600 to-red-600 hover:brightness-110 rounded-2xl px-12 py-5 text-2xl font-black border-2 border-yellow-300/50 shadow-2xl"
        >
          START
        </button>
        <p className="text-xs text-slate-500 mt-12">v0.1 - Phase1 Web</p>
      </div>
    );
  }

  if (stage.name === "upload") {
    return (
      <UploadScreen
        onNext={(data) => setStage({ name: "personality", partial: data })}
      />
    );
  }

  if (stage.name === "personality") {
    return (
      <PersonalityInput
        characterName={stage.partial.name}
        photoUrl={stage.partial.photoUrl}
        onBack={() => setStage({ name: "upload" })}
        onComplete={({
          personality,
          moves,
          gamblingMove,
        }: {
          personality: CharacterPersonality;
          moves: Move[];
          gamblingMove: GamblingMove;
        }) => {
          const character: Character = {
            name: stage.partial.name,
            photoUrl: stage.partial.photoUrl,
            personality,
            moves,
            gamblingMove,
          };
          setStage({ name: "matchmaking", character });
        }}
      />
    );
  }

  if (stage.name === "matchmaking") {
    return (
      <Matchmaking
        character={stage.character}
        onBack={() => setStage({ name: "title" })}
        onStartBattle={({ mode, roomCode, slot, difficulty, remoteOpponent }) => {
          setStage({
            name: "battle",
            character: stage.character,
            mode,
            roomCode,
            slot,
            difficulty,
            remoteOpponent,
          });
        }}
      />
    );
  }

  if (stage.name === "battle") {
    return (
      <PhaserGame
        myCharacter={stage.character}
        mode={stage.mode}
        mySlot={stage.slot}
        difficulty={stage.difficulty}
        roomCode={stage.roomCode}
        remoteOpponent={stage.remoteOpponent}
        onFinish={(winner, p1, p2) => {
          setStage({
            name: "result",
            character: stage.character,
            winner,
            player1: p1,
            player2: p2,
            slot: stage.slot,
            mode: stage.mode,
            roomCode: stage.roomCode,
            difficulty: stage.difficulty,
          });
        }}
      />
    );
  }

  if (stage.name === "result") {
    return (
      <ResultScreen
        winner={stage.winner}
        player1={stage.player1}
        player2={stage.player2}
        mySlot={stage.slot}
        onRetry={() =>
          setStage({
            name: "battle",
            character: stage.character,
            mode: stage.mode,
            roomCode: stage.roomCode,
            slot: stage.slot,
            difficulty: stage.difficulty,
          })
        }
        onHome={() => setStage({ name: "title" })}
      />
    );
  }

  return null;
}

export default App;
