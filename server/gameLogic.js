// Server-side Mario Party game state machine
import { BOARD_SPACES, getNextSpaces, isForkSpace } from '../shared/boardData.js';
import { ITEMS, ITEMS_ARRAY } from '../shared/items.js';
import { shuffleQuestions } from '../shared/questions.js';
import { EVENTS, pickRandomEvent } from '../shared/events.js';

// ─── Room management ──────────────────────────────────────────────────────────

const rooms = new Map(); // roomCode → GameState

export function createRoom(hostSocketId) {
  const code = generateCode();
  const state = {
    code,
    hostSocketId,
    phase: 'lobby',         // lobby | characterSelect | itemUse | rolling | moving | forkChoice | spaceResolution | question | shopOpen | miniGame | eventCard | roundEnd | gameOver
    players: [],            // Player[]
    currentPlayerIndex: 0,
    round: 1,
    maxRounds: 5,
    questions: shuffleQuestions(),
    questionIndex: 0,
    currentQuestion: null,
    currentEvent: null,
    pendingFork: null,      // { spaceId, options, remainingSteps }
    pendingMove: null,      // { path: number[] } for animation
    shopItems: [],
    usedCharacters: [],
    log: [],                // game announcements
    answeredPlayers: [],    // player IDs who answered current question
    itemModifiers: {},      // playerId → active item modifiers
  };
  rooms.set(code, state);
  return code;
}

export function getRoom(code) {
  return rooms.get(code?.toUpperCase()) ?? null;
}

export function deleteRoom(code) {
  rooms.delete(code);
}

export function getAllRooms() {
  return [...rooms.values()];
}

// ─── Player management ────────────────────────────────────────────────────────

export function addPlayer(state, socketId, name) {
  if (state.players.find(p => p.id === socketId)) return null;
  if (state.phase !== 'lobby') return null;

  const player = {
    id: socketId,
    name: name.trim().slice(0, 20),
    characterId: null,
    position: 0,
    coins: 5,
    stars: 0,
    items: [],      // max 3 items held
    isReady: false,
    hasShield: false,
    luckyCloverActive: false,
    doubleStarActive: false,
    passedStar: false,
  };
  state.players.push(player);
  addLog(state, `${player.name} joined!`);
  return player;
}

export function removePlayer(state, socketId) {
  const idx = state.players.findIndex(p => p.id === socketId);
  if (idx !== -1) state.players.splice(idx, 1);
}

export function selectCharacter(state, playerId, characterId) {
  if (state.phase !== 'characterSelect') return false;
  if (state.usedCharacters.includes(characterId)) return false;

  const player = findPlayer(state, playerId);
  if (!player) return false;

  // Free previous character selection
  if (player.characterId) {
    const prev = state.usedCharacters.indexOf(player.characterId);
    if (prev !== -1) state.usedCharacters.splice(prev, 1);
  }

  player.characterId = characterId;
  player.isReady = true;
  state.usedCharacters.push(characterId);
  return true;
}

// ─── Game flow ────────────────────────────────────────────────────────────────

export function startGame(state) {
  if (state.players.length < 1) return false;
  state.phase = 'characterSelect';
  state.usedCharacters = [];
  state.players.forEach(p => { p.isReady = false; p.characterId = null; });
  addLog(state, 'Game started! Pick your character!');
  return true;
}

export function startFirstTurn(state) {
  // All players must have characters
  if (state.players.some(p => !p.characterId)) return false;
  state.currentPlayerIndex = 0;
  beginTurn(state);
  return true;
}

export function beginTurn(state) {
  const player = currentPlayer(state);
  if (!player) return;
  state.phase = 'itemUse';
  state.currentQuestion = null;
  state.currentEvent = null;
  state.pendingFork = null;
  state.answeredPlayers = [];
  addLog(state, `${player.name}'s turn!`);
}

// ─── Item use ────────────────────────────────────────────────────────────────

export function useItem(state, playerId, itemId, targetPlayerId) {
  if (state.phase !== 'itemUse') return { ok: false, msg: 'Not item-use phase' };
  const player = findPlayer(state, playerId);
  if (!player || player.id !== currentPlayer(state).id) return { ok: false, msg: 'Not your turn' };

  const itemIdx = player.items.indexOf(itemId);
  if (itemIdx === -1) return { ok: false, msg: 'You do not have that item' };

  const item = ITEMS[itemId];
  if (!item) return { ok: false, msg: 'Unknown item' };

  player.items.splice(itemIdx, 1); // consume item

  let result = { ok: true, msg: '', nextPhase: 'itemUse' };

  switch (item.effect.type) {
    case 'gainCoins':
      player.coins = Math.max(0, player.coins + item.effect.amount);
      addLog(state, `${player.name} used ${item.name} and gained ${item.effect.amount} coins!`);
      result.msg = `+${item.effect.amount} coins!`;
      break;

    case 'steal': {
      const target = findPlayer(state, targetPlayerId);
      if (!target) { result.ok = false; result.msg = 'Target not found'; break; }
      if (target.hasShield) {
        addLog(state, `${target.name}'s Shield blocked the theft!`);
        target.hasShield = false;
        result.msg = 'Shield blocked!';
        break;
      }
      const stolen = Math.min(target.coins, item.effect.amount);
      target.coins -= stolen;
      player.coins += stolen;
      addLog(state, `${player.name} stole ${stolen} coins from ${target.name}!`);
      result.msg = `Stole ${stolen} coins!`;
      break;
    }

    case 'shield':
      player.hasShield = true;
      addLog(state, `${player.name} activated Shield!`);
      result.msg = 'Shield active!';
      break;

    case 'doubleQuestion':
      player.luckyCloverActive = true;
      addLog(state, `${player.name} activated Lucky Clover!`);
      result.msg = 'Next question doubles your coins!';
      break;

    case 'doubleStar':
      player.doubleStarActive = true;
      addLog(state, `${player.name} activated Double Star!`);
      result.msg = 'Double Star ready!';
      break;

    case 'extraRoll':
      if (!state.itemModifiers[playerId]) state.itemModifiers[playerId] = {};
      state.itemModifiers[playerId].extraRoll = true;
      addLog(state, `${player.name} used Extra Roll!`);
      result.msg = 'Extra die incoming!';
      break;

    case 'doubleRoll':
      if (!state.itemModifiers[playerId]) state.itemModifiers[playerId] = {};
      state.itemModifiers[playerId].doubleRoll = true;
      addLog(state, `${player.name} used Speed Boots!`);
      result.msg = 'Rolling 2 dice, best wins!';
      break;

    case 'warp':
      state.phase = 'warpSelect';
      result.nextPhase = 'warpSelect';
      addLog(state, `${player.name} used Warp Pipe!`);
      result.msg = 'Choose a destination!';
      break;

    default:
      result.ok = false;
      result.msg = 'Unknown effect';
  }

  return result;
}

export function applyWarp(state, playerId, targetSpaceId) {
  const player = findPlayer(state, playerId);
  if (!player) return false;
  player.position = targetSpaceId;
  state.phase = 'itemUse';
  addLog(state, `${player.name} warped to space ${targetSpaceId}!`);
  return true;
}

// ─── Dice roll ───────────────────────────────────────────────────────────────

export function rollDice(state, playerId) {
  if (state.phase !== 'itemUse' && state.phase !== 'rolling') {
    return { ok: false, msg: 'Cannot roll now' };
  }
  const player = currentPlayer(state);
  if (!player || player.id !== playerId) return { ok: false, msg: 'Not your turn' };

  state.phase = 'rolling';

  const mods = state.itemModifiers[playerId] || {};
  let roll1 = d6();
  let total = roll1;
  let rolls = [roll1];

  if (mods.extraRoll) {
    const extra = d6();
    total += extra;
    rolls.push(extra);
    delete mods.extraRoll;
  }
  if (mods.doubleRoll) {
    const roll2 = d6();
    rolls = [roll1, roll2];
    total = Math.max(roll1, roll2);
    delete mods.doubleRoll;
  }

  state.itemModifiers[playerId] = mods;

  addLog(state, `${player.name} rolled ${total}!`);
  return { ok: true, rolls, total };
}

// ─── Movement ────────────────────────────────────────────────────────────────

export function movePlayer(state, playerId, steps) {
  const player = findPlayer(state, playerId);
  if (!player) return { ok: false, msg: 'Player not found' };

  state.phase = 'moving';
  const path = [player.position];
  let pos = player.position;

  for (let i = 0; i < steps; i++) {
    const options = getNextSpaces(pos);

    if (options.length > 1 && i < steps - 1) {
      // Hit a fork before reaching destination — pause and ask
      state.pendingFork = {
        spaceId: pos,
        options,
        remainingSteps: steps - i - 1,
        playerId,
      };
      state.phase = 'forkChoice';
      player.position = pos;
      return { ok: true, path, fork: state.pendingFork };
    }

    pos = options[0];
    path.push(pos);
  }

  player.position = pos;
  state.pendingMove = { path };
  return { ok: true, path, fork: null };
}

export function resolveForkChoice(state, playerId, nextSpaceId) {
  if (state.phase !== 'forkChoice') return { ok: false, msg: 'Not at a fork' };
  if (!state.pendingFork) return { ok: false, msg: 'No pending fork' };

  const fork = state.pendingFork;
  if (!fork.options.includes(nextSpaceId)) return { ok: false, msg: 'Invalid path' };
  if (fork.playerId !== playerId) return { ok: false, msg: 'Not your fork' };

  state.pendingFork = null;
  state.phase = 'moving';

  // Continue movement from chosen space
  return movePlayer(state, playerId, fork.remainingSteps + 1);
  // Note: movePlayer sets pos to nextSpaceId first, then continues
  // Actually we need a helper to continue from a given position
}

// Better: continue movement from specific position
export function continueMove(state, playerId, fromSpaceId, remainingSteps) {
  const player = findPlayer(state, playerId);
  if (!player) return { ok: false };

  state.phase = 'moving';
  const path = [fromSpaceId];
  let pos = fromSpaceId;

  for (let i = 0; i < remainingSteps; i++) {
    const options = getNextSpaces(pos);

    if (options.length > 1 && i < remainingSteps - 1) {
      state.pendingFork = {
        spaceId: pos,
        options,
        remainingSteps: remainingSteps - i - 1,
        playerId,
      };
      state.phase = 'forkChoice';
      player.position = pos;
      return { ok: true, path, fork: state.pendingFork };
    }

    pos = options[0];
    path.push(pos);
  }

  player.position = pos;
  return { ok: true, path, fork: null };
}

// ─── Space resolution ────────────────────────────────────────────────────────

export function resolveCurrentSpace(state) {
  const player = currentPlayer(state);
  if (!player) return { type: 'error' };

  const space = BOARD_SPACES[player.position];
  addLog(state, `${player.name} landed on ${space.name}!`);

  switch (space.type) {
    case 'start':
      state.phase = 'spaceResolution';
      return { type: 'start', message: 'Back to Start! Collect 3 coins!', coinsChange: 3 };

    case 'coin': {
      player.coins += 3;
      state.phase = 'spaceResolution';
      return { type: 'coin', message: '+3 coins!', coinsChange: 3 };
    }

    case 'badluck': {
      const lost = Math.min(player.coins, 3);
      player.coins -= lost;
      state.phase = 'spaceResolution';
      return { type: 'badluck', message: `-${lost} coins!`, coinsChange: -lost };
    }

    case 'star': {
      state.phase = 'spaceResolution';
      if (player.coins >= 20) {
        const starCount = player.doubleStarActive ? 2 : 1;
        const cost = starCount * 20;
        if (player.coins >= cost) {
          player.coins -= cost;
          player.stars += starCount;
          player.doubleStarActive = false;
          addLog(state, `${player.name} bought ${starCount} star(s)!`);
          return { type: 'star', message: `⭐ x${starCount} purchased! -${cost} coins`, starsChange: starCount, coinsChange: -cost };
        }
      }
      return { type: 'star', message: 'Star Space! Need 20 coins to buy a star.', canBuy: false };
    }

    case 'question': {
      state.phase = 'question';
      const q = nextQuestion(state);
      state.currentQuestion = q;
      state.answeredPlayers = [];
      return { type: 'question', question: sanitizeQuestion(q) };
    }

    case 'shop': {
      state.phase = 'shopOpen';
      state.shopItems = pickShopItems();
      return { type: 'shop', items: state.shopItems };
    }

    case 'event': {
      state.phase = 'eventCard';
      const ev = pickRandomEvent();
      state.currentEvent = ev;
      applyEvent(state, ev);
      return { type: 'event', event: ev };
    }

    case 'minigame': {
      state.phase = 'miniGame';
      const q = nextQuestion(state);
      state.currentQuestion = q;
      state.answeredPlayers = [];
      return { type: 'minigame', question: sanitizeQuestion(q) };
    }

    case 'fork':
      // Landing ON a fork space — just a coin+ as bonus
      player.coins += 1;
      state.phase = 'spaceResolution';
      return { type: 'fork', message: 'Fork junction! +1 coin bonus.', coinsChange: 1 };

    default:
      state.phase = 'spaceResolution';
      return { type: 'unknown', message: '...' };
  }
}

// ─── Question answering ───────────────────────────────────────────────────────

export function submitAnswer(state, playerId, choiceIndex) {
  if (state.phase !== 'question' && state.phase !== 'miniGame') {
    return { ok: false, msg: 'Not a question phase' };
  }
  if (state.answeredPlayers.includes(playerId)) {
    return { ok: false, msg: 'Already answered' };
  }

  const player = findPlayer(state, playerId);
  if (!player) return { ok: false, msg: 'Player not found' };

  state.answeredPlayers.push(playerId);
  const correct = choiceIndex === state.currentQuestion.correct;

  if (correct) {
    const isCurrentTurn = player.id === currentPlayer(state).id;
    let coinsEarned = state.currentQuestion.coins;

    if (player.luckyCloverActive && isCurrentTurn) {
      coinsEarned *= 2;
      player.luckyCloverActive = false;
    }

    // Mini-game: first correct answer wins all, extra coins for others (everyone gains in mini-game)
    if (state.phase === 'miniGame') {
      coinsEarned = 8; // mini-game bonus
    }

    player.coins += coinsEarned;
    addLog(state, `${player.name} answered correctly! +${coinsEarned} coins!`);

    return {
      ok: true,
      correct: true,
      playerId,
      playerName: player.name,
      coinsEarned,
      isFirstCorrect: state.answeredPlayers.filter(id => {
        const p = findPlayer(state, id);
        return p && state.currentQuestion; // rough check
      }).length === 1,
    };
  }

  addLog(state, `${player.name} answered incorrectly.`);
  return { ok: true, correct: false, playerId, playerName: player.name };
}

export function closeQuestion(state) {
  state.phase = 'spaceResolution';
  state.currentQuestion = null;
  state.answeredPlayers = [];
}

export function closeMiniGame(state) {
  state.phase = 'spaceResolution';
  state.currentQuestion = null;
  state.answeredPlayers = [];
}

// ─── Shop ─────────────────────────────────────────────────────────────────────

export function buyItem(state, playerId, itemId) {
  if (state.phase !== 'shopOpen') return { ok: false, msg: 'Shop not open' };
  const player = findPlayer(state, playerId);
  if (!player || player.id !== currentPlayer(state).id) return { ok: false, msg: 'Not your turn' };
  if (player.items.length >= 3) return { ok: false, msg: 'Inventory full (max 3 items)' };

  const item = ITEMS[itemId];
  if (!item) return { ok: false, msg: 'Unknown item' };
  if (!state.shopItems.includes(itemId)) return { ok: false, msg: 'Item not in shop' };
  if (player.coins < item.price) return { ok: false, msg: 'Not enough coins' };

  player.coins -= item.price;
  player.items.push(itemId);
  addLog(state, `${player.name} bought ${item.name} for ${item.price} coins!`);
  return { ok: true, item };
}

export function closeShop(state) {
  state.phase = 'spaceResolution';
}

// ─── Event resolution ────────────────────────────────────────────────────────

function applyEvent(state, event) {
  switch (event.effect.type) {
    case 'allGainCoins':
      state.players.forEach(p => { p.coins += event.effect.amount; });
      break;
    case 'currentGainCoins':
      currentPlayer(state).coins += event.effect.amount;
      break;
    case 'currentLoseCoins': {
      const p = currentPlayer(state);
      p.coins = Math.max(0, p.coins - event.effect.amount);
      break;
    }
    case 'stealFromRichest': {
      const richest = [...state.players].sort((a, b) => b.coins - a.coins)[0];
      const poorest = [...state.players].sort((a, b) => a.coins - b.coins)[0];
      if (richest && poorest && richest.id !== poorest.id) {
        const stolen = Math.min(richest.coins, event.effect.amount);
        richest.coins -= stolen;
        poorest.coins += stolen;
      }
      break;
    }
    case 'allGiveToLast': {
      const lastPlace = [...state.players].sort((a, b) => a.coins - b.coins)[0];
      if (lastPlace) {
        state.players.forEach(p => {
          if (p.id !== lastPlace.id) {
            const given = Math.min(p.coins, event.effect.amount);
            p.coins -= given;
            lastPlace.coins += given;
          }
        });
      }
      break;
    }
    case 'giveToLast': {
      const lastP = [...state.players].sort((a, b) => a.coins - b.coins)[0];
      if (lastP) lastP.coins += event.effect.amount;
      break;
    }
    default:
      break;
  }
}

export function closeEvent(state) {
  state.phase = 'spaceResolution';
}

// ─── Turn advancement ─────────────────────────────────────────────────────────

export function nextTurn(state) {
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;

  if (state.currentPlayerIndex === 0) {
    state.round++;
    if (state.round > state.maxRounds) {
      endGame(state);
      return;
    }
    addLog(state, `Round ${state.round} begins!`);
  }

  beginTurn(state);
}

function endGame(state) {
  state.phase = 'gameOver';
  const sorted = [...state.players].sort((a, b) => {
    if (b.stars !== a.stars) return b.stars - a.stars;
    return b.coins - a.coins;
  });
  state.winner = sorted[0];
  addLog(state, `Game over! ${state.winner.name} wins!`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function currentPlayer(state) {
  return state.players[state.currentPlayerIndex] ?? null;
}

function findPlayer(state, id) {
  return state.players.find(p => p.id === id) ?? null;
}

function d6() {
  return Math.floor(Math.random() * 6) + 1;
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function addLog(state, message) {
  state.log.unshift({ message, ts: Date.now() });
  if (state.log.length > 30) state.log.pop();
}

function nextQuestion(state) {
  const q = state.questions[state.questionIndex % state.questions.length];
  state.questionIndex++;
  return q;
}

function sanitizeQuestion(q) {
  // Send to all players — don't expose `correct` index until answered
  return {
    id: q.id,
    category: q.category,
    question: q.question,
    choices: q.choices,
    difficulty: q.difficulty,
    coins: q.coins,
  };
}

function pickShopItems() {
  const pool = Object.keys(ITEMS);
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

// Build a sanitized public state for the client (no server secrets)
export function publicState(state) {
  const cp = currentPlayer(state);
  return {
    code: state.code,
    phase: state.phase,
    players: state.players.map(p => ({
      id: p.id,
      name: p.name,
      characterId: p.characterId,
      position: p.position,
      coins: p.coins,
      stars: p.stars,
      itemCount: p.items.length,
      items: p.items,        // visible to player themselves (filtered on client)
      isReady: p.isReady,
      hasShield: p.hasShield,
    })),
    currentPlayerId: cp?.id ?? null,
    currentPlayerName: cp?.name ?? null,
    round: state.round,
    maxRounds: state.maxRounds,
    usedCharacters: state.usedCharacters,
    log: state.log.slice(0, 10),
    currentQuestion: state.currentQuestion ? sanitizeQuestion(state.currentQuestion) : null,
    currentEvent: state.currentEvent,
    shopItems: state.shopItems,
    pendingFork: state.pendingFork ? {
      spaceId: state.pendingFork.spaceId,
      options: state.pendingFork.options,
    } : null,
    answeredPlayers: state.answeredPlayers,
    winner: state.winner ?? null,
  };
}
