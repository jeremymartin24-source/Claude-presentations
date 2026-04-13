import ManualScorePanel from '../../components/games/ManualScorePanel';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface Player {
  name: string;
  score: number;
  wager?: number;
  correct?: boolean;
}

interface Question {
  text: string;
  options: string[];
  correctIndex: number;
  timeLimit?: number;
  index: number;
  total: number;
}

interface AnswerCounts {
  [key: number]: number;
}

type Phase = 'lobby' | 'wager' | 'question' | 'reveal' | 'leaderboard' | 'gameover';

const OPTION_COLORS = [
  { bg: 'bg-red-600', hover: 'hover:bg-red-500', label: 'A' },
  { bg: 'bg-blue-600', hover: 'hover:bg-blue-500', label: 'B' },
  { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-400', label: 'C' },
  { bg: 'bg-green-600', hover: 'hover:bg-green-500', label: 'D' },
];

export default function WagerHostView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pin, bankId, settings } = (location.state as { pin: string; bankId: string; settings: Record<string, unknown> }) || {};

  const [players, setPlayers] = useState<Player[]>([]);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [wagerCount, setWagerCount] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [answerCounts, setAnswerCounts] = useState<AnswerCounts>({});
  const [scores, setScores] = useState<Player[]>([]);
  const [wagerTimeout, setWagerTimeout] = useState(30);
  const [revealResults, setRevealResults] = useState<{ name: string; wager: number; correct: boolean; delta: number }[]>([]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('host_game', { pin, gameType: 'wager', bankId, settings });

    socket.on('player_joined', (data: { players: Player[] }) => {
      setPlayers(data.players);
    });

    socket.on('wager:wager_count', (data: { count: number }) => {
      setWagerCount(data.count);
    });

    socket.on('question_reveal', (data: { question: Question; timeLeft: number }) => {
      setCurrentQuestion(data.question);
      setTimeLeft(data.timeLeft || 20);
      setAnswerCounts({});
      setPhase('question');
    });

    socket.on('kahoot:answers_updated', (data: { counts: AnswerCounts }) => {
      setAnswerCounts(data.counts);
    });

    socket.on('timer_tick', (data: { timeLeft: number }) => setTimeLeft(data.timeLeft));

    socket.on('wager:wager_timer', (data: { timeLeft: number }) => setWagerTimeout(data.timeLeft));

    socket.on('leaderboard_update', (data: { scores: Player[]; results?: typeof revealResults }) => {
      setScores(data.scores);
      if (data.results) setRevealResults(data.results);
      setPhase('leaderboard');
    });

    socket.on('wager:reveal', (data: { results: typeof revealResults }) => {
      setRevealResults(data.results);
      setPhase('reveal');
    });

    socket.on('game_over', (data: { scores: Player[] }) => {
      setScores(data.scores);
      setPhase('gameover');
    });

    return () => {
      socket.off('player_joined');
      socket.off('wager:wager_count');
      socket.off('question_reveal');
      socket.off('kahoot:answers_updated');
      socket.off('timer_tick');
      socket.off('wager:wager_timer');
      socket.off('leaderboard_update');
      socket.off('wager:reveal');
      socket.off('game_over');
    };
  }, []);

  const socket = getSocket();

  const handleStart = () => {
    socket.emit('wager:start', { pin });
    setWagerCount(0);
    setPhase('wager');
  };

  const handleShowQuestion = () => {
    socket.emit('wager:show_question', { pin });
  };

  const handleNext = () => {
    socket.emit('wager:next', { pin });
    setWagerCount(0);
    setPhase('wager');
  };

  const handleEnd = () => {
    socket.emit('wager:end', { pin });
    navigate('/dashboard');
  };

  const totalAnswers = Object.values(answerCounts).reduce((a, b) => a + b, 0);
  const maxCount = Math.max(...Object.values(answerCounts), 1);
  const timerPct = currentQuestion ? (timeLeft / (currentQuestion.timeLimit || 20)) * 100 : 100;
  const timerColor = timeLeft > 10 ? '#22c55e' : timeLeft > 5 ? '#eab308' : '#ef4444';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-black border-b border-gray-800">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black" style={{ color: '#680001' }}>UNOH</span>
          <span className="text-purple-400 font-black text-lg">💰 CONFIDENCE WAGER</span>
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
            <div className="text-6xl font-black text-purple-400">💰 CONFIDENCE WAGER</div>
            <div className="text-gray-300 text-lg text-center max-w-lg">
              Students bet their points before seeing the question!<br />
              High confidence = high risk, high reward.
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

        {/* WAGER PHASE */}
        {phase === 'wager' && (
          <motion.div key="wager" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
            <div className="text-5xl font-black text-purple-400">💰 PLACE YOUR WAGER</div>
            <div className="text-gray-300 text-xl text-center">Students are betting their points...</div>

            {/* Wager count */}
            <div className="bg-gray-900 border border-purple-500 rounded-2xl p-10 text-center">
              <div className="text-8xl font-black text-white">{wagerCount}</div>
              <div className="text-gray-400 text-xl mt-2">of {players.length} wagered</div>
              <div className="bg-gray-700 rounded-full h-3 mt-4 overflow-hidden">
                <motion.div className="h-full bg-purple-500 rounded-full"
                  animate={{ width: players.length > 0 ? `${(wagerCount / players.length) * 100}%` : '0%' }}
                  transition={{ duration: 0.4 }} />
              </div>
            </div>

            {/* Countdown */}
            <div className="text-center">
              <div className="text-gray-400 text-sm uppercase tracking-widest mb-1">Time remaining</div>
              <div className="text-6xl font-black" style={{ color: wagerTimeout <= 10 ? '#ef4444' : '#a855f7' }}>
                {wagerTimeout}s
              </div>
            </div>

            <button onClick={handleShowQuestion}
              className="px-10 py-4 text-xl font-black rounded-xl text-white bg-purple-700 hover:bg-purple-600 transition-all">
              Show Question →
            </button>
          </motion.div>
        )}

        {/* QUESTION PHASE */}
        {phase === 'question' && currentQuestion && (
          <motion.div key="question" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col">
            {/* Question + timer */}
            <div className="flex items-center gap-6 px-8 py-5 bg-gray-900">
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#374151" strokeWidth="8" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke={timerColor} strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - timerPct / 100)}`}
                    strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-black" style={{ color: timerColor }}>{timeLeft}</span>
                </div>
              </div>
              <div className="flex-1 text-4xl font-bold text-white">{currentQuestion.text}</div>
              <div className="text-right">
                <div className="text-gray-400 text-sm">Answered</div>
                <div className="text-3xl font-black text-white">{totalAnswers}/{players.length}</div>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-2 gap-4 p-6">
              {currentQuestion.options.map((opt, i) => {
                const count = answerCounts[i] || 0;
                const pct = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
                const color = OPTION_COLORS[i];
                return (
                  <div key={i} className={`${color.bg} rounded-2xl p-5 flex flex-col justify-between`}>
                    <div className="flex items-start gap-3">
                      <span className="text-2xl font-black text-white opacity-70">{color.label}</span>
                      <span className="text-2xl font-bold text-white">{opt}</span>
                    </div>
                    <div className="mt-4">
                      <div className="bg-black bg-opacity-30 rounded-full h-3">
                        <motion.div className="h-full bg-white bg-opacity-80 rounded-full"
                          animate={{ width: `${totalAnswers > 0 ? (count / maxCount) * 100 : 0}%` }}
                          transition={{ duration: 0.4 }} />
                      </div>
                      <div className="text-white text-sm mt-1 font-bold">{count} answered ({pct}%)</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* REVEAL PHASE */}
        {phase === 'reveal' && currentQuestion && (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col p-6 gap-4">
            <div className="text-2xl font-bold text-white bg-gray-900 rounded-xl p-5">{currentQuestion.text}</div>

            {/* Correct answer */}
            <div className="bg-green-900 border-2 border-green-400 rounded-xl p-4">
              <div className="text-green-300 text-sm uppercase tracking-widest mb-1">Correct Answer</div>
              <div className="text-2xl font-black text-white">{currentQuestion.options[currentQuestion.correctIndex]}</div>
            </div>

            {/* Wager results */}
            <div className="flex-1 overflow-y-auto">
              <div className="text-gray-400 text-sm uppercase tracking-widest mb-3">Wager Results</div>
              <div className="grid grid-cols-2 gap-2">
                {revealResults.map((r) => (
                  <motion.div key={r.name} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className={`rounded-xl p-3 flex items-center justify-between border
                      ${r.correct ? 'bg-green-950 border-green-700' : 'bg-red-950 border-red-800'}`}>
                    <div>
                      <div className="text-white font-bold">{r.name}</div>
                      <div className="text-gray-400 text-sm">Wagered: {r.wager} pts</div>
                    </div>
                    <div className={`text-xl font-black ${r.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {r.delta >= 0 ? '+' : ''}{r.delta}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="flex justify-center">
              <button onClick={handleNext}
                className="px-10 py-4 text-xl font-black rounded-xl text-white"
                style={{ backgroundColor: '#680001' }}>
                Next Question →
              </button>
            </div>
          </motion.div>
        )}

        {/* LEADERBOARD */}
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
                      <div className="font-bold text-white text-lg">{p.name}</div>
                      <div className="bg-gray-700 rounded-full h-3 mt-1 overflow-hidden">
                        <motion.div className="h-full rounded-full bg-purple-500"
                          initial={{ width: 0 }} animate={{ width: `${(p.score / max) * 100}%` }}
                          transition={{ delay: i * 0.1 + 0.3, duration: 0.8 }} />
                      </div>
                    </div>
                    <span className="text-2xl font-black text-white">{p.score.toLocaleString()}</span>
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
