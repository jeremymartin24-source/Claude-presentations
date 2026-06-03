// ── Data Center Board — 4 Themed Zones ───────────────────────────────────────
// Zones: Server Rack Zone, Network Core Zone, Security Ops Center, Cooling/Power Zone
//
// Main loop:  0→1→2→3→4→5→6→7→8→9→10→11→12→13→14→15→16→17→18→19→20→21→22→23→0
// Fork @4  → [5 | 24]  backbone shortcut skips Network Core
// Fork @16 → [17 | 27] backbone shortcut skips Cooling/Power
// Backbone1: 24→25→26→15   Backbone2: 27→28→29→22
//
// Internal type identifiers (coin, star, badluck, etc.) are UNCHANGED — game logic needs no edits.

export const BOARD_SPACES = [
  // ─── SERVER RACK ZONE (top-left, spaces 0-5) ──────────────────────────────
  { id: 0,  type: 'start',    name: 'DC Lobby',          displayName: 'DC Lobby',          zone: 'rackZone',     x: 130, y: 165, next: [1],      isStart: true },
  { id: 1,  type: 'coin',     name: 'Bandwidth Boost',   displayName: 'Bandwidth Boost',   zone: 'rackZone',     x: 175, y: 105, next: [2] },
  { id: 2,  type: 'question', name: 'Security Scan',     displayName: 'Security Scan',     zone: 'rackZone',     x: 245, y: 105, next: [3] },
  { id: 3,  type: 'badluck',  name: 'Malware Attack',    displayName: 'Malware Attack',    zone: 'rackZone',     x: 315, y: 105, next: [4] },
  { id: 4,  type: 'fork',     name: 'Route Switch',      displayName: 'Route Switch',      zone: 'rackZone',     x: 355, y: 165, next: [5, 24] },
  { id: 5,  type: 'shop',     name: 'Firmware Shop',     displayName: 'Firmware Shop',     zone: 'rackZone',     x: 315, y: 225, next: [6] },

  // ─── CATWALK BRIDGE: Rack Zone → Network Core ─────────────────────────────
  { id: 6,  type: 'coin',     name: 'Network Hop',       displayName: 'Network Hop',       zone: 'bridge',       x: 430, y: 115, next: [7] },

  // ─── NETWORK CORE ZONE (top-right, spaces 7-11) ───────────────────────────
  { id: 7,  type: 'coin',     name: 'Core Credits',      displayName: 'Core Credits',      zone: 'networkCore',  x: 515, y: 100, next: [8] },
  { id: 8,  type: 'event',    name: 'System Alert',      displayName: 'System Alert',      zone: 'networkCore',  x: 590, y: 100, next: [9] },
  { id: 9,  type: 'question', name: 'Firewall Quiz',     displayName: 'Firewall Quiz',     zone: 'networkCore',  x: 660, y: 100, next: [10] },
  { id: 10, type: 'star',     name: 'Security Token',    displayName: 'Security Token',    zone: 'networkCore',  x: 730, y: 100, next: [11] },
  { id: 11, type: 'question', name: 'BGP Check',         displayName: 'BGP Check',         zone: 'networkCore',  x: 755, y: 175, next: [12] },

  // ─── CATWALK BRIDGE: Network Core → Security Ops ──────────────────────────
  { id: 12, type: 'badluck',  name: 'Packet Storm',      displayName: 'Packet Storm',      zone: 'bridge',       x: 760, y: 295, next: [13] },

  // ─── SECURITY OPS CENTER (bottom-right, spaces 13-17) ────────────────────
  { id: 13, type: 'coin',     name: 'Threat Intel',      displayName: 'Threat Intel',      zone: 'secOps',       x: 755, y: 400, next: [14] },
  { id: 14, type: 'shop',     name: 'Patch Vendor',      displayName: 'Patch Vendor',      zone: 'secOps',       x: 685, y: 400, next: [15] },
  { id: 15, type: 'question', name: 'IDS Alert',         displayName: 'IDS Alert',         zone: 'secOps',       x: 615, y: 400, next: [16] },
  { id: 16, type: 'fork',     name: 'Threat Junction',   displayName: 'Threat Junction',   zone: 'secOps',       x: 555, y: 400, next: [17, 27] },
  { id: 17, type: 'question', name: 'Config Audit',      displayName: 'Config Audit',      zone: 'secOps',       x: 510, y: 455, next: [18] },

  // ─── CATWALK BRIDGE: Security Ops → Cooling/Power ────────────────────────
  { id: 18, type: 'event',    name: 'Red Alert',         displayName: 'Red Alert',         zone: 'bridge',       x: 430, y: 475, next: [19] },

  // ─── COOLING / POWER ZONE (bottom-left, spaces 19-23) ────────────────────
  { id: 19, type: 'coin',     name: 'Uptime Credits',    displayName: 'Uptime Credits',    zone: 'coolingPower', x: 320, y: 475, next: [20] },
  { id: 20, type: 'badluck',  name: 'Grid Failure',      displayName: 'Grid Failure',      zone: 'coolingPower', x: 250, y: 475, next: [21] },
  { id: 21, type: 'minigame', name: 'Pentest Challenge', displayName: 'Pentest Challenge', zone: 'coolingPower', x: 185, y: 475, next: [22] },
  { id: 22, type: 'coin',     name: 'Power Recovery',    displayName: 'Power Recovery',    zone: 'coolingPower', x: 130, y: 420, next: [23] },
  { id: 23, type: 'question', name: 'Protocol Test',     displayName: 'Protocol Test',     zone: 'coolingPower', x: 130, y: 295, next: [0] },

  // ─── BACKBONE SHORTCUT 1 (fork@4 → backbone → rejoins at 15) ─────────────
  { id: 24, type: 'question', name: 'Backbone Node A',   displayName: 'Backbone Node A',   zone: 'backbone',     x: 430, y: 185, next: [25] },
  { id: 25, type: 'star',     name: 'Uptime Trophy',     displayName: 'Uptime Trophy',     zone: 'backbone',     x: 430, y: 295, next: [26] },
  { id: 26, type: 'badluck',  name: 'Ransomware Alert',  displayName: 'Ransomware Alert',  zone: 'backbone',     x: 530, y: 390, next: [15] },

  // ─── BACKBONE SHORTCUT 2 (fork@16 → backbone → rejoins at 22) ────────────
  { id: 27, type: 'coin',     name: 'Backbone Node B',   displayName: 'Backbone Node B',   zone: 'backbone',     x: 470, y: 335, next: [28] },
  { id: 28, type: 'coin',     name: 'Fiber Route',       displayName: 'Fiber Route',       zone: 'backbone',     x: 380, y: 335, next: [29] },
  { id: 29, type: 'question', name: 'Core Exam',         displayName: 'Core Exam',         zone: 'backbone',     x: 290, y: 360, next: [22] },
];

// Zone metadata — used by Board.jsx for platform positioning/sizing
export const ZONES = {
  rackZone:     { label: 'Server Rack Zone',    cx: 243, cy: 165, w: 310, h: 215, accentColor: '#2979FF' },
  networkCore:  { label: 'Network Core Zone',   cx: 635, cy: 145, w: 310, h: 155, accentColor: '#00E676' },
  secOps:       { label: 'Security Ops Center', cx: 635, cy: 428, w: 315, h: 140, accentColor: '#D500F9' },
  coolingPower: { label: 'Cooling & Power',     cx: 225, cy: 393, w: 285, h: 220, accentColor: '#FF6D00' },
};

export const SPACE_COLORS = {
  start:    '#00E676',
  coin:     '#00C853',
  badluck:  '#FF1744',
  question: '#2979FF',
  star:     '#FFD600',
  shop:     '#D500F9',
  event:    '#FF6D00',
  minigame: '#00BFA5',
  fork:     '#90A4AE',
};

export const SPACE_ICONS = {
  start:    '🏢',
  coin:     '📦',
  badluck:  '☠️',
  question: '🔐',
  star:     '🔑',
  shop:     '🔧',
  event:    '🚨',
  minigame: '⚡',
  fork:     '🔀',
};

export function getNextSpaces(spaceId) {
  return BOARD_SPACES[spaceId]?.next ?? [];
}

export function isForkSpace(spaceId) {
  return BOARD_SPACES[spaceId]?.next.length > 1;
}
