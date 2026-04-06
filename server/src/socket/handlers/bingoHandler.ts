import { Server, Socket } from 'socket.io';
import { getRoom, getLeaderboard, Player } from '../gameRooms';
import { shuffle } from '../../utils/shuffle';

const CARD_SIZE = 5;
const FREE_SPACE = 'FREE';

/** Generate a unique 5×5 bingo card from the term pool. */
function generateBingoCard(terms: string[]): string[][] {
  const shuffled = shuffle([...terms]);
  const picked = shuffled.slice(0, CARD_SIZE * CARD_SIZE - 1); // 24 terms + FREE

  // Insert FREE in center (index 12 of 25)
  picked.splice(12, 0, FREE_SPACE);

  const card: string[][] = [];
  for (let r = 0; r < CARD_SIZE; r++) {
    card.push(picked.slice(r * CARD_SIZE, (r + 1) * CARD_SIZE));
  }
  return card;
}

/** Convert 2D card to flat array for storage on the player object. */
function flattenCard(card: string[][]): string[] {
  return card.flat();
}

/** Check if a flat 25-element card has a bingo (row/col/diagonal). */
function checkBingo(marked: boolean[]): boolean {
  const idx = (r: number, c: number) => r * CARD_SIZE + c;

  for (let i = 0; i < CARD_SIZE; i++) {
    // Row
    if ([0,1,2,3,4].every((c) => marked[idx(i, c)])) return true;
    // Column
    if ([0,1,2,3,4].every((r) => marked[idx(r, i)])) return true;
  }
  // Diagonals
  if ([0,1,2,3,4].every((i) => marked[idx(i, i)])) return true;
  if ([0,1,2,3,4].every((i) => marked[idx(i, CARD_SIZE - 1 - i)])) return true;

  return false;
}

/** Check if all 25 squares are marked (blackout). */
function checkBlackout(marked: boolean[]): boolean {
  return marked.every(Boolean);
}

export function registerBingoHandlers(io: Server, socket: Socket): void {
  socket.on('bingo_start', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'bingo') return;

    // Collect all answer terms from questions
    const terms = room.questions.map((q) => q.answer).filter(Boolean);
    if (terms.length < 24) {
      socket.emit('bingo_error', { message: `Need at least 24 terms, got ${terms.length}` });
      return;
    }
    room.bingoTerms = terms;
    room.bingoCalledTerms = [];
    room.currentQuestion = 0;
    room.phase = 'playing';

    // Assign each player a unique card
    for (const player of room.players.values()) {
      const card = generateBingoCard(terms);
      player.bingoCard  = flattenCard(card);
      player.calledTerms = new Set([FREE_SPACE]); // free space starts marked
      io.to(player.socketId).emit('bingo_card', {
        card,
        freeSpace: { row: 2, col: 2 },
      });
    }

    io.to(data.pin).emit('bingo_game_started', {
      totalTerms: terms.length,
      players: Array.from(room.players.values()).map((p) => p.name),
    });
  });

  // Host calls the next definition
  socket.on('bingo_call_next', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    if (room.gameType !== 'bingo') return;

    const allTerms   = room.bingoTerms ?? [];
    const called     = room.bingoCalledTerms ?? [];
    const remaining  = allTerms.filter((t) => !called.includes(t));

    if (remaining.length === 0) {
      io.to(data.pin).emit('bingo_all_called', { message: 'All terms have been called!' });
      return;
    }

    const idx        = room.currentQuestion % remaining.length;
    const q          = room.questions.find((q) => q.answer === remaining[idx]) ?? room.questions[room.currentQuestion];
    const termCalled = q.answer;

    room.bingoCalledTerms = [...called, termCalled];
    room.currentQuestion++;

    io.to(data.pin).emit('bingo_called', {
      definition: q.question,
      term:       termCalled,          // host screen shows the term; student cards auto-mark
      callNumber: room.bingoCalledTerms.length,
      calledSoFar: room.bingoCalledTerms,
    });
  });

  // Player marks a square on their card
  socket.on('bingo_mark', (data: { pin: string; term: string }) => {
    const room = getRoom(data.pin);
    if (!room) return;
    if (room.gameType !== 'bingo') return;

    const player = room.players.get(socket.id);
    if (!player || !player.bingoCard) return;

    // Only allow marking if the term has been called
    const called = room.bingoCalledTerms ?? [];
    if (!called.includes(data.term) && data.term !== FREE_SPACE) {
      socket.emit('bingo_mark_rejected', { reason: 'Term has not been called yet.' });
      return;
    }

    player.calledTerms = player.calledTerms ?? new Set();
    player.calledTerms.add(data.term);

    // Build marked array
    const marked = player.bingoCard.map((t) => (player.calledTerms as Set<string>).has(t));

    const hasBingo    = checkBingo(marked);
    const hasBlackout = checkBlackout(marked);

    socket.emit('bingo_mark_confirmed', { term: data.term, marked });

    if (hasBlackout) {
      player.score += 1000;
      io.to(data.pin).emit('bingo_blackout', {
        playerName: player.name,
        message:    `🟡 BLACKOUT! ${player.name} marked every square!`,
        leaderboard: getLeaderboard(room),
      });
    } else if (hasBingo) {
      player.score += 500;
      io.to(data.pin).emit('bingo_winner', {
        playerName: player.name,
        message:    `BINGO! ${player.name} got a line!`,
        leaderboard: getLeaderboard(room),
      });
    }
  });

  // Player calls BINGO (verbal / button)
  socket.on('call_bingo', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (!player || !player.bingoCard) return;

    const marked    = player.bingoCard.map((t) => (player.calledTerms as Set<string> | undefined)?.has(t) ?? false);
    const hasBingo  = checkBingo(marked);

    if (hasBingo) {
      player.score += 500;
      io.to(data.pin).emit('bingo_validated', {
        playerName: player.name,
        valid:      true,
        leaderboard: getLeaderboard(room),
      });
    } else {
      // False bingo — penalty
      player.score = Math.max(0, player.score - 100);
      socket.emit('bingo_invalid', { penalty: 100, message: 'Invalid BINGO — check your card!' });
      io.to(data.pin).emit('bingo_false_alarm', { playerName: player.name });
    }
  });

  socket.on('bingo_end', (data: { pin: string }) => {
    const room = getRoom(data.pin);
    if (!room || room.hostSocketId !== socket.id) return;
    room.phase = 'ended';
    io.to(data.pin).emit('game_over', { leaderboard: getLeaderboard(room) });
  });
}
