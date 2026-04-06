import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { useConfetti } from '../../hooks/useConfetti';

export default function LeaderboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { fireSchoolPride } = useConfetti();
  const scores: any[] = location.state?.scores || [];
  const playerName: string = location.state?.playerName || localStorage.getItem('playerName') || '';

  const myEntry = scores.find(s => s.name === playerName);
  const myRank = myEntry?.rank || scores.findIndex(s => s.name === playerName) + 1;

  useEffect(() => {
    if (myRank <= 3) fireSchoolPride();
  }, []);

  const MEDAL = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-screen bg-black flex flex-col items-center px-4 py-10">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
        <div className="text-5xl mb-3">{myRank <= 3 ? MEDAL[myRank - 1] : '🎮'}</div>
        <h1 className="text-3xl font-bold text-white">Game Over!</h1>
        {myEntry && (
          <div className="mt-3">
            <p className="text-unoh-red text-2xl font-black">#{myRank} — {myEntry.score?.toLocaleString()} pts</p>
            <p className="text-gray-400 text-sm mt-1">{playerName}</p>
          </div>
        )}
      </motion.div>

      {/* Podium */}
      {scores.length >= 3 && (
        <div className="flex items-end justify-center gap-3 mb-8">
          {[scores[1], scores[0], scores[2]].map((p: any, i) => {
            const heights = ['h-20', 'h-28', 'h-16'];
            const medals = ['🥈', '🥇', '🥉'];
            const positions = [2, 1, 3];
            return p ? (
              <motion.div key={p.name}
                initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.2 }}
                className={`${heights[i]} w-20 bg-gray-900 border border-gray-700 rounded-t-xl flex flex-col items-center justify-end pb-2`}>
                <span className="text-2xl">{medals[i]}</span>
                <p className="text-white text-xs font-bold truncate w-full text-center px-1">{p.name}</p>
                <p className="text-gray-500 text-xs">{p.score?.toLocaleString()}</p>
              </motion.div>
            ) : null;
          })}
        </div>
      )}

      {/* Full list */}
      <div className="w-full max-w-sm space-y-2">
        {scores.map((p: any, i: number) => (
          <motion.div key={p.name}
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.05 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl ${p.name === playerName ? 'bg-unoh-red/20 border border-unoh-red' : 'bg-gray-900 border border-gray-800'}`}>
            <span className={`text-lg w-7 text-center ${i < 3 ? 'text-xl' : 'text-gray-600 font-bold'}`}>
              {i < 3 ? MEDAL[i] : `${i + 1}`}
            </span>
            <span className={`flex-1 font-medium ${p.name === playerName ? 'text-white' : 'text-gray-300'}`}>{p.name}</span>
            {p.team && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{p.team}</span>}
            <span className="text-unoh-red font-bold font-mono">{p.score?.toLocaleString()}</span>
          </motion.div>
        ))}
      </div>

      <button onClick={() => navigate('/')} className="mt-10 btn-secondary px-8 py-3">
        Play Again?
      </button>
    </div>
  );
}
