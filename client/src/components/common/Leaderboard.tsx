import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'

interface LeaderboardEntry {
  name: string
  team?: string
  score: number
  rank: number
  streak?: number
}

interface LeaderboardProps {
  entries: LeaderboardEntry[]
  highlightName?: string
  maxRows?: number
  compact?: boolean
}

const rankColors: Record<number, string> = {
  1: 'bg-yellow-500 text-black',
  2: 'bg-gray-400 text-black',
  3: 'bg-amber-600 text-white',
}

const rankEmoji: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
}

export function Leaderboard({ entries, highlightName, maxRows = 10, compact = false }: LeaderboardProps) {
  const visible = entries.slice(0, maxRows)

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {visible.map((entry, idx) => {
          const isHighlighted = entry.name === highlightName
          const rankBadgeClass = rankColors[entry.rank] || 'bg-gray-700 text-white'

          return (
            <motion.div
              key={entry.name}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className={clsx(
                'flex items-center gap-3 rounded-xl border transition-all',
                compact ? 'px-3 py-2' : 'px-4 py-3',
                isHighlighted
                  ? 'bg-unoh-red/20 border-unoh-red shadow-lg shadow-red-900/30'
                  : 'bg-gray-900 border-gray-700'
              )}
            >
              {/* Rank badge */}
              <div className={clsx(
                'flex-shrink-0 font-bold rounded-lg flex items-center justify-center',
                compact ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm',
                rankBadgeClass
              )}>
                {rankEmoji[entry.rank] || `#${entry.rank}`}
              </div>

              {/* Name + Team */}
              <div className="flex-1 min-w-0">
                <div className={clsx(
                  'font-bold truncate',
                  compact ? 'text-sm' : 'text-base',
                  isHighlighted ? 'text-white' : 'text-gray-100'
                )}>
                  {entry.name}
                  {isHighlighted && <span className="ml-2 text-xs text-unoh-red font-normal">(you)</span>}
                </div>
                {entry.team && (
                  <div className="text-xs text-gray-400 truncate">{entry.team}</div>
                )}
              </div>

              {/* Streak indicator */}
              {entry.streak && entry.streak >= 2 && (
                <div className="text-orange-400 text-xs font-bold">
                  🔥{entry.streak}
                </div>
              )}

              {/* Score */}
              <motion.div
                key={`score-${entry.score}`}
                initial={{ scale: 1.3, color: '#fbbf24' }}
                animate={{ scale: 1, color: '#ffffff' }}
                transition={{ duration: 0.4 }}
                className={clsx(
                  'font-display font-bold tabular-nums flex-shrink-0',
                  compact ? 'text-base' : 'text-xl',
                  isHighlighted ? 'text-yellow-300' : 'text-white'
                )}
              >
                {entry.score.toLocaleString()}
              </motion.div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
