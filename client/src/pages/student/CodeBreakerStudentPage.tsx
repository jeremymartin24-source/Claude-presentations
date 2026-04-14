import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

type Phase = 'lobby' | 'playing' | 'gameover';

export default function CodeBreakerStudentPage() {
  const navigate   = useNavigate();
  const playerName = localStorage.getItem('playerName') || 'Player';
  const gamePin    = localStorage.getItem('gamePin') || '';

  const [phase, setPhase]         = useState<Phase>('lobby');
  const [masked, setMasked]       = useState<string[]>([]);
  const [question, setQuestion]   = useState<any>(null);
  const [answer, setAnswer]       = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [lastResult, setLastResult] = useState<{ correct: boolean; revealedBy?: string } | null>(null);
  const [guessPhrase, setGuessPhrase] = useState('');
  const [showGuess, setShowGuess] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [leaderboard, setLeaderboard]   = useState<any[]>([]);
  const [recentReveal, setRecentReveal] = useState<{ letter: string; index: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on('codebreaker:started', ({ masked: m }: any) => {
      setMasked(m);
      setPhase('playing');
    });

    socket.on('question_reveal', (q: any) => {
      setQuestion(q);
      setAnswer('');
      setSubmitted(false);
      setLastResult(null);
      setPhase('playing');
      setTimeout(() => inputRef.current?.focus(), 100);
    });

    socket.on('codebreaker:letter_revealed', ({ masked: m, letter, index, revealedBy }: any) => {
      setMasked(m);
      setRecentReveal({ letter, index });
      if (revealedBy) showNotification(`${revealedBy} revealed a letter!`);
      setTimeout(() => setRecentReveal(null), 2000);
    });

    socket.on('answer_result', ({ correct, pointsEarned, playerName: who }: any) => {
      const isMe = who === playerName;
      if (isMe) {
        setLastResult({ correct, revealedBy: who });
        setSubmitted(true);
      }
      if (correct && who) showNotification(`✅ ${who} got it right!`);
      if (!correct && isMe) showNotification('❌ Wrong answer');
      setTimeout(() => {
        setSubmitted(false);
        setAnswer('');
        setLastResult(null);
      }, 2500);
    });

    socket.on('codebreaker:phrase_solved', ({ phrase, solvedBy }: any) => {
      setMasked(phrase.toUpperCase().split(''));
      showNotification(`🎉 ${solvedBy} solved the phrase!`);
    });

    socket.on('codebreaker:wrong_guess', ({ penalty }: any) => {
      showNotification(`❌ Wrong phrase guess! -${penalty} points`);
      setGuessPhrase('');
      setShowGuess(false);
    });

    socket.on('scores_update', () => {});

    socket.on('game_over', ({ finalScores }: any) => {
      setLeaderboard(finalScores || []);
      setPhase('gameover');
    });

    return () => {
      socket.off('codebreaker:started');
      socket.off('question_reveal');
      socket.off('codebreaker:letter_revealed');
      socket.off('answer_result');
      socket.off('codebreaker:phrase_solved');
      socket.off('codebreaker:wrong_guess');
      socket.off('scores_update');
      socket.off('game_over');
    };
  }, [playerName]);

  function showNotification(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  }

  function submitAnswer() {
    if (!answer.trim() || submitted || !question) return;
    setSubmitted(true);
    getSocket().emit('codebreaker:answer', { pin: gamePin, playerName, answer: answer.trim() });
  }

  function submitGuess() {
    if (!guessPhrase.trim()) return;
    getSocket().emit('codebreaker:guess_phrase', { pin: gamePin, teamName: playerName, guess: guessPhrase.trim() });
    setGuessPhrase('');
    setShowGuess(false);
  }

  // Render the masked phrase as letter blocks
  const PhraseDisplay = () => {
    const words = masked.reduce<string[][]>((acc, ch) => {
      if (ch === ' ') { acc.push([]); return acc; }
      acc[acc.length - 1].push(ch);
      return acc;
    }, [[]]);

    return (
      <div className="flex flex-wrap justify-center gap-3 px-2">
        {words.map((word, wIdx) => (
          <div key={wIdx} className="flex gap-1">
            {word.map((letter, lIdx) => {
              const flatIdx = masked.indexOf(letter, words.slice(0, wIdx).reduce((s, w) => s + w.length + 1, 0) + lIdx);
              const isNew = recentReveal?.index === flatIdx && letter !== '_';
              return (
                <motion.div
                  key={lIdx}
                  animate={isNew ? { scale: [1, 1.3, 1], backgroundColor: ['#6B21A8', '#7C3AED', '#1F2937'] } : {}}
                  transition={{ duration: 0.5 }}
                  className={`w-8 h-10 flex items-end justify-center pb-1 border-b-2 text-lg font-black
                    ${letter === '_' ? 'border-gray-600 text-transparent' : 'border-green-500 text-green-300'}`}>
                  {letter === '_' ? ' ' : letter}
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // Lobby
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-6">
        <div className="text-5xl mb-4">🔑</div>
        <h1 className="text-2xl font-bold text-white">Code Breaker</h1>
        <p className="text-gray-400 mt-2">Waiting for Professor Martin to start...</p>
        <div className="mt-4 text-unoh-red font-bold">{playerName}</div>
      </div>
    );
  }

  // Game Over
  if (phase === 'gameover') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🔑</div>
        <h1 className="text-2xl font-bold text-white mb-6">Code Broken!</h1>
        {masked.length > 0 && (
          <div className="mb-6 bg-gray-900 rounded-2xl px-4 py-3 w-full max-w-sm">
            <p className="text-gray-500 text-xs mb-2 text-center">The phrase was:</p>
            <p className="text-green-300 font-black text-xl text-center tracking-widest">
              {masked.join('')}
            </p>
          </div>
        )}
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

  // Playing
  return (
    <div className="min-h-screen bg-black flex flex-col px-4 py-5">
      <AnimatePresence>
        {notification && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed top-4 left-4 right-4 z-50 bg-gray-800 border border-gray-600 text-white font-bold text-center rounded-xl py-3 px-4 shadow-lg">
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phrase display */}
      <div className="bg-gray-950 border border-gray-800 rounded-2xl px-3 py-5 mb-5">
        <p className="text-gray-600 text-xs text-center uppercase tracking-widest mb-3">Decode the Phrase</p>
        <PhraseDisplay />
        <div className="mt-3 text-center">
          <span className="text-gray-600 text-xs">
            {masked.filter(c => c !== '_' && c !== ' ').length} / {masked.filter(c => c !== ' ').length} letters revealed
          </span>
        </div>
      </div>

      {/* Current question */}
      {question ? (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 mb-4">
          {question.questionNumber && (
            <p className="text-gray-500 text-xs mb-1">Question {question.questionNumber} of {question.totalQuestions}</p>
          )}
          <p className="text-white font-bold text-base">{question.question}</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-2xl px-4 py-3 mb-4 text-center">
          <p className="text-gray-600 text-sm">Waiting for question...</p>
        </div>
      )}

      {/* Answer input */}
      {question && (
        <div className="mb-3">
          {submitted ? (
            <div className="flex items-center justify-center gap-2 py-3">
              {lastResult?.correct ? (
                <span className="text-green-400 font-bold">✅ Correct! A letter was revealed!</span>
              ) : lastResult ? (
                <span className="text-red-400 font-bold">❌ Wrong answer</span>
              ) : (
                <span className="text-gray-400">⏳ Answer submitted...</span>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                ref={inputRef}
                className="flex-1 bg-gray-900 border-2 border-gray-700 focus:border-unoh-red rounded-xl px-4 py-3.5 text-white text-lg outline-none transition-colors"
                placeholder="Type your answer..."
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitAnswer()}
              />
              <motion.button whileTap={{ scale: 0.95 }} onClick={submitAnswer}
                disabled={!answer.trim()}
                className="btn-primary px-5 disabled:opacity-40 text-lg rounded-xl">
                →
              </motion.button>
            </div>
          )}
        </div>
      )}

      {/* Guess the full phrase */}
      <div className="mt-auto">
        {showGuess ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <input
              className="w-full bg-gray-900 border-2 border-yellow-600 focus:border-yellow-400 rounded-xl px-4 py-3 text-white outline-none transition-colors"
              placeholder="Type the full phrase..."
              value={guessPhrase}
              onChange={e => setGuessPhrase(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitGuess()}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={submitGuess} className="flex-1 py-2.5 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-sm">
                Guess Phrase!
              </button>
              <button onClick={() => setShowGuess(false)} className="py-2.5 px-4 rounded-xl border border-gray-700 text-gray-400 text-sm hover:border-gray-500">
                Cancel
              </button>
            </div>
            <p className="text-gray-600 text-xs text-center">⚠️ Wrong guesses cost 100 points!</p>
          </motion.div>
        ) : (
          <button
            onClick={() => setShowGuess(true)}
            className="w-full py-3 rounded-xl border border-gray-700 text-gray-400 text-sm hover:border-yellow-600 hover:text-yellow-400 transition-colors">
            💡 Guess the Full Phrase
          </button>
        )}
      </div>
    </div>
  );
}
