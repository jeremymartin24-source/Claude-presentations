import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion } from 'framer-motion';

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const [pin, setPin] = useState(searchParams.get('pin') || '');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const navigate = useNavigate();

  function getStudentRoute(gameType: string): string {
    const routes: Record<string, string> = {
      bingo:       '/student/bingo',
      ranked:      '/student/ranked',
      millionaire: '/student/millionaire',
      hotseat:     '/student/hotseat',
      codebreaker: '/student/codebreaker',
      speedround:  '/student/speedround',
    };
    return routes[gameType] ?? '/student/game';
  }

  useEffect(() => {
    const socket = getSocket();
    socket.on('join_success', ({ pin, gameType, playerName }) => {
      localStorage.setItem('playerName', playerName);
      localStorage.setItem('gamePin', pin);
      localStorage.setItem('gameType', gameType);
      navigate(getStudentRoute(gameType));
    });
    socket.on('join_error', ({ message }) => {
      setError(message);
      setJoining(false);
    });
    return () => { socket.off('join_success'); socket.off('join_error'); };
  }, []);

  const handleJoin = () => {
    if (!pin.trim() || !name.trim()) { setError('Enter your PIN and name'); return; }
    setJoining(true);
    setError('');
    const socket = getSocket();
    socket.emit('join_game', { pin: pin.trim().toUpperCase(), playerName: name.trim() });
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎓</div>
          <h1 className="text-3xl font-display font-black text-white uppercase tracking-wider">UNOH</h1>
          <p className="text-unoh-red font-bold text-xl mt-1">Review Games</p>
          <p className="text-gray-500 text-sm mt-1">by Professor Martin</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2 font-medium">Game PIN</label>
            <input
              className="w-full bg-gray-900 border-2 border-gray-700 focus:border-unoh-red rounded-xl px-5 py-4 text-white text-2xl font-mono text-center tracking-widest uppercase outline-none transition-colors"
              placeholder="BOLD123"
              value={pin}
              maxLength={8}
              onChange={e => setPin(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2 font-medium">Your Name</label>
            <input
              className="w-full bg-gray-900 border-2 border-gray-700 focus:border-unoh-red rounded-xl px-5 py-4 text-white text-xl text-center outline-none transition-colors"
              placeholder="Enter your name"
              value={name}
              maxLength={20}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              autoFocus={!!pin}
            />
          </div>

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-red-400 text-sm text-center bg-red-900/20 rounded-lg py-2">
              {error}
            </motion.p>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={handleJoin}
            disabled={joining || !pin || !name}
            className="w-full btn-primary text-2xl py-5 rounded-2xl disabled:opacity-40 mt-2">
            {joining ? 'Joining...' : '🎮 JOIN GAME'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
