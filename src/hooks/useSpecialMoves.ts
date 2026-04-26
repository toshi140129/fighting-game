import { useState } from "react";
import {
  generateSpecialMoves,
  buildMovesFromGenerated,
  buildGamblingMoveFromGenerated,
  type GeneratedMoveData,
} from "../lib/claudeApi";
import type { CharacterPersonality, Move, GamblingMove } from "../types/game";

export interface MoveAllocation {
  movePoints: [number, number, number];
  gamblingBase: number;
  gamblingReduction: number;
  customMoveNames: string[];
  customGamblingName: string;
}

export const useSpecialMoves = () => {
  const [generated, setGenerated] = useState<GeneratedMoveData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (personality: CharacterPersonality) => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateSpecialMoves(personality);
      setGenerated(data);
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "生成に失敗しました";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const finalize = (
    allocation: MoveAllocation
  ): { moves: Move[]; gamblingMove: GamblingMove } | null => {
    if (!generated) return null;
    const moves = buildMovesFromGenerated(
      generated,
      allocation.movePoints,
      allocation.customMoveNames
    );
    const gamblingMove = buildGamblingMoveFromGenerated(
      generated,
      allocation.gamblingBase,
      allocation.gamblingReduction,
      allocation.customGamblingName
    );
    return { moves, gamblingMove };
  };

  return { generated, loading, error, generate, finalize };
};
