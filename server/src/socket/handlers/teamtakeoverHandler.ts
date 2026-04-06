import { Server, Socket } from 'socket.io';
import { getRoom, getLeaderboard } from '../gameRooms';
import { shuffle } from '../../utils/shuffle';

const GRID_SIZE = 6;
const questionTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimer(pin: string): void {
  const t = questionTimers.get(pin);
  if (t) { clearTimeout(t); questionTimers.delete(pin); }
}

function initGrid(): string[][] {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
}

function getTeamTerritoryCount(grid: string[][], team: string): number {
  return grid.flat().filter((t) => t === team).length;
}

function getAdjacentCells(grid: string[][], team: string): Array<[number, number]> {
  const adjacent = new Set<string>();
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === team) {
        const neighbors: Array<[number, number]> = [
          [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
        ];
        for (const [nr, nc] of neighbors) {
          if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && !grid[nr][nc]) {
            adjacent.add(`${nr},${nc}`);
          }
        }
      }
    }
  }
  return Array.from(adjacent).map((s) => s.split(',').map(Number) as [number, number]);
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

  const teams = room.settings.teams as string[] | undefined ?? [];
  const currentTeamIdx = (room.currentQuestion) % teams.length;
  const currentTeam = teams[currentTeamIdx] ?? 'Team 1';
  (room as unknown as Record<string, unknown>)['currentTeam'] = currentTeam;

  io.to(pin).emit('territory_question', {
    index:       room.currentQuestion,
    total:       room.questions.length,
    question:    q.question,
    options:     shuffle(options),
    timeLimit:   q.time_limit ?? 30,
    points:      q.points ?? 100,
    currentTeam,
    grid:        room.territories,
    teamScores:  Object.fromEntries(room.teamScores ?? new Map()),
  });

  const timer = setTimeout(() => revealTerritoryAnswer(io, pin, false), (q.time_limit ?? 30) * 1000);
  questionTimers.set(pin, timer);
}

function revealTerritoryAnswer(io: Server, pin: string, correct: boolean, claimRow?: number, claimCol?: number): void {
  clearTimer(pin);
  const room = getRoom(pin);
  if (!room) return;

  const q = room.questions[room.currentQuestion];
  room.phase = 'answer';

  const currentTeam = (room as unknown as Record<string, unknown>)['currentTeam'] as string | undefined ?? '';

  if (correct && claimRow !== undefined && claimCol !== undefined) {
    if (room.territories) {
      room.territories[claimRow][claimCol] = currentTeam;
      const count = getTeamTerritoryCount(room.territories, currentTeam);
      room.teamScores = room.teamScores ?? new Map();
      room.teamScores.set(currentTeam, (room.teamScores.get(currentTeam) ?? 0) + (q.points ?? 100));

      io.to(pin).emit('territory_update', {
        grid:       room.territories,
        teamScores: Object.fromEntries(room.teamScores),
        claimingTeam: currentTeam,
        row: claimRow,
        col: claimCol,
        territories: count,
      });
    }
  } else {
    io.to(pin).emit('territory_missed', { team: currentTeam, correctAnswer: q.answer });
  }

  io.to(pin).emit('territory_answer_reveal', {
    correctAnswer: q.answer,
    leaderboard:   getLeaderboard(room),
  });

  room.currentQuestion++;
  setTimeout(() => sendQuestion(io, pin), 4000);
}

function endGame(io: Server, pin: string): void {
  const room = getRoom(pin);
  if (!room) return;
  room.phase = 'ended';

  const teamScores = Object.fromEntries(room.teamScores ?? new Map());
  const grid = room.territories;

  // Tally territory counts
  const territoryCounts: Record<string, number> = {};
  if (grid) {
    for (const row of grid) {
      for (const cell of row) {
        if (cell) territoryCounts[cell] = (territoryCounts[cell] ?? 0) + 1;
      }
    }
  }

  const winner = Object.entries(territoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No winner';

  io.to(pin).emit('game_over', {
    winner,
    territoryCounts,
    teamScores,
    grid,
    leaderboard: getLeaderboard(room),
  });
}

export function registerTeamTakeoverHandlers(io: Server, socket: Socket): void {
  socket.on('territory_start', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'team_takeover') return;

    room.territories = initGrid();
    room.teamScores  = new Map();
    if (room.settings.shuffleQuestions) room.questions = shuffle(room.questions);
    room.currentQuestion = 0;
    room.phase = 'playing';

    const teams = room.settings.teams as string[] | undefined ?? ['Red Team', 'Blue Team', 'Green Team'];
    room.settings.teams = teams;
    for (const t of teams) room.teamScores.set(t, 0);

    io.to(data.pin).emit('game_starting', {
      totalQuestions: room.questions.length,
      teams,
      gridSize: GRID_SIZE,
      grid: room.territories,
    });

    setTimeout(() => sendQuestion(io, data.pin), 3000);
  });

  // Team answers the question
  socket.on('territory_answer', (data: { pin: string; answer: string; row?: number; col?: number }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'question') return;
    if (room.gameType !== 'team_takeover') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const currentTeam = (room as unknown as Record<string, unknown>)['currentTeam'] as string | undefined;
    if (player.team !== currentTeam) return; // Only active team answers

    const q = room.questions[room.currentQuestion];
    const correct = data.answer.trim().toLowerCase() === q.answer.trim().toLowerCase();

    if (correct) {
      clearTimer(data.pin);

      // Determine which cell to claim
      let claimRow = data.row ?? -1;
      let claimCol = data.col ?? -1;

      if (room.territories) {
        const teamCount = getTeamTerritoryCount(room.territories, currentTeam ?? '');

        if (teamCount === 0) {
          // First territory — claim any empty cell
          for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
              if (!room.territories[r][c]) {
                claimRow = r; claimCol = c; break;
              }
            }
            if (claimRow >= 0) break;
          }
        } else if (claimRow < 0 || claimCol < 0) {
          // No cell specified — pick a random adjacent empty cell
          const adjacent = getAdjacentCells(room.territories, currentTeam ?? '');
          if (adjacent.length > 0) {
            [claimRow, claimCol] = adjacent[Math.floor(Math.random() * adjacent.length)];
          }
        }
      }

      player.score += q.points ?? 100;
      player.streak++;
      revealTerritoryAnswer(io, data.pin, true, claimRow, claimCol);
    } else {
      player.streak = 0;
      socket.emit('territory_answer_wrong', { correctAnswer: q.answer });
    }
  });

  socket.on('territory_end', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    clearTimer(data.pin);
    endGame(io, data.pin);
  });
}
