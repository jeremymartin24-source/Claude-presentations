import { Server, Socket } from 'socket.io';
import { getRoom, getLeaderboard } from '../gameRooms';
import { calculateWager } from '../../services/scoreService';
import { shuffle } from '../../utils/shuffle';

const wagerTimers   = new Map<string, ReturnType<typeof setTimeout>>();
const questionTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimers(pin: string): void {
  [wagerTimers, questionTimers].forEach((map) => {
    const t = map.get(pin);
    if (t) { clearTimeout(t); map.delete(pin); }
  });
}

function sendWagerPhase(io: Server, pin: string): void {
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
  // Clear existing wagers
  for (const p of room.players.values()) p.wager = undefined;

  io.to(pin).emit('show_wager_ui', {
    index:     room.currentQuestion,
    total:     room.questions.length,
    category:  q.category,
    points:    q.points ?? 100,
    timeLimit: 15, // seconds to place wager
  });

  // After wager window, show the actual question
  const wagerWindow = setTimeout(() => {
    showQuestion(io, pin);
  }, 15_000);
  wagerTimers.set(pin, wagerWindow);
}

function showQuestion(io: Server, pin: string): void {
  clearTimers(pin);
  const room = getRoom(pin);
  if (!room) return;

  const q = room.questions[room.currentQuestion];
  room.timerStarted = Date.now();

  let options: string[] = [];
  if (q.options) {
    try { options = Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string); } catch { options = []; }
  }

  io.to(pin).emit('wager_question_start', {
    question:  q.question,
    options:   room.settings.shuffleAnswers !== false ? shuffle(options) : options,
    timeLimit: q.time_limit ?? 30,
  });

  // Auto-reveal after time limit
  const timeLimit = (q.time_limit ?? 30) * 1000;
  const qTimer = setTimeout(() => revealWagerAnswer(io, pin), timeLimit);
  questionTimers.set(pin, qTimer);
}

function revealWagerAnswer(io: Server, pin: string): void {
  clearTimers(pin);
  const room = getRoom(pin);
  if (!room) return;

  const q = room.questions[room.currentQuestion];
  room.phase = 'answer';

  io.to(pin).emit('wager_answer_reveal', {
    correctAnswer: q.answer,
    leaderboard:   getLeaderboard(room),
  });
}

export function registerWagerHandlers(io: Server, socket: Socket): void {
  socket.on('wager_start', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'wager') return;

    if (room.settings.shuffleQuestions) room.questions = shuffle(room.questions);
    room.currentQuestion = 0;
    room.phase = 'playing';

    io.to(data.pin).emit('game_starting', { totalQuestions: room.questions.length });
    setTimeout(() => sendWagerPhase(io, data.pin), 2000);
  });

  // Player places a wager (10–100% of their current score)
  socket.on('place_wager', (data: { pin: string; wageredPercent: number }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'question') return;
    if (room.gameType !== 'wager') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const pct = Math.max(10, Math.min(100, Math.round(data.wageredPercent)));
    player.wager = pct;

    socket.emit('wager_placed', { wageredPercent: pct, baseScore: player.score });
  });

  // Player submits answer
  socket.on('wager_answer', (data: { pin: string; answer: string }) => {
    const room = getRoom(data.pin);
    if (!room) return;
    if (room.gameType !== 'wager') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const q = room.questions[room.currentQuestion];
    const correct = data.answer.trim().toLowerCase() === q.answer.trim().toLowerCase();
    const wageredPct = player.wager ?? 50;
    const newScore = calculateWager(player.score, wageredPct, correct);
    const delta = newScore - player.score;

    player.score = newScore;
    if (correct) {
      player.streak++;
    } else {
      player.streak = 0;
    }

    room.answerCount = (room.answerCount ?? 0) + 1;

    socket.emit('wager_answer_ack', {
      correct,
      delta,
      newScore,
      wageredPct,
      correctAnswer: correct ? undefined : q.answer,
    });

    // Reveal early if everyone answered
    if (room.answerCount >= room.players.size) {
      revealWagerAnswer(io, data.pin);
    }
  });

  socket.on('wager_next', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'wager') return;

    clearTimers(data.pin);
    room.currentQuestion++;

    if (room.currentQuestion >= room.questions.length) {
      room.phase = 'ended';
      io.to(data.pin).emit('game_over', { leaderboard: getLeaderboard(room) });
    } else {
      io.to(data.pin).emit('leaderboard_update', { leaderboard: getLeaderboard(room) });
      setTimeout(() => sendWagerPhase(io, data.pin), 4000);
    }
  });

  socket.on('wager_end', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    clearTimers(data.pin);
    room.phase = 'ended';
    io.to(data.pin).emit('game_over', { leaderboard: getLeaderboard(room) });
  });
}
