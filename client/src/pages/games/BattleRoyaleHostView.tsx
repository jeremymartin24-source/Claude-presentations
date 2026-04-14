import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface PlayerCard {
  name: string;
  alive: boolean;
  justEliminated?: boolean;
}

interface Question {
  index:        number;
  total:        number;
  question:     string;
  options:      string[];
  timeLimit:    number;
  points:       number;
  survivors:    number;
  answeredCount: number;
}

interface EliminationResult {
  eliminated:    string[];
  correctAnswer: string;
  survivors:     number;
  leaderboard:   { name: string; score: number; alive: boolean }[];
  dramatic:      boolean;
  isLastQuestion: boolean;
}

type Phase = 'lobby' | 'starting' | 'question' | 'reveal' | 'gameover';

const OPTION_COLORS = ['bg-red-600', 'bg-blue-600', 'bg-yellow-500', 'bg-green-600'];
const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const MEDALS = ['🥇', '🥈', '🥉'];

export default function BattleRoyaleHostView() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { pin, bankId, settings } = (location.state as {
    pin: string; bankId: string; settings: Record<string, unknown>;
  }) || {};
  const noJoin = !!(settings as any)?.noJoin;

  const [players,       setPlayers]       = useState<PlayerCard[]>([]);
  const [phase,         setPhase]         = useState<Phase>('lobby');
  const [currentQ,      setCurrentQ]      = useState<Question | null>(null);
  const [elimination,   setElimination]   = useState<EliminationResult | null>(null);
  const [timeLeft,      setTimeLeft]      = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [aliveTotal,    setAliveTotal]    = useState(0);
  const [finalLB,       setFinalLB]       = useState<{ name: string; score: number; alive: boolean }[]>([]);
  const [winner,        setWinner]        = useState<string | null>(null);
  const [startCount,    setStartCount]    = useState(3);

  const startRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socket   = getSocket();

  // ── Socket listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    socket.emit('host_game', { pin, gameType: 'battleroyale', bankId, settings });

    socket.on('player_joined', (data: { players: { name: string }[] }) => {
      setPlayers(data.players.map(p => ({ name: p.name, alive: true })));
      setAliveTotal(data.players.length);
    });

    socket.on('battleroyale:starting', (data: { players: string[] }) => {
      setPlayers(data.players.map(name => ({ name, alive: true })));
      setAliveTotal(data.players.length);
      setPhase('starting');
      let c = 3;
      setStartCount(c);
      startRef.current = setInterval(() => {
        c--;
        setStartCount(c);
        if (c <= 0) { clearInterval(startRef.current!); }
      }, 1000);
    });

    socket.on('battleroyale:question', (data: Question) => {
      setCurrentQ(data);
      setAnsweredCount(0);
      setAliveTotal(data.survivors);
      setTimeLeft(data.timeLimit);
      setElimination(null);
      setPhase('question');
      setPlayers(prev => prev.map(p => ({ ...p, justEliminated: false })));
    });

    socket.on('timer_tick', (data: { timeLeft: number }) => setTimeLeft(data.timeLeft));

    socket.on('battleroyale:answer_count', (data: { answered: number; alive: number }) => {
      setAnsweredCount(data.answered);
      setAliveTotal(data.alive);
    });

    socket.on('battleroyale:elimination', (data: EliminationResult) => {
      setElimination(data);
      setAliveTotal(data.survivors);
      setPlayers(prev => prev.map(p => ({
        ...p,
        alive:         !data.eliminated.includes(p.name),
        justEliminated: data.eliminated.includes(p.name),
      })));
      setPhase('reveal');
    });

    socket.on('game_over', (data: {
      survivors: string[]; winner: string | null;
      leaderboard: { name: string; score: number; alive: boolean }[];
    }) => {
      setFinalLB(data.leaderboard ?? []);
      setWinner(data.winner ?? null);
      setPhase('gameover');
    });

    return () => {
      socket.off('player_joined');
      socket.off('battleroyale:starting');
      socket.off('battleroyale:question');
      socket.off('timer_tick');
      socket.off('battleroyale:answer_count');
      socket.off('battleroyale:elimination');
      socket.off('game_over');
      if (startRef.current) clearInterval(startRef.current);
    };
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleStart     = () => socket.emit('battleroyale:start',  { pin });
  const handleRevealNow = () => socket.emit('battleroyale:reveal', { pin });
  const handleNext      = () => socket.emit('battleroyale:next',   { pin });
  const handleEnd       = () => {
    socket.emit('battleroyale:end', { pin });
    navigate('/admin');
  };

  const timerPct   = currentQ ? (timeLeft / currentQ.timeLimit) * 100 : 100;
  const timerColor = timeLeft > 10 ? '#22c55e' : timeLeft > 5 ? '#eab308' : '#ef4444';
  const answerPct  = aliveTotal > 0 ? (answeredCount / aliveTotal) * 100 : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-black border-b border-gray-800">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black" style={{ color: '#680001' }}>UNOH</span>
          <span className="text-orange-400 font-black text-lg">💀 BATTLE ROYALE</span>
        </div>
        <div className="flex items-center gap-4">
          {phase !== 'lobby' && phase !== 'starting' && (
            <div className="text-center bg-gray-900 border border-gray-700 rounded-lg px-4 py-2">
              <div className="text-xs text-gray-400 uppercase tracking-widest">Survivors</div>
              <div className="text-2xl font-black text-green-400">{aliveTotal}</div>
            </div>
          )}
          {currentQ && phase === 'question' && (
            <div className="text-gray-400 text-sm">
              Q {currentQ.index + 1} / {currentQ.total}
            </div>
          )}
          <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-gray-400 uppercase tracking-widest">PIN</div>
            <div className="text-2xl font-black tracking-widest">{pin}</div>
          </div>
          <button onClick={handleEnd}
            className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold">
            End Game
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ── LOBBY ─────────────────────────────────────────────────────── */}
        {phase === 'lobby' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
            <div className="text-7xl font-black text-orange-400">💀 BATTLE ROYALE</div>
            {!noJoin && (
              <div className="text-center">
                <div className="text-gray-400 text-xl">Join at unoh.review — PIN:</div>
                <div className="text-8xl font-black text-white tracking-widest">{pin}</div>
              </div>
            )}
            <div className="text-2xl text-white">
              {players.length} player{players.length !== 1 ? 's' : ''} ready for battle
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-3xl">
              {players.map(p => (
                <motion.span key={p.name} initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="bg-green-900 border border-green-500 text-green-300 px-3 py-1 rounded-full text-sm font-bold">
                  ❤️ {p.name}
                </motion.span>
              ))}
            </div>
            <button onClick={handleStart} disabled={!noJoin && players.length === 0}
              className="px-12 py-5 text-2xl font-black rounded-2xl text-white disabled:opacity-50 bg-orange-600 hover:bg-orange-500 transition-all hover:scale-105">
              BEGIN THE BATTLE 💀
            </button>
          </motion.div>
        )}

        {/* ── STARTING COUNTDOWN ─────────────────────────────────────────── */}
        {phase === 'starting' && (
          <motion.div key="starting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="text-2xl text-gray-400 uppercase tracking-widest font-bold">Get Ready</div>
            <AnimatePresence mode="wait">
              <motion.div key={startCount}
                initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.4 }}
                className="text-9xl font-black text-orange-400">
                {startCount > 0 ? startCount : '💀'}
              </motion.div>
            </AnimatePresence>
            <div className="flex flex-wrap gap-2 justify-center max-w-2xl mt-4">
              {players.map(p => (
                <span key={p.name}
                  className="bg-green-900 border border-green-500 text-green-300 px-3 py-1 rounded-full text-sm font-bold">
                  ❤️ {p.name}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── QUESTION ───────────────────────────────────────────────────── */}
        {phase === 'question' && currentQ && (
          <motion.div key="question" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col">

            {/* Question + timer */}
            <div className="bg-gray-900 px-8 py-5 flex items-start gap-6">
              <div className="flex-1">
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">
                  Question {currentQ.index + 1} of {currentQ.total} · {currentQ.points} pts
                </div>
                <div className="text-3xl font-bold text-white leading-snug">{currentQ.question}</div>
              </div>
              {/* Circular timer */}
              <div className="relative w-20 h-20 shrink-0">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#374151" strokeWidth="8" />
                  <circle cx="40" cy="40" r="34" fill="none"
                    stroke={timerColor} strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - timerPct / 100)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-black" style={{ color: timerColor }}>{timeLeft}</span>
                </div>
              </div>
            </div>

            {/* Answer progress + reveal-now */}
            <div className="px-8 py-3 bg-gray-900 border-t border-gray-800 flex items-center gap-4">
              <span className="text-gray-400 text-sm shrink-0">
                {answeredCount} / {aliveTotal} answered
              </span>
              <div className="flex-1 bg-gray-800 rounded-full h-2.5 overflow-hidden">
                <motion.div className="h-full bg-orange-500 rounded-full"
                  animate={{ width: `${answerPct}%` }} transition={{ duration: 0.3 }} />
              </div>
              <button onClick={handleRevealNow}
                className="shrink-0 px-4 py-1.5 bg-orange-700 hover:bg-orange-600 text-white text-sm font-bold rounded-lg transition-colors">
                Reveal Now
              </button>
            </div>

            {/* Answer options */}
            <div className="grid grid-cols-2 gap-3 p-5">
              {currentQ.options.map((opt, i) => (
                <div key={i}
                  className={`${OPTION_COLORS[i] ?? 'bg-gray-700'} rounded-xl p-5 flex items-center gap-3`}>
                  <span className="text-white font-black text-xl opacity-70">{OPTION_LABELS[i]}</span>
                  <span className="text-white text-xl font-bold">{opt}</span>
                </div>
              ))}
            </div>

            {/* Live player grid */}
            <div className="flex-1 px-5 pb-5 overflow-y-auto">
              <div className="text-xs text-gray-600 uppercase tracking-widest mb-2">
                {aliveTotal} alive
              </div>
              <div className="flex flex-wrap gap-2">
                {players.map(p => (
                  <div key={p.name}
                    className={`px-3 py-2 rounded-lg font-bold text-sm border-2 flex items-center gap-1.5 transition-all
                      ${p.alive
                        ? 'bg-green-900 border-green-600 text-green-200'
                        : 'bg-gray-900 border-gray-800 text-gray-600'
                      }`}>
                    {p.alive
                      ? <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                          className="w-2 h-2 rounded-full bg-green-400 inline-block shrink-0" />
                      : <span className="text-xs">💀</span>
                    }
                    {p.name}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── REVEAL / ELIMINATION ────────────────────────────────────────── */}
        {phase === 'reveal' && elimination && currentQ && (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex gap-4 p-5 overflow-hidden">

            {/* Left: results */}
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
              {/* Correct answer */}
              <div className="bg-green-900 border-4 border-green-400 rounded-2xl px-6 py-4">
                <div className="text-green-300 text-xs uppercase tracking-widest mb-1">Correct Answer</div>
                <div className="text-3xl font-black text-white">{elimination.correctAnswer}</div>
              </div>

              {/* Elimination / survival banner */}
              {elimination.eliminated.length > 0 ? (
                <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="bg-red-950 border-4 border-red-500 rounded-2xl p-5 text-center">
                  <div className="text-4xl font-black text-red-300 mb-3">ELIMINATED 💀</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {elimination.eliminated.map(name => (
                      <span key={name}
                        className="bg-red-800 border border-red-400 text-white px-3 py-1 rounded-full font-bold">
                        {name}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="bg-green-950 border-4 border-green-400 rounded-2xl p-5 text-center">
                  <div className="text-3xl font-black text-green-300">Everyone survived! 🎉</div>
                </motion.div>
              )}

              <div className="text-center">
                <span className="text-2xl font-black text-green-400">
                  {elimination.survivors} survivor{elimination.survivors !== 1 ? 's' : ''} remain
                </span>
              </div>

              {/* Player status grid */}
              <div className="flex flex-wrap gap-2">
                {players.map(p => (
                  <motion.div key={p.name}
                    animate={p.justEliminated ? { scale: [1, 1.15, 0.9, 1], rotate: [0, -3, 3, 0] } : {}}
                    transition={{ duration: 0.5 }}
                    className={`px-3 py-2 rounded-xl font-bold text-sm border-2 flex items-center gap-2 transition-all
                      ${p.alive
                        ? 'bg-green-900 border-green-500 text-green-200'
                        : 'bg-gray-900 border-gray-800 text-gray-600 line-through opacity-40'
                      }`}>
                    {p.justEliminated
                      ? <span>💀</span>
                      : p.alive
                        ? <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                        : <span className="opacity-60 text-xs">💀</span>
                    }
                    {p.name}
                  </motion.div>
                ))}
              </div>

              {/* Next / finish button */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={elimination.isLastQuestion ? handleEnd : handleNext}
                  className="px-10 py-4 text-xl font-black rounded-xl text-white bg-orange-600 hover:bg-orange-500 transition-all hover:scale-105">
                  {elimination.isLastQuestion ? 'See Final Results →' : 'Next Question →'}
                </button>
              </div>
            </div>

            {/* Right: live standings */}
            <div className="w-56 bg-black border border-gray-800 rounded-2xl p-4 shrink-0 flex flex-col overflow-y-auto">
              <div className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Standings</div>
              {elimination.leaderboard.map((p, i) => (
                <div key={p.name}
                  className={`mb-2 pb-2 border-b border-gray-900 ${!p.alive ? 'opacity-40' : ''}`}>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 w-5 shrink-0">{i + 1}.</span>
                    <span className="text-white text-sm font-bold truncate flex-1">{p.name}</span>
                    {!p.alive && <span className="text-xs shrink-0">💀</span>}
                  </div>
                  <div className="text-orange-400 font-black text-sm pl-5">
                    {p.score.toLocaleString()} pts
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── GAME OVER ──────────────────────────────────────────────────── */}
        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center p-8 gap-8 overflow-y-auto">

            {winner ? (
              <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                className="text-center">
                <div className="text-8xl font-black text-yellow-400">👑</div>
                <div className="text-5xl font-black text-white mt-2">{winner}</div>
                <div className="text-orange-400 text-2xl font-bold mt-1">Last Survivor!</div>
              </motion.div>
            ) : (
              <div className="text-5xl font-black text-orange-400">GAME OVER</div>
            )}

            {/* Full standings */}
            <div className="w-full max-w-lg space-y-2">
              {finalLB.slice(0, 10).map((p, i) => (
                <motion.div key={p.name}
                  initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className={`flex items-center justify-between rounded-xl px-5 py-3 border
                    ${p.alive
                      ? 'bg-green-950 border-green-700'
                      : 'bg-gray-900 border-gray-800'
                    }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl w-8 text-center">
                      {i < 3 ? MEDALS[i] : `${i + 1}.`}
                    </span>
                    <span className={`font-black text-lg ${p.alive ? 'text-white' : 'text-gray-500'}`}>
                      {p.name}
                    </span>
                    {!p.alive && (
                      <span className="text-xs text-gray-600">💀 eliminated</span>
                    )}
                  </div>
                  <span className={`font-black text-lg ${p.alive ? 'text-orange-400' : 'text-gray-500'}`}>
                    {p.score.toLocaleString()}
                  </span>
                </motion.div>
              ))}
            </div>

            <button onClick={() => navigate('/admin')}
              className="px-8 py-4 text-xl font-black rounded-xl text-white bg-gray-700 hover:bg-gray-600 transition-colors">
              Back to Dashboard
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
