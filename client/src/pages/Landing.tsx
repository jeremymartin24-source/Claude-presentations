import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const GAMES = [
  { name: 'Jeopardy', icon: '📺', path: '/game/jeopardy', desc: 'Categories & buzzers' },
  { name: 'Kahoot Quiz', icon: '⚡', path: '/game/kahoot', desc: 'Timed questions' },
  { name: 'Millionaire', icon: '💰', path: '/game/millionaire', desc: 'Lifelines & drama' },
  { name: 'Battle Royale', icon: '⚔️', path: '/game/battleroyale', desc: 'Last one standing' },
  { name: 'Escape Room', icon: '🔐', path: '/game/escaperoom', desc: 'Team puzzles' },
  { name: 'Hot Seat', icon: '🔥', path: '/game/hotseat', desc: 'One vs. class' },
  { name: 'Speed Round', icon: '🚀', path: '/game/speedround', desc: 'Rapid fire' },
  { name: 'Confidence Wager', icon: '🎲', path: '/game/wager', desc: 'Bet your points' },
  { name: 'Blackout Bingo', icon: '🎱', path: '/game/bingo', desc: 'Random bingo cards' },
  { name: 'Ranked!', icon: '📊', path: '/game/ranked', desc: 'Put it in order' },
  { name: 'Team Takeover', icon: '🗺️', path: '/game/teamtakeover', desc: 'Territory battle' },
  { name: 'Code Breaker', icon: '🔑', path: '/game/codebreaker', desc: 'Reveal the phrase' },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="bg-unoh-red py-6 px-8 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-display font-black text-white tracking-wider uppercase">
              UNOH Review Games
            </h1>
            <p className="text-red-200 mt-1 text-sm font-medium">by Professor Martin · University of Northwestern Ohio</p>
          </div>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/join')}
              className="bg-white text-unoh-red font-bold px-6 py-3 rounded-xl text-lg shadow-lg hover:shadow-xl transition-shadow"
            >
              🎮 Join Game
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/admin')}
              className="bg-black border-2 border-white text-white font-bold px-6 py-3 rounded-xl text-lg hover:bg-gray-900 transition-colors"
            >
              ⚙️ Admin
            </motion.button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-12 px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-6xl font-display font-black text-white uppercase tracking-widest"
        >
          12 Review Games
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="text-gray-400 mt-3 text-xl"
        >
          Real-time buzzers · Live leaderboards · Student phone support
        </motion.p>
      </section>

      {/* Game Grid */}
      <section className="flex-1 px-8 pb-12 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {GAMES.map((game, i) => (
            <motion.button
              key={game.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.04, borderColor: '#680001' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/admin/launch')}
              className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-5 text-left hover:border-unoh-red transition-colors group"
            >
              <div className="text-4xl mb-2">{game.icon}</div>
              <div className="text-white font-bold text-lg group-hover:text-red-300 transition-colors">{game.name}</div>
              <div className="text-gray-500 text-sm mt-1">{game.desc}</div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-4 text-center text-gray-600 text-sm">
        UNOH Review Games · Professor Martin · University of Northwestern Ohio
      </footer>
    </div>
  );
}
