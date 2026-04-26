export type MoveType = "melee" | "ranged" | "area";

export interface Move {
  id: string;
  name: string;
  description: string;
  animation_hint: string;
  type: MoveType;
  flavor_text: string;
  power: number;
  cooldown: number;
  range: "short" | "long";
  pointsAllocated: number;
}

export interface GamblingMove {
  name: string;
  description: string;
  flavor_text: string;
  animation_hint: string;
  basePower: number;
  selfDamageReduction: number;
}

export interface CharacterPersonality {
  appearance: string;
  hobby: string;
  job: string;
  customMoveNames?: string[];
}

export interface Character {
  name: string;
  photoUrl: string;
  personality: CharacterPersonality;
  moves: Move[];
  gamblingMove: GamblingMove;
}

export type ActionType =
  | "punch"
  | "kick"
  | "guard"
  | "special1"
  | "special2"
  | "special3"
  | "gambling";

export interface BattleAction {
  type: ActionType;
  timestamp: number;
  damage?: number;
  gambleResult?: GambleResult;
}

export type GambleResult = "JACKPOT" | "HIT" | "OK" | "MISS" | "BACKFIRE";

export interface PlayerState {
  name: string;
  photoUrl: string;
  hp: number;
  moves: Move[];
  gamblingMove: GamblingMove;
  cooldowns: Record<string, number>;
  gamblingUsesLeft: number;
  gamblingCooldownEnd: number;
  isStunned: boolean;
  stunnedUntil: number;
  actions: BattleAction[];
}

export type RoomStatus = "waiting" | "ready" | "fighting" | "finished";

export type Winner = "player1" | "player2" | "draw";

export interface RoomData {
  status: RoomStatus;
  createdAt: number;
  player1: PlayerState | null;
  player2: PlayerState | null;
  battleStartAt?: number;
  result?: {
    winner: Winner;
    commentary: string;
  };
}

export type Difficulty = "EASY" | "NORMAL" | "HARD";

export type GameMode = "online" | "ai";

export type NetActionKind =
  | "punch"
  | "kick"
  | "guard"
  | "guard_release"
  | "special"
  | "gamble"
  | "move"
  | "move_stop"
  | "position";

export interface NetAction {
  kind: NetActionKind;
  ts: number;
  moveIndex?: number;
  gambleResult?: GambleResult;
  direction?: "forward" | "back";
  x?: number;
  damage?: number;
}

export type Screen =
  | "title"
  | "upload"
  | "personality"
  | "moves"
  | "matchmaking"
  | "waiting"
  | "battle"
  | "result";
