/**
 * JeopardyDisplayView — projector/audience clean view.
 * Route: /game/jeopardy/display?pin=XXXX
 * No auth required, no controls.
 */
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface DisplayClue {
  points: number;
  used:   boolean;
}

interface Player {
  name:  string;
  score: number;
}

type DisplayPhase = 'waiting' | 'board' | 'clue' | 'daily_double' | 'answer_reveal' | 'final_wager' | 'final_question' | 'gameover';

export default function JeopardyDisplayView() {
  const [searchParams] = useSearchParams();
  const pin = searchParams.get('pin') ?? '';

  const [phase,      setPhase]      = useState<DisplayPhase>('waiting');
  const [round,      setRound]      = useState(1);
  const [categories, setCategories] = useState<string[]>([]);
  const [clueBoard,  setClueBoard]  = useState<DisplayClue[][]>([]);
  const [scores,     setScores]     = useState<Player[]>([]);

  // Active clue display
  const [activeCategory, setActiveCategory] = useState('');
  const [activePoints,   setActivePoints]   = useState(0);
  const [activeQuestion, setActiveQuestion] = useState('');
  const [revealAnswer,   setRevealAnswer]   = useState('');
  const [revealWinner,   setRevealWinner]   = useState<string | null>(null);

  // Daily Double
  const [ddCategory,     setDdCategory]     = useState('');

  // Final Jeopardy
  const [finalCategory,  setFinalCategory]  = useState('');
  const [finalQuestion,  setFinalQuestion]  = useState('');

  useEffect(() => {
    if (!pin) return;
    const socket = getSocket();
    socket.emit('jeopardy:join_display', { pin });

    // Full sanitized board (no answers, no DD flags)
    socket.on('jeopardy:display_board', (data: {
      categories: string[]; clues: DisplayClue[][]; round: number;
    }) => {
      setCategories(data.categories);
      setClueBoard(data.clues);
      setRound(data.round);
      setPhase('board');
    });

    // Clue revealed
    socket.on('clue_shown', (data: {
      category: string; question: string; points: number;
      categoryIndex: number; valueIndex: number;
    }) => {
      setActiveCategory(data.category);
      setActivePoints(data.points);
      setActiveQuestion(data.question);
      setRevealAnswer('');
      setRevealWinner(null);
      setPhase('clue');
    });

    // Daily Double overlay
    socket.on('jeopardy:daily_double', (data: {
      category: string; points: number;
      categoryIndex: number; valueIndex: number;
    }) => {
      setDdCategory(data.category);
      setActivePoints(data.points);
      setPhase('daily_double');
    });

    // Answer revealed (correct / timeout / skip)
    socket.on('jeopardy:answer_reveal', (data: {
      answer: string; playerName: string | null; correct: boolean;
    }) => {
      setRevealAnswer(data.answer);
      setRevealWinner(data.playerName);
      setPhase('answer_reveal');
      // Return to board after 4s
      setTimeout(() => setPhase('board'), 4000);
    });

    // Cell used — mark on local board
    socket.on('jeopardy:cell_used', (data: { categoryIndex: number; valueIndex: number }) => {
      setClueBoard(prev => prev.map((col, ci) =>
        ci === data.categoryIndex
          ? col.map((cell, vi) => vi === data.valueIndex ? { ...cell, used: true } : cell)
          : col
      ));
    });

    // Scores
    socket.on('leaderboard_update', (data: { scores: Player[] }) => {
      setScores(data.scores);
    });

    // Final Jeopardy start (wager phase — just show category)
    socket.on('jeopardy:final_start', (data: { category: string; scores: Player[] }) => {
      setFinalCategory(data.category);
      setScores(data.scores);
      setPhase('final_wager');
    });

    // Final question reveal
    socket.on('jeopardy:final_question_display', (data: { question: string; category: string }) => {
      setFinalQuestion(data.question);
      setFinalCategory(data.category);
      setPhase('final_question');
    });

    // Game over
    socket.on('game_over', (data: { scores?: Player[] }) => {
      if (data?.scores) setScores(data.scores);
      setPhase('gameover');
    });

    return () => {
      socket.off('jeopardy:display_board');
      socket.off('clue_shown');
      socket.off('jeopardy:daily_double');
      socket.off('jeopardy:answer_reveal');
      socket.off('jeopardy:cell_used');
      socket.off('leaderboard_update');
      socket.off('jeopardy:final_start');
      socket.off('jeopardy:final_question_display');
      socket.off('game_over');
    };
  }, [pin]);

  const POINT_VALUES = round === 1
    ? [100, 200, 300, 400, 500]
    : [200, 400, 600, 800, 1000];

  return (
    <div className="min-h-screen bg-blue-950 text-white flex flex-col" style={{ fontFamily: 'Georgia, serif' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-8 py-3 bg-black border-b-2 border-yellow-400">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black" style={{ color: '#680001' }}>UNOH</span>
          <span className="text-yellow-400 text-2xl font-black tracking-widest">
            JEOPARDY!{round === 2 ? ' — DOUBLE JEOPARDY' : ''}
          </span>
        </div>
        {pin && (
          <div className="bg-black border border-yellow-400 rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-yellow-400 uppercase tracking-widest">PIN</div>
            <div className="text-2xl font-black tracking-widest">{pin}</div>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">

            {/* WAITING */}
            {phase === 'waiting' && (
              <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-6">
                <div className="text-7xl font-black text-yellow-400 tracking-widest">JEOPARDY!</div>
                {pin && (
                  <div className="text-center">
                    <div className="text-gray-400 text-xl">Game PIN</div>
                    <div className="text-6xl font-black text-white tracking-widest">{pin}</div>
                  </div>
                )}
                <div className="text-gray-400 text-lg">Waiting for host to start...</div>
              </motion.div>
            )}

            {/* BOARD */}
            {phase === 'board' && (
              <motion.div key="board" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 p-4">
                <div className="grid gap-2 h-full"
                  style={{ gridTemplateColumns: `repeat(${Math.max(categories.length, 5)}, 1fr)` }}>
                  {/* Category headers */}
                  {categories.map((cat, ci) => (
                    <div key={ci}
                      className="bg-blue-800 border-2 border-blue-600 rounded-lg p-3 flex items-center justify-center text-center min-h-16">
                      <span className="font-black text-white text-sm uppercase tracking-wide leading-tight">{cat}</span>
                    </div>
                  ))}
                  {/* Clue cells */}
                  {POINT_VALUES.map((pts, vi) =>
                    categories.map((_, ci) => {
                      const cell = clueBoard[ci]?.[vi];
                      const used = cell?.used ?? false;
                      return (
                        <div key={`${ci}-${vi}`}
                          className={`border-2 rounded-lg flex items-center justify-center min-h-20 font-black text-2xl
                            ${used
                              ? 'bg-blue-950 border-blue-900 text-blue-900'
                              : 'bg-blue-700 border-blue-500 text-yellow-400'
                            }`}>
                          {used ? '' : `$${pts}`}
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* DAILY DOUBLE */}
            {phase === 'daily_double' && (
              <motion.div key="dd"
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="flex-1 flex flex-col items-center justify-center gap-6">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                  className="text-8xl font-black text-yellow-400 tracking-widest drop-shadow-lg">
                  DAILY DOUBLE!
                </motion.div>
                <div className="text-3xl text-white font-bold">{ddCategory}</div>
              </motion.div>
            )}

            {/* CLUE */}
            {phase === 'clue' && (
              <motion.div key="clue"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center p-12 gap-6">
                <div className="text-yellow-400 text-2xl font-bold uppercase tracking-widest">
                  {activeCategory} — ${activePoints}
                </div>
                <div className="bg-blue-800 border-4 border-yellow-400 rounded-2xl p-12 max-w-5xl w-full text-center">
                  <div className="text-5xl font-bold text-white leading-relaxed">{activeQuestion}</div>
                </div>
              </motion.div>
            )}

            {/* ANSWER REVEAL */}
            {phase === 'answer_reveal' && (
              <motion.div key="answer"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center p-12 gap-6">
                <div className="text-yellow-400 text-2xl font-bold uppercase tracking-widest">
                  {activeCategory} — ${activePoints}
                </div>
                <div className="bg-blue-800 border-4 border-yellow-400 rounded-2xl p-10 max-w-4xl w-full text-center">
                  <div className="text-4xl font-bold text-white leading-relaxed">{activeQuestion}</div>
                </div>
                <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                  className="bg-green-900 border-4 border-green-400 rounded-2xl p-8 max-w-3xl w-full text-center">
                  <div className="text-green-300 text-sm uppercase tracking-widest mb-2">Answer</div>
                  <div className="text-4xl font-black text-white">{revealAnswer}</div>
                  {revealWinner && (
                    <div className="mt-3 text-yellow-400 text-xl font-bold">+${activePoints} → {revealWinner}</div>
                  )}
                </motion.div>
              </motion.div>
            )}

            {/* FINAL JEOPARDY — wager phase */}
            {phase === 'final_wager' && (
              <motion.div key="final_wager" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-8">
                <div className="text-7xl font-black text-yellow-400 tracking-widest">FINAL JEOPARDY!</div>
                <div className="text-3xl text-white font-bold">Category: {finalCategory}</div>
                <div className="text-gray-400 text-xl animate-pulse">Place your wagers...</div>
              </motion.div>
            )}

            {/* FINAL JEOPARDY — question */}
            {phase === 'final_question' && (
              <motion.div key="final_question" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center p-12 gap-6">
                <div className="text-4xl font-black text-yellow-400">FINAL JEOPARDY!</div>
                <div className="text-2xl text-white font-bold mb-2">{finalCategory}</div>
                <div className="bg-blue-800 border-4 border-yellow-400 rounded-2xl p-12 max-w-5xl w-full text-center">
                  <div className="text-5xl font-bold text-white leading-relaxed">{finalQuestion}</div>
                </div>
              </motion.div>
            )}

            {/* GAME OVER */}
            {phase === 'gameover' && (
              <motion.div key="gameover" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
                <div className="text-6xl font-black text-yellow-400 tracking-widest">FINAL SCORES</div>
                <div className="space-y-3 w-full max-w-xl">
                  {scores.slice(0, 6).map((p, i) => (
                    <motion.div key={p.name}
                      initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.15 }}
                      className="flex items-center justify-between bg-blue-800 border border-yellow-400 rounded-xl p-5">
                      <span className="text-3xl font-black text-white">
                        {i < 3 ? ['🥇','🥈','🥉'][i] : `${i+1}.`} {p.name}
                      </span>
                      <span className={`text-3xl font-black ${p.score < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {p.score < 0 ? '-' : ''}${Math.abs(p.score).toLocaleString()}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Scores sidebar — always visible once game starts */}
        {phase !== 'waiting' && scores.length > 0 && (
          <div className="w-56 bg-black border-l-2 border-yellow-400 flex flex-col p-4 overflow-y-auto shrink-0">
            <div className="text-yellow-400 text-xs uppercase tracking-widest font-bold mb-4">Scores</div>
            {scores.map((p, i) => (
              <div key={p.name} className="mb-3 pb-3 border-b border-gray-800">
                <div className="flex items-center gap-1">
                  {i < 3 && <span className="text-sm">{['🥇','🥈','🥉'][i]}</span>}
                  <div className="text-white font-bold text-sm truncate">{p.name}</div>
                </div>
                <div className={`font-black text-lg ${p.score < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                  {p.score < 0 ? '-' : ''}${Math.abs(p.score).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
