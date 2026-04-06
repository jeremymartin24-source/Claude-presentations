export interface Player {
  socketId: string;
  name: string;
  team?: string;
  score: number;
  streak: number;
  alive: boolean;       // for Battle Royale
  wager?: number;       // for Confidence Wager
  bingoCard?: string[]; // for Bingo
  calledTerms?: Set<string>; // for Bingo
  lifelines?: {         // for Millionaire
    fiftyFifty: boolean;
    pollTheClass: boolean;
    phoneAFriend: boolean;
  };
}

export interface GameRoom {
  pin: string;
  gameType: string;
  hostSocketId: string;
  players: Map<string, Player>;           // keyed by socketId
  phase: 'lobby' | 'playing' | 'question' | 'answer' | 'leaderboard' | 'ended';
  currentQuestion: number;
  questions: QuestionData[];
  settings: GameSettings;
  buzzerQueue: string[];                  // socketIds in buzz order
  territories?: string[][];              // for Team Takeover (6×6 grid of team name or null)
  codePhrase?: string;                   // for Code Breaker
  revealedLetters?: boolean[];           // for Code Breaker
  bingoTerms?: string[];                 // full term list for Bingo
  bingoCalledTerms?: string[];           // called so far
  teamScores?: Map<string, number>;      // for team-based games
  millionaireContestant?: string;        // socketId of current Millionaire player
  millionaireLadder?: number[];          // prize money ladder
  millionaireLevel?: number;             // current rung (0-indexed)
  escapePuzzles?: EscapePuzzle[];        // for Escape Room
  hotSeatPlayer?: string;                // socketId of hot seat student
  submittedQuestions?: HotSeatQuestion[];// for Hot Seat
  answerCount?: number;                  // how many players have answered current Q
  timerStarted?: number;                 // epoch ms when timer started
}

export interface QuestionData {
  id?: number;
  type: string;
  question: string;
  options?: string[];
  answer: string;
  hint?: string;
  points: number;
  time_limit: number;
  category?: string;
  difficulty?: string;
}

export interface GameSettings {
  bankId?: number;
  courseId?: number;
  timeLimit?: number;
  shuffleQuestions?: boolean;
  shuffleAnswers?: boolean;
  maxPlayers?: number;
  teamMode?: boolean;
  teams?: string[];
  codePhrase?: string;
  questionCount?: number;
  [key: string]: unknown;
}

export interface EscapePuzzle {
  index: number;
  question: QuestionData;
  solved: boolean;
  solvedBy?: string;
}

export interface HotSeatQuestion {
  submittedBy: string;
  question: string;
  approved: boolean;
}

// ── In-memory store ──────────────────────────────────────────────────────────
const rooms = new Map<string, GameRoom>();

// ── Room management functions ─────────────────────────────────────────────────

export function createRoom(
  pin: string,
  gameType: string,
  hostSocketId: string,
  questions: QuestionData[],
  settings: GameSettings,
): GameRoom {
  const room: GameRoom = {
    pin,
    gameType,
    hostSocketId,
    players: new Map(),
    phase: 'lobby',
    currentQuestion: 0,
    questions,
    settings,
    buzzerQueue: [],
    teamScores: new Map(),
    bingoCalledTerms: [],
    submittedQuestions: [],
    answerCount: 0,
  };

  // Game-specific initialization
  if (gameType === 'team_takeover') {
    room.territories = Array.from({ length: 6 }, () => Array(6).fill(null));
  }

  if (gameType === 'code_breaker') {
    const phrase = (settings.codePhrase as string | undefined) || 'UNOH TECH';
    room.codePhrase = phrase.toUpperCase();
    room.revealedLetters = phrase.split('').map((c) => c === ' ');
  }

  if (gameType === 'millionaire') {
    room.millionaireLadder = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000];
    room.millionaireLevel = 0;
  }

  if (gameType === 'escape_room') {
    room.escapePuzzles = questions.slice(0, 5).map((q, i) => ({
      index: i,
      question: q,
      solved: false,
    }));
  }

  if (gameType === 'bingo') {
    room.bingoTerms = questions.map((q) => q.answer);
  }

  rooms.set(pin, room);
  return room;
}

export function getRoom(pin: string): GameRoom | undefined {
  return rooms.get(pin);
}

export function addPlayer(pin: string, player: Player): void {
  const room = rooms.get(pin);
  if (room) {
    if (player.lifelines === undefined && room.gameType === 'millionaire') {
      player.lifelines = { fiftyFifty: true, pollTheClass: true, phoneAFriend: true };
    }
    room.players.set(player.socketId, player);
  }
}

export function removePlayer(pin: string, socketId: string): void {
  const room = rooms.get(pin);
  if (room) {
    room.players.delete(socketId);
    room.buzzerQueue = room.buzzerQueue.filter((id) => id !== socketId);
  }
}

export function deleteRoom(pin: string): void {
  rooms.delete(pin);
}

export function getRoomByHostSocket(socketId: string): GameRoom | undefined {
  for (const room of rooms.values()) {
    if (room.hostSocketId === socketId) return room;
  }
  return undefined;
}

export function getRoomByPlayerSocket(socketId: string): GameRoom | undefined {
  for (const room of rooms.values()) {
    if (room.players.has(socketId)) return room;
  }
  return undefined;
}

export function getLeaderboard(room: GameRoom): Array<{ name: string; team?: string; score: number; streak: number; alive: boolean }> {
  return Array.from(room.players.values())
    .map((p) => ({ name: p.name, team: p.team, score: p.score, streak: p.streak, alive: p.alive }))
    .sort((a, b) => b.score - a.score);
}

export function getAllRooms(): GameRoom[] {
  return Array.from(rooms.values());
}
