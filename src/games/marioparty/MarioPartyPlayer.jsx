import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../../socket.js';
import CharacterSelect from './components/CharacterSelect.jsx';
import CharacterSprite from './components/CharacterSprite.jsx';
import DiceRoll from './components/DiceRoll.jsx';
import QuestionPanel from './components/QuestionPanel.jsx';
import ItemShop from './components/ItemShop.jsx';
import ForkChoice from './components/ForkChoice.jsx';
import ItemUsePanel from './components/ItemUsePanel.jsx';
import { CHARACTERS } from '../../../shared/characters.js';
import { ITEMS } from '../../../shared/items.js';
import { BOARD_SPACES, SPACE_ICONS } from '../../../shared/boardData.js';

export default function MarioPartyPlayer({ gameState, roomCode, playerId }) {
  const phase = gameState?.phase ?? 'lobby';
  const myPlayer = gameState?.players?.find(p => p.id === playerId);
  const isMyTurn = gameState?.currentPlayerId === playerId;
  const myChar = myPlayer?.characterId;
  const char = myChar ? CHARACTERS[myChar] : null;

  // Always-active roll listener — mounted regardless of current phase,
  // so we never miss the game:diceRoll event due to component timing.
  const [lastRoll, setLastRoll] = useState(null);
  useEffect(() => {
    socket.on('game:diceRoll', (data) => setLastRoll(data));
    return () => socket.off('game:diceRoll');
  }, []);
  // Clear roll result when a new turn starts
  useEffect(() => {
    if (phase === 'itemUse') setLastRoll(null);
  }, [phase, gameState?.currentPlayerId]);

  // ── Lobby wait ────────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        padding: '1.5rem',
        textAlign: 'center',
        background: 'linear-gradient(135deg, #1A1A2E 0%, #2C2C54 100%)',
      }}>
        <div style={{ fontSize: '3rem' }}>🎲</div>
        <h2 style={{ color: '#F1C40F', fontWeight: 900 }}>You're In!</h2>
        <p>Welcome, <strong>{myPlayer?.name ?? '...'}</strong></p>
        <div style={{
          background: 'rgba(241,196,15,0.1)',
          border: '2px solid #F1C40F',
          borderRadius: '12px',
          padding: '0.7rem 2rem',
        }}>
          <p style={{ fontSize: '0.7rem', opacity: 0.6 }}>Room Code</p>
          <p style={{ fontWeight: 900, fontSize: '2rem', letterSpacing: '0.3em', color: '#F1C40F' }}>
            {roomCode}
          </p>
        </div>
        <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>Waiting for host to start…</p>
      </div>
    );
  }

  // ── Character select ──────────────────────────────────────────────────────
  if (phase === 'characterSelect') {
    return (
      <div style={{ height: '100vh', overflowY: 'auto', background: '#1A1A2E' }}>
        <CharacterSelect gameState={gameState} playerId={playerId} isHost={false} />
      </div>
    );
  }

  // ── Game over ─────────────────────────────────────────────────────────────
  if (phase === 'gameOver') {
    return <PlayerGameOver gameState={gameState} myPlayer={myPlayer} />;
  }

  // ── Main player view ──────────────────────────────────────────────────────
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, #0D0D1A 0%, #1A1A2E 100%)',
      overflow: 'hidden',
    }}>
      {/* Top bar: my stats */}
      <div style={{
        padding: '0.7rem 1rem',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.8rem',
        flexShrink: 0,
      }}>
        {myChar && (
          <CharacterSprite characterId={myChar} animation={isMyTurn ? 'idle' : 'idle'} size={44} />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '0.95rem', color: isMyTurn ? '#F1C40F' : '#ECF0F1' }}>
            {isMyTurn ? '🎯 YOUR TURN' : myPlayer?.name}
          </div>
          {char && <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>{char.emoji} {char.name}</div>}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <span className="badge badge-coin">🪙 {myPlayer?.coins ?? 0}</span>
          <span className="badge badge-star">⭐ {myPlayer?.stars ?? 0}</span>
        </div>
      </div>

      {/* Middle: current turn indicator */}
      {!isMyTurn && (
        <div style={{
          padding: '0.5rem',
          background: 'rgba(255,255,255,0.04)',
          textAlign: 'center',
          fontSize: '0.8rem',
          flexShrink: 0,
        }}>
          <span style={{ opacity: 0.6 }}>
            {gameState?.currentPlayerName}'s turn — Round {gameState?.round}/{gameState?.maxRounds}
          </span>
        </div>
      )}

      {/* Scrollable content area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        {/* Phase-specific UI */}
        <AnimatePresence mode="wait">
          <PhaseUI
            key={phase}
            phase={phase}
            gameState={gameState}
            playerId={playerId}
            isMyTurn={isMyTurn}
            myPlayer={myPlayer}
            lastRoll={lastRoll}
          />
        </AnimatePresence>

        {/* All players mini scoreboard */}
        <MiniScoreboard players={gameState?.players ?? []} currentPlayerId={gameState?.currentPlayerId} myPlayerId={playerId} />
      </div>
    </div>
  );
}

// ── Phase-specific UI for player ──────────────────────────────────────────────
function PhaseUI({ phase, gameState, playerId, isMyTurn, myPlayer, lastRoll }) {
  switch (phase) {
    case 'itemUse':
    case 'warpSelect':
      if (!isMyTurn) return <WaitingForTurn gameState={gameState} />;
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div style={{
            background: 'rgba(241,196,15,0.1)',
            border: '2px solid #F1C40F',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '0.5rem',
            textAlign: 'center',
          }}>
            <p style={{ color: '#F1C40F', fontWeight: 900, fontSize: '1.1rem' }}>⚡ YOUR TURN!</p>
            <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Use an item or roll the dice</p>
          </div>
          <ItemUsePanel gameState={gameState} playerId={playerId} />
          <div style={{ marginTop: '1rem' }}>
            <DiceRoll gameState={gameState} playerId={playerId} isHost={false} lastRoll={lastRoll} />
          </div>
        </motion.div>
      );

    case 'rolling':
    case 'moving':
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          {/* Spectator label */}
          {!isMyTurn && (
            <p style={{ opacity: 0.6, fontSize: '0.85rem' }}>
              {gameState?.currentPlayerName} is rolling…
            </p>
          )}
          <DiceRoll gameState={gameState} playerId={playerId} isHost={false} lastRoll={lastRoll} />
          {phase === 'moving' && (
            <p style={{ opacity: 0.6, fontSize: '0.85rem' }}>Moving…</p>
          )}
        </motion.div>
      );

    case 'forkChoice':
      return <ForkChoice gameState={gameState} playerId={playerId} />;

    case 'spaceResolution':
      return <SpaceResolutionView gameState={gameState} myPlayer={myPlayer} isMyTurn={isMyTurn} />;

    case 'question':
      return (
        <QuestionPanel
          gameState={gameState}
          playerId={playerId}
          isHost={false}
          isMiniGame={false}
        />
      );

    case 'miniGame':
      return (
        <QuestionPanel
          gameState={gameState}
          playerId={playerId}
          isHost={false}
          isMiniGame={true}
        />
      );

    case 'shopOpen':
      return <ItemShop gameState={gameState} playerId={playerId} isHost={false} />;

    case 'eventCard':
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem' }}>🎴</div>
          <h3 style={{ color: '#1ABC9C', fontWeight: 900 }}>
            {gameState?.currentEvent?.name ?? 'Event!'}
          </h3>
          <p style={{ opacity: 0.7, lineHeight: 1.6 }}>
            {gameState?.currentEvent?.description}
          </p>
        </motion.div>
      );

    default:
      return <WaitingForTurn gameState={gameState} />;
  }
}

function WaitingForTurn({ gameState }) {
  const space = gameState?.players?.find(p => p.id === gameState?.currentPlayerId);
  const currentSpace = space ? BOARD_SPACES[space.position] : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ textAlign: 'center', padding: '1rem', opacity: 0.7 }}
    >
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
      <p style={{ fontWeight: 700 }}>
        Waiting for {gameState?.currentPlayerName ?? '...'}
      </p>
      {currentSpace && (
        <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.3rem' }}>
          They're at {SPACE_ICONS[currentSpace.type]} {currentSpace.name}
        </p>
      )}
    </motion.div>
  );
}

function SpaceResolutionView({ gameState, myPlayer, isMyTurn }) {
  const currentPlayer = gameState?.players?.find(p => p.id === gameState?.currentPlayerId);
  const space = currentPlayer ? BOARD_SPACES[currentPlayer.position] : null;
  if (!space) return null;

  const icon = SPACE_ICONS[space.type] ?? '?';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ textAlign: 'center', padding: '1rem' }}
    >
      <div style={{ fontSize: '3rem' }}>{icon}</div>
      <h3 style={{ fontWeight: 900, marginTop: '0.5rem' }}>
        {isMyTurn ? 'You' : gameState?.currentPlayerName} landed on{' '}
        <span style={{ color: '#F1C40F' }}>{space.name}</span>
      </h3>
      <p style={{ opacity: 0.5, fontSize: '0.8rem', marginTop: '0.5rem' }}>
        Waiting for host to continue…
      </p>
    </motion.div>
  );
}

function MiniScoreboard({ players, currentPlayerId, myPlayerId }) {
  const sorted = [...players].sort((a, b) => {
    if (b.stars !== a.stars) return b.stars - a.stars;
    return b.coins - a.coins;
  });

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      borderRadius: '12px',
      padding: '0.7rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.4rem',
    }}>
      <p style={{ fontSize: '0.7rem', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Standings
      </p>
      {sorted.map((p, i) => (
        <div
          key={p.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.3rem 0.4rem',
            borderRadius: '6px',
            background: p.id === myPlayerId
              ? 'rgba(241,196,15,0.12)'
              : p.id === currentPlayerId
              ? 'rgba(52,152,219,0.1)'
              : 'transparent',
          }}
        >
          <span style={{ fontSize: '0.85rem', opacity: 0.6, width: '1rem' }}>{i + 1}.</span>
          {p.characterId && (
            <CharacterSprite characterId={p.characterId} animation="idle" size={22} />
          )}
          <span style={{
            flex: 1,
            fontSize: '0.8rem',
            fontWeight: p.id === myPlayerId ? 800 : 600,
            color: p.id === myPlayerId ? '#F1C40F' : '#ECF0F1',
          }}>
            {p.name}{p.id === myPlayerId ? ' (you)' : ''}
          </span>
          <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>⭐{p.stars} 🪙{p.coins}</span>
        </div>
      ))}
    </div>
  );
}

function PlayerGameOver({ gameState, myPlayer }) {
  const sorted = [...(gameState?.players ?? [])].sort((a, b) => {
    if (b.stars !== a.stars) return b.stars - a.stars;
    return b.coins - a.coins;
  });
  const myRank = sorted.findIndex(p => p.id === myPlayer?.id) + 1;
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1.5rem',
      padding: '1.5rem',
      textAlign: 'center',
      background: 'linear-gradient(135deg, #1A1A2E 0%, #2C2C54 100%)',
    }}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 10 }}
      >
        <div style={{ fontSize: '4rem' }}>
          {medals[myRank - 1] ?? '🎮'}
        </div>
        <h2 style={{ color: '#F1C40F', fontWeight: 900, fontSize: '1.8rem' }}>
          {myRank === 1 ? 'You Win!' : `You placed #${myRank}`}
        </h2>
        {myPlayer && (
          <p style={{ opacity: 0.7, marginTop: '0.3rem' }}>
            Final: ⭐ {myPlayer.stars} stars, 🪙 {myPlayer.coins} coins
          </p>
        )}
      </motion.div>

      {gameState?.winner && (
        <p style={{ fontSize: '1rem', opacity: 0.8 }}>
          🏆 Winner: <strong style={{ color: '#F1C40F' }}>{gameState.winner.name}</strong>
        </p>
      )}

      <button
        className="btn btn-red btn-lg"
        onClick={() => window.location.reload()}
      >
        Play Again
      </button>
    </div>
  );
}
