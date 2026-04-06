import { Server, Socket } from 'socket.io';
import { getRoom, getLeaderboard } from '../gameRooms';
import { shuffle } from '../../utils/shuffle';

const questionTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimer(pin: string): void {
  const t = questionTimers.get(pin);
  if (t) { clearTimeout(t); questionTimers.delete(pin); }
}

function aliveCount(pin: string): number {
  const room = getRoom(pin);
  if (!room) return 0;
  return Array.from(room.players.values()).filter((p) => p.alive).length;
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

  let options: string[] = [];
  if (q.options) {
    try { options = Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string); } catch { options = []; }
  }

  const surviving = aliveCount(pin);
  io.to(pin).emit('br_question', {
    index:      room.currentQuestion,
    total:      room.questions.length,
    question:   q.question,
    options:    shuffle(options),
    timeLimit:  q.time_limit ?? 30,
    points:     q.points ?? 100,
    survivors:  surviving,
  });

  const timeLimit = (q.time_limit ?? 30) * 1000;
  const timer = setTimeout(() => revealAndEliminate(io, pin), timeLimit);
  questionTimers.set(pin, timer);
}

function revealAndEliminate(io: Server, pin: string): void {
  clearTimer(pin);
  const room = getRoom(pin);
  if (!room) return;

  const q = room.questions[room.currentQuestion];
  const eliminated: string[] = [];

  // Mark players who didn't answer correctly as eliminated
  for (const player of room.players.values()) {
    if (!player.alive) continue;
    const answered = (player as unknown as Record<string, unknown>)['answeredCorrect'];
    if (!answered) {
      player.alive = false;
      player.streak = 0;
      eliminated.push(player.name);
    }
    // Reset for next round
    (player as unknown as Record<string, unknown>)['answeredCorrect'] = false;
  }

  const surviving = aliveCount(pin);

  io.to(pin).emit('br_elimination', {
    eliminated,
    correctAnswer: q.answer,
    survivors:     surviving,
    leaderboard:   getLeaderboard(room),
    dramatic:      eliminated.length > 0,
  });

  room.phase = 'answer';

  // Check win condition
  if (surviving <= 1 || room.currentQuestion >= room.questions.length - 1) {
    setTimeout(() => endGame(io, pin), 4000);
  } else {
    room.currentQuestion++;
    setTimeout(() => sendQuestion(io, pin), 5000);
  }
}

function endGame(io: Server, pin: string): void {
  const room = getRoom(pin);
  if (!room) return;

  room.phase = 'ended';
  const survivors = Array.from(room.players.values())
    .filter((p) => p.alive)
    .map((p) => p.name);

  // Award bonus points to survivors
  for (const player of room.players.values()) {
    if (player.alive) player.score += 500;
  }

  io.to(pin).emit('game_over', {
    survivors,
    leaderboard: getLeaderboard(room),
    message: survivors.length === 1
      ? `${survivors[0]} is the last survivor!`
      : survivors.length > 1
        ? `${survivors.length} players survived!`
        : 'No survivors — everyone was eliminated!',
  });
}

export function registerBattleRoyaleHandlers(io: Server, socket: Socket): void {
  socket.on('br_start', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'battle_royale') return;

    // All players start alive
    for (const player of room.players.values()) {
      player.alive = true;
      player.streak = 0;
      (player as unknown as Record<string, unknown>)['answeredCorrect'] = false;
    }

    if (room.settings.shuffleQuestions) room.questions = shuffle(room.questions);
    room.currentQuestion = 0;
    room.phase = 'playing';

    io.to(data.pin).emit('game_starting', {
      totalQuestions: room.questions.length,
      players: Array.from(room.players.values()).map((p) => p.name),
    });

    setTimeout(() => sendQuestion(io, data.pin), 3000);
  });

  // Player answers
  socket.on('br_answer', (data: { pin: string; answer: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'question') return;
    if (room.gameType !== 'battle_royale') return;

    const player = room.players.get(socket.id);
    if (!player || !player.alive) return;

    const q = room.questions[room.currentQuestion];
    const correct = data.answer.trim().toLowerCase() === q.answer.trim().toLowerCase();

    if (correct) {
      (player as unknown as Record<string, unknown>)['answeredCorrect'] = true;
      player.score += q.points ?? 100;
      player.streak++;
    }

    room.answerCount = (room.answerCount ?? 0) + 1;

    socket.emit('br_answer_ack', { correct, answer: correct ? undefined : q.answer });

    // Early reveal if all alive players have answered
    const alive = Array.from(room.players.values()).filter((p) => p.alive).length;
    if (room.answerCount >= alive) {
      revealAndEliminate(io, data.pin);
    }
  });

  socket.on('br_end', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    clearTimer(data.pin);
    endGame(io, data.pin);
  });
}
