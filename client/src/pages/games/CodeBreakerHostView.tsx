import ManualScorePanel from '../../components/games/ManualScorePanel';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface Question {
  text: string;
  options: string[];
  correctIndex: number;
  index: number;
  total: number;
}

interface Player {
  name: string;
  score: number;
}

type Phase = 'setup' | 'lobby' | 'question' | 'gameover';

function buildMasked(phrase: string, revealed: Set<number>): string[] {
  return phrase.split('').map((ch, i) => {
    if (ch === ' ') return ' ';
    if (revealed.has(i)) return ch;
    return '_';
  });
}

export default function CodeBreakerHostView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pin, bankId, settings } = (location.state as { pin: string; bankId: string; settings: Record<string, unknown> }) || {};
  const noJoin = (settings as any)?.noJoin;

  const [phase, setPhase] = useState<Phase>('setup');
  const [secretPhrase, setSecretPhrase] = useState('');
  const [phraseInput, setPhraseInput] = useState('');
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [scores, setScores] = useState<Player[]>([]);
  const [solvedBy, setSolvedBy] = useState<string | null>(null);
  const [guessModalOpen, setGuessModalOpen] = useState(false);
  const [guessTeam, setGuessTeam] = useState('');
  const [guessText, setGuessText] = useState('');
  const [newReveal, setNewReveal] = useState<{ index: number; letter: string } | null>(null);
  const [phraseSolved, setPhraseSolved] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('host_game', { pin, gameType: 'codebreaker', bankId, settings });

    socket.on('player_joined', (data: { players: Player[] }) => {
      setPlayers(data.players);
      setScores(data.players);
    });

    socket.on('question_reveal', (data: Question) => {
      setCurrentQuestion(data);
      setPhase('question');
    });

    socket.on('codebreaker:letter_revealed', (data: { index: number; letter: string; masked: string }) => {
      setRevealedIndices((prev) => new Set([...prev, data.index]));
      setNewReveal({ index: data.index, letter: data.letter });
      setTimeout(() => setNewReveal(null), 1500);
    });

    socket.on('codebreaker:phrase_solved', (data: { phrase: string; solvedBy: string }) => {
      setSolvedBy(data.solvedBy);
      setPhraseSolved(true);
      setRevealedIndices(new Set(data.phrase.split('').map((_, i) => i)));
      setPhase('gameover');
    });

    socket.on('game_over', () => setPhase('gameover'));

    socket.on('scores_update', (data: { scores: Player[] }) => {
      setScores(data.scores);
    });

    return () => {
      socket.off('player_joined');
      socket.off('question_reveal');
      socket.off('codebreaker:letter_revealed');
      socket.off('codebreaker:phrase_solved');
      socket.off('game_over');
      socket.off('scores_update');
    };
  }, []);

  const socket = getSocket();

  const handleSetPhrase = () => {
    if (!phraseInput.trim()) return;
    const phrase = phraseInput.toUpperCase().trim();
    setSecretPhrase(phrase);
    setRevealedIndices(new Set());
    setSolvedBy(null);
    setPhraseSolved(false);
    setPhase('lobby');
  };

  const handleStart = () => {
    socket.emit('codebreaker:start', { pin, phrase: secretPhrase });
    setPhase('question');
  };

  const handleNext = () => socket.emit('codebreaker:next', { pin });

  const handleHostCorrect = (playerName: string) => {
    socket.emit('codebreaker:host_correct', { pin, playerName });
  };

  const handleGuessSubmit = (correct: boolean) => {
    socket.emit('codebreaker:guess_phrase', { pin, teamName: guessTeam, guess: guessText, correct });
    if (correct) {
      setSolvedBy(guessTeam);
      setPhraseSolved(true);
      setRevealedIndices(new Set(secretPhrase.split('').map((_, i) => i)));
    }
    setGuessModalOpen(false);
    setGuessTeam('');
    setGuessText('');
    if (correct) setPhase('gameover');
  };

  const handleEnd = () => {
    socket.emit('codebreaker:end', { pin });
    navigate('/dashboard');
  };

  const maskedDisplay = secretPhrase ? buildMasked(secretPhrase, revealedIndices) : [];
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);
  const revealedCount = maskedDisplay.filter((ch) => ch !== '_' && ch !== ' ').length;
  const totalLetters = maskedDisplay.filter((ch) => ch !== ' ').length;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-black border-b border-gray-800">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black" style={{ color: '#680001' }}>UNOH</span>
          <span className="text-indigo-400 font-black text-lg">🔑 CODE BREAKER</span>
        </div>
        <div className="flex items-center gap-4">
          {currentQuestion && (
            <span className="text-gray-400 text-sm">Q {currentQuestion.index + 1}/{currentQuestion.total}</span>
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
        {/* SETUP */}
        {phase === 'setup' && (
          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
            <div className="text-5xl font-black text-indigo-400">🔑 CODE BREAKER</div>
            <div className="text-gray-300 text-lg text-center max-w-lg">
              Enter the secret phrase (a key term, concept, or acronym).<br />
              Students earn letter reveals by answering correctly!
            </div>
            <div className="w-full max-w-lg">
              <label className="text-gray-400 text-sm uppercase tracking-widest mb-2 block">
                Enter Secret Phrase
              </label>
              <input
                type="text"
                value={phraseInput}
                onChange={(e) => setPhraseInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleSetPhrase()}
                placeholder="e.g. OSI MODEL"
                className="w-full bg-gray-900 border-2 border-indigo-500 rounded-xl p-4 text-white text-2xl font-black tracking-widest text-center uppercase focus:outline-none focus:border-indigo-300"
                autoFocus
              />
              <div className="text-gray-500 text-sm mt-2 text-center">Letters only — spaces and uppercase auto-applied</div>
            </div>
            {phraseInput && (
              <div className="flex gap-3 mt-2">
                {phraseInput.split('').map((ch, i) => (
                  <div key={i} className={`w-10 h-12 rounded-lg flex items-center justify-center font-black text-xl border-2
                    ${ch === ' ' ? 'border-transparent' : 'bg-gray-800 border-gray-600 text-white'}`}>
                    {ch !== ' ' ? '_' : ''}
                  </div>
                ))}
              </div>
            )}
            <button onClick={handleSetPhrase} disabled={!phraseInput.trim()}
              className="px-12 py-5 text-2xl font-black rounded-2xl text-white disabled:opacity-50"
              style={{ backgroundColor: '#680001' }}>
              SET PHRASE →
            </button>
          </motion.div>
        )}

        {/* LOBBY */}
        {phase === 'lobby' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
            <div className="text-4xl font-black text-indigo-400">Phrase is set! Ready to play.</div>
            {/* Preview masked phrase */}
            <div className="flex gap-3 flex-wrap justify-center">
              {secretPhrase.split('').map((ch, i) => (
                <div key={i}
                  className={`font-black text-4xl tracking-widest border-b-4
                    ${ch === ' ' ? 'w-6 border-transparent' : 'w-10 text-center text-gray-300 border-indigo-500'}`}>
                  {ch === ' ' ? '' : '_'}
                </div>
              ))}
            </div>
            <div className="text-gray-400 text-lg">{totalLetters} letters to reveal</div>
            <div className="text-center">
              <div className="text-gray-400 text-xl">Join at unoh.review — PIN:</div>
              <div className="text-7xl font-black text-white tracking-widest">{pin}</div>
            </div>
            <div className="text-xl text-white">{players.length} player{players.length !== 1 ? 's' : ''} joined</div>
            <div className="flex gap-3">
              <button onClick={handleStart} disabled={!noJoin && players.length === 0}
                className="px-12 py-5 text-2xl font-black rounded-2xl text-white disabled:opacity-50"
                style={{ backgroundColor: '#680001' }}>
                START GAME →
              </button>
              <button onClick={() => setPhase('setup')}
                className="px-6 py-5 text-xl font-black rounded-2xl text-white bg-gray-700 hover:bg-gray-600">
                Change Phrase
              </button>
            </div>
          </motion.div>
        )}

        {/* QUESTION PHASE */}
        {phase === 'question' && (
          <motion.div key="question" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col">
            {/* Phrase display */}
            <div className="bg-black border-b-2 border-indigo-800 px-8 py-6">
              <div className="flex gap-2 flex-wrap justify-center">
                {maskedDisplay.map((ch, i) => {
                  const isNew = newReveal?.index === i;
                  return ch === ' ' ? (
                    <div key={i} className="w-6" />
                  ) : (
                    <motion.div
                      key={i}
                      animate={isNew ? { scale: [1, 1.5, 1], color: ['#818cf8', '#ffffff', '#a5b4fc'] } : {}}
                      transition={{ duration: 0.5 }}
                      className={`w-12 h-14 rounded-lg border-b-4 flex items-center justify-center font-black text-3xl
                        ${ch !== '_' ? 'bg-indigo-900 border-indigo-400 text-white' : 'bg-gray-900 border-gray-600 text-gray-700'}`}
                    >
                      {ch === '_' ? '' : ch}
                    </motion.div>
                  );
                })}
              </div>
              <div className="text-center mt-3 text-gray-400 text-sm">
                {revealedCount}/{totalLetters} letters revealed
              </div>
            </div>

            {/* Question */}
            <div className="flex-1 flex flex-col p-6 gap-4">
              {currentQuestion && (
                <>
                  <div className="text-3xl font-bold text-white bg-gray-900 rounded-xl p-5">
                    {currentQuestion.text}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {currentQuestion.options.map((opt, i) => (
                      <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center gap-3">
                        <span className="text-gray-400 font-black text-xl">{['A', 'B', 'C', 'D'][i]}.</span>
                        <span className="text-white font-bold text-lg">{opt}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!currentQuestion && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-gray-600 text-2xl">Press "Next Question" to continue...</div>
                </div>
              )}

              {/* No-devices: player correct buttons */}
              {noJoin && players.length > 0 && (
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
                  <div className="text-gray-400 text-xs uppercase tracking-widest mb-3">
                    Who answered correctly? (reveals a letter)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {players.map(p => (
                      <button key={p.name} onClick={() => handleHostCorrect(p.name)}
                        className="px-4 py-2 rounded-lg text-white font-bold text-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                        style={{ backgroundColor: '#680001' }}>
                        <span className="text-green-300">✓</span> {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 flex-wrap mt-auto">
                <button onClick={handleNext}
                  className="px-8 py-4 text-xl font-black rounded-xl text-white"
                  style={{ backgroundColor: '#680001' }}>
                  Next Question →
                </button>
                <button onClick={() => setGuessModalOpen(true)}
                  className="px-6 py-4 text-lg font-black rounded-xl text-white bg-indigo-700 hover:bg-indigo-600">
                  Accept Team Guess 🔑
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* GAME OVER */}
        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
            {phraseSolved ? (
              <>
                <motion.div className="text-7xl font-black text-indigo-400"
                  animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                  CODE BROKEN!
                </motion.div>
                {solvedBy && <div className="text-3xl text-white">🏆 Solved by: <span className="text-yellow-400 font-black">{solvedBy}</span></div>}
                {/* Reveal full phrase */}
                <div className="flex gap-2 flex-wrap justify-center">
                  {secretPhrase.split('').map((ch, i) => (
                    ch === ' ' ? <div key={i} className="w-6" /> : (
                      <motion.div key={i} initial={{ rotateY: 90 }} animate={{ rotateY: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="w-12 h-14 bg-indigo-600 border-2 border-indigo-400 rounded-lg flex items-center justify-center font-black text-3xl text-white">
                        {ch}
                      </motion.div>
                    )
                  ))}
                </div>
              </>
            ) : (
              <div className="text-5xl font-black text-gray-400">Game Over — Phrase Not Solved!</div>
            )}

            <div className="w-full max-w-xl space-y-3 mt-4">
              {sortedScores.slice(0, 5).map((p, i) => (
                <motion.div key={p.name} initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-4 bg-gray-900 rounded-xl p-4">
                  <span className="text-2xl font-black text-gray-400">{i + 1}.</span>
                  <span className="text-white font-bold flex-1">{p.name}</span>
                  <span className="text-xl font-black text-indigo-400">{p.score} pts</span>
                </motion.div>
              ))}
            </div>

            <button onClick={() => navigate('/dashboard')}
              className="px-8 py-4 text-xl font-black rounded-xl text-white bg-gray-700 hover:bg-gray-600">
              Back to Dashboard
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guess Modal */}
      <AnimatePresence>
        {guessModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-6">
            <motion.div initial={{ scale: 0.8, y: 40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8 }}
              className="bg-gray-900 border-2 border-indigo-500 rounded-2xl p-8 max-w-md w-full">
              <div className="text-2xl font-black text-white mb-6">🔑 Team Phrase Guess</div>

              <div className="mb-4">
                <label className="text-gray-400 text-sm uppercase tracking-widest mb-1 block">Team Name</label>
                <input value={guessTeam} onChange={(e) => setGuessTeam(e.target.value)}
                  placeholder="Enter team/player name"
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-400" />
              </div>

              <div className="mb-6">
                <label className="text-gray-400 text-sm uppercase tracking-widest mb-1 block">Their Guess</label>
                <input value={guessText} onChange={(e) => setGuessText(e.target.value.toUpperCase())}
                  placeholder="What did they say?"
                  className="w-full bg-gray-800 border border-gray-600 rounded-xl p-3 text-white uppercase font-bold tracking-wider focus:outline-none focus:border-indigo-400" />
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 mb-6 text-center">
                <div className="text-gray-400 text-xs uppercase tracking-widest mb-1">Secret Phrase</div>
                <div className="text-white font-black text-xl tracking-widest">{secretPhrase}</div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => handleGuessSubmit(true)} disabled={!guessTeam}
                  className="flex-1 py-3 font-black rounded-xl text-white bg-green-700 hover:bg-green-600 disabled:opacity-50">
                  ✓ CORRECT!
                </button>
                <button onClick={() => handleGuessSubmit(false)} disabled={!guessTeam}
                  className="flex-1 py-3 font-black rounded-xl text-white bg-red-700 hover:bg-red-600 disabled:opacity-50">
                  ✗ WRONG
                </button>
                <button onClick={() => { setGuessModalOpen(false); setGuessTeam(''); setGuessText(''); }}
                  className="px-4 py-3 font-bold rounded-xl text-white bg-gray-700 hover:bg-gray-600">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Score sidebar always visible during question */}
      {phase === 'question' && (
        <div className="fixed right-0 top-16 bottom-0 w-44 bg-black border-l border-gray-800 flex flex-col p-3 overflow-y-auto z-10">
          <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">Scores</div>
          {sortedScores.map((p, i) => (
            <div key={p.name} className="mb-2 py-2 border-b border-gray-900">
              <div className="flex items-center gap-1">
                <span className="text-gray-500 text-xs w-4">{i + 1}.</span>
                <span className="text-white text-sm font-bold truncate">{p.name}</span>
              </div>
              <div className="text-right font-black text-indigo-400 text-sm">{p.score} pts</div>
            </div>
          ))}
        </div>
      )}
      {(location.state as any)?.settings?.noJoin && <ManualScorePanel pin={(location.state as any)?.pin} />}
    </div>
  );
}
