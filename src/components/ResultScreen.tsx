import { useEffect, useState } from "react";
import type { PlayerState, Winner } from "../types/game";
import { generateBattleCommentary } from "../lib/claudeApi";
import { AdBanner } from "./AdBanner";

interface Props {
  winner: Winner;
  player1: PlayerState;
  player2: PlayerState;
  mySlot: "player1" | "player2";
  onRetry: () => void;
  onHome: () => void;
}

export const ResultScreen = ({ winner, player1, player2, mySlot, onRetry, onHome }: Props) => {
  const [commentary, setCommentary] = useState("実況を生成中...");
  const [showAd, setShowAd] = useState(true);
  const [skipCount, setSkipCount] = useState(5);

  const isDraw = winner === "draw";
  const winPlayer = winner === "player1" ? player1 : winner === "player2" ? player2 : player1;
  const losePlayer = winner === "player1" ? player2 : winner === "player2" ? player1 : player2;
  const myWin = !isDraw && winner === mySlot;

  useEffect(() => {
    let cancelled = false;
    generateBattleCommentary(winPlayer.name, losePlayer.name, winPlayer.hp, isDraw).then((text) => {
      if (!cancelled) setCommentary(text);
    });
    return () => {
      cancelled = true;
    };
  }, [winPlayer.name, losePlayer.name, winPlayer.hp, isDraw]);

  useEffect(() => {
    if (!showAd) return;
    const t = setInterval(() => setSkipCount((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [showAd]);

  if (showAd) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <p className="text-purple-300 mb-4">広告</p>
        <div className="w-full max-w-md">
          <AdBanner position="interstitial" />
        </div>
        <button
          onClick={() => setShowAd(false)}
          disabled={skipCount > 0}
          className="mt-6 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded px-6 py-2"
        >
          {skipCount > 0 ? `スキップ（${skipCount}）` : "結果を見る"}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-black to-slate-900 text-white p-4">
      <div className="max-w-md mx-auto pt-12 text-center">
        <h1
          className={`text-6xl font-black mb-6 ${
            isDraw ? "text-gray-300" : myWin ? "text-yellow-300" : "text-red-400"
          }`}
        >
          {isDraw ? "DRAW" : myWin ? "WIN!!" : "LOSE..."}
        </h1>

        <div className="flex justify-center gap-6 mb-6">
          <PlayerCard player={player1} highlight={winner === "player1"} />
          <PlayerCard player={player2} highlight={winner === "player2"} />
        </div>

        <div className="bg-slate-800/70 rounded-2xl p-4 border border-purple-500/40 mb-6">
          <p className="text-xs text-purple-300 mb-2">AI実況</p>
          <p className="text-base">{commentary}</p>
        </div>

        <div className="space-y-2">
          <button
            onClick={onRetry}
            className="w-full bg-purple-600 hover:bg-purple-500 rounded-lg py-3 font-bold"
          >
            もう一戦
          </button>
          <button
            onClick={onHome}
            className="w-full bg-slate-700 hover:bg-slate-600 rounded-lg py-3 font-bold"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    </div>
  );
};

const PlayerCard = ({ player, highlight }: { player: PlayerState; highlight: boolean }) => (
  <div className={`text-center ${highlight ? "scale-110" : "opacity-60"} transition-all`}>
    {player.photoUrl ? (
      <img
        src={player.photoUrl}
        alt={player.name}
        className={`w-24 h-24 rounded-full object-cover border-4 ${
          highlight ? "border-yellow-300" : "border-slate-500"
        }`}
      />
    ) : (
      <div
        className={`w-24 h-24 rounded-full bg-slate-700 border-4 ${
          highlight ? "border-yellow-300" : "border-slate-500"
        } flex items-center justify-center font-bold`}
      >
        CPU
      </div>
    )}
    <p className="mt-2 text-sm truncate w-24">{player.name}</p>
    <p className="text-xs text-purple-300">HP {player.hp}</p>
  </div>
);
