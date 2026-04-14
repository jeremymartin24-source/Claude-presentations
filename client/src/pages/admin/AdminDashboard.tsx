import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminContext } from '../../context/AdminContext';
import { AdminNav } from '../../components/admin/AdminNav';
import { StatsDashboard } from '../../components/admin/StatsDashboard';
import { api } from '../../lib/api';

export default function AdminDashboard() {
  const { logout } = useAdminContext();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    api.get('/stats/overview').then(r => setStats(r.data)).catch(() => {});
    api.get('/stats/recent').then(r => setRecent(r.data)).catch(() => {});
  }, []);

  const handleRunAgain = useCallback((s: any) => {
    navigate('/admin/launch', {
      state: {
        prefill: {
          gameType: s.game_type,
          bankId:   s.bank_id,
          courseId: s.course_id,
          settings: s.settings,
        },
      },
    });
  }, [navigate]);

  const GAME_ICONS: Record<string, string> = {
    jeopardy: '📺', kahoot: '⚡', millionaire: '💰', battleroyale: '⚔️',
    escaperoom: '🔐', hotseat: '🔥', speedround: '🚀', wager: '🎲',
    bingo: '🎱', ranked: '📊', teamtakeover: '🗺️', codebreaker: '🔑',
  };

  return (
    <div className="min-h-screen bg-black">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-400 mt-1">Welcome back, Professor Martin</p>
          </div>
          <button onClick={() => navigate('/admin/launch')}
            className="btn-primary text-lg px-8">
            🚀 Launch Game
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Games Played', value: stats.totalGames, icon: '🎮' },
              { label: 'Total Players', value: stats.totalPlayers, icon: '👥' },
              { label: 'Avg Score', value: stats.avgScore?.toLocaleString(), icon: '⭐' },
              { label: 'Courses', value: stats.gameTypeCounts?.length || 0, icon: '📚' },
            ].map(card => (
              <div key={card.label} className="game-card text-center">
                <div className="text-3xl mb-2">{card.icon}</div>
                <div className="text-3xl font-bold text-white">{card.value}</div>
                <div className="text-gray-400 text-sm mt-1">{card.label}</div>
              </div>
            ))}
          </div>
        )}

        {stats && <StatsDashboard />}

        {/* Recent Sessions */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Recent Sessions</h2>
            <button onClick={() => navigate('/admin/history')} className="text-unoh-red hover:text-red-300 text-sm">
              View all →
            </button>
          </div>
          <div className="space-y-2">
            {recent.map((s: any) => (
              <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center justify-between hover:border-gray-600 transition-colors group">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{GAME_ICONS[s.game_type] || '🎮'}</span>
                  <div>
                    <div className="text-white font-medium capitalize">{s.game_type}</div>
                    <div className="text-gray-500 text-sm">{s.course_name || 'No course'} · {s.player_count} players</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-gray-400 text-sm">{new Date(s.ended_at || s.started_at).toLocaleDateString()}</div>
                  <button
                    onClick={() => handleRunAgain(s)}
                    className="opacity-0 group-hover:opacity-100 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-700 text-gray-300 hover:border-unoh-red hover:text-white transition-all"
                    title="Re-launch this game">
                    ▶ Run Again
                  </button>
                </div>
              </div>
            ))}
            {recent.length === 0 && (
              <div className="text-center text-gray-600 py-10">No sessions yet. Launch your first game!</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
