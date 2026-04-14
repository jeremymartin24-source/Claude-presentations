import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

type Phase = 'lobby' | 'question' | 'buzzed' | 'answering' | 'result' | 'leaderboard' | 'gameover';

interface SpeedQuestion {
  index: number;
  total: number;
  question: string;
  options: string[];
  points: number;
  category?: string;
}

const ANSWER_COLORS = [
  'bg-red-700 hover:bg-red-600 border-red-500',
  'bg-blue-700 hover:bg-blue-600 border-blue-500',
  'bg-yellow-600 hover:bg-yellow-500 border-yellow-400',
  'bg-green-700 hover:bg-green-600 border-green-500',
];
const ANSWER_ICONS = ['🔺', '🔷', '⭐', '🟢'];

export default function SpeedRoundStudentPage() {
  const navigate   = useNavigate();
  const playerName = localStorage.getItem('playerName') || 'Player';
  const gamePin    = localStorage.getItem('gamePin') || '';

  const [phase, setPhase]           = useState<Phase>('lobby');
  const [question, setQuestion]     = useState<SpeedQuestion | null>(null);
  const [buzzed, setBuzzed]         = useState(false);
  const [queuePos, setQueuePos]     = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [result, setResult]         = useState<{ correct: boolean; points?: number; penalty?: number; answer?: string } | null>(null);
  const [score, setScore]           = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [buzzDisabled, setBuzzDisabled] = useState(false);
  const answerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on('game_starting', () => setPhase('question'));

    socket.on('speedround_question', (q: SpeedQuestion) => {
      setQuestion(q);
      setBuzzed(false);
      setBuzzDisabled(false);
      setQueuePos(null);
      setResult(null);
      setTextAnswer('');
      setPhase('question');
    });

    socket.on('buzz_accepted', ({ buzzTime }: any) => {
      setBuzzed(true);
      setQueuePos(null);
      setPhase('answering');
      // Vibrate for haptic feedback
      if (navigator.vibrate) navigator.vibrate(100);
      setTimeout(() => answerRef.current?.focus(), 100);
    });

    socket.on('buzz_queued', ({ position }: any) => {
      setQueuePos(position);
      setBuzzed(true);
      setPhase('buzzed');
    });

    socket.on('buzz_rejected', () => {
      setBuzzDisabled(true);
    });

    socket.on('player_buzzed', ({ playerName: who }: any) => {
      if (who !== playerName) {
        // Someone else buzzed — disable our buzzer
        setBuzzDisabled(true);
      }
    });

    socket.on('speed_result', ({ playerName: who, correct, points, penalty, newScore, correctAnswer }: any) => {
      const isMe = who === playerName;
      if (isMe) {
        setResult({ correct, points, penalty, answer: correctAnswer });
        setScore(newScore ?? score);
        setPhase('result');
      }
    });

    socket.on('answer_timeout', ({ playerName: who }: any) => {
      if (who === playerName) {
        setResult({ correct: false, penalty: 50, answer: undefined });
        setPhase('result');
      }
    });

    socket.on('question_skipped', () => {
      setBuzzDisabled(false);
      setBuzzed(false);
      setQueuePos(null);
    });

    socket.on('buzzer_open', () => {
      setBuzzDisabled(false);
      setBuzzed(false);
      setQueuePos(null);
      setPhase('question');
    });

    socket.on('leaderboard_update', ({ leaderboard: lb }: any) => {
      setLeaderboard(lb || []);
      setPhase('leaderboard');
      setTimeout(() => setPhase('question'), 3000);
    });

    socket.on('game_over', ({ leaderboard: lb }: any) => {
      setLeaderboard(lb || []);
      setPhase('gameover');
      navigate('/student/leaderboard', { state: { scores: lb, playerName } });
    });

    return () => {
      socket.off('game_starting');
      socket.off('speedround_question');
      socket.off('buzz_accepted');
      socket.off('buzz_queued');
      socket.off('buzz_rejected');
      socket.off('player_buzzed');
      socket.off('speed_result');
      socket.off('answer_timeout');
      socket.off('question_skipped');
      socket.off('buzzer_open');
      socket.off('leaderboard_update');
      socket.off('game_over');
    };
  }, [playerName, score]);

  function buzz() {
    if (buzzed || buzzDisabled) return;
    getSocket().emit('speed_buzz', { pin: gamePin });
    setBuzzed(true);
  }

  function submitTextAnswer() {
    if (!textAnswer.trim()) return;
    getSocket().emit('speed_answer', { pin: gamePin, answer: textAnswer.trim() });
    setTextAnswer('');
  }

  function submitOptionAnswer(opt: string) {
    getSocket().emit('speed_answer', { pin: gamePin, answer: opt });
  }

  // Lobby
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-6">
        <div className="text-5xl mb-4">🚀</div>
        <h1 className="text-2xl font-bold text-white">Speed Round</h1>
        <p className="text-gray-400 mt-2">Waiting for Professor Martin to start...</p>
        <div className="mt-4 text-unoh-red font-bold">{playerName}</div>
      </div>
    );
  }

  // Result phase
  if (phase === 'result' && result) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-8xl mb-4">
          {result.correct ? '✅' : '❌'}
        </motion.div>
        <h2 className={`text-3xl font-bold ${result.correct ? 'text-green-400' : 'text-red-400'}`}>
          {result.correct ? 'Correct!' : 'Wrong!'}
        </h2>
        {result.correct && result.points && (
          <motion.p initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="text-yellow-400 text-2xl font-bold mt-2">+{result.points} pts</motion.p>
        )}
        {!result.correct && result.penalty && (
          <p className="text-red-400 mt-2">-{result.penalty} pts</p>
        )}
        {result.answer && (
          <p className="text-gray-400 mt-2 text-sm">Answer: <span className="text-white font-medium">{result.answer}</span></p>
        )}
        <p className="text-gray-500 mt-3">Score: {score.toLocaleString()}</p>
      </div>
    );
  }

  // Answering phase (you buzzed in, now answer)
  if (phase === 'answering' && question) {
    const hasOptions = question.options && question.options.length > 0;
    return (
      <div className="min-h-screen bg-black flex flex-col px-4 py-6">
        <div className="text-center mb-4">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="text-5xl mb-2">🎤</motion.div>
          <p className="text-green-400 font-bold text-lg">YOU BUZZED IN!</p>
          <p className="text-gray-400 text-sm">Answer quickly!</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-2xl px-4 py-4 mb-5 text-center">
          {question.category && <p className="text-unoh-red text-xs uppercase tracking-widest mb-1">{question.category}</p>}
          <p className="text-white font-bold text-lg">{question.question}</p>
        </div>

        {hasOptions ? (
          <div className="grid grid-cols-1 gap-3">
            {question.options.map((opt, i) => (
              <motion.button key={i} whileTap={{ scale: 0.96 }}
                onClick={() => submitOptionAnswer(opt)}
                className={`${ANSWER_COLORS[i % 4]} border-2 rounded-2xl p-4 text-white font-bold text-base text-left`}>
                <span className="mr-2">{ANSWER_ICONS[i % 4]}</span>{opt}
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              ref={answerRef}
              className="flex-1 bg-gray-900 border-2 border-green-600 focus:border-green-400 rounded-xl px-4 py-4 text-white text-lg outline-none"
              placeholder="Type your answer..."
              value={textAnswer}
              onChange={e => setTextAnswer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitTextAnswer()}
              autoFocus
            />
            <button onClick={submitTextAnswer} className="btn-primary px-5 text-xl rounded-xl">→</button>
          </div>
        )}
      </div>
    );
  }

  // Buzzed but in queue
  if (phase === 'buzzed' && queuePos) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-3">⏳</div>
        <h2 className="text-xl font-bold text-white">In Queue</h2>
        <div className="mt-3 bg-gray-900 rounded-2xl px-8 py-4 border border-gray-700">
          <p className="text-gray-400 text-sm">Your position</p>
          <p className="text-unoh-red font-black text-5xl">#{queuePos}</p>
        </div>
        <p className="text-gray-500 text-sm mt-4">Wait for the first player to answer</p>
      </div>
    );
  }

  // Leaderboard flash
  if (phase === 'leaderboard') {
    const myRank = leaderboard.findIndex(e => e.name === playerName) + 1;
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Standings</h2>
        {myRank > 0 && <p className="text-unoh-red font-bold mb-3">You're #{myRank}</p>}
        <div className="space-y-2 w-full max-w-xs">
          {leaderboard.slice(0, 5).map((e: any, i: number) => (
            <div key={e.name} className={`flex justify-between px-4 py-2.5 rounded-xl ${e.name === playerName ? 'bg-unoh-red/20 border border-unoh-red' : 'bg-gray-900'}`}>
              <span className="text-gray-400 text-sm">#{i+1}</span>
              <span className="text-white text-sm">{e.name}</span>
              <span className="text-unoh-red font-bold text-sm">{e.score?.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Question phase — show question + big buzzer
  if (phase === 'question' && question) {
    return (
      <div className="min-h-screen bg-black flex flex-col px-4 py-6">
        {/* Score */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-500 text-sm">{question.index + 1}/{question.total}</span>
          <span className="text-unoh-red font-bold">{score.toLocaleString()}</span>
        </div>

        {/* Question */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl px-4 py-5 mb-6 text-center flex-1 flex flex-col items-center justify-center">
          {question.category && <p className="text-unoh-red text-xs uppercase tracking-widest mb-2">{question.category}</p>}
          <p className="text-white font-bold text-lg leading-snug">{question.question}</p>
          <p className="text-yellow-400 text-sm mt-2 font-medium">{question.points} pts</p>
        </div>

        {/* Buzz button */}
        <div className="flex flex-col items-center">
          <motion.button
            whileTap={!buzzed && !buzzDisabled ? { scale: 0.92 } : {}}
            animate={buzzed ? { scale: 0.95 } : { scale: 1 }}
            onClick={buzz}
            disabled={buzzed || buzzDisabled}
            className={`w-48 h-48 rounded-full border-8 text-5xl font-black transition-all shadow-2xl
              ${buzzed || buzzDisabled
                ? 'border-gray-700 bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'border-unoh-red bg-unoh-red/10 text-white hover:bg-unoh-red/20 active:bg-unoh-red/30 shadow-unoh-red/30'}`}>
            {buzzed ? '⏳' : buzzDisabled ? '🔒' : '🚀'}
          </motion.button>

          <p className="text-gray-500 mt-3 text-sm font-medium">
            {buzzed ? 'Buzzed in!' : buzzDisabled ? 'Someone else buzzed' : 'TAP TO BUZZ IN'}
          </p>
        </div>
      </div>
    );
  }

  // Generic waiting state
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3">🚀</div>
        <p className="text-gray-500">Waiting for game...</p>
      </div>
    </div>
  );
}
