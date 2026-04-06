import { useState, useEffect } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'
import { statsApi } from '../../lib/api'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { Card } from '../common/Card'

interface StatsData {
  totalGames: number
  totalStudents: number
  totalQuestions: number
  gameTypeCounts: Array<{ game_type: string; count: number }>
  topStudents: Array<{ name: string; avgScore: number; gamesPlayed: number }>
}

const GAME_COLORS = [
  '#680001', '#8a0001', '#4a0001', '#ef4444', '#dc2626',
  '#b91c1c', '#991b1b', '#7f1d1d', '#450a0a', '#fca5a5',
  '#f87171', '#fecaca',
]

const GAME_LABELS: Record<string, string> = {
  jeopardy: 'Jeopardy',
  kahoot: 'Kahoot',
  millionaire: 'Millionaire',
  escaperoom: 'Escape Room',
  hotseat: 'Hot Seat',
  speedround: 'Speed Round',
  battleroyale: 'Battle Royale',
  wager: 'Wager',
  bingo: 'Bingo',
  ranked: 'Ranked!',
  teamtakeover: 'Team Takeover',
  codebreaker: 'Code Breaker',
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 flex items-center gap-4">
      <div className="text-4xl">{icon}</div>
      <div>
        <div className="text-3xl font-display font-black text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="text-sm text-gray-400 font-medium">{label}</div>
      </div>
    </div>
  )
}

export function StatsDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    statsApi.getOverview()
      .then(setStats)
      .catch(() => setStats({
        totalGames: 0, totalStudents: 0, totalQuestions: 0,
        gameTypeCounts: [], topStudents: []
      }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner size="lg" label="Loading stats..." className="py-20" />

  if (!stats) return null

  const pieData = stats.gameTypeCounts.map(item => ({
    name: GAME_LABELS[item.game_type] || item.game_type,
    value: item.count,
  }))

  const barData = stats.topStudents.slice(0, 10).map(s => ({
    name: s.name.split(' ')[0], // First name only for space
    score: Math.round(s.avgScore),
    games: s.gamesPlayed,
  }))

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Games Played" value={stats.totalGames} icon="🎮" />
        <StatCard label="Unique Students" value={stats.totalStudents} icon="🎓" />
        <StatCard label="Questions in Banks" value={stats.totalQuestions} icon="❓" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Game type pie chart */}
        <Card>
          <h3 className="font-bold text-white mb-4">Games by Type</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((_, idx) => (
                    <Cell key={idx} fill={GAME_COLORS[idx % GAME_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #680001', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#ccc' }}
                />
                <Legend
                  formatter={(val) => <span style={{ color: '#ccc', fontSize: 12 }}>{val}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">No game data yet</div>
          )}
        </Card>

        {/* Top students bar chart */}
        <Card>
          <h3 className="font-bold text-white mb-4">Top Students (Avg Score)</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#111', border: '1px solid #680001', borderRadius: 8 }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#ccc' }}
                />
                <Bar dataKey="score" fill="#680001" radius={[4, 4, 0, 0]} name="Avg Score" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">No student data yet</div>
          )}
        </Card>
      </div>
    </div>
  )
}
