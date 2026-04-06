import { motion } from 'framer-motion';

interface Props {
  playerName: string;
  gamePin: string;
  players: Array<{ name: string; team?: string }>;
}

export default function WaitingRoom({ playerName, gamePin, players }: Props) {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ repeat: Infinity, duration: 2 }}
          className="text-6xl mb-6">⏳</motion.div>
        <h1 className="text-2xl font-bold text-white">You're in!</h1>
        <p className="text-gray-400 mt-2 mb-6">Waiting for Professor Martin to start the game...</p>

        <div className="bg-gray-900 rounded-2xl px-8 py-4 mb-6 border border-gray-700">
          <p className="text-unoh-red font-bold text-xl">{playerName}</p>
          <p className="text-gray-600 text-sm mt-1">PIN: {gamePin}</p>
        </div>

        <div className="space-y-1">
          {players.slice(-8).map((p, i) => (
            <motion.p key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className={`text-sm ${p.name === playerName ? 'text-white font-bold' : 'text-gray-500'}`}>
              {p.name === playerName ? `→ ${p.name} (you)` : p.name}
            </motion.p>
          ))}
          {players.length > 0 && (
            <p className="text-gray-700 text-xs pt-2">{players.length} player{players.length !== 1 ? 's' : ''} ready</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
