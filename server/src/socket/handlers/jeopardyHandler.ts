import { Server, Socket } from 'socket.io';
import { getRoom, getLeaderboard, QuestionData } from '../gameRooms';
import { saveBuzzerEvent } from '../../services/sessionService';
import { db } from '../../config/database';

interface JeopardyClue {
  question: string;
  answer: string;
  points: number;
  used: boolean;
  questionId?: number;
  isDailyDouble: boolean;
}

interface JeopardyBoard {
  categories: string[];
  clues: JeopardyClue[][];  // [categoryIndex][valueIndex]
  round: number;
}

interface FinalJeopardyState {
  question: string;
  answer: string;
  category: string;
  wagers: Map<string, number>;
  answers: Map<string, boolean>;
  phase: 'wager' | 'question' | 'judging' | 'done';
}

const POINT_VALUES_R1 = [100, 200, 300, 400, 500];
const POINT_VALUES_R2 = [200, 400, 600, 800, 1000];
const DIFFICULTY_RANK: Record<string, number> = { easy: 1, medium: 2, hard: 3 };
const MAX_CATEGORIES = 6;

// Per-PIN state
const activeClues     = new Map<string, { categoryIndex: number; valueIndex: number }>();
const clueTimers      = new Map<string, ReturnType<typeof setTimeout>>();
const lastScoringEvent = new Map<string, { playerName: string; delta: number }>();
const finalState      = new Map<string, FinalJeopardyState>();

// ─── Board Builder ──────────────────────────────────────────────────────────

function buildBoard(questions: QuestionData[], round = 1): JeopardyBoard {
  const pointValues = round === 1 ? POINT_VALUES_R1 : POINT_VALUES_R2;

  // Group by category
  const categoryMap = new Map<string, QuestionData[]>();
  for (const q of questions) {
    const cat = (q.category || 'General').trim();
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(q);
  }

  // Sort each category's questions: easiest → hardest, then by points asc
  for (const qs of categoryMap.values()) {
    qs.sort((a, b) => {
      const da = DIFFICULTY_RANK[a.difficulty ?? 'medium'] ?? 2;
      const db2 = DIFFICULTY_RANK[b.difficulty ?? 'medium'] ?? 2;
      if (da !== db2) return da - db2;
      return (a.points ?? 100) - (b.points ?? 100);
    });
  }

  // Take up to MAX_CATEGORIES, pad if needed
  const categories = Array.from(categoryMap.keys()).slice(0, MAX_CATEGORIES);
  while (categories.length < 5) categories.push(`Category ${categories.length + 1}`);

  const clues: JeopardyClue[][] = categories.map(cat => {
    const catQs = categoryMap.get(cat) ?? [];
    return pointValues.map((pts, i) => {
      const q = catQs[i];
      return {
        question:     q?.question  ?? `${cat} for $${pts}`,
        answer:       q?.answer    ?? '—',
        points:       pts,
        used:         !q,          // mark as used if no question available
        questionId:   q?.id,
        isDailyDouble: false,      // assigned below
      };
    });
  });

  // Assign Daily Doubles (1 in R1, 2 in R2); never on row 0
  const ddCount  = round === 1 ? 1 : 2;
  const assigned = new Set<string>();
  let attempts   = 0;
  while (assigned.size < ddCount && attempts < 200) {
    attempts++;
    const ci  = Math.floor(Math.random() * categories.length);
    const vi  = 1 + Math.floor(Math.random() * (pointValues.length - 1)); // rows 1-4
    const key = `${ci}-${vi}`;
    if (!assigned.has(key) && !clues[ci][vi].used) {
      assigned.add(key);
      clues[ci][vi].isDailyDouble = true;
    }
  }

  return { categories, clues, round };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function clearClueTimer(pin: string) {
  const t = clueTimers.get(pin);
  if (t) { clearTimeout(t); clueTimers.delete(pin); }
}

function broadcastScores(io: Server, pin: string) {
  const room = getRoom(pin);
  if (!room) return;
  io.to(pin).emit('leaderboard_update', {
    scores: getLeaderboard(room).map(p => ({ name: p.name, score: p.score })),
  });
}

function markClueUsed(io: Server, pin: string, ci: number, vi: number) {
  const room = getRoom(pin);
  if (!room) return;
  const board = (room as any).jeopardyBoard as JeopardyBoard | undefined;
  if (board?.clues[ci]?.[vi]) board.clues[ci][vi].used = true;
  io.to(pin).emit('jeopardy:cell_used', { categoryIndex: ci, valueIndex: vi });
}

// ─── Handler Registration ────────────────────────────────────────────────────

export function registerJeopardyHandlers(io: Server, socket: Socket): void {

  // ── HOST: Start game ──────────────────────────────────────────────────────
  socket.on('jeopardy:start', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id || room.gameType !== 'jeopardy') return;

    const board = buildBoard(room.questions, 1);
    (room as any).jeopardyBoard  = board;
    (room as any).jeopardyRound  = 1;
    room.phase = 'playing';

    // Host gets full data (including answers)
    socket.emit('jeopardy:board_state', { categories: board.categories, clues: board.clues, round: 1 });

    // Display / players get sanitized board (no answers, no DD flags)
    io.to(data.pin).emit('jeopardy:display_board', sanitizeBoard(board));
  });

  // ── DISPLAY: Spectator join ───────────────────────────────────────────────
  socket.on('jeopardy:join_display', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room) return;
    socket.join(data.pin);

    const board = (room as any).jeopardyBoard as JeopardyBoard | undefined;
    if (board) {
      socket.emit('jeopardy:display_board', sanitizeBoard(board));
    }
    socket.emit('leaderboard_update', {
      scores: getLeaderboard(room).map(p => ({ name: p.name, score: p.score })),
    });
  });

  // ── HOST: Select clue cell ────────────────────────────────────────────────
  socket.on('jeopardy:select_cell', (data: { pin: string; categoryIndex: number; valueIndex: number }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const board = (room as any).jeopardyBoard as JeopardyBoard | undefined;
    if (!board) return;

    const clue = board.clues[data.categoryIndex]?.[data.valueIndex];
    if (!clue || clue.used) return;

    clearClueTimer(data.pin);
    room.buzzerQueue = [];
    (room as any).attemptedPlayers = new Set<string>();
    room.phase  = 'question';
    room.timerStarted = Date.now();
    activeClues.set(data.pin, { categoryIndex: data.categoryIndex, valueIndex: data.valueIndex });

    if (clue.isDailyDouble) {
      // Daily Double: tell host full data, tell display just the fanfare
      socket.emit('jeopardy:clue_selected', {
        categoryIndex: data.categoryIndex,
        valueIndex:    data.valueIndex,
        category:      board.categories[data.categoryIndex],
        question:      clue.question,
        answer:        clue.answer,
        points:        clue.points,
        isDailyDouble: true,
      });
      io.to(data.pin).emit('jeopardy:daily_double', {
        categoryIndex: data.categoryIndex,
        valueIndex:    data.valueIndex,
        category:      board.categories[data.categoryIndex],
        points:        clue.points,
      });
    } else {
      // Normal clue: host sees answer, display/players see only question
      socket.emit('jeopardy:clue_selected', {
        categoryIndex: data.categoryIndex,
        valueIndex:    data.valueIndex,
        category:      board.categories[data.categoryIndex],
        question:      clue.question,
        answer:        clue.answer,
        points:        clue.points,
        isDailyDouble: false,
      });
      io.to(data.pin).emit('clue_shown', {
        categoryIndex: data.categoryIndex,
        valueIndex:    data.valueIndex,
        category:      board.categories[data.categoryIndex],
        question:      clue.question,
        points:        clue.points,
      });
    }

    // Per-clue countdown timer (configurable; default 30 s)
    const timeLimit = (room.settings.clueTimer as number) ?? 30;
    const timer = setTimeout(() => {
      const r = getRoom(data.pin);
      if (!r || r.phase !== 'question') return;
      r.phase = 'playing';
      activeClues.delete(data.pin);
      if ((r as any).attemptedPlayers) (r as any).attemptedPlayers.clear();
      markClueUsed(io, data.pin, data.categoryIndex, data.valueIndex);
      socket.emit('jeopardy:clue_expired', {
        categoryIndex: data.categoryIndex,
        valueIndex:    data.valueIndex,
        answer:        clue.answer,
      });
      io.to(data.pin).emit('jeopardy:answer_reveal', { answer: clue.answer, playerName: null, correct: false });
    }, timeLimit * 1000);
    clueTimers.set(data.pin, timer);
  });

  // ── HOST: Daily Double wager confirmed ────────────────────────────────────
  socket.on('jeopardy:daily_double_wager', (data: { pin: string; playerName: string; wager: number }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const active = activeClues.get(data.pin);
    const board  = (room as any).jeopardyBoard as JeopardyBoard | undefined;
    if (!board || !active) return;

    const clue = board.clues[active.categoryIndex]?.[active.valueIndex];
    if (!clue) return;

    (room as any).dailyDoubleWager = Math.max(0, data.wager);
    (room as any).dailyDoublePlayer = data.playerName;

    // Now reveal question to everyone
    io.to(data.pin).emit('clue_shown', {
      categoryIndex: active.categoryIndex,
      valueIndex:    active.valueIndex,
      category:      board.categories[active.categoryIndex],
      question:      clue.question,
      points:        data.wager,
    });
    socket.emit('jeopardy:daily_double_ready', { wager: data.wager, playerName: data.playerName });
  });

  // ── PHONE: Open buzzers ───────────────────────────────────────────────────
  socket.on('jeopardy:open_buzzers', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    room.phase = 'answer';
    room.buzzerQueue = [];
    io.to(data.pin).emit('buzzers_open');
  });

  // ── PHONE: Player buzzes ──────────────────────────────────────────────────
  socket.on('buzzer_press', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'answer') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const attempted = (room as any).attemptedPlayers as Set<string> | undefined;
    if (attempted?.has(player.name)) {
      socket.emit('buzz_rejected', { reason: 'already_attempted' });
      return;
    }

    const buzzTime = Date.now() - (room.timerStarted ?? Date.now());
    if (!room.buzzerQueue.includes(socket.id)) room.buzzerQueue.push(socket.id);

    if (room.buzzerQueue[0] === socket.id) {
      socket.emit('buzz_accepted', { buzzTime, playerName: player.name });
    } else {
      socket.emit('buzz_rejected', { position: room.buzzerQueue.indexOf(socket.id) });
    }

    io.to(data.pin).emit('player_buzzed', { playerName: player.name, buzzTime, position: room.buzzerQueue.indexOf(socket.id) });
  });

  // ── NO-DEVICES: Virtual buzz ──────────────────────────────────────────────
  socket.on('jeopardy:virtual_buzz', (data: { pin: string; playerName: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const player = Array.from(room.players.values()).find(p => p.name === data.playerName);
    if (!player) return;

    room.phase = 'answer';
    if (!room.buzzerQueue.includes(player.socketId)) room.buzzerQueue.push(player.socketId);
    socket.emit('player_buzzed', { playerName: player.name, buzzTime: 0, position: 0 });
  });

  // ── HOST: Judge answer (both phone and no-devices) ────────────────────────
  socket.on('jeopardy:judge', (data: { pin: string; correct: boolean; playerName: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const board  = (room as any).jeopardyBoard as JeopardyBoard | undefined;
    const active = activeClues.get(data.pin);
    if (!board || !active) return;

    const clue = board.clues[active.categoryIndex]?.[active.valueIndex];
    if (!clue) return;

    const buzzer = Array.from(room.players.values()).find(p => p.name === data.playerName);
    if (!buzzer) return;

    const isDailyDouble = clue.isDailyDouble;
    const pointValue    = isDailyDouble ? ((room as any).dailyDoubleWager ?? clue.points) : clue.points;
    const buzzTime      = Date.now() - (room.timerStarted ?? Date.now());

    if (data.correct) {
      clearClueTimer(data.pin);
      buzzer.score += pointValue;
      buzzer.streak++;
      clue.used    = true;
      room.buzzerQueue = [];
      room.phase   = 'playing';
      activeClues.delete(data.pin);
      if ((room as any).attemptedPlayers) (room as any).attemptedPlayers.clear();
      if ((room as any).dailyDoubleWager) delete (room as any).dailyDoubleWager;
      lastScoringEvent.set(data.pin, { playerName: buzzer.name, delta: pointValue });

      saveBuzzerEvent(db, (room.settings.sessionId as number) ?? 0, buzzer.name, clue.questionId ?? null, buzzTime, true);

      socket.emit('jeopardy:answer_result', {
        playerName:    buzzer.name,
        correct:       true,
        points:        pointValue,
        newScore:      buzzer.score,
        answer:        clue.answer,
        categoryIndex: active.categoryIndex,
        valueIndex:    active.valueIndex,
      });
      io.to(data.pin).emit('jeopardy:answer_reveal', { answer: clue.answer, playerName: buzzer.name, correct: true });
      io.to(data.pin).emit('jeopardy:cell_used', { categoryIndex: active.categoryIndex, valueIndex: active.valueIndex });
      broadcastScores(io, data.pin);
    } else {
      // Wrong — deduct, allow negative scores (classic Jeopardy)
      buzzer.score -= pointValue;
      buzzer.streak = 0;
      lastScoringEvent.set(data.pin, { playerName: buzzer.name, delta: -pointValue });

      const attempted = (room as any).attemptedPlayers as Set<string>;
      attempted.add(buzzer.name);

      room.buzzerQueue = room.buzzerQueue.filter(id => id !== buzzer.socketId);

      saveBuzzerEvent(db, (room.settings.sessionId as number) ?? 0, buzzer.name, clue.questionId ?? null, buzzTime, false);

      socket.emit('jeopardy:answer_result', {
        playerName:    buzzer.name,
        correct:       false,
        points:        -pointValue,
        newScore:      buzzer.score,
        categoryIndex: active.categoryIndex,
        valueIndex:    active.valueIndex,
      });
      broadcastScores(io, data.pin);

      // If no more players remain in queue, expire the clue
      if (room.buzzerQueue.length === 0 && room.phase !== 'question') {
        clearClueTimer(data.pin);
        clue.used  = true;
        room.phase = 'playing';
        activeClues.delete(data.pin);
        attempted.clear();
        socket.emit('jeopardy:clue_expired', {
          categoryIndex: active.categoryIndex,
          valueIndex:    active.valueIndex,
          answer:        clue.answer,
        });
        io.to(data.pin).emit('jeopardy:answer_reveal', { answer: clue.answer, playerName: null, correct: false });
        io.to(data.pin).emit('jeopardy:cell_used', { categoryIndex: active.categoryIndex, valueIndex: active.valueIndex });
      } else if (room.buzzerQueue.length > 0) {
        // Next in queue (phone mode)
        const next = room.players.get(room.buzzerQueue[0]);
        if (next) socket.emit('player_buzzed', { playerName: next.name, buzzTime: 0, position: 0 });
      }
      // In no-devices mode (phase still 'question'), host will call judge again for another player
    }
  });

  // ── HOST: Skip / No One answered ─────────────────────────────────────────
  socket.on('jeopardy:skip', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const active = activeClues.get(data.pin);
    const board  = (room as any).jeopardyBoard as JeopardyBoard | undefined;
    if (!board || !active) return;

    const clue = board.clues[active.categoryIndex]?.[active.valueIndex];
    if (!clue) return;

    clearClueTimer(data.pin);
    clue.used  = true;
    room.phase = 'playing';
    activeClues.delete(data.pin);
    if ((room as any).attemptedPlayers) (room as any).attemptedPlayers.clear();
    if ((room as any).dailyDoubleWager) delete (room as any).dailyDoubleWager;

    socket.emit('jeopardy:clue_expired', {
      categoryIndex: active.categoryIndex,
      valueIndex:    active.valueIndex,
      answer:        clue.answer,
    });
    io.to(data.pin).emit('jeopardy:answer_reveal', { answer: clue.answer, playerName: null, correct: false });
    io.to(data.pin).emit('jeopardy:cell_used', { categoryIndex: active.categoryIndex, valueIndex: active.valueIndex });
  });

  // ── HOST: Edit score ──────────────────────────────────────────────────────
  socket.on('jeopardy:edit_score', (data: { pin: string; playerName: string; newScore: number }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const player = Array.from(room.players.values()).find(p => p.name === data.playerName);
    if (!player) return;

    const oldScore = player.score;
    const delta    = data.newScore - oldScore;
    player.score   = data.newScore;
    lastScoringEvent.set(data.pin, { playerName: data.playerName, delta });

    socket.emit('jeopardy:answer_result', {
      playerName: data.playerName, correct: delta >= 0,
      points: delta, newScore: player.score, categoryIndex: -1, valueIndex: -1,
    });
    broadcastScores(io, data.pin);
  });

  // ── HOST: Undo last scoring event ─────────────────────────────────────────
  socket.on('jeopardy:undo', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const last = lastScoringEvent.get(data.pin);
    if (!last) return;

    const player = Array.from(room.players.values()).find(p => p.name === last.playerName);
    if (!player) return;

    player.score -= last.delta;
    lastScoringEvent.delete(data.pin);

    socket.emit('jeopardy:undo_result', { playerName: last.playerName, newScore: player.score });
    broadcastScores(io, data.pin);
  });

  // ── HOST: Start Double Jeopardy (Round 2) ─────────────────────────────────
  socket.on('jeopardy:start_round2', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const board = buildBoard(room.questions, 2);
    (room as any).jeopardyBoard = board;
    (room as any).jeopardyRound = 2;
    room.phase = 'playing';
    activeClues.delete(data.pin);

    socket.emit('jeopardy:board_state', { categories: board.categories, clues: board.clues, round: 2 });
    io.to(data.pin).emit('jeopardy:display_board', sanitizeBoard(board));
  });

  // ── HOST: Start Final Jeopardy ─────────────────────────────────────────────
  socket.on('jeopardy:start_final', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    // Pick hardest unused question as final
    const sortedQ = [...room.questions].sort((a, b) => {
      const da = DIFFICULTY_RANK[a.difficulty ?? 'medium'] ?? 2;
      const db2 = DIFFICULTY_RANK[b.difficulty ?? 'medium'] ?? 2;
      return db2 - da;
    });
    const finalQ = sortedQ[0] ?? { question: 'Final Question', answer: 'Final Answer', category: 'Final Jeopardy' };

    const state: FinalJeopardyState = {
      question: finalQ.question,
      answer:   finalQ.answer,
      category: finalQ.category ?? 'Final Jeopardy',
      wagers:   new Map(),
      answers:  new Map(),
      phase:    'wager',
    };
    finalState.set(data.pin, state);
    room.phase = 'final_jeopardy';

    const scores = getLeaderboard(room).map(p => ({ name: p.name, score: p.score }));
    io.to(data.pin).emit('jeopardy:final_start', { category: state.category, scores });
    // Host additionally sees the question and answer
    socket.emit('jeopardy:final_host_data', { question: state.question, answer: state.answer, category: state.category, scores });
  });

  // ── HOST: Submit wager for a player (no-devices) or receive from phone ────
  socket.on('jeopardy:submit_wager', (data: { pin: string; playerName: string; wager: number }) => {
    const room = getRoom(data.pin);
    if (!room) return;

    const fs = finalState.get(data.pin);
    if (!fs || fs.phase !== 'wager') return;

    const player = Array.from(room.players.values()).find(p => p.name === data.playerName);
    const maxWager = Math.max(player?.score ?? 0, 0);
    fs.wagers.set(data.playerName, Math.min(Math.max(0, data.wager), maxWager));

    socket.emit('jeopardy:wager_ack', { playerName: data.playerName, wager: fs.wagers.get(data.playerName) });
  });

  // ── HOST: Reveal Final Jeopardy question ──────────────────────────────────
  socket.on('jeopardy:reveal_final', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const fs = finalState.get(data.pin);
    if (!fs) return;
    fs.phase = 'question';

    // Host sees answer too
    socket.emit('jeopardy:final_question', { question: fs.question, answer: fs.answer, category: fs.category });
    // Display/players see only question
    io.to(data.pin).emit('jeopardy:final_question_display', { question: fs.question, category: fs.category });
  });

  // ── HOST: Judge Final Jeopardy answer per player ──────────────────────────
  socket.on('jeopardy:final_judge', (data: { pin: string; playerName: string; correct: boolean }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const fs = finalState.get(data.pin);
    if (!fs) return;

    fs.answers.set(data.playerName, data.correct);

    const player = Array.from(room.players.values()).find(p => p.name === data.playerName);
    if (player) {
      const wager = fs.wagers.get(data.playerName) ?? 0;
      player.score += data.correct ? wager : -wager;
    }

    const scores = getLeaderboard(room).map(p => ({ name: p.name, score: p.score }));
    socket.emit('jeopardy:final_score_update', { playerName: data.playerName, correct: data.correct, scores });

    // All players judged → end game
    if (fs.answers.size >= room.players.size) {
      fs.phase   = 'done';
      room.phase = 'ended';
      io.to(data.pin).emit('game_over', { scores });
    }
  });

  // ── HOST: End game early ──────────────────────────────────────────────────
  socket.on('jeopardy:end', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    clearClueTimer(data.pin);
    room.phase = 'ended';
    const scores = getLeaderboard(room).map(p => ({ name: p.name, score: p.score }));
    io.to(data.pin).emit('game_over', { scores });
  });
}

// ─── Helper: Strip answers from board for display clients ───────────────────
function sanitizeBoard(board: JeopardyBoard) {
  return {
    categories: board.categories,
    clues: board.clues.map(col =>
      col.map(c => ({ points: c.points, used: c.used, isDailyDouble: false }))
    ),
    round: board.round,
  };
}
