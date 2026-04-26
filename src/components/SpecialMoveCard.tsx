import type { Move, GamblingMove } from "../types/game";

interface Props {
  move?: Move;
  gamblingMove?: GamblingMove;
}

export const SpecialMoveCard = ({ move, gamblingMove }: Props) => {
  if (move) {
    const typeLabel =
      move.type === "melee" ? "近接" : move.type === "ranged" ? "遠距離" : "範囲";
    return (
      <div className="bg-slate-800/70 rounded-xl p-4 border border-purple-500/40">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-purple-300">{typeLabel}</p>
            <h3 className="font-bold text-lg text-white">{move.name}</h3>
            <p className="text-sm text-purple-100">{move.description}</p>
            <p className="text-xs text-purple-300 mt-1">「{move.flavor_text}」</p>
          </div>
          <div className="text-right text-sm space-y-1">
            <div className="text-yellow-300 font-bold">威力 {move.power}</div>
            <div className="text-blue-300">CD {move.cooldown.toFixed(1)}秒</div>
          </div>
        </div>
      </div>
    );
  }
  if (gamblingMove) {
    return (
      <div className="bg-yellow-900/40 rounded-xl p-4 border border-yellow-500/50">
        <p className="text-xs text-yellow-300">賭け技</p>
        <h3 className="font-bold text-lg text-white">{gamblingMove.name}</h3>
        <p className="text-sm text-yellow-100">{gamblingMove.description}</p>
        <p className="text-xs text-yellow-200 mt-1">「{gamblingMove.flavor_text}」</p>
        <div className="flex gap-3 mt-2 text-sm">
          <span className="text-yellow-300">基礎威力 {gamblingMove.basePower.toFixed(0)}</span>
          <span className="text-green-300">自爆軽減 {(gamblingMove.selfDamageReduction * 100).toFixed(0)}%</span>
        </div>
      </div>
    );
  }
  return null;
};
