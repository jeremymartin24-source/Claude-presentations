import { motion } from 'framer-motion';
import { BOARD_SPACES, SPACE_COLORS, SPACE_ICONS } from '../../../../shared/boardData.js';
import socket from '../../../socket.js';

export default function SpaceResolver({ gameState, isHost }) {
  const phase = gameState?.phase;
  const currentPlayerId = gameState?.currentPlayerId;
  const currentPlayerName = gameState?.currentPlayerName;
  const player = gameState?.players?.find(p => p.id === currentPlayerId);
  const space = player ? BOARD_SPACES[player.position] : null;

  if (phase !== 'spaceResolution' || !space) return null;

  const color = SPACE_COLORS[space.type] ?? '#555';
  const icon = SPACE_ICONS[space.type] ?? '?';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: `${color}22`,
        border: `2px solid ${color}`,
        borderRadius: '14px',
        padding: '1.2rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.6rem',
        maxWidth: '340px',
        margin: '0 auto',
      }}
    >
      <div style={{ fontSize: '2.5rem' }}>{icon}</div>
      <h3 style={{ color, fontWeight: 900, textTransform: 'uppercase', fontSize: '0.95rem' }}>
        {currentPlayerName} landed on {space.name}
      </h3>

      {/* Space-specific message */}
      <SpaceMessage space={space} player={player} />

      {/* Host confirm button */}
      {isHost && (
        <button
          className="btn btn-dark"
          onClick={() => socket.emit('host:nextTurn')}
          style={{ marginTop: '0.5rem' }}
        >
          Next Turn →
        </button>
      )}
    </motion.div>
  );
}

function SpaceMessage({ space, player }) {
  switch (space.type) {
    case 'coin':
      return <p style={{ color: '#2ECC71', fontWeight: 700 }}>+3 coins! 🪙</p>;
    case 'badluck':
      return <p style={{ color: '#E74C3C', fontWeight: 700 }}>-3 coins! 💀</p>;
    case 'start':
      return <p style={{ color: '#F1C40F', fontWeight: 700 }}>Back to Start! +3 coins 🏁</p>;
    case 'star':
      return (
        <p style={{ color: '#F1C40F', fontWeight: 700 }}>
          {player?.coins >= 20
            ? '⭐ Star purchased for 20 coins!'
            : `Need 20 coins for a star. (Have ${player?.coins ?? 0})`}
        </p>
      );
    case 'fork':
      return <p style={{ color: '#ECF0F1', opacity: 0.8 }}>Fork junction. +1 coin bonus!</p>;
    default:
      return null;
  }
}
