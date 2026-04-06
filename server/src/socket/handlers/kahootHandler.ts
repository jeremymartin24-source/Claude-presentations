import { Server, Socket } from 'socket.io';
import { getRoom, getLeaderboard } from '../gameRooms';
import { calculateTimedScore, applyStreakBonus } from '../../services/scoreService';
import { shuffle } from '../../utils/shuffle';

const answerTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimer(pin: string): void {
  const t = answerTimers.get(pin);
  if (t) {
    clearTimeout(t);
    answerTimers.delete(pin);
  }
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

  // Parse options
  let options: string[] = [];
  if (q.options) {
    if (Array.isArray(q.options)) {
      options = q.options;
    } else {
      try { options = JSON.parse(q.options as unknown as string); } catch { options = []; }
    }
  }

  const shuffledOptions = room.settings.shuffleAnswers !== false ? shuffle(options) : options;

  io.to(pin).emit('question_start', {
    index:        room.currentQuestion,
    total:        room.questions.length,
    question:     q.question,
    options:      shuffledOptions,
    timeLimit:    q.time_limit ?? 30,
    points:       q.points ?? 100,
    category:     q.category,
    difficulty:   q.difficulty,
  });

  // Auto-advance when timer expires
  const timeLimit = (q.time_limit ?? 30) * 1000;
  const timer = setTimeout(() => {
    revealAnswer(io, pin);
  }, timeLimit);
  answerTimers.set(pin, timer);
}

function revealAnswer(io: Server, pin: string): void {
  clearTimer(pin);
  const room = getRoom(pin);
  if (!room || room.phase === 'answer') return;

  room.phase = 'answer';
  const q = room.questions[room.currentQuestion];

  io.to(pin).emit('answer_reveal', {
    correctAnswer: q.answer,
    question:      q.question,
    leaderboard:   getLeaderboard(room),
  });
}

export function registerKahootHandlers(io: Server, socket: Socket): void {
  // Host starts the quiz
  socket.on('kahoot_start', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'kahoot') return;

    room.currentQuestion = 0;
    room.phase = 'playing';

    if (room.settings.shuffleQuestions) {
      room.questions = shuffle(room.questions);
    }

    io.to(data.pin).emit('game_starting', { totalQuestions: room.questions.length });
    setTimeout(() => sendQuestion(io, data.pin), 3000);
  });

  // Player submits an answer
  socket.on('submit_answer', (data: { pin: string; answer: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'question') return;
    if (room.gameType !== 'kahoot') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const q = room.questions[room.currentQuestion];
    const responseTimeMs = Date.now() - (room.timerStarted ?? Date.now());
    const correct = data.answer.trim().toLowerCase() === q.answer.trim().toLowerCase();

    let earned = 0;
    if (correct) {
      const timed = calculateTimedScore(q.points ?? 100, q.time_limit ?? 30, responseTimeMs);
      earned = applyStreakBonus(timed, player.streak + 1);
      player.score += earned;
      player.streak++;
    } else {
      player.streak = 0;
    }

    room.answerCount = (room.answerCount ?? 0) + 1;

    socket.emit('answer_ack', {
      correct,
      earned,
      newScore: player.score,
      streak:   player.streak,
      correctAnswer: correct ? undefined : q.answer,
    });

    // If all alive players have answered, reveal early
    const totalPlayers = room.players.size;
    if (room.answerCount >= totalPlayers) {
      revealAnswer(io, data.pin);
    }
  });

  // Host advances to next question
  socket.on('next_question', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'kahoot') return;

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

  socket.on('kahoot_end', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    clearTimer(data.pin);
    room.phase = 'ended';
    io.to(data.pin).emit('game_over', { leaderboard: getLeaderboard(room) });
  });
}
