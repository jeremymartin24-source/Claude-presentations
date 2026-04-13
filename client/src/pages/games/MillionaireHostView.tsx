import ManualScorePanel from '../../components/games/ManualScorePanel';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface Question {
  text: string;
  options: string[];
  correctIndex: number;
}

interface PollResults {
  votes: Record<string, number>;
  percentages: Record<string, number>;
}

type Phase = 'lobby' | 'question' | 'confirm' | 'reveal' | 'winner' | 'gameover';
type Lifeline = '50-50' | 'poll' | 'phone';

const MONEY_LADDER = [
  '$100', '$200', '$300', '$500', '$1,000',
  '$2,000', '$4,000', '$8,000', '$16,000', '$32,000',
  '$64,000', '$125,000', '$250,000', '$500,000', '$1,000,000',
];
const SAFE_HAVENS = [4, 9];
const LABELS = ['A', 'B', 'C', 'D'];

export default function MillionaireHostView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pin, bankId, settings } = (location.state as { pin: string; bankId: string; settings: Record<string, unknown> }) || {};
  const noJoin = (settings as any)?.noJoin;
  const virtualPlayers: string[] = (settings as any)?.virtualPlayers ?? [];

  const [currentPlayer, setCurrentPlayer] = useState('');
  const [currentLevel, setCurrentLevel] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [lifelinesUsed, setLifelinesUsed] = useState<Set<Lifeline>>(new Set());
  const [eliminatedOptions, setEliminatedOptions] = useState<Set<number>>(new Set());
  const [pollResults, setPollResults] = useState<PollResults | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [revealedCorrect, setRevealedCorrect] = useState<boolean | null>(null);
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState<number | null>(null);
  const [phoneTimer, setPhoneTimer] = useState(30);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [players, setPlayers] = useState<{ name: string }[]>([]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('host_game', { pin, gameType: 'millionaire', bankId, settings });

    socket.on('player_joined', (data: { players: { name: string }[] }) => {
      setPlayers(data.players);
    });

    socket.on('question_reveal', (data: { question: Question; level: number; contestant: string; lifelines: any }) => {
      setQuestion(data.question);
      setCurrentLevel(data.level);
      setCurrentPlayer(data.contestant || currentPlayer);
      setSelectedAnswer(null);
      setEliminatedOptions(new Set());
      setPollResults(null);
      setRevealedCorrect(null);
      setCorrectAnswerIndex(null);
      setLifelinesUsed(new Set()); // reset per contestant
      setPhase('question');
    });

    socket.on('millionaire:poll_results', (data: PollResults) => {
      setPollResults(data);
    });

    socket.on('millionaire:reveal', (data: { correct: boolean; correctAnswer: number }) => {
      setRevealedCorrect(data.correct);
      setCorrectAnswerIndex(data.correctAnswer);
      setPhase('reveal');
    });

    socket.on('millionaire:contestant_selected', (data: { name: string }) => {
      setCurrentPlayer(data.name);
    });

    socket.on('millionaire:fifty_fifty', (data: { remaining: string[] }) => {
      if (!question) return;
      const toElim = question.options
        .map((opt, i) => ({ opt, i }))
        .filter(({ opt }) => !data.remaining.includes(opt))
        .map(({ i }) => i);
      setEliminatedOptions(new Set(toElim));
    });

    socket.on('millionaire:walked_away', () => {
      setPhase('gameover');
    });

    socket.on('game_over', (data: { won: boolean }) => {
      if (data.won) setPhase('winner');
      else setPhase('gameover');
    });

    return () => {
      socket.off('player_joined');
      socket.off('question_reveal');
      socket.off('millionaire:poll_results');
      socket.off('millionaire:reveal');
      socket.off('millionaire:contestant_selected');
      socket.off('millionaire:fifty_fifty');
      socket.off('millionaire:walked_away');
      socket.off('game_over');
    };
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (showPhoneModal && phoneTimer > 0) {
      interval = setInterval(() => setPhoneTimer(t => t - 1), 1000);
    } else if (phoneTimer === 0) {
      setShowPhoneModal(false);
      setPhoneTimer(30);
    }
    return () => clearInterval(interval);
  }, [showPhoneModal, phoneTimer]);

  const socket = getSocket();

  // Start game with specific contestant (no-devices: pick from virtual players)
  const handleStart = (playerName: string) => {
    setCurrentPlayer(playerName);
    socket.emit('millionaire:start', { pin, contestantName: playerName });
  };

  // Select an answer option (display only — triggers confirm phase)
  const handleSelectAnswer = (idx: number) => {
    if (eliminatedOptions.has(idx) || phase !== 'question') return;
    setSelectedAnswer(idx);
    setPhase('confirm');
  };

  // Confirm and submit the final answer
  const handleFinalAnswer = () => {
    if (selectedAnswer === null) return;
    if (noJoin) {
      // Host answers on behalf of contestant
      socket.emit('millionaire:host_answer', { pin, answerIndex: selectedAnswer });
    } else {
      socket.emit('millionaire:answer', { pin, answer: selectedAnswer });
    }
    setPhase('reveal');
  };

  const handleLifeline = (type: Lifeline) => {
    if (lifelinesUsed.has(type)) return;
    setLifelinesUsed(prev => new Set([...prev, type]));
    if (type === 'phone') { setShowPhoneModal(true); setPhoneTimer(30); }
    socket.emit('millionaire:lifeline', { pin, type });
  };

  const handleWalkAway = () => {
    socket.emit('millionaire:walk_away', { pin });
    setPhase('gameover');
  };

  // Switch contestant mid-game (no-devices)
  const handleSelectContestant = (name: string) => {
    socket.emit('millionaire:host_select_contestant', { pin, contestantName: name });
  };

  const getAnswerStyle = (idx: number) => {
    if (eliminatedOptions.has(idx)) return 'opacity-20 cursor-not-allowed bg-gray-900 border-gray-800';
    if (phase === 'reveal') {
      if (idx === correctAnswerIndex) return 'bg-green-700 border-green-400 text-white scale-105';
      if (idx === selectedAnswer && revealedCorrect === false) return 'bg-red-700 border-red-400 text-white';
      return 'bg-gray-900 border-gray-700';
    }
    if (selectedAnswer === idx) return 'bg-yellow-600 border-yellow-400 text-white scale-105';
    return 'bg-blue-950 border-blue-700 hover:bg-blue-800 hover:border-blue-500 cursor-pointer';
  };

  const allPlayers = noJoin ? virtualPlayers.map(name => ({ name })) : players;

  return (
    <div className="min-h-screen text-white flex flex-col"
      style={{ background: 'radial-gradient(ellipse at center, #0a0a2e 0%, #000000 70%)', fontFamily: 'Georgia, serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-black border-b border-yellow-800">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black" style={{ color: '#680001' }}>UNOH</span>
          <span className="text-yellow-400 font-bold tracking-wider">WHO WANTS TO BE A MILLIONAIRE?</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-black border border-yellow-700 rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-yellow-600 uppercase tracking-widest">PIN</div>
            <div className="text-2xl font-black text-white tracking-widest">{pin}</div>
          </div>
          <button onClick={() => navigate('/dashboard')}
            className="bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold">
            End Game
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col p-6">
          <AnimatePresence mode="wait">
            {/* LOBBY */}
            {phase === 'lobby' && (
              <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-8">
                <div className="text-6xl font-black text-yellow-400 text-center leading-tight">
                  WHO WANTS TO BE A<br />MILLIONAIRE?
                </div>
                {!noJoin && (
                  <div className="text-center">
                    <div className="text-gray-300 text-xl mb-2">Join at unoh.review — PIN:</div>
                    <div className="text-7xl font-black text-white tracking-widest">{pin}</div>
                  </div>
                )}
                <div className="text-xl text-gray-300">{allPlayers.length} player{allPlayers.length !== 1 ? 's' : ''} ready</div>
                {allPlayers.length > 0 ? (
                  <div className="flex flex-col gap-2 w-full max-w-sm">
                    <div className="text-gray-400 text-sm text-center mb-2">Select first contestant:</div>
                    {allPlayers.map(p => (
                      <button key={p.name} onClick={() => handleStart(p.name)}
                        className="w-full py-3 px-6 bg-blue-900 border-2 border-yellow-400 rounded-xl font-bold text-white text-lg hover:bg-blue-800 transition-all">
                        {p.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500">
                    {noJoin ? 'Add player names in Game Settings to begin.' : 'Waiting for players to join...'}
                  </div>
                )}
              </motion.div>
            )}

            {/* QUESTION / CONFIRM / REVEAL */}
            {(phase === 'question' || phase === 'confirm' || phase === 'reveal') && question && (
              <motion.div key="question" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="text-xl text-yellow-400 font-bold">🎯 {currentPlayer}</div>
                  <div className="text-2xl font-black text-yellow-400">{MONEY_LADDER[currentLevel]}</div>
                </div>

                <div className="bg-blue-950 border-2 border-blue-600 rounded-2xl p-6 relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #0f0f3d, #1a1a4e)' }}>
                  <div className="absolute inset-0 opacity-10"
                    style={{ background: 'radial-gradient(ellipse at center, #4444ff, transparent)' }} />
                  <div className="relative text-3xl font-bold text-white text-center leading-relaxed">
                    {question.text}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 flex-1">
                  {question.options.map((opt, i) => (
                    <motion.button key={i}
                      whileHover={!eliminatedOptions.has(i) && phase === 'question' ? { scale: 1.02 } : {}}
                      whileTap={!eliminatedOptions.has(i) && phase === 'question' ? { scale: 0.98 } : {}}
                      onClick={() => phase === 'question' && handleSelectAnswer(i)}
                      className={`border-2 rounded-xl p-4 flex items-center gap-4 transition-all ${getAnswerStyle(i)}`}>
                      <span className="text-2xl font-black text-yellow-400 w-8">{LABELS[i]}:</span>
                      <span className="text-xl font-bold text-white text-left">{opt}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Confirm */}
                {phase === 'confirm' && selectedAnswer !== null && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-yellow-900 border-2 border-yellow-400 rounded-xl p-4 flex items-center justify-between">
                    <div className="text-yellow-300 font-bold text-lg">
                      Final Answer: {LABELS[selectedAnswer]} — {question.options[selectedAnswer]}?
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setPhase('question')}
                        className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold">
                        Change
                      </button>
                      <button onClick={handleFinalAnswer}
                        className="px-5 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-black">
                        FINAL ANSWER!
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Reveal */}
                {phase === 'reveal' && (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className={`rounded-xl p-4 text-center text-3xl font-black
                      ${revealedCorrect ? 'bg-green-800 border-2 border-green-400 text-green-300' : 'bg-red-900 border-2 border-red-400 text-red-300'}`}>
                    {revealedCorrect ? '🎉 CORRECT! Advancing...' : '❌ Wrong! Game Over.'}
                  </motion.div>
                )}

                {/* Poll results */}
                {pollResults && question && (
                  <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                    <div className="text-gray-400 text-sm uppercase tracking-widest mb-3">📊 Poll the Class Results</div>
                    <div className="space-y-2">
                      {question.options.map((opt, i) => {
                        const pct = pollResults.percentages[opt] ?? 0;
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-yellow-400 font-bold w-6">{LABELS[i]}</span>
                            <div className="flex-1 bg-gray-700 rounded-full h-4 overflow-hidden">
                              <motion.div className="h-full bg-blue-500 rounded-full"
                                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, delay: i * 0.1 }} />
                            </div>
                            <span className="text-white font-bold w-10 text-right">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Lifelines + Walk Away */}
                <div className="flex gap-3 flex-wrap">
                  {(['50-50', 'poll', 'phone'] as Lifeline[]).map(ll => {
                    const used = lifelinesUsed.has(ll);
                    const labels: Record<Lifeline, string> = { '50-50': '50/50', poll: '📊 Poll Class', phone: '📞 Phone Friend' };
                    return (
                      <button key={ll} onClick={() => handleLifeline(ll)}
                        disabled={used || phase === 'reveal'}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all
                          ${used ? 'opacity-30 cursor-not-allowed bg-gray-800 text-gray-500' : 'bg-blue-800 hover:bg-blue-700 text-white border border-blue-500'}`}>
                        {labels[ll]}
                      </button>
                    );
                  })}
                  <button onClick={handleWalkAway} disabled={phase === 'reveal'}
                    className="ml-auto px-4 py-2 rounded-lg font-bold text-sm bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-30">
                    🚶 Walk Away ({MONEY_LADDER[Math.max(0, currentLevel - 1)]})
                  </button>
                </div>

                {/* No-devices: switch contestant */}
                {noJoin && allPlayers.length > 1 && (
                  <div className="border-t border-gray-800 pt-3 mt-2">
                    <div className="text-gray-500 text-xs uppercase tracking-widest mb-2">Switch Contestant</div>
                    <div className="flex flex-wrap gap-2">
                      {allPlayers.filter(p => p.name !== currentPlayer).map(p => (
                        <button key={p.name} onClick={() => handleSelectContestant(p.name)}
                          className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-bold">
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* WINNER */}
            {phase === 'winner' && (
              <motion.div key="winner" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center gap-6">
                <motion.div animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }} className="text-8xl">💰</motion.div>
                <div className="text-7xl font-black text-yellow-400">MILLIONAIRE!</div>
                <div className="text-5xl font-black text-white">{currentPlayer}</div>
                <div className="text-3xl text-yellow-300">wins $1,000,000!</div>
                <button onClick={() => navigate('/dashboard')}
                  className="px-8 py-4 text-xl font-black rounded-xl bg-gray-700 hover:bg-gray-600 text-white">
                  End Game
                </button>
              </motion.div>
            )}

            {/* GAME OVER */}
            {phase === 'gameover' && (
              <motion.div key="gameover" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center gap-6">
                <div className="text-5xl font-black text-red-400">GAME OVER</div>
                <div className="text-3xl text-white">{currentPlayer} leaves with {MONEY_LADDER[Math.max(0, currentLevel - 1)] || '$0'}</div>
                <button onClick={() => navigate('/dashboard')}
                  className="px-8 py-4 text-xl font-black rounded-xl bg-gray-700 hover:bg-gray-600 text-white">
                  Back to Dashboard
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Money Ladder */}
        <div className="w-48 bg-black border-l border-yellow-900 flex flex-col-reverse p-3 overflow-y-auto">
          {MONEY_LADDER.map((amt, i) => (
            <div key={i} className={`py-2 px-3 mb-1 rounded text-sm font-bold text-right transition-all
              ${i === currentLevel ? 'bg-yellow-500 text-black text-base' : ''}
              ${SAFE_HAVENS.includes(i) && i !== currentLevel ? 'text-yellow-400 border border-yellow-700' : ''}
              ${i < currentLevel ? 'text-green-400 bg-green-950' : ''}
              ${i > currentLevel && !SAFE_HAVENS.includes(i) ? 'text-gray-600' : ''}
            `}>
              {amt}
            </div>
          ))}
        </div>
      </div>

      {/* Phone-a-Friend Modal */}
      <AnimatePresence>
        {showPhoneModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              className="bg-gray-900 border-4 border-yellow-400 rounded-2xl p-10 text-center max-w-md">
              <div className="text-6xl mb-4">📞</div>
              <div className="text-3xl font-black text-white mb-2">Phone a Friend</div>
              <div className="text-xl text-gray-300 mb-6">Time remaining:</div>
              <div className="text-8xl font-black text-yellow-400 mb-6">{phoneTimer}</div>
              <button onClick={() => { setShowPhoneModal(false); setPhoneTimer(30); }}
                className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl">
                End Call
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {noJoin && <ManualScorePanel pin={pin} />}
    </div>
  );
}
