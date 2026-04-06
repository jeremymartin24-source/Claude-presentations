import { motion } from 'framer-motion';

interface Props {
  state: 'waiting' | 'ready' | 'buzzed' | 'accepted' | 'rejected' | 'locked';
  onBuzz: () => void;
}

const CONFIG = {
  waiting:  { bg: 'bg-gray-800',    border: 'border-gray-700',  text: '...',     glow: '' },
  ready:    { bg: 'bg-unoh-red',    border: 'border-red-400',   text: 'BUZZ!',   glow: 'shadow-[0_0_60px_rgba(104,0,1,0.8)]' },
  buzzed:   { bg: 'bg-red-900',     border: 'border-red-800',   text: 'BUZZED',  glow: '' },
  accepted: { bg: 'bg-green-700',   border: 'border-green-400', text: '✓',       glow: 'shadow-[0_0_50px_rgba(34,197,94,0.6)]' },
  rejected: { bg: 'bg-red-950',     border: 'border-red-800',   text: '✗',       glow: '' },
  locked:   { bg: 'bg-gray-900',    border: 'border-gray-700',  text: '🔒',      glow: '' },
};

export default function BuzzerButton({ state, onBuzz }: Props) {
  const c = CONFIG[state];
  return (
    <motion.button
      className={`w-72 h-72 rounded-full border-8 ${c.bg} ${c.border} ${c.glow} flex items-center justify-center transition-all duration-200`}
      animate={{ scale: state === 'ready' ? [1, 1.03, 1] : 1 }}
      transition={{ repeat: state === 'ready' ? Infinity : 0, duration: 1 }}
      onPointerDown={state === 'ready' ? onBuzz : undefined}
      style={{ touchAction: 'none', userSelect: 'none', cursor: state === 'ready' ? 'pointer' : 'default' }}
    >
      <span className="text-5xl font-display font-black text-white tracking-wider">{c.text}</span>
    </motion.button>
  );
}
