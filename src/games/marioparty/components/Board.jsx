import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { BOARD_SPACES, SPACE_COLORS, SPACE_ICONS, ZONES } from '../../../../shared/boardData.js';
import { CHARACTERS } from '../../../../shared/characters.js';

// ── Coordinate helpers ────────────────────────────────────────────────────────
const SVG_CX = 430;
const SVG_CY = 295;
const SCALE  = 60;
const PLAT_H = 0.32; // island platform height

function toWorld(svgX, svgY) {
  return [(svgX - SVG_CX) / SCALE, 0, (svgY - SVG_CY) / SCALE];
}

// Precomputed zone world-space data (used by multiple components)
const ZONE_WORLD = {};
Object.entries(ZONES).forEach(([key, z]) => {
  const [cx, , cz] = toWorld(z.cx, z.cy);
  ZONE_WORLD[key] = { cx, cz, w: z.w / SCALE, d: z.h / SCALE,
                      label: z.label, accent: z.accentColor };
});

// Cable bridge specs: [fromSVG, toSVG]
const CABLE_BRIDGES = [
  { from: [388, 115], to: [482, 115] },  // top   (SR → NOC)
  { from: [760, 212], to: [760, 358] },  // right (NOC → Storage)
  { from: [482, 475], to: [373, 475] },  // bottom (Storage → Power)
  { from: [130, 358], to: [130, 218] },  // left  (Power → SR)
];

// ── Camera setup ──────────────────────────────────────────────────────────────
function CameraSetup() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 14, 10);
    camera.zoom = 44;
    camera.near = 0.1;
    camera.far = 1000;
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
        orthographic
        shadows
        camera={{ zoom: 44, near: 0.1, far: 1000 }}
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
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[6, 12, 8]} intensity={0.85} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-near={0.5} shadow-camera-far={60}
        shadow-camera-left={-13} shadow-camera-right={13}
        shadow-camera-top={11} shadow-camera-bottom={-11}
      />
      <directionalLight position={[-4, 6, -4]} intensity={0.2} />
      {/* One point light per zone, simulating overhead fluorescent panels */}
      {Object.values(ZONE_WORLD).map((z, i) => (
        <pointLight key={i} position={[z.cx, 4, z.cz]} intensity={1.1} distance={8} color="#C8DCFF" />
      ))}
    </>
  );
}

// ── Board scene ───────────────────────────────────────────────────────────────
function BoardScene({ gameState }) {
  const players          = gameState?.players ?? [];
  const phase            = gameState?.phase;
  const currentPlayerId  = gameState?.currentPlayerId;

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

      {/* Island platforms */}
      {Object.keys(ZONES).map(key => (
        <ZonePlatform key={key} zoneKey={key} />
      ))}

      {/* Cable tray bridges between islands */}
      {CABLE_BRIDGES.map((b, i) => (
        <CableBridge key={i} fromSVG={b.from} toSVG={b.to} />
      ))}

      {/* Path segments */}
      {connections.map(({ from, to }) => (
        <PathSegment key={`${from.id}-${to.id}`} from={from} to={to} />
      ))}

      {/* Space tiles */}
      {BOARD_SPACES.map(space => (
        <SpaceTile key={space.id} space={space} isLanding={space.id === landingSpaceId} />
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

// ── Background floor ──────────────────────────────────────────────────────────
function BackgroundFloor() {
  const gridLines = useMemo(() => {
    const lines = [];
    const step = 1.2;
    for (let x = -12; x <= 12; x += step) lines.push({ axis: 'x', pos: x });
    for (let z = -8;  z <= 8;  z += step) lines.push({ axis: 'z', pos: z });
    return lines;
  }, []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.025, 0]}>
        <planeGeometry args={[28, 20]} />
        <meshStandardMaterial color="#060D18" roughness={1} />
      </mesh>
      {gridLines.map((g, i) =>
        g.axis === 'x' ? (
          <mesh key={i} position={[g.pos, -0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.014, 18]} />
            <meshStandardMaterial color="#0C1A28" />
          </mesh>
        ) : (
          <mesh key={i} position={[0, -0.018, g.pos]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[26, 0.014]} />
            <meshStandardMaterial color="#0C1A28" />
          </mesh>
        )
      )}
    </group>
  );
}

// ── Zone platform ─────────────────────────────────────────────────────────────
function ZonePlatform({ zoneKey }) {
  const zw = ZONE_WORLD[zoneKey];

  // Raised floor tile grid on platform top surface
  const tiles = useMemo(() => {
    const spacing = 0.48;
    const size    = 0.42;
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
        <meshStandardMaterial color="#C8CED6" roughness={0.65} metalness={0.06} />
      </mesh>
      {/* Side trim (darker lip at base) */}
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[zw.w + 0.12, 0.07, zw.d + 0.12]} />
        <meshStandardMaterial color="#96A0AA" roughness={0.75} metalness={0.1} />
      </mesh>
      {/* Raised floor tiles */}
      {tiles.map(([tx, tz], i) => (
        <mesh key={i} position={[tx, PLAT_H + 0.014, tz]} receiveShadow>
          <boxGeometry args={[0.42, 0.026, 0.42]} />
          <meshStandardMaterial color="#B4BAC2" roughness={0.72} metalness={0.05} />
        </mesh>
      ))}
      {/* Accent edge strip (near camera = positive Z edge) */}
      <mesh position={[0, PLAT_H + 0.045, zw.d / 2 + 0.02]}>
        <boxGeometry args={[zw.w, 0.04, 0.07]} />
        <meshStandardMaterial color={zw.accent} emissive={zw.accent} emissiveIntensity={0.55} />
      </mesh>
      {/* Zone name label */}
      <Billboard position={[0, PLAT_H + 1.6, zw.d / 2 + 0.35]}>
        <Text fontSize={0.26} color={zw.accent} anchorX="center" anchorY="middle"
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
    <group position={[0, 4.0, 0]}>
      {positions.map(([fx, fz], i) => (
        <group key={i} position={[fx, 0, fz]}>
          <mesh>
            <boxGeometry args={[0.88, 0.04, 0.14]} />
            <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={1.9} />
          </mesh>
          <pointLight position={[0, -0.6, 0]} intensity={0.55} distance={5} color="#D4E8FF" />
        </group>
      ))}
    </group>
  );
}

// ── Zone equipment ────────────────────────────────────────────────────────────
function ZoneEquipment({ zoneKey, w, d }) {
  switch (zoneKey) {
    case 'serverRoom': return <ServerRoomEquipment />;
    case 'noc':        return <NocEquipment />;
    case 'storage':    return <StorageEquipment />;
    case 'power':      return <PowerEquipment />;
    default:           return null;
  }
}

// Server Room: rows of server racks in hot/cold aisle arrangement
function ServerRoomEquipment() {
  // Racks placed at back of zone (negative Z = toward top-left in isometric view)
  // Space tiles in this zone occupy approx local z=-1.0 to +1.0, x=-1.9 to +1.9
  // We place racks at z=-1.5 (behind the tile rows)
  const rackDefs = [
    { x: -1.75, z: -1.42 }, { x: -1.1,  z: -1.42 },
    { x: -0.2,  z: -1.42 }, { x:  0.5,  z: -1.42 },
    { x:  1.2,  z: -1.42 }, { x:  1.9,  z: -1.42 },
    { x: -1.75, z: -1.0, shortRack: true },
    { x:  1.9,  z: -1.0, shortRack: true },
  ];

  return (
    <group position={[0, PLAT_H, 0]}>
      {/* Hot aisle indicator strip */}
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
      {/* Rack chassis */}
      <mesh castShadow>
        <boxGeometry args={[0.3, h, 0.13]} />
        <meshStandardMaterial color="#1C1C1E" roughness={0.4} metalness={0.6} />
      </mesh>
      {/* Front panel */}
      <mesh position={[0, 0, 0.068]}>
        <boxGeometry args={[0.26, h - 0.06, 0.014]} />
        <meshStandardMaterial color="#222228" roughness={0.3} metalness={0.65} />
      </mesh>
      {/* Blue LED strip (primary) */}
      <mesh ref={led1Ref} position={[0, 0.18, 0.077]}>
        <boxGeometry args={[0.2, 0.014, 0.008]} />
        <meshStandardMaterial color="#0066FF" emissive="#0066FF" emissiveIntensity={1.5} />
      </mesh>
      {/* Cyan LED strip (secondary) */}
      <mesh ref={led2Ref} position={[0, -0.04, 0.077]}>
        <boxGeometry args={[0.2, 0.014, 0.008]} />
        <meshStandardMaterial color="#00AAFF" emissive="#00AAFF" emissiveIntensity={1.1} />
      </mesh>
      {/* Green status LED */}
      <mesh position={[0.09, h / 2 - 0.07, 0.078]}>
        <boxGeometry args={[0.024, 0.024, 0.008]} />
        <meshStandardMaterial color="#00FF55" emissive="#00FF55" emissiveIntensity={1.8} />
      </mesh>
      {/* Drive unit rows (aesthetic detail) */}
      {Array.from({ length: short ? 3 : 5 }, (_, row) => (
        <mesh key={row} position={[0, -h / 2 + 0.1 + row * (h / (short ? 4 : 6)), 0.075]}>
          <boxGeometry args={[0.22, 0.03, 0.01]} />
          <meshStandardMaterial color="#2A2A2E" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

// NOC: monitor wall + operator desks
function NocEquipment() {
  const screenColors = ['#0A2A6A', '#0A3A1A', '#1A1A6A', '#2A0A4A', '#0A2A4A'];
  const screenGlows  = ['#0066FF', '#00AA44', '#4444FF', '#8822CC', '#0088AA'];

  return (
    <group position={[0, PLAT_H, 0]}>
      {/* Monitor wall backing */}
      <mesh position={[0, 0.88, -0.86]} castShadow>
        <boxGeometry args={[4.2, 1.35, 0.09]} />
        <meshStandardMaterial color="#181822" roughness={0.45} metalness={0.35} />
      </mesh>
      {/* Individual monitor screens */}
      {screenColors.map((bg, i) => {
        const sx = (i - 2) * 0.82;
        return (
          <group key={i} position={[sx, 0.9, -0.82]}>
            <mesh castShadow>
              <boxGeometry args={[0.72, 0.48, 0.05]} />
              <meshStandardMaterial color="#0D0D16" roughness={0.3} metalness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0.03]}>
              <boxGeometry args={[0.65, 0.41, 0.018]} />
              <meshStandardMaterial color={bg} emissive={screenGlows[i]} emissiveIntensity={0.65} roughness={0.1} />
            </mesh>
            {/* Screen content lines (simulated data) */}
            {[0.12, 0.04, -0.04, -0.12].map((ly, li) => (
              <mesh key={li} position={[i % 2 === 0 ? -0.05 : 0.05, ly, 0.045]}>
                <boxGeometry args={[0.35 + (li % 2) * 0.15, 0.018, 0.004]} />
                <meshStandardMaterial color={screenGlows[i]} emissive={screenGlows[i]} emissiveIntensity={0.5} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* Wall mount bracket */}
      <mesh position={[0, 0.44, -0.9]}>
        <boxGeometry args={[4.0, 0.06, 0.06]} />
        <meshStandardMaterial color="#444450" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Operator desks */}
      {[-1.3, 0.3].map((dx, i) => (
        <group key={i} position={[dx, 0, 0.15]}>
          {/* Desk surface */}
          <mesh position={[0, 0.34, 0]} castShadow>
            <boxGeometry args={[1.0, 0.055, 0.48]} />
            <meshStandardMaterial color="#2C3442" roughness={0.6} metalness={0.2} />
          </mesh>
          {/* Monitor on desk */}
          <mesh position={[0, 0.6, -0.12]} castShadow>
            <boxGeometry args={[0.44, 0.3, 0.035]} />
            <meshStandardMaterial color="#0A0A14" emissive="#1A2A4A" emissiveIntensity={0.35} />
          </mesh>
          {/* Keyboard */}
          <mesh position={[0, 0.38, 0.1]}>
            <boxGeometry args={[0.3, 0.018, 0.12]} />
            <meshStandardMaterial color="#1A1A22" roughness={0.7} metalness={0.3} />
          </mesh>
          {/* Desk legs */}
          {[[-0.44, -0.2], [0.44, -0.2], [-0.44, 0.2], [0.44, 0.2]].map(([lx, lz], li) => (
            <mesh key={li} position={[lx, 0.17, lz]}>
              <boxGeometry args={[0.04, 0.34, 0.04]} />
              <meshStandardMaterial color="#222832" metalness={0.7} roughness={0.3} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// Storage Array: large disk cabinets + SAN switch
function StorageEquipment() {
  return (
    <group position={[0, PLAT_H, 0]}>
      {[[-1.55, -0.45], [-0.45, -0.45], [0.65, -0.45]].map(([ax, az], i) => (
        <StorageUnit key={i} x={ax} z={az} phase={i * 0.9} />
      ))}
      {/* SAN switch */}
      <group position={[1.85, 0.14, -0.45]}>
        <mesh castShadow>
          <boxGeometry args={[0.5, 0.2, 0.22]} />
          <meshStandardMaterial color="#0D1117" roughness={0.3} metalness={0.75} />
        </mesh>
        {/* Port indicators */}
        {Array.from({ length: 8 }, (_, p) => (
          <mesh key={p} position={[-0.17 + (p % 4) * 0.11, 0.04, 0.115]}>
            <boxGeometry args={[0.045, 0.045, 0.015]} />
            <meshStandardMaterial
              color={p % 3 === 0 ? '#00FF44' : '#0066FF'}
              emissive={p % 3 === 0 ? '#00FF44' : '#0066FF'}
              emissiveIntensity={1.4}
            />
          </mesh>
        ))}
        {/* Label stripe */}
        <mesh position={[0, -0.07, 0.115]}>
          <boxGeometry args={[0.38, 0.022, 0.01]} />
          <meshStandardMaterial color="#8E44AD" emissive="#8E44AD" emissiveIntensity={0.6} />
        </mesh>
      </group>
      {/* Floor cable trunking */}
      <mesh position={[0, 0.025, 0.22]}>
        <boxGeometry args={[4.0, 0.03, 0.1]} />
        <meshStandardMaterial color="#1A1A28" roughness={0.8} />
      </mesh>
    </group>
  );
}

function StorageUnit({ x, z, phase }) {
  const actRef = useRef();

  useFrame(({ clock }) => {
    if (actRef.current) {
      actRef.current.material.emissiveIntensity = 0.5 + Math.abs(Math.sin(clock.elapsedTime * 3.5 + phase)) * 1.2;
    }
  });

  return (
    <group position={[x, 0.38, z]}>
      {/* Cabinet body */}
      <mesh castShadow>
        <boxGeometry args={[0.82, 0.72, 0.22]} />
        <meshStandardMaterial color="#1A1A2E" roughness={0.3} metalness={0.65} />
      </mesh>
      {/* Drive bay face plate */}
      <mesh position={[0, 0, 0.115]}>
        <boxGeometry args={[0.74, 0.64, 0.012]} />
        <meshStandardMaterial color="#101020" roughness={0.2} metalness={0.7} />
      </mesh>
      {/* Drive slots */}
      {Array.from({ length: 12 }, (_, di) => (
        <mesh key={di} position={[-0.26 + (di % 4) * 0.18, -0.2 + Math.floor(di / 4) * 0.2, 0.122]}>
          <boxGeometry args={[0.14, 0.16, 0.008]} />
          <meshStandardMaterial color="#0D0D20" roughness={0.3} metalness={0.6} />
        </mesh>
      ))}
      {/* Activity LED strip */}
      <mesh ref={actRef} position={[0, 0.3, 0.122]}>
        <boxGeometry args={[0.62, 0.022, 0.008]} />
        <meshStandardMaterial color="#FFA500" emissive="#FFA500" emissiveIntensity={1.0} />
      </mesh>
      {/* Status indicators */}
      {[0, 1, 2].map(si => (
        <mesh key={si} position={[-0.12 + si * 0.12, 0.28, 0.123]}>
          <boxGeometry args={[0.028, 0.028, 0.008]} />
          <meshStandardMaterial
            color={si === 0 ? '#00FF55' : si === 1 ? '#0088FF' : '#FF4400'}
            emissive={si === 0 ? '#00FF55' : si === 1 ? '#0088FF' : '#FF4400'}
            emissiveIntensity={1.5}
          />
        </mesh>
      ))}
    </group>
  );
}

// Power & Cooling: UPS units, CRAC unit, PDU
function PowerEquipment() {
  return (
    <group position={[0, PLAT_H, 0]}>
      <UpsUnit x={0.55} z={-0.75} />
      <UpsUnit x={1.2}  z={-0.75} />
      <CracUnit x={-0.65} z={-0.75} />

      {/* PDU power distribution unit */}
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

      {/* Power cable runs on floor */}
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
      {/* Front panel */}
      <mesh position={[0, 0.1, 0.123]}>
        <boxGeometry args={[0.28, 0.42, 0.018]} />
        <meshStandardMaterial color="#111118" roughness={0.3} />
      </mesh>
      {/* Display */}
      <mesh ref={dispRef} position={[0, 0.18, 0.135]}>
        <boxGeometry args={[0.18, 0.09, 0.008]} />
        <meshStandardMaterial color="#003A00" emissive="#00AA44" emissiveIntensity={0.4} />
      </mesh>
      {/* Green status */}
      <mesh position={[0.1, 0.3, 0.134]}>
        <boxGeometry args={[0.04, 0.04, 0.008]} />
        <meshStandardMaterial color="#00FF88" emissive="#00FF88" emissiveIntensity={1.8} />
      </mesh>
      {/* Vent slits */}
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
      {/* Cabinet */}
      <mesh castShadow>
        <boxGeometry args={[0.88, 0.72, 0.22]} />
        <meshStandardMaterial color="#2A3242" roughness={0.4} metalness={0.45} />
      </mesh>
      {/* Vent grille face */}
      <mesh position={[0, 0, 0.113]}>
        <boxGeometry args={[0.8, 0.65, 0.012]} />
        <meshStandardMaterial color="#1A2030" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Grille slits */}
      {Array.from({ length: 7 }, (_, vi) => (
        <mesh key={vi} position={[0, -0.24 + vi * 0.08, 0.12]}>
          <boxGeometry args={[0.7, 0.024, 0.016]} />
          <meshStandardMaterial color="#0D1220" roughness={0.6} />
        </mesh>
      ))}
      {/* Fan (animated) */}
      <group ref={fanRef} position={[0.28, 0.1, 0.12]}>
        {[0, 1, 2, 3].map(fi => (
          <mesh key={fi} rotation={[0, 0, fi * Math.PI / 2]}>
            <boxGeometry args={[0.14, 0.026, 0.01]} />
            <meshStandardMaterial color="#334455" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
      </group>
      {/* Status display */}
      <mesh position={[0, 0.28, 0.12]}>
        <boxGeometry args={[0.28, 0.1, 0.015]} />
        <meshStandardMaterial color="#0A1A2A" emissive="#1A4A6A" emissiveIntensity={0.55} />
      </mesh>
      {/* Blue accent line */}
      <mesh position={[0, -0.31, 0.12]}>
        <boxGeometry args={[0.68, 0.025, 0.01]} />
        <meshStandardMaterial color="#0044AA" emissive="#0044AA" emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

// ── Cable bridge between islands ──────────────────────────────────────────────
function CableBridge({ fromSVG, toSVG }) {
  const [fx, , fz] = toWorld(fromSVG[0], fromSVG[1]);
  const [tx, , tz] = toWorld(toSVG[0],   toSVG[1]);
  const dx     = tx - fx;
  const dz     = tz - fz;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle  = Math.atan2(dx, dz);
  const midX   = (fx + tx) / 2;
  const midZ   = (fz + tz) / 2;
  const ty     = PLAT_H + 0.14;
  const railOff = 0.2;
  const nSupports = Math.max(1, Math.floor(length / 0.6));

  return (
    <group position={[midX, 0, midZ]} rotation={[0, angle, 0]}>
      {/* Left and right rails */}
      {[-railOff, railOff].map((off, i) => (
        <mesh key={i} position={[off, ty, 0]} castShadow>
          <boxGeometry args={[0.055, 0.065, length]} />
          <meshStandardMaterial color="#888890" metalness={0.88} roughness={0.18} />
        </mesh>
      ))}
      {/* Cable bundles (blue fiber, orange power, grey copper) */}
      {[{ color: '#1A5590', x: -0.07 },
        { color: '#C85000', x:  0.00 },
        { color: '#5A6470', x:  0.07 }].map((c, i) => (
        <mesh key={i} position={[c.x, ty - 0.018, 0]}>
          <boxGeometry args={[0.055, 0.028, length - 0.06]} />
          <meshStandardMaterial color={c.color} roughness={0.8} />
        </mesh>
      ))}
      {/* Cross supports */}
      {Array.from({ length: nSupports }, (_, i) => (
        <mesh key={i} position={[0, ty + 0.038, -length / 2 + ((i + 1) / (nSupports + 1)) * length]}>
          <boxGeometry args={[railOff * 2 + 0.07, 0.04, 0.045]} />
          <meshStandardMaterial color="#666670" metalness={0.72} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

// ── Space tile (replaces cylinder puck) ───────────────────────────────────────
function SpaceTile({ space, isLanding }) {
  const meshRef  = useRef();
  const color    = SPACE_COLORS[space.type] ?? '#555';
  const [wx, , wz] = toWorld(space.x, space.y);
  const tileY    = PLAT_H + 0.005;
  const pSize    = 0.52;
  const pThick   = 0.075;
  const fThick   = 0.038;
  const fHeight  = 0.014;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (isLanding) {
      const s = 1 + Math.sin(clock.elapsedTime * 5) * 0.09;
      meshRef.current.scale.set(s, 1, s);
    } else {
      meshRef.current.scale.set(1, 1, 1);
    }
  });

  return (
    <group position={[wx, tileY, wz]}>
      {/* Main panel */}
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[pSize, pThick, pSize]} />
        <meshStandardMaterial
          color={color} roughness={0.35} metalness={0.28}
          emissive={color} emissiveIntensity={isLanding ? 0.45 : 0.1}
        />
      </mesh>

      {/* LED border frame — 4 bars (front, back, left, right) */}
      {[
        { pos: [0, pThick / 2 + fHeight / 2, -(pSize / 2 - fThick / 2)], args: [pSize, fHeight, fThick] },
        { pos: [0, pThick / 2 + fHeight / 2,  (pSize / 2 - fThick / 2)], args: [pSize, fHeight, fThick] },
        { pos: [-(pSize / 2 - fThick / 2), pThick / 2 + fHeight / 2, 0], args: [fThick, fHeight, pSize] },
        { pos: [ (pSize / 2 - fThick / 2), pThick / 2 + fHeight / 2, 0], args: [fThick, fHeight, pSize] },
      ].map(({ pos, args }, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={args} />
          <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={isLanding ? 1.8 : 0.7} />
        </mesh>
      ))}

      {/* Floating icon + IT label */}
      <Billboard position={[0, 0.52, 0]}>
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

  return (
    <mesh
      position={[(fx + tx) / 2, PLAT_H - 0.01, (fz + tz) / 2]}
      rotation={[0, angle, 0]}
      receiveShadow
    >
      <boxGeometry args={[0.09, 0.035, length]} />
      <meshStandardMaterial color="#1C2A3C" roughness={0.9} />
    </mesh>
  );
}

// ── Player token ──────────────────────────────────────────────────────────────
function PlayerToken({ player, stackCount, stackIndex, isActive }) {
  const bodyRef    = useRef();
  const char       = CHARACTERS[player.characterId];
  const bodyColor  = char?.bodyColor  ?? '#888';
  const accentColor = char?.accentColor ?? '#aaa';
  const space      = BOARD_SPACES[player.position];
  const [wx, , wz] = toWorld(space.x, space.y);

  const spread = stackCount > 1 ? 0.3 : 0;
  const ang    = stackCount > 1 ? (stackIndex / stackCount) * Math.PI * 2 : 0;
  const px     = wx + Math.cos(ang) * spread;
  const pz     = wz + Math.sin(ang) * spread;
  const bobPhase = stackIndex * 1.1;

  useFrame(({ clock }) => {
    if (!bodyRef.current) return;
    const bob = Math.sin(clock.elapsedTime * 2.0 + bobPhase) * 0.06;
    bodyRef.current.position.y = PLAT_H + 0.45 + bob;
  });

  return (
    <group position={[px, 0, pz]}>
      {/* Token body + cap */}
      <group ref={bodyRef}>
        {/* Cylinder base */}
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

      {/* Active halo */}
      {isActive && <ActiveHalo spaceH={PLAT_H} color={accentColor} />}

      {/* Holographic name tag */}
      <Billboard position={[0, PLAT_H + 1.1, 0]}>
        {/* Tag border glow */}
        <mesh position={[0, 0, -0.022]}>
          <boxGeometry args={[0.6, 0.26, 0.016]} />
          <meshStandardMaterial color={bodyColor} emissive={bodyColor} emissiveIntensity={isActive ? 0.9 : 0.3} />
        </mesh>
        {/* Tag backing */}
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
      <ringGeometry args={[0.28, 0.4, 32]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={0.7} />
    </mesh>
  );
}
