import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../../../socket.js';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];
const CHOICE_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12'];

export default function QuestionPanel({ gameState, playerId, isHost, isMiniGame = false }) {
  const [myAnswer, setMyAnswer] = useState(null);
  const [results, setResults] = useState([]); // [{ playerId, playerName, correct, coinsEarned }]
  const question = gameState?.currentQuestion;
  const answered = gameState?.answeredPlayers ?? [];
  const hasAnswered = answered.includes(playerId);
  const myPlayer = gameState?.players?.find(p => p.id === playerId);

  useEffect(() => {
    // Reset when new question arrives
    setMyAnswer(null);
    setResults([]);
  }, [question?.id]);

  useEffect(() => {
    function onResult(result) {
      setResults(prev => {
        if (prev.find(r => r.playerId === result.playerId)) return prev;
        return [...prev, result];
      });
    }
    socket.on('game:answerResult', onResult);
    return () => socket.off('game:answerResult', onResult);
  }, []);

  if (!question) return null;

  function submitAnswer(idx) {
    if (hasAnswered || isHost) return;
    setMyAnswer(idx);
    socket.emit('player:answer', { choiceIndex: idx });
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
        border: '2px solid #3498DB',
        borderRadius: '16px',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        maxWidth: '600px',
        width: '100%',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
        <span style={{ fontSize: '1.6rem' }}>{isMiniGame ? '🎮' : '❓'}</span>
        <div>
          <h3 style={{ color: '#3498DB', fontWeight: 900, textTransform: 'uppercase', fontSize: '0.9rem' }}>
            {isMiniGame ? 'Mini-Game Question!' : `Question — ${question.category}`}
          </h3>
          <div style={{ fontSize: '0.7rem', color: '#F1C40F', opacity: 0.8 }}>
            +{question.coins} coins for correct answer
            {isMiniGame ? ' (first right answer wins 8 coins!)' : ''}
          </div>
        </div>
      </div>

      {/* Question text */}
      <div style={{
        background: 'rgba(52,152,219,0.1)',
        borderRadius: '10px',
        padding: '1rem',
        fontSize: '1.1rem',
        fontWeight: 700,
        lineHeight: 1.5,
        color: '#ECF0F1',
      }}>
        {question.question}
      </div>

      {/* Choices */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {question.choices.map((choice, i) => {
          const isSelected = myAnswer === i;
          const resultForThis = results.find(r => r.correct && r.playerId === playerId && myAnswer === i);
          const somoneCorrect = results.find(r => r.correct);

          return (
            <motion.button
              key={i}
              onClick={() => submitAnswer(i)}
              disabled={hasAnswered || isHost}
              whileHover={!hasAnswered && !isHost ? { scale: 1.02 } : {}}
              whileTap={!hasAnswered && !isHost ? { scale: 0.98 } : {}}
              style={{
                background: isSelected
                  ? `${CHOICE_COLORS[i]}33`
                  : 'rgba(255,255,255,0.06)',
                border: `2px solid ${isSelected ? CHOICE_COLORS[i] : 'rgba(255,255,255,0.12)'}`,
                borderRadius: '10px',
                padding: '0.7rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.8rem',
                cursor: hasAnswered || isHost ? 'default' : 'pointer',
                textAlign: 'left',
                color: '#ECF0F1',
                fontSize: '0.95rem',
                transition: 'all 0.15s',
              }}
            >
              <span style={{
                background: CHOICE_COLORS[i],
                color: '#fff',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '0.8rem',
                flexShrink: 0,
              }}>
                {CHOICE_LABELS[i]}
              </span>
              {choice}
            </motion.button>
          );
        })}
      </div>

      {/* Status / results */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {/* Answered players */}
        {answered.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {gameState.players.map(p => (
              answered.includes(p.id) && (
                <span key={p.id} style={{
                  background: 'rgba(46,204,113,0.2)',
                  border: '1px solid #2ECC71',
                  borderRadius: '999px',
                  padding: '0.15rem 0.6rem',
                  fontSize: '0.75rem',
                  color: '#2ECC71',
                }}>
                  ✓ {p.name}
                </span>
              )
            ))}
          </div>
        )}

        {/* Correct answers revealed */}
        <AnimatePresence>
          {results.map(r => (
            <motion.div
              key={r.playerId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              style={{
                color: r.correct ? '#2ECC71' : '#E74C3C',
                fontSize: '0.85rem',
                fontWeight: 700,
              }}
            >
              {r.correct
                ? `✅ ${r.playerName} answered correctly! +${r.coinsEarned} coins`
                : `❌ ${r.playerName} answered incorrectly`}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Player: waiting state */}
        {!isHost && hasAnswered && (
          <p style={{ opacity: 0.6, fontSize: '0.85rem' }}>
            Answer submitted. Waiting for host to close question…
          </p>
        )}
        {!isHost && !hasAnswered && (
          <p style={{ opacity: 0.6, fontSize: '0.85rem' }}>
            Select your answer above!
          </p>
        )}
      </div>

      {/* Host controls */}
      {isHost && (
        <button
          className="btn btn-blue"
          onClick={() => socket.emit('host:closeQuestion')}
          style={{ alignSelf: 'flex-end' }}
        >
          Close Question →
        </button>
      )}
    </motion.div>
  );
}
