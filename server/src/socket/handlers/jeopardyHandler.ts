import { Server, Socket } from 'socket.io';
import {
  getRoom,
  getLeaderboard,
  QuestionData,
} from '../gameRooms';
import { saveBuzzerEvent } from '../../services/sessionService';
import { db } from '../../config/database';

interface JeopardyBoard {
  categories: string[];
  clues: JeopardyClue[][];  // [categoryIndex][valueIndex]
}

interface JeopardyClue {
  question: string;
  answer: string;
  points: number;
  used: boolean;
  questionId?: number;
}

// Build a 5×5 Jeopardy board from the question list
function buildBoard(questions: QuestionData[]): JeopardyBoard {
  const POINT_VALUES = [100, 200, 300, 400, 500];

  // Group by category
  const categoryMap = new Map<string, QuestionData[]>();
  for (const q of questions) {
    const cat = q.category || 'General';
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(q);
  }

  const categories = Array.from(categoryMap.keys()).slice(0, 5);
  // Pad to 5 categories if needed
  while (categories.length < 5) categories.push(`Category ${categories.length + 1}`);

  const clues: JeopardyClue[][] = categories.map((cat) => {
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
  // Host starts game, build board
  socket.on('jeopardy_start', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'jeopardy') return;

    const board = buildBoard(room.questions);
    (room as unknown as Record<string, unknown>)['jeopardyBoard'] = board;
    room.phase = 'playing';

    io.to(data.pin).emit('jeopardy_board', {
      categories: board.categories,
      clues: board.clues.map((col) =>
        col.map((c) => ({ points: c.points, used: c.used })),
      ),
    });
  });

  // Host selects a clue
  socket.on('select_clue', (data: { pin: string; categoryIndex: number; valueIndex: number }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const board = (room as unknown as Record<string, unknown>)['jeopardyBoard'] as JeopardyBoard | undefined;
    if (!board) return;

    const clue = board.clues[data.categoryIndex]?.[data.valueIndex];
    if (!clue || clue.used) return;

    // Reset buzzer queue
    room.buzzerQueue = [];
    room.phase = 'question';
    room.timerStarted = Date.now();

    io.to(data.pin).emit('clue_shown', {
      categoryIndex: data.categoryIndex,
      valueIndex:    data.valueIndex,
      category:      board.categories[data.categoryIndex],
      question:      clue.question,
      points:        clue.points,
    });

    // Auto-close buzzer after 10 seconds
    setTimeout(() => {
      const r = getRoom(data.pin);
      if (r && r.phase === 'question') {
        io.to(data.pin).emit('clue_timeout', { categoryIndex: data.categoryIndex, valueIndex: data.valueIndex });
        r.phase = 'playing';
      }
    }, 10_000);
  });

  // Player buzzes in
  socket.on('buzzer_press', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.phase !== 'question') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const buzzTime = Date.now() - (room.timerStarted ?? Date.now());

    if (room.buzzerQueue.length === 0) {
      // First buzz
      room.buzzerQueue.push(socket.id);
      room.phase = 'answer';
      socket.emit('buzz_accepted', { buzzTime });
      io.to(data.pin).emit('player_buzzed', { playerName: player.name, buzzTime });
    } else if (!room.buzzerQueue.includes(socket.id)) {
      // Queued
      room.buzzerQueue.push(socket.id);
      socket.emit('buzz_rejected', { position: room.buzzerQueue.indexOf(socket.id) });
    }
  });

  // Host marks answer correct/wrong
  socket.on('judge_answer', (data: {
    pin: string;
    categoryIndex: number;
    valueIndex: number;
    correct: boolean;
  }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    const board = (room as unknown as Record<string, unknown>)['jeopardyBoard'] as JeopardyBoard | undefined;
    if (!board) return;

    const clue = board.clues[data.categoryIndex]?.[data.valueIndex];
    if (!clue) return;

    const buzzerId = room.buzzerQueue[0];
    const buzzer = buzzerId ? room.players.get(buzzerId) : undefined;

    if (buzzer) {
      const buzzTime = Date.now() - (room.timerStarted ?? Date.now());

      if (data.correct) {
        buzzer.score += clue.points;
        buzzer.streak++;
        clue.used = true;
        room.buzzerQueue = [];
        room.phase = 'playing';

        saveBuzzerEvent(db, room.settings.sessionId as number ?? 0, buzzer.name, clue.questionId ?? null, buzzTime, true);

        io.to(data.pin).emit('answer_result', {
          playerName: buzzer.name,
          correct:    true,
          points:     clue.points,
          newScore:   buzzer.score,
          answer:     clue.answer,
        });

        io.to(data.pin).emit('board_update', {
          categoryIndex: data.categoryIndex,
          valueIndex:    data.valueIndex,
          used:          true,
        });

        io.to(data.pin).emit('leaderboard_update', { leaderboard: getLeaderboard(room) });
      } else {
        buzzer.score -= clue.points;
        buzzer.streak = 0;
        room.buzzerQueue.shift();

        saveBuzzerEvent(db, room.settings.sessionId as number ?? 0, buzzer.name, clue.questionId ?? null, buzzTime, false);

        io.to(data.pin).emit('answer_result', {
          playerName: buzzer.name,
          correct:    false,
          points:     -clue.points,
          newScore:   buzzer.score,
        });

        // If more players in queue, let next player answer
        if (room.buzzerQueue.length > 0) {
          const nextId = room.buzzerQueue[0];
          const nextPlayer = room.players.get(nextId);
          room.phase = 'answer';
          io.to(nextId).emit('buzz_accepted', { buzzTime: 0 });
          io.to(data.pin).emit('player_buzzed', { playerName: nextPlayer?.name, buzzTime: 0 });
        } else {
          // No more players — mark clue used anyway
          clue.used = true;
          room.phase = 'playing';
          io.to(data.pin).emit('clue_expired', {
            categoryIndex: data.categoryIndex,
            valueIndex:    data.valueIndex,
            answer:        clue.answer,
          });
          io.to(data.pin).emit('board_update', {
            categoryIndex: data.categoryIndex,
            valueIndex:    data.valueIndex,
            used:          true,
          });
        }
      }
    }
  });

  socket.on('jeopardy_end', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;

    room.phase = 'ended';
    io.to(data.pin).emit('game_over', { leaderboard: getLeaderboard(room) });
  });
}
