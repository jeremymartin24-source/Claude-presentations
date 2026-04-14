import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

type Phase = 'lobby' | 'watching' | 'hotseat' | 'voting' | 'voted' | 'gameover';

export default function HotSeatStudentPage() {
  const navigate   = useNavigate();
  const playerName = localStorage.getItem('playerName') || 'Player';
  const gamePin    = localStorage.getItem('gamePin') || '';

  const [phase, setPhase]             = useState<Phase>('lobby');
  const [hotSeatPlayer, setHotSeat]   = useState('');
  const [currentQuestion, setCurrentQ] = useState('');
  const [askedBy, setAskedBy]         = useState('');
  const [myQuestion, setMyQuestion]   = useState('');
  const [submitted, setSubmitted]     = useState(false);
  const [votes, setVotes]             = useState<{ up: number; down: number }>({ up: 0, down: 0 });
  const [myVote, setMyVote]           = useState<'up' | 'down' | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [pointsAwarded, setPointsAwarded] = useState<{ name: string; points: number } | null>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on('hotseat:student_selected', ({ studentName }: any) => {
      setHotSeat(studentName);
      setCurrentQ('');
      setAskedBy('');
      setMyVote(null);
      setVotes({ up: 0, down: 0 });
      setPhase(studentName === playerName ? 'hotseat' : 'watching');
    });

    socket.on('hotseat:question_asked', ({ question, askedBy: ab }: any) => {
      setCurrentQ(question);
      setAskedBy(ab);
    });

    socket.on('hotseat:voting_open', () => {
      setMyVote(null);
      setVotes({ up: 0, down: 0 });
      setPhase('voting');
    });

    socket.on('hotseat:vote_update', ({ votes: v }: any) => {
      setVotes(v);
    });

    socket.on('hotseat:points_awarded', ({ studentName, points }: any) => {
      setPointsAwarded({ name: studentName, points });
      showNotification(`🏆 ${studentName} earned ${points} points!`);
      setTimeout(() => setPointsAwarded(null), 3000);
    });

    socket.on('game_over', ({ finalScores }: any) => {
      setLeaderboard(finalScores || []);
      setPhase('gameover');
    });

    return () => {
      socket.off('hotseat:student_selected');
      socket.off('hotseat:question_asked');
      socket.off('hotseat:voting_open');
      socket.off('hotseat:vote_update');
      socket.off('hotseat:points_awarded');
      socket.off('game_over');
    };
  }, [playerName]);

  function showNotification(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  }

  function submitQuestion() {
    if (!myQuestion.trim() || submitted) return;
    setSubmitted(true);
    getSocket().emit('hotseat:submit_question', { pin: gamePin, playerName, question: myQuestion.trim() });
    showNotification('Question submitted!');
    setMyQuestion('');
    setTimeout(() => setSubmitted(false), 5000);
  }

  function vote(v: 'up' | 'down') {
    if (myVote) return;
    setMyVote(v);
    getSocket().emit('hotseat:vote', { pin: gamePin, vote: v });
    setPhase('voted');
  }

  const totalVotes = votes.up + votes.down;
  const upPct   = totalVotes > 0 ? Math.round((votes.up / totalVotes) * 100) : 0;
  const downPct = totalVotes > 0 ? Math.round((votes.down / totalVotes) * 100) : 0;

  // Lobby
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-6">
        <div className="text-5xl mb-4">🔥</div>
        <h1 className="text-2xl font-bold text-white">Hot Seat</h1>
        <p className="text-gray-400 mt-2">Waiting for Professor Martin to start...</p>
        <div className="mt-4 text-unoh-red font-bold">{playerName}</div>
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
              <span className="text-gray-400">#{p.rank ?? i+1}</span>
              <span className="text-white">{p.name}</span>
              <span className="text-yellow-400 font-bold">{p.score?.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <button onClick={() => navigate('/')} className="mt-8 btn-secondary">Back to Home</button>
      </div>
    );
  }

  // You're in the hot seat
  if (phase === 'hotseat') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <AnimatePresence>
          {notification && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="fixed top-4 left-4 right-4 z-50 bg-unoh-red text-white font-bold text-center rounded-xl py-3 px-4">
              {notification}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
          <div className="text-6xl mb-3">🔥</div>
          <h1 className="text-3xl font-black text-unoh-red">YOU'RE IN THE HOT SEAT!</h1>
          <p className="text-gray-400 mt-2">The class is asking you questions</p>
        </motion.div>

        {currentQuestion && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="mt-6 w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-4">
            <p className="text-gray-500 text-xs mb-2">Question from {askedBy}:</p>
            <p className="text-white font-bold text-lg">{currentQuestion}</p>
          </motion.div>
        )}

        {!currentQuestion && (
          <p className="text-gray-600 mt-4 text-sm">Waiting for the professor to select a question...</p>
        )}
      </div>
    );
  }

  // Voting phase (thumbs up/down)
  if (phase === 'voting') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <AnimatePresence>
          {notification && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="fixed top-4 left-4 right-4 z-50 bg-unoh-red text-white font-bold text-center rounded-xl py-3 px-4">
              {notification}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-4xl mb-2">🗳️</div>
        <h2 className="text-xl font-bold text-white mb-1">Vote!</h2>
        <p className="text-gray-400 text-sm mb-1">
          Did <span className="text-yellow-400 font-bold">{hotSeatPlayer}</span> answer well?
        </p>
        {currentQuestion && <p className="text-gray-600 text-xs italic mb-6">"{currentQuestion}"</p>}

        <div className="flex gap-6 mt-2">
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => vote('up')}
            className="flex flex-col items-center gap-2 px-8 py-6 bg-green-900/40 border-2 border-green-600 rounded-2xl hover:bg-green-800/60 transition-colors">
            <span className="text-5xl">👍</span>
            <span className="text-green-400 font-bold text-lg">Yes!</span>
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => vote('down')}
            className="flex flex-col items-center gap-2 px-8 py-6 bg-red-900/40 border-2 border-red-700 rounded-2xl hover:bg-red-800/60 transition-colors">
            <span className="text-5xl">👎</span>
            <span className="text-red-400 font-bold text-lg">No</span>
          </motion.button>
        </div>
      </div>
    );
  }

  // After voting — show vote tally
  if (phase === 'voted') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <AnimatePresence>
          {notification && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="fixed top-4 left-4 right-4 z-50 bg-unoh-red text-white font-bold text-center rounded-xl py-3 px-4">
              {notification}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-4xl mb-3">{myVote === 'up' ? '👍' : '👎'}</div>
        <h2 className="text-xl font-bold text-white mb-4">Vote submitted!</h2>

        <div className="w-full max-w-xs space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-green-400">👍 Yes</span>
              <span className="text-green-400 font-bold">{upPct}%</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <motion.div className="h-full bg-green-600 rounded-full"
                initial={{ width: 0 }} animate={{ width: `${upPct}%` }} transition={{ duration: 0.5 }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-red-400">👎 No</span>
              <span className="text-red-400 font-bold">{downPct}%</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
              <motion.div className="h-full bg-red-600 rounded-full"
                initial={{ width: 0 }} animate={{ width: `${downPct}%` }} transition={{ duration: 0.5 }} />
            </div>
          </div>
          <p className="text-gray-600 text-xs">{totalVotes} vote{totalVotes !== 1 ? 's' : ''} total</p>
        </div>
      </div>
    );
  }

  // Watching phase — submit questions + see current question
  return (
    <div className="min-h-screen bg-black flex flex-col px-4 py-6">
      <AnimatePresence>
        {notification && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed top-4 left-4 right-4 z-50 bg-unoh-red text-white font-bold text-center rounded-xl py-3 px-4">
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hot seat player */}
      <div className="text-center mb-5">
        <div className="text-4xl mb-1">🔥</div>
        <p className="text-gray-400 text-sm">In the Hot Seat:</p>
        <p className="text-yellow-400 font-black text-2xl">{hotSeatPlayer}</p>
      </div>

      {/* Current question being asked */}
      {currentQuestion && (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 mb-5 text-center">
          <p className="text-gray-500 text-xs mb-1">Current question (from {askedBy}):</p>
          <p className="text-white font-medium">{currentQuestion}</p>
        </div>
      )}

      {/* Submit a question */}
      <div className="mt-auto">
        <p className="text-gray-400 text-sm mb-2 font-medium">Submit a question:</p>
        <div className="flex gap-2">
          <input
            className="flex-1 bg-gray-900 border-2 border-gray-700 focus:border-unoh-red rounded-xl px-4 py-3 text-white outline-none text-sm transition-colors"
            placeholder="Ask something..."
            value={myQuestion}
            onChange={e => setMyQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitQuestion()}
            maxLength={120}
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={submitQuestion}
            disabled={!myQuestion.trim() || submitted}
            className="btn-primary px-4 disabled:opacity-40 text-sm">
            Send
          </motion.button>
        </div>
        {submitted && <p className="text-gray-500 text-xs mt-1 text-center">Question sent!</p>}
      </div>
    </div>
  );
}
