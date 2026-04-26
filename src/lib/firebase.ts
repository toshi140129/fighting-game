import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  remove,
  update,
  onValue,
  onChildAdded,
  push,
  off,
  serverTimestamp,
  type Database,
  type DatabaseReference,
} from "firebase/database";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";
import type { RoomData, PlayerState, BattleAction, NetAction } from "../types/game";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "demo.firebaseapp.com",
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ??
    "https://demo-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "demo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "demo.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "0",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "demo",
};

let app: FirebaseApp | null = null;
let db: Database | null = null;
let auth: Auth | null = null;

export const isFirebaseConfigured = (): boolean => {
  return !!import.meta.env.VITE_FIREBASE_API_KEY;
};

export const initFirebase = (): { app: FirebaseApp; db: Database; auth: Auth } => {
  if (!app) {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
  }
  return { app, db: db!, auth: auth! };
};

export const ensureAnonymousAuth = (): Promise<User> => {
  const { auth } = initFirebase();
  return new Promise((resolve, reject) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    onAuthStateChanged(auth, (user) => {
      if (user) {
        resolve(user);
      }
    });
    signInAnonymously(auth).catch(reject);
  });
};

export const generateRoomCode = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

export const createRoom = async (roomCode: string): Promise<void> => {
  const { db } = initFirebase();
  const initialData: RoomData = {
    status: "waiting",
    createdAt: Date.now(),
    player1: null,
    player2: null,
  };
  await set(ref(db, `rooms/${roomCode}`), initialData);
};

export const setPlayerData = async (
  roomCode: string,
  slot: "player1" | "player2",
  player: PlayerState
): Promise<void> => {
  const { db } = initFirebase();
  await update(ref(db, `rooms/${roomCode}`), { [slot]: player });
};

export const updateRoomStatus = async (
  roomCode: string,
  status: RoomData["status"]
): Promise<void> => {
  const { db } = initFirebase();
  await update(ref(db, `rooms/${roomCode}`), { status });
};

export const pushAction = async (
  roomCode: string,
  slot: "player1" | "player2",
  action: BattleAction
): Promise<void> => {
  const { db } = initFirebase();
  const actionsRef = ref(db, `rooms/${roomCode}/${slot}/actions`);
  await push(actionsRef, action);
};

export const updatePlayerHp = async (
  roomCode: string,
  slot: "player1" | "player2",
  hp: number
): Promise<void> => {
  const { db } = initFirebase();
  await update(ref(db, `rooms/${roomCode}/${slot}`), { hp });
};

export const setBattleResult = async (
  roomCode: string,
  result: NonNullable<RoomData["result"]>
): Promise<void> => {
  const { db } = initFirebase();
  await update(ref(db, `rooms/${roomCode}`), {
    status: "finished",
    result,
  });
};

export const pushNetAction = async (
  roomCode: string,
  slot: "player1" | "player2",
  action: NetAction
): Promise<void> => {
  const { db } = initFirebase();
  await push(ref(db, `rooms/${roomCode}/net/${slot}`), action);
};

export const clearNetActions = async (roomCode: string): Promise<void> => {
  const { db } = initFirebase();
  await remove(ref(db, `rooms/${roomCode}/net`));
};

export const subscribeNetActions = (
  roomCode: string,
  slot: "player1" | "player2",
  callback: (action: NetAction) => void
): (() => void) => {
  const { db } = initFirebase();
  const startTs = Date.now() - 500;
  const r = ref(db, `rooms/${roomCode}/net/${slot}`);
  const unsub = onChildAdded(r, (snap) => {
    const a = snap.val() as NetAction | null;
    if (!a) return;
    if (a.ts < startTs) return;
    callback(a);
  });
  return () => {
    off(r);
    unsub();
  };
};

export const subscribeRoom = (
  roomCode: string,
  callback: (data: RoomData | null) => void
): (() => void) => {
  const { db } = initFirebase();
  const roomRef = ref(db, `rooms/${roomCode}`);
  const unsub = onValue(roomRef, (snapshot) => {
    callback(snapshot.val() as RoomData | null);
  });
  return () => {
    off(roomRef);
    unsub();
  };
};

export const getRoomRef = (roomCode: string): DatabaseReference => {
  const { db } = initFirebase();
  return ref(db, `rooms/${roomCode}`);
};

export { serverTimestamp };
