import { Server, Socket } from 'socket.io';
import { getRoom } from '../gameRooms';
import { shuffle } from '../../utils/shuffle';

const GRID_SIZE = 6;

function initGrid(): string[][] {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
}

function getAdjacentCells(grid: string[][], team: string): Array<[number, number]> {
  const adjacent = new Set<string>();
  const hasAny = grid.flat().some(c => c === team);
  if (!hasAny) {
    // First claim: any empty cell is valid
    for (let r = 0; r < GRID_SIZE; r++)
      for (let c = 0; c < GRID_SIZE; c++)
        if (!grid[r][c]) adjacent.add(`${r},${c}`);
    return Array.from(adjacent).map(s => s.split(',').map(Number) as [number, number]).slice(0, 4);
  }
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === team) {
        for (const [nr, nc] of [[r-1,c],[r+1,c],[r,c-1],[r,c+1]] as [number,number][]) {
          if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && !grid[nr][nc])
            adjacent.add(`${nr},${nc}`);
        }
      }
    }
  }
  return Array.from(adjacent).map(s => s.split(',').map(Number) as [number, number]);
}

function sendQuestion(io: Server, pin: string): void {
  const room = getRoom(pin);
  if (!room) return;

  if (room.currentQuestion >= room.questions.length) {
    endGame(io, pin);
    return;
  }

  const q = room.questions[room.currentQuestion];
  const teams = (room.settings.teams as string[]) ?? [];
  const currentTeam = teams[room.currentQuestion % teams.length] ?? 'Team 1';
  (room as any).currentTeam = currentTeam;

  let options: string[] = [];
  if (q.options) {
    try { options = Array.isArray(q.options) ? q.options : JSON.parse(q.options as any); } catch { options = []; }
  }

  room.phase = 'question';

  io.to(pin).emit('question_reveal', {
    index:       room.currentQuestion,
    total:       room.questions.length,
    text:        q.question,
    options:     shuffle([...options]),
    correctIndex: options.indexOf(q.answer),
    timeLimit:   q.time_limit ?? 30,
    currentTeam,
    grid:        room.territories,
    teamScores:  Object.fromEntries(room.teamScores ?? new Map()),
  });
}

function endGame(io: Server, pin: string): void {
  const room = getRoom(pin);
  if (!room) return;
  room.phase = 'ended';

  const grid = room.territories;
  const territoryCounts: Record<string, number> = {};
  if (grid) {
    for (const row of grid)
      for (const cell of row)
        if (cell) territoryCounts[cell] = (territoryCounts[cell] ?? 0) + 1;
  }
  const winner = Object.entries(territoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No winner';

  io.to(pin).emit('game_over', {
    winner,
    territoryCounts,
    teamScores: Object.fromEntries(room.teamScores ?? new Map()),
    grid,
  });
}

export function registerTeamTakeoverHandlers(io: Server, socket: Socket): void {

  socket.on('teamtakeover:start', (data: { pin: string; teams?: string[] }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    room.territories = initGrid();
    room.teamScores  = new Map();
    room.currentQuestion = 0;
    room.phase = 'playing';

    const teams: string[] = data.teams || (room.settings.teams as string[]) || ['Team Alpha', 'Team Beta', 'Team Gamma'];
    room.settings.teams = teams;
    for (const t of teams) room.teamScores.set(t, 0);

    if (room.settings.shuffleQuestions) room.questions = shuffle(room.questions);

    sendQuestion(io, data.pin);
  });

  // Host marks current team CORRECT (no-devices mode or phone mode both use this)
  // After correct, server sends claimable cells; host clicks one via teamtakeover:claim
  socket.on('teamtakeover:correct', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const currentTeam = (room as any).currentTeam as string ?? '';
    const grid = room.territories!;
    const adjacent = getAdjacentCells(grid, currentTeam);

    // Tell host which cells can be claimed
    io.to(data.pin).emit('teamtakeover:claimable', {
      cells: adjacent,
      team:  currentTeam,
    });
  });

  // Host selects which cell to award after a correct answer
  socket.on('teamtakeover:claim', (data: { pin: string; row: number; col: number; teamName: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const grid = room.territories!;
    if (grid[data.row]?.[data.col] !== null && grid[data.row]?.[data.col] !== undefined) return; // already taken

    grid[data.row][data.col] = data.teamName;

    room.teamScores = room.teamScores ?? new Map();
    const q = room.questions[room.currentQuestion];
    const prev = room.teamScores.get(data.teamName) ?? 0;
    room.teamScores.set(data.teamName, prev + (q.points ?? 100));

    const territoryCounts: Record<string, number> = {};
    for (const row of grid)
      for (const cell of row)
        if (cell) territoryCounts[cell] = (territoryCounts[cell] ?? 0) + 1;

    io.to(data.pin).emit('territory_update', {
      grid,
      teamScores:  Object.fromEntries(room.teamScores),
      territoryCounts,
    });
  });

  // Host advances to next question (after claim OR after wrong)
  socket.on('teamtakeover:next', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    room.currentQuestion++;
    sendQuestion(io, data.pin);
  });

  // Host marks current team WRONG — rotate to next team and advance
  socket.on('teamtakeover:wrong', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    room.currentQuestion++;
    sendQuestion(io, data.pin);
  });

  // Player (phone mode) submits an answer
  socket.on('territory_answer', (data: { pin: string; answer: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'question') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const currentTeam = (room as any).currentTeam as string;
    if (player.team !== currentTeam) return;

    const q = room.questions[room.currentQuestion];
    const correct = data.answer.trim().toLowerCase() === q.answer.trim().toLowerCase();

    if (correct) {
      io.to(data.pin).emit('teamtakeover:correct_answer', { team: currentTeam });
    } else {
      socket.emit('territory_answer_wrong', { correctAnswer: q.answer });
    }
  });

  socket.on('teamtakeover:end', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    endGame(io, data.pin);
  });
}
