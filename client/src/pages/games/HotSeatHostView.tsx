import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface QueueQuestion {
  id: string;
  text: string;
  askedBy: string;
  votes: number;
}

interface Votes {
  up: number;
  down: number;
}

interface Player {
  name: string;
  score: number;
}

type Phase = 'lobby' | 'selecting' | 'asking' | 'voting' | 'awarding' | 'gameover';

export default function HotSeatHostView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pin, bankId, settings } = (location.state as { pin: string; bankId: string; settings: Record<string, unknown> }) || {};

  const [players, setPlayers] = useState<Player[]>([]);
  const [hotSeatStudent, setHotSeatStudent] = useState<string>('');
  const [questionQueue, setQuestionQueue] = useState<QueueQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QueueQuestion | null>(null);
  const [votes, setVotes] = useState<Votes>({ up: 0, down: 0 });
  const [phase, setPhase] = useState<Phase>('lobby');
  const [pointsToAward, setPointsToAward] = useState(50);
  const [scores, setScores] = useState<Player[]>([]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('host_game', { pin, gameType: 'hotseat', bankId, settings });

    socket.on('player_joined', (data: { players: Player[] }) => {
      setPlayers(data.players);
      setScores(data.players);
    });

    socket.on('hotseat:queue_updated', (data: { queue: QueueQuestion[] }) => {
      setQuestionQueue(data.queue);
    });

    socket.on('hotseat:vote_update', (data: { votes: Votes }) => {
      setVotes(data.votes);
    });

    socket.on('game_over', () => setPhase('gameover'));

    return () => {
      socket.off('player_joined');
      socket.off('hotseat:queue_updated');
      socket.off('hotseat:vote_update');
      socket.off('game_over');
    };
  }, []);

  const socket = getSocket();

  const handleStart = () => {
    setPhase('selecting');
  };

  const handleSelectStudent = (name: string) => {
    setHotSeatStudent(name);
    setCurrentQuestion(null);
    setVotes({ up: 0, down: 0 });
    setPhase('asking');
    socket.emit('hotseat:select_student', { pin, studentName: name });
  };

  const handleAskQuestion = (q: QueueQuestion) => {
    setCurrentQuestion(q);
    setVotes({ up: 0, down: 0 });
    setPhase('asking');
    socket.emit('hotseat:ask_question', { pin, questionId: q.id });
  };

  const handleOpenVoting = () => {
    setPhase('voting');
    socket.emit('hotseat:open_voting', { pin });
  };

  const handleAwardPoints = () => {
    socket.emit('hotseat:award_points', { pin, studentName: hotSeatStudent, points: pointsToAward });
    setScores((prev) => {
      const exists = prev.find((p) => p.name === hotSeatStudent);
      if (exists) return prev.map((p) => p.name === hotSeatStudent ? { ...p, score: p.score + pointsToAward } : p);
      return [...prev, { name: hotSeatStudent, score: pointsToAward }];
    });
    setPhase('selecting');
    setCurrentQuestion(null);
    setVotes({ up: 0, down: 0 });
  };

  const handlePickNew = () => {
    setPhase('selecting');
    setCurrentQuestion(null);
    setHotSeatStudent('');
    setVotes({ up: 0, down: 0 });
  };

  const handleEnd = () => {
    socket.emit('hotseat:end', { pin });
    navigate('/dashboard');
  };

  const totalVotes = votes.up + votes.down;
  const upPct = totalVotes > 0 ? Math.round((votes.up / totalVotes) * 100) : 50;
  const downPct = totalVotes > 0 ? Math.round((votes.down / totalVotes) * 100) : 50;
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-black border-b border-gray-800">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black" style={{ color: '#680001' }}>UNOH</span>
          <span className="text-orange-400 font-black text-lg">🔥 HOT SEAT</span>
        </div>
        <div className="flex items-center gap-4">
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
            <div className="text-6xl font-black text-orange-400">🔥 HOT SEAT</div>
            <div className="text-gray-300 text-lg text-center max-w-lg">
              One student sits in the Hot Seat and answers questions from the class.<br />
              The class votes thumbs up or down!
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-xl">Join at unoh.review — PIN:</div>
              <div className="text-7xl font-black text-white tracking-widest">{pin}</div>
            </div>
            <div className="text-xl text-white">{players.length} player{players.length !== 1 ? 's' : ''} joined</div>
            <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
              {players.map((p) => (
                <motion.span key={p.name} initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm">{p.name}</motion.span>
              ))}
            </div>
            <button onClick={handleStart} disabled={players.length === 0}
              className="px-12 py-5 text-2xl font-black rounded-2xl text-white disabled:opacity-50"
              style={{ backgroundColor: '#680001' }}>
              BEGIN 🔥
            </button>
          </motion.div>
        )}

        {/* SELECTING STUDENT */}
        {phase === 'selecting' && (
          <motion.div key="selecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <div className="text-4xl font-black text-orange-400">Pick a Student for the Hot Seat</div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-w-3xl w-full">
              {players.map((p) => (
                <motion.button key={p.name} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelectStudent(p.name)}
                  className="bg-gray-800 hover:bg-orange-800 border-2 border-gray-700 hover:border-orange-500 rounded-xl p-4 text-white font-bold transition-all">
                  {p.name}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ASKING + VOTING + AWARDING */}
        {(phase === 'asking' || phase === 'voting' || phase === 'awarding') && hotSeatStudent && (
          <motion.div key="hotseat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex gap-0 overflow-hidden">
            {/* Left: Question Queue */}
            <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col p-4 overflow-y-auto">
              <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">
                Question Queue ({questionQueue.length})
              </div>
              {questionQueue.length === 0 && (
                <div className="text-gray-600 text-sm">Students are submitting questions...</div>
              )}
              {[...questionQueue].sort((a, b) => b.votes - a.votes).map((q) => (
                <div key={q.id}
                  className={`mb-2 p-3 rounded-xl border cursor-pointer transition-all
                    ${currentQuestion?.id === q.id ? 'bg-orange-900 border-orange-500' : 'bg-gray-800 border-gray-700 hover:border-gray-500'}`}>
                  <div className="text-white text-sm font-bold mb-1 leading-snug">{q.text}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">— {q.askedBy}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">👍 {q.votes}</span>
                      <button onClick={() => handleAskQuestion(q)}
                        className="text-xs px-2 py-1 rounded bg-orange-700 hover:bg-orange-600 text-white font-bold">
                        Ask This
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Center: Hot Seat */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
              {/* Spotlight header */}
              <div className="text-center"
                style={{ background: 'radial-gradient(ellipse at top, #7c2d1230 0%, transparent 60%)' }}>
                <div className="text-2xl font-bold text-orange-400 mb-1">🔥 IN THE HOT SEAT</div>
                <motion.div
                  animate={{ textShadow: ['0 0 20px #f97316', '0 0 40px #f97316', '0 0 20px #f97316'] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-6xl font-black text-white">
                  {hotSeatStudent}
                </motion.div>
              </div>

              {/* Current question */}
              {currentQuestion ? (
                <div className="bg-gray-900 border-2 border-orange-500 rounded-2xl p-6 max-w-2xl w-full text-center">
                  <div className="text-gray-400 text-sm uppercase tracking-widest mb-2">Current Question</div>
                  <div className="text-3xl font-bold text-white">{currentQuestion.text}</div>
                  <div className="text-gray-500 text-sm mt-2">Asked by {currentQuestion.askedBy}</div>
                </div>
              ) : (
                <div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-6 max-w-2xl w-full text-center">
                  <div className="text-gray-500 text-xl">Select a question from the queue →</div>
                </div>
              )}

              {/* Voting Results */}
              {(phase === 'voting' || phase === 'awarding') && (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-2xl">
                  <div className="text-gray-400 text-sm uppercase tracking-widest mb-4 text-center">Class Vote</div>
                  <div className="flex gap-4 mb-4">
                    {/* Thumbs up */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-3xl">👍</span>
                        <span className="text-white font-black text-2xl">{votes.up}</span>
                        <span className="text-gray-400">({upPct}%)</span>
                      </div>
                      <div className="bg-gray-700 rounded-full h-5 overflow-hidden">
                        <motion.div className="h-full bg-green-500 rounded-full"
                          animate={{ width: `${upPct}%` }} transition={{ duration: 0.4 }} />
                      </div>
                    </div>
                    {/* Thumbs down */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-3xl">👎</span>
                        <span className="text-white font-black text-2xl">{votes.down}</span>
                        <span className="text-gray-400">({downPct}%)</span>
                      </div>
                      <div className="bg-gray-700 rounded-full h-5 overflow-hidden">
                        <motion.div className="h-full bg-red-500 rounded-full"
                          animate={{ width: `${downPct}%` }} transition={{ duration: 0.4 }} />
                      </div>
                    </div>
                  </div>
                  <div className="text-center text-gray-400 text-sm">{totalVotes} votes cast</div>
                </motion.div>
              )}

              {/* Award Points */}
              {phase === 'awarding' && (
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-full max-w-2xl">
                  <div className="text-gray-400 text-sm uppercase tracking-widest mb-3">Award Points to {hotSeatStudent}</div>
                  <div className="flex items-center gap-4">
                    <input type="range" min={0} max={100} step={5} value={pointsToAward}
                      onChange={(e) => setPointsToAward(Number(e.target.value))}
                      className="flex-1 accent-orange-500" />
                    <span className="text-white font-black text-3xl w-16 text-right">{pointsToAward}</span>
                    <span className="text-gray-400">pts</span>
                    <button onClick={handleAwardPoints}
                      className="px-6 py-3 font-black rounded-xl text-white bg-orange-600 hover:bg-orange-500 text-lg">
                      Award!
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Control buttons */}
              <div className="flex gap-3 flex-wrap justify-center">
                {phase === 'asking' && currentQuestion && (
                  <button onClick={handleOpenVoting}
                    className="px-6 py-3 font-black rounded-xl text-white bg-blue-700 hover:bg-blue-600 text-lg">
                    Open Voting 👍👎
                  </button>
                )}
                {phase === 'voting' && (
                  <button onClick={() => setPhase('awarding')}
                    className="px-6 py-3 font-black rounded-xl text-white text-lg"
                    style={{ backgroundColor: '#680001' }}>
                    Award Points →
                  </button>
                )}
                <button onClick={handlePickNew}
                  className="px-6 py-3 font-black rounded-xl text-white bg-gray-700 hover:bg-gray-600 text-lg">
                  Pick New Student 🔄
                </button>
              </div>
            </div>

            {/* Right: Scores */}
            <div className="w-52 bg-black border-l border-gray-800 flex flex-col p-3 overflow-y-auto">
              <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">Scores</div>
              {sortedScores.map((p, i) => (
                <div key={p.name} className={`mb-2 py-2 border-b border-gray-900 ${p.name === hotSeatStudent ? 'bg-orange-950 rounded px-2' : ''}`}>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500 text-xs w-4">{i + 1}.</span>
                    <span className="text-white text-sm font-bold truncate">{p.name}</span>
                    {p.name === hotSeatStudent && <span className="text-orange-400 text-xs">🔥</span>}
                  </div>
                  <div className="text-right font-black" style={{ color: '#680001' }}>{p.score} pts</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* GAME OVER */}
        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <div className="text-6xl font-black text-orange-400">🔥 GAME OVER!</div>
            <div className="w-full max-w-2xl space-y-3">
              {sortedScores.slice(0, 5).map((p, i) => {
                const max = sortedScores[0]?.score || 1;
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                return (
                  <motion.div key={p.name} initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-4 bg-gray-900 rounded-xl p-4">
                    <span className="text-3xl">{medals[i]}</span>
                    <div className="flex-1">
                      <div className="text-white font-bold text-lg">{p.name}</div>
                      <div className="bg-gray-700 rounded-full h-2 mt-1 overflow-hidden">
                        <motion.div className="h-full rounded-full bg-orange-500"
                          initial={{ width: 0 }} animate={{ width: `${(p.score / max) * 100}%` }}
                          transition={{ delay: i * 0.1 + 0.3, duration: 0.8 }} />
                      </div>
                    </div>
                    <span className="text-2xl font-black text-white">{p.score}</span>
                  </motion.div>
                );
              })}
            </div>
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
