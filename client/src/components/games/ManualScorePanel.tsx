import { useState, useEffect } from 'react';
import { getSocket } from '../../lib/socket';

interface PlayerScore {
  name: string;
  score: number;
  team?: string;
}

interface Props {
  pin: string;
}

const POINT_OPTIONS = [100, 200, 500, 1000];

export default function ManualScorePanel({ pin }: Props) {
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [points, setPoints] = useState(100);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    // Pick up players as they're added (including virtual players pre-populated at game start)
    socket.on('player_joined', (data: { players?: PlayerScore[] }) => {
      if (data.players) {
        setScores(data.players.map(p => ({ name: p.name, team: p.team, score: 0 })));
      }
    });

    socket.on('leaderboard_update', (data: { scores?: PlayerScore[]; rankings?: PlayerScore[] }) => {
      const list = data.scores || data.rankings;
      if (list) setScores(list);
    });

    socket.on('game_over', (data: { scores?: PlayerScore[] }) => {
      if (data.scores) setScores(data.scores);
    });

    return () => {
      socket.off('player_joined');
      socket.off('leaderboard_update');
      socket.off('game_over');
    };
  }, []);

  const adjust = (playerName: string, delta: number) => {
    getSocket().emit('manual_score', { pin, playerName, delta });
    setScores(prev =>
      prev
        .map(p => p.name === playerName ? { ...p, score: p.score + delta } : p)
        .sort((a, b) => b.score - a.score)
    );
  };

  if (scores.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 w-72 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden"
      style={{ backgroundColor: '#0f0f0f' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        style={{ backgroundColor: '#680001' }}
        onClick={() => setMinimized(m => !m)}
      >
        <div className="flex items-center gap-2">
          <span className="text-white font-black text-sm tracking-wide">SCORE CONTROL</span>
          <span className="bg-white bg-opacity-20 text-white text-xs px-2 py-0.5 rounded-full font-bold">
            {scores.length}
          </span>
        </div>
        <span className="text-white text-lg">{minimized ? '▲' : '▼'}</span>
      </div>

      {!minimized && (
        <>
          {/* Point value selector */}
          <div className="flex gap-1 px-3 py-2 bg-gray-900 border-b border-gray-700">
            <span className="text-gray-400 text-xs self-center mr-1">pts:</span>
            {POINT_OPTIONS.map(p => (
              <button
                key={p}
                onClick={() => setPoints(p)}
                className={`flex-1 py-1 rounded text-xs font-bold transition-colors ${
                  points === p
                    ? 'text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
                style={points === p ? { backgroundColor: '#680001' } : {}}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Player rows */}
          <div className="max-h-80 overflow-y-auto">
            {scores.map((p, i) => (
              <div
                key={p.name}
                className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 hover:bg-gray-900 transition-colors"
              >
                <span className="text-gray-500 text-xs w-4 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-bold truncate">{p.name}</div>
                  <div className="text-gray-400 text-xs font-mono">{p.score.toLocaleString()} pts</div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => adjust(p.name, -points)}
                    className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-red-900 text-white text-sm font-black transition-colors"
                  >
                    −
                  </button>
                  <button
                    onClick={() => adjust(p.name, points)}
                    className="w-7 h-7 rounded-lg text-white text-sm font-black transition-colors"
                    style={{ backgroundColor: '#680001' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#8b0001')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#680001')}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
