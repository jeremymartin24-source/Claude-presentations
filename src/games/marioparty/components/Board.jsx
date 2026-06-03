import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { BOARD_SPACES, SPACE_COLORS, SPACE_ICONS, ZONES } from '../../../../shared/boardData.js';
import { CHARACTERS } from '../../../../shared/characters.js';

// ── Coordinate helpers ────────────────────────────────────────────────────────
const SVG_CX = 430;
const SVG_CY = 295;
const SCALE  = 60;
const PLAT_H = 0.32;
const BACKBONE_H = 0.9; // top surface of backbone pedestal

function toWorld(svgX, svgY) {
  return [(svgX - SVG_CX) / SCALE, 0, (svgY - SVG_CY) / SCALE];
}

const ZONE_WORLD = {};
Object.entries(ZONES).forEach(([key, z]) => {
  const [cx, , cz] = toWorld(z.cx, z.cy);
  ZONE_WORLD[key] = { cx, cz, w: z.w / SCALE, d: z.h / SCALE, label: z.label, accent: z.accentColor };
});

// Per-zone dark platform colors
const ZONE_COLORS = {
  rackZone:     { base: '#0E1E38', trim: '#091428', tile: '#152240' },
  networkCore:  { base: '#0A2215', trim: '#071610', tile: '#0E2A1A' },
  secOps:       { base: '#200A2A', trim: '#160718', tile: '#280E32' },
  coolingPower: { base: '#201408', trim: '#160D06', tile: '#281A0A' },
};

// Catwalk bridge endpoints (SVG coords)
const CATWALK_BRIDGES = [
  { from: [388, 115], to: [482, 115] },
  { from: [760, 212], to: [760, 358] },
  { from: [482, 475], to: [373, 475] },
  { from: [130, 358], to: [130, 218] },
];

// ── Camera setup (perspective) ────────────────────────────────────────────────
function CameraSetup() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 18, 14);
    camera.near = 0.1;
    camera.far  = 200;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);
  return null;
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function Board({ gameState }) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        shadows
        camera={{ position: [0, 18, 14], fov: 50, near: 0.1, far: 200 }}
        style={{ background: '#050A12', width: '100%', height: '100%' }}
        gl={{ antialias: true }}
      >
        <CameraSetup />
        <SceneLighting />
        <BoardScene gameState={gameState} />
      </Canvas>
    </div>
  );
}

// ── Lighting ──────────────────────────────────────────────────────────────────
function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.28} />
      <directionalLight
        position={[6, 12, 8]} intensity={0.8} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-near={0.5} shadow-camera-far={60}
        shadow-camera-left={-13} shadow-camera-right={13}
        shadow-camera-top={11} shadow-camera-bottom={-11}
      />
      <directionalLight position={[-4, 6, -4]} intensity={0.18} />
      {/* Saturated zone accent lights */}
      {Object.entries(ZONE_WORLD).map(([key, z], i) => (
        <pointLight key={i} position={[z.cx, 4.5, z.cz]} intensity={1.5} distance={9} color={z.accent} />
      ))}
    </>
  );
}

// ── Board scene ───────────────────────────────────────────────────────────────
function BoardScene({ gameState }) {
  const players         = gameState?.players ?? [];
  const phase           = gameState?.phase;
  const currentPlayerId = gameState?.currentPlayerId;

  const landingSpaceId = useMemo(() => {
    if (phase !== 'spaceResolution') return null;
    return players.find(p => p.id === currentPlayerId)?.position ?? null;
  }, [phase, currentPlayerId, players]);

  const positionMap = useMemo(() => {
    const map = {};
    players.forEach(p => {
      if (!map[p.position]) map[p.position] = [];
      map[p.position].push(p);
    });
    return map;
  }, [players]);

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
      <BackgroundFloor />
      {Object.keys(ZONES).map(key => (
        <ZonePlatform key={key} zoneKey={key} />
      ))}
      {CATWALK_BRIDGES.map((b, i) => (
        <CatwalkBridge key={i} fromSVG={b.from} toSVG={b.to} />
      ))}
      {connections.map(({ from, to }) => (
        <PathSegment key={`${from.id}-${to.id}`} from={from} to={to} />
      ))}
      {BOARD_SPACES.map(space => (
        <SpaceTile key={space.id} space={space} isLanding={space.id === landingSpaceId} />
      ))}
      {players.map(player => {
        const stackPlayers = positionMap[player.position] ?? [];
        const idx          = stackPlayers.indexOf(player);
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

// ── Background floor ──────────────────────────────────────────────────────────
function BackgroundFloor() {
  const gridLines = useMemo(() => {
    const lines = [];
    const step  = 1.2;
    for (let x = -12; x <= 12; x += step) lines.push({ axis: 'x', pos: x });
    for (let z = -8;  z <= 8;  z += step) lines.push({ axis: 'z', pos: z });
    return lines;
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.025, 0]}>
        <planeGeometry args={[28, 20]} />
        <meshStandardMaterial color="#040910" roughness={1} />
      </mesh>
      {gridLines.map((g, i) =>
        g.axis === 'x' ? (
          <mesh key={i} position={[g.pos, -0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.012, 18]} />
            <meshStandardMaterial color="#091520" />
          </mesh>
        ) : (
          <mesh key={i} position={[0, -0.018, g.pos]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[26, 0.012]} />
            <meshStandardMaterial color="#091520" />
          </mesh>
        )
      )}
    </group>
  );
}

// ── Zone platform ─────────────────────────────────────────────────────────────
function ZonePlatform({ zoneKey }) {
  const zw = ZONE_WORLD[zoneKey];
  const zc = ZONE_COLORS[zoneKey] ?? { base: '#1E1E2E', trim: '#141420', tile: '#1E2030' };

  const tiles = useMemo(() => {
    const spacing = 0.48;
    const cols = Math.floor(zw.w / spacing);
    const rows = Math.floor(zw.d / spacing);
    const ox   = -((cols - 1) * spacing) / 2;
    const oz   = -((rows - 1) * spacing) / 2;
    const result = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        result.push([ox + c * spacing, oz + r * spacing]);
      }
    }
    return result;
  }, [zw.w, zw.d]);

  return (
    <group position={[zw.cx, 0, zw.cz]}>
      {/* Main slab */}
      <mesh position={[0, PLAT_H / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[zw.w, PLAT_H, zw.d]} />
        <meshStandardMaterial color={zc.base} roughness={0.5} metalness={0.18} />
      </mesh>
      {/* Side trim */}
      <mesh position={[0, 0.035, 0]}>
        <boxGeometry args={[zw.w + 0.16, 0.08, zw.d + 0.16]} />
        <meshStandardMaterial color={zc.trim} roughness={0.6} metalness={0.22} />
      </mesh>
      {/* Raised floor tiles */}
      {tiles.map(([tx, tz], i) => (
        <mesh key={i} position={[tx, PLAT_H + 0.015, tz]} receiveShadow>
          <boxGeometry args={[0.42, 0.028, 0.42]} />
          <meshStandardMaterial color={zc.tile} roughness={0.65} metalness={0.1} />
        </mesh>
      ))}
      {/* Front accent strip (glowing) */}
      <mesh position={[0, PLAT_H + 0.048, zw.d / 2 + 0.02]}>
        <boxGeometry args={[zw.w, 0.048, 0.09]} />
        <meshStandardMaterial color={zw.accent} emissive={zw.accent} emissiveIntensity={0.75} />
      </mesh>
      {/* Back accent strip (subtle) */}
      <mesh position={[0, PLAT_H + 0.048, -(zw.d / 2 + 0.02)]}>
        <boxGeometry args={[zw.w, 0.048, 0.09]} />
        <meshStandardMaterial color={zw.accent} emissive={zw.accent} emissiveIntensity={0.3} />
      </mesh>
      {/* Side accent strips */}
      {[-1, 1].map((side, i) => (
        <mesh key={i} position={[side * (zw.w / 2 + 0.02), PLAT_H + 0.048, 0]}>
          <boxGeometry args={[0.09, 0.048, zw.d]} />
          <meshStandardMaterial color={zw.accent} emissive={zw.accent} emissiveIntensity={0.2} />
        </mesh>
      ))}
      {/* Zone name label */}
      <Billboard position={[0, PLAT_H + 1.8, zw.d / 2 + 0.45]}>
        <Text fontSize={0.27} color={zw.accent} anchorX="center" anchorY="middle"
          outlineWidth={0.04} outlineColor="#000000">
          {zw.label}
        </Text>
      </Billboard>
      <ZoneEquipment zoneKey={zoneKey} w={zw.w} d={zw.d} />
      <CeilingLightGrid w={zw.w} d={zw.d} accent={zw.accent} />
    </group>
  );
}

// ── Ceiling light grid ────────────────────────────────────────────────────────
function CeilingLightGrid({ w, d, accent }) {
  const positions = useMemo(() => {
    const cols = 3, rows = 2;
    const result = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result.push([
          (c / (cols - 1) - 0.5) * (w * 0.7),
          (r / (rows - 1) - 0.5) * (d * 0.55),
        ]);
      }
    }
    return result;
  }, [w, d]);

  return (
    <group position={[0, 3.8, 0]}>
      {positions.map(([fx, fz], i) => (
        <group key={i} position={[fx, 0, fz]}>
          <mesh>
            <boxGeometry args={[0.88, 0.04, 0.14]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.7} />
          </mesh>
          <pointLight position={[0, -0.6, 0]} intensity={0.48} distance={4.5} color="#D4E8FF" />
        </group>
      ))}
    </group>
  );
}

// ── Zone equipment switcher (updated zone keys) ───────────────────────────────
function ZoneEquipment({ zoneKey }) {
  switch (zoneKey) {
    case 'rackZone':     return <ServerRoomEquipment />;
    case 'networkCore':  return <NetworkCoreEquipment />;
    case 'secOps':       return <SecOpsEquipment />;
    case 'coolingPower': return <PowerEquipment />;
    default:             return null;
  }
}

// ── Server Rack Zone equipment ────────────────────────────────────────────────
function ServerRoomEquipment() {
  const rackDefs = [
    { x: -1.75, z: -1.42 }, { x: -1.1, z: -1.42 },
    { x: -0.2,  z: -1.42 }, { x:  0.5, z: -1.42 },
    { x:  1.2,  z: -1.42 }, { x:  1.9, z: -1.42 },
    { x: -1.75, z: -1.0, shortRack: true },
    { x:  1.9,  z: -1.0, shortRack: true },
  ];

  return (
    <group position={[0, PLAT_H, 0]}>
      {/* Hot aisle floor */}
      <mesh position={[0.05, 0.025, -1.42]}>
        <boxGeometry args={[3.8, 0.018, 0.55]} />
        <meshStandardMaterial color="#3D0000" roughness={0.9} />
      </mesh>
      {/* Hot aisle warning line */}
      <mesh position={[0.05, 0.026, -1.15]}>
        <boxGeometry args={[3.8, 0.016, 0.04]} />
        <meshStandardMaterial color="#E74C3C" emissive="#E74C3C" emissiveIntensity={0.55} />
      </mesh>
      {rackDefs.map((r, i) => (
        <ServerRack key={i} x={r.x} z={r.z} short={r.shortRack} phase={i * 0.7} />
      ))}
    </group>
  );
}

function ServerRack({ x, z, short = false, phase = 0 }) {
  const led1Ref = useRef();
  const led2Ref = useRef();
  const h = short ? 0.52 : 0.88;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (led1Ref.current) led1Ref.current.material.emissiveIntensity = 1.0 + Math.sin(t * 1.8 + phase) * 0.7;
    if (led2Ref.current) led2Ref.current.material.emissiveIntensity = 0.8 + Math.sin(t * 2.5 + phase + 1.2) * 0.6;
  });

  return (
    <group position={[x, h / 2, z]}>
      <mesh castShadow>
        <boxGeometry args={[0.3, h, 0.13]} />
        <meshStandardMaterial color="#1C1C1E" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.068]}>
        <boxGeometry args={[0.26, h - 0.06, 0.014]} />
        <meshStandardMaterial color="#222228" roughness={0.3} metalness={0.65} />
      </mesh>
      <mesh ref={led1Ref} position={[0, 0.18, 0.077]}>
        <boxGeometry args={[0.2, 0.014, 0.008]} />
        <meshStandardMaterial color="#0066FF" emissive="#0066FF" emissiveIntensity={1.5} />
      </mesh>
      <mesh ref={led2Ref} position={[0, -0.04, 0.077]}>
        <boxGeometry args={[0.2, 0.014, 0.008]} />
        <meshStandardMaterial color="#00AAFF" emissive="#00AAFF" emissiveIntensity={1.1} />
      </mesh>
      <mesh position={[0.09, h / 2 - 0.07, 0.078]}>
        <boxGeometry args={[0.024, 0.024, 0.008]} />
        <meshStandardMaterial color="#00FF55" emissive="#00FF55" emissiveIntensity={1.8} />
      </mesh>
      {Array.from({ length: short ? 3 : 5 }, (_, row) => (
        <mesh key={row} position={[0, -h / 2 + 0.1 + row * (h / (short ? 4 : 6)), 0.075]}>
          <boxGeometry args={[0.22, 0.03, 0.01]} />
          <meshStandardMaterial color="#2A2A2E" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

// ── Network Core Zone equipment ───────────────────────────────────────────────
function NetworkCoreEquipment() {
  const screenColors = ['#0A2A6A', '#0A3A1A', '#1A1A6A', '#2A0A4A', '#0A2A4A'];
  const screenGlows  = ['#0066FF', '#00AA44', '#4444FF', '#8822CC', '#0088AA'];

  return (
    <group position={[0, PLAT_H, 0]}>
      {/* Monitor wall backing */}
      <mesh position={[0, 0.85, -0.82]} castShadow>
        <boxGeometry args={[4.0, 1.3, 0.09]} />
        <meshStandardMaterial color="#181822" roughness={0.45} metalness={0.35} />
      </mesh>
      {/* Individual monitor screens */}
      {screenColors.map((bg, i) => {
        const sx = (i - 2) * 0.78;
        return (
          <group key={i} position={[sx, 0.88, -0.78]}>
            <mesh castShadow>
              <boxGeometry args={[0.68, 0.46, 0.05]} />
              <meshStandardMaterial color="#0D0D16" roughness={0.3} metalness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0.032]}>
              <boxGeometry args={[0.61, 0.39, 0.018]} />
              <meshStandardMaterial color={bg} emissive={screenGlows[i]} emissiveIntensity={0.65} roughness={0.1} />
            </mesh>
            {[0.12, 0.04, -0.04, -0.12].map((ly, li) => (
              <mesh key={li} position={[i % 2 === 0 ? -0.05 : 0.05, ly, 0.046]}>
                <boxGeometry args={[0.35 + (li % 2) * 0.15, 0.018, 0.004]} />
                <meshStandardMaterial color={screenGlows[i]} emissive={screenGlows[i]} emissiveIntensity={0.5} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* Wall bracket */}
      <mesh position={[0, 0.42, -0.86]}>
        <boxGeometry args={[3.85, 0.06, 0.06]} />
        <meshStandardMaterial color="#444450" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Core switches on floor */}
      {[[-1.3, -0.0], [0, -0.0], [1.3, -0.0]].map(([sx, sz], i) => (
        <CoreSwitch key={i} x={sx} z={sz} phase={i * 0.85} />
      ))}
      {/* Patch panel on wall */}
      <group position={[1.82, 0.52, -0.78]}>
        <mesh castShadow>
          <boxGeometry args={[0.28, 0.88, 0.07]} />
          <meshStandardMaterial color="#0D1020" roughness={0.3} metalness={0.7} />
        </mesh>
        {Array.from({ length: 12 }, (_, pi) => (
          <mesh key={pi} position={[0, -0.3 + pi * 0.055, 0.04]}>
            <boxGeometry args={[0.18, 0.026, 0.012]} />
            <meshStandardMaterial color="#0A0A1A" roughness={0.3} metalness={0.6} />
          </mesh>
        ))}
        {/* Patch LEDs */}
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[0.1 - i * 0.04, 0.35, 0.04]}>
            <boxGeometry args={[0.022, 0.022, 0.009]} />
            <meshStandardMaterial
              color={i % 3 === 0 ? '#FF6600' : '#00FF44'}
              emissive={i % 3 === 0 ? '#FF6600' : '#00FF44'}
              emissiveIntensity={1.5}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function CoreSwitch({ x, z, phase }) {
  const portGroupRef = useRef();

  useFrame(({ clock }) => {
    if (!portGroupRef.current) return;
    portGroupRef.current.children.forEach((child, i) => {
      if (child.material) {
        const active = Math.abs(Math.sin(clock.elapsedTime * 4.5 + phase + i * 0.4));
        child.material.emissiveIntensity = i % 3 === 0 ? 0.4 + active * 1.6 : 1.1;
      }
    });
  });

  return (
    <group position={[x, 0.14, z]}>
      <mesh castShadow>
        <boxGeometry args={[0.7, 0.22, 0.3]} />
        <meshStandardMaterial color="#151A22" roughness={0.3} metalness={0.72} />
      </mesh>
      <mesh position={[0, 0.01, 0.155]}>
        <boxGeometry args={[0.62, 0.15, 0.012]} />
        <meshStandardMaterial color="#0A0F18" roughness={0.2} metalness={0.75} />
      </mesh>
      {/* Port LEDs */}
      <group ref={portGroupRef} position={[-0.23, 0.038, 0.165]}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[i * 0.066, 0, 0]}>
            <boxGeometry args={[0.038, 0.038, 0.008]} />
            <meshStandardMaterial
              color={i % 3 === 0 ? '#FF8800' : '#00FF44'}
              emissive={i % 3 === 0 ? '#FF8800' : '#00FF44'}
              emissiveIntensity={1.1}
            />
          </mesh>
        ))}
      </group>
      <mesh position={[0, -0.068, 0.163]}>
        <boxGeometry args={[0.48, 0.022, 0.008]} />
        <meshStandardMaterial color="#0066FF" emissive="#0066FF" emissiveIntensity={0.55} />
      </mesh>
    </group>
  );
}

// ── Security Ops Center equipment ─────────────────────────────────────────────
function SecOpsEquipment() {
  return (
    <group position={[0, PLAT_H, 0]}>
      {/* Alert beacon */}
      <AlertBeacon x={1.78} z={0.05} />
      {/* Firewall appliance */}
      <group position={[0, 0.2, -0.7]}>
        <mesh castShadow>
          <boxGeometry args={[1.75, 0.32, 0.25]} />
          <meshStandardMaterial color="#0A0A14" roughness={0.25} metalness={0.72} />
        </mesh>
        <mesh position={[0, 0.068, 0.13]}>
          <boxGeometry args={[1.6, 0.025, 0.01]} />
          <meshStandardMaterial color="#CC00FF" emissive="#CC00FF" emissiveIntensity={0.85} />
        </mesh>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[-0.65 + i * 0.26, 0.028, 0.132]}>
            <boxGeometry args={[0.048, 0.048, 0.012]} />
            <meshStandardMaterial
              color={i < 5 ? '#00FF88' : '#FF2200'}
              emissive={i < 5 ? '#00FF88' : '#FF2200'}
              emissiveIntensity={1.5}
            />
          </mesh>
        ))}
      </group>
      {/* SOC workstation */}
      <group position={[-0.75, 0, 0.12]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[1.1, 0.04, 0.44]} />
          <meshStandardMaterial color="#1A1E2A" roughness={0.55} metalness={0.3} />
        </mesh>
        {[-0.28, 0.28].map((mx, mi) => (
          <group key={mi} position={[mx, 0.5, -0.1]}>
            <mesh castShadow>
              <boxGeometry args={[0.44, 0.3, 0.04]} />
              <meshStandardMaterial color="#080810" roughness={0.3} metalness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0.025]}>
              <boxGeometry args={[0.38, 0.24, 0.018]} />
              <meshStandardMaterial
                color={mi === 0 ? '#0A1A3A' : '#1A0A2A'}
                emissive={mi === 0 ? '#1133AA' : '#8800CC'}
                emissiveIntensity={0.65}
              />
            </mesh>
            {[0.06, 0, -0.06].map((sy, si) => (
              <mesh key={si} position={[0, sy, 0.036]}>
                <boxGeometry args={[0.28 + si * 0.04, 0.018, 0.004]} />
                <meshStandardMaterial
                  color={mi === 0 ? '#4488FF' : '#CC44FF'}
                  emissive={mi === 0 ? '#4488FF' : '#CC44FF'}
                  emissiveIntensity={0.55}
                />
              </mesh>
            ))}
          </group>
        ))}
        {[[-0.48, -0.18], [0.48, -0.18], [-0.48, 0.18], [0.48, 0.18]].map(([lx, lz], li) => (
          <mesh key={li} position={[lx, 0.12, lz]}>
            <boxGeometry args={[0.04, 0.24, 0.04]} />
            <meshStandardMaterial color="#1A1E2A" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
      </group>
      {/* IDS sensor strip on floor */}
      <mesh position={[0.4, 0.022, 0.3]}>
        <boxGeometry args={[2.8, 0.022, 0.08]} />
        <meshStandardMaterial color="#CC00FF" emissive="#CC00FF" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function AlertBeacon({ x, z }) {
  const glowRef = useRef();
  useFrame(({ clock }) => {
    if (glowRef.current) {
      const pulse = Math.abs(Math.sin(clock.elapsedTime * 2.8));
      glowRef.current.material.emissiveIntensity = pulse * 2.8;
    }
  });

  return (
    <group position={[x, PLAT_H, z]}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.038, 0.048, 0.58, 8]} />
        <meshStandardMaterial color="#2A2A2A" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.63, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.15, 12]} />
        <meshStandardMaterial color="#1A1A1A" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh ref={glowRef} position={[0, 0.65, 0]}>
        <sphereGeometry args={[0.1, 10, 8]} />
        <meshStandardMaterial color="#FF2200" emissive="#FF2200" emissiveIntensity={1.5} transparent opacity={0.88} />
      </mesh>
    </group>
  );
}

// ── Cooling / Power Zone equipment ────────────────────────────────────────────
function PowerEquipment() {
  return (
    <group position={[0, PLAT_H, 0]}>
      <UpsUnit x={0.55} z={-0.75} />
      <UpsUnit x={1.2}  z={-0.75} />
      <CracUnit x={-0.65} z={-0.75} />
      {/* PDU */}
      <group position={[1.85, 0.38, -0.2]}>
        <mesh castShadow>
          <boxGeometry args={[0.14, 0.7, 0.16]} />
          <meshStandardMaterial color="#1A1A1A" roughness={0.4} metalness={0.6} />
        </mesh>
        {Array.from({ length: 9 }, (_, pi) => (
          <mesh key={pi} position={[0.078, -0.25 + pi * 0.075, 0]}>
            <boxGeometry args={[0.02, 0.024, 0.024]} />
            <meshStandardMaterial color="#00FF55" emissive="#00FF55" emissiveIntensity={1.6} />
          </mesh>
        ))}
      </group>
      {/* Power cable runs */}
      <mesh position={[0.5, 0.022, 0.1]}>
        <boxGeometry args={[3.2, 0.022, 0.1]} />
        <meshStandardMaterial color="#1A1A1A" roughness={0.85} />
      </mesh>
      <mesh position={[-0.4, 0.022, -0.35]}>
        <boxGeometry args={[0.06, 0.022, 0.85]} />
        <meshStandardMaterial color="#E67E22" roughness={0.8} />
      </mesh>
    </group>
  );
}

function UpsUnit({ x, z }) {
  const dispRef = useRef();
  useFrame(({ clock }) => {
    if (dispRef.current) dispRef.current.material.emissiveIntensity = 0.3 + Math.sin(clock.elapsedTime * 0.8 + x) * 0.15;
  });

  return (
    <group position={[x, 0.36, z]}>
      <mesh castShadow>
        <boxGeometry args={[0.36, 0.68, 0.24]} />
        <meshStandardMaterial color="#2A2A2A" roughness={0.35} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.1, 0.123]}>
        <boxGeometry args={[0.28, 0.42, 0.018]} />
        <meshStandardMaterial color="#111118" roughness={0.3} />
      </mesh>
      <mesh ref={dispRef} position={[0, 0.18, 0.135]}>
        <boxGeometry args={[0.18, 0.09, 0.008]} />
        <meshStandardMaterial color="#003A00" emissive="#00AA44" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.1, 0.3, 0.134]}>
        <boxGeometry args={[0.04, 0.04, 0.008]} />
        <meshStandardMaterial color="#00FF88" emissive="#00FF88" emissiveIntensity={1.8} />
      </mesh>
      {[-0.2, -0.12, -0.04].map((vy, vi) => (
        <mesh key={vi} position={[0, vy, 0.124]}>
          <boxGeometry args={[0.28, 0.026, 0.01]} />
          <meshStandardMaterial color="#1A1A1A" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function CracUnit({ x, z }) {
  const fanRef = useRef();
  useFrame(({ clock }) => {
    if (fanRef.current) fanRef.current.rotation.z = clock.elapsedTime * 5;
  });

  return (
    <group position={[x, 0.38, z]}>
      <mesh castShadow>
        <boxGeometry args={[0.88, 0.72, 0.22]} />
        <meshStandardMaterial color="#2A3242" roughness={0.4} metalness={0.45} />
      </mesh>
      <mesh position={[0, 0, 0.113]}>
        <boxGeometry args={[0.8, 0.65, 0.012]} />
        <meshStandardMaterial color="#1A2030" roughness={0.5} metalness={0.3} />
      </mesh>
      {Array.from({ length: 7 }, (_, vi) => (
        <mesh key={vi} position={[0, -0.24 + vi * 0.08, 0.12]}>
          <boxGeometry args={[0.7, 0.024, 0.016]} />
          <meshStandardMaterial color="#0D1220" roughness={0.6} />
        </mesh>
      ))}
      <group ref={fanRef} position={[0.28, 0.1, 0.12]}>
        {[0, 1, 2, 3].map(fi => (
          <mesh key={fi} rotation={[0, 0, fi * Math.PI / 2]}>
            <boxGeometry args={[0.14, 0.026, 0.01]} />
            <meshStandardMaterial color="#334455" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.28, 0.12]}>
        <boxGeometry args={[0.28, 0.1, 0.015]} />
        <meshStandardMaterial color="#0A1A2A" emissive="#1A4A6A" emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[0, -0.31, 0.12]}>
        <boxGeometry args={[0.68, 0.025, 0.01]} />
        <meshStandardMaterial color="#0044AA" emissive="#0044AA" emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

// ── Catwalk bridge ────────────────────────────────────────────────────────────
function CatwalkBridge({ fromSVG, toSVG }) {
  const [fx, , fz] = toWorld(fromSVG[0], fromSVG[1]);
  const [tx, , tz] = toWorld(toSVG[0],   toSVG[1]);
  const dx      = tx - fx;
  const dz      = tz - fz;
  const length  = Math.sqrt(dx * dx + dz * dz);
  const angle   = Math.atan2(dx, dz);
  const midX    = (fx + tx) / 2;
  const midZ    = (fz + tz) / 2;
  const walkY   = PLAT_H + 0.08;
  const railH   = 0.44;
  const railW   = 0.38;
  const nGrates = Math.max(2, Math.floor(length / 0.38));
  const nPosts  = Math.max(2, Math.floor(length / 0.85));

  return (
    <group position={[midX, 0, midZ]} rotation={[0, angle, 0]}>
      {/* Grating panels */}
      {Array.from({ length: nGrates }, (_, i) => {
        const zOff = -length / 2 + ((i + 0.5) / nGrates) * length;
        return (
          <group key={i} position={[0, walkY, zOff]}>
            <mesh receiveShadow>
              <boxGeometry args={[railW, 0.045, length / nGrates - 0.04]} />
              <meshStandardMaterial color="#3E444E" metalness={0.78} roughness={0.32} />
            </mesh>
            {/* Grating cross-bars */}
            {[-0.12, 0, 0.12].map((cx, ci) => (
              <mesh key={ci} position={[cx, 0.028, 0]}>
                <boxGeometry args={[0.022, 0.018, length / nGrates - 0.04]} />
                <meshStandardMaterial color="#2C3038" metalness={0.82} roughness={0.28} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* Handrails (top bars) */}
      {[-railW / 2, railW / 2].map((xOff, i) => (
        <group key={i}>
          <mesh position={[xOff, walkY + railH, 0]} castShadow>
            <boxGeometry args={[0.042, 0.042, length]} />
            <meshStandardMaterial color="#5A6070" metalness={0.87} roughness={0.18} />
          </mesh>
          {/* Glowing LED strip on top rail */}
          <mesh position={[xOff, walkY + railH - 0.026, 0]}>
            <boxGeometry args={[0.018, 0.018, length - 0.08]} />
            <meshStandardMaterial color="#00CCFF" emissive="#00CCFF" emissiveIntensity={0.8} />
          </mesh>
          {/* Bottom rail */}
          <mesh position={[xOff, walkY + 0.002, 0]}>
            <boxGeometry args={[0.042, 0.042, length]} />
            <meshStandardMaterial color="#4A5060" metalness={0.84} roughness={0.22} />
          </mesh>
        </group>
      ))}
      {/* Vertical posts */}
      {Array.from({ length: nPosts + 2 }, (_, i) => {
        const zOff = -length / 2 + (i / (nPosts + 1)) * length;
        return (
          <group key={i}>
            {[-railW / 2, railW / 2].map((xOff, j) => (
              <mesh key={j} position={[xOff, walkY + railH / 2, zOff]} castShadow>
                <boxGeometry args={[0.042, railH, 0.042]} />
                <meshStandardMaterial color="#4A5060" metalness={0.82} roughness={0.24} />
              </mesh>
            ))}
            {/* Mid cross-brace */}
            <mesh position={[0, walkY + railH * 0.5, zOff]}>
              <boxGeometry args={[railW, 0.03, 0.03]} />
              <meshStandardMaterial color="#3A4050" metalness={0.75} roughness={0.3} />
            </mesh>
          </group>
        );
      })}
      {/* Floor edge glow strips */}
      {[-railW / 2 + 0.045, railW / 2 - 0.045].map((xOff, i) => (
        <mesh key={i} position={[xOff, walkY + 0.038, 0]}>
          <boxGeometry args={[0.028, 0.014, length - 0.06]} />
          <meshStandardMaterial color="#00E8FF" emissive="#00E8FF" emissiveIntensity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ── Space tile — circular glowing tech pad ────────────────────────────────────
function SpaceTile({ space, isLanding }) {
  const discRef = useRef();
  const ringRef = useRef();
  const color   = SPACE_COLORS[space.type] ?? '#555';
  const [wx, , wz] = toWorld(space.x, space.y);
  const isBackbone  = space.zone === 'backbone';
  const tileY       = isBackbone ? BACKBONE_H + 0.01 : PLAT_H + 0.01;

  useFrame(({ clock }) => {
    if (discRef.current) {
      if (isLanding) {
        const s = 1 + Math.sin(clock.elapsedTime * 5) * 0.09;
        discRef.current.scale.set(s, 1, s);
      } else {
        discRef.current.scale.set(1, 1, 1);
      }
    }
    if (ringRef.current) {
      ringRef.current.material.emissiveIntensity = isLanding
        ? 2.0 + Math.sin(clock.elapsedTime * 5) * 0.9
        : 0.85 + Math.sin(clock.elapsedTime * 2.2 + wx) * 0.3;
    }
  });

  return (
    <group position={[wx, 0, wz]}>
      {/* Backbone hexagonal pedestal */}
      {isBackbone && (
        <group>
          <mesh castShadow position={[0, BACKBONE_H / 2, 0]}>
            <cylinderGeometry args={[0.34, 0.4, BACKBONE_H, 6]} />
            <meshStandardMaterial color="#1A2030" roughness={0.38} metalness={0.68} />
          </mesh>
          {/* Pedestal accent ring at top */}
          <mesh position={[0, BACKBONE_H - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.3, 0.4, 6]} />
            <meshStandardMaterial color="#2979FF" emissive="#2979FF" emissiveIntensity={0.55} transparent opacity={0.9} />
          </mesh>
          {/* Pedestal glow base */}
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.28, 0.48, 6]} />
            <meshStandardMaterial color="#2979FF" emissive="#2979FF" emissiveIntensity={0.35} transparent opacity={0.5} />
          </mesh>
        </group>
      )}

      {/* Circular disc pad */}
      <group position={[0, tileY, 0]}>
        <mesh ref={discRef} castShadow receiveShadow>
          <cylinderGeometry args={[0.27, 0.3, 0.1, 20]} />
          <meshStandardMaterial
            color={color} roughness={0.28} metalness={0.35}
            emissive={color} emissiveIntensity={isLanding ? 0.6 : 0.18}
          />
        </mesh>
        {/* Outer glow ring */}
        <mesh ref={ringRef} position={[0, 0.056, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.31, 0.028, 8, 20]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.85} />
        </mesh>
        {/* Inner detail ring */}
        <mesh position={[0, 0.053, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.14, 0.2, 20]} />
          <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.25} transparent opacity={0.35} />
        </mesh>
      </group>

      {/* Floating icon + label */}
      <Billboard position={[0, tileY + 0.52, 0]}>
        <Text fontSize={0.19} anchorX="center" anchorY="middle">
          {SPACE_ICONS[space.type] ?? '?'}
        </Text>
        <Text
          fontSize={0.085}
          color="#DDDDEE"
          anchorX="center"
          anchorY="middle"
          position={[0, -0.175, 0]}
          outlineWidth={0.018}
          outlineColor="#000000"
        >
          {space.displayName ?? space.name}
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
  const angle  = Math.atan2(dx, dz);
  const fromY  = from.zone === 'backbone' ? BACKBONE_H : PLAT_H;
  const toY    = to.zone   === 'backbone' ? BACKBONE_H : PLAT_H;
  const midY   = (fromY + toY) / 2 - 0.01;

  return (
    <mesh
      position={[(fx + tx) / 2, midY, (fz + tz) / 2]}
      rotation={[0, angle, 0]}
      receiveShadow
    >
      <boxGeometry args={[0.09, 0.032, length]} />
      <meshStandardMaterial color="#1A2A3C" roughness={0.9} />
    </mesh>
  );
}

// ── Player token with hop animation ──────────────────────────────────────────
function PlayerToken({ player, stackCount, stackIndex, isActive }) {
  const bodyRef     = useRef();
  const hopRef      = useRef(0);
  const prevPosRef  = useRef(player.position);

  const char        = CHARACTERS[player.characterId];
  const bodyColor   = char?.bodyColor   ?? '#888';
  const accentColor = char?.accentColor ?? '#aaa';
  const space       = BOARD_SPACES[player.position];
  const [wx, , wz]  = toWorld(space.x, space.y);

  const spread   = stackCount > 1 ? 0.3 : 0;
  const ang      = stackCount > 1 ? (stackIndex / stackCount) * Math.PI * 2 : 0;
  const px       = wx + Math.cos(ang) * spread;
  const pz       = wz + Math.sin(ang) * spread;
  const bobPhase = stackIndex * 1.1;

  useEffect(() => {
    if (player.position !== prevPosRef.current) {
      prevPosRef.current = player.position;
      hopRef.current     = 1.0;
    }
  }, [player.position]);

  useFrame(({ clock }, delta) => {
    if (!bodyRef.current) return;
    if (hopRef.current > 0) hopRef.current = Math.max(0, hopRef.current - delta * 3.5);
    const hop    = Math.sin(Math.max(0, hopRef.current) * Math.PI) * 0.65;
    const bob    = Math.sin(clock.elapsedTime * 2.0 + bobPhase) * 0.06;
    const onBack = space?.zone === 'backbone';
    const baseY  = onBack ? BACKBONE_H + 0.45 : PLAT_H + 0.45;
    bodyRef.current.position.y = baseY + hop + bob;
  });

  return (
    <group position={[px, 0, pz]}>
      <group ref={bodyRef}>
        {/* Cylinder body */}
        <mesh castShadow>
          <cylinderGeometry args={[0.15, 0.18, 0.28, 12]} />
          <meshStandardMaterial
            color={bodyColor} roughness={0.2} metalness={0.55}
            emissive={bodyColor} emissiveIntensity={isActive ? 0.45 : 0.08}
          />
        </mesh>
        {/* Dome cap */}
        <mesh position={[0, 0.2, 0]} castShadow>
          <sphereGeometry args={[0.15, 12, 8]} />
          <meshStandardMaterial
            color={accentColor} roughness={0.18} metalness={0.5}
            emissive={accentColor} emissiveIntensity={isActive ? 0.35 : 0.06}
          />
        </mesh>
      </group>

      {isActive && <ActiveHalo color={accentColor} />}

      {/* Holographic name tag */}
      <Billboard position={[0, PLAT_H + 1.15, 0]}>
        <mesh position={[0, 0, -0.022]}>
          <boxGeometry args={[0.6, 0.26, 0.016]} />
          <meshStandardMaterial color={bodyColor} emissive={bodyColor} emissiveIntensity={isActive ? 0.9 : 0.3} />
        </mesh>
        <mesh position={[0, 0, -0.012]}>
          <boxGeometry args={[0.55, 0.22, 0.016]} />
          <meshStandardMaterial color="#080810" opacity={0.9} transparent />
        </mesh>
        <Text
          fontSize={0.16}
          color="#FFFFFF"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {player.name.slice(0, 6).toUpperCase()}
        </Text>
      </Billboard>
    </group>
  );
}

function ActiveHalo({ color }) {
  const ringRef = useRef();
  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.12;
    ringRef.current.scale.set(s, s, s);
    ringRef.current.material.opacity = 0.6 + Math.sin(clock.elapsedTime * 3) * 0.2;
  });
  return (
    <mesh ref={ringRef} position={[0, PLAT_H + 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.28, 0.4, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={0.7} />
    </mesh>
  );
}
