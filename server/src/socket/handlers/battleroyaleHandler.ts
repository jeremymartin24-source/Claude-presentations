import { Server, Socket } from 'socket.io';
import { getRoom, getLeaderboard, QuestionData } from '../gameRooms';
import { shuffle } from '../../utils/shuffle';

const questionTimers = new Map<string, ReturnType<typeof setTimeout>>();
const tickIntervals  = new Map<string, ReturnType<typeof setInterval>>();

function clearTimers(pin: string): void {
  const t = questionTimers.get(pin);
  if (t) { clearTimeout(t); questionTimers.delete(pin); }
  const i = tickIntervals.get(pin);
  if (i) { clearInterval(i); tickIntervals.delete(pin); }
}

function aliveCount(pin: string): number {
  const room = getRoom(pin);
  if (!room) return 0;
  return Array.from(room.players.values()).filter(p => p.alive).length;
}

function sendQuestion(io: Server, pin: string): void {
  const room = getRoom(pin);
  if (!room) return;

  if (room.currentQuestion >= room.questions.length) {
    endGame(io, pin);
    return;
  }

  const q = room.questions[room.currentQuestion];
  room.phase = 'question';
  room.answerCount = 0;
  room.timerStarted = Date.now();

  // Reset per-round answer flags
  for (const player of room.players.values()) {
    (player as any).answeredCorrect   = false;
    (player as any).answeredThisRound = false;
  }

  let options: string[] = [];
  if (q.options) {
    try { options = Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string); } catch { options = []; }
  }

  const timeLimit = q.time_limit ?? 30;
  const surviving = aliveCount(pin);

  const payload = {
    index:        room.currentQuestion,
    total:        room.questions.length,
    question:     q.question,
    options:      shuffle(options),
    timeLimit,
    points:       q.points ?? 100,
    survivors:    surviving,
    answeredCount: 0,
  };

  // Emit to host view (battleroyale:question) and to student generic page (question_reveal)
  io.to(pin).emit('battleroyale:question', payload);
  io.to(pin).emit('question_reveal', { question: { text: q.question, options: payload.options }, timeLimit });

  // Per-second countdown
  let timeLeft = timeLimit;
  const tick = setInterval(() => {
    timeLeft = Math.max(0, timeLeft - 1);
    io.to(pin).emit('timer_tick', { timeLeft });
    if (timeLeft <= 0) {
      clearInterval(tick);
      tickIntervals.delete(pin);
    }
  }, 1000);
  tickIntervals.set(pin, tick);

  // Auto-reveal when timer expires
  const timer = setTimeout(() => revealAndEliminate(io, pin), timeLimit * 1000);
  questionTimers.set(pin, timer);
}

function revealAndEliminate(io: Server, pin: string): void {
  clearTimers(pin);
  const room = getRoom(pin);
  if (!room || room.phase === 'answer') return; // prevent double-fire

  const q = room.questions[room.currentQuestion];
  const eliminated: string[] = [];

  for (const player of room.players.values()) {
    if (!player.alive) continue;
    if (!(player as any).answeredCorrect) {
      player.alive  = false;
      player.streak = 0;
      eliminated.push(player.name);
    }
    // Reset for next round
    (player as any).answeredCorrect   = false;
    (player as any).answeredThisRound = false;
  }

  const surviving      = aliveCount(pin);
  const isLastQuestion = surviving <= 1 || room.currentQuestion >= room.questions.length - 1;
  room.phase = 'answer';

  // Notify each eliminated student on their device
  for (const player of room.players.values()) {
    if (eliminated.includes(player.name)) {
      io.to(player.socketId).emit('eliminated', { playerName: player.name });
    }
  }

  io.to(pin).emit('battleroyale:elimination', {
    eliminated,
    correctAnswer:  q.answer,
    survivors:      surviving,
    leaderboard:    getLeaderboard(room),
    dramatic:       eliminated.length > 0,
    isLastQuestion,
  });
}

function endGame(io: Server, pin: string): void {
  const room = getRoom(pin);
  if (!room) return;

  room.phase = 'ended';
  const survivors = Array.from(room.players.values())
    .filter(p => p.alive)
    .map(p => p.name);

  // Bonus for surviving
  for (const player of room.players.values()) {
    if (player.alive) player.score += 500;
  }

  const leaderboard = getLeaderboard(room);

  io.to(pin).emit('game_over', {
    survivors,
    winner:    survivors.length === 1 ? survivors[0] : null,
    leaderboard,
    message:   survivors.length === 1
      ? `${survivors[0]} is the last survivor!`
      : survivors.length > 1
        ? `${survivors.length} players survived!`
        : 'No survivors — everyone was eliminated!',
  });
}

// ── Handler Registration ─────────────────────────────────────────────────────

export function registerBattleRoyaleHandlers(io: Server, socket: Socket): void {

  socket.on('battleroyale:start', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'battleroyale') return;

    for (const player of room.players.values()) {
      player.alive  = true;
      player.streak = 0;
      (player as any).answeredCorrect   = false;
      (player as any).answeredThisRound = false;
    }

    if (room.settings.shuffleQuestions) room.questions = shuffle(room.questions);
    room.currentQuestion = 0;
    room.phase = 'playing';

    io.to(data.pin).emit('battleroyale:starting', {
      totalQuestions: room.questions.length,
      players: Array.from(room.players.values()).map(p => p.name),
    });

    setTimeout(() => sendQuestion(io, data.pin), 3000);
  });

  // Player submits answer — listens on both the BR-specific and generic event names
  const handleAnswer = (data: { pin: string; answer: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'question' || room.gameType !== 'battleroyale') return;

    const player = room.players.get(socket.id);
    if (!player || !player.alive) return;
    if ((player as any).answeredThisRound) return; // no double-submits

    const q = room.questions[room.currentQuestion];
    const correct = data.answer.trim().toLowerCase() === q.answer.trim().toLowerCase();

    if (correct) {
      (player as any).answeredCorrect = true;
      player.score += q.points ?? 100;
      player.streak++;
    }
    (player as any).answeredThisRound = true;
    room.answerCount = (room.answerCount ?? 0) + 1;

    // Acknowledge to the student
    socket.emit('battleroyale:answer_ack', { correct });
    socket.emit('answer_result', { correct, pointsEarned: correct ? (q.points ?? 100) : 0 });

    // Broadcast updated count to host
    io.to(data.pin).emit('battleroyale:answer_count', {
      answered: room.answerCount,
      alive:    aliveCount(data.pin),
    });

    // Early reveal if everyone alive has answered
    if (room.answerCount >= aliveCount(data.pin)) {
      revealAndEliminate(io, data.pin);
    }
  };

  socket.on('battleroyale:answer', handleAnswer);
  socket.on('submit_answer',       handleAnswer);   // StudentGamePage compatibility

  // Host: force-reveal before timer expires
  socket.on('battleroyale:reveal', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.phase !== 'question') return;
    revealAndEliminate(io, data.pin);
  });

  // Host: advance to next question after reveal
  socket.on('battleroyale:next', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.phase !== 'answer') return;

    const surviving = aliveCount(data.pin);
    if (surviving <= 1 || room.currentQuestion >= room.questions.length - 1) {
      endGame(io, data.pin);
    } else {
      room.currentQuestion++;
      sendQuestion(io, data.pin);
    }
  });

  socket.on('battleroyale:end', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    clearTimers(data.pin);
    endGame(io, data.pin);
  });
}
