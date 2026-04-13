import ManualScorePanel from '../../components/games/ManualScorePanel';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface Player {
  name: string;
  score: number;
}

interface Question {
  text: string;
  answer: string;
  index: number;
  total: number;
}

type Phase = 'lobby' | 'question' | 'buzzers' | 'judging' | 'leaderboard' | 'gameover';

export default function SpeedRoundHostView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pin, bankId, settings } = (location.state as { pin: string; bankId: string; settings: Record<string, unknown> }) || {};

  const [players, setPlayers] = useState<Player[]>([]);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [buzzerQueue, setBuzzerQueue] = useState<string[]>([]);
  const [scores, setScores] = useState<Player[]>([]);
  const [timeLeft, setTimeLeft] = useState(5);
  const [showAnswer, setShowAnswer] = useState(false);
  const [lastResult, setLastResult] = useState<{ name: string; correct: boolean } | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('host_game', { pin, gameType: 'speedround', bankId, settings });

    socket.on('player_joined', (data: { players: Player[] }) => {
      setPlayers(data.players);
    });

    socket.on('question_reveal', (data: Question) => {
      setCurrentQuestion(data);
      setBuzzerQueue([]);
      setShowAnswer(false);
      setLastResult(null);
      setTimeLeft(5);
      setPhase('question');
      // Auto-open buzzers after 1s delay
      setTimeout(() => {
        getSocket().emit('speedround:open_buzzers', { pin });
        setPhase('buzzers');
      }, 1200);
    });

    socket.on('buzz_accepted', (data: { playerName: string }) => {
      setBuzzerQueue((prev) => {
        if (!prev.includes(data.playerName)) return [...prev, data.playerName];
        return prev;
      });
      setPhase('judging');
      setTimeLeft(5);
    });

    socket.on('timer_tick', (data: { timeLeft: number }) => {
      setTimeLeft(data.timeLeft);
    });

    socket.on('leaderboard_update', (data: { scores: Player[] }) => {
      setScores(data.scores);
      setPhase('leaderboard');
    });

    socket.on('game_over', (data: { scores: Player[] }) => {
      setScores(data.scores);
      setPhase('gameover');
    });

    return () => {
      socket.off('player_joined');
      socket.off('question_reveal');
      socket.off('buzz_accepted');
      socket.off('timer_tick');
      socket.off('leaderboard_update');
      socket.off('game_over');
    };
  }, []);

  const socket = getSocket();

  const handleStart = () => socket.emit('speedround:start', { pin });
  const handleNext = () => socket.emit('speedround:next', { pin });
  const handleEnd = () => { socket.emit('speedround:end', { pin }); navigate('/dashboard'); };

  const handleJudge = (correct: boolean) => {
    if (buzzerQueue.length === 0) return;
    const playerName = buzzerQueue[0];
    socket.emit('speedround:judge', { pin, playerName, correct });
    setLastResult({ name: playerName, correct });
    if (correct) {
      setScores((prev) => {
        const existing = prev.find((p) => p.name === playerName);
        if (existing) return prev.map((p) => p.name === playerName ? { ...p, score: p.score + 100 } : p);
        return [...prev, { name: playerName, score: 100 }];
      });
      setBuzzerQueue([]);
      setShowAnswer(true);
      setPhase('question');
    } else {
      const remaining = buzzerQueue.slice(1);
      setBuzzerQueue(remaining);
      if (remaining.length > 0) {
        setPhase('judging');
        setTimeLeft(5);
      } else {
        setShowAnswer(true);
        setPhase('question');
      }
    }
  };

  const sortedScores = [...scores].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 bg-black border-b border-gray-800">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-black" style={{ color: '#680001' }}>UNOH</span>
            <span className="text-gray-300 text-lg font-bold">⚡ Speed Round</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-center">
              <div className="text-xs text-gray-400 uppercase tracking-widest">PIN</div>
              <div className="text-2xl font-black tracking-widest">{pin}</div>
            </div>
            {currentQuestion && (
              <div className="text-gray-400 text-sm">Q {currentQuestion.index + 1}/{currentQuestion.total}</div>
            )}
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
              <div className="text-6xl font-black" style={{ color: '#680001' }}>⚡ SPEED ROUND</div>
              <div className="text-center">
                <div className="text-gray-300 text-xl">Join at unoh.review — PIN:</div>
                <div className="text-8xl font-black text-white tracking-widest">{pin}</div>
              </div>
              <div className="text-2xl text-white">{players.length} player{players.length !== 1 ? 's' : ''} ready</div>
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                {players.map((p) => (
                  <motion.span key={p.name} initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm font-medium">{p.name}</motion.span>
                ))}
              </div>
              <button onClick={handleStart} disabled={players.length === 0}
                className="px-12 py-5 text-2xl font-black rounded-2xl text-white disabled:opacity-50"
                style={{ backgroundColor: '#680001' }}>
                START ⚡
              </button>
            </motion.div>
          )}

          {/* QUESTION / BUZZERS / JUDGING */}
          {(phase === 'question' || phase === 'buzzers' || phase === 'judging') && currentQuestion && (
            <motion.div key="question" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col">
              {/* Big question */}
              <div className="flex-1 flex items-center justify-center px-10 py-6">
                <div className="text-center max-w-4xl">
                  <motion.div
                    key={currentQuestion.index}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-5xl font-bold text-white leading-tight mb-6"
                  >
                    {currentQuestion.text}
                  </motion.div>

                  {showAnswer && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-green-900 border-2 border-green-400 rounded-xl p-5 mb-4">
                      <div className="text-green-300 text-sm uppercase tracking-widest mb-1">Answer</div>
                      <div className="text-3xl font-bold text-white">{currentQuestion.answer}</div>
                    </motion.div>
                  )}

                  {lastResult && (
                    <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className={`text-4xl font-black py-3 ${lastResult.correct ? 'text-green-400' : 'text-red-400'}`}>
                      {lastResult.correct ? `✓ ${lastResult.name} got it!` : `✗ ${lastResult.name} — wrong!`}
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Buzzer status */}
              <div className="bg-gray-900 border-t border-gray-800 px-6 py-4">
                <div className="flex items-center gap-6">
                  {phase === 'buzzers' && (
                    <div className="flex items-center gap-2">
                      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.8 }}
                        className="w-4 h-4 rounded-full bg-green-400" />
                      <span className="text-green-400 font-bold">BUZZERS OPEN</span>
                    </div>
                  )}

                  {phase === 'judging' && buzzerQueue.length > 0 && (
                    <div className="flex items-center gap-4">
                      <div className="text-white font-black text-2xl">
                        🎯 {buzzerQueue[0]}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm"
                          style={{ backgroundColor: timeLeft <= 2 ? '#ef4444' : '#22c55e', color: 'white' }}>
                          {timeLeft}
                        </div>
                        <span className="text-gray-400 text-sm">seconds to answer</span>
                      </div>
                      <button onClick={() => handleJudge(true)}
                        className="px-6 py-3 font-black rounded-lg text-white bg-green-600 hover:bg-green-500 text-lg">
                        ✓ CORRECT
                      </button>
                      <button onClick={() => handleJudge(false)}
                        className="px-6 py-3 font-black rounded-lg text-white bg-red-600 hover:bg-red-500 text-lg">
                        ✗ WRONG
                      </button>
                    </div>
                  )}

                  {buzzerQueue.slice(1).length > 0 && (
                    <div className="ml-auto text-gray-400 text-sm">
                      Queue: {buzzerQueue.slice(1).join(', ')}
                    </div>
                  )}

                  <div className="ml-auto flex gap-3">
                    {(showAnswer || phase === 'question') && (
                      <button onClick={handleNext}
                        className="px-6 py-3 font-black rounded-lg text-white text-lg"
                        style={{ backgroundColor: '#680001' }}>
                        Next Question →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* LEADERBOARD / GAMEOVER */}
          {(phase === 'leaderboard' || phase === 'gameover') && (
            <motion.div key="lb" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
              <div className="text-5xl font-black text-white">
                {phase === 'gameover' ? '🏆 FINAL SCORES' : 'LEADERBOARD'}
              </div>
              <div className="w-full max-w-2xl space-y-3">
                {sortedScores.slice(0, 8).map((player, i) => {
                  const max = sortedScores[0]?.score || 1;
                  return (
                    <motion.div key={player.name} initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-center gap-4 bg-gray-900 rounded-xl p-4">
                      <span className="text-2xl font-black w-8">{i + 1}.</span>
                      <div className="flex-1">
                        <div className="text-white font-bold">{player.name}</div>
                        <div className="bg-gray-700 rounded-full h-2 mt-1">
                          <motion.div className="h-full rounded-full" style={{ backgroundColor: '#680001' }}
                            initial={{ width: 0 }} animate={{ width: `${(player.score / max) * 100}%` }}
                            transition={{ delay: i * 0.08 + 0.3, duration: 0.6 }} />
                        </div>
                      </div>
                      <span className="text-xl font-black text-white">{player.score}</span>
                    </motion.div>
                  );
                })}
              </div>
              {phase === 'leaderboard' ? (
                <button onClick={handleNext} className="px-8 py-4 font-black rounded-xl text-white text-xl"
                  style={{ backgroundColor: '#680001' }}>Next Question →</button>
              ) : (
                <button onClick={() => navigate('/dashboard')}
                  className="px-8 py-4 font-black rounded-xl text-white bg-gray-700 hover:bg-gray-600 text-xl">
                  Back to Dashboard
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Score ticker sidebar */}
      {phase !== 'lobby' && (
        <div className="w-48 bg-black border-l border-gray-800 flex flex-col p-3 overflow-y-auto">
          <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">Scoreboard</div>
          {sortedScores.map((p, i) => (
            <div key={p.name} className="mb-2 py-2 border-b border-gray-900">
              <div className="flex items-center gap-1">
                <span className="text-gray-500 text-xs w-4">{i + 1}.</span>
                <span className="text-white text-sm font-bold truncate flex-1">{p.name}</span>
              </div>
              <div className="text-right font-black" style={{ color: '#680001' }}>{p.score} pts</div>
            </div>
          ))}
          {sortedScores.length === 0 && <div className="text-gray-700 text-xs">No scores yet</div>}
        </div>
      )}
      {(location.state as any)?.settings?.noJoin && <ManualScorePanel pin={(location.state as any)?.pin} />}
    </div>
  );
}
