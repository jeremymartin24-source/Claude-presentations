import { motion } from 'framer-motion';
import { BOARD_SPACES, SPACE_COLORS, SPACE_ICONS } from '../../../../shared/boardData.js';
import socket from '../../../socket.js';

export default function ForkChoice({ gameState, playerId }) {
  const phase = gameState?.phase;
  const fork = gameState?.pendingFork;
  const currentPlayerId = gameState?.currentPlayerId;
  const isMyTurn = currentPlayerId === playerId;

  if (phase !== 'forkChoice' || !fork) return null;

  const options = fork.options.map(id => BOARD_SPACES[id]).filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        background: 'rgba(26,26,46,0.95)',
        border: '2px solid #F1C40F',
        borderRadius: '16px',
        padding: '1.5rem',
        maxWidth: '420px',
        width: '100%',
        margin: '0 auto',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        alignItems: 'center',
      }}
    >
      <div style={{ fontSize: '2rem' }}>🍴</div>
      <h3 style={{ color: '#F1C40F', fontWeight: 900, textTransform: 'uppercase' }}>
        Fork in the Road!
      </h3>
      <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>
        {isMyTurn
          ? 'Choose your path!'
          : `${gameState?.currentPlayerName} is choosing a path…`}
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {options.map(space => {
          const color = SPACE_COLORS[space.type] ?? '#555';
          const icon = SPACE_ICONS[space.type] ?? '?';

          return (
            <motion.button
              key={space.id}
              onClick={() => {
                if (isMyTurn) socket.emit('player:forkChoice', { nextSpaceId: space.id });
              }}
              disabled={!isMyTurn}
              whileHover={isMyTurn ? { scale: 1.07 } : {}}
              whileTap={isMyTurn ? { scale: 0.93 } : {}}
              style={{
                background: `${color}22`,
                border: `3px solid ${color}`,
                borderRadius: '14px',
                padding: '1rem 1.4rem',
                cursor: isMyTurn ? 'pointer' : 'default',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.4rem',
                minWidth: '120px',
              }}
            >
              <span style={{ fontSize: '2rem' }}>{icon}</span>
              <span style={{ color, fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase' }}>
                {space.name}
              </span>
              <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>Space #{space.id}</span>
            </motion.button>
          );
        })}
      </div>

      {!isMyTurn && (
        <p style={{ opacity: 0.4, fontSize: '0.8rem' }}>
          Waiting for {gameState?.currentPlayerName} to choose…
        </p>
      )}
    </motion.div>
  );
}
