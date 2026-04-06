import { useEffect, useState } from 'react';
import { AdminNav } from '../../components/admin/AdminNav';
import { api } from '../../lib/api';

const GAME_ICONS: Record<string, string> = {
  jeopardy: '📺', kahoot: '⚡', millionaire: '💰', battleroyale: '⚔️',
  escaperoom: '🔐', hotseat: '🔥', speedround: '🚀', wager: '🎲',
  bingo: '🎱', ranked: '📊', teamtakeover: '🗺️', codebreaker: '🔑',
};

export default function SessionHistoryPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    api.get('/sessions').then(r => setSessions(r.data)).catch(() => {});
  }, []);

  const loadDetail = async (id: number) => {
    if (expanded === id) { setExpanded(null); return; }
    const r = await api.get(`/sessions/${id}`);
    setDetail(r.data);
    setExpanded(id);
  };

  const exportCSV = (id: number) => { window.location.href = `/api/sessions/${id}/export`; };

  const formatDuration = (start: string, end: string) => {
    if (!end) return '—';
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / 1000;
    if (diff < 60) return `${Math.round(diff)}s`;
    return `${Math.round(diff / 60)}m`;
  };

  return (
    <div className="min-h-screen bg-black">
      <AdminNav />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Session History</h1>

        {sessions.length === 0 ? (
          <div className="text-center text-gray-600 py-20">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-xl">No sessions yet</p>
            <p className="text-sm mt-2">Completed games will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s: any) => (
              <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div
                  className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-800/50 transition-colors"
                  onClick={() => loadDetail(s.id)}>
                  <span className="text-2xl">{GAME_ICONS[s.game_type] || '🎮'}</span>
                  <div className="flex-1">
                    <div className="text-white font-medium capitalize">{s.game_type.replace(/([a-z])([A-Z])/g, '$1 $2')}</div>
                    <div className="text-gray-500 text-sm">{s.course_name || 'No course'} · {s.player_count || 0} players</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-gray-300 text-sm">{new Date(s.started_at).toLocaleDateString()}</div>
                    <div className="text-gray-600 text-xs">{formatDuration(s.started_at, s.ended_at)}</div>
                  </div>
                  {s.top_score != null && (
                    <div className="text-right">
                      <div className="text-yellow-400 font-bold">🏆 {s.top_score?.toLocaleString()}</div>
                      <div className="text-gray-600 text-xs">top score</div>
                    </div>
                  )}
                  <span className="text-gray-600">{expanded === s.id ? '▲' : '▼'}</span>
                </div>

                {expanded === s.id && detail && detail.id === s.id && (
                  <div className="border-t border-gray-800 px-5 py-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-white font-medium">Players ({detail.players?.length || 0})</h3>
                      <button onClick={() => exportCSV(s.id)} className="btn-secondary text-xs px-3 py-1">Export CSV</button>
                    </div>
                    <div className="space-y-2">
                      {detail.players?.slice(0, 10).map((p: any, i: number) => (
                        <div key={p.id} className="flex items-center gap-3">
                          <span className={`text-sm font-bold w-6 text-center ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-600'}`}>
                            #{i + 1}
                          </span>
                          <span className="text-white flex-1">{p.name}</span>
                          {p.team && <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{p.team}</span>}
                          <span className="text-white font-mono">{p.final_score?.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
