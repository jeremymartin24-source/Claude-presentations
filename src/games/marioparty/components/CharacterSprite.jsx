import { motion } from 'framer-motion';
import { CHARACTERS } from '../../../../shared/characters.js';

// ── Animation variants ────────────────────────────────────────────────────────
const VARIANTS = {
  idle: {
    y: [0, -4, 0],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
  walk: {
    rotate: [-6, 6, -6],
    y: [0, -2, 0],
    transition: { duration: 0.45, repeat: Infinity, ease: 'easeInOut' },
  },
  win: {
    y: [0, -12, 0],
    scale: [1, 1.12, 1],
    transition: { duration: 0.5, repeat: Infinity, ease: 'easeInOut' },
  },
  lose: {
    rotate: [0, -15, 0],
    y: [0, 3, 0],
    transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
  },
  selected: {
    scale: [1, 1.08, 1],
    transition: { duration: 0.7, repeat: Infinity, ease: 'easeInOut' },
  },
};

// ── Character accessory renderers ─────────────────────────────────────────────
function Glasses({ cx = 40, y = 30 }) {
  return (
    <g>
      <rect x={cx - 16} y={y} width={11} height={7} rx={2} fill="none" stroke="#333" strokeWidth="1.5" />
      <rect x={cx + 5}  y={y} width={11} height={7} rx={2} fill="none" stroke="#333" strokeWidth="1.5" />
      <line x1={cx - 5} y1={y + 3.5} x2={cx + 5} y2={y + 3.5} stroke="#333" strokeWidth="1.5" />
    </g>
  );
}

function GlassesProfessor({ cx = 40, y = 30 }) {
  return (
    <g>
      <ellipse cx={cx - 8} cy={y + 4} rx={7} ry={5} fill="none" stroke="#888" strokeWidth="1.5" />
      <ellipse cx={cx + 8} cy={y + 4} rx={7} ry={5} fill="none" stroke="#888" strokeWidth="1.5" />
      <line x1={cx - 1} y1={y + 4} x2={cx + 1} y2={y + 4} stroke="#888" strokeWidth="1.5" />
      <line x1={cx - 15} y1={y + 4} x2={cx - 18} y2={y + 2} stroke="#888" strokeWidth="1.5" />
      <line x1={cx + 15} y1={y + 4} x2={cx + 18} y2={y + 2} stroke="#888" strokeWidth="1.5" />
    </g>
  );
}

function Headset({ cx = 40, hy = 12 }) {
  return (
    <g>
      <path d={`M${cx - 18} ${hy + 14} Q${cx - 18} ${hy} ${cx} ${hy} Q${cx + 18} ${hy} ${cx + 18} ${hy + 14}`}
        fill="none" stroke="#333" strokeWidth="3" />
      <rect x={cx - 22} y={hy + 14} width={8} height={10} rx={3} fill="#555" />
      <rect x={cx + 14} y={hy + 14} width={8} height={10} rx={3} fill="#555" />
      <line x1={cx - 18} y1={hy + 22} x2={cx - 14} y2={hy + 30} stroke="#555" strokeWidth="2" />
      <circle cx={cx - 12} cy={hy + 32} r={3} fill="#E74C3C" />
    </g>
  );
}

function Mask({ cx = 40, y = 36 }) {
  return (
    <rect x={cx - 14} y={y} width={28} height={13} rx={5} fill="#1A1A2E" opacity={0.85} />
  );
}

function Visor({ cx = 40, y = 27 }) {
  return (
    <g>
      <rect x={cx - 18} y={y} width={36} height={10} rx={5} fill="#1ABC9C" opacity={0.7} />
      <rect x={cx - 16} y={y + 1} width={32} height={7} rx={4} fill="rgba(26,188,156,0.4)" />
    </g>
  );
}

function Badge({ cx = 40, bodyY = 53 }) {
  return (
    <g>
      <rect x={cx - 6} y={bodyY + 6} width={12} height={9} rx={2} fill="#F1C40F" />
      <text x={cx} y={bodyY + 13} textAnchor="middle" fontSize="5" fill="#333">SEC</text>
    </g>
  );
}

function Router({ cx = 40, bodyY = 53 }) {
  return (
    <g>
      <rect x={cx - 7} y={bodyY + 5} width={14} height={8} rx={2} fill="#2C3E50" />
      <line x1={cx - 4} y1={bodyY + 5} x2={cx - 6} y2={bodyY + 1} stroke="#2C3E50" strokeWidth="2" />
      <line x1={cx}     y1={bodyY + 5} x2={cx}     y2={bodyY}    stroke="#2C3E50" strokeWidth="2" />
      <line x1={cx + 4} y1={bodyY + 5} x2={cx + 6} y2={bodyY + 1} stroke="#2C3E50" strokeWidth="2" />
    </g>
  );
}

function Tablet({ cx = 40, bodyY = 53 }) {
  return (
    <g>
      <rect x={cx - 6} y={bodyY + 4} width={12} height={15} rx={2} fill="#2C3E50" />
      <rect x={cx - 5} y={bodyY + 5} width={10} height={11} rx={1} fill="#3498DB" opacity={0.6} />
    </g>
  );
}

// ── Main body SVG (shared template) ──────────────────────────────────────────
function CharacterSVG({ char, id }) {
  const cx = 40;
  const headY = 28;
  const bodyY = 53;

  // Hair shapes differ per character
  const hairMap = {
    cody:   <path d={`M${cx-18} ${headY-4} Q${cx} ${headY-22} ${cx+18} ${headY-4} L${cx+18} ${headY-1} Q${cx} ${headY-18} ${cx-18} ${headY-1}Z`} fill={char.hairColor} />,
    haxx:   <rect x={cx - 19} y={headY - 20} width={38} height={22} rx={8} fill={char.hairColor} />,
    syssy:  <path d={`M${cx-18} ${headY-2} Q${cx-18} ${headY-22} ${cx} ${headY-24} Q${cx+18} ${headY-22} ${cx+18} ${headY-2} L${cx+10} ${headY+6} Q${cx} ${headY+10} ${cx-10} ${headY+6}Z`} fill={char.hairColor} />,
    penny:  <path d={`M${cx-18} ${headY-2} Q${cx} ${headY-26} ${cx+18} ${headY-2} L${cx+20} ${headY+14} Q${cx+10} ${headY+18} ${cx-10} ${headY+18} L${cx-20} ${headY+14}Z`} fill={char.hairColor} />,
    desi:   <path d={`M${cx-18} ${headY-2} Q${cx-14} ${headY-26} ${cx} ${headY-26} Q${cx+14} ${headY-26} ${cx+18} ${headY-2} L${cx+12} ${headY+16} L${cx-12} ${headY+16}Z`} fill={char.hairColor} />,
    quinn:  <path d={`M${cx-18} ${headY-2} Q${cx} ${headY-22} ${cx+18} ${headY-2}Z`} fill={char.hairColor} />,
    rex:    null, // bald
    agatha: <path d={`M${cx-18} ${headY-4} Q${cx-18} ${headY-24} ${cx} ${headY-26} Q${cx+18} ${headY-24} ${cx+18} ${headY-4} L${cx+12} ${headY+20} Q${cx} ${headY+24} ${cx-12} ${headY+20}Z`} fill={char.hairColor} />,
  };

  // Accessory per character
  const accMap = {
    glasses:           <Glasses cx={cx} y={headY + 2} />,
    'glasses-professor': <GlassesProfessor cx={cx} y={headY + 2} />,
    headset:           <Headset cx={cx} hy={headY - 16} />,
    mask:              <Mask cx={cx} y={headY + 8} />,
    visor:             <Visor cx={cx} y={headY - 1} />,
    badge:             <Badge cx={cx} bodyY={bodyY} />,
    router:            <Router cx={cx} bodyY={bodyY} />,
    tablet:            <Tablet cx={cx} bodyY={bodyY} />,
  };

  // Body stripe / accent details
  const detailMap = {
    cody:   <rect x={cx - 7} y={bodyY + 13} width={14} height={11} rx={3} fill={char.accentColor} />,
    haxx:   <path d={`M${cx-8} ${bodyY+6} L${cx} ${bodyY+18} L${cx+8} ${bodyY+6}`} fill={char.accentColor} opacity={0.5} />,
    syssy:  <rect x={cx - 14} y={bodyY + 3} width={28} height={5} rx={2} fill={char.accentColor} />,
    penny:  <circle cx={cx} cy={bodyY + 16} r={5} fill={char.accentColor} />,
    desi:   <><rect x={cx-14} y={bodyY+4} width={28} height={5} rx={2} fill="#E74C3C" opacity={0.7} /><rect x={cx-14} y={bodyY+14} width={28} height={5} rx={2} fill="#F1C40F" opacity={0.7} /></>,
    quinn:  <rect x={cx - 10} y={bodyY + 4} width={20} height={22} rx={4} fill={char.accentColor} opacity={0.3} />,
    rex:    <path d={`M${cx-14} ${bodyY+3} L${cx} ${bodyY+14} L${cx+14} ${bodyY+3}`} fill={char.accentColor} />,
    agatha: <path d={`M${cx-14} ${bodyY+2} Q${cx} ${bodyY+10} ${cx+14} ${bodyY+2} Q${cx+14} ${bodyY+32} ${cx} ${bodyY+36} Q${cx-14} ${bodyY+32} ${cx-14} ${bodyY+2}Z`} fill={char.accentColor} opacity={0.35} />,
  };

  return (
    <svg viewBox="0 0 80 112" width="100%" height="100%">
      {/* Hair (behind head) */}
      {hairMap[id]}

      {/* Head */}
      <ellipse cx={cx} cy={headY} rx={18} ry={19} fill={char.skinColor} />

      {/* Eyes */}
      <circle cx={cx - 6} cy={headY - 1} r={3.5} fill="#fff" />
      <circle cx={cx + 6} cy={headY - 1} r={3.5} fill="#fff" />
      <circle cx={cx - 6} cy={headY - 1} r={2} fill="#222" />
      <circle cx={cx + 6} cy={headY - 1} r={2} fill="#222" />
      <circle cx={cx - 5.2} cy={headY - 1.8} r={0.7} fill="#fff" />
      <circle cx={cx + 6.8} cy={headY - 1.8} r={0.7} fill="#fff" />

      {/* Mouth */}
      <path d={`M${cx-5} ${headY+7} Q${cx} ${headY+11} ${cx+5} ${headY+7}`} fill="none" stroke="#c0805a" strokeWidth="1.5" strokeLinecap="round" />

      {/* Accessory */}
      {accMap[char.accessory]}

      {/* Body */}
      <rect x={cx - 16} y={bodyY} width={32} height={32} rx={5} fill={char.bodyColor} />

      {/* Body detail */}
      {detailMap[id]}

      {/* Arms */}
      <rect x={cx - 30} y={bodyY + 2} width={14} height={9} rx={4} fill={char.bodyColor} />
      <rect x={cx + 16} y={bodyY + 2} width={14} height={9} rx={4} fill={char.bodyColor} />

      {/* Hands */}
      <circle cx={cx - 23} cy={bodyY + 13} r={5} fill={char.skinColor} />
      <circle cx={cx + 23} cy={bodyY + 13} r={5} fill={char.skinColor} />

      {/* Legs */}
      <rect x={cx - 14} y={bodyY + 31} width={11} height={18} rx={3} fill={char.pantsColor} />
      <rect x={cx + 3}  y={bodyY + 31} width={11} height={18} rx={3} fill={char.pantsColor} />

      {/* Shoes */}
      <ellipse cx={cx - 9}  cy={bodyY + 49} rx={9} ry={5} fill={char.shoeColor} />
      <ellipse cx={cx + 9} cy={bodyY + 49} rx={9} ry={5} fill={char.shoeColor} />
    </svg>
  );
}

// ── Exported component ────────────────────────────────────────────────────────
export default function CharacterSprite({ characterId, animation = 'idle', size = 80 }) {
  const char = CHARACTERS[characterId];
  if (!char) return null;

  const variant = VARIANTS[animation] ?? VARIANTS.idle;

  return (
    <motion.div
      style={{ width: size, height: size * 1.4, display: 'inline-block' }}
      animate={variant}
    >
      <CharacterSVG char={char} id={characterId} />
    </motion.div>
  );
}
