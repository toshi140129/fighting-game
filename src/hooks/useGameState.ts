import { useEffect, useReducer, useRef } from "react";
import type {
  PlayerState,
  ActionType,
  GambleResult,
  Move,
  Winner,
  Difficulty,
} from "../types/game";

const BATTLE_DURATION_MS = 60000;

export interface BattleState {
  player1: PlayerState;
  player2: PlayerState;
  startedAt: number;
  endsAt: number;
  isOver: boolean;
  winner: Winner | null;
  log: BattleLogEntry[];
}

export interface BattleLogEntry {
  id: number;
  attacker: "player1" | "player2";
  text: string;
  damage?: number;
  gamble?: GambleResult;
  timestamp: number;
}

type Side = "player1" | "player2";

type Action =
  | { type: "INIT"; player1: PlayerState; player2: PlayerState }
  | { type: "ATTACK"; attacker: Side; action: ActionType; damage: number; logText: string }
  | { type: "GAMBLE"; attacker: Side; result: GambleResult; damage: number; selfDamage: number; logText: string }
  | { type: "GUARD"; attacker: Side }
  | { type: "TICK"; now: number }
  | { type: "FINISH"; winner: Winner };

let logId = 0;

const cloneState = (s: BattleState): BattleState => ({
  ...s,
  player1: { ...s.player1, cooldowns: { ...s.player1.cooldowns }, actions: [...s.player1.actions] },
  player2: { ...s.player2, cooldowns: { ...s.player2.cooldowns }, actions: [...s.player2.actions] },
  log: [...s.log],
});

const reducer = (state: BattleState, action: Action): BattleState => {
  if (action.type === "INIT") {
    const now = Date.now();
    return {
      player1: action.player1,
      player2: action.player2,
      startedAt: now,
      endsAt: now + BATTLE_DURATION_MS,
      isOver: false,
      winner: null,
      log: [],
    };
  }

  if (action.type === "ATTACK") {
    const next = cloneState(state);
    const defender = action.attacker === "player1" ? "player2" : "player1";
    const isGuarding = next[defender].actions[next[defender].actions.length - 1]?.type === "guard"
      && Date.now() - (next[defender].actions[next[defender].actions.length - 1]?.timestamp ?? 0) < 800;
    const finalDamage = isGuarding ? Math.round(action.damage * 0.15) : action.damage;
    next[defender].hp = Math.max(0, next[defender].hp - finalDamage);
    next[action.attacker].actions.push({
      type: action.action,
      timestamp: Date.now(),
      damage: finalDamage,
    });
    next.log.push({
      id: ++logId,
      attacker: action.attacker,
      text: action.logText + (isGuarding ? "（ガード！）" : ""),
      damage: finalDamage,
      timestamp: Date.now(),
    });
    if (next[defender].hp <= 0) {
      next.isOver = true;
      next.winner = action.attacker;
    }
    return next;
  }

  if (action.type === "GAMBLE") {
    const next = cloneState(state);
    const defender = action.attacker === "player1" ? "player2" : "player1";
    next[defender].hp = Math.max(0, next[defender].hp - action.damage);
    next[action.attacker].hp = Math.max(0, next[action.attacker].hp - action.selfDamage);
    next[action.attacker].gamblingUsesLeft -= 1;
    next[action.attacker].gamblingCooldownEnd = Date.now() + 20000;
    if (action.result === "JACKPOT") {
      next[defender].isStunned = true;
      next[defender].stunnedUntil = Date.now() + 1000;
    }
    next[action.attacker].actions.push({
      type: "gambling",
      timestamp: Date.now(),
      damage: action.damage,
      gambleResult: action.result,
    });
    next.log.push({
      id: ++logId,
      attacker: action.attacker,
      text: action.logText,
      damage: action.damage,
      gamble: action.result,
      timestamp: Date.now(),
    });
    if (next[defender].hp <= 0 || next[action.attacker].hp <= 0) {
      next.isOver = true;
      if (next[defender].hp <= 0 && next[action.attacker].hp <= 0) {
        next.winner = "draw";
      } else if (next[defender].hp <= 0) {
        next.winner = action.attacker;
      } else {
        next.winner = defender;
      }
    }
    return next;
  }

  if (action.type === "GUARD") {
    const next = cloneState(state);
    next[action.attacker].actions.push({ type: "guard", timestamp: Date.now() });
    return next;
  }

  if (action.type === "TICK") {
    if (state.isOver) return state;
    if (action.now >= state.endsAt) {
      const next = cloneState(state);
      next.isOver = true;
      if (next.player1.hp > next.player2.hp) next.winner = "player1";
      else if (next.player2.hp > next.player1.hp) next.winner = "player2";
      else next.winner = "draw";
      return next;
    }
    return state;
  }

  if (action.type === "FINISH") {
    return { ...state, isOver: true, winner: action.winner };
  }

  return state;
};

const emptyPlayer = (): PlayerState => ({
  name: "",
  photoUrl: "",
  hp: 100,
  moves: [],
  gamblingMove: { name: "", description: "", flavor_text: "", animation_hint: "", basePower: 30, selfDamageReduction: 0 },
  cooldowns: {},
  gamblingUsesLeft: 2,
  gamblingCooldownEnd: 0,
  isStunned: false,
  stunnedUntil: 0,
  actions: [],
});

const initialState: BattleState = {
  player1: emptyPlayer(),
  player2: emptyPlayer(),
  startedAt: 0,
  endsAt: 0,
  isOver: false,
  winner: null,
  log: [],
};

export const rollGamble = (): GambleResult => {
  const r = Math.random();
  if (r < 0.1) return "JACKPOT";
  if (r < 0.4) return "HIT";
  if (r < 0.7) return "OK";
  if (r < 0.9) return "MISS";
  return "BACKFIRE";
};

export const calculateGambleDamage = (
  basePower: number,
  result: GambleResult,
  selfReduction: number
): { damage: number; selfDamage: number } => {
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
};

export const useGameState = (
  player1: PlayerState | null,
  player2: PlayerState | null
) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const initialized = useRef(false);

  useEffect(() => {
    if (player1 && player2 && !initialized.current) {
      initialized.current = true;
      dispatch({ type: "INIT", player1, player2 });
    }
  }, [player1, player2]);

  useEffect(() => {
    if (!state.startedAt || state.isOver) return;
    const interval = setInterval(() => {
      dispatch({ type: "TICK", now: Date.now() });
    }, 200);
    return () => clearInterval(interval);
  }, [state.startedAt, state.isOver]);

  const performBasicAttack = (attacker: Side, kind: "punch" | "kick") => {
    if (state.isOver) return;
    const damage =
      kind === "punch"
        ? 8 + Math.floor(Math.random() * 8)
        : 12 + Math.floor(Math.random() * 11);
    dispatch({
      type: "ATTACK",
      attacker,
      action: kind,
      damage,
      logText: kind === "punch" ? "パンチ！" : "キック！",
    });
  };

  const performGuard = (attacker: Side) => {
    dispatch({ type: "GUARD", attacker });
  };

  const performSpecial = (attacker: Side, moveIndex: number) => {
    if (state.isOver) return;
    const move: Move | undefined = state[attacker].moves[moveIndex];
    if (!move) return;
    const cdEnd = state[attacker].cooldowns[move.id] ?? 0;
    if (Date.now() < cdEnd) return;
    state[attacker].cooldowns[move.id] = Date.now() + move.cooldown * 1000;
    dispatch({
      type: "ATTACK",
      attacker,
      action: `special${moveIndex + 1}` as ActionType,
      damage: move.power,
      logText: `${move.name}「${move.flavor_text}」`,
    });
  };

  const performGamble = (attacker: Side): GambleResult | null => {
    if (state.isOver) return null;
    if (state[attacker].gamblingUsesLeft <= 0) return null;
    if (Date.now() < state[attacker].gamblingCooldownEnd) return null;

    const result = rollGamble();
    const gm = state[attacker].gamblingMove;
    const { damage, selfDamage } = calculateGambleDamage(
      gm.basePower,
      result,
      gm.selfDamageReduction
    );
    const labelMap: Record<GambleResult, string> = {
      JACKPOT: "JACKPOT!!",
      HIT: "HIT!!",
      OK: "OK",
      MISS: "MISS...",
      BACKFIRE: "BACKFIRE!!",
    };
    dispatch({
      type: "GAMBLE",
      attacker,
      result,
      damage,
      selfDamage,
      logText: `${gm.name} → ${labelMap[result]}`,
    });
    return result;
  };

  return {
    state,
    performBasicAttack,
    performGuard,
    performSpecial,
    performGamble,
    timeLeftMs: Math.max(0, state.endsAt - Date.now()),
  };
};

export const aiNextAction = (
  difficulty: Difficulty,
  ai: PlayerState,
  opponent: PlayerState
): { kind: "basic" | "special" | "gamble" | "guard"; index?: number } => {
  void opponent;
  const useGamble =
    difficulty === "EASY"
      ? false
      : difficulty === "NORMAL"
      ? Math.random() < 0.1 && ai.gamblingUsesLeft > 0
      : Math.random() < 0.3 && ai.gamblingUsesLeft > 0;

  if (useGamble && Date.now() >= ai.gamblingCooldownEnd) {
    return { kind: "gamble" };
  }

  const availableSpecials = ai.moves
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => Date.now() >= (ai.cooldowns[m.id] ?? 0));
  if (availableSpecials.length > 0 && Math.random() < 0.5) {
    const pick = availableSpecials[Math.floor(Math.random() * availableSpecials.length)];
    return { kind: "special", index: pick.i };
  }

  if (Math.random() < 0.15) return { kind: "guard" };
  return { kind: "basic", index: Math.random() < 0.5 ? 0 : 1 };
};

export const aiActionInterval = (difficulty: Difficulty): number => {
  switch (difficulty) {
    case "EASY":
      return 2500;
    case "NORMAL":
      return 1800;
    case "HARD":
      return 1200;
  }
};
