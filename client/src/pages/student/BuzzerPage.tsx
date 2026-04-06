import { useState, useEffect, useCallback } from 'react';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

type BuzzerState = 'waiting' | 'ready' | 'buzzed' | 'accepted' | 'rejected' | 'locked';

export default function BuzzerPage() {
  const [state, setBuzzerState] = useState<BuzzerState>('waiting');
  const [playerName] = useState(localStorage.getItem('playerName') || 'Player');
  const [gamePin] = useState(localStorage.getItem('gamePin') || '');
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const socket = getSocket();

    socket.on('jeopardy:buzzers_open', () => { setBuzzerState('ready'); setMessage(''); });
    socket.on('jeopardy:buzzers_locked', () => {
      setBuzzerState(s => s === 'buzzed' || s === 'accepted' ? s : 'locked');
    });
    socket.on('buzz_accepted', ({ playerName: winner, responseTime }) => {
      if (winner === playerName) {
        setBuzzerState('accepted');
        setMessage(`You buzzed in! ${responseTime}ms`);
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      } else {
        setBuzzerState('locked');
        setMessage(`${winner} buzzed in first!`);
      }
    });
    socket.on('buzz_rejected', ({ reason }) => {
      setBuzzerState('rejected');
      setMessage(reason || 'Too slow!');
      setTimeout(() => setBuzzerState('locked'), 1500);
    });
    socket.on('answer_result', ({ correct, pointsEarned, newScore }) => {
      if (newScore !== undefined) setScore(newScore);
      setBuzzerState('waiting');
    });
    socket.on('game_state', ({ phase, scores }) => {
      if (phase === 'lobby') setBuzzerState('waiting');
      const myScore = scores?.find((s: any) => s.name === playerName);
      if (myScore) setScore(myScore.score);
    });

    return () => {
      socket.off('jeopardy:buzzers_open');
      socket.off('jeopardy:buzzers_locked');
      socket.off('buzz_accepted');
      socket.off('buzz_rejected');
      socket.off('answer_result');
      socket.off('game_state');
    };
  }, [playerName]);

  const handleBuzz = useCallback(() => {
    if (state !== 'ready') return;
    setBuzzerState('buzzed');
    const socket = getSocket();
    socket.emit('buzzer_press', { pin: gamePin, playerName, timestamp: Date.now() });
    if ('vibrate' in navigator) navigator.vibrate(50);
  }, [state, gamePin, playerName]);

  const buzzerColors: Record<BuzzerState, string> = {
    waiting: 'bg-gray-800 border-gray-700',
    ready: 'bg-unoh-red border-red-400 shadow-[0_0_60px_rgba(104,0,1,0.8)] cursor-pointer',
    buzzed: 'bg-unoh-red-dark border-red-800',
    accepted: 'bg-green-700 border-green-400 shadow-[0_0_60px_rgba(34,197,94,0.6)]',
    rejected: 'bg-red-900 border-red-700',
    locked: 'bg-gray-800 border-gray-700',
  };

  const statusText: Record<BuzzerState, string> = {
    waiting: 'Waiting for question...',
    ready: 'TAP TO BUZZ!',
    buzzed: 'Buzzed in!',
    accepted: '✓ You got it!',
    rejected: '✗ Too slow',
    locked: message || 'Locked',
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-between py-8 px-4 select-none">
      {/* Header */}
      <div className="text-center">
        <p className="text-white font-bold text-xl">{playerName}</p>
        <p className="text-unoh-red font-mono text-3xl font-black mt-1">{score.toLocaleString()}</p>
        <p className="text-gray-600 text-sm">points</p>
      </div>

      {/* Buzzer */}
      <div className="flex items-center justify-center flex-1">
        <motion.button
          className={`w-72 h-72 rounded-full border-8 transition-all duration-150 flex flex-col items-center justify-center ${buzzerColors[state]}`}
          animate={{ scale: state === 'ready' ? [1, 1.03, 1] : 1 }}
          transition={{ repeat: state === 'ready' ? Infinity : 0, duration: 1 }}
          onPointerDown={handleBuzz}
          style={{ touchAction: 'none', userSelect: 'none' }}
        >
          <span className="text-6xl font-display font-black text-white tracking-wider">
            {state === 'ready' ? 'BUZZ!' : state === 'accepted' ? '✓' : state === 'waiting' ? '...' : '🔒'}
          </span>
        </motion.button>
      </div>

      {/* Message */}
      <AnimatePresence>
        <motion.div key={message} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className="text-center h-16 flex items-center">
          <p className={`text-xl font-bold ${state === 'accepted' ? 'text-green-400' : state === 'rejected' ? 'text-red-400' : 'text-gray-400'}`}>
            {statusText[state]}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
