import ManualScorePanel from '../../components/games/ManualScorePanel';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface ClueCell {
  question: string;
  answer:   string;
  points:   number;
  used:     boolean;
}

interface ActiveClue {
  categoryIndex: number;
  valueIndex:    number;
  category:      string;
  question:      string;
  answer:        string;
  points:        number;
}

interface Player {
  name:  string;
  score: number;
}

const POINT_VALUES = [100, 200, 300, 400, 500];
type Phase = 'lobby' | 'board' | 'clue' | 'judging' | 'gameover';

export default function JeopardyHostView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pin, bankId, settings } = (location.state as { pin: string; bankId: string; settings: Record<string, unknown> }) || {};
  const noJoin = (settings as any)?.noJoin;

  const [players, setPlayers] = useState<Player[]>([]);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [categories, setCategories] = useState<string[]>([]);
  const [clueBoard, setClueBoard] = useState<ClueCell[][]>([]);   // [catIdx][valIdx]
  const [activeClue, setActiveClue] = useState<ActiveClue | null>(null);
  const [buzzedPlayer, setBuzzedPlayer] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    const socket = getSocket();
    socket.emit('host_game', { pin, gameType: 'jeopardy', bankId, settings });

    socket.on('player_joined', (data: { players: Player[] }) => {
      setPlayers(data.players);
      const s: Record<string, number> = {};
      data.players.forEach(p => { s[p.name] = p.score || 0; });
      setScores(s);
    });

    // Full board data including real question text
    socket.on('jeopardy:board_state', (data: { categories: string[]; clues: ClueCell[][] }) => {
      setCategories(data.categories);
      setClueBoard(data.clues);
      setPhase('board');
    });

    // Server confirmed which clue was selected and returned real question text
    socket.on('jeopardy:clue_selected', (data: ActiveClue) => {
      setActiveClue(data);
      setShowAnswer(false);
      setBuzzedPlayer(null);
      setPhase('clue');
    });

    socket.on('player_buzzed', (data: { playerName: string }) => {
      setBuzzedPlayer(data.playerName);
      setPhase('judging');
    });

    socket.on('jeopardy:answer_result', (data: {
      playerName: string; correct: boolean; points: number; newScore: number;
      answer?: string; categoryIndex: number; valueIndex: number;
    }) => {
      setScores(prev => ({ ...prev, [data.playerName]: data.newScore }));
      // Mark clue as used locally
      if (data.correct) {
        setClueBoard(prev => prev.map((col, ci) =>
          ci === data.categoryIndex
            ? col.map((cell, vi) => vi === data.valueIndex ? { ...cell, used: true } : cell)
            : col
        ));
        setActiveClue(null);
        setBuzzedPlayer(null);
        setPhase('board');
      } else {
        // Wrong — show answer, return to clue phase for next attempt or skip
        setBuzzedPlayer(null);
        setPhase('clue');
      }
    });

    socket.on('jeopardy:clue_expired', (data: { categoryIndex: number; valueIndex: number; answer: string }) => {
      setClueBoard(prev => prev.map((col, ci) =>
        ci === data.categoryIndex
          ? col.map((cell, vi) => vi === data.valueIndex ? { ...cell, used: true } : cell)
          : col
      ));
      setShowAnswer(true);
    });

    socket.on('jeopardy:clue_timeout', (data: { categoryIndex: number; valueIndex: number }) => {
      setClueBoard(prev => prev.map((col, ci) =>
        ci === data.categoryIndex
          ? col.map((cell, vi) => vi === data.valueIndex ? { ...cell, used: true } : cell)
          : col
      ));
      setActiveClue(null);
      setPhase('board');
    });

    socket.on('leaderboard_update', (data: { scores: Player[] }) => {
      const s: Record<string, number> = {};
      data.scores.forEach(p => { s[p.name] = p.score; });
      setScores(s);
    });

    socket.on('game_over', () => setPhase('gameover'));

    return () => {
      socket.off('player_joined');
      socket.off('jeopardy:board_state');
      socket.off('jeopardy:clue_selected');
      socket.off('player_buzzed');
      socket.off('jeopardy:answer_result');
      socket.off('jeopardy:clue_expired');
      socket.off('jeopardy:clue_timeout');
      socket.off('leaderboard_update');
      socket.off('game_over');
    };
  }, []);

  const socket = getSocket();

  const handleStart = () => {
    socket.emit('jeopardy:start', { pin });
  };

  const handleSelectCell = (categoryIndex: number, valueIndex: number) => {
    const clue = clueBoard[categoryIndex]?.[valueIndex];
    if (!clue || clue.used) return;
    socket.emit('jeopardy:select_cell', { pin, categoryIndex, valueIndex });
  };

  // No-devices: host clicks a player name to "buzz them in"
  const handleVirtualBuzz = (playerName: string) => {
    socket.emit('jeopardy:virtual_buzz', { pin, playerName });
  };

  // Phone mode: open buzzers for real devices
  const handleOpenBuzzers = () => {
    setBuzzedPlayer(null);
    socket.emit('jeopardy:open_buzzers', { pin });
  };

  const handleJudge = (correct: boolean) => {
    if (!buzzedPlayer) return;
    socket.emit('jeopardy:judge', { pin, correct, playerName: buzzedPlayer });
  };

  const handleShowAnswer = () => setShowAnswer(true);

  const handleBackToBoard = () => {
    // Mark clue used and return
    if (activeClue) {
      setClueBoard(prev => prev.map((col, ci) =>
        ci === activeClue.categoryIndex
          ? col.map((cell, vi) => vi === activeClue.valueIndex ? { ...cell, used: true } : cell)
          : col
      ));
    }
    setActiveClue(null);
    setBuzzedPlayer(null);
    setShowAnswer(false);
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
            <div className="text-xs text-yellow-400 uppercase tracking-widest">PIN</div>
            <div className="text-2xl font-black tracking-widest text-white">{pin}</div>
          </div>
          <button onClick={() => { socket.emit('jeopardy:end', { pin }); navigate('/dashboard'); }}
            className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold">
            End Game
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {/* LOBBY */}
            {phase === 'lobby' && (
              <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
                <div className="text-7xl font-black text-yellow-400 tracking-widest">JEOPARDY!</div>
                {!noJoin && (
                  <div className="text-center">
                    <div className="text-gray-300 text-xl">Join at unoh.review — PIN:</div>
                    <div className="text-7xl font-black text-white tracking-widest">{pin}</div>
                  </div>
                )}
                <div className="text-2xl text-white">{players.length} player{players.length !== 1 ? 's' : ''} waiting...</div>
                <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                  {players.map(p => (
                    <motion.span key={p.name} initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="bg-blue-800 border border-yellow-400 text-white px-3 py-1 rounded font-bold">
                      {p.name}
                    </motion.span>
                  ))}
                </div>
                <button onClick={handleStart} disabled={!noJoin && players.length === 0}
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
                  {categories.map((cat, ci) => (
                    <div key={ci} className="bg-blue-800 border-2 border-blue-600 rounded-lg p-3 flex items-center justify-center text-center min-h-16">
                      <span className="font-black text-white text-sm uppercase tracking-wide leading-tight">{cat}</span>
                    </div>
                  ))}
                  {/* Clue cells */}
                  {POINT_VALUES.map((pts, vi) =>
                    categories.map((cat, ci) => {
                      const clue = clueBoard[ci]?.[vi];
                      const used = clue?.used ?? false;
                      return (
                        <motion.button key={`${ci}-${vi}`}
                          whileHover={!used ? { scale: 1.05 } : {}}
                          whileTap={!used ? { scale: 0.95 } : {}}
                          onClick={() => !used && handleSelectCell(ci, vi)}
                          className={`border-2 rounded-lg p-3 flex items-center justify-center min-h-20 transition-all font-black text-2xl
                            ${used ? 'bg-blue-950 border-blue-900 text-blue-900 cursor-default' : 'bg-blue-700 border-blue-500 text-yellow-400 hover:bg-blue-600 cursor-pointer'}`}>
                          {used ? '' : `$${pts}`}
                        </motion.button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* CLUE / JUDGING */}
            {(phase === 'clue' || phase === 'judging') && activeClue && (
              <motion.div key="clue" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
                <div className="text-yellow-400 text-xl font-bold uppercase tracking-widest">
                  {activeClue.category} — ${activeClue.points}
                </div>
                <div className="text-center bg-blue-800 border-4 border-yellow-400 rounded-2xl p-10 max-w-4xl">
                  <div className="text-4xl font-bold text-white leading-relaxed">{activeClue.question}</div>
                </div>

                {showAnswer && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="text-center bg-green-900 border-2 border-green-400 rounded-xl p-5 max-w-2xl">
                    <div className="text-green-300 text-sm uppercase tracking-widest mb-1">Answer</div>
                    <div className="text-2xl font-bold text-white">{activeClue.answer}</div>
                  </motion.div>
                )}

                {/* Judging: show correct/wrong for buzzed player */}
                {phase === 'judging' && buzzedPlayer && (
                  <div className="bg-black border-2 border-yellow-400 rounded-xl p-5 w-full max-w-lg text-center">
                    <div className="text-yellow-400 text-sm uppercase tracking-widest mb-2">Answering</div>
                    <div className="text-3xl font-black text-white mb-4">{buzzedPlayer}</div>
                    <div className="flex gap-4 justify-center">
                      <button onClick={() => handleJudge(true)}
                        className="px-8 py-4 text-xl font-black rounded-xl text-white bg-green-600 hover:bg-green-500">
                        ✓ CORRECT
                      </button>
                      <button onClick={() => handleJudge(false)}
                        className="px-8 py-4 text-xl font-black rounded-xl text-white bg-red-600 hover:bg-red-500">
                        ✗ WRONG
                      </button>
                    </div>
                  </div>
                )}

                {/* No-devices: player name buttons to virtually buzz in */}
                {phase === 'clue' && noJoin && players.length > 0 && (
                  <div className="w-full max-w-lg">
                    <div className="text-yellow-400 text-sm uppercase tracking-widest mb-3 text-center">
                      Who answered?
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {players.map(p => (
                        <button key={p.name} onClick={() => handleVirtualBuzz(p.name)}
                          className="px-5 py-3 bg-blue-700 hover:bg-blue-600 border-2 border-yellow-400 rounded-xl font-black text-white text-lg transition-all hover:scale-105 active:scale-95">
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Phone mode: Open Buzzers button */}
                {phase === 'clue' && !noJoin && (
                  <button onClick={handleOpenBuzzers}
                    className="px-8 py-4 text-xl font-black rounded-xl text-black bg-yellow-400 hover:bg-yellow-300 transition-all">
                    Open Buzzers
                  </button>
                )}

                <div className="flex gap-3 flex-wrap justify-center">
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
            {sortedScores.map(([name, score]) => (
              <div key={name} className="mb-2 py-2 border-b border-gray-800">
                <div className="text-white text-sm font-bold truncate">{name}</div>
                <div className="text-yellow-400 font-black">${score.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {noJoin && <ManualScorePanel pin={pin} />}
    </div>
  );
}
