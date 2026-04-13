import ManualScorePanel from '../../components/games/ManualScorePanel';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface Player {
  name: string;
  score: number;
}

interface Clue {
  category: string;
  points: number;
  question: string;
  answer: string;
}

interface BoardState {
  categories: string[];
  clues: Record<string, Clue>;
}

type Phase = 'lobby' | 'board' | 'clue' | 'buzzers' | 'judging' | 'gameover';

const POINT_VALUES = [100, 200, 300, 400, 500];

export default function JeopardyHostView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pin, bankId, settings } = (location.state as { pin: string; bankId: string; settings: Record<string, unknown> }) || {};

  const [players, setPlayers] = useState<Player[]>([]);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [categories, setCategories] = useState<string[]>([]);
  const [usedClues, setUsedClues] = useState<Set<string>>(new Set());
  const [selectedClue, setSelectedClue] = useState<Clue | null>(null);
  const [buzzerQueue, setBuzzerQueue] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(30);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('host_game', { pin, gameType: 'jeopardy', bankId, settings });

    socket.on('player_joined', (data: { players: Player[] }) => {
      setPlayers(data.players);
      const newScores: Record<string, number> = {};
      data.players.forEach((p) => { newScores[p.name] = p.score || 0; });
      setScores(newScores);
    });

    socket.on('jeopardy:board_state', (data: { categories: string[] }) => {
      setCategories(data.categories);
      setPhase('board');
    });

    socket.on('buzz_accepted', (data: { playerName: string }) => {
      setBuzzerQueue((prev) => {
        if (!prev.includes(data.playerName)) return [...prev, data.playerName];
        return prev;
      });
      if (phase === 'buzzers') setPhase('judging');
    });

    socket.on('timer_tick', (data: { timeLeft: number }) => {
      setTimeLeft(data.timeLeft);
    });

    socket.on('game_over', () => setPhase('gameover'));

    return () => {
      socket.off('player_joined');
      socket.off('jeopardy:board_state');
      socket.off('buzz_accepted');
      socket.off('timer_tick');
      socket.off('game_over');
    };
  }, []);

  const socket = getSocket();

  const handleStart = () => {
    socket.emit('jeopardy:start', { pin });
    setPhase('board');
    if (categories.length === 0) {
      setCategories(['Category 1', 'Category 2', 'Category 3', 'Category 4', 'Category 5']);
    }
  };

  const handleSelectCell = (category: string, points: number) => {
    const key = `${category}-${points}`;
    if (usedClues.has(key)) return;
    const clue: Clue = { category, points, question: `${category} for ${points}: Question from bank`, answer: 'See question bank' };
    setSelectedClue(clue);
    setShowAnswer(false);
    setBuzzerQueue([]);
    setTimeLeft(30);
    setPhase('clue');
    socket.emit('jeopardy:select_cell', { pin, category, points });
  };

  const handleOpenBuzzers = () => {
    setBuzzerQueue([]);
    setPhase('buzzers');
    socket.emit('jeopardy:open_buzzers', { pin });
  };

  const handleJudge = (correct: boolean) => {
    if (!selectedClue || buzzerQueue.length === 0) return;
    const playerName = buzzerQueue[0];
    socket.emit('jeopardy:judge', { correct, playerName, pin });
    if (correct) {
      setScores((prev) => ({ ...prev, [playerName]: (prev[playerName] || 0) + selectedClue.points }));
      const key = `${selectedClue.category}-${selectedClue.points}`;
      setUsedClues((prev) => new Set([...prev, key]));
      setSelectedClue(null);
      setBuzzerQueue([]);
      setPhase('board');
    } else {
      setScores((prev) => ({ ...prev, [playerName]: (prev[playerName] || 0) - selectedClue.points }));
      const remaining = buzzerQueue.slice(1);
      setBuzzerQueue(remaining);
      if (remaining.length > 0) {
        setPhase('judging');
      } else {
        setPhase('clue');
      }
    }
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
    if (selectedClue) {
      const key = `${selectedClue.category}-${selectedClue.points}`;
      setUsedClues((prev) => new Set([...prev, key]));
    }
  };

  const handleBackToBoard = () => {
    setSelectedClue(null);
    setBuzzerQueue([]);
    setPhase('board');
  };

  const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);

  return (
    <div className="min-h-screen bg-blue-950 text-white flex flex-col" style={{ fontFamily: 'Georgia, serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-black border-b-2 border-yellow-400">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black" style={{ color: '#680001' }}>UNOH</span>
          <span className="text-yellow-400 text-xl font-bold tracking-wider">JEOPARDY!</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-black border border-yellow-400 rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-yellow-400 uppercase tracking-widest">Game PIN</div>
            <div className="text-2xl font-black tracking-widest text-white">{pin}</div>
          </div>
          <button
            onClick={() => { socket.emit('jeopardy:end', { pin }); navigate('/dashboard'); }}
            className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold"
          >
            End Game
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {/* LOBBY */}
            {phase === 'lobby' && (
              <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
                <div className="text-7xl font-black text-yellow-400 tracking-widest">JEOPARDY!</div>
                <div className="text-center">
                  <div className="text-gray-300 text-xl">Join at unoh.review — PIN:</div>
                  <div className="text-7xl font-black text-white tracking-widest">{pin}</div>
                </div>
                <div className="text-2xl text-white">{players.length} player{players.length !== 1 ? 's' : ''} waiting...</div>
                <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                  {players.map((p) => (
                    <motion.span key={p.name} initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="bg-blue-800 border border-yellow-400 text-white px-3 py-1 rounded font-bold">
                      {p.name}
                    </motion.span>
                  ))}
                </div>
                <button onClick={handleStart} disabled={players.length === 0}
                  className="px-12 py-5 text-2xl font-black rounded-xl text-black bg-yellow-400 hover:bg-yellow-300 transition-all transform hover:scale-105 disabled:opacity-50">
                  START GAME
                </button>
              </motion.div>
            )}

            {/* BOARD */}
            {phase === 'board' && (
              <motion.div key="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 p-4">
                <div className="grid gap-2 h-full" style={{ gridTemplateColumns: `repeat(${Math.max(categories.length, 5)}, 1fr)` }}>
                  {/* Category headers */}
                  {(categories.length > 0 ? categories : Array(5).fill('')).map((cat, ci) => (
                    <div key={ci} className="bg-blue-800 border-2 border-blue-600 rounded-lg p-3 flex items-center justify-center text-center min-h-16">
                      <span className="font-black text-white text-sm uppercase tracking-wide leading-tight">{cat || `Category ${ci + 1}`}</span>
                    </div>
                  ))}
                  {/* Clue cells */}
                  {POINT_VALUES.map((pts) =>
                    (categories.length > 0 ? categories : Array(5).fill('')).map((cat, ci) => {
                      const key = `${cat || `Category ${ci + 1}`}-${pts}`;
                      const used = usedClues.has(key);
                      return (
                        <motion.button
                          key={key}
                          whileHover={!used ? { scale: 1.05 } : {}}
                          whileTap={!used ? { scale: 0.95 } : {}}
                          onClick={() => !used && handleSelectCell(cat || `Category ${ci + 1}`, pts)}
                          className={`border-2 rounded-lg p-3 flex items-center justify-center min-h-20 transition-all font-black text-2xl
                            ${used ? 'bg-blue-950 border-blue-900 text-blue-900 cursor-default' : 'bg-blue-700 border-blue-500 text-yellow-400 hover:bg-blue-600 cursor-pointer'}`}
                        >
                          {used ? '' : `$${pts}`}
                        </motion.button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* CLUE / BUZZERS / JUDGING */}
            {(phase === 'clue' || phase === 'buzzers' || phase === 'judging') && selectedClue && (
              <motion.div key="clue" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
                <div className="text-yellow-400 text-xl font-bold uppercase tracking-widest">
                  {selectedClue.category} — ${selectedClue.points}
                </div>
                <div className="text-center bg-blue-800 border-4 border-yellow-400 rounded-2xl p-10 max-w-4xl">
                  <div className="text-4xl font-bold text-white leading-relaxed">{selectedClue.question}</div>
                </div>

                {showAnswer && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="text-center bg-green-900 border-2 border-green-400 rounded-xl p-5 max-w-2xl">
                    <div className="text-green-300 text-sm uppercase tracking-widest mb-1">Answer</div>
                    <div className="text-2xl font-bold text-white">{selectedClue.answer}</div>
                  </motion.div>
                )}

                {/* Buzzer Queue */}
                {buzzerQueue.length > 0 && (
                  <div className="bg-black border border-yellow-400 rounded-xl p-4 w-full max-w-lg">
                    <div className="text-yellow-400 text-sm uppercase tracking-widest mb-2">Buzzer Queue</div>
                    {buzzerQueue.map((name, i) => (
                      <div key={name} className={`flex items-center gap-3 py-2 ${i === 0 ? 'text-white font-black text-xl' : 'text-gray-400 text-sm'}`}>
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ backgroundColor: i === 0 ? '#680001' : '#374151' }}>
                          {i + 1}
                        </span>
                        {name}
                        {i === 0 && <span className="ml-auto text-yellow-400 animate-pulse">← NOW</span>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-4 flex-wrap justify-center">
                  {phase === 'clue' && (
                    <button onClick={handleOpenBuzzers}
                      className="px-8 py-4 text-xl font-black rounded-xl text-black bg-yellow-400 hover:bg-yellow-300 transition-all">
                      Open Buzzers
                    </button>
                  )}
                  {phase === 'judging' && buzzerQueue.length > 0 && (
                    <>
                      <button onClick={() => handleJudge(true)}
                        className="px-8 py-4 text-xl font-black rounded-xl text-white bg-green-600 hover:bg-green-500">
                        ✓ CORRECT
                      </button>
                      <button onClick={() => handleJudge(false)}
                        className="px-8 py-4 text-xl font-black rounded-xl text-white bg-red-600 hover:bg-red-500">
                        ✗ WRONG
                      </button>
                    </>
                  )}
                  {!showAnswer && (
                    <button onClick={handleShowAnswer}
                      className="px-6 py-4 text-lg font-bold rounded-xl text-white bg-gray-700 hover:bg-gray-600">
                      Show Answer
                    </button>
                  )}
                  <button onClick={handleBackToBoard}
                    className="px-6 py-4 text-lg font-bold rounded-xl text-white bg-blue-800 hover:bg-blue-700">
                    ← Board
                  </button>
                </div>
              </motion.div>
            )}

            {/* GAME OVER */}
            {phase === 'gameover' && (
              <motion.div key="gameover" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                <div className="text-5xl font-black text-yellow-400">FINAL JEOPARDY!</div>
                <div className="space-y-3 w-full max-w-lg">
                  {sortedScores.slice(0, 5).map(([name, score], i) => (
                    <motion.div key={name} initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.15 }}
                      className="flex items-center justify-between bg-blue-800 border border-yellow-400 rounded-xl p-4">
                      <span className="text-2xl font-black text-white">{i + 1}. {name}</span>
                      <span className="text-2xl font-black text-yellow-400">${score.toLocaleString()}</span>
                    </motion.div>
                  ))}
                </div>
                <button onClick={() => navigate('/dashboard')}
                  className="px-8 py-4 text-xl font-black rounded-xl text-black bg-yellow-400 hover:bg-yellow-300">
                  Back to Dashboard
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Score Sidebar */}
        {phase !== 'lobby' && (
          <div className="w-52 bg-black border-l border-yellow-400 flex flex-col p-3 overflow-y-auto">
            <div className="text-yellow-400 text-xs uppercase tracking-widest font-bold mb-3">Scores</div>
            {sortedScores.map(([name, score], i) => (
              <div key={name} className="mb-2 py-2 border-b border-gray-800">
                <div className="text-white text-sm font-bold truncate">{name}</div>
                <div className="text-yellow-400 font-black">${score.toLocaleString()}</div>
              </div>
            ))}
            {sortedScores.length === 0 && (
              <div className="text-gray-600 text-sm">No scores yet</div>
            )}
          </div>
        )}
      </div>
      {(location.state as any)?.settings?.noJoin && <ManualScorePanel pin={(location.state as any)?.pin} />}
    </div>
  );
}
