import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrthographicCamera, Billboard, Text } from '@react-three/drei';
import { BOARD_SPACES, SPACE_COLORS, SPACE_ICONS } from '../../../../shared/boardData.js';
import { CHARACTERS } from '../../../../shared/characters.js';

// ── Coordinate helpers ────────────────────────────────────────────────────────
// SVG coords: x 30–830, y 60–530  →  3D world units centred at origin
const SVG_CX = (30 + 830) / 2;   // 430
const SVG_CY = (60 + 530) / 2;   // 295
const SCALE  = 60;

function toWorld(svgX, svgY) {
  return [(svgX - SVG_CX) / SCALE, 0, (svgY - SVG_CY) / SCALE];
}

// Puck height per space type — star spaces tower over bad-luck dips
const PUCK_H = {
  start: 0.30, coin: 0.22, badluck: 0.15, question: 0.26,
  star: 0.50,  shop: 0.32, event: 0.32,   minigame: 0.42, fork: 0.18,
};

// Emissive glow for special spaces
const PUCK_GLOW = {
  star: 0.35, minigame: 0.25, shop: 0.15, event: 0.12,
};

// ── Main export ───────────────────────────────────────────────────────────────
export default function Board({ gameState }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        shadows
        style={{ background: '#0D0D1A', width: '100%', height: '100%' }}
        gl={{ antialias: true }}
      >
        {/*
          Orthographic camera positioned high + slightly behind the board
          giving a classic Mario Party isometric angle.
        */}
        <OrthographicCamera makeDefault position={[0, 13, 9]} zoom={48} />

        {/* Key light from top-right casts shadows across puck surfaces */}
        <directionalLight
          position={[8, 14, 6]}
          intensity={1.3}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={60}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        {/* Fill light from opposite side softens harsh shadows */}
        <directionalLight position={[-5, 8, -4]} intensity={0.35} />
        <ambientLight intensity={0.55} />

        <BoardScene gameState={gameState} />
      </Canvas>
    </div>
  );
}

// ── Board scene (all 3D objects) ──────────────────────────────────────────────
function BoardScene({ gameState }) {
  const players       = gameState?.players ?? [];
  const phase         = gameState?.phase;
  const currentPlayerId = gameState?.currentPlayerId;

  const landingSpaceId = useMemo(() => {
    if (phase !== 'spaceResolution') return null;
    return players.find(p => p.id === currentPlayerId)?.position ?? null;
  }, [phase, currentPlayerId, players]);

  // spaceId → players on that space (for token offset)
  const positionMap = useMemo(() => {
    const map = {};
    players.forEach(p => {
      if (!map[p.position]) map[p.position] = [];
      map[p.position].push(p);
    });
    return map;
  }, [players]);

  // Deduplicated connection pairs for path segments
  const connections = useMemo(() => {
    const seen = new Set();
    const result = [];
    BOARD_SPACES.forEach(space => {
      space.next.forEach(nextId => {
        const key = [Math.min(space.id, nextId), Math.max(space.id, nextId)].join('-');
        if (!seen.has(key)) {
          seen.add(key);
          if (BOARD_SPACES[nextId]) result.push({ from: space, to: BOARD_SPACES[nextId] });
        }
      });
    });
    return result;
  }, []);

  return (
    <group>
      {/* Dark ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.02, 0]}>
        <planeGeometry args={[22, 15]} />
        <meshStandardMaterial color="#0F1A35" roughness={0.95} />
      </mesh>

      {/* Subtle border ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]}>
        <ringGeometry args={[10.2, 10.4, 64]} />
        <meshStandardMaterial color="#1E2D55" />
      </mesh>

      {/* Path connections (drawn before pucks so pucks sit on top) */}
      {connections.map(({ from, to }) => (
        <PathSegment key={`${from.id}-${to.id}`} from={from} to={to} />
      ))}

      {/* Board spaces */}
      {BOARD_SPACES.map(space => (
        <SpacePuck
          key={space.id}
          space={space}
          isLanding={space.id === landingSpaceId}
        />
      ))}

      {/* Player tokens */}
      {players.map(player => {
        const stackPlayers = positionMap[player.position] ?? [];
        const idx = stackPlayers.indexOf(player);
        return (
          <PlayerToken
            key={player.id}
            player={player}
            stackCount={stackPlayers.length}
            stackIndex={idx}
            isActive={player.id === currentPlayerId}
          />
        );
      })}
    </group>
  );
}

// ── Space puck ────────────────────────────────────────────────────────────────
function SpacePuck({ space, isLanding }) {
  const meshRef = useRef();
  const color   = SPACE_COLORS[space.type] ?? '#555';
  const h       = PUCK_H[space.type] ?? 0.22;
  const glow    = PUCK_GLOW[space.type] ?? 0;
  const [wx, , wz] = toWorld(space.x, space.y);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (isLanding) {
      const s = 1 + Math.sin(clock.elapsedTime * 5) * 0.1;
      meshRef.current.scale.set(s, 1, s);
    } else {
      meshRef.current.scale.set(1, 1, 1);
    }
  });

  return (
    <group position={[wx, 0, wz]}>
      {/* Main puck cylinder */}
      <mesh ref={meshRef} position={[0, h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.52, 0.57, h, 20]} />
        <meshStandardMaterial
          color={color}
          roughness={0.35}
          metalness={0.25}
          emissive={color}
          emissiveIntensity={isLanding ? 0.45 : glow}
        />
      </mesh>

      {/* Top-face rim ring for depth */}
      <mesh position={[0, h + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.44, 0.54, 20]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
      </mesh>

      {/* Emoji icon — Billboard always faces camera */}
      <Billboard position={[0, h + 0.45, 0]}>
        <Text fontSize={0.26} anchorX="center" anchorY="middle">
          {SPACE_ICONS[space.type] ?? '?'}
        </Text>
      </Billboard>
    </group>
  );
}

// ── Path segment ──────────────────────────────────────────────────────────────
function PathSegment({ from, to }) {
  const [fx, , fz] = toWorld(from.x, from.y);
  const [tx, , tz] = toWorld(to.x,   to.y);

  const dx     = tx - fx;
  const dz     = tz - fz;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle  = Math.atan2(dx, dz); // yaw angle in XZ plane

  return (
    <mesh
      position={[(fx + tx) / 2, 0.01, (fz + tz) / 2]}
      rotation={[0, angle, 0]}
      receiveShadow
    >
      <boxGeometry args={[0.16, 0.05, length]} />
      <meshStandardMaterial color="#1C2A4A" roughness={0.9} />
    </mesh>
  );
}

// ── Player token ──────────────────────────────────────────────────────────────
function PlayerToken({ player, stackCount, stackIndex, isActive }) {
  const meshRef    = useRef();
  const char       = CHARACTERS[player.characterId];
  const bodyColor  = char?.bodyColor  ?? '#888';
  const accentColor = char?.accentColor ?? '#aaa';
  const space      = BOARD_SPACES[player.position];
  const [wx, , wz] = toWorld(space.x, space.y);
  const spaceH     = PUCK_H[space.type] ?? 0.22;

  // Spread tokens in a ring when multiple players share a space
  const spread = stackCount > 1 ? 0.3 : 0;
  const angle  = stackCount > 1 ? (stackIndex / stackCount) * Math.PI * 2 : 0;
  const px     = wx + Math.cos(angle) * spread;
  const pz     = wz + Math.sin(angle) * spread;

  // Each token bobs at a slightly different phase to avoid synchronised movement
  const bobPhase = stackIndex * 1.1;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const bob = Math.sin(clock.elapsedTime * 2.0 + bobPhase) * 0.06;
    meshRef.current.position.y = spaceH + 0.38 + bob;
  });

  return (
    <group position={[px, 0, pz]}>
      {/* Token sphere */}
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial
          color={bodyColor}
          roughness={0.2}
          metalness={0.5}
          emissive={bodyColor}
          emissiveIntensity={isActive ? 0.3 : 0.05}
        />
      </mesh>

      {/* Active-player halo ring */}
      {isActive && (
        <ActiveHalo spaceH={spaceH} color={accentColor} />
      )}

      {/* Name label — always faces camera */}
      <Billboard position={[0, spaceH + 1.0, 0]}>
        <Text
          fontSize={0.21}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor="#000000"
        >
          {player.name.slice(0, 4).toUpperCase()}
        </Text>
      </Billboard>
    </group>
  );
}

// Pulsing halo ring beneath the active player's token
function ActiveHalo({ spaceH, color }) {
  const ringRef = useRef();
  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.12;
    ringRef.current.scale.set(s, s, s);
    ringRef.current.material.opacity = 0.6 + Math.sin(clock.elapsedTime * 3) * 0.2;
  });
  return (
    <mesh ref={ringRef} position={[0, spaceH + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.28, 0.38, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={0.7} />
    </mesh>
  );
}
