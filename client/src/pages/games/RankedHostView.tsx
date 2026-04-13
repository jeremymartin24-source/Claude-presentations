import ManualScorePanel from '../../components/games/ManualScorePanel';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface RankedQuestion {
  text: string;
  items: string[];
  correctOrder: string[];
  index: number;
  total: number;
}

interface PlayerResult {
  name: string;
  correctCount: number;
  totalItems: number;
  submission: string[];
}

type Phase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'gameover';

interface LeaderboardPlayer {
  name: string;
  score: number;
}

export default function RankedHostView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pin, bankId, settings } = (location.state as { pin: string; bankId: string; settings: Record<string, unknown> }) || {};

  const [players, setPlayers] = useState<{ name: string }[]>([]);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [currentQuestion, setCurrentQuestion] = useState<RankedQuestion | null>(null);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([]);
  const [scores, setScores] = useState<LeaderboardPlayer[]>([]);
  const [displayOrder, setDisplayOrder] = useState<string[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('host_game', { pin, gameType: 'ranked', bankId, settings });

    socket.on('player_joined', (data: { players: { name: string }[] }) => {
      setPlayers(data.players);
    });

    socket.on('question_reveal', (data: RankedQuestion) => {
      setCurrentQuestion(data);
      setSubmissionCount(0);
      setPlayerResults([]);
      setIsAnimating(false);
      // Scramble items for display
      const scrambled = [...data.items].sort(() => Math.random() - 0.5);
      setDisplayOrder(scrambled);
      setPhase('question');
    });

    socket.on('ranked:submissions_count', (data: { count: number }) => {
      setSubmissionCount(data.count);
    });

    socket.on('ranked:reveal_results', (data: { playerResults: PlayerResult[] }) => {
      setPlayerResults(data.playerResults);
      setPhase('reveal');
      // Animate items into correct order
      if (currentQuestion) {
        setTimeout(() => {
          setDisplayOrder([...currentQuestion.correctOrder]);
          setIsAnimating(true);
        }, 300);
      }
    });

    socket.on('leaderboard_update', (data: { scores: LeaderboardPlayer[] }) => {
      setScores(data.scores);
      setPhase('leaderboard');
    });

    socket.on('game_over', (data: { scores: LeaderboardPlayer[] }) => {
      setScores(data.scores);
      setPhase('gameover');
    });

    return () => {
      socket.off('player_joined');
      socket.off('question_reveal');
      socket.off('ranked:submissions_count');
      socket.off('ranked:reveal_results');
      socket.off('leaderboard_update');
      socket.off('game_over');
    };
  }, []);

  const socket = getSocket();
  const handleStart = () => socket.emit('ranked:start', { pin });
  const handleReveal = () => socket.emit('ranked:reveal', { pin });
  const handleNext = () => socket.emit('ranked:next', { pin });
  const handleEnd = () => { socket.emit('ranked:end', { pin }); navigate('/dashboard'); };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-black border-b border-gray-800">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black" style={{ color: '#680001' }}>UNOH</span>
          <span className="text-blue-400 font-black text-lg">📊 RANKED!</span>
        </div>
        <div className="flex items-center gap-4">
          {currentQuestion && (
            <span className="text-gray-400 text-sm">Q {currentQuestion.index + 1}/{currentQuestion.total}</span>
          )}
          <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-gray-400 uppercase tracking-widest">PIN</div>
            <div className="text-2xl font-black tracking-widest">{pin}</div>
          </div>
          <button onClick={handleEnd} className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold">
            End Game
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* LOBBY */}
        {phase === 'lobby' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
            <div className="text-6xl font-black text-blue-400">📊 RANKED!</div>
            <div className="text-gray-300 text-lg text-center max-w-lg">
              Students drag items into the correct order on their phones.<br />
              The more accurate their ranking, the more points they earn.
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-xl">Join at unoh.review — PIN:</div>
              <div className="text-7xl font-black text-white tracking-widest">{pin}</div>
            </div>
            <div className="text-xl text-white">{players.length} player{players.length !== 1 ? 's' : ''} joined</div>
            <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
              {players.map((p) => (
                <motion.span key={p.name} initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm">{p.name}</motion.span>
              ))}
            </div>
            <button onClick={handleStart} disabled={players.length === 0}
              className="px-12 py-5 text-2xl font-black rounded-2xl text-white disabled:opacity-50"
              style={{ backgroundColor: '#680001' }}>
              START GAME →
            </button>
          </motion.div>
        )}

        {/* QUESTION PHASE */}
        {phase === 'question' && currentQuestion && (
          <motion.div key="question" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col p-8 gap-6">
            <div className="text-center">
              <div className="text-gray-400 text-sm uppercase tracking-widest mb-2">Put these in the correct order:</div>
              <div className="text-4xl font-bold text-white">{currentQuestion.text}</div>
            </div>

            {/* Scrambled items display */}
            <div className="flex-1 flex flex-col items-center justify-center gap-3 max-w-2xl mx-auto w-full">
              {displayOrder.map((item, i) => (
                <div key={item}
                  className="w-full bg-gray-800 border-2 border-gray-600 rounded-xl p-4 flex items-center gap-4">
                  <span className="text-gray-500 font-black text-xl w-8">{i + 1}.</span>
                  <span className="text-white text-xl font-bold flex-1">{item}</span>
                  <span className="text-gray-600 text-sm">≡ drag</span>
                </div>
              ))}
            </div>

            {/* Submission progress */}
            <div className="bg-gray-900 rounded-xl p-4 max-w-2xl mx-auto w-full">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 text-sm uppercase tracking-widest">Submissions</span>
                <span className="text-white font-black">{submissionCount} / {players.length}</span>
              </div>
              <div className="bg-gray-700 rounded-full h-3 overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ backgroundColor: '#3b82f6' }}
                  animate={{ width: players.length > 0 ? `${(submissionCount / players.length) * 100}%` : '0%' }}
                  transition={{ duration: 0.4 }} />
              </div>
            </div>

            <div className="flex justify-center">
              <button onClick={handleReveal}
                className="px-10 py-4 text-xl font-black rounded-xl text-white"
                style={{ backgroundColor: '#680001' }}>
                Reveal Order →
              </button>
            </div>
          </motion.div>
        )}

        {/* REVEAL PHASE */}
        {phase === 'reveal' && currentQuestion && (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex gap-6 p-6 overflow-hidden">
            {/* Correct order animation */}
            <div className="flex-1 flex flex-col gap-4">
              <div className="text-center">
                <div className="text-gray-400 text-sm uppercase tracking-widest mb-2">Correct Order</div>
                <div className="text-2xl font-bold text-white">{currentQuestion.text}</div>
              </div>
              <div className="flex flex-col gap-2">
                <AnimatePresence>
                  {currentQuestion.correctOrder.map((item, i) => (
                    <motion.div
                      key={item}
                      initial={{ x: -60, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.15, type: 'spring', stiffness: 200 }}
                      className="flex items-center gap-4 bg-green-900 border-2 border-green-500 rounded-xl p-4"
                    >
                      <span className="text-green-400 font-black text-2xl w-8">{i + 1}.</span>
                      <span className="text-white text-xl font-bold flex-1">{item}</span>
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.15 + 0.3 }}
                        className="text-green-400 text-xl">✓</motion.span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <div className="flex justify-center mt-2">
                <button onClick={handleNext}
                  className="px-8 py-4 text-xl font-black rounded-xl text-white"
                  style={{ backgroundColor: '#680001' }}>
                  Next Question →
                </button>
              </div>
            </div>

            {/* Player accuracy */}
            <div className="w-72 flex flex-col overflow-hidden">
              <div className="text-gray-400 text-sm uppercase tracking-widest mb-3">Player Accuracy</div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {playerResults
                  .sort((a, b) => b.correctCount - a.correctCount)
                  .map((r, i) => {
                    const pct = Math.round((r.correctCount / r.totalItems) * 100);
                    return (
                      <motion.div key={r.name} initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.06 }}
                        className="bg-gray-900 border border-gray-700 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white font-bold text-sm truncate">{r.name}</span>
                          <span className="text-sm font-black ml-2"
                            style={{ color: pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444' }}>
                            {r.correctCount}/{r.totalItems}
                          </span>
                        </div>
                        <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                          <motion.div className="h-full rounded-full"
                            style={{ backgroundColor: pct >= 80 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444' }}
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                            transition={{ delay: i * 0.06 + 0.2, duration: 0.5 }} />
                        </div>
                        <div className="text-gray-500 text-xs mt-1">{pct}% correct</div>
                      </motion.div>
                    );
                  })}
                {playerResults.length === 0 && (
                  <div className="text-gray-600 text-sm">No submissions yet</div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* LEADERBOARD / GAMEOVER */}
        {(phase === 'leaderboard' || phase === 'gameover') && (
          <motion.div key="lb" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
            <div className="text-5xl font-black text-white">
              {phase === 'gameover' ? '🏆 FINAL SCORES' : 'LEADERBOARD'}
            </div>
            <div className="w-full max-w-2xl space-y-3">
              {scores.slice(0, 5).map((p, i) => {
                const max = scores[0]?.score || 1;
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                return (
                  <motion.div key={p.name} initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-4 bg-gray-900 rounded-xl p-4">
                    <span className="text-3xl">{medals[i]}</span>
                    <div className="flex-1">
                      <div className="text-white font-bold text-lg">{p.name}</div>
                      <div className="bg-gray-700 rounded-full h-3 mt-1 overflow-hidden">
                        <motion.div className="h-full rounded-full bg-blue-500"
                          initial={{ width: 0 }} animate={{ width: `${(p.score / max) * 100}%` }}
                          transition={{ delay: i * 0.1 + 0.3, duration: 0.8 }} />
                      </div>
                    </div>
                    <span className="text-2xl font-black text-white">{p.score}</span>
                  </motion.div>
                );
              })}
            </div>
            {phase === 'leaderboard' ? (
              <button onClick={handleNext}
                className="px-10 py-4 text-xl font-black rounded-xl text-white"
                style={{ backgroundColor: '#680001' }}>
                Next Question →
              </button>
            ) : (
              <button onClick={() => navigate('/dashboard')}
                className="px-8 py-4 text-xl font-black rounded-xl text-white bg-gray-700 hover:bg-gray-600">
                Back to Dashboard
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {(location.state as any)?.settings?.noJoin && <ManualScorePanel pin={(location.state as any)?.pin} />}
    </div>
  );
}
