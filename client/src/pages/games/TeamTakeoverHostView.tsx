import ManualScorePanel from '../../components/games/ManualScorePanel';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface Team {
  name: string;
  color: string;
  score: number;
  cellCount: number;
}

interface Question {
  text: string;
  options: string[];
  correctIndex: number;
  index: number;
  total: number;
  currentTeam: string;
  grid: GridCell[][];
  teamScores: Record<string, number>;
}

type GridCell = string | null;

const TEAM_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  'Team Alpha':   { bg: 'bg-red-600',    text: 'text-white', hex: '#dc2626' },
  'Team Beta':    { bg: 'bg-blue-600',   text: 'text-white', hex: '#2563eb' },
  'Team Gamma':   { bg: 'bg-green-600',  text: 'text-white', hex: '#16a34a' },
  'Team Delta':   { bg: 'bg-yellow-500', text: 'text-black', hex: '#eab308' },
  'Team Epsilon': { bg: 'bg-purple-600', text: 'text-white', hex: '#9333ea' },
  'Team Zeta':    { bg: 'bg-orange-500', text: 'text-white', hex: '#f97316' },
};

const GRID_SIZE = 6;
const DEFAULT_TEAMS = ['Team Alpha', 'Team Beta', 'Team Gamma', 'Team Delta'];

type Phase = 'lobby' | 'question' | 'claiming' | 'gameover';

export default function TeamTakeoverHostView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { pin, bankId, settings } = (location.state as { pin: string; bankId: string; settings: Record<string, unknown> }) || {};
  const noJoin = (settings as any)?.noJoin;

  const teamNames: string[] = (settings as { teams?: string[] })?.teams || DEFAULT_TEAMS;

  const [grid, setGrid] = useState<GridCell[][]>(
    Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null))
  );
  const [teams, setTeams] = useState<Team[]>(
    teamNames.map(name => ({ name, color: TEAM_COLORS[name]?.hex || '#680001', score: 0, cellCount: 0 }))
  );
  const [currentTeamName, setCurrentTeamName] = useState(teamNames[0] ?? '');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [phase, setPhase] = useState<Phase>('lobby');
  const [players, setPlayers] = useState<{ name: string; team: string }[]>([]);
  const [claimableCells, setClaimableCells] = useState<[number, number][]>([]);
  const [lastClaimed, setLastClaimed] = useState<{ row: number; col: number } | null>(null);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('host_game', { pin, gameType: 'teamtakeover', bankId, settings });

    socket.on('player_joined', (data: { players: { name: string; team: string }[] }) => {
      setPlayers(data.players);
    });

    socket.on('question_reveal', (data: Question) => {
      setCurrentQuestion(data);
      setCurrentTeamName(data.currentTeam);
      setShowCorrectAnswer(false);
      setClaimableCells([]);
      setLastClaimed(null);
      if (data.grid) setGrid(data.grid);
      if (data.teamScores) {
        setTeams(prev => prev.map(t => ({
          ...t,
          score: data.teamScores[t.name] ?? t.score,
        })));
      }
      setPhase('question');
    });

    socket.on('territory_update', (data: { grid: GridCell[][]; teamScores: Record<string, number>; territoryCounts: Record<string, number> }) => {
      setGrid(data.grid);
      setTeams(prev => prev.map(t => ({
        ...t,
        score: data.teamScores[t.name] ?? t.score,
        cellCount: data.territoryCounts[t.name] ?? 0,
      })));
    });

    // Server confirms which cells are claimable after a correct answer
    socket.on('teamtakeover:claimable', (data: { cells: [number, number][]; team: string }) => {
      setClaimableCells(data.cells);
      setPhase('claiming');
    });

    socket.on('game_over', () => setPhase('gameover'));

    return () => {
      socket.off('player_joined');
      socket.off('question_reveal');
      socket.off('territory_update');
      socket.off('teamtakeover:claimable');
      socket.off('game_over');
    };
  }, []);

  const socket = getSocket();

  const handleStart = () => {
    socket.emit('teamtakeover:start', { pin, teams: teamNames });
  };

  // Host marks current team's verbal answer as CORRECT
  const handleCorrect = () => {
    setShowCorrectAnswer(true);
    socket.emit('teamtakeover:correct', { pin });
  };

  // Host marks current team's verbal answer as WRONG
  const handleWrong = () => {
    socket.emit('teamtakeover:wrong', { pin });
  };

  // Host selects which cell to award after correct answer
  const handleCellClick = (row: number, col: number) => {
    if (phase !== 'claiming') return;
    if (!claimableCells.some(([r, c]) => r === row && c === col)) return;

    socket.emit('teamtakeover:claim', { pin, row, col, teamName: currentTeamName });
    setLastClaimed({ row, col });
    setClaimableCells([]);

    // Advance to next question
    socket.emit('teamtakeover:next', { pin });
    setPhase('question');
  };

  const handleEnd = () => {
    socket.emit('teamtakeover:end', { pin });
    navigate('/dashboard');
  };

  const totalCells = GRID_SIZE * GRID_SIZE;
  const currentTeamStyle = TEAM_COLORS[currentTeamName] || { bg: 'bg-red-600', text: 'text-white', hex: '#dc2626' };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-black border-b border-gray-800">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black" style={{ color: '#680001' }}>UNOH</span>
          <span className="text-orange-400 font-black text-lg">🗺 TEAM TAKEOVER</span>
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
            <div className="text-6xl font-black text-orange-400">🗺 TEAM TAKEOVER</div>
            <div className="text-gray-300 text-lg text-center max-w-lg">
              Answer correctly to claim territory on the grid!<br />
              The team with the most cells wins.
            </div>
            {!noJoin && (
              <div className="text-center">
                <div className="text-gray-400 text-xl">Join at unoh.review — PIN:</div>
                <div className="text-7xl font-black text-white tracking-widest">{pin}</div>
              </div>
            )}
            <div className="flex flex-wrap gap-3 justify-center">
              {teamNames.map(name => {
                const style = TEAM_COLORS[name] || { bg: 'bg-gray-600', text: 'text-white' };
                return (
                  <div key={name} className={`${style.bg} ${style.text} px-5 py-3 rounded-xl font-bold text-lg`}>
                    {name}
                  </div>
                );
              })}
            </div>
            {!noJoin && <div className="text-xl text-white">{players.length} player{players.length !== 1 ? 's' : ''} joined</div>}
            <button onClick={handleStart} disabled={!noJoin && players.length === 0}
              className="px-12 py-5 text-2xl font-black rounded-2xl text-white disabled:opacity-50"
              style={{ backgroundColor: '#680001' }}>
              START GAME →
            </button>
          </motion.div>
        )}

        {/* GAME PHASES */}
        {(phase === 'question' || phase === 'claiming') && (
          <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex gap-0 overflow-hidden">
            {/* Left: Team scores */}
            <div className="w-52 bg-black border-r border-gray-800 flex flex-col p-3 overflow-y-auto">
              <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-3">Territories</div>
              {teams.map(team => {
                const style = TEAM_COLORS[team.name] || { bg: 'bg-gray-600', text: 'text-white', hex: '#4b5563' };
                const isCurrentTurn = team.name === currentTeamName;
                return (
                  <div key={team.name}
                    className={`mb-3 p-3 rounded-xl border transition-all ${isCurrentTurn ? 'border-white scale-105' : 'border-gray-800'}`}
                    style={{ backgroundColor: isCurrentTurn ? style.hex + '33' : '#111827' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: style.hex }} />
                      <span className="text-white font-bold text-sm truncate">{team.name}</span>
                      {isCurrentTurn && <span className="text-xs text-yellow-400 ml-auto">← TURN</span>}
                    </div>
                    <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(team.cellCount / totalCells) * 100}%`, backgroundColor: style.hex }} />
                    </div>
                    <div className="text-gray-400 text-xs mt-1">{team.cellCount} cells ({Math.round((team.cellCount / totalCells) * 100)}%)</div>
                  </div>
                );
              })}
            </div>

            {/* Center: Grid + Question */}
            <div className="flex-1 flex flex-col items-center justify-start p-4 gap-4 overflow-y-auto">
              {/* Current turn indicator */}
              <div className={`${currentTeamStyle.bg} ${currentTeamStyle.text} px-6 py-2 rounded-xl font-black text-lg`}>
                {phase === 'claiming' ? `${currentTeamName} — CHOOSE A CELL TO CLAIM` : `${currentTeamName}'s Turn`}
              </div>

              {/* Territory Grid */}
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}>
                {grid.map((row, ri) =>
                  row.map((cell, ci) => {
                    const style = cell ? TEAM_COLORS[cell] : null;
                    const isClaimable = claimableCells.some(([r, c]) => r === ri && c === ci);
                    const isLastClaimed = lastClaimed?.row === ri && lastClaimed?.col === ci;
                    return (
                      <motion.button
                        key={`${ri}-${ci}`}
                        onClick={() => handleCellClick(ri, ci)}
                        animate={isLastClaimed ? { scale: [1, 1.3, 1] } : isClaimable ? { scale: [1, 1.05, 1] } : {}}
                        transition={{ repeat: isClaimable ? Infinity : 0, duration: 1 }}
                        className={`w-14 h-14 rounded-lg border-2 flex items-center justify-center text-xs font-bold transition-all
                          ${style ? `${style.bg} ${style.text} border-transparent` : ''}
                          ${!cell && !isClaimable ? 'bg-gray-800 border-gray-700 text-gray-600 cursor-default' : ''}
                          ${isClaimable ? 'border-white cursor-pointer' : ''}
                        `}
                        style={!cell && isClaimable ? { backgroundColor: currentTeamStyle.hex + '55', borderColor: 'white' } : {}}
                      >
                        {cell ? (cell.split(' ')[1]?.[0] || '?') : isClaimable ? '+' : ''}
                      </motion.button>
                    );
                  })
                )}
              </div>

              {/* Question */}
              {currentQuestion && phase === 'question' && (
                <div className="w-full max-w-2xl bg-gray-900 rounded-xl p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">
                    Q {(currentQuestion.index ?? 0) + 1} / {currentQuestion.total}
                  </div>
                  <div className="text-2xl font-bold text-white mb-3">{currentQuestion.text}</div>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {currentQuestion.options.map((opt, i) => {
                      const isCorrect = showCorrectAnswer && i === currentQuestion.correctIndex;
                      return (
                        <div key={i}
                          className={`border rounded-lg p-3 flex items-center gap-2 transition-all
                            ${isCorrect ? 'bg-green-800 border-green-400 text-white' : 'bg-gray-800 border-gray-700'}`}>
                          <span className={`font-black ${isCorrect ? 'text-green-300' : 'text-gray-400'}`}>
                            {['A', 'B', 'C', 'D'][i]}.
                          </span>
                          <span className="text-white font-medium">{opt}</span>
                          {isCorrect && <span className="ml-auto text-green-300">✓</span>}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={handleCorrect}
                      className="flex-1 py-3 font-black rounded-lg text-white bg-green-700 hover:bg-green-600 transition-colors">
                      ✓ CORRECT — Claim Cell
                    </button>
                    <button onClick={handleWrong}
                      className="flex-1 py-3 font-black rounded-lg text-white bg-red-700 hover:bg-red-600 transition-colors">
                      ✗ WRONG — Next Team
                    </button>
                    {!showCorrectAnswer && (
                      <button onClick={() => setShowCorrectAnswer(true)}
                        className="px-4 py-3 font-bold rounded-lg text-white bg-gray-700 hover:bg-gray-600 text-sm">
                        Show Answer
                      </button>
                    )}
                  </div>
                </div>
              )}

              {phase === 'claiming' && (
                <div className="text-yellow-400 font-bold text-lg animate-pulse">
                  Click a highlighted cell to claim it for {currentTeamName}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* GAME OVER */}
        {phase === 'gameover' && (
          <motion.div key="gameover" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
            <div className="text-6xl font-black text-orange-400">GAME OVER!</div>
            <div className="w-full max-w-lg space-y-3">
              {[...teams].sort((a, b) => b.cellCount - a.cellCount).map((team, i) => {
                const style = TEAM_COLORS[team.name] || { bg: 'bg-gray-600', text: 'text-white', hex: '#4b5563' };
                return (
                  <motion.div key={team.name} initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className={`${style.bg} ${style.text} rounded-2xl p-5 flex items-center justify-between`}>
                    <span className="text-2xl font-black">{i === 0 ? '👑 ' : `${i + 1}. `}{team.name}</span>
                    <span className="text-xl font-black">{team.cellCount} cells</span>
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
      {noJoin && <ManualScorePanel pin={pin} />}
    </div>
  );
}
