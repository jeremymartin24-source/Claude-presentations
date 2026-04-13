import { Server, Socket } from 'socket.io';
import { getRoom, getLeaderboard } from '../gameRooms';
import { shuffle } from '../../utils/shuffle';

const LADDER = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000];
const SAFE_HAVENS = [4, 9];

function getSafeAmount(level: number): number {
  let safe = 0;
  for (const idx of SAFE_HAVENS) {
    if (level > idx) safe = LADDER[idx];
  }
  return safe;
}

function parseOptions(q: any): string[] {
  try { return Array.isArray(q.options) ? q.options : JSON.parse(q.options ?? '[]'); } catch { return []; }
}

function sendQuestion(io: Server, pin: string): void {
  const room = getRoom(pin);
  if (!room) return;

  const level = room.millionaireLevel ?? 0;
  if (level >= room.questions.length || level >= LADDER.length) {
    endGame(io, pin, true);
    return;
  }

  const q = room.questions[level];
  room.phase = 'question';
  room.timerStarted = Date.now();

  const contestant = room.millionaireContestant ? room.players.get(room.millionaireContestant) : undefined;

  io.to(pin).emit('question_reveal', {
    level,
    prizeMoney:  LADDER[level],
    question:    { text: q.question, options: parseOptions(q), correctIndex: -1 }, // correctIndex hidden until answer
    contestant:  contestant?.name ?? 'Contestant',
    safeAmount:  getSafeAmount(level),
    lifelines:   contestant?.lifelines,
  });
}

function endGame(io: Server, pin: string, won: boolean): void {
  const room = getRoom(pin);
  if (!room) return;
  room.phase = 'ended';

  const level    = room.millionaireLevel ?? 0;
  const winnings = won ? LADDER[level - 1] ?? 0 : getSafeAmount(level);
  const contestant = room.millionaireContestant ? room.players.get(room.millionaireContestant) : undefined;
  if (contestant) contestant.score += winnings;

  io.to(pin).emit('game_over', {
    contestant: contestant?.name,
    winnings,
    won,
    scores: getLeaderboard(room).map(p => ({ name: p.name, score: p.score })),
  });
}

function processAnswer(io: Server, socket: Socket, pin: string, answerText: string): void {
  const room = getRoom(pin);
  if (!room || room.phase !== 'question') return;

  const level = room.millionaireLevel ?? 0;
  const q     = room.questions[level];
  const correct = answerText.trim().toLowerCase() === q.answer.trim().toLowerCase();

  const options = parseOptions(q);
  const correctIndex = options.findIndex((o: string) => o.trim().toLowerCase() === q.answer.trim().toLowerCase());

  if (correct) {
    room.millionaireLevel = level + 1;
    io.to(pin).emit('millionaire:reveal', {
      correct:       true,
      correctAnswer: correctIndex,
      correctText:   q.answer,
      prizeMoney:    LADDER[level],
      nextPrize:     LADDER[room.millionaireLevel] ?? 0,
      level:         room.millionaireLevel,
    });
    if (room.millionaireLevel >= LADDER.length) {
      setTimeout(() => endGame(io, pin, true), 3000);
    } else {
      setTimeout(() => sendQuestion(io, pin), 4000);
    }
  } else {
    const safeAmount   = getSafeAmount(level);
    const contestant   = room.millionaireContestant ? room.players.get(room.millionaireContestant) : undefined;
    if (contestant) contestant.score += safeAmount;
    io.to(pin).emit('millionaire:reveal', {
      correct:       false,
      correctAnswer: correctIndex,
      correctText:   q.answer,
      givenAnswer:   answerText,
      safeAmount,
    });
    setTimeout(() => endGame(io, pin, false), 4000);
  }
}

export function registerMillionaireHandlers(io: Server, socket: Socket): void {

  socket.on('millionaire:start', (data: { pin: string; contestantName?: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'millionaire') return;

    if (room.settings.shuffleQuestions) room.questions = shuffle(room.questions);
    room.millionaireLevel = 0;
    room.phase = 'playing';

    // Pick first contestant — by name (no-devices) or random (phone mode)
    let contestantId: string | undefined;
    if (data.contestantName) {
      const found = Array.from(room.players.values()).find(p => p.name === data.contestantName);
      contestantId = found?.socketId;
    }
    if (!contestantId) {
      const ids = Array.from(room.players.keys());
      contestantId = ids[Math.floor(Math.random() * ids.length)];
    }
    room.millionaireContestant = contestantId;

    const contestant = contestantId ? room.players.get(contestantId) : undefined;
    if (contestant) {
      contestant.lifelines = { fiftyFifty: true, pollTheClass: true, phoneAFriend: true };
    }

    io.to(data.pin).emit('millionaire:contestant_selected', {
      name:     contestant?.name,
      socketId: contestantId,
    });

    setTimeout(() => sendQuestion(io, data.pin), 2000);
  });

  // Phone mode: contestant submits their answer
  socket.on('millionaire:answer', (data: { pin: string; answer: string | number }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'question') return;
    if (room.millionaireContestant !== socket.id) return;

    const q = room.questions[room.millionaireLevel ?? 0];
    const options = parseOptions(q);
    const answerText = typeof data.answer === 'number' ? (options[data.answer] ?? '') : data.answer;
    processAnswer(io, socket, data.pin, answerText);
  });

  // No-devices mode: host submits answer on behalf of contestant
  socket.on('millionaire:host_answer', (data: { pin: string; answerIndex: number }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.phase !== 'question') return;

    const q = room.questions[room.millionaireLevel ?? 0];
    const options = parseOptions(q);
    const answerText = options[data.answerIndex] ?? '';
    processAnswer(io, socket, data.pin, answerText);
  });

  // No-devices: host selects next contestant by name
  socket.on('millionaire:host_select_contestant', (data: { pin: string; contestantName: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const found = Array.from(room.players.values()).find(p => p.name === data.contestantName);
    if (!found) return;

    room.millionaireContestant = found.socketId;
    room.millionaireLevel = 0;
    found.lifelines = { fiftyFifty: true, pollTheClass: true, phoneAFriend: true };

    io.to(data.pin).emit('millionaire:contestant_selected', {
      name:     found.name,
      socketId: found.socketId,
    });
    setTimeout(() => sendQuestion(io, data.pin), 1000);
  });

  // Walk away
  socket.on('millionaire:walk_away', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room) return;
    // Allow either the contestant (phone) or host (no-devices) to walk away
    if (room.millionaireContestant !== socket.id && room.hostSocketId !== socket.id) return;

    const level      = room.millionaireLevel ?? 0;
    const walkMoney  = level > 0 ? LADDER[level - 1] : 0;
    const contestant = room.millionaireContestant ? room.players.get(room.millionaireContestant) : undefined;
    if (contestant) contestant.score += walkMoney;

    io.to(data.pin).emit('millionaire:walked_away', {
      contestant: contestant?.name,
      winnings:   walkMoney,
    });
    setTimeout(() => endGame(io, data.pin, false), 3000);
  });

  // 50/50 lifeline
  socket.on('millionaire:lifeline', (data: { pin: string; type: '50-50' | 'poll' | 'phone' }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'question') return;
    // Allow contestant (phone) or host (no-devices)
    const isHost = room.hostSocketId === socket.id;
    const isContestant = room.millionaireContestant === socket.id;
    if (!isHost && !isContestant) return;

    const contestant = room.millionaireContestant ? room.players.get(room.millionaireContestant) : undefined;
    if (!contestant?.lifelines) return;

    const q = room.questions[room.millionaireLevel ?? 0];
    const options = parseOptions(q);

    if (data.type === '50-50') {
      if (!contestant.lifelines.fiftyFifty) return;
      contestant.lifelines.fiftyFifty = false;

      const wrong = options.filter((o: string) => o.trim().toLowerCase() !== q.answer.trim().toLowerCase());
      const remaining = [q.answer, shuffle(wrong)[0]].filter(Boolean);
      io.to(data.pin).emit('millionaire:fifty_fifty', { remaining: shuffle(remaining) });

    } else if (data.type === 'poll') {
      if (!contestant.lifelines.pollTheClass) return;
      contestant.lifelines.pollTheClass = false;

      io.to(data.pin).emit('poll_class_start', { question: q.question, options, timeLimit: 15 });

      const votes: Record<string, number> = {};
      for (const opt of options) votes[opt] = 0;
      (room as any).pollVotes = votes;

      setTimeout(() => {
        const r = getRoom(data.pin);
        const storedVotes = ((r ?? room) as any).pollVotes as Record<string, number>;
        const total = Object.values(storedVotes).reduce((a, b) => a + b, 0) || 1;
        const percentages: Record<string, number> = {};
        for (const [opt, count] of Object.entries(storedVotes))
          percentages[opt] = Math.round((count / total) * 100);
        io.to(data.pin).emit('millionaire:poll_results', { votes: storedVotes, percentages });
      }, 15_000);

    } else if (data.type === 'phone') {
      if (!contestant.lifelines.phoneAFriend) return;
      contestant.lifelines.phoneAFriend = false;

      const others = Array.from(room.players.values()).filter(p => p.socketId !== room.millionaireContestant);
      if (others.length === 0) {
        // No-devices: just show a timer modal
        io.to(data.pin).emit('phone_a_friend_started', { friendName: 'a friend', timeLimit: 30 });
        setTimeout(() => io.to(data.pin).emit('phone_a_friend_ended', { friendName: 'a friend' }), 30_000);
        return;
      }
      const friend = others[Math.floor(Math.random() * others.length)];
      io.to(friend.socketId).emit('phone_a_friend_request', { question: q.question, options, timeLimit: 30, calledBy: contestant.name });
      io.to(data.pin).emit('phone_a_friend_started', { friendName: friend.name, timeLimit: 30 });
      setTimeout(() => io.to(data.pin).emit('phone_a_friend_ended', { friendName: friend.name }), 30_000);
    }
  });

  // Audience votes in poll
  socket.on('poll_vote', (data: { pin: string; answer: string }) => {
    const room = getRoom(data.pin);
    if (!room) return;
    const votes = (room as any).pollVotes as Record<string, number> | undefined;
    if (votes && votes[data.answer] !== undefined) votes[data.answer]++;
  });

  // Phone friend response
  socket.on('phone_friend_response', (data: { pin: string; suggestion: string }) => {
    const room = getRoom(data.pin);
    if (!room) return;
    io.to(data.pin).emit('phone_a_friend_response', { suggestion: data.suggestion });
  });
}
