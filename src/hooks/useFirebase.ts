import { useEffect, useState } from "react";
import { subscribeRoom, updatePlayerHp, pushAction, setBattleResult } from "../lib/firebase";
import type { RoomData, PlayerState, BattleAction, Winner } from "../types/game";

export const useRoom = (roomCode: string | null) => {
  const [room, setRoom] = useState<RoomData | null>(null);

  useEffect(() => {
    if (!roomCode) return;
    const unsub = subscribeRoom(roomCode, (data) => setRoom(data));
    return unsub;
  }, [roomCode]);

  return room;
};

export const useOpponent = (
  roomCode: string | null,
  mySlot: "player1" | "player2"
): PlayerState | null => {
  const room = useRoom(roomCode);
  if (!room) return null;
  return mySlot === "player1" ? room.player2 : room.player1;
};

export const sendActionToFirebase = async (
  roomCode: string,
  slot: "player1" | "player2",
  action: BattleAction,
  newHp?: number,
  opponentSlot?: "player1" | "player2",
  opponentNewHp?: number
) => {
  await pushAction(roomCode, slot, action);
  if (newHp !== undefined) {
    await updatePlayerHp(roomCode, slot, newHp);
  }
  if (opponentSlot && opponentNewHp !== undefined) {
    await updatePlayerHp(roomCode, opponentSlot, opponentNewHp);
  }
};

export const finishOnlineBattle = async (
  roomCode: string,
  winner: Winner,
  commentary: string
) => {
  await setBattleResult(roomCode, { winner, commentary });
};
