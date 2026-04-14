import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

type Role = 'audience' | 'contestant';
type Phase = 'lobby' | 'watching' | 'question' | 'reveal' | 'poll' | 'phone' | 'gameover';

const LADDER = [100, 200, 300, 500, 1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 125_000, 250_000, 500_000, 1_000_000];
const SAFE_HAVENS = [4, 9];

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS = [
  'border-blue-500 bg-blue-900/40 hover:bg-blue-800/60',
  'border-orange-500 bg-orange-900/40 hover:bg-orange-800/60',
  'border-green-500 bg-green-900/40 hover:bg-green-800/60',
  'border-red-500 bg-red-900/40 hover:bg-red-800/60',
];
const REVEAL_CORRECT = 'border-green-400 bg-green-700/60';
const REVEAL_WRONG   = 'border-red-400 bg-red-700/40';

function formatMoney(n: number) {
  return '$' + n.toLocaleString();
}

export default function MillionaireStudentPage() {
  const navigate   = useNavigate();
  const playerName = localStorage.getItem('playerName') || 'Player';
  const gamePin    = localStorage.getItem('gamePin') || '';

  const [phase, setPhase]               = useState<Phase>('lobby');
  const [role, setRole]                 = useState<Role>('audience');
  const [contestantName, setContestantName] = useState('');
  const [level, setLevel]               = useState(0);
  const [question, setQuestion]         = useState<any>(null);  // { text, options }
  const [prizeMoney, setPrizeMoney]     = useState(0);
  const [safeAmount, setSafeAmount]     = useState(0);
  const [lifelines, setLifelines]       = useState({ fiftyFifty: true, pollTheClass: true, phoneAFriend: true });
  const [removedOptions, setRemovedOptions] = useState<number[]>([]);  // 50/50
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [revealData, setRevealData]     = useState<any>(null);
  const [pollOptions, setPollOptions]   = useState<string[]>([]);
  const [pollVoted, setPollVoted]       = useState(false);
  const [pollResults, setPollResults]   = useState<Record<string, number> | null>(null);
  const [phoneRequest, setPhoneRequest] = useState<any>(null);  // phone-a-friend request
  const [phoneSuggestion, setPhoneSuggestion] = useState('');
  const [friendName, setFriendName]     = useState('');
  const [walkedAway, setWalkedAway]     = useState(false);

  useEffect(() => {
    const socket = getSocket();

    socket.on('millionaire:contestant_selected', ({ name, socketId }: any) => {
      setContestantName(name);
      const isMe = name === playerName;
      setRole(isMe ? 'contestant' : 'audience');
      setLevel(0);
      setSelectedAnswer(null);
      setRemovedOptions([]);
      setRevealData(null);
      setWalkedAway(false);
      setPhase('watching');
    });

    socket.on('question_reveal', ({ level: l, prizeMoney: pm, question: q, contestant, safeAmount: sa, lifelines: ll }: any) => {
      setLevel(l);
      setPrizeMoney(pm);
      setQuestion(q);
      setSafeAmount(sa ?? 0);
      if (ll) setLifelines(ll);
      setSelectedAnswer(null);
      setRemovedOptions([]);
      setRevealData(null);
      setPollVoted(false);
      setPollResults(null);
      setPhoneRequest(null);
      setPhase('question');
    });

    socket.on('millionaire:reveal', (data: any) => {
      setRevealData(data);
      if (data.level !== undefined) setLevel(data.level);
      setPhase('reveal');
    });

    socket.on('millionaire:fifty_fifty', ({ remaining }: any) => {
      if (!question) return;
      const keep = remaining.map((r: string) => r.trim().toLowerCase());
      const toRemove: number[] = [];
      question.options?.forEach((opt: string, i: number) => {
        if (!keep.includes(opt.trim().toLowerCase())) toRemove.push(i);
      });
      setRemovedOptions(toRemove);
      setLifelines(prev => ({ ...prev, fiftyFifty: false }));
    });

    socket.on('poll_class_start', ({ question: pq, options }: any) => {
      setPollOptions(options ?? []);
      setPollVoted(false);
      setPollResults(null);
      setPhase('poll');
    });

    socket.on('millionaire:poll_results', ({ percentages }: any) => {
      setPollResults(percentages);
    });

    socket.on('phone_a_friend_request', (data: any) => {
      setPhoneRequest(data);
      setPhoneSuggestion('');
      setPhase('phone');
    });

    socket.on('phone_a_friend_started', ({ friendName: fn }: any) => {
      setFriendName(fn);
    });

    socket.on('phone_a_friend_ended', () => {
      setPhoneRequest(null);
      if (phase === 'phone') setPhase('question');
    });

    socket.on('millionaire:walked_away', () => {
      setWalkedAway(true);
    });

    socket.on('game_over', ({ contestant, winnings, won, scores }: any) => {
      setPhase('gameover');
    });

    return () => {
      socket.off('millionaire:contestant_selected');
      socket.off('question_reveal');
      socket.off('millionaire:reveal');
      socket.off('millionaire:fifty_fifty');
      socket.off('poll_class_start');
      socket.off('millionaire:poll_results');
      socket.off('phone_a_friend_request');
      socket.off('phone_a_friend_started');
      socket.off('phone_a_friend_ended');
      socket.off('millionaire:walked_away');
      socket.off('game_over');
    };
  }, [playerName, question, phase]);

  function submitAnswer(index: number) {
    if (selectedAnswer !== null || role !== 'contestant') return;
    setSelectedAnswer(index);
    const answer = question?.options?.[index];
    if (answer) getSocket().emit('millionaire:answer', { pin: gamePin, answer: index });
  }

  function useLifeline(type: '50-50' | 'poll' | 'phone') {
    if (role !== 'contestant') return;
    getSocket().emit('millionaire:lifeline', { pin: gamePin, type });
    if (type === '50-50') setLifelines(prev => ({ ...prev, fiftyFifty: false }));
    if (type === 'poll') setLifelines(prev => ({ ...prev, pollTheClass: false }));
    if (type === 'phone') setLifelines(prev => ({ ...prev, phoneAFriend: false }));
  }

  function walkAway() {
    if (role !== 'contestant') return;
    getSocket().emit('millionaire:walk_away', { pin: gamePin });
  }

  function submitPollVote(option: string) {
    if (pollVoted) return;
    setPollVoted(true);
    getSocket().emit('poll_vote', { pin: gamePin, answer: option });
  }

  function submitPhoneSuggestion() {
    if (!phoneSuggestion.trim()) return;
    getSocket().emit('phone_friend_response', { pin: gamePin, suggestion: phoneSuggestion.trim() });
    setPhase('question');
  }

  // Money ladder component
  const MoneyLadder = () => (
    <div className="mt-4 space-y-0.5">
      {[...LADDER].reverse().map((amount, revIdx) => {
        const idx = LADDER.length - 1 - revIdx;
        const isCurrent = idx === level;
        const isPassed  = idx < level;
        const isSafe    = SAFE_HAVENS.includes(idx);
        return (
          <div key={idx} className={`flex items-center justify-between px-3 py-1 rounded text-xs font-mono
            ${isCurrent ? 'bg-yellow-500/20 border border-yellow-400 text-yellow-300 font-bold' :
              isPassed   ? 'text-green-500' :
              isSafe     ? 'text-blue-400' : 'text-gray-600'}`}>
            <span>{idx + 1}</span>
            <span>{isSafe && '🛡 '}{formatMoney(amount)}</span>
          </div>
        );
      })}
    </div>
  );

  // Lobby
  if (phase === 'lobby') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-6">
        <div className="text-5xl mb-4">💰</div>
        <h1 className="text-2xl font-bold text-white">Who Wants to Be a Millionaire?</h1>
        <p className="text-gray-400 mt-2">Waiting for Professor Martin to start...</p>
        <div className="mt-4 text-unoh-red font-bold">{playerName}</div>
      </div>
    );
  }

  // Phone-a-friend (you're the friend)
  if (phase === 'phone' && phoneRequest) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="w-full max-w-sm text-center">
          <div className="text-5xl mb-3">📞</div>
          <h2 className="text-xl font-bold text-white mb-1">Phone-a-Friend!</h2>
          <p className="text-gray-400 text-sm mb-4">{phoneRequest.calledBy} is calling you!</p>

          <div className="bg-gray-900 rounded-2xl p-4 text-left mb-4">
            <p className="text-gray-400 text-xs mb-2">The question:</p>
            <p className="text-white font-medium">{phoneRequest.question}</p>
            <div className="mt-3 space-y-1">
              {phoneRequest.options?.map((opt: string, i: number) => (
                <p key={i} className="text-gray-300 text-sm"><span className="text-gray-500 mr-2">{OPTION_LABELS[i]}.</span>{opt}</p>
              ))}
            </div>
          </div>

          <input
            className="w-full bg-gray-900 border-2 border-gray-700 focus:border-unoh-red rounded-xl px-4 py-3 text-white outline-none mb-3"
            placeholder="Your suggestion..."
            value={phoneSuggestion}
            onChange={e => setPhoneSuggestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitPhoneSuggestion()}
          />
          <button onClick={submitPhoneSuggestion} className="w-full btn-primary">Send Suggestion</button>
        </motion.div>
      </div>
    );
  }

  // Poll vote (audience)
  if (phase === 'poll') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
        <div className="text-4xl mb-3 text-center">🗳️</div>
        <h2 className="text-xl font-bold text-white text-center mb-2">Poll the Class</h2>
        <p className="text-gray-400 text-sm text-center mb-4">Vote for the answer you think is correct!</p>

        {pollResults ? (
          <div className="w-full max-w-sm space-y-2">
            {pollOptions.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-gray-400 text-sm w-6">{OPTION_LABELS[i]}.</span>
                <div className="flex-1 bg-gray-900 rounded-lg overflow-hidden h-8 relative">
                  <div
                    className="h-full bg-unoh-red/70 transition-all duration-500"
                    style={{ width: `${pollResults[opt] ?? 0}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-white text-xs font-medium">{opt}</span>
                </div>
                <span className="text-white text-xs font-mono w-8">{pollResults[opt] ?? 0}%</span>
              </div>
            ))}
            <p className="text-gray-500 text-xs text-center mt-3">Results shown!</p>
          </div>
        ) : (
          <div className="w-full max-w-sm space-y-2">
            {pollOptions.map((opt, i) => (
              <button
                key={i}
                onClick={() => submitPollVote(opt)}
                disabled={pollVoted}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all font-medium
                  ${pollVoted ? 'opacity-50 cursor-not-allowed border-gray-700 bg-gray-900 text-gray-400' : OPTION_COLORS[i % 4] + ' text-white cursor-pointer'}`}>
                <span className="text-gray-400 font-mono w-6">{OPTION_LABELS[i]}.</span>
                <span className="flex-1">{opt}</span>
              </button>
            ))}
            {pollVoted && <p className="text-gray-500 text-sm text-center mt-2">Vote submitted! Waiting for results...</p>}
          </div>
        )}
      </div>
    );
  }

  // Watching (no question active yet)
  if (phase === 'watching') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-6">
        <div className="text-5xl mb-3">💰</div>
        {role === 'contestant' ? (
          <>
            <h1 className="text-2xl font-bold text-yellow-400">You're the Contestant!</h1>
            <p className="text-gray-400 mt-2">Get ready — a question is coming!</p>
          </>
        ) : (
          <>
            <p className="text-gray-400">Watching <span className="text-yellow-400 font-bold">{contestantName}</span></p>
            <p className="text-gray-500 text-sm mt-1">You may be called on to help!</p>
          </>
        )}
      </div>
    );
  }

  // Reveal phase
  if (phase === 'reveal' && revealData) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-7xl mb-4">
          {revealData.correct ? '✅' : '❌'}
        </motion.div>
        <h2 className={`text-2xl font-bold ${revealData.correct ? 'text-green-400' : 'text-red-400'}`}>
          {revealData.correct ? 'CORRECT!' : 'WRONG!'}
        </h2>
        <p className="text-gray-300 mt-2">
          Answer: <span className="font-bold text-white">{revealData.correctText}</span>
        </p>
        {revealData.correct && revealData.prizeMoney && (
          <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-yellow-400 text-2xl font-bold mt-2">
            {formatMoney(revealData.prizeMoney)}!
          </motion.p>
        )}
        {!revealData.correct && revealData.safeAmount !== undefined && (
          <p className="text-gray-400 mt-2">Safe amount: {formatMoney(revealData.safeAmount)}</p>
        )}
      </div>
    );
  }

  // Game Over
  if (phase === 'gameover') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">💰</div>
        <h1 className="text-2xl font-bold text-white">Game Over!</h1>
        <p className="text-gray-400 mt-2">Thanks for playing!</p>
        <button onClick={() => navigate('/')} className="mt-8 btn-secondary">Back to Home</button>
      </div>
    );
  }

  // Question phase
  if (phase === 'question' && question) {
    const options: string[] = question.options ?? [];
    const isContestant = role === 'contestant';

    return (
      <div className="min-h-screen bg-black flex flex-col px-4 py-5">
        {/* Prize display */}
        <div className="text-center mb-4">
          <p className="text-gray-500 text-xs uppercase tracking-widest">Question {level + 1}</p>
          <p className="text-yellow-400 font-black text-2xl">{formatMoney(prizeMoney)}</p>
          {safeAmount > 0 && <p className="text-blue-400 text-xs">Safe at {formatMoney(safeAmount)}</p>}
          {contestantName && <p className="text-gray-500 text-xs mt-1">Contestant: {contestantName}</p>}
        </div>

        {/* Question */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl px-4 py-4 mb-4 text-center">
          <p className="text-white font-bold leading-snug">{question.text}</p>
        </div>

        {/* Answer options */}
        <div className="space-y-2 flex-1">
          {options.map((opt, i) => {
            const isRemoved  = removedOptions.includes(i);
            const isSelected = selectedAnswer === i;

            if (isRemoved) return (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-gray-800 bg-gray-900/20 opacity-30">
                <span className="text-gray-600 font-mono w-6">{OPTION_LABELS[i]}.</span>
                <span className="text-gray-600 line-through text-sm">{opt}</span>
              </div>
            );

            return (
              <button
                key={i}
                onClick={() => isContestant && submitAnswer(i)}
                disabled={selectedAnswer !== null || !isContestant}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all font-medium
                  ${isSelected ? 'border-yellow-400 bg-yellow-900/40 text-yellow-200' :
                    !isContestant || selectedAnswer !== null ? `${OPTION_COLORS[i % 4]} opacity-70 cursor-default text-white` :
                    `${OPTION_COLORS[i % 4]} text-white`}`}>
                <span className="font-mono w-6 text-gray-300">{OPTION_LABELS[i]}.</span>
                <span className="flex-1 text-sm">{opt}</span>
              </button>
            );
          })}
        </div>

        {/* Contestant controls */}
        {isContestant && (
          <div className="mt-4 space-y-2">
            {/* Lifelines */}
            <div className="flex gap-2">
              <button
                onClick={() => useLifeline('50-50')}
                disabled={!lifelines.fiftyFifty || selectedAnswer !== null}
                className="flex-1 py-2 rounded-xl border border-gray-700 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:border-yellow-500 text-white transition-colors">
                50/50
              </button>
              <button
                onClick={() => useLifeline('poll')}
                disabled={!lifelines.pollTheClass || selectedAnswer !== null}
                className="flex-1 py-2 rounded-xl border border-gray-700 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:border-yellow-500 text-white transition-colors">
                Poll Class
              </button>
              <button
                onClick={() => useLifeline('phone')}
                disabled={!lifelines.phoneAFriend || selectedAnswer !== null}
                className="flex-1 py-2 rounded-xl border border-gray-700 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:border-yellow-500 text-white transition-colors">
                📞 Phone
              </button>
            </div>
            {/* Walk Away */}
            {selectedAnswer === null && (
              <button
                onClick={walkAway}
                className="w-full py-2 rounded-xl border border-gray-700 text-gray-400 text-xs hover:border-red-500 hover:text-red-400 transition-colors">
                Walk Away ({formatMoney(level > 0 ? LADDER[level - 1] : 0)})
              </button>
            )}
          </div>
        )}

        {/* Audience: show phone-a-friend status */}
        {!isContestant && friendName && (
          <p className="text-center text-gray-500 text-xs mt-3">📞 {friendName} is being called...</p>
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
