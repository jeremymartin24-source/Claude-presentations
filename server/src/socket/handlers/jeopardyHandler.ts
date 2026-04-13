import { Server, Socket } from 'socket.io';
import { getRoom, getLeaderboard, QuestionData } from '../gameRooms';
import { saveBuzzerEvent } from '../../services/sessionService';
import { db } from '../../config/database';

interface JeopardyClue {
  question: string;
  answer: string;
  points: number;
  used: boolean;
  questionId?: number;
}

interface JeopardyBoard {
  categories: string[];
  clues: JeopardyClue[][];  // [categoryIndex][valueIndex]
}

const POINT_VALUES = [100, 200, 300, 400, 500];

// Track currently active clue per game (pin → { categoryIndex, valueIndex })
const activeClues = new Map<string, { categoryIndex: number; valueIndex: number }>();

function buildBoard(questions: QuestionData[]): JeopardyBoard {
  const categoryMap = new Map<string, QuestionData[]>();
  for (const q of questions) {
    const cat = q.category || 'General';
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(q);
  }

  const categories = Array.from(categoryMap.keys()).slice(0, 5);
  while (categories.length < 5) categories.push(`Category ${categories.length + 1}`);

  const clues: JeopardyClue[][] = categories.map(cat => {
    const catQuestions = categoryMap.get(cat) || [];
    return POINT_VALUES.map((pts, i) => {
      const q = catQuestions[i];
      return {
        question:   q?.question || `${cat} for ${pts}`,
        answer:     q?.answer   || 'N/A',
        points:     pts,
        used:       false,
        questionId: q?.id,
      };
    });
  });

  return { categories, clues };
}

export function registerJeopardyHandlers(io: Server, socket: Socket): void {

  // Host starts game — build board and send full clue data to host
  socket.on('jeopardy:start', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'jeopardy') return;

    const board = buildBoard(room.questions);
    (room as any).jeopardyBoard = board;
    room.phase = 'playing';

    // Send full board including question text so host view can display real questions
    socket.emit('jeopardy:board_state', {
      categories: board.categories,
      clues: board.clues, // full data — questions, answers, points, used
    });
  });

  // Host selects a clue cell
  socket.on('jeopardy:select_cell', (data: { pin: string; categoryIndex: number; valueIndex: number }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const board = (room as any).jeopardyBoard as JeopardyBoard | undefined;
    if (!board) return;

    const clue = board.clues[data.categoryIndex]?.[data.valueIndex];
    if (!clue || clue.used) return;

    room.buzzerQueue = [];
    room.phase = 'question';
    room.timerStarted = Date.now();
    activeClues.set(data.pin, { categoryIndex: data.categoryIndex, valueIndex: data.valueIndex });

    // Send clue details back to host
    socket.emit('jeopardy:clue_selected', {
      categoryIndex: data.categoryIndex,
      valueIndex:    data.valueIndex,
      category:      board.categories[data.categoryIndex],
      question:      clue.question,
      answer:        clue.answer,
      points:        clue.points,
    });

    // Also broadcast to players (for phone mode)
    io.to(data.pin).emit('clue_shown', {
      categoryIndex: data.categoryIndex,
      valueIndex:    data.valueIndex,
      category:      board.categories[data.categoryIndex],
      question:      clue.question,
      points:        clue.points,
    });

    // Auto-timeout after 10 seconds
    setTimeout(() => {
      const r = getRoom(data.pin);
      if (r && r.phase === 'question') {
        r.phase = 'playing';
        socket.emit('jeopardy:clue_timeout', { categoryIndex: data.categoryIndex, valueIndex: data.valueIndex });
        // Mark clue as used
        const b = (r as any).jeopardyBoard as JeopardyBoard | undefined;
        if (b?.clues[data.categoryIndex]?.[data.valueIndex]) {
          b.clues[data.categoryIndex][data.valueIndex].used = true;
        }
      }
    }, 10_000);
  });

  // Host opens buzzers (phone mode)
  socket.on('jeopardy:open_buzzers', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    room.phase = 'answer';
    room.buzzerQueue = [];
    io.to(data.pin).emit('buzzers_open');
  });

  // Player buzzes in (phone mode)
  socket.on('buzzer_press', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'answer') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const buzzTime = Date.now() - (room.timerStarted ?? Date.now());

    if (!room.buzzerQueue.includes(socket.id)) {
      room.buzzerQueue.push(socket.id);
    }

    if (room.buzzerQueue[0] === socket.id) {
      socket.emit('buzz_accepted', { buzzTime, playerName: player.name });
    } else {
      socket.emit('buzz_rejected', { position: room.buzzerQueue.indexOf(socket.id) });
    }

    io.to(data.pin).emit('player_buzzed', {
      playerName: player.name,
      buzzTime,
      position:   room.buzzerQueue.indexOf(socket.id),
    });
  });

  // No-devices mode: host selects which player "buzzed" verbally
  socket.on('jeopardy:virtual_buzz', (data: { pin: string; playerName: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    // Find the virtual player by name
    const player = Array.from(room.players.values()).find(p => p.name === data.playerName);
    if (!player) return;

    room.phase = 'answer';
    if (!room.buzzerQueue.includes(player.socketId)) {
      room.buzzerQueue.push(player.socketId);
    }

    // Notify host only (no phones to notify)
    socket.emit('player_buzzed', {
      playerName: player.name,
      buzzTime:   0,
      position:   0,
    });
  });

  // Host judges answer correct / wrong
  socket.on('jeopardy:judge', (data: { pin: string; correct: boolean; playerName: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const board  = (room as any).jeopardyBoard as JeopardyBoard | undefined;
    const active = activeClues.get(data.pin);
    if (!board || !active) return;

    const clue   = board.clues[active.categoryIndex]?.[active.valueIndex];
    if (!clue) return;

    // Find buzzing player by name (works for both real and virtual players)
    const buzzer = Array.from(room.players.values()).find(p => p.name === data.playerName);
    if (!buzzer) return;

    const buzzTime = Date.now() - (room.timerStarted ?? Date.now());

    if (data.correct) {
      buzzer.score += clue.points;
      buzzer.streak++;
      clue.used = true;
      room.buzzerQueue = [];
      room.phase = 'playing';
      activeClues.delete(data.pin);

      saveBuzzerEvent(db, (room.settings.sessionId as number) ?? 0, buzzer.name, clue.questionId ?? null, buzzTime, true);

      socket.emit('jeopardy:answer_result', {
        playerName: buzzer.name,
        correct:    true,
        points:     clue.points,
        newScore:   buzzer.score,
        answer:     clue.answer,
        categoryIndex: active.categoryIndex,
        valueIndex:    active.valueIndex,
      });

      socket.emit('leaderboard_update', {
        scores: getLeaderboard(room).map(p => ({ name: p.name, score: p.score })),
      });
    } else {
      buzzer.score = Math.max(0, buzzer.score - clue.points);
      buzzer.streak = 0;

      // Remove this player from queue; if more remain, let next player go
      room.buzzerQueue = room.buzzerQueue.filter(id => id !== buzzer.socketId);

      saveBuzzerEvent(db, (room.settings.sessionId as number) ?? 0, buzzer.name, clue.questionId ?? null, buzzTime, false);

      socket.emit('jeopardy:answer_result', {
        playerName: buzzer.name,
        correct:    false,
        points:     -clue.points,
        newScore:   buzzer.score,
        categoryIndex: active.categoryIndex,
        valueIndex:    active.valueIndex,
      });

      if (room.buzzerQueue.length === 0) {
        // No more players — clue expires
        clue.used = true;
        room.phase = 'playing';
        activeClues.delete(data.pin);
        socket.emit('jeopardy:clue_expired', {
          categoryIndex: active.categoryIndex,
          valueIndex:    active.valueIndex,
          answer:        clue.answer,
        });
      } else {
        // Next player in queue
        const nextPlayer = room.players.get(room.buzzerQueue[0]);
        if (nextPlayer) {
          socket.emit('player_buzzed', { playerName: nextPlayer.name, buzzTime: 0, position: 0 });
        }
      }
    }
  });

  socket.on('jeopardy:end', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    room.phase = 'ended';
    socket.emit('game_over', {
      scores: getLeaderboard(room).map(p => ({ name: p.name, score: p.score })),
    });
  });
}
