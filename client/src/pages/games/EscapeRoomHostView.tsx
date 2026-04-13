import ManualScorePanel from '../../components/games/ManualScorePanel';
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface EscapeTeam {
  id: string;
  name: string;
  puzzlesCompleted: number;
  totalPuzzles: number;
  hintCount: number;
  escaped: boolean;
  escapedAt?: number; // seconds
  currentPuzzle?: string;
}

type Phase = 'lobby' | 'playing' | 'gameover';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function EscapeRoomHostView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pin, bankId, settings } = (location.state as { pin: string; bankId: string; settings: Record<string, unknown> }) || {};

  const [phase, setPhase] = useState<Phase>('lobby');
  const [teams, setTeams] = useState<EscapeTeam[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<EscapeTeam | null>(null);
  const [players, setPlayers] = useState<{ name: string }[]>([]);
  const [newEscape, setNewEscape] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('host_game', { pin, gameType: 'escaperoom', bankId, settings });

    socket.on('player_joined', (data: { players: { name: string; teamId: string; teamName: string }[] }) => {
      setPlayers(data.players);
      // Build teams from player data
      const teamMap: Record<string, EscapeTeam> = {};
      data.players.forEach((p) => {
        if (!teamMap[p.teamId]) {
          teamMap[p.teamId] = {
            id: p.teamId,
            name: p.teamName || p.teamId,
            puzzlesCompleted: 0,
            totalPuzzles: 5,
            hintCount: 0,
            escaped: false,
          };
        }
      });
      setTeams(Object.values(teamMap));
    });

    socket.on('escape:puzzle_solved', (data: { teamId: string; puzzleIndex: number }) => {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === data.teamId
            ? { ...t, puzzlesCompleted: Math.max(t.puzzlesCompleted, data.puzzleIndex + 1) }
            : t
        )
      );
    });

    socket.on('escape:team_escaped', (data: { teamId: string; completionTime: number }) => {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === data.teamId ? { ...t, escaped: true, escapedAt: data.completionTime, puzzlesCompleted: t.totalPuzzles } : t
        )
      );
      const team = teams.find((t) => t.id === data.teamId);
      if (team) {
        setNewEscape(team.name);
        setTimeout(() => setNewEscape(null), 4000);
      }
    });

    socket.on('escape:hint_used', (data: { teamId: string }) => {
      setTeams((prev) =>
        prev.map((t) => t.id === data.teamId ? { ...t, hintCount: t.hintCount + 1 } : t)
      );
    });

    socket.on('game_over', () => {
      setPhase('gameover');
      setTimerActive(false);
    });

    return () => {
      socket.off('player_joined');
      socket.off('escape:puzzle_solved');
      socket.off('escape:team_escaped');
      socket.off('escape:hint_used');
      socket.off('game_over');
    };
  }, [teams]);

  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => setElapsedTime((t) => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive]);

  const socket = getSocket();

  const handleStart = () => {
    socket.emit('escaperoom:start', { pin });
    setPhase('playing');
    setTimerActive(true);
    setElapsedTime(0);
  };

  const handleEnd = () => {
    socket.emit('escaperoom:end', { pin });
    setTimerActive(false);
    setPhase('gameover');
  };

  const sortedTeams = [...teams].sort((a, b) => {
    if (a.escaped && b.escaped) return (a.escapedAt || 0) - (b.escapedAt || 0);
    if (a.escaped) return -1;
    if (b.escaped) return 1;
    return b.puzzlesCompleted - a.puzzlesCompleted;
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-black border-b border-gray-800">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black" style={{ color: '#680001' }}>UNOH</span>
          <span className="text-cyan-400 font-black text-lg">🔐 ESCAPE ROOM</span>
        </div>
        <div className="flex items-center gap-4">
          {phase === 'playing' && (
            <div className="bg-gray-900 border border-cyan-700 rounded-lg px-5 py-2 text-center">
              <div className="text-xs text-cyan-400 uppercase tracking-widest">Elapsed</div>
              <div className="text-2xl font-black text-white font-mono">{formatTime(elapsedTime)}</div>
            </div>
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

      {/* Escape alert */}
      <AnimatePresence>
        {newEscape && (
          <motion.div initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white font-black text-2xl px-8 py-4 rounded-2xl shadow-2xl">
            🎉 {newEscape} ESCAPED! — {formatTime(elapsedTime)}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* LOBBY */}
        {phase === 'lobby' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
            <div className="text-6xl font-black text-cyan-400">🔐 ESCAPE ROOM</div>
            <div className="text-gray-300 text-lg text-center max-w-lg">
              Teams work together to solve 5 puzzles and escape.<br />
              Hints are available but cost time. First team out wins!
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-xl">Join at unoh.review — PIN:</div>
              <div className="text-7xl font-black text-white tracking-widest">{pin}</div>
            </div>
            <div className="text-xl text-white">{players.length} player{players.length !== 1 ? 's' : ''} joined</div>
            <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
              {players.slice(0, 20).map((p) => (
                <motion.span key={p.name} initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm">{p.name}</motion.span>
              ))}
            </div>
            <button onClick={handleStart} disabled={players.length === 0}
              className="px-12 py-5 text-2xl font-black rounded-2xl text-white disabled:opacity-50"
              style={{ backgroundColor: '#680001' }}>
              START ESCAPE →
            </button>
          </motion.div>
        )}

        {/* PLAYING */}
        {phase === 'playing' && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex gap-0 overflow-hidden">
            {/* Team cards grid */}
            <div className="flex-1 p-5 overflow-y-auto">
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                {teams.map((team) => (
                  <motion.div
                    key={team.id}
                    onClick={() => setSelectedTeam(selectedTeam?.id === team.id ? null : team)}
                    whileHover={{ scale: 1.02 }}
                    className={`rounded-2xl border-2 p-5 cursor-pointer transition-all
                      ${team.escaped ? 'bg-green-900 border-green-400' : 'bg-gray-900 border-gray-700 hover:border-gray-500'}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="font-black text-xl text-white">{team.name}</div>
                      {team.escaped ? (
                        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                          className="bg-green-500 text-white text-xs font-black px-2 py-1 rounded-full">
                          ESCAPED!
                        </motion.div>
                      ) : (
                        <div className="text-gray-400 text-sm">{team.puzzlesCompleted}/{team.totalPuzzles} puzzles</div>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="bg-gray-700 rounded-full h-4 overflow-hidden mb-3">
                      <motion.div
                        className={`h-full rounded-full ${team.escaped ? 'bg-green-500' : 'bg-cyan-500'}`}
                        animate={{ width: `${(team.puzzlesCompleted / team.totalPuzzles) * 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>

                    {/* Puzzle dots */}
                    <div className="flex gap-2 mb-3">
                      {Array(team.totalPuzzles).fill(null).map((_, i) => (
                        <div key={i}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-black
                            ${i < team.puzzlesCompleted ? 'bg-green-500 border-green-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-500'}`}>
                          {i < team.puzzlesCompleted ? '✓' : i + 1}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Hints used: <span className="text-yellow-400 font-bold">{team.hintCount}</span></span>
                      {team.escaped && team.escapedAt !== undefined && (
                        <span className="text-green-400 font-black">{formatTime(team.escapedAt)}</span>
                      )}
                    </div>

                    {team.currentPuzzle && !team.escaped && (
                      <div className="mt-2 text-xs text-gray-500 truncate">
                        Current: {team.currentPuzzle}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Selected team detail panel */}
            <AnimatePresence>
              {selectedTeam && (
                <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }}
                  className="w-72 bg-black border-l border-gray-800 flex flex-col p-5 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-black text-white text-xl">{selectedTeam.name}</div>
                    <button onClick={() => setSelectedTeam(null)} className="text-gray-500 hover:text-white text-xl">✕</button>
                  </div>
                  {selectedTeam.escaped ? (
                    <div className="bg-green-900 border border-green-400 rounded-xl p-4 text-center mb-4">
                      <div className="text-4xl mb-2">🎉</div>
                      <div className="text-green-300 font-black text-xl">ESCAPED!</div>
                      {selectedTeam.escapedAt !== undefined && (
                        <div className="text-white font-bold">{formatTime(selectedTeam.escapedAt)}</div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-gray-400 text-sm uppercase tracking-widest">Progress</div>
                      {Array(selectedTeam.totalPuzzles).fill(null).map((_, i) => (
                        <div key={i}
                          className={`flex items-center gap-3 p-3 rounded-xl border
                            ${i < (selectedTeam.puzzlesCompleted || 0) ? 'bg-green-900 border-green-700' : i === selectedTeam.puzzlesCompleted ? 'bg-cyan-900 border-cyan-700 animate-pulse' : 'bg-gray-900 border-gray-800'}`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-black
                            ${i < (selectedTeam.puzzlesCompleted || 0) ? 'bg-green-500 text-white' : i === selectedTeam.puzzlesCompleted ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-500'}`}>
                            {i < (selectedTeam.puzzlesCompleted || 0) ? '✓' : i + 1}
                          </div>
                          <span className="text-white text-sm">
                            {i < (selectedTeam.puzzlesCompleted || 0) ? 'Solved!' : i === selectedTeam.puzzlesCompleted ? 'Working on this...' : 'Locked'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 bg-gray-900 border border-gray-700 rounded-xl p-3">
                    <div className="text-gray-400 text-sm uppercase tracking-widest mb-1">Hints Used</div>
                    <div className="text-3xl font-black text-yellow-400">{selectedTeam.hintCount}</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* GAME OVER */}
        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
            <div className="text-6xl font-black text-cyan-400">ESCAPE COMPLETE!</div>
            <div className="w-full max-w-lg space-y-3">
              {sortedTeams.map((team, i) => (
                <motion.div key={team.id} initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className={`flex items-center justify-between p-4 rounded-2xl border
                    ${team.escaped ? 'bg-green-900 border-green-500' : 'bg-gray-900 border-gray-700'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{i === 0 && team.escaped ? '🥇' : i === 1 && team.escaped ? '🥈' : i === 2 && team.escaped ? '🥉' : team.escaped ? '🎉' : '❌'}</span>
                    <div>
                      <div className="text-white font-black text-lg">{team.name}</div>
                      <div className="text-gray-400 text-sm">{team.puzzlesCompleted}/{team.totalPuzzles} puzzles • {team.hintCount} hints</div>
                    </div>
                  </div>
                  {team.escaped && team.escapedAt !== undefined && (
                    <span className="text-green-400 font-black text-xl">{formatTime(team.escapedAt)}</span>
                  )}
                  {!team.escaped && (
                    <span className="text-gray-500 text-sm">Did not escape</span>
                  )}
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
      {(location.state as any)?.settings?.noJoin && <ManualScorePanel pin={(location.state as any)?.pin} />}
    </div>
  );
}
