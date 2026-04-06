import { Server, Socket } from 'socket.io';
import { getRoom, getLeaderboard } from '../gameRooms';
import { shuffle } from '../../utils/shuffle';

const LADDER = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000];
const SAFE_HAVENS = [4, 9]; // indices of guaranteed prizes (after wrong answer, keep this)

function getSafeAmount(level: number): number {
  let safe = 0;
  for (const idx of SAFE_HAVENS) {
    if (level > idx) safe = LADDER[idx];
  }
  return safe;
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

  let options: string[] = [];
  if (q.options) {
    try { options = Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string); } catch { options = []; }
  }

  const contestant = room.millionaireContestant
    ? room.players.get(room.millionaireContestant)
    : undefined;

  io.to(pin).emit('millionaire_question', {
    level,
    prizeMoney:  LADDER[level],
    question:    q.question,
    options,
    contestant:  contestant?.name ?? 'Contestant',
    safeAmount:  getSafeAmount(level),
    lifelines:   contestant?.lifelines,
  });
}

function endGame(io: Server, pin: string, won: boolean): void {
  const room = getRoom(pin);
  if (!room) return;
  room.phase = 'ended';

  const level   = room.millionaireLevel ?? 0;
  const winnings = won ? LADDER[level - 1] ?? 0 : getSafeAmount(level);

  const contestant = room.millionaireContestant
    ? room.players.get(room.millionaireContestant)
    : undefined;

  if (contestant) {
    contestant.score += winnings;
  }

  io.to(pin).emit('game_over', {
    contestant: contestant?.name,
    winnings,
    won,
    leaderboard: getLeaderboard(room),
  });
}

export function registerMillionaireHandlers(io: Server, socket: Socket): void {
  socket.on('millionaire_start', (data: { pin: string; contestantSocketId?: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'millionaire') return;

    if (room.settings.shuffleQuestions) room.questions = shuffle(room.questions);
    room.millionaireLevel = 0;
    room.phase = 'playing';

    // Pick contestant
    if (data.contestantSocketId && room.players.has(data.contestantSocketId)) {
      room.millionaireContestant = data.contestantSocketId;
    } else {
      const playerIds = Array.from(room.players.keys());
      room.millionaireContestant = playerIds[Math.floor(Math.random() * playerIds.length)];
    }

    const contestant = room.players.get(room.millionaireContestant!);
    if (contestant) {
      contestant.lifelines = { fiftyFifty: true, pollTheClass: true, phoneAFriend: true };
    }

    io.to(data.pin).emit('millionaire_contestant_selected', {
      name: contestant?.name,
      socketId: room.millionaireContestant,
    });

    setTimeout(() => sendQuestion(io, data.pin), 2000);
  });

  // Contestant submits answer
  socket.on('millionaire_answer', (data: { pin: string; answer: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'question') return;
    if (room.gameType !== 'millionaire') return;
    if (room.millionaireContestant !== socket.id) return;

    const level = room.millionaireLevel ?? 0;
    const q = room.questions[level];
    const correct = data.answer.trim().toLowerCase() === q.answer.trim().toLowerCase();

    if (correct) {
      room.millionaireLevel = level + 1;
      const nextPrize = LADDER[room.millionaireLevel] ?? 0;

      io.to(data.pin).emit('millionaire_correct', {
        answer:      q.answer,
        prizeMoney:  LADDER[level],
        nextPrize,
        level:       room.millionaireLevel,
      });

      if (room.millionaireLevel >= LADDER.length) {
        setTimeout(() => endGame(io, data.pin, true), 3000);
      } else {
        setTimeout(() => sendQuestion(io, data.pin), 4000);
      }
    } else {
      const safeAmount = getSafeAmount(level);
      const contestant = room.players.get(socket.id);
      if (contestant) contestant.score += safeAmount;

      io.to(data.pin).emit('millionaire_wrong', {
        correctAnswer: q.answer,
        givenAnswer:   data.answer,
        safeAmount,
      });
      setTimeout(() => endGame(io, data.pin, false), 4000);
    }
  });

  // Contestant walks away
  socket.on('millionaire_walk_away', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room) return;
    if (room.millionaireContestant !== socket.id) return;

    const level     = room.millionaireLevel ?? 0;
    const walkMoney = level > 0 ? LADDER[level - 1] : 0;
    const contestant = room.players.get(socket.id);
    if (contestant) contestant.score += walkMoney;

    io.to(data.pin).emit('millionaire_walk_away', {
      contestant: contestant?.name,
      winnings:   walkMoney,
    });
    setTimeout(() => endGame(io, data.pin, false), 3000);
  });

  // Use 50/50 lifeline
  socket.on('lifeline_fifty_fifty', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'question') return;
    if (room.millionaireContestant !== socket.id) return;

    const contestant = room.players.get(socket.id);
    if (!contestant?.lifelines?.fiftyFifty) return;
    contestant.lifelines.fiftyFifty = false;

    const level = room.millionaireLevel ?? 0;
    const q = room.questions[level];
    let options: string[] = [];
    try { options = Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string); } catch { options = []; }

    // Keep the correct answer and one random wrong answer
    const wrong = options.filter((o) => o !== q.answer);
    const shuffledWrong = shuffle(wrong);
    const remaining = [q.answer, shuffledWrong[0]].filter(Boolean);

    io.to(data.pin).emit('lifeline_fifty_fifty', { remaining: shuffle(remaining) });
  });

  // Poll the class lifeline
  socket.on('lifeline_poll_class', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'question') return;
    if (room.millionaireContestant !== socket.id) return;

    const contestant = room.players.get(socket.id);
    if (!contestant?.lifelines?.pollTheClass) return;
    contestant.lifelines.pollTheClass = false;

    const level = room.millionaireLevel ?? 0;
    const q     = room.questions[level];

    let options: string[] = [];
    try { options = Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string); } catch { options = []; }

    // Ask audience — emit poll to all players (excluding contestant)
    io.to(data.pin).emit('poll_class_start', {
      question: q.question,
      options,
      timeLimit: 15,
    });

    const votes: Record<string, number> = {};
    for (const opt of options) votes[opt] = 0;
    (room as unknown as Record<string, unknown>)['pollVotes'] = votes;

    // Collect votes for 15 seconds then reveal
    setTimeout(() => {
      const r = getRoom(data.pin);
      const storedVotes = ((r ?? room) as unknown as Record<string, unknown>)['pollVotes'] as Record<string, number>;
      const total = Object.values(storedVotes).reduce((a, b) => a + b, 0) || 1;
      const percentages: Record<string, number> = {};
      for (const [opt, count] of Object.entries(storedVotes)) {
        percentages[opt] = Math.round((count / total) * 100);
      }
      io.to(data.pin).emit('poll_class_results', { votes: storedVotes, percentages });
    }, 15_000);
  });

  // Audience submits poll vote
  socket.on('poll_vote', (data: { pin: string; answer: string }) => {
    const room = getRoom(data.pin);
    if (!room) return;
    const votes = (room as unknown as Record<string, unknown>)['pollVotes'] as Record<string, number> | undefined;
    if (!votes) return;
    if (votes[data.answer] !== undefined) votes[data.answer]++;
  });

  // Phone a friend lifeline
  socket.on('lifeline_phone_friend', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'question') return;
    if (room.millionaireContestant !== socket.id) return;

    const contestant = room.players.get(socket.id);
    if (!contestant?.lifelines?.phoneAFriend) return;
    contestant.lifelines.phoneAFriend = false;

    const otherPlayers = Array.from(room.players.values()).filter((p) => p.socketId !== socket.id);
    if (otherPlayers.length === 0) return;

    const friend = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
    const level  = room.millionaireLevel ?? 0;
    const q      = room.questions[level];

    let options: string[] = [];
    try { options = Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string); } catch { options = []; }

    // Notify the selected "friend" and give them 30 seconds
    io.to(friend.socketId).emit('phone_a_friend_request', {
      question:   q.question,
      options,
      timeLimit:  30,
      calledBy:   contestant.name,
    });

    io.to(data.pin).emit('phone_a_friend_started', {
      friendName: friend.name,
      timeLimit:  30,
    });

    // Auto-end call after 30s
    setTimeout(() => {
      io.to(data.pin).emit('phone_a_friend_ended', { friendName: friend.name });
    }, 30_000);
  });

  // Friend sends their answer suggestion
  socket.on('phone_friend_response', (data: { pin: string; suggestion: string }) => {
    const room = getRoom(data.pin);
    if (!room) return;
    io.to(data.pin).emit('phone_a_friend_response', {
      suggestion: data.suggestion,
    });
  });

  socket.on('millionaire_next_contestant', (data: { pin: string; contestantSocketId?: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    if (data.contestantSocketId && room.players.has(data.contestantSocketId)) {
      room.millionaireContestant = data.contestantSocketId;
    } else {
      const ids = Array.from(room.players.keys());
      room.millionaireContestant = ids[Math.floor(Math.random() * ids.length)];
    }

    room.millionaireLevel = 0;
    const contestant = room.players.get(room.millionaireContestant!);
    if (contestant) {
      contestant.lifelines = { fiftyFifty: true, pollTheClass: true, phoneAFriend: true };
    }

    io.to(data.pin).emit('millionaire_contestant_selected', {
      name: contestant?.name,
      socketId: room.millionaireContestant,
    });

    setTimeout(() => sendQuestion(io, data.pin), 2000);
  });
}
