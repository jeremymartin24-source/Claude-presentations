import { Server, Socket } from 'socket.io';
import { getRoom, getLeaderboard, EscapePuzzle } from '../gameRooms';
import { shuffle } from '../../utils/shuffle';

const HINT_COST   = 50;
const PUZZLES_PER_ROOM = 5;

const roomTimers = new Map<string, ReturnType<typeof setInterval>>();

function clearTimer(pin: string): void {
  const t = roomTimers.get(pin);
  if (t) { clearInterval(t); roomTimers.delete(pin); }
}

function sendPuzzle(io: Server, pin: string, teamId: string, puzzleIndex: number): void {
  const room = getRoom(pin);
  if (!room) return;

  const puzzles = getTeamPuzzles(room as unknown as Record<string, unknown>, teamId);
  if (!puzzles || puzzleIndex >= puzzles.length) {
    // Team escaped!
    teamEscaped(io, pin, teamId);
    return;
  }

  const puzzle = puzzles[puzzleIndex];
  const q = puzzle.question;

  let options: string[] = [];
  if (q.options) {
    try { options = Array.isArray(q.options) ? q.options : JSON.parse(q.options as unknown as string); } catch { options = []; }
  }

  io.to(teamId).emit('puzzle_shown', {
    puzzleIndex,
    totalPuzzles: puzzles.length,
    question:  q.question,
    options,
    hint:      q.hint,
    points:    q.points ?? 100,
    hintCost:  HINT_COST,
  });
}

function getTeamPuzzles(room: Record<string, unknown>, teamId: string): EscapePuzzle[] | undefined {
  const allPuzzles = (room['teamPuzzles'] as Record<string, EscapePuzzle[]> | undefined)?.[teamId];
  return allPuzzles;
}

function teamEscaped(io: Server, pin: string, teamId: string): void {
  const room = getRoom(pin);
  if (!room) return;

  const elapsed = Date.now() - ((room as unknown as Record<string, unknown>)['startTime'] as number ?? Date.now());
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  // Award time bonus
  const teamScore = room.teamScores?.get(teamId) ?? 0;
  const timeBonus = Math.max(0, 1000 - Math.floor(elapsed / 1000) * 5);
  room.teamScores?.set(teamId, teamScore + timeBonus);

  io.to(pin).emit('room_escaped', {
    team:      teamId,
    time:      `${minutes}:${seconds.toString().padStart(2, '0')}`,
    timeMs:    elapsed,
    bonus:     timeBonus,
    leaderboard: getLeaderboard(room),
  });

  // Check if all teams have escaped
  const allPuzzles = (room as unknown as Record<string, unknown>)['teamPuzzles'] as Record<string, EscapePuzzle[]> | undefined;
  if (allPuzzles) {
    const allEscaped = Object.values(allPuzzles).every((puzzles) => puzzles.every((p) => p.solved));
    if (allEscaped) {
      clearTimer(pin);
      room.phase = 'ended';
      io.to(pin).emit('game_over', {
        message:     'All teams have escaped!',
        teamScores:  Object.fromEntries(room.teamScores ?? new Map()),
        leaderboard: getLeaderboard(room),
      });
    }
  }
}

export function registerEscapeRoomHandlers(io: Server, socket: Socket): void {
  socket.on('escape_start', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'escape_room') return;

    const teams = room.settings.teams as string[] | undefined ?? ['Team A', 'Team B'];
    room.settings.teams = teams;
    room.teamScores = new Map();
    for (const t of teams) room.teamScores.set(t, 0);

    // Build puzzle set per team (each gets PUZZLES_PER_ROOM puzzles)
    const allQuestions = room.settings.shuffleQuestions ? shuffle(room.questions) : [...room.questions];
    const teamPuzzles: Record<string, EscapePuzzle[]> = {};

    for (const team of teams) {
      const teamQs = shuffle(allQuestions).slice(0, PUZZLES_PER_ROOM);
      teamPuzzles[team] = teamQs.map((q, i) => ({
        index: i,
        question: q,
        solved: false,
      }));
    }

    (room as unknown as Record<string, unknown>)['teamPuzzles'] = teamPuzzles;
    (room as unknown as Record<string, unknown>)['startTime']   = Date.now();
    (room as unknown as Record<string, unknown>)['teamProgress'] = Object.fromEntries(teams.map((t) => [t, 0]));

    room.phase = 'playing';

    io.to(data.pin).emit('escape_game_started', {
      teams,
      puzzlesPerRoom: PUZZLES_PER_ROOM,
    });

    // Send each team their first puzzle
    for (const team of teams) {
      const teamPlayers = Array.from(room.players.values()).filter((p) => p.team === team);
      for (const player of teamPlayers) {
        sendPuzzle(io, data.pin, team, 0);
        break; // emit once per team (all team members are in team room)
      }
    }

    // Broadcast elapsed time every 10s
    const interval = setInterval(() => {
      const r = getRoom(data.pin);
      if (!r || r.phase === 'ended') { clearInterval(interval); return; }
      const elapsed = Date.now() - ((r as unknown as Record<string, unknown>)['startTime'] as number ?? Date.now());
      io.to(data.pin).emit('escape_timer', { elapsedMs: elapsed });
    }, 10_000);
    roomTimers.set(data.pin, interval);
  });

  // Player submits puzzle answer
  socket.on('puzzle_answer', (data: { pin: string; answer: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'playing') return;
    if (room.gameType !== 'escape_room') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const team = player.team;
    if (!team) return;

    const puzzles = getTeamPuzzles(room as unknown as Record<string, unknown>, team);
    if (!puzzles) return;

    const progress = ((room as unknown as Record<string, unknown>)['teamProgress'] as Record<string, number>)?.[team] ?? 0;
    const currentPuzzle = puzzles[progress];
    if (!currentPuzzle || currentPuzzle.solved) return;

    const correct = data.answer.trim().toLowerCase() === currentPuzzle.question.answer.trim().toLowerCase();

    if (correct) {
      currentPuzzle.solved = true;
      currentPuzzle.solvedBy = player.name;

      const pts = currentPuzzle.question.points ?? 100;
      player.score += pts;
      room.teamScores?.set(team, (room.teamScores.get(team) ?? 0) + pts);

      const nextProgress = progress + 1;
      ((room as unknown as Record<string, unknown>)['teamProgress'] as Record<string, number>)[team] = nextProgress;

      io.to(data.pin).emit('puzzle_unlocked', {
        team,
        puzzleIndex:  progress,
        solvedBy:     player.name,
        nextPuzzle:   nextProgress,
        totalPuzzles: PUZZLES_PER_ROOM,
        teamScore:    room.teamScores?.get(team),
      });

      if (nextProgress >= PUZZLES_PER_ROOM) {
        teamEscaped(io, data.pin, team);
      } else {
        sendPuzzle(io, data.pin, team, nextProgress);
      }
    } else {
      socket.emit('puzzle_wrong', {
        message:  'Incorrect. Try again!',
        hint:     currentPuzzle.question.hint,
      });
    }
  });

  // Player requests a hint
  socket.on('use_hint', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room) return;
    if (room.gameType !== 'escape_room') return;

    const player = room.players.get(socket.id);
    if (!player || !player.team) return;

    const team    = player.team;
    const puzzles = getTeamPuzzles(room as unknown as Record<string, unknown>, team);
    if (!puzzles) return;

    const progress = ((room as unknown as Record<string, unknown>)['teamProgress'] as Record<string, number>)?.[team] ?? 0;
    const puzzle   = puzzles[progress];
    if (!puzzle) return;

    if (player.score < HINT_COST) {
      socket.emit('hint_denied', { reason: 'Not enough points to use a hint.' });
      return;
    }

    player.score -= HINT_COST;
    room.teamScores?.set(team, Math.max(0, (room.teamScores.get(team) ?? 0) - HINT_COST));

    io.to(data.pin).emit('hint_used', {
      team,
      cost:        HINT_COST,
      hint:        puzzle.question.hint ?? 'No hint available.',
      playerScore: player.score,
    });
  });

  socket.on('escape_end', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    clearTimer(data.pin);
    room.phase = 'ended';
    io.to(data.pin).emit('game_over', {
      teamScores:  Object.fromEntries(room.teamScores ?? new Map()),
      leaderboard: getLeaderboard(room),
    });
  });
}
