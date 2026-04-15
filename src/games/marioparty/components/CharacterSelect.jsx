import { motion, AnimatePresence } from 'framer-motion';
import { CHARACTERS_ARRAY } from '../../../../shared/characters.js';
import CharacterSprite from './CharacterSprite.jsx';
import socket from '../../../socket.js';

export default function CharacterSelect({ gameState, playerId, isHost }) {
  const usedCharacters = gameState?.usedCharacters ?? [];
  const myPlayer = gameState?.players.find(p => p.id === playerId);
  const myChar = myPlayer?.characterId;

  function select(charId) {
    if (usedCharacters.includes(charId) && charId !== myChar) return;
    socket.emit('player:selectCharacter', { characterId: charId });
  }

  function allReady() {
    return gameState?.players.every(p => p.characterId);
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1A1A2E 0%, #2C2C54 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '1.5rem',
      gap: '1.5rem',
    }}>
      <h2 style={{ color: '#F1C40F', fontSize: '1.8rem', fontWeight: 900, textTransform: 'uppercase' }}>
        🎮 Pick Your Character!
      </h2>

      {!isHost && (
        <p style={{ color: myChar ? '#2ECC71' : '#BDC3C7', fontWeight: 700 }}>
          {myChar ? `✅ Playing as ${CHARACTERS_ARRAY.find(c => c.id === myChar)?.name}` : 'Choose your character below'}
        </p>
      )}

      {/* Character grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1rem',
        width: '100%',
        maxWidth: '800px',
      }}>
        {CHARACTERS_ARRAY.map(char => {
          const taken = usedCharacters.includes(char.id) && char.id !== myChar;
          const mine = myChar === char.id;
          const takenBy = taken ? gameState?.players.find(p => p.characterId === char.id) : null;

          return (
            <motion.button
              key={char.id}
              onClick={() => !isHost && select(char.id)}
              disabled={taken || isHost}
              whileHover={!taken && !isHost ? { scale: 1.05 } : {}}
              whileTap={!taken && !isHost ? { scale: 0.95 } : {}}
              style={{
                background: mine
                  ? 'rgba(241,196,15,0.2)'
                  : taken
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(255,255,255,0.08)',
                border: mine
                  ? '2px solid #F1C40F'
                  : taken
                  ? '2px solid rgba(255,255,255,0.1)'
                  : '2px solid rgba(255,255,255,0.15)',
                borderRadius: '12px',
                padding: '1rem 0.5rem',
                cursor: taken || isHost ? 'default' : 'pointer',
                opacity: taken ? 0.45 : 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.15s',
              }}
            >
              <CharacterSprite
                characterId={char.id}
                animation={mine ? 'selected' : taken ? 'lose' : 'idle'}
                size={60}
              />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: mine ? '#F1C40F' : '#ECF0F1' }}>
                  {char.emoji} {char.name}
                </div>
                <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '0.2rem' }}>
                  {char.title}
                </div>
                {taken && (
                  <div style={{ fontSize: '0.65rem', color: '#E74C3C', marginTop: '0.2rem' }}>
                    {takenBy?.name ?? 'Taken'}
                  </div>
                )}
                {mine && (
                  <div style={{ fontSize: '0.65rem', color: '#F1C40F', fontWeight: 700 }}>
                    ← You
                  </div>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Player ready status */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
        {gameState?.players.map(p => (
          <div
            key={p.id}
            style={{
              background: p.characterId ? 'rgba(46,204,113,0.2)' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${p.characterId ? '#2ECC71' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '999px',
              padding: '0.3rem 0.8rem',
              fontSize: '0.8rem',
              color: p.characterId ? '#2ECC71' : '#BDC3C7',
              fontWeight: 700,
            }}
          >
            {p.characterId ? '✅' : '⏳'} {p.name}
            {p.characterId ? ` (${CHARACTERS_ARRAY.find(c => c.id === p.characterId)?.name})` : ''}
          </div>
        ))}
      </div>

      {/* Host: start round button */}
      {isHost && allReady() && (
        <motion.button
          className="btn btn-green btn-lg"
          onClick={() => socket.emit('host:startRound')}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ fontSize: '1.3rem', padding: '1rem 2.5rem' }}
        >
          🎲 Start the Game!
        </motion.button>
      )}

      {isHost && !allReady() && (
        <p style={{ color: '#BDC3C7', opacity: 0.6 }}>
          Waiting for all players to pick characters…
        </p>
      )}
    </div>
  );
}
