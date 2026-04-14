import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

type Phase = 'lobby' | 'question' | 'result' | 'leaderboard' | 'gameover';

interface RankedQuestion {
  index: number;
  total: number;
  question: string;
  items: string[];
  timeLimit: number;
  points: number;
  category?: string;
  hint?: string;
}

interface RankedResult {
  earned: number;
  newScore: number;
  correctOrder: string[];
  yourOrder: string[];
}

export default function RankedStudentPage() {
  const navigate  = useNavigate();
  const playerName = localStorage.getItem('playerName') || 'Player';
  const gamePin    = localStorage.getItem('gamePin') || '';

  const [phase, setPhase]         = useState<Phase>('lobby');
  const [question, setQuestion]   = useState<RankedQuestion | null>(null);
  const [items, setItems]         = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult]       = useState<RankedResult | null>(null);
  const [timeLeft, setTimeLeft]   = useState(0);
  const [score, setScore]         = useState(0);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    const socket = getSocket();

    socket.on('game_starting', () => setPhase('question'));

    socket.on('ranked_question', (q: RankedQuestion) => {
      setQuestion(q);
      setItems([...q.items]);
      setSubmitted(false);
      setResult(null);
      setTimeLeft(q.timeLimit);
      setPhase('question');
    });

    socket.on('ranked_result', (r: RankedResult) => {
      setResult(r);
      setScore(r.newScore);
      setPhase('result');
    });

    socket.on('ranked_answer', ({ correctOrder, leaderboard: lb }: any) => {
      // Show correct answer if no individual result yet (timer expired case)
      setResult(prev => prev ? { ...prev, correctOrder } : {
        earned: 0, newScore: score, correctOrder, yourOrder: items,
      });
      setLeaderboard(lb || []);
      setPhase('result');
    });

    socket.on('leaderboard_update', ({ leaderboard: lb }: any) => {
      setLeaderboard(lb || []);
      setPhase('leaderboard');
    });

    socket.on('timer_tick', ({ timeLeft: t }: any) => setTimeLeft(t));

    socket.on('game_over', ({ leaderboard: lb }: any) => {
      setLeaderboard(lb || []);
      setPhase('gameover');
      navigate('/student/leaderboard', { state: { scores: lb, playerName } });
    });

    const timer = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);

    return () => {
      socket.off('game_starting');
      socket.off('ranked_question');
      socket.off('ranked_result');
      socket.off('ranked_answer');
      socket.off('leaderboard_update');
      socket.off('timer_tick');
      socket.off('game_over');
      clearInterval(timer);
    };
  }, [playerName, score, items]);

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const next = [...items];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    setItems(next);
  }

  function submitOrder() {
    if (submitted || !question) return;
    setSubmitted(true);
    getSocket().emit('ranked_submit', { pin: gamePin, ordering: items });
  }

  // Lobby
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-6">
        <div className="text-5xl mb-4">📊</div>
        <h1 className="text-2xl font-bold text-white">Ranked Order</h1>
        <p className="text-gray-400 mt-2">Waiting for Professor Martin to start...</p>
        <div className="mt-4 text-unoh-red font-bold">{playerName}</div>
      </div>
    );
  }

  // Leaderboard between questions
  if (phase === 'leaderboard') {
    const myRank = leaderboard.findIndex(e => e.name === playerName) + 1;
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Standings</h2>
        {myRank > 0 && <p className="text-unoh-red font-bold mb-4">You're #{myRank}</p>}
        <div className="space-y-2 w-full max-w-xs">
          {leaderboard.slice(0, 5).map((e: any, i: number) => (
            <div key={e.name} className={`flex justify-between px-4 py-3 rounded-xl ${e.name === playerName ? 'bg-unoh-red/20 border border-unoh-red' : 'bg-gray-900'}`}>
              <span className="text-gray-400">#{i+1}</span>
              <span className="text-white">{e.name}</span>
              <span className="text-unoh-red font-bold">{e.score?.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <p className="text-gray-500 mt-6 text-sm">Next question coming up...</p>
      </div>
    );
  }

  // Result phase
  if (phase === 'result' && result) {
    const perfect = result.earned > 0 && result.earned === (question?.points ?? 100);
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-7xl mb-4 text-center">
          {perfect ? '🎯' : result.earned > 0 ? '✅' : '❌'}
        </motion.div>
        <h2 className={`text-2xl font-bold text-center ${perfect ? 'text-yellow-400' : result.earned > 0 ? 'text-green-400' : 'text-red-400'}`}>
          {perfect ? 'Perfect Order!' : result.earned > 0 ? `Partial Credit` : 'Incorrect Order'}
        </h2>
        {result.earned > 0 && (
          <p className="text-yellow-400 font-bold text-xl mt-1">+{result.earned.toLocaleString()} pts</p>
        )}
        <p className="text-gray-500 mt-1 text-sm">Total: {result.newScore.toLocaleString()}</p>

        <div className="mt-6 w-full max-w-sm">
          <p className="text-gray-400 text-xs uppercase tracking-widest mb-2">Correct Order</p>
          {result.correctOrder.map((item, i) => {
            const wasCorrect = result.yourOrder[i]?.trim().toLowerCase() === item.trim().toLowerCase();
            return (
              <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1.5 ${wasCorrect ? 'bg-green-900/40 border border-green-700' : 'bg-red-900/20 border border-red-800'}`}>
                <span className="text-gray-500 text-sm w-5 font-mono">{i+1}.</span>
                <span className="text-white text-sm flex-1">{item}</span>
                <span>{wasCorrect ? '✓' : '✗'}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Question phase (drag-and-drop)
  if (phase === 'question' && question) {
    return (
      <div className="min-h-screen bg-black flex flex-col px-4 py-5">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-gray-500 text-sm">{question.index + 1}/{question.total}</span>
          <span className={`font-mono text-xl font-bold ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-white'}`}>
            {timeLeft}s
          </span>
          <span className="text-unoh-red font-bold text-sm">{score.toLocaleString()}</span>
        </div>

        {/* Question */}
        <div className="bg-gray-900 rounded-2xl px-4 py-4 mb-4 text-center">
          {question.category && <p className="text-unoh-red text-xs uppercase tracking-widest mb-1">{question.category}</p>}
          <p className="text-white font-bold text-base leading-snug">{question.question}</p>
          {question.hint && <p className="text-gray-500 text-xs mt-2 italic">{question.hint}</p>}
        </div>

        <p className="text-gray-400 text-xs text-center mb-3">Drag to put in the correct order ↕</p>

        {/* Drag list */}
        {submitted ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">⏳</div>
              <p className="text-gray-400">Order submitted! Waiting...</p>
            </div>
          </div>
        ) : (
          <>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="ranked-list">
                {provided => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 space-y-2">
                    {items.map((item, index) => (
                      <Draggable key={item} draggableId={item} index={index}>
                        {(prov, snapshot) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            className={`flex items-center gap-3 bg-gray-800 border-2 rounded-xl px-4 py-3.5 text-white font-medium transition-all
                              ${snapshot.isDragging ? 'border-unoh-red shadow-lg shadow-unoh-red/20 scale-105' : 'border-gray-700'}`}>
                            <span className="text-gray-500 text-lg select-none">⠿</span>
                            <span className="text-gray-400 font-mono text-sm w-5">{index + 1}.</span>
                            <span className="flex-1 text-sm">{item}</span>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={submitOrder}
              className="mt-4 w-full btn-primary text-lg py-4 rounded-2xl">
              Lock In Order 🔒
            </motion.button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-gray-500">Waiting for game...</p>
    </div>
  );
}
