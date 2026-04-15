import { BOARD_SPACES, SPACE_COLORS, SPACE_ICONS } from '../../../../shared/boardData.js';
import { CHARACTERS } from '../../../../shared/characters.js';

// Scale board coordinates to fit in the SVG viewBox (900×590)
const VW = 900;
const VH = 590;

// Offset to center board (original coords span 30–830 x, 60–540 y)
const SPACE_R = 26; // circle radius

function SpaceCircle({ space, players, isCurrentLanding }) {
  const color = SPACE_COLORS[space.type] ?? '#555';
  const icon = SPACE_ICONS[space.type] ?? '?';
  const pulse = isCurrentLanding;

  return (
    <g>
      {pulse && (
        <circle
          cx={space.x}
          cy={space.y}
          r={SPACE_R + 8}
          fill="none"
          stroke="#F1C40F"
          strokeWidth="3"
          opacity="0.8"
        >
          <animate attributeName="r" from={SPACE_R + 4} to={SPACE_R + 14} dur="0.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.8" to="0" dur="0.8s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={space.x} cy={space.y} r={SPACE_R} fill={color} stroke="#fff" strokeWidth="1.5" opacity="0.9" />
      {/* Space ID */}
      <text x={space.x} y={space.y - 9} textAnchor="middle" fontSize="11" fill="#fff" opacity="0.5" fontWeight="600">
        {space.id}
      </text>
      {/* Icon */}
      <text x={space.x} y={space.y + 7} textAnchor="middle" fontSize="14">
        {icon}
      </text>

      {/* Player tokens */}
      {players.map((p, i) => {
        const char = CHARACTERS[p.characterId];
        const tokenColor = char?.bodyColor ?? '#888';
        const angle = (i / Math.max(players.length, 1)) * Math.PI * 2;
        const r = players.length > 1 ? 14 : 0;
        const tx = space.x + Math.cos(angle) * r;
        const ty = space.y + Math.sin(angle) * r;

        return (
          <g key={p.id}>
            <circle cx={tx} cy={ty} r={7} fill={tokenColor} stroke="#fff" strokeWidth="2" />
            <text x={tx} y={ty + 4} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="900">
              {p.name[0]}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ConnectionLine({ from, to }) {
  return (
    <line
      x1={from.x}
      y1={from.y}
      x2={to.x}
      y2={to.y}
      stroke="rgba(255,255,255,0.25)"
      strokeWidth="3"
      strokeLinecap="round"
    />
  );
}

export default function Board({ gameState }) {
  const players = gameState?.players ?? [];
  const phase = gameState?.phase;

  // Build player position map: spaceId → Player[]
  const positionMap = {};
  players.forEach(p => {
    if (!positionMap[p.position]) positionMap[p.position] = [];
    positionMap[p.position].push(p);
  });

  // Find current player's landing space for pulse effect
  const currentPlayerId = gameState?.currentPlayerId;
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  const landingSpace = currentPlayer?.position;

  // Build connection lines
  const lines = [];
  BOARD_SPACES.forEach(space => {
    space.next.forEach(nextId => {
      const nextSpace = BOARD_SPACES[nextId];
      if (nextSpace) {
        lines.push({ key: `${space.id}-${nextId}`, from: space, to: nextSpace });
      }
    });
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Board background */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ width: '100%', height: '100%', display: 'block' }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background */}
        <rect width={VW} height={VH} fill="#0D0D1A" rx="16" />

        {/* Board area rounded rect */}
        <rect x="10" y="10" width={VW - 20} height={VH - 20}
          fill="#16213E" rx="12" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

        {/* Grid lines (subtle) */}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`vg${i}`} x1={(i + 1) * 100} y1="20" x2={(i + 1) * 100} y2={VH - 20}
            stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        ))}
        {Array.from({ length: 5 }, (_, i) => (
          <line key={`hg${i}`} x1="20" y1={(i + 1) * 100} x2={VW - 20} y2={(i + 1) * 100}
            stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        ))}

        {/* Connection lines (draw before circles so circles appear on top) */}
        {lines.map(({ key, from, to }) => (
          <ConnectionLine key={key} from={from} to={to} />
        ))}

        {/* Spaces */}
        {BOARD_SPACES.map(space => (
          <SpaceCircle
            key={space.id}
            space={space}
            players={positionMap[space.id] ?? []}
            isCurrentLanding={
              phase === 'spaceResolution' && space.id === landingSpace
            }
          />
        ))}

        {/* Legend */}
        <g transform="translate(14, 14)">
          {[
            ['🪙', 'Coin +3', '#2ECC71'],
            ['💀', 'Bad Luck', '#E74C3C'],
            ['❓', 'Question', '#3498DB'],
            ['⭐', 'Star', '#F1C40F'],
            ['🛒', 'Shop', '#9B59B6'],
            ['🎴', 'Event', '#1ABC9C'],
            ['🎮', 'Mini-Game', '#FF69B4'],
          ].map(([icon, label, color], i) => (
            <g key={label} transform={`translate(${i * 118}, 0)`}>
              <rect x="0" y="0" width="112" height="22" rx="6" fill={color} opacity="0.2" />
              <text x="6" y="15" fontSize="11" fill={color} fontWeight="700">
                {icon} {label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
