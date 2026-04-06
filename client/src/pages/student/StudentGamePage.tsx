import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

type Phase = 'lobby' | 'playing' | 'question' | 'answer' | 'leaderboard' | 'ended';

const ANSWER_COLORS = [
  'bg-red-700 hover:bg-red-600 border-red-500',
  'bg-blue-700 hover:bg-blue-600 border-blue-500',
  'bg-yellow-600 hover:bg-yellow-500 border-yellow-400',
  'bg-green-700 hover:bg-green-600 border-green-500',
];
const ANSWER_ICONS = ['🔺', '🔷', '⭐', '🟢'];

export default function StudentGamePage() {
  const [phase, setPhase] = useState<Phase>('lobby');
  const [players, setPlayers] = useState<any[]>([]);
  const [question, setQuestion] = useState<any>(null);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [wagering, setWagering] = useState(false);
  const [wager, setWager] = useState(50);

  const playerName = localStorage.getItem('playerName') || 'Player';
  const gamePin = localStorage.getItem('gamePin') || '';
  const gameType = localStorage.getItem('gameType') || '';

  const navigate = useNavigate();

  useEffect(() => {
    const socket = getSocket();

    socket.on('player_joined', ({ players: p }) => { setPlayers(p || []); setPhase('lobby'); });
    socket.on('game_state', ({ phase: ph, scores }) => {
      setPhase(ph as Phase);
      const me = scores?.find((s: any) => s.name === playerName);
      if (me) setScore(me.score);
    });
    socket.on('question_reveal', ({ question: q, timeLimit }) => {
      setQuestion(q);
      setAnswered(false);
      setResult(null);
      setTimeLeft(timeLimit || 30);
      setWagering(gameType === 'wager');
      setPhase('question');
    });
    socket.on('answer_result', ({ correct, pointsEarned, newScore }) => {
      setResult({ correct, pointsEarned });
      if (newScore !== undefined) setScore(newScore);
      setPhase('answer');
    });
    socket.on('leaderboard_update', ({ rankings }) => {
      setLeaderboard(rankings || []);
      setPhase('leaderboard');
    });
    socket.on('game_over', ({ finalScores }) => {
      setLeaderboard(finalScores || []);
      setPhase('ended');
      navigate('/student/leaderboard', { state: { scores: finalScores, playerName } });
    });
    socket.on('eliminated', ({ playerName: p }) => {
      if (p === playerName) setPhase('ended');
    });

    // Timer tick
    const timer = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);

    return () => {
      socket.off('player_joined');
      socket.off('game_state');
      socket.off('question_reveal');
      socket.off('answer_result');
      socket.off('leaderboard_update');
      socket.off('game_over');
      socket.off('eliminated');
      clearInterval(timer);
    };
  }, [playerName, gameType]);

  const submitAnswer = (answer: string) => {
    if (answered) return;
    setAnswered(true);
    const socket = getSocket();
    socket.emit('submit_answer', {
      pin: gamePin, playerName, answer,
      timeRemaining: timeLeft,
      wagered: wagering ? wager : undefined,
    });
  };

  // Lobby phase
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-2xl font-bold text-white">You're in!</h1>
          <p className="text-gray-400 mt-2">Waiting for Professor Martin to start...</p>
          <div className="mt-6 bg-gray-900 rounded-2xl px-8 py-4">
            <p className="text-unoh-red font-bold text-xl">{playerName}</p>
            <p className="text-gray-500 text-sm mt-1">PIN: {gamePin}</p>
          </div>
          <div className="mt-6 space-y-2">
            {players.slice(-5).map((p: any, i) => (
              <p key={i} className="text-gray-500 text-sm">
                {p.name === playerName ? <span className="text-white font-bold">→ {p.name} (you)</span> : p.name}
              </p>
            ))}
            {players.length > 0 && <p className="text-gray-600 text-xs">{players.length} player{players.length !== 1 ? 's' : ''} joined</p>}
          </div>
        </motion.div>
      </div>
    );
  }

  // Wager phase
  if (wagering && phase === 'question' && !answered) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Place Your Wager</h2>
        <p className="text-gray-400 mb-6">How confident are you? Bet {wager}% of your points</p>
        <div className="w-full max-w-sm">
          <input type="range" min={10} max={100} step={10} value={wager}
            onChange={e => setWager(Number(e.target.value))}
            className="w-full accent-unoh-red" />
          <div className="flex justify-between text-gray-600 text-sm mt-1">
            <span>10%</span><span className="text-unoh-red font-bold text-xl">{wager}%</span><span>100%</span>
          </div>
          <button onClick={() => setWagering(false)} className="w-full btn-primary mt-8 text-xl py-5">
            Lock In Wager 🎲
          </button>
        </div>
      </div>
    );
  }

  // Question phase
  if (phase === 'question' && question) {
    return (
      <div className="min-h-screen bg-black flex flex-col px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-500 text-sm">{playerName}</span>
          <span className={`font-mono text-xl font-bold ${timeLeft <= 5 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
            {timeLeft}s
          </span>
          <span className="text-unoh-red font-bold">{score.toLocaleString()}</span>
        </div>

        <div className="flex-1 flex flex-col">
          {!answered && question.options ? (
            <div className="grid grid-cols-1 gap-3 mt-4">
              {question.options.map((opt: string, i: number) => (
                <motion.button key={i} whileTap={{ scale: 0.96 }}
                  onClick={() => submitAnswer(opt)}
                  className={`${ANSWER_COLORS[i % 4]} border-2 rounded-2xl p-5 text-white font-bold text-lg text-left transition-all`}>
                  <span className="mr-3">{ANSWER_ICONS[i % 4]}</span> {opt}
                </motion.button>
              ))}
            </div>
          ) : answered ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl mb-4">⏳</div>
                <p className="text-gray-400">Answer submitted! Waiting...</p>
              </div>
            </div>
          ) : (
            // Short answer
            <div className="flex flex-col gap-4 mt-4">
              <input
                className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-5 py-4 text-white text-xl outline-none focus:border-unoh-red"
                placeholder="Type your answer..."
                onKeyDown={e => e.key === 'Enter' && submitAnswer((e.target as HTMLInputElement).value)}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Answer reveal
  if (phase === 'answer' && result) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className={`text-8xl mb-6`}>
          {result.correct ? '✅' : '❌'}
        </motion.div>
        <h2 className={`text-3xl font-bold ${result.correct ? 'text-green-400' : 'text-red-400'}`}>
          {result.correct ? 'Correct!' : 'Wrong'}
        </h2>
        {result.correct && result.pointsEarned > 0 && (
          <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-yellow-400 text-2xl font-bold mt-2">
            +{result.pointsEarned.toLocaleString()} points
          </motion.p>
        )}
        <p className="text-gray-400 mt-4">Total: {score.toLocaleString()}</p>
      </div>
    );
  }

  // Leaderboard phase
  if (phase === 'leaderboard') {
    const myRank = leaderboard.findIndex(e => e.name === playerName) + 1;
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-bold text-white mb-6">Leaderboard</h2>
        {myRank > 0 && <p className="text-unoh-red text-xl font-bold mb-4">You're #{myRank}</p>}
        <div className="space-y-2 w-full max-w-sm">
          {leaderboard.slice(0, 5).map((e: any) => (
            <div key={e.name} className={`flex justify-between px-4 py-3 rounded-xl ${e.name === playerName ? 'bg-unoh-red/20 border border-unoh-red' : 'bg-gray-900'}`}>
              <span className="text-gray-400">#{e.rank}</span>
              <span className="text-white font-medium">{e.name}</span>
              <span className="text-unoh-red font-bold">{e.score?.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <p className="text-gray-500 mt-6 text-sm">Next question coming up...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center text-gray-500">
        <div className="text-4xl mb-3">🎮</div>
        <p>Waiting for game to start...</p>
      </div>
    </div>
  );
}
