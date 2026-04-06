import { Server, Socket } from 'socket.io';
import { getRoom, getLeaderboard } from '../gameRooms';
import { saveBuzzerEvent } from '../../services/sessionService';
import { db } from '../../config/database';
import { shuffle } from '../../utils/shuffle';

const ANSWER_WINDOW_MS = 5000;
const WRONG_PENALTY    = 50;

const answerTimers  = new Map<string, ReturnType<typeof setTimeout>>();
const buzzerWindows = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimers(pin: string): void {
  const t1 = answerTimers.get(pin);
  if (t1) { clearTimeout(t1); answerTimers.delete(pin); }
  const t2 = buzzerWindows.get(pin);
  if (t2) { clearTimeout(t2); buzzerWindows.delete(pin); }
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
  room.buzzerQueue = [];
  room.timerStarted = Date.now();

  let options: string[] = [];
  if (q.options) {
    try { options = Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string); } catch { options = []; }
  }

  io.to(pin).emit('speedround_question', {
    index:    room.currentQuestion,
    total:    room.questions.length,
    question: q.question,
    options,
    points:   q.points ?? 100,
    category: q.category,
  });

  // Question stays up until someone buzzes; auto-skip after 15s
  const skipTimer = setTimeout(() => {
    const r = getRoom(pin);
    if (r && r.phase === 'question') {
      io.to(pin).emit('question_skipped', { answer: q.answer });
      r.currentQuestion++;
      setTimeout(() => sendQuestion(io, pin), 2000);
    }
  }, 15_000);
  answerTimers.set(pin, skipTimer);
}

export function registerSpeedroundHandlers(io: Server, socket: Socket): void {
  socket.on('speedround_start', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'speed_round') return;

    if (room.settings.shuffleQuestions) room.questions = shuffle(room.questions);
    room.currentQuestion = 0;
    room.phase = 'playing';

    io.to(data.pin).emit('game_starting', { totalQuestions: room.questions.length });
    setTimeout(() => sendQuestion(io, data.pin), 3000);
  });

  // Buzz in
  socket.on('speed_buzz', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'question') return;
    if (room.gameType !== 'speed_round') return;

    const player = room.players.get(socket.id);
    if (!player || room.buzzerQueue.includes(socket.id)) return;

    const buzzTime = Date.now() - (room.timerStarted ?? Date.now());

    if (room.buzzerQueue.length === 0) {
      room.buzzerQueue.push(socket.id);
      room.phase = 'answer';
      clearTimers(data.pin);

      socket.emit('buzz_accepted', { buzzTime });
      io.to(data.pin).emit('player_buzzed', { playerName: player.name, buzzTime });

      // Give the buzzer ANSWER_WINDOW_MS to submit an answer
      const window = setTimeout(() => {
        const r = getRoom(data.pin);
        if (!r || r.phase !== 'answer') return;
        // Time's up — wrong answer behavior
        player.score = Math.max(0, player.score - WRONG_PENALTY);
        player.streak = 0;
        r.buzzerQueue.shift();
        io.to(data.pin).emit('answer_timeout', { playerName: player.name, penalty: WRONG_PENALTY });
        // Let others buzz again or skip
        r.phase = 'question';
        r.timerStarted = Date.now();
        const skipTimer2 = setTimeout(() => {
          const r2 = getRoom(data.pin);
          if (r2 && r2.phase === 'question') {
            const q2 = r2.questions[r2.currentQuestion];
            io.to(data.pin).emit('question_skipped', { answer: q2?.answer });
            r2.currentQuestion++;
            setTimeout(() => sendQuestion(io, data.pin), 2000);
          }
        }, 8_000);
        answerTimers.set(data.pin, skipTimer2);
      }, ANSWER_WINDOW_MS);
      buzzerWindows.set(data.pin, window);
    } else {
      room.buzzerQueue.push(socket.id);
      socket.emit('buzz_queued', { position: room.buzzerQueue.length });
    }
  });

  // Buzzer submits answer
  socket.on('speed_answer', (data: { pin: string; answer: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'answer') return;
    if (room.gameType !== 'speed_round') return;

    const buzzerId = room.buzzerQueue[0];
    if (buzzerId !== socket.id) return;

    clearTimers(data.pin);

    const player = room.players.get(socket.id);
    if (!player) return;

    const q = room.questions[room.currentQuestion];
    const buzzTime = Date.now() - (room.timerStarted ?? Date.now());
    const correct = data.answer.trim().toLowerCase() === q.answer.trim().toLowerCase();

    if (correct) {
      player.score += q.points ?? 100;
      player.streak++;
      room.currentQuestion++;

      saveBuzzerEvent(db, (room.settings.sessionId as number) ?? 0, player.name, q.id ?? null, buzzTime, true);

      io.to(data.pin).emit('speed_result', {
        playerName:    player.name,
        correct:       true,
        points:        q.points ?? 100,
        newScore:      player.score,
        correctAnswer: q.answer,
      });
      io.to(data.pin).emit('leaderboard_update', { leaderboard: getLeaderboard(room) });
      setTimeout(() => sendQuestion(io, data.pin), 2000);
    } else {
      player.score = Math.max(0, player.score - WRONG_PENALTY);
      player.streak = 0;
      room.buzzerQueue.shift();

      saveBuzzerEvent(db, (room.settings.sessionId as number) ?? 0, player.name, q.id ?? null, buzzTime, false);

      io.to(data.pin).emit('speed_result', {
        playerName: player.name,
        correct:    false,
        penalty:    WRONG_PENALTY,
        newScore:   player.score,
      });

      // Let next queued player answer, or re-open buzzer
      if (room.buzzerQueue.length > 0) {
        const nextId = room.buzzerQueue[0];
        const nextPlayer = room.players.get(nextId);
        room.phase = 'answer';
        io.to(nextId).emit('buzz_accepted', { buzzTime: 0 });
        io.to(data.pin).emit('player_buzzed', { playerName: nextPlayer?.name, buzzTime: 0 });
      } else {
        room.phase = 'question';
        room.timerStarted = Date.now();
        io.to(data.pin).emit('buzzer_open');
        const skipTimer = setTimeout(() => {
          const r = getRoom(data.pin);
          if (r && r.phase === 'question') {
            io.to(data.pin).emit('question_skipped', { answer: q.answer });
            r.currentQuestion++;
            setTimeout(() => sendQuestion(io, data.pin), 2000);
          }
        }, 8_000);
        answerTimers.set(data.pin, skipTimer);
      }
    }
  });

  socket.on('speedround_end', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    clearTimers(data.pin);
    room.phase = 'ended';
    io.to(data.pin).emit('game_over', { leaderboard: getLeaderboard(room) });
  });
}
