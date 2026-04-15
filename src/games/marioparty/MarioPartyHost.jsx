import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../../socket.js';
import Board from './components/Board.jsx';
import CharacterSelect from './components/CharacterSelect.jsx';
import PlayerHUD, { Scoreboard } from './components/PlayerHUD.jsx';
import DiceRoll from './components/DiceRoll.jsx';
import QuestionPanel from './components/QuestionPanel.jsx';
import ItemShop from './components/ItemShop.jsx';
import EventCard from './components/EventCard.jsx';
import SpaceResolver from './components/SpaceResolver.jsx';
import ForkChoice from './components/ForkChoice.jsx';
import { BOARD_SPACES } from '../../../shared/boardData.js';

export default function MarioPartyHost({ gameState, roomCode }) {
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    const url = `${window.location.origin}?role=player&code=${roomCode}`;
    setShareUrl(url);
  }, [roomCode]);

  const phase = gameState?.phase ?? 'lobby';

  // ── Lobby ─────────────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <LobbyScreen gameState={gameState} roomCode={roomCode} shareUrl={shareUrl} />
    );
  }

  // ── Character select ──────────────────────────────────────────────────────
  if (phase === 'characterSelect') {
    return (
      <CharacterSelect gameState={gameState} playerId={null} isHost={true} />
    );
  }

  // ── Game over ─────────────────────────────────────────────────────────────
  if (phase === 'gameOver') {
    return <GameOverScreen gameState={gameState} roomCode={roomCode} />;
  }

  // ── Main game view ────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#0D0D1A',
      overflow: 'hidden',
    }}>
      {/* Left sidebar: players + round */}
      <div style={{
        width: '220px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '0.8rem',
        gap: '0.7rem',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        overflowY: 'auto',
      }}>
        {/* Round info */}
        <div style={{
          background: 'rgba(241,196,15,0.1)',
          border: '1px solid rgba(241,196,15,0.3)',
          borderRadius: '8px',
          padding: '0.5rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>Round</div>
          <div style={{ fontWeight: 900, color: '#F1C40F', fontSize: '1.4rem' }}>
            {gameState?.round ?? 1} / {gameState?.maxRounds ?? 5}
          </div>
        </div>

        <PlayerHUD
          players={gameState?.players ?? []}
          currentPlayerId={gameState?.currentPlayerId}
          compact={false}
        />

        {/* Game log */}
        {gameState?.log?.length > 0 && (
          <div style={{ marginTop: 'auto' }}>
            <p style={{ fontSize: '0.65rem', opacity: 0.4, marginBottom: '0.3rem' }}>Game Log</p>
            {gameState.log.slice(0, 6).map((entry, i) => (
              <div key={i} style={{
                fontSize: '0.7rem',
                opacity: Math.max(0.3, 1 - i * 0.12),
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                paddingBottom: '0.2rem',
                marginBottom: '0.2rem',
              }}>
                {entry.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Center: board */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Board gameState={gameState} />

        {/* Phase overlay on board */}
        <AnimatePresence>
          {(phase === 'forkChoice') && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.5)',
              zIndex: 10,
            }}>
              <ForkChoice gameState={gameState} playerId={null} />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Right sidebar: controls */}
      <div style={{
        width: '280px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: '0.8rem',
        gap: '0.7rem',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        overflowY: 'auto',
      }}>
        {/* Phase banner */}
        <PhaseBanner phase={phase} gameState={gameState} />

        {/* Phase-specific UI */}
        {(phase === 'itemUse' || phase === 'rolling') && (
          <DiceRoll gameState={gameState} playerId={null} isHost={true} />
        )}

        {phase === 'question' && (
          <QuestionPanel gameState={gameState} playerId={null} isHost={true} />
        )}

        {phase === 'miniGame' && (
          <QuestionPanel gameState={gameState} playerId={null} isHost={true} isMiniGame />
        )}

        {phase === 'shopOpen' && (
          <ItemShop gameState={gameState} playerId={null} isHost={true} />
        )}

        {phase === 'eventCard' && (
          <EventCard event={gameState?.currentEvent} isHost={true} />
        )}

        {phase === 'spaceResolution' && (
          <SpaceResolver gameState={gameState} isHost={true} />
        )}

        {/* Room code (always visible) */}
        <div style={{
          marginTop: 'auto',
          textAlign: 'center',
          padding: '0.6rem',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '8px',
        }}>
          <p style={{ fontSize: '0.65rem', opacity: 0.5 }}>Players join at</p>
          <p style={{ fontWeight: 900, color: '#F1C40F', fontSize: '1.4rem', letterSpacing: '0.3em' }}>
            {roomCode}
          </p>
          <p style={{ fontSize: '0.6rem', opacity: 0.35, wordBreak: 'break-all' }}>{shareUrl}</p>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PhaseBanner({ phase, gameState }) {
  const banners = {
    itemUse:          { label: 'Item Use Phase',    color: '#9B59B6', icon: '🎒' },
    rolling:          { label: 'Rolling Dice…',     color: '#F1C40F', icon: '🎲' },
    moving:           { label: 'Moving…',           color: '#3498DB', icon: '🏃' },
    forkChoice:       { label: 'Fork in the Road!', color: '#F1C40F', icon: '🍴' },
    spaceResolution:  { label: 'Space Landed!',     color: '#2ECC71', icon: '📍' },
    question:         { label: 'Question Time!',    color: '#3498DB', icon: '❓' },
    miniGame:         { label: 'Mini-Game!',        color: '#FF69B4', icon: '🎮' },
    shopOpen:         { label: 'Item Shop',         color: '#9B59B6', icon: '🛒' },
    eventCard:        { label: 'Event Card!',       color: '#1ABC9C', icon: '🎴' },
  };

  const b = banners[phase];
  if (!b) return null;

  return (
    <motion.div
      key={phase}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: `${b.color}22`,
        border: `2px solid ${b.color}`,
        borderRadius: '10px',
        padding: '0.5rem 0.8rem',
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: '1.2rem' }}>{b.icon}</span>
      <p style={{ color: b.color, fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase' }}>
        {b.label}
      </p>
      {gameState?.currentPlayerName && (
        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          {gameState.currentPlayerName}'s Turn
        </p>
      )}
    </motion.div>
  );
}

function LobbyScreen({ gameState, roomCode, shareUrl }) {
  const players = gameState?.players ?? [];

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2rem',
      padding: '2rem',
      background: 'radial-gradient(ellipse at center, #2C2C54 0%, #0D0D1A 70%)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>🎲</div>
        <h1 style={{ color: '#E74C3C', fontWeight: 900, fontSize: '2.5rem', textTransform: 'uppercase' }}>
          Mario Party IT
        </h1>
        <p style={{ opacity: 0.6, marginTop: '0.3rem' }}>UNOH Review Game Platform</p>
      </div>

      {/* Room code big display */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>Players — join at this page with code:</p>
        <div style={{
          fontSize: '4rem',
          fontWeight: 900,
          letterSpacing: '0.4em',
          color: '#F1C40F',
          textShadow: '0 0 30px rgba(241,196,15,0.4)',
          padding: '0.5rem 1rem',
          border: '3px solid #F1C40F',
          borderRadius: '12px',
          display: 'inline-block',
          marginTop: '0.5rem',
        }}>
          {roomCode}
        </div>
        <p style={{ fontSize: '0.7rem', opacity: 0.4, marginTop: '0.5rem', wordBreak: 'break-all' }}>
          {shareUrl}
        </p>
      </div>

      {/* Player list */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem', justifyContent: 'center', maxWidth: '500px' }}>
        {players.map(p => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '999px',
              padding: '0.4rem 1rem',
              fontWeight: 700,
              fontSize: '0.9rem',
            }}
          >
            ✅ {p.name}
          </motion.div>
        ))}
        {players.length === 0 && (
          <p style={{ opacity: 0.4, fontSize: '0.9rem' }}>Waiting for players to join…</p>
        )}
      </div>

      {/* Start button */}
      {players.length >= 1 && (
        <motion.button
          className="btn btn-red btn-lg"
          onClick={() => socket.emit('host:startGame')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          style={{ fontSize: '1.3rem', padding: '1rem 2.5rem' }}
        >
          🎮 Start Game ({players.length} player{players.length !== 1 ? 's' : ''})
        </motion.button>
      )}
    </div>
  );
}

function GameOverScreen({ gameState, roomCode }) {
  const winner = gameState?.winner;
  const players = gameState?.players ?? [];

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2rem',
      padding: '2rem',
      background: 'radial-gradient(ellipse at center, #2C2C54 0%, #0D0D1A 70%)',
    }}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 10 }}
        style={{ textAlign: 'center' }}
      >
        <div style={{ fontSize: '5rem', marginBottom: '0.5rem' }}>🏆</div>
        <h1 style={{ color: '#F1C40F', fontWeight: 900, fontSize: '2.5rem' }}>
          Game Over!
        </h1>
        {winner && (
          <p style={{ fontSize: '1.3rem', marginTop: '0.5rem' }}>
            🎉 <strong style={{ color: '#F1C40F' }}>{winner.name}</strong> wins!
          </p>
        )}
      </motion.div>

      <div style={{ width: '100%', maxWidth: '480px' }}>
        <Scoreboard players={players} winner={winner} />
      </div>

      <button
        className="btn btn-red btn-lg"
        onClick={() => window.location.reload()}
      >
        Play Again
      </button>
    </div>
  );
}
