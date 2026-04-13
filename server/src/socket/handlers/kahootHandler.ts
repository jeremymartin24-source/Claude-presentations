import { Server, Socket } from 'socket.io';
import { getRoom, getLeaderboard } from '../gameRooms';
import { calculateTimedScore, applyStreakBonus } from '../../services/scoreService';
import { shuffle } from '../../utils/shuffle';

const answerTimers  = new Map<string, ReturnType<typeof setTimeout>>();
const tickIntervals = new Map<string, ReturnType<typeof setInterval>>();
// pin → { optionIndex: answerCount }
const answerCounts  = new Map<string, Record<number, number>>();
// pin → shuffled options for current question (to resolve submitted answer → index)
const currentOptions = new Map<string, string[]>();

function clearTimer(pin: string): void {
  const t = answerTimers.get(pin);
  if (t) { clearTimeout(t); answerTimers.delete(pin); }
  const i = tickIntervals.get(pin);
  if (i) { clearInterval(i); tickIntervals.delete(pin); }
}

function sendQuestion(io: Server, pin: string): void {
  const room = getRoom(pin);
  if (!room) return;

  if (room.currentQuestion >= room.questions.length) {
    room.phase = 'ended';
    const scores = getLeaderboard(room).map(p => ({ name: p.name, score: p.score }));
    io.to(pin).emit('game_over', { scores });
    return;
  }

  const q = room.questions[room.currentQuestion];
  room.phase = 'question';
  room.answerCount = 0;
  room.timerStarted = Date.now();
  answerCounts.set(pin, {});

  // Parse options
  let options: string[] = [];
  if (q.options) {
    if (Array.isArray(q.options)) {
      options = q.options;
    } else {
      try { options = JSON.parse(q.options as unknown as string); } catch { options = []; }
    }
  }

  const shuffledOptions = room.settings.shuffleAnswers !== false ? shuffle([...options]) : options;
  currentOptions.set(pin, shuffledOptions);

  // correctIndex is the position of the right answer in the (possibly shuffled) array
  const correctIndex = shuffledOptions.findIndex(
    opt => opt.trim().toLowerCase() === q.answer.trim().toLowerCase()
  );

  const timeLimit = q.time_limit ?? 30;

  io.to(pin).emit('question_reveal', {
    question: {
      text: q.question,
      options: shuffledOptions,
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
      timeLimit,
    },
    index: room.currentQuestion,
    total: room.questions.length,
    timeLeft: timeLimit,
  });

  // Per-second timer ticks
  let remaining = timeLimit;
  const interval = setInterval(() => {
    remaining--;
    io.to(pin).emit('timer_tick', { timeLeft: remaining });
    if (remaining <= 0) {
      clearInterval(interval);
      tickIntervals.delete(pin);
    }
  }, 1000);
  tickIntervals.set(pin, interval);

  // Auto-advance when time expires
  const timer = setTimeout(() => {
    revealAnswer(io, pin);
  }, timeLimit * 1000);
  answerTimers.set(pin, timer);
}

function revealAnswer(io: Server, pin: string): void {
  clearTimer(pin);
  const room = getRoom(pin);
  if (!room || room.phase === 'answer') return;

  room.phase = 'answer';
  io.to(pin).emit('kahoot:time_up');
}

export function registerKahootHandlers(io: Server, socket: Socket): void {

  // Host starts the quiz
  socket.on('kahoot:start', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'kahoot') return;

    room.currentQuestion = 0;
    room.phase = 'playing';

    if (room.settings.shuffleQuestions) {
      room.questions = shuffle(room.questions);
    }

    // Short delay so the client sees the transition
    setTimeout(() => sendQuestion(io, data.pin), 500);
  });

  // Player submits an answer (phone-based games)
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

    // Track answer counts by option index for live bar chart
    const opts = currentOptions.get(data.pin) || [];
    const ansIdx = opts.findIndex(
      opt => opt.trim().toLowerCase() === data.answer.trim().toLowerCase()
    );
    if (ansIdx >= 0) {
      const counts = answerCounts.get(data.pin) || {};
      counts[ansIdx] = (counts[ansIdx] || 0) + 1;
      answerCounts.set(data.pin, counts);
      io.to(data.pin).emit('kahoot:answers_updated', { counts });
    }

    socket.emit('answer_ack', {
      correct,
      earned,
      newScore: player.score,
      streak:   player.streak,
      correctAnswer: correct ? undefined : q.answer,
    });

    // Reveal early if every player has answered
    if (room.answerCount >= room.players.size) {
      revealAnswer(io, data.pin);
    }
  });

  // Host presses "Next" — two-step: reveal → leaderboard → next question
  socket.on('kahoot:next', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'kahoot') return;

    clearTimer(data.pin);

    if (room.phase === 'answer') {
      // First press after time_up: show leaderboard
      room.phase = 'leaderboard';
      const scores = getLeaderboard(room).map(p => ({ name: p.name, score: p.score }));
      io.to(data.pin).emit('leaderboard_update', { scores });
    } else {
      // Second press (from leaderboard): advance to next question
      room.currentQuestion++;
      if (room.currentQuestion >= room.questions.length) {
        room.phase = 'ended';
        const scores = getLeaderboard(room).map(p => ({ name: p.name, score: p.score }));
        io.to(data.pin).emit('game_over', { scores });
      } else {
        sendQuestion(io, data.pin);
      }
    }
  });

  // No-devices: host marks a specific player as having answered correctly
  // Awards time-based score based on how much time was left when host clicks
  socket.on('kahoot:mark_correct', (data: { pin: string; playerName: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.phase !== 'answer') return; // only during reveal phase

    const player = Array.from(room.players.values()).find(p => p.name === data.playerName);
    if (!player) return;

    const q = room.questions[room.currentQuestion];
    // Award a flat "answered correctly" score — use half the max timed score as a fair default
    const earned = Math.round((q.points ?? 100) * 0.75);
    player.score += earned;
    player.streak++;

    // Emit updated answer counts so the host can see the score change immediately
    const scores = getLeaderboard(room).map(p => ({ name: p.name, score: p.score }));
    socket.emit('kahoot:score_update', { playerName: data.playerName, earned, newScore: player.score, scores });
  });

  // Host ends game early
  socket.on('kahoot:end', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    clearTimer(data.pin);
    room.phase = 'ended';
    const scores = getLeaderboard(room).map(p => ({ name: p.name, score: p.score }));
    io.to(data.pin).emit('game_over', { scores });
  });
}
