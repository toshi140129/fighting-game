import { useState } from "react";
import type { CharacterPersonality, Move, GamblingMove } from "../types/game";
import { useSpecialMoves } from "../hooks/useSpecialMoves";
import { SpecialMoveCard } from "./SpecialMoveCard";

interface Props {
  characterName: string;
  photoUrl: string;
  onComplete: (data: {
    personality: CharacterPersonality;
    moves: Move[];
    gamblingMove: GamblingMove;
  }) => void;
  onBack: () => void;
}

export const PersonalityInput = ({ characterName, photoUrl, onComplete, onBack }: Props) => {
  const [appearance, setAppearance] = useState("");
  const [hobby, setHobby] = useState("");
  const [job, setJob] = useState("");
  const [step, setStep] = useState<"input" | "allocate" | "preview">("input");

  const [movePoints, setMovePoints] = useState<[number, number, number]>([20, 25, 25]);
  const [gamblingBase, setGamblingBase] = useState(20);
  const [gamblingReduction, setGamblingReduction] = useState(10);
  const [customNames, setCustomNames] = useState<string[]>(["", "", ""]);
  const [customGamblingName, setCustomGamblingName] = useState("");

  const { generated, loading, error, generate, finalize } = useSpecialMoves();

  const totalMovePoints = movePoints[0] + movePoints[1] + movePoints[2];
  const totalGamblingPoints = gamblingBase + gamblingReduction;

  const handleGenerate = async () => {
    const personality: CharacterPersonality = { appearance, hobby, job };
    try {
      await generate(personality);
      setStep("allocate");
    } catch {
      // error displayed below
    }
  };

  const handleConfirm = () => {
    const personality: CharacterPersonality = { appearance, hobby, job };
    const result = finalize({
      movePoints,
      gamblingBase,
      gamblingReduction,
      customMoveNames: customNames,
      customGamblingName,
    });
    if (result) {
      onComplete({ personality, ...result });
    }
  };

  const updateMovePoint = (idx: number, value: number) => {
    const newPoints = [...movePoints] as [number, number, number];
    newPoints[idx] = value;
    if (newPoints[0] + newPoints[1] + newPoints[2] <= 70) {
      setMovePoints(newPoints);
    }
  };

  if (step === "input") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-purple-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          <button onClick={onBack} className="text-purple-300 mb-4">← 戻る</button>
          <div className="bg-slate-800/60 rounded-2xl p-6 border border-purple-500/30">
            <div className="flex items-center gap-4 mb-6">
              <img src={photoUrl} alt={characterName} className="w-16 h-16 rounded-full object-cover border-2 border-purple-400" />
              <h2 className="text-2xl font-bold">{characterName} の必殺技を作る</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-purple-200 mb-1">特徴・外見</label>
                <input
                  className="w-full bg-slate-900/80 border border-purple-500/40 rounded-lg px-3 py-2"
                  placeholder="例：出っ歯、天然パーマ、筋肉質"
                  value={appearance}
                  onChange={(e) => setAppearance(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-purple-200 mb-1">得意なこと・趣味</label>
                <input
                  className="w-full bg-slate-900/80 border border-purple-500/40 rounded-lg px-3 py-2"
                  placeholder="例：サッカー、農業機械の設計"
                  value={hobby}
                  onChange={(e) => setHobby(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-purple-200 mb-1">職業・肩書</label>
                <input
                  className="w-full bg-slate-900/80 border border-purple-500/40 rounded-lg px-3 py-2"
                  placeholder="例：エンジニア、学生、農家"
                  value={job}
                  onChange={(e) => setJob(e.target.value)}
                />
              </div>
            </div>

            {error && <p className="text-red-400 mt-4">{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={loading || (!appearance && !hobby && !job)}
              className="w-full mt-6 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg py-3 font-bold text-lg"
            >
              {loading ? "AIが必殺技を考案中..." : "必殺技を生成する"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "allocate" && generated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-purple-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setStep("input")} className="text-purple-300 mb-4">← 戻る</button>
          <h2 className="text-2xl font-bold mb-2">ポイント配分</h2>
          <p className="text-purple-200 text-sm mb-6">通常技に70pt以内、賭け技に残り30pt</p>

          <div className="space-y-4">
            {generated.moves.map((m, i) => (
              <div key={i} className="bg-slate-800/60 rounded-xl p-4 border border-purple-500/30">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs text-purple-300">{m.type === "melee" ? "近接" : m.type === "ranged" ? "遠距離" : "範囲"}</p>
                    <h3 className="font-bold text-lg">{m.name}</h3>
                    <p className="text-sm text-purple-100">{m.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-yellow-300">{movePoints[i]}pt</p>
                  </div>
                </div>
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={movePoints[i]}
                  onChange={(e) => updateMovePoint(i, Number(e.target.value))}
                  className="w-full"
                />
                <input
                  type="text"
                  placeholder="技名を変更（任意）"
                  className="w-full mt-2 bg-slate-900/80 border border-purple-500/40 rounded px-2 py-1 text-sm"
                  value={customNames[i]}
                  onChange={(e) => {
                    const next = [...customNames];
                    next[i] = e.target.value;
                    setCustomNames(next);
                  }}
                />
              </div>
            ))}

            <p className={`text-right text-sm ${totalMovePoints > 70 ? "text-red-400" : "text-purple-200"}`}>
              通常技合計: {totalMovePoints} / 70pt
            </p>

            <div className="bg-yellow-900/40 rounded-xl p-4 border border-yellow-500/40">
              <p className="text-xs text-yellow-300">賭け技</p>
              <h3 className="font-bold text-lg">{generated.gambling_move.name}</h3>
              <p className="text-sm text-yellow-100 mb-3">{generated.gambling_move.description}</p>

              <div className="mb-2">
                <div className="flex justify-between text-sm">
                  <span>基礎威力</span>
                  <span>{gamblingBase}pt</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={30}
                  value={gamblingBase}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v + gamblingReduction <= 30) setGamblingBase(v);
                  }}
                  className="w-full"
                />
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span>自爆軽減</span>
                  <span>{gamblingReduction}pt</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={25}
                  value={gamblingReduction}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v + gamblingBase <= 30) setGamblingReduction(v);
                  }}
                  className="w-full"
                />
              </div>
              <input
                type="text"
                placeholder="賭け技名を変更（任意）"
                className="w-full mt-2 bg-slate-900/80 border border-yellow-500/40 rounded px-2 py-1 text-sm"
                value={customGamblingName}
                onChange={(e) => setCustomGamblingName(e.target.value)}
              />
              <p className={`text-right text-sm mt-2 ${totalGamblingPoints > 30 ? "text-red-400" : "text-yellow-200"}`}>
                賭け技合計: {totalGamblingPoints} / 30pt
              </p>
            </div>
          </div>

          <button
            onClick={() => setStep("preview")}
            disabled={totalMovePoints > 70 || totalGamblingPoints > 30}
            className="w-full mt-6 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg py-3 font-bold text-lg"
          >
            プレビュー
          </button>
        </div>
      </div>
    );
  }

  if (step === "preview" && generated) {
    const result = finalize({
      movePoints,
      gamblingBase,
      gamblingReduction,
      customMoveNames: customNames,
      customGamblingName,
    });
    if (!result) return null;
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-purple-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => setStep("allocate")} className="text-purple-300 mb-4">← 戻る</button>
          <h2 className="text-2xl font-bold mb-4">最終確認</h2>
          <div className="space-y-3">
            {result.moves.map((m) => (
              <SpecialMoveCard key={m.id} move={m} />
            ))}
            <SpecialMoveCard gamblingMove={result.gamblingMove} />
          </div>
          <button
            onClick={handleConfirm}
            className="w-full mt-6 bg-green-600 hover:bg-green-500 rounded-lg py-3 font-bold text-lg"
          >
            このキャラで確定
          </button>
        </div>
      </div>
    );
  }

  return null;
};
