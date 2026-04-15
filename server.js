import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  createRoom, getRoom, deleteRoom, addPlayer, removePlayer,
  selectCharacter, startGame, startFirstTurn, beginTurn,
  useItem, applyWarp, rollDice, movePlayer, continueMove,
  resolveCurrentSpace, submitAnswer, closeQuestion, closeMiniGame,
  buyItem, closeShop, closeEvent, nextTurn, publicState, currentPlayer,
} from './server/gameLogic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = process.env.PORT || 3001;

// Serve the Vite production build
app.use(express.static(join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// ─── Socket.IO handlers ───────────────────────────────────────────────────────

io.on('connection', (socket) => {
  let currentRoomCode = null;
  let isHost = false;

  function getState() {
    if (!currentRoomCode) return null;
    return getRoom(currentRoomCode);
  }

  function broadcast(state) {
    io.to(currentRoomCode).emit('game:state', publicState(state));
  }

  function err(msg) {
    socket.emit('game:error', { message: msg });
  }

  // ── Host: create room ──────────────────────────────────────────────────────
  socket.on('host:create', () => {
    const code = createRoom(socket.id);
    currentRoomCode = code;
    isHost = true;
    socket.join(code);
    socket.emit('game:joined', { code, isHost: true });
    broadcast(getState());
  });

  // ── Player: join room ──────────────────────────────────────────────────────
  socket.on('player:join', ({ name, code }) => {
    const state = getRoom(code?.toUpperCase());
    if (!state) return err('Room not found. Check your code.');
    if (state.phase !== 'lobby') return err('Game already in progress.');

    const player = addPlayer(state, socket.id, name || 'Player');
    if (!player) return err('Could not join. Room may be full or already started.');

    currentRoomCode = state.code;
    socket.join(state.code);
    socket.emit('game:joined', { code: state.code, isHost: false, playerId: socket.id });
    broadcast(state);
  });

  // ── Host: start game (move to character select) ────────────────────────────
  socket.on('host:startGame', () => {
    const state = getState();
    if (!state || !isHost) return err('Unauthorized');
    if (!startGame(state)) return err('Need at least one player');
    broadcast(state);
  });

  // ── Player: select character ───────────────────────────────────────────────
  socket.on('player:selectCharacter', ({ characterId }) => {
    const state = getState();
    if (!state) return err('Not in a room');
    if (!selectCharacter(state, socket.id, characterId)) {
      return err('Character already taken or invalid');
    }
    broadcast(state);
  });

  // ── Host: begin first turn (all characters chosen) ────────────────────────
  socket.on('host:startRound', () => {
    const state = getState();
    if (!state || !isHost) return err('Unauthorized');
    if (!startFirstTurn(state)) return err('Not all players have selected characters');
    broadcast(state);
  });

  // ── Player: use item ───────────────────────────────────────────────────────
  socket.on('player:useItem', ({ itemId, targetPlayerId }) => {
    const state = getState();
    if (!state) return err('Not in a room');
    const result = useItem(state, socket.id, itemId, targetPlayerId);
    if (!result.ok) return err(result.msg);
    broadcast(state);
    // If warp pipe chosen, client will show space selection
  });

  // ── Player: apply warp destination ────────────────────────────────────────
  socket.on('player:warpTo', ({ spaceId }) => {
    const state = getState();
    if (!state) return err('Not in a room');
    if (!applyWarp(state, socket.id, spaceId)) return err('Cannot warp');
    broadcast(state);
  });

  // ── Player: skip item use (or already used, ready to roll) ────────────────
  socket.on('player:skipItem', () => {
    const state = getState();
    if (!state) return err('Not in a room');
    if (state.phase !== 'itemUse' && state.phase !== 'warpSelect') return;
    // just keep phase as itemUse, player can now roll
    broadcast(state);
  });

  // ── Player: roll dice ──────────────────────────────────────────────────────
  socket.on('player:roll', () => {
    const state = getState();
    if (!state) return err('Not in a room');
    const cp = currentPlayer(state);
    if (!cp || cp.id !== socket.id) return err('Not your turn');

    const rollResult = rollDice(state, socket.id);
    if (!rollResult.ok) return err(rollResult.msg);

    // Broadcast roll animation event
    io.to(currentRoomCode).emit('game:diceRoll', { rolls: rollResult.rolls, total: rollResult.total });
    broadcast(state);

    // After a short delay (for animation), process movement
    setTimeout(() => {
      const s = getState();
      if (!s) return;
      const moveResult = movePlayer(s, socket.id, rollResult.total);
      if (!moveResult.ok) return;

      io.to(currentRoomCode).emit('game:playerMove', {
        playerId: socket.id,
        path: moveResult.path,
        hasFork: !!moveResult.fork,
      });
      broadcast(s);

      if (!moveResult.fork) {
        // Landed — resolve space after move animation
        setTimeout(() => {
          const s2 = getState();
          if (!s2) return;
          const resolution = resolveCurrentSpace(s2);
          io.to(currentRoomCode).emit('game:spaceResolved', resolution);
          broadcast(s2);
        }, moveResult.path.length * 400 + 300);
      }
    }, 2000); // dice animation duration
  });

  // ── Player: choose fork direction ──────────────────────────────────────────
  socket.on('player:forkChoice', ({ nextSpaceId }) => {
    const state = getState();
    if (!state || state.phase !== 'forkChoice') return err('No fork to choose');
    const fork = state.pendingFork;
    if (!fork) return err('No fork data');

    const moveResult = continueMove(state, socket.id, nextSpaceId, fork.remainingSteps);
    if (!moveResult.ok) return err('Move failed');

    io.to(currentRoomCode).emit('game:playerMove', {
      playerId: socket.id,
      path: moveResult.path,
      hasFork: !!moveResult.fork,
    });
    broadcast(state);

    if (!moveResult.fork) {
      setTimeout(() => {
        const s = getState();
        if (!s) return;
        const resolution = resolveCurrentSpace(s);
        io.to(currentRoomCode).emit('game:spaceResolved', resolution);
        broadcast(s);
      }, moveResult.path.length * 400 + 300);
    }
  });

  // ── Player/Host: submit question answer ───────────────────────────────────
  socket.on('player:answer', ({ choiceIndex }) => {
    const state = getState();
    if (!state) return err('Not in a room');
    const result = submitAnswer(state, socket.id, choiceIndex);
    if (!result.ok) return err(result.msg);
    io.to(currentRoomCode).emit('game:answerResult', result);
    broadcast(state);
  });

  // ── Host: close question / mini-game ──────────────────────────────────────
  socket.on('host:closeQuestion', () => {
    const state = getState();
    if (!state || !isHost) return;
    const isMini = state.phase === 'miniGame';
    if (isMini) closeMiniGame(state); else closeQuestion(state);
    broadcast(state);
  });

  // ── Player: buy item in shop ───────────────────────────────────────────────
  socket.on('player:buyItem', ({ itemId }) => {
    const state = getState();
    if (!state) return err('Not in a room');
    const result = buyItem(state, socket.id, itemId);
    if (!result.ok) return err(result.msg);
    broadcast(state);
  });

  // ── Player/Host: close shop ────────────────────────────────────────────────
  socket.on('player:closeShop', () => {
    const state = getState();
    if (!state) return;
    closeShop(state);
    broadcast(state);
  });

  // ── Host: close event card ────────────────────────────────────────────────
  socket.on('host:closeEvent', () => {
    const state = getState();
    if (!state || !isHost) return;
    closeEvent(state);
    broadcast(state);
  });

  // ── Host: confirm space resolution, advance turn ───────────────────────────
  socket.on('host:nextTurn', () => {
    const state = getState();
    if (!state || !isHost) return err('Unauthorized');
    nextTurn(state);
    broadcast(state);
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (!currentRoomCode) return;
    const state = getRoom(currentRoomCode);
    if (!state) return;

    if (isHost) {
      io.to(currentRoomCode).emit('game:error', { message: 'Host disconnected. Game ended.' });
      deleteRoom(currentRoomCode);
    } else {
      removePlayer(state, socket.id);
      if (state.players.length === 0) {
        deleteRoom(currentRoomCode);
      } else {
        broadcast(state);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`UNOH Review Game server running on http://localhost:${PORT}`);
});
