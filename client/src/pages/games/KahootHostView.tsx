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
  options: string[];
  correctIndex: number;
  timeLimit?: number;
}

interface AnswerCounts {
  [key: number]: number;
}

type Phase = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'gameover';

const OPTION_COLORS = [
  { bg: 'bg-red-600', border: 'border-red-400', label: 'A' },
  { bg: 'bg-blue-600', border: 'border-blue-400', label: 'B' },
  { bg: 'bg-yellow-500', border: 'border-yellow-400', label: 'C' },
  { bg: 'bg-green-600', border: 'border-green-400', label: 'D' },
];

export default function KahootHostView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pin, bankId, settings } = (location.state as { pin: string; bankId: string; settings: Record<string, unknown> }) || {};

  const [players, setPlayers] = useState<Player[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [timeLeft, setTimeLeft] = useState(20);
  const [answerCounts, setAnswerCounts] = useState<AnswerCounts>({});
  const [scores, setScores] = useState<Player[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('host_game', { pin, gameType: 'kahoot', bankId, settings });

    socket.on('player_joined', (data: { players: Player[] }) => {
      setPlayers(data.players);
    });

    socket.on('question_reveal', (data: { question: Question; index: number; total: number; timeLeft: number }) => {
      setCurrentQuestion(data.question);
      setQuestionIndex(data.index);
      setTotalQuestions(data.total);
      setTimeLeft(data.timeLeft || 20);
      setAnswerCounts({});
      setPhase('question');
    });

    socket.on('kahoot:answers_updated', (data: { counts: AnswerCounts }) => {
      setAnswerCounts(data.counts);
    });

    socket.on('kahoot:time_up', () => {
      setPhase('reveal');
    });

    socket.on('leaderboard_update', (data: { scores: Player[] }) => {
      setScores(data.scores);
      setPhase('leaderboard');
    });

    socket.on('game_over', (data: { scores: Player[] }) => {
      setScores(data.scores);
      setPhase('gameover');
    });

    socket.on('timer_tick', (data: { timeLeft: number }) => {
      setTimeLeft(data.timeLeft);
    });

    return () => {
      socket.off('player_joined');
      socket.off('question_reveal');
      socket.off('kahoot:answers_updated');
      socket.off('kahoot:time_up');
      socket.off('leaderboard_update');
      socket.off('game_over');
      socket.off('timer_tick');
    };
  }, []);

  const socket = getSocket();

  const handleStart = () => socket.emit('kahoot:start', { pin });
  const handleNext = () => socket.emit('kahoot:next', { pin });
  const handleEnd = () => {
    socket.emit('kahoot:end', { pin });
    navigate('/dashboard');
  };

  const totalAnswers = Object.values(answerCounts).reduce((a, b) => a + b, 0);
  const maxCount = Math.max(...Object.values(answerCounts), 1);

  const timerPercent = currentQuestion ? (timeLeft / (currentQuestion.timeLimit || 20)) * 100 : 100;
  const timerColor = timeLeft > 10 ? '#22c55e' : timeLeft > 5 ? '#eab308' : '#ef4444';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-black border-b border-gray-800">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black" style={{ color: '#680001' }}>UNOH</span>
          <span className="text-gray-400 text-lg">Kahoot! Review</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-gray-400 uppercase tracking-widest">Game PIN</div>
            <div className="text-2xl font-black tracking-widest text-white">{pin}</div>
          </div>
          {phase !== 'lobby' && (
            <div className="text-gray-400 text-sm">
              Q {questionIndex + 1} / {totalQuestions}
            </div>
          )}
          <button
            onClick={handleEnd}
            className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
          >
            End Game
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {/* LOBBY */}
        <AnimatePresence mode="wait">
          {phase === 'lobby' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-8 p-8"
            >
              <div className="text-center">
                <div className="text-6xl font-black mb-2" style={{ color: '#680001' }}>JOIN NOW</div>
                <div className="text-gray-400 text-xl">Go to unoh.review and enter:</div>
                <div className="text-8xl font-black tracking-widest text-white mt-2">{pin}</div>
              </div>

              {/* QR Code Placeholder */}
              <div className="border-4 border-white rounded-2xl p-4 bg-white">
                <div className="w-40 h-40 bg-gray-200 flex items-center justify-center rounded-lg">
                  <div className="text-gray-600 text-xs text-center font-mono">
                    QR CODE<br />unoh.review<br />#{pin}
                  </div>
                </div>
              </div>

              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-1">{players.length} player{players.length !== 1 ? 's' : ''} joined</div>
                <div className="flex flex-wrap gap-2 justify-center max-w-2xl mt-3">
                  {players.slice(0, 30).map((p) => (
                    <motion.span
                      key={p.name}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm font-medium"
                    >
                      {p.name}
                    </motion.span>
                  ))}
                  {players.length > 30 && (
                    <span className="bg-gray-700 text-gray-300 px-3 py-1 rounded-full text-sm">
                      +{players.length - 30} more
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={handleStart}
                disabled={players.length === 0 && !settings?.noJoin}
                className="px-12 py-5 text-2xl font-black rounded-2xl text-white transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#680001' }}
              >
                START GAME →
              </button>
            </motion.div>
          )}

          {/* QUESTION PHASE */}
          {phase === 'question' && currentQuestion && (
            <motion.div
              key="question"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              {/* Timer + Question */}
              <div className="flex items-center gap-6 px-8 py-6 bg-gray-900">
                {/* Circular Timer */}
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="#374151" strokeWidth="8" />
                    <circle
                      cx="40" cy="40" r="34" fill="none"
                      stroke={timerColor}
                      strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 34}`}
                      strokeDashoffset={`${2 * Math.PI * 34 * (1 - timerPercent / 100)}`}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-black" style={{ color: timerColor }}>{timeLeft}</span>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="text-4xl font-bold text-white leading-tight">{currentQuestion.text}</div>
                </div>

                <div className="text-right">
                  <div className="text-gray-400 text-sm">Answered</div>
                  <div className="text-3xl font-black text-white">{totalAnswers}</div>
                  <div className="text-gray-400 text-sm">/ {players.length}</div>
                </div>
              </div>

              {/* Answer Options Grid */}
              <div className="flex-1 grid grid-cols-2 gap-4 p-6">
                {currentQuestion.options.map((option, i) => {
                  const count = answerCounts[i] || 0;
                  const pct = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
                  const color = OPTION_COLORS[i];
                  return (
                    <div key={i} className={`${color.bg} border-2 ${color.border} rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden`}>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl font-black text-white opacity-70 flex-shrink-0">{color.label}</span>
                        <span className="text-2xl font-bold text-white leading-tight">{option}</span>
                      </div>
                      {/* Live answer bar */}
                      <div className="mt-4">
                        <div className="bg-black bg-opacity-30 rounded-full h-3 overflow-hidden">
                          <motion.div
                            className="h-full bg-white bg-opacity-80 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${totalAnswers > 0 ? (count / maxCount) * 100 : 0}%` }}
                            transition={{ duration: 0.4 }}
                          />
                        </div>
                        <div className="text-white text-sm mt-1 font-bold">{count} answered</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* REVEAL PHASE */}
          {phase === 'reveal' && currentQuestion && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              <div className="bg-gray-900 px-8 py-5">
                <div className="text-3xl font-bold text-white">{currentQuestion.text}</div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-4 p-6">
                {currentQuestion.options.map((option, i) => {
                  const isCorrect = i === currentQuestion.correctIndex;
                  const count = answerCounts[i] || 0;
                  const pct = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
                  const color = OPTION_COLORS[i];
                  return (
                    <motion.div
                      key={i}
                      initial={{ scale: 1 }}
                      animate={{ scale: isCorrect ? 1.03 : 0.97, opacity: isCorrect ? 1 : 0.5 }}
                      transition={{ delay: 0.2 * i }}
                      className={`${color.bg} border-4 ${isCorrect ? 'border-white' : 'border-transparent'} rounded-2xl p-5 relative overflow-hidden`}
                    >
                      {isCorrect && (
                        <div className="absolute top-3 right-3 text-3xl">✓</div>
                      )}
                      <div className="flex items-start gap-3 mb-4">
                        <span className="text-2xl font-black text-white opacity-70">{color.label}</span>
                        <span className="text-2xl font-bold text-white">{option}</span>
                      </div>
                      <div className="bg-black bg-opacity-30 rounded-full h-5 overflow-hidden">
                        <motion.div
                          className="h-full bg-white bg-opacity-80 rounded-full flex items-center justify-end pr-2"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, delay: 0.3 }}
                        />
                      </div>
                      <div className="flex justify-between text-white mt-1 text-sm font-bold">
                        <span>{count} players</span>
                        <span>{pct}%</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <div className="flex justify-center pb-6">
                <button
                  onClick={handleNext}
                  className="px-10 py-4 text-xl font-black rounded-xl text-white transition-all transform hover:scale-105"
                  style={{ backgroundColor: '#680001' }}
                >
                  Next Question →
                </button>
              </div>
            </motion.div>
          )}

          {/* LEADERBOARD PHASE */}
          {(phase === 'leaderboard' || phase === 'gameover') && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-8"
            >
              <div className="text-4xl font-black text-white mb-2">
                {phase === 'gameover' ? '🏆 FINAL SCORES' : 'LEADERBOARD'}
              </div>
              <div className="w-full max-w-2xl mt-4 space-y-3">
                {scores.slice(0, 5).map((player, i) => {
                  const maxScore = scores[0]?.score || 1;
                  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                  return (
                    <motion.div
                      key={player.name}
                      initial={{ x: -50, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-4 bg-gray-900 rounded-xl p-4"
                    >
                      <span className="text-3xl">{medals[i]}</span>
                      <div className="flex-1">
                        <div className="text-white font-bold text-lg">{player.name}</div>
                        <div className="bg-gray-700 rounded-full h-3 mt-1 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: '#680001' }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(player.score / maxScore) * 100}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1 + 0.3 }}
                          />
                        </div>
                      </div>
                      <span className="text-2xl font-black text-white">{player.score.toLocaleString()}</span>
                    </motion.div>
                  );
                })}
              </div>
              {phase === 'leaderboard' ? (
                <button
                  onClick={handleNext}
                  className="mt-8 px-10 py-4 text-xl font-black rounded-xl text-white"
                  style={{ backgroundColor: '#680001' }}
                >
                  Next Question →
                </button>
              ) : (
                <button
                  onClick={() => navigate('/dashboard')}
                  className="mt-8 px-10 py-4 text-xl font-black rounded-xl text-white bg-gray-700 hover:bg-gray-600"
                >
                  Back to Dashboard
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {(location.state as any)?.settings?.noJoin && <ManualScorePanel pin={(location.state as any)?.pin} />}
    </div>
  );
}
