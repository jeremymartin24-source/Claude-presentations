import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../../../socket.js';

// Single die face using SVG dot patterns
function DieFace({ value, size = 80, color = '#fff', bg = '#2C2C54' }) {
  // Dot positions for each face [1-6]
  const dotPatterns = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [75, 25], [25, 75], [75, 75]],
    5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
    6: [[25, 22], [75, 22], [25, 50], [75, 50], [25, 78], [75, 78]],
  };

  const dots = dotPatterns[value] ?? dotPatterns[1];
  const dotR = size * 0.09;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {/* Die body */}
      <rect x="4" y="4" width="92" height="92" rx="16" fill={bg} />
      <rect x="4" y="4" width="92" height="92" rx="16" fill="none" stroke={color} strokeWidth="3" opacity="0.3" />
      {/* Dots */}
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={dotR} fill={color} />
      ))}
    </svg>
  );
}

export default function DiceRoll({ gameState, playerId, isHost }) {
  const [rolling, setRolling] = useState(false);
  const [rollResult, setRollResult] = useState(null);
  const [displayValue, setDisplayValue] = useState(null);

  const phase = gameState?.phase;
  const currentPlayerId = gameState?.currentPlayerId;
  const isMyTurn = currentPlayerId === playerId;

  useEffect(() => {
    function onRoll({ rolls, total }) {
      setRolling(true);
      setRollResult({ rolls, total });

      // Animate scramble then settle
      let count = 0;
      const interval = setInterval(() => {
        setDisplayValue(Math.ceil(Math.random() * 6));
        count++;
        if (count > 14) {
          clearInterval(interval);
          setDisplayValue(total);
          setTimeout(() => setRolling(false), 600);
        }
      }, 80);
    }

    socket.on('game:diceRoll', onRoll);
    return () => socket.off('game:diceRoll', onRoll);
  }, []);

  // Reset on new turn
  useEffect(() => {
    if (phase === 'itemUse') {
      setRollResult(null);
      setDisplayValue(null);
      setRolling(false);
    }
  }, [phase, currentPlayerId]);

  const canRoll = (isMyTurn || isHost) && (phase === 'itemUse' || phase === 'rolling');

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem',
    }}>
      {/* Current player banner */}
      {phase === 'itemUse' || phase === 'rolling' ? (
        <div style={{
          background: 'rgba(241,196,15,0.15)',
          border: '2px solid #F1C40F',
          borderRadius: '12px',
          padding: '0.5rem 1.5rem',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Current Turn</p>
          <p style={{ fontWeight: 900, fontSize: '1.2rem', color: '#F1C40F' }}>
            {gameState?.currentPlayerName ?? '...'}
          </p>
        </div>
      ) : null}

      {/* Die */}
      <motion.div
        animate={rolling ? { rotate: [0, 20, -20, 15, -15, 0], scale: [1, 1.15, 0.9, 1.1, 1] } : {}}
        transition={{ duration: 0.5 }}
        style={{ cursor: canRoll && !rolling ? 'pointer' : 'default' }}
        onClick={() => {
          if (canRoll && !rolling) {
            socket.emit('player:roll');
          }
        }}
      >
        <DieFace
          value={displayValue ?? 1}
          size={90}
          bg={rolling ? '#E74C3C' : canRoll ? '#2C2C54' : '#1A1A2E'}
          color={rolling ? '#FFD700' : canRoll ? '#F1C40F' : '#555'}
        />
      </motion.div>

      {/* Roll result */}
      <AnimatePresence>
        {rollResult && !rolling && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{ textAlign: 'center' }}
          >
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#F1C40F' }}>
              {rollResult.total}
            </div>
            {rollResult.rolls.length > 1 && (
              <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                Dice: [{rollResult.rolls.join(', ')}]
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Roll button */}
      {canRoll && !rolling && !rollResult && (
        <motion.button
          className="btn btn-yellow btn-lg"
          onClick={() => socket.emit('player:roll')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          🎲 {isMyTurn ? 'Roll!' : 'Roll for Player'}
        </motion.button>
      )}

      {rolling && (
        <p style={{ color: '#F1C40F', fontWeight: 700, fontSize: '1.1rem' }}>
          Rolling…
        </p>
      )}
    </div>
  );
}
