import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

type Phase = 'lobby' | 'playing' | 'gameover';

export default function BingoStudentPage() {
  const navigate = useNavigate();
  const playerName = localStorage.getItem('playerName') || 'Player';
  const gamePin    = localStorage.getItem('gamePin') || '';

  const [phase, setPhase]             = useState<Phase>('lobby');
  const [card, setCard]               = useState<string[][]>([]);
  const [marked, setMarked]           = useState<boolean[]>(Array(25).fill(false));
  const [calledTerms, setCalledTerms] = useState<string[]>([]);
  const [currentCall, setCurrentCall] = useState<{ definition: string; term: string; callNumber: number } | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [winner, setWinner]           = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [bingoSent, setBingoSent]     = useState(false);
  const [pendingMark, setPendingMark] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on('bingo_game_started', () => setPhase('playing'));

    socket.on('bingo_card', ({ card: c }: { card: string[][], freeSpace: { row: number; col: number } }) => {
      setCard(c);
      // Center (index 12) is always FREE and pre-marked
      const m = Array(25).fill(false);
      m[12] = true;
      setMarked(m);
      setPhase('playing');
    });

    socket.on('bingo_called', ({ definition, term, callNumber, calledSoFar }: any) => {
      setCurrentCall({ definition, term, callNumber });
      setCalledTerms(calledSoFar);
      setBingoSent(false);
      // Auto-mark the term on the card
      setCard(prev => {
        if (!prev.length) return prev;
        const flat = prev.flat();
        const idx = flat.indexOf(term);
        if (idx >= 0) {
          setMarked(m => {
            const next = [...m];
            next[idx] = true;
            return next;
          });
        }
        return prev;
      });
    });

    socket.on('bingo_mark_confirmed', ({ term, marked: m }: { term: string; marked: boolean[] }) => {
      setMarked(m);
      setPendingMark(null);
    });

    socket.on('bingo_mark_rejected', ({ reason }: { reason: string }) => {
      setPendingMark(null);
      showNotification(`Not yet called: ${reason}`);
    });

    socket.on('bingo_winner', ({ playerName: winner, message }: any) => {
      showNotification(message);
      setWinner(winner);
    });

    socket.on('bingo_blackout', ({ playerName: winner, message, leaderboard: lb }: any) => {
      showNotification(message);
      setWinner(winner);
      setLeaderboard(lb);
    });

    socket.on('bingo_false_alarm', ({ playerName: p }: any) => {
      if (p === playerName) showNotification('❌ Invalid BINGO — check your card!');
    });

    socket.on('bingo_invalid', ({ message }: any) => {
      showNotification(message);
    });

    socket.on('bingo_all_called', () => showNotification('All terms have been called!'));

    socket.on('game_over', ({ leaderboard: lb }: any) => {
      setLeaderboard(lb || []);
      setPhase('gameover');
    });

    return () => {
      socket.off('bingo_game_started');
      socket.off('bingo_card');
      socket.off('bingo_called');
      socket.off('bingo_mark_confirmed');
      socket.off('bingo_mark_rejected');
      socket.off('bingo_winner');
      socket.off('bingo_blackout');
      socket.off('bingo_false_alarm');
      socket.off('bingo_invalid');
      socket.off('bingo_all_called');
      socket.off('game_over');
    };
  }, [playerName]);

  function showNotification(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  }

  function toggleMark(rowIdx: number, colIdx: number) {
    if (phase !== 'playing') return;
    const flat = card.flat();
    const idx  = rowIdx * 5 + colIdx;
    const term = flat[idx];
    if (term === 'FREE') return;

    // Only allow marking called terms
    if (!calledTerms.includes(term)) {
      showNotification(`"${term}" hasn't been called yet!`);
      return;
    }

    setPendingMark(term);
    getSocket().emit('bingo_mark', { pin: gamePin, term });
  }

  function callBingo() {
    if (bingoSent) return;
    setBingoSent(true);
    getSocket().emit('call_bingo', { pin: gamePin });
  }

  const hasPotentialBingo = (() => {
    if (!marked.length) return false;
    const S = 5;
    const idx = (r: number, c: number) => r * S + c;
    for (let i = 0; i < S; i++) {
      if ([0,1,2,3,4].every(c => marked[idx(i,c)])) return true;
      if ([0,1,2,3,4].every(r => marked[idx(r,i)])) return true;
    }
    if ([0,1,2,3,4].every(i => marked[idx(i,i)])) return true;
    if ([0,1,2,3,4].every(i => marked[idx(i, S-1-i)])) return true;
    return false;
  })();

  // Lobby
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🎱</div>
        <h1 className="text-2xl font-bold text-white">Bingo!</h1>
        <p className="text-gray-400 mt-2">Waiting for Professor Martin to start...</p>
        <div className="mt-4 text-unoh-red font-bold">{playerName}</div>
        <div className="mt-2 text-gray-600 text-sm">PIN: {gamePin}</div>
      </div>
    );
  }

  // Game Over
  if (phase === 'gameover') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🏆</div>
        <h1 className="text-2xl font-bold text-white mb-6">Game Over!</h1>
        <div className="space-y-2 w-full max-w-xs">
          {leaderboard.slice(0, 5).map((p: any, i: number) => (
            <div key={p.name} className={`flex justify-between px-4 py-3 rounded-xl ${p.name === playerName ? 'bg-unoh-red/20 border border-unoh-red' : 'bg-gray-900'}`}>
              <span className="text-gray-400">#{i+1}</span>
              <span className="text-white">{p.name}</span>
              <span className="text-yellow-400 font-bold">{p.score?.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <button onClick={() => navigate('/')} className="mt-8 btn-secondary">Back to Home</button>
      </div>
    );
  }

  // Playing - no card yet
  if (!card.length) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-gray-500">Receiving your bingo card...</p>
      </div>
    );
  }

  const COLS = ['B', 'I', 'N', 'G', 'O'];

  return (
    <div className="min-h-screen bg-black flex flex-col items-center px-3 py-4">

      {/* Notification overlay */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
            className="fixed top-4 left-4 right-4 z-50 bg-unoh-red text-white font-bold text-center rounded-xl py-3 px-4 shadow-lg">
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current call banner */}
      {currentCall && (
        <div className="w-full max-w-sm mb-3 bg-gray-900 rounded-2xl px-4 py-3 text-center border border-gray-700">
          <div className="text-gray-500 text-xs mb-1">CALL #{currentCall.callNumber}</div>
          <div className="text-white text-sm leading-snug">{currentCall.definition}</div>
          <div className="text-unoh-red font-black text-xl mt-1 uppercase tracking-wide">{currentCall.term}</div>
        </div>
      )}

      {/* Bingo card */}
      <div className="w-full max-w-sm">
        {/* Column headers */}
        <div className="grid grid-cols-5 gap-1 mb-1">
          {COLS.map(c => (
            <div key={c} className="text-center font-black text-unoh-red text-xl">{c}</div>
          ))}
        </div>

        {/* Grid */}
        {card.map((row, rIdx) => (
          <div key={rIdx} className="grid grid-cols-5 gap-1 mb-1">
            {row.map((cell, cIdx) => {
              const isMarked  = marked[rIdx * 5 + cIdx];
              const isFree    = cell === 'FREE';
              const isCalled  = calledTerms.includes(cell) || isFree;
              const isPending = pendingMark === cell;

              return (
                <motion.button
                  key={cIdx}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => toggleMark(rIdx, cIdx)}
                  className={`
                    aspect-square rounded-lg flex items-center justify-center text-center p-1
                    text-xs font-bold leading-tight transition-all border-2
                    ${isFree ? 'bg-unoh-red border-red-400 text-white' :
                      isMarked ? 'bg-green-700 border-green-400 text-white' :
                      isCalled ? 'bg-gray-700 border-gray-500 text-white cursor-pointer hover:border-green-500' :
                      'bg-gray-900 border-gray-800 text-gray-500 cursor-not-allowed'}
                    ${isPending ? 'opacity-60' : ''}
                  `}>
                  {isFree ? (
                    <span className="text-lg">⭐</span>
                  ) : (
                    <span className="text-[10px] leading-tight">{cell}</span>
                  )}
                  {isMarked && !isFree && (
                    <span className="absolute text-lg pointer-events-none">✓</span>
                  )}
                </motion.button>
              );
            })}
          </div>
        ))}
      </div>

      {/* BINGO button */}
      <AnimatePresence>
        {hasPotentialBingo && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileTap={{ scale: 0.95 }}
            onClick={callBingo}
            disabled={bingoSent}
            className="mt-4 w-full max-w-sm bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black font-black text-3xl py-5 rounded-2xl shadow-lg shadow-yellow-500/30 tracking-widest">
            🎱 BINGO!
          </motion.button>
        )}
      </AnimatePresence>

      {/* Called count */}
      <div className="mt-4 text-gray-600 text-xs">
        {calledTerms.length} term{calledTerms.length !== 1 ? 's' : ''} called · {playerName}
      </div>

      {/* Blackout progress */}
      <div className="mt-2 w-full max-w-sm">
        <div className="flex justify-between text-gray-600 text-xs mb-1">
          <span>Card progress</span>
          <span>{marked.filter(Boolean).length}/25</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-unoh-red rounded-full transition-all"
            style={{ width: `${(marked.filter(Boolean).length / 25) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
