import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface PlayerCard {
  name: string;
  alive: boolean;
  justEliminated?: boolean;
}

interface Question {
  text: string;
  options: string[];
  correctIndex: number;
  index: number;
  total: number;
}

type Phase = 'lobby' | 'question' | 'reveal' | 'gameover';

export default function BattleRoyaleHostView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pin, bankId, settings } = (location.state as { pin: string; bankId: string; settings: Record<string, unknown> }) || {};

  const [players, setPlayers] = useState<PlayerCard[]>([]);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [eliminatedThisRound, setEliminatedThisRound] = useState<string[]>([]);
  const [survivorCount, setSurvivorCount] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [answerCount, setAnswerCount] = useState(0);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('host_game', { pin, gameType: 'battleroyale', bankId, settings });

    socket.on('player_joined', (data: { players: { name: string }[] }) => {
      setPlayers(data.players.map((p) => ({ name: p.name, alive: true })));
      setSurvivorCount(data.players.length);
    });

    socket.on('question_reveal', (data: Question) => {
      setCurrentQuestion(data);
      setEliminatedThisRound([]);
      setAnswerCount(0);
      setTimeLeft(20);
      setPhase('question');
    });

    socket.on('kahoot:answers_updated', (data: { counts: Record<number, number> }) => {
      const total = Object.values(data.counts).reduce((a, b) => a + b, 0);
      setAnswerCount(total);
    });

    socket.on('timer_tick', (data: { timeLeft: number }) => setTimeLeft(data.timeLeft));

    socket.on('battleroyale:question_result', (data: { survivors: string[]; eliminated: string[] }) => {
      setEliminatedThisRound(data.eliminated);
      setSurvivorCount(data.survivors.length);
      setPlayers((prev) =>
        prev.map((p) => ({
          ...p,
          alive: data.survivors.includes(p.name),
          justEliminated: data.eliminated.includes(p.name),
        }))
      );
      setPhase('reveal');
    });

    socket.on('eliminated', (data: { playerName: string }) => {
      setPlayers((prev) =>
        prev.map((p) => p.name === data.playerName ? { ...p, alive: false, justEliminated: true } : p)
      );
    });

    socket.on('game_over', (data: { winner?: string }) => {
      setWinner(data.winner || null);
      setPhase('gameover');
    });

    return () => {
      socket.off('player_joined');
      socket.off('question_reveal');
      socket.off('kahoot:answers_updated');
      socket.off('timer_tick');
      socket.off('battleroyale:question_result');
      socket.off('eliminated');
      socket.off('game_over');
    };
  }, []);

  const socket = getSocket();
  const handleStart = () => socket.emit('battleroyale:start', { pin });
  const handleNext = () => {
    setPlayers((prev) => prev.map((p) => ({ ...p, justEliminated: false })));
    socket.emit('battleroyale:next', { pin });
  };
  const handleEnd = () => { socket.emit('battleroyale:end', { pin }); navigate('/dashboard'); };

  const timerPct = currentQuestion ? (timeLeft / 20) * 100 : 100;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-black border-b border-gray-800">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black" style={{ color: '#680001' }}>UNOH</span>
          <span className="text-orange-400 font-black text-lg">💀 BATTLE ROYALE</span>
        </div>
        <div className="flex items-center gap-4">
          {phase !== 'lobby' && (
            <div className="text-center bg-gray-900 border border-gray-700 rounded-lg px-4 py-2">
              <div className="text-xs text-gray-400 uppercase tracking-widest">Survivors</div>
              <div className="text-2xl font-black text-green-400">{survivorCount}</div>
            </div>
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
            <div className="text-7xl font-black text-orange-400">💀 BATTLE ROYALE</div>
            <div className="text-center">
              <div className="text-gray-400 text-xl">Join at unoh.review — PIN:</div>
              <div className="text-8xl font-black text-white tracking-widest">{pin}</div>
            </div>
            <div className="text-2xl text-white">{players.length} players ready for battle</div>
            <div className="flex flex-wrap gap-2 justify-center max-w-3xl">
              {players.map((p) => (
                <motion.span key={p.name} initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="bg-green-900 border border-green-500 text-green-300 px-3 py-1 rounded-full text-sm font-bold">
                  {p.name}
                </motion.span>
              ))}
            </div>
            <button onClick={handleStart} disabled={players.length === 0}
              className="px-12 py-5 text-2xl font-black rounded-2xl text-white disabled:opacity-50 bg-orange-600 hover:bg-orange-500">
              BEGIN THE BATTLE 💀
            </button>
          </motion.div>
        )}

        {/* QUESTION PHASE */}
        {phase === 'question' && currentQuestion && (
          <motion.div key="question" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col">
            {/* Question + Timer */}
            <div className="bg-gray-900 px-8 py-5 flex items-center gap-6">
              <div className="flex-1">
                <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">
                  Question {currentQuestion.index + 1} of {currentQuestion.total}
                </div>
                <div className="text-3xl font-bold text-white">{currentQuestion.text}</div>
              </div>
              <div className="text-right">
                <div className="text-5xl font-black" style={{ color: timeLeft <= 5 ? '#ef4444' : '#22c55e' }}>{timeLeft}</div>
                <div className="text-gray-400 text-sm">{answerCount} answered</div>
              </div>
            </div>

            {/* Answer options */}
            <div className="grid grid-cols-2 gap-3 p-5">
              {['A', 'B', 'C', 'D'].map((label, i) => (
                <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl p-5">
                  <span className="text-gray-500 font-black mr-3">{label}</span>
                  <span className="text-white text-xl font-bold">{currentQuestion.options[i] || ''}</span>
                </div>
              ))}
            </div>

            {/* Player grid */}
            <div className="flex-1 px-5 pb-5 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {players.map((p) => (
                  <div key={p.name}
                    className={`px-3 py-2 rounded-lg font-bold text-sm border-2 transition-all
                      ${p.alive ? 'bg-green-900 border-green-500 text-green-200' : 'bg-gray-900 border-gray-800 text-gray-600'}`}>
                    {p.alive && (
                      <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                        className="inline-block w-2 h-2 rounded-full bg-green-400 mr-2" />
                    )}
                    {p.name}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* REVEAL PHASE */}
        {phase === 'reveal' && currentQuestion && (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col">
            {/* Correct answer banner */}
            <div className="bg-green-900 border-b-4 border-green-400 px-8 py-4">
              <div className="text-green-300 text-sm uppercase tracking-widest mb-1">Correct Answer</div>
              <div className="text-3xl font-black text-white">
                {currentQuestion.options[currentQuestion.correctIndex]}
              </div>
            </div>

            {/* Elimination announcement */}
            {eliminatedThisRound.length > 0 && (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="mx-8 my-4 bg-red-900 border-4 border-red-500 rounded-2xl p-5 text-center">
                <div className="text-5xl font-black text-red-300 mb-2">ELIMINATED! 💀</div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {eliminatedThisRound.map((name) => (
                    <span key={name} className="bg-red-800 border border-red-400 text-white px-3 py-1 rounded-full font-bold">
                      {name}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            <div className="text-center py-3">
              <span className="text-2xl font-black text-green-400">{survivorCount} survivors remain!</span>
            </div>

            {/* Player grid with eliminations */}
            <div className="flex-1 px-6 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {players.map((p) => (
                  <motion.div
                    key={p.name}
                    animate={p.justEliminated ? { scale: [1, 1.2, 0.8], rotate: [0, -5, 5, 0] } : {}}
                    transition={{ duration: 0.5 }}
                    className={`px-4 py-3 rounded-xl font-bold text-sm border-2 flex items-center gap-2 transition-all
                      ${p.alive ? 'bg-green-900 border-green-500 text-green-200' : 'bg-gray-900 border-gray-800 text-gray-600 line-through opacity-50'}`}
                  >
                    {p.justEliminated && <span className="text-red-400">💀</span>}
                    {!p.alive && !p.justEliminated && <span>❌</span>}
                    {p.alive && <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                      className="w-2 h-2 rounded-full bg-green-400 inline-block" />}
                    {p.name}
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="flex justify-center py-5">
              <button onClick={handleNext}
                className="px-10 py-4 text-xl font-black rounded-xl text-white"
                style={{ backgroundColor: '#680001' }}>
                Next Question →
              </button>
            </div>
          </motion.div>
        )}

        {/* GAME OVER */}
        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
            {winner ? (
              <>
                <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                  className="text-8xl font-black text-yellow-400">
                  👑 WINNER!
                </motion.div>
                <div className="text-6xl font-black text-white">{winner}</div>
                <div className="text-2xl text-gray-400">Last one standing!</div>
              </>
            ) : (
              <>
                <div className="text-6xl font-black text-orange-400">GAME OVER</div>
                <div className="text-2xl text-gray-400">{survivorCount} player{survivorCount !== 1 ? 's' : ''} survived!</div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {players.filter((p) => p.alive).map((p) => (
                    <span key={p.name} className="bg-green-900 border border-green-500 text-green-300 px-4 py-2 rounded-xl font-bold text-lg">
                      👑 {p.name}
                    </span>
                  ))}
                </div>
              </>
            )}
            <button onClick={() => navigate('/dashboard')}
              className="px-8 py-4 text-xl font-black rounded-xl text-white bg-gray-700 hover:bg-gray-600">
              Back to Dashboard
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
