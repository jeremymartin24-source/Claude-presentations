import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface ClueCell {
  question: string;
  answer:   string;
  points:   number;
  used:     boolean;
  isDailyDouble?: boolean;
}

interface ActiveClue {
  categoryIndex: number;
  valueIndex:    number;
  category:      string;
  question:      string;
  answer:        string;
  points:        number;
  isDailyDouble?: boolean;
}

interface Player {
  name:  string;
  score: number;
}

interface FinalHostData {
  question: string;
  answer:   string;
  category: string;
  scores:   Player[];
}

type Phase =
  | 'lobby'
  | 'board'
  | 'clue'
  | 'judging'
  | 'daily_double'
  | 'round2_transition'
  | 'final_wager'
  | 'final_question'
  | 'final_judging'
  | 'gameover';

const MEDALS = ['🥇', '🥈', '🥉'];
const PODIUM_COLORS = ['from-yellow-500 to-yellow-700', 'from-gray-400 to-gray-600', 'from-amber-700 to-amber-900'];

export default function JeopardyHostView() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { pin, bankId, settings } = (location.state as {
    pin: string; bankId: string; settings: Record<string, unknown>;
  }) || {};
  const noJoin = !!(settings as any)?.noJoin;

  // ── State ──────────────────────────────────────────────────────────────────
  const [players,    setPlayers]    = useState<Player[]>([]);
  const [phase,      setPhase]      = useState<Phase>('lobby');
  const [round,      setRound]      = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [clueBoard,  setClueBoard]  = useState<ClueCell[][]>([]);
  const [activeClue, setActiveClue] = useState<ActiveClue | null>(null);
  const [buzzedPlayer, setBuzzedPlayer] = useState<string | null>(null);
  const [showAnswer,   setShowAnswer]   = useState(false);
  const [scores,       setScores]       = useState<Record<string, number>>({});
  const [editingScore, setEditingScore] = useState<string | null>(null);
  const [editValue,    setEditValue]    = useState('');
  const [canUndo,      setCanUndo]      = useState(false);
  const [undoLabel,    setUndoLabel]    = useState('');
  const [autoDismiss,  setAutoDismiss]  = useState<number | null>(null);   // countdown seconds
  const [boardCleared, setBoardCleared] = useState(false);

  // Daily Double
  const [ddWagerInput, setDdWagerInput]   = useState('');
  const [ddPlayer,     setDdPlayer]       = useState('');
  const [ddMaxWager,   setDdMaxWager]     = useState(0);

  // Final Jeopardy
  const [finalData,    setFinalData]      = useState<FinalHostData | null>(null);
  const [finalWagers,  setFinalWagers]    = useState<Record<string, string>>({});
  const [finalJudged,  setFinalJudged]    = useState<Record<string, boolean | null>>({});
  const [finalScores,  setFinalScores]    = useState<Player[]>([]);
  const [finalTimer,   setFinalTimer]     = useState(30);
  const finalTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socket = getSocket();

  // ── Socket listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    socket.emit('host_game', { pin, gameType: 'jeopardy', bankId, settings });

    socket.on('player_joined', (data: { players: Player[] }) => {
      setPlayers(data.players);
      setScores(prev => {
        const s = { ...prev };
        data.players.forEach(p => { if (!(p.name in s)) s[p.name] = 0; });
        return s;
      });
    });

    socket.on('jeopardy:board_state', (data: {
      categories: string[]; clues: ClueCell[][]; round: number;
    }) => {
      setCategories(data.categories);
      setClueBoard(data.clues);
      setRound(data.round);
      setPhase('board');
      checkBoardCleared(data.clues);
    });

    socket.on('jeopardy:clue_selected', (data: ActiveClue) => {
      setActiveClue(data);
      setShowAnswer(false);
      setBuzzedPlayer(null);
      if (data.isDailyDouble) {
        // Pick highest-score player as default DD player
        setDdPlayer(sortedScores[0]?.[0] ?? '');
        setDdMaxWager(Math.max(scores[sortedScores[0]?.[0]] ?? 0, data.points));
        setDdWagerInput(String(data.points));
        setPhase('daily_double');
      } else {
        setPhase('clue');
      }
    });

    socket.on('jeopardy:daily_double_ready', (data: { wager: number; playerName: string }) => {
      setActiveClue(prev => prev ? { ...prev, points: data.wager } : prev);
      setPhase('clue');
    });

    socket.on('player_buzzed', (data: { playerName: string }) => {
      setBuzzedPlayer(data.playerName);
      setPhase('judging');
    });

    socket.on('jeopardy:answer_result', (data: {
      playerName: string; correct: boolean; points: number; newScore: number;
      categoryIndex: number; valueIndex: number;
    }) => {
      setScores(prev => ({ ...prev, [data.playerName]: data.newScore }));
      setCanUndo(true);
      setUndoLabel(`Undo ${data.playerName} ${data.points > 0 ? '+' : ''}${data.points}`);

      if (data.correct && data.categoryIndex >= 0) {
        setClueBoard(prev => markUsed(prev, data.categoryIndex, data.valueIndex));
        // Auto-dismiss after 5s
        setAutoDismiss(5);
        autoDismissRef.current = setTimeout(() => {
          setActiveClue(null);
          setBuzzedPlayer(null);
          setShowAnswer(false);
          setPhase('board');
          setAutoDismiss(null);
        }, 5000);
      } else if (!data.correct) {
        setBuzzedPlayer(null);
        setPhase('clue');
      }
    });

    socket.on('jeopardy:undo_result', (data: { playerName: string; newScore: number }) => {
      setScores(prev => ({ ...prev, [data.playerName]: data.newScore }));
      setCanUndo(false);
      setUndoLabel('');
    });

    socket.on('jeopardy:clue_expired', (data: {
      categoryIndex: number; valueIndex: number; answer: string;
    }) => {
      setClueBoard(prev => markUsed(prev, data.categoryIndex, data.valueIndex));
      setShowAnswer(true);
    });

    socket.on('jeopardy:cell_used', (data: { categoryIndex: number; valueIndex: number }) => {
      setClueBoard(prev => markUsed(prev, data.categoryIndex, data.valueIndex));
    });

    socket.on('leaderboard_update', (data: { scores: Player[] }) => {
      const s: Record<string, number> = {};
      data.scores.forEach(p => { s[p.name] = p.score; });
      setScores(s);
    });

    socket.on('jeopardy:final_host_data', (data: FinalHostData) => {
      setFinalData(data);
      setFinalScores(data.scores);
      // Init wager inputs and judged map
      const w: Record<string, string> = {};
      const j: Record<string, boolean | null> = {};
      data.scores.forEach(p => { w[p.name] = '0'; j[p.name] = null; });
      setFinalWagers(w);
      setFinalJudged(j);
      setPhase('final_wager');
    });

    socket.on('jeopardy:final_score_update', (data: { playerName: string; correct: boolean; scores: Player[] }) => {
      setFinalJudged(prev => ({ ...prev, [data.playerName]: data.correct }));
      setFinalScores(data.scores);
    });

    socket.on('game_over', (data: { scores?: Player[] }) => {
      if (data?.scores) setFinalScores(data.scores);
      setPhase('gameover');
    });

    return () => {
      socket.off('player_joined');
      socket.off('jeopardy:board_state');
      socket.off('jeopardy:clue_selected');
      socket.off('jeopardy:daily_double_ready');
      socket.off('player_buzzed');
      socket.off('jeopardy:answer_result');
      socket.off('jeopardy:undo_result');
      socket.off('jeopardy:clue_expired');
      socket.off('jeopardy:cell_used');
      socket.off('leaderboard_update');
      socket.off('jeopardy:final_host_data');
      socket.off('jeopardy:final_score_update');
      socket.off('game_over');
    };
  }, []);

  // Auto-dismiss countdown tick
  useEffect(() => {
    if (autoDismiss === null) return;
    if (autoDismiss <= 0) return;
    const t = setTimeout(() => setAutoDismiss(v => (v !== null ? v - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [autoDismiss]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function markUsed(board: ClueCell[][], ci: number, vi: number): ClueCell[][] {
    return board.map((col, c) =>
      c === ci ? col.map((cell, v) => v === vi ? { ...cell, used: true } : cell) : col
    );
  }

  function checkBoardCleared(board: ClueCell[][]) {
    const allUsed = board.every(col => col.every(cell => cell.used));
    setBoardCleared(allUsed);
  }

  useEffect(() => {
    if (clueBoard.length > 0) checkBoardCleared(clueBoard);
  }, [clueBoard]);

  const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleStart = () => socket.emit('jeopardy:start', { pin });

  const handleSelectCell = (ci: number, vi: number) => {
    if (clueBoard[ci]?.[vi]?.used) return;
    socket.emit('jeopardy:select_cell', { pin, categoryIndex: ci, valueIndex: vi });
  };

  const handleVirtualBuzz = (playerName: string) => {
    socket.emit('jeopardy:virtual_buzz', { pin, playerName });
  };

  const handleOpenBuzzers = () => {
    setBuzzedPlayer(null);
    socket.emit('jeopardy:open_buzzers', { pin });
  };

  const handleJudge = (correct: boolean) => {
    if (!buzzedPlayer) return;
    socket.emit('jeopardy:judge', { pin, correct, playerName: buzzedPlayer });
  };

  const handleSkip = () => {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    setAutoDismiss(null);
    socket.emit('jeopardy:skip', { pin });
    setActiveClue(null);
    setBuzzedPlayer(null);
    setShowAnswer(false);
    setPhase('board');
  };

  const handleBackToBoard = () => {
    if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    setAutoDismiss(null);
    handleSkip();
  };

  const handleUndo = () => socket.emit('jeopardy:undo', { pin });

  const handleEditScore = (name: string) => {
    setEditingScore(name);
    setEditValue(String(scores[name] ?? 0));
  };

  const handleEditScoreSubmit = (name: string) => {
    const newScore = parseInt(editValue, 10);
    if (!isNaN(newScore)) {
      socket.emit('jeopardy:edit_score', { pin, playerName: name, newScore });
    }
    setEditingScore(null);
  };

  const handleDailyDoubleSubmit = () => {
    const wager = Math.max(0, Math.min(parseInt(ddWagerInput, 10) || 0, ddMaxWager));
    socket.emit('jeopardy:daily_double_wager', { pin, playerName: ddPlayer, wager });
  };

  const handleStartRound2 = () => socket.emit('jeopardy:start_round2', { pin });
  const handleStartFinal  = () => socket.emit('jeopardy:start_final', { pin });

  const handleRevealFinal = () => {
    socket.emit('jeopardy:reveal_final', { pin });
    setPhase('final_question');
    setFinalTimer(30);
    finalTimerRef.current = setInterval(() => {
      setFinalTimer(t => {
        if (t <= 1) { clearInterval(finalTimerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const handleFinalJudge = (playerName: string, correct: boolean) => {
    socket.emit('jeopardy:final_judge', { pin, playerName, correct });
  };

  const displayUrl = `${window.location.origin}/game/jeopardy/display?pin=${pin}`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-blue-950 text-white flex flex-col" style={{ fontFamily: 'Georgia, serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-black border-b-2 border-yellow-400">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black" style={{ color: '#680001' }}>UNOH</span>
          <span className="text-yellow-400 text-xl font-bold tracking-wider">
            JEOPARDY!{round === 2 ? ' — DOUBLE JEOPARDY' : ''}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Projector URL */}
          <div className="hidden md:flex flex-col items-end">
            <span className="text-gray-500 text-xs">Projector URL</span>
            <span className="text-gray-300 text-xs font-mono">{displayUrl}</span>
          </div>
          <div className="bg-black border border-yellow-400 rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-yellow-400 uppercase tracking-widest">PIN</div>
            <div className="text-2xl font-black tracking-widest text-white">{pin}</div>
          </div>
          {canUndo && (
            <button onClick={handleUndo}
              className="bg-orange-700 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-xs font-bold">
              ↩ {undoLabel}
            </button>
          )}
          <button
            onClick={() => { socket.emit('jeopardy:end', { pin }); navigate('/admin'); }}
            className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold">
            End Game
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
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
                className="flex-1 p-3 flex flex-col gap-3">
                {boardCleared && round === 1 && (
                  <div className="flex justify-center gap-3">
                    <button onClick={handleStartRound2}
                      className="px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-lg rounded-xl">
                      Double Jeopardy! →
                    </button>
                    <button onClick={handleStartFinal}
                      className="px-8 py-3 bg-purple-700 hover:bg-purple-600 text-white font-black text-lg rounded-xl">
                      Final Jeopardy →
                    </button>
                  </div>
                )}
                {boardCleared && round === 2 && (
                  <div className="flex justify-center">
                    <button onClick={handleStartFinal}
                      className="px-8 py-3 bg-purple-700 hover:bg-purple-600 text-white font-black text-lg rounded-xl">
                      Final Jeopardy →
                    </button>
                  </div>
                )}
                <div className="flex-1 grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${Math.max(categories.length, 5)}, 1fr)` }}>
                  {categories.map((cat, ci) => (
                    <div key={ci} className="bg-blue-800 border-2 border-blue-600 rounded-lg p-2 flex items-center justify-center text-center min-h-14">
                      <span className="font-black text-white text-xs uppercase tracking-wide leading-tight">{cat}</span>
                    </div>
                  ))}
                  {[0,1,2,3,4].map(vi =>
                    categories.map((_, ci) => {
                      const clue = clueBoard[ci]?.[vi];
                      const pts  = round === 1
                        ? [100,200,300,400,500][vi]
                        : [200,400,600,800,1000][vi];
                      const used = clue?.used ?? false;
                      return (
                        <motion.button key={`${ci}-${vi}`}
                          whileHover={!used ? { scale: 1.05 } : {}}
                          whileTap={!used ? { scale: 0.95 } : {}}
                          onClick={() => !used && handleSelectCell(ci, vi)}
                          className={`border-2 rounded-lg p-2 flex items-center justify-center min-h-16 transition-all font-black text-2xl
                            ${used
                              ? 'bg-blue-950 border-blue-900 text-blue-900 cursor-default'
                              : 'bg-blue-700 border-blue-500 text-yellow-400 hover:bg-blue-600 cursor-pointer'
                            }`}>
                          {used ? '' : `$${pts}`}
                        </motion.button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* DAILY DOUBLE WAGER */}
            {phase === 'daily_double' && activeClue && (
              <motion.div key="dd" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                <div className="text-5xl font-black text-yellow-400 tracking-widest">DAILY DOUBLE!</div>
                <div className="text-yellow-300 text-xl">{activeClue.category}</div>

                {noJoin ? (
                  <div className="flex flex-col gap-4 items-center w-full max-w-sm">
                    <label className="text-white text-sm uppercase tracking-wide">Answering Player</label>
                    <select value={ddPlayer} onChange={e => {
                      setDdPlayer(e.target.value);
                      setDdMaxWager(Math.max(scores[e.target.value] ?? 0, activeClue.points));
                      setDdWagerInput(String(activeClue.points));
                    }}
                      className="w-full bg-blue-900 border-2 border-yellow-400 rounded-xl px-4 py-3 text-white text-lg font-bold">
                      {sortedScores.map(([name]) => (
                        <option key={name} value={name}>{name} (${scores[name]?.toLocaleString()})</option>
                      ))}
                    </select>
                    <label className="text-white text-sm uppercase tracking-wide">Wager (max ${ddMaxWager.toLocaleString()})</label>
                    <input type="number" min={0} max={ddMaxWager} value={ddWagerInput}
                      onChange={e => setDdWagerInput(e.target.value)}
                      className="w-full bg-blue-900 border-2 border-yellow-400 rounded-xl px-4 py-4 text-white text-3xl font-black text-center" />
                    <button onClick={handleDailyDoubleSubmit}
                      className="px-10 py-4 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-xl rounded-xl">
                      Reveal Question →
                    </button>
                  </div>
                ) : (
                  <div className="text-gray-300 text-lg">Waiting for player wager...</div>
                )}
              </motion.div>
            )}

            {/* CLUE / JUDGING */}
            {(phase === 'clue' || phase === 'judging') && activeClue && (
              <motion.div key="clue" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center p-8 gap-5 overflow-y-auto">

                <div className="text-yellow-400 text-xl font-bold uppercase tracking-widest">
                  {activeClue.category} — ${activeClue.points}
                  {activeClue.isDailyDouble && <span className="ml-2 text-yellow-300">(Daily Double)</span>}
                </div>

                {/* Host always sees the answer */}
                <div className="w-full max-w-3xl grid gap-3">
                  <div className="bg-blue-800 border-4 border-yellow-400 rounded-2xl p-8 text-center">
                    <div className="text-3xl font-bold text-white leading-relaxed">{activeClue.question}</div>
                  </div>
                  <div className="bg-green-900 border-2 border-green-400 rounded-xl p-4 text-center">
                    <div className="text-green-400 text-xs uppercase tracking-widest mb-1">Answer</div>
                    <div className="text-xl font-bold text-white">{activeClue.answer}</div>
                  </div>
                </div>

                {/* Auto-dismiss countdown */}
                {autoDismiss !== null && (
                  <div className="text-gray-400 text-sm">Returning to board in {autoDismiss}s...</div>
                )}

                {/* Judging: who buzzed */}
                {phase === 'judging' && buzzedPlayer && (
                  <div className="bg-black border-2 border-yellow-400 rounded-xl p-5 w-full max-w-md text-center">
                    <div className="text-yellow-400 text-xs uppercase tracking-widest mb-1">Answering</div>
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

                {/* No-devices: per-player correct/wrong buttons */}
                {phase === 'clue' && noJoin && players.length > 0 && (
                  <div className="w-full max-w-2xl">
                    <div className="text-yellow-400 text-sm uppercase tracking-widest mb-3 text-center">
                      Who answered?
                    </div>
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(players.length, 4)}, 1fr)` }}>
                      {players.map(p => (
                        <div key={p.name} className="flex flex-col gap-1">
                          <div className="text-white text-xs text-center truncate font-bold">{p.name}</div>
                          <div className="flex gap-1">
                            <button onClick={() => handleVirtualBuzz(p.name)}
                              className="flex-1 py-2 bg-green-700 hover:bg-green-600 text-white text-xs font-black rounded">
                              ✓
                            </button>
                            <button onClick={() => {
                              // Mark wrong directly: buzz then immediately judge wrong
                              socket.emit('jeopardy:virtual_buzz', { pin, playerName: p.name });
                              setTimeout(() => socket.emit('jeopardy:judge', { pin, correct: false, playerName: p.name }), 50);
                            }}
                              className="flex-1 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-black rounded">
                              ✗
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Phone mode: Open Buzzers */}
                {phase === 'clue' && !noJoin && (
                  <button onClick={handleOpenBuzzers}
                    className="px-8 py-4 text-xl font-black rounded-xl text-black bg-yellow-400 hover:bg-yellow-300">
                    Open Buzzers
                  </button>
                )}

                <div className="flex gap-3 flex-wrap justify-center">
                  <button onClick={handleBackToBoard}
                    className="px-6 py-3 text-base font-bold rounded-xl text-white bg-blue-800 hover:bg-blue-700">
                    ← Skip / Board
                  </button>
                </div>
              </motion.div>
            )}

            {/* FINAL JEOPARDY — WAGER COLLECTION */}
            {phase === 'final_wager' && finalData && (
              <motion.div key="final_wager" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                <div className="text-5xl font-black text-yellow-400">FINAL JEOPARDY!</div>
                <div className="text-2xl text-white font-bold">Category: {finalData.category}</div>
                <div className="text-gray-400 text-sm">Collect wagers from each player, then reveal the question.</div>

                <div className="w-full max-w-lg space-y-3">
                  {finalData.scores.map(p => (
                    <div key={p.name} className="flex items-center gap-3 bg-blue-900 border border-yellow-400 rounded-xl px-4 py-3">
                      <div className="flex-1">
                        <div className="font-black text-white">{p.name}</div>
                        <div className="text-yellow-400 text-sm">${p.score.toLocaleString()}</div>
                      </div>
                      <input
                        type="number" min={0} max={Math.max(p.score, 0)}
                        value={finalWagers[p.name] ?? '0'}
                        onChange={e => setFinalWagers(prev => ({ ...prev, [p.name]: e.target.value }))}
                        onBlur={e => {
                          const wager = Math.max(0, Math.min(parseInt(e.target.value) || 0, Math.max(p.score, 0)));
                          socket.emit('jeopardy:submit_wager', { pin, playerName: p.name, wager });
                          setFinalWagers(prev => ({ ...prev, [p.name]: String(wager) }));
                        }}
                        className="w-28 bg-black border border-yellow-400 rounded-lg px-3 py-2 text-white text-center font-bold"
                        placeholder="Wager"
                      />
                    </div>
                  ))}
                </div>

                <button onClick={handleRevealFinal}
                  className="px-10 py-4 text-xl font-black rounded-xl text-black bg-yellow-400 hover:bg-yellow-300">
                  Reveal Question →
                </button>
              </motion.div>
            )}

            {/* FINAL JEOPARDY — QUESTION + JUDGING */}
            {phase === 'final_question' && finalData && (
              <motion.div key="final_question" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-5 p-8">
                <div className="text-4xl font-black text-yellow-400">FINAL JEOPARDY!</div>

                <div className="w-full max-w-3xl grid gap-3">
                  <div className="bg-blue-800 border-4 border-yellow-400 rounded-2xl p-8 text-center">
                    <div className="text-3xl font-bold text-white">{finalData.question}</div>
                  </div>
                  <div className="bg-green-900 border-2 border-green-400 rounded-xl p-4 text-center">
                    <div className="text-green-400 text-xs uppercase tracking-widest mb-1">Answer</div>
                    <div className="text-xl font-bold text-white">{finalData.answer}</div>
                  </div>
                </div>

                <div className="text-4xl font-black text-yellow-300">{finalTimer}s</div>

                <div className="w-full max-w-2xl space-y-2">
                  <div className="text-yellow-400 text-sm uppercase tracking-widest mb-2 text-center">Judge each player</div>
                  {finalData.scores.map(p => (
                    <div key={p.name} className="flex items-center gap-3 bg-blue-900 border border-blue-700 rounded-xl px-4 py-3">
                      <div className="flex-1">
                        <span className="font-black text-white">{p.name}</span>
                        <span className="text-gray-400 text-sm ml-2">
                          wager: ${parseInt(finalWagers[p.name] || '0').toLocaleString()}
                        </span>
                      </div>
                      {finalJudged[p.name] === null ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleFinalJudge(p.name, true)}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-black rounded-lg text-sm">
                            ✓
                          </button>
                          <button onClick={() => handleFinalJudge(p.name, false)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-black rounded-lg text-sm">
                            ✗
                          </button>
                        </div>
                      ) : (
                        <span className={`font-black ${finalJudged[p.name] ? 'text-green-400' : 'text-red-400'}`}>
                          {finalJudged[p.name] ? '✓ Correct' : '✗ Wrong'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* GAME OVER / WINNER PODIUM */}
            {phase === 'gameover' && (
              <motion.div key="gameover" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center gap-8 p-8 overflow-y-auto">
                <div className="text-5xl font-black text-yellow-400 tracking-widest">FINAL SCORES</div>

                {/* Top 3 Podium */}
                {finalScores.length >= 1 && (
                  <div className="flex items-end gap-4 justify-center">
                    {/* Silver (2nd) */}
                    {finalScores[1] && (
                      <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
                        className={`flex flex-col items-center bg-gradient-to-b ${PODIUM_COLORS[1]} rounded-t-xl px-8 py-4`}
                        style={{ height: 160 }}>
                        <div className="text-4xl mb-1">{MEDALS[1]}</div>
                        <div className="text-white font-black text-base text-center">{finalScores[1].name}</div>
                        <div className="text-gray-200 font-bold text-sm">${finalScores[1].score.toLocaleString()}</div>
                      </motion.div>
                    )}
                    {/* Gold (1st) */}
                    <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                      className={`flex flex-col items-center bg-gradient-to-b ${PODIUM_COLORS[0]} rounded-t-xl px-8 py-4`}
                      style={{ height: 200 }}>
                      <div className="text-5xl mb-1">{MEDALS[0]}</div>
                      <div className="text-white font-black text-xl text-center">{finalScores[0].name}</div>
                      <div className="text-yellow-200 font-bold text-lg">${finalScores[0].score.toLocaleString()}</div>
                    </motion.div>
                    {/* Bronze (3rd) */}
                    {finalScores[2] && (
                      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}
                        className={`flex flex-col items-center bg-gradient-to-b ${PODIUM_COLORS[2]} rounded-t-xl px-8 py-4`}
                        style={{ height: 130 }}>
                        <div className="text-3xl mb-1">{MEDALS[2]}</div>
                        <div className="text-white font-black text-sm text-center">{finalScores[2].name}</div>
                        <div className="text-amber-200 font-bold text-xs">${finalScores[2].score.toLocaleString()}</div>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Rest of standings */}
                {finalScores.length > 3 && (
                  <div className="space-y-2 w-full max-w-md">
                    {finalScores.slice(3).map((p, i) => (
                      <motion.div key={p.name} initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.8 + i * 0.1 }}
                        className="flex items-center justify-between bg-blue-900 border border-blue-700 rounded-xl px-4 py-3">
                        <span className="text-gray-300 font-bold">{i + 4}. {p.name}</span>
                        <span className="text-yellow-400 font-black">${p.score.toLocaleString()}</span>
                      </motion.div>
                    ))}
                  </div>
                )}

                <button onClick={() => navigate('/admin')}
                  className="px-8 py-4 text-xl font-black rounded-xl text-black bg-yellow-400 hover:bg-yellow-300">
                  Back to Dashboard
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Score Sidebar */}
        {phase !== 'lobby' && phase !== 'gameover' && (
          <div className="w-52 bg-black border-l border-yellow-400 flex flex-col p-3 overflow-y-auto shrink-0">
            <div className="text-yellow-400 text-xs uppercase tracking-widest font-bold mb-3">Scores</div>
            {sortedScores.map(([name, score]) => (
              <div key={name} className="mb-2 py-2 border-b border-gray-800">
                <div className="flex items-center justify-between gap-1">
                  <div className="text-white text-sm font-bold truncate flex-1">{name}</div>
                  <button onClick={() => handleEditScore(name)}
                    className="text-gray-500 hover:text-yellow-400 text-xs ml-1 shrink-0" title="Edit score">
                    ✏️
                  </button>
                </div>
                {editingScore === name ? (
                  <div className="flex gap-1 mt-1">
                    <input
                      type="number"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEditScoreSubmit(name); if (e.key === 'Escape') setEditingScore(null); }}
                      className="w-full bg-gray-900 border border-yellow-400 rounded px-1 py-0.5 text-white text-sm font-bold"
                      autoFocus
                    />
                    <button onClick={() => handleEditScoreSubmit(name)}
                      className="text-green-400 text-xs font-bold">✓</button>
                  </div>
                ) : (
                  <div className={`font-black ${score < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {score < 0 ? '-' : ''}${Math.abs(score).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
