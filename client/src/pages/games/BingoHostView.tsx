import ManualScorePanel from '../../components/games/ManualScorePanel';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface CalledTerm {
  definition: string;
  term: string;
  index: number;
}

interface BingoWinner {
  playerName: string;
  type: 'bingo' | 'blackout';
  timestamp: number;
}

interface PlayerStatus {
  name: string;
  hasBingo: boolean;
  hasBlackout: boolean;
  matchCount: number;
}

export default function BingoHostView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pin, bankId, settings } = (location.state as { pin: string; bankId: string; settings: Record<string, unknown> }) || {};

  const [phase, setPhase] = useState<'lobby' | 'playing' | 'gameover'>('lobby');
  const [calledTerms, setCalledTerms] = useState<CalledTerm[]>([]);
  const [currentTerm, setCurrentTerm] = useState<CalledTerm | null>(null);
  const [bingoWinners, setBingoWinners] = useState<BingoWinner[]>([]);
  const [playerStatuses, setPlayerStatuses] = useState<PlayerStatus[]>([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [players, setPlayers] = useState<{ name: string }[]>([]);
  const [newBingoClaim, setNewBingoClaim] = useState<string | null>(null);
  const [newBlackoutClaim, setNewBlackoutClaim] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('host_game', { pin, gameType: 'bingo', bankId, settings });

    socket.on('player_joined', (data: { players: { name: string }[] }) => {
      setPlayers(data.players);
      setPlayerCount(data.players.length);
      setPlayerStatuses(data.players.map((p) => ({
        name: p.name, hasBingo: false, hasBlackout: false, matchCount: 0,
      })));
    });

    socket.on('bingo:term_called', (data: CalledTerm) => {
      setCurrentTerm(data);
      setCalledTerms((prev) => [data, ...prev]);
    });

    socket.on('bingo:bingo_claimed', (data: { playerName: string }) => {
      setNewBingoClaim(data.playerName);
      setBingoWinners((prev) => [...prev, { playerName: data.playerName, type: 'bingo', timestamp: Date.now() }]);
      setPlayerStatuses((prev) =>
        prev.map((p) => p.name === data.playerName ? { ...p, hasBingo: true } : p)
      );
      setTimeout(() => setNewBingoClaim(null), 4000);
    });

    socket.on('bingo:blackout', (data: { playerName: string }) => {
      setNewBlackoutClaim(data.playerName);
      setBingoWinners((prev) => [...prev, { playerName: data.playerName, type: 'blackout', timestamp: Date.now() }]);
      setPlayerStatuses((prev) =>
        prev.map((p) => p.name === data.playerName ? { ...p, hasBlackout: true, hasBingo: true } : p)
      );
      setTimeout(() => setNewBlackoutClaim(null), 5000);
    });

    socket.on('game_over', () => setPhase('gameover'));

    return () => {
      socket.off('player_joined');
      socket.off('bingo:term_called');
      socket.off('bingo:bingo_claimed');
      socket.off('bingo:blackout');
      socket.off('game_over');
    };
  }, []);

  const socket = getSocket();

  const handleStart = () => {
    socket.emit('bingo:start', { pin });
    setPhase('playing');
  };

  const handleCallNext = () => {
    socket.emit('bingo:call_next', { pin });
  };

  const handleVerifyBingo = (playerName: string) => {
    socket.emit('bingo:verify_bingo', { pin, playerName });
  };

  const handleEnd = () => {
    socket.emit('bingo:end', { pin });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-black border-b border-gray-800">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black" style={{ color: '#680001' }}>UNOH</span>
          <span className="text-green-400 font-black text-xl tracking-wider">🎰 BLACKOUT BINGO</span>
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

      {/* BINGO WINNER ALERTS */}
      <AnimatePresence>
        {newBlackoutClaim && (
          <motion.div initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-yellow-500 text-black font-black text-3xl px-10 py-5 rounded-2xl shadow-2xl border-4 border-yellow-300">
            🌟 BLACKOUT BINGO! — {newBlackoutClaim}!
          </motion.div>
        )}
        {newBingoClaim && !newBlackoutClaim && (
          <motion.div initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white font-black text-2xl px-8 py-4 rounded-2xl shadow-2xl">
            🎉 BINGO! — {newBingoClaim}!
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* LOBBY */}
        {phase === 'lobby' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
            <div className="text-7xl font-black text-green-400">🎰 BINGO!</div>
            <div className="text-gray-300 text-lg text-center max-w-lg">
              Each student gets a random 5×5 bingo card with terms.<br />
              Definitions are called one by one — mark matching terms!
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
              START BINGO →
            </button>
          </motion.div>
        )}

        {/* PLAYING */}
        {phase === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex gap-0 overflow-hidden">
            {/* Left: Called terms list */}
            <div className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-3 overflow-y-auto">
              <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">
                Called ({calledTerms.length})
              </div>
              {calledTerms.map((t, i) => (
                <div key={i} className={`py-2 px-3 rounded-lg mb-1 text-sm border
                  ${i === 0 ? 'bg-green-900 border-green-600 text-white font-bold' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                  <div className="font-bold">{t.term}</div>
                  <div className="text-xs opacity-70 truncate">{t.definition}</div>
                </div>
              ))}
              {calledTerms.length === 0 && (
                <div className="text-gray-700 text-xs">No terms called yet</div>
              )}
            </div>

            {/* Center: Current definition + controls */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
              {currentTerm ? (
                <>
                  <div className="text-gray-400 text-sm uppercase tracking-widest">
                    Term #{calledTerms.length} of many
                  </div>
                  <div className="text-center bg-gray-900 border-2 border-green-500 rounded-2xl p-8 max-w-3xl w-full">
                    <div className="text-gray-400 text-lg mb-3">Which term means:</div>
                    <div className="text-4xl font-bold text-white leading-relaxed">{currentTerm.definition}</div>
                  </div>
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="bg-green-900 border-2 border-green-400 rounded-xl p-4 text-center">
                    <div className="text-green-300 text-sm uppercase tracking-widest mb-1">Answer</div>
                    <div className="text-3xl font-black text-white">{currentTerm.term}</div>
                  </motion.div>
                </>
              ) : (
                <div className="text-center">
                  <div className="text-5xl font-black text-gray-600 mb-4">🎰</div>
                  <div className="text-2xl text-gray-500">Press "Call Next Term" to start!</div>
                </div>
              )}

              <button onClick={handleCallNext}
                className="px-10 py-5 text-2xl font-black rounded-2xl text-white"
                style={{ backgroundColor: '#680001' }}>
                Call Next Term 🎰
              </button>

              {/* Winners list */}
              {bingoWinners.length > 0 && (
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 w-full max-w-md">
                  <div className="text-gray-400 text-sm uppercase tracking-widest mb-2">🏆 Winners</div>
                  {bingoWinners.map((w, i) => (
                    <div key={i} className={`flex items-center justify-between py-2 border-b border-gray-800 last:border-0
                      ${w.type === 'blackout' ? 'text-yellow-400' : 'text-green-400'}`}>
                      <span className="font-bold">{w.type === 'blackout' ? '🌟 BLACKOUT' : '🎉 BINGO'}</span>
                      <span className="text-white font-bold">{w.playerName}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Player status grid */}
            <div className="w-64 bg-gray-900 border-l border-gray-800 flex flex-col p-3 overflow-y-auto">
              <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">
                Players ({playerStatuses.length})
              </div>
              {playerStatuses.map((p) => (
                <div key={p.name}
                  className={`mb-2 p-3 rounded-xl border text-sm transition-all
                    ${p.hasBlackout ? 'bg-yellow-900 border-yellow-500' : p.hasBingo ? 'bg-green-900 border-green-600' : 'bg-gray-800 border-gray-700'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white truncate">{p.name}</span>
                    {p.hasBlackout && <span className="text-yellow-400 text-xs font-black">BLACKOUT!</span>}
                    {p.hasBingo && !p.hasBlackout && <span className="text-green-400 text-xs font-black">BINGO!</span>}
                  </div>
                  {p.hasBingo && (
                    <button onClick={() => handleVerifyBingo(p.name)}
                      className="mt-2 w-full py-1 rounded text-xs font-bold bg-green-700 hover:bg-green-600 text-white">
                      Verify ✓
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* GAME OVER */}
        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
            <div className="text-6xl font-black text-green-400">GAME OVER!</div>
            <div className="w-full max-w-lg">
              <div className="text-gray-400 text-sm uppercase tracking-widest mb-3 text-center">Final Winners</div>
              {bingoWinners.map((w, i) => (
                <motion.div key={i} initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className={`flex items-center justify-between p-4 rounded-xl mb-2 border
                    ${w.type === 'blackout' ? 'bg-yellow-900 border-yellow-500' : 'bg-green-900 border-green-600'}`}>
                  <span className="text-2xl">{w.type === 'blackout' ? '🌟' : '🎉'}</span>
                  <span className="text-white font-black text-xl flex-1 ml-3">{w.playerName}</span>
                  <span className={`font-black text-sm ${w.type === 'blackout' ? 'text-yellow-400' : 'text-green-400'}`}>
                    {w.type === 'blackout' ? 'BLACKOUT!' : 'BINGO!'}
                  </span>
                </motion.div>
              ))}
              {bingoWinners.length === 0 && (
                <div className="text-gray-500 text-center">No winners this game.</div>
              )}
            </div>
            <button onClick={() => navigate('/dashboard')}
              className="px-8 py-4 text-xl font-black rounded-xl text-white bg-gray-700 hover:bg-gray-600">
              Back to Dashboard
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {(location.state as any)?.settings?.noJoin && <ManualScorePanel pin={(location.state as any)?.pin} />}
    </div>
  );
}
