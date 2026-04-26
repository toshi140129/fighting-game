import { useState, useEffect } from "react";
import type { Character, GameMode, Difficulty } from "../types/game";
import {
  isFirebaseConfigured,
  ensureAnonymousAuth,
  createRoom,
  setPlayerData,
  subscribeRoom,
  generateRoomCode,
  updateRoomStatus,
} from "../lib/firebase";
import type { PlayerState } from "../types/game";

interface Props {
  character: Character;
  onStartBattle: (params: {
    mode: GameMode;
    roomCode: string;
    slot: "player1" | "player2";
    difficulty?: Difficulty;
    remoteOpponent?: PlayerState | null;
  }) => void;
  onBack: () => void;
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

export const Matchmaking = ({ character, onStartBattle, onBack }: Props) => {
  const [mode, setMode] = useState<"select" | "host" | "join" | "ai">("select");
  const [roomCode, setRoomCode] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [waitingMessage, setWaitingMessage] = useState("相手を待っています...");
  const [difficulty, setDifficulty] = useState<Difficulty>("NORMAL");

  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    if (mode !== "host" || !roomCode) return;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        await ensureAnonymousAuth();
        await createRoom(roomCode);
        await setPlayerData(roomCode, "player1", characterToPlayerState(character));
        let started = false;
        unsub = subscribeRoom(roomCode, (data) => {
          if (started) return;
          if (data?.player2) {
            started = true;
            setWaitingMessage("相手が入室しました！開始します...");
            updateRoomStatus(roomCode, "fighting").then(() => {
              onStartBattle({
                mode: "online",
                roomCode,
                slot: "player1",
                remoteOpponent: data.player2,
              });
            });
          }
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "ルーム作成失敗");
      }
    })();
    return () => unsub?.();
  }, [mode, roomCode, character, onStartBattle]);

  const handleHost = () => {
    if (!firebaseReady) {
      setError("Firebase未設定です。.env.localを設定してください");
      return;
    }
    setRoomCode(generateRoomCode());
    setMode("host");
  };

  const handleJoin = async () => {
    if (!firebaseReady) {
      setError("Firebase未設定です");
      return;
    }
    if (!/^\d{4}$/.test(inputCode)) {
      setError("4桁のルームコードを入力してください");
      return;
    }
    try {
      await ensureAnonymousAuth();
      await setPlayerData(inputCode, "player2", characterToPlayerState(character));
      // 一度ルームの最新状態を読み取って player1 のキャラデータを取得
      const opponent = await new Promise<PlayerState | null>((resolve) => {
        const timeout = setTimeout(() => resolve(null), 5000);
        const off = subscribeRoom(inputCode, (data) => {
          if (data?.player1) {
            clearTimeout(timeout);
            off();
            resolve(data.player1);
          }
        });
      });
      await updateRoomStatus(inputCode, "fighting");
      onStartBattle({
        mode: "online",
        roomCode: inputCode,
        slot: "player2",
        remoteOpponent: opponent,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "入室に失敗しました");
    }
  };

  const handleAi = () => {
    onStartBattle({ mode: "ai", roomCode: "ai-local", slot: "player1", difficulty });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-purple-900 text-white p-4">
      <div className="max-w-md mx-auto">
        <button onClick={onBack} className="text-purple-300 mb-4">← 戻る</button>

        {mode === "select" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">対戦モード選択</h2>
            <button
              onClick={handleHost}
              className="w-full bg-purple-600 hover:bg-purple-500 rounded-xl py-6 text-left px-6 border border-purple-400"
            >
              <p className="font-bold text-xl">🏠 ルームを作る</p>
              <p className="text-sm text-purple-200">友達にコードを送って対戦</p>
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full bg-blue-600 hover:bg-blue-500 rounded-xl py-6 text-left px-6 border border-blue-400"
            >
              <p className="font-bold text-xl">🚪 ルームに入る</p>
              <p className="text-sm text-blue-200">受け取ったコードを入力</p>
            </button>
            <button
              onClick={() => setMode("ai")}
              className="w-full bg-red-600 hover:bg-red-500 rounded-xl py-6 text-left px-6 border border-red-400"
            >
              <p className="font-bold text-xl">🤖 CPUと対戦</p>
              <p className="text-sm text-red-200">AIキャラと一人プレイ</p>
            </button>
            {error && <p className="text-red-400">{error}</p>}
          </div>
        )}

        {mode === "host" && (
          <div className="bg-slate-800/60 rounded-2xl p-6 border border-purple-500/30 text-center">
            <p className="text-purple-200 mb-2">ルームコード</p>
            <p className="text-6xl font-bold tracking-widest text-yellow-300 mb-4">{roomCode}</p>
            <p className="text-sm text-purple-100 mb-4">このコードを友達に送ろう</p>
            <button
              onClick={() => navigator.clipboard.writeText(roomCode)}
              className="bg-purple-600 hover:bg-purple-500 rounded-lg px-4 py-2 mb-4"
            >
              コードをコピー
            </button>
            <p className="text-purple-300 animate-pulse">{waitingMessage}</p>
            {error && <p className="text-red-400 mt-4">{error}</p>}
          </div>
        )}

        {mode === "join" && (
          <div className="bg-slate-800/60 rounded-2xl p-6 border border-purple-500/30">
            <h3 className="text-xl font-bold mb-4">ルームコードを入力</h3>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ""))}
              className="w-full bg-slate-900/80 border border-purple-500/40 rounded-lg px-4 py-4 text-3xl text-center tracking-widest"
              placeholder="0000"
            />
            {error && <p className="text-red-400 mt-2">{error}</p>}
            <button
              onClick={handleJoin}
              disabled={inputCode.length !== 4}
              className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg py-3 font-bold"
            >
              入室する
            </button>
          </div>
        )}

        {mode === "ai" && (
          <div className="bg-slate-800/60 rounded-2xl p-6 border border-red-500/30">
            <h3 className="text-xl font-bold mb-4">難易度を選んでスタート</h3>
            <div className="space-y-2">
              {(["EASY", "NORMAL", "HARD"] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`w-full rounded-lg py-3 font-bold border ${
                    difficulty === d
                      ? "bg-red-600 border-red-300"
                      : "bg-slate-900/60 border-red-500/40"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <button
              onClick={handleAi}
              className="w-full mt-4 bg-red-600 hover:bg-red-500 rounded-lg py-3 font-bold text-lg"
            >
              戦闘開始！
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
