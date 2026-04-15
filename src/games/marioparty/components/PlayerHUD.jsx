import { motion, AnimatePresence } from 'framer-motion';
import { CHARACTERS } from '../../../../shared/characters.js';
import CharacterSprite from './CharacterSprite.jsx';

export default function PlayerHUD({ players = [], currentPlayerId, compact = false }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: compact ? 'row' : 'column',
      gap: '0.5rem',
      flexWrap: 'wrap',
    }}>
      {players.map(player => (
        <PlayerCard
          key={player.id}
          player={player}
          isActive={player.id === currentPlayerId}
          compact={compact}
        />
      ))}
    </div>
  );
}

function PlayerCard({ player, isActive, compact }) {
  const char = CHARACTERS[player.characterId];

  return (
    <motion.div
      animate={isActive ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 1, repeat: Infinity }}
      style={{
        background: isActive
          ? 'rgba(241,196,15,0.15)'
          : 'rgba(255,255,255,0.06)',
        border: `2px solid ${isActive ? '#F1C40F' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '10px',
        padding: compact ? '0.4rem 0.7rem' : '0.7rem',
        display: 'flex',
        flexDirection: compact ? 'row' : 'row',
        alignItems: 'center',
        gap: '0.6rem',
        minWidth: compact ? 'unset' : '100%',
        transition: 'border-color 0.3s, background 0.3s',
      }}
    >
      {/* Character sprite (small) */}
      {player.characterId && (
        <CharacterSprite
          characterId={player.characterId}
          animation={isActive ? 'idle' : 'idle'}
          size={compact ? 28 : 38}
        />
      )}

      {/* Player info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 800,
          fontSize: compact ? '0.8rem' : '0.95rem',
          color: isActive ? '#F1C40F' : '#ECF0F1',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {isActive && '▶ '}{player.name}
        </div>
        {char && (
          <div style={{ fontSize: '0.65rem', opacity: 0.5 }}>
            {char.emoji} {char.name}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex',
        flexDirection: compact ? 'row' : 'column',
        gap: '0.2rem',
        alignItems: 'flex-end',
      }}>
        <span className="badge badge-coin" style={{ fontSize: compact ? '0.7rem' : '0.8rem' }}>
          🪙 {player.coins}
        </span>
        <span className="badge badge-star" style={{ fontSize: compact ? '0.7rem' : '0.8rem' }}>
          ⭐ {player.stars}
        </span>
        {player.itemCount > 0 && (
          <span className="badge" style={{
            background: 'rgba(155,89,182,0.3)',
            border: '1px solid #9B59B6',
            color: '#D7BDE2',
            fontSize: compact ? '0.7rem' : '0.8rem',
          }}>
            🎒 {player.itemCount}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Scoreboard (end-of-round / game-over variant) ─────────────────────────────
export function Scoreboard({ players = [], winner }) {
  const sorted = [...players].sort((a, b) => {
    if (b.stars !== a.stars) return b.stars - a.stars;
    return b.coins - a.coins;
  });

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {sorted.map((player, i) => (
        <motion.div
          key={player.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          style={{
            background: i === 0 ? 'rgba(241,196,15,0.2)' : 'rgba(255,255,255,0.06)',
            border: `2px solid ${i === 0 ? '#F1C40F' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '10px',
            padding: '0.7rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>{medals[i] ?? `${i + 1}.`}</span>
          {player.characterId && <CharacterSprite characterId={player.characterId} animation="idle" size={36} />}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: i === 0 ? '#F1C40F' : '#ECF0F1' }}>
              {player.name}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="badge badge-star">⭐ {player.stars}</span>
            <span className="badge badge-coin">🪙 {player.coins}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
