import { Server, Socket } from 'socket.io';
import { getRoom, getLeaderboard } from '../gameRooms';
import { shuffle } from '../../utils/shuffle';

const questionTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimer(pin: string): void {
  const t = questionTimers.get(pin);
  if (t) { clearTimeout(t); questionTimers.delete(pin); }
}

/**
 * Calculate partial credit:
 * Each item in the correct position earns (points / totalItems).
 */
function scoreOrdering(
  submitted: string[],
  correct: string[],
  maxPoints: number,
): number {
  if (submitted.length !== correct.length) return 0;
  let matches = 0;
  for (let i = 0; i < correct.length; i++) {
    if (submitted[i]?.trim().toLowerCase() === correct[i]?.trim().toLowerCase()) {
      matches++;
    }
  }
  return Math.round((matches / correct.length) * maxPoints);
}

function sendQuestion(io: Server, pin: string): void {
  const room = getRoom(pin);
  if (!room) return;

  if (room.currentQuestion >= room.questions.length) {
    room.phase = 'ended';
    io.to(pin).emit('game_over', { leaderboard: getLeaderboard(room) });
    return;
  }

  const q = room.questions[room.currentQuestion];
  room.phase = 'question';
  room.answerCount = 0;
  room.timerStarted = Date.now();

  // The "options" field holds the ordered list; we shuffle it for players
  let orderedItems: string[] = [];
  if (q.options) {
    try { orderedItems = Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string); } catch { orderedItems = []; }
  } else if (q.answer) {
    // Fallback: answer might be pipe-delimited order
    orderedItems = q.answer.split('|').map((s) => s.trim());
  }

  const scrambled = shuffle([...orderedItems]);

  io.to(pin).emit('ranked_question', {
    index:     room.currentQuestion,
    total:     room.questions.length,
    question:  q.question,
    items:     scrambled,
    timeLimit: q.time_limit ?? 45,
    points:    q.points ?? 100,
    category:  q.category,
    hint:      q.hint,
  });

  const timeLimit = (q.time_limit ?? 45) * 1000;
  const timer = setTimeout(() => revealAnswer(io, pin), timeLimit);
  questionTimers.set(pin, timer);
}

function revealAnswer(io: Server, pin: string): void {
  clearTimer(pin);
  const room = getRoom(pin);
  if (!room || room.phase !== 'question') return;

  room.phase = 'answer';
  const q = room.questions[room.currentQuestion];

  let correctOrder: string[] = [];
  if (q.options) {
    try { correctOrder = Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string); } catch { correctOrder = []; }
  } else {
    correctOrder = q.answer.split('|').map((s) => s.trim());
  }

  io.to(pin).emit('ranked_answer', {
    correctOrder,
    leaderboard: getLeaderboard(room),
  });
}

export function registerRankedHandlers(io: Server, socket: Socket): void {
  socket.on('ranked_start', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'ranked') return;

    if (room.settings.shuffleQuestions) room.questions = shuffle(room.questions);
    room.currentQuestion = 0;
    room.phase = 'playing';

    io.to(data.pin).emit('game_starting', { totalQuestions: room.questions.length });
    setTimeout(() => sendQuestion(io, data.pin), 3000);
  });

  // Player submits their ordering
  socket.on('ranked_submit', (data: { pin: string; ordering: string[] }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'question') return;
    if (room.gameType !== 'ranked') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const q = room.questions[room.currentQuestion];
    let correctOrder: string[] = [];
    if (q.options) {
      try { correctOrder = Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string); } catch { correctOrder = []; }
    } else {
      correctOrder = q.answer.split('|').map((s) => s.trim());
    }

    const earned = scoreOrdering(data.ordering, correctOrder, q.points ?? 100);
    player.score += earned;
    if (earned === (q.points ?? 100)) {
      player.streak++;
    } else {
      player.streak = 0;
    }

    room.answerCount = (room.answerCount ?? 0) + 1;

    socket.emit('ranked_result', {
      earned,
      newScore:     player.score,
      correctOrder,
      yourOrder:    data.ordering,
    });

    // Reveal early if all answered
    if (room.answerCount >= room.players.size) {
      revealAnswer(io, data.pin);
    }
  });

  socket.on('ranked_next', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'ranked') return;

    clearTimer(data.pin);
    room.currentQuestion++;

    if (room.currentQuestion >= room.questions.length) {
      room.phase = 'ended';
      io.to(data.pin).emit('game_over', { leaderboard: getLeaderboard(room) });
    } else {
      io.to(data.pin).emit('leaderboard_update', { leaderboard: getLeaderboard(room) });
      setTimeout(() => sendQuestion(io, data.pin), 4000);
    }
  });

  socket.on('ranked_end', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    clearTimer(data.pin);
    room.phase = 'ended';
    io.to(data.pin).emit('game_over', { leaderboard: getLeaderboard(room) });
  });
}
