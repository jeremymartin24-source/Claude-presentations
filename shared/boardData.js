// ── Data Center Board ─────────────────────────────────────────────────────────
// 30 spaces across 4 themed island zones + center backbone shortcuts.
//
// Layout:
//   [SERVER ROOM] ─── top cable bridge ─── [NOC]
//        │  ╲                                ╱  │
//        │   ╲      backbone shortcuts      ╱   │
//        │    ╲                            ╱    │
//   [POWER & COOLING] ─ bottom bridge ─ [STORAGE ARRAY]
//
// Graph topology (next[] arrays):
//   Main loop:  0→1→2→3→4→5→6→7→8→9→10→11→12→13→14→15→16→17→18→19→20→21→22→23→0
//   Fork @4:    4→[5 | 24]   backbone shortcut 1 skips NOC entirely
//   Fork @16:   16→[17 | 27] backbone shortcut 2 skips most of Power
//   Backbone1:  24→25→26→15
//   Backbone2:  27→28→29→22
//
// Internal type identifiers are unchanged — server/gameLogic.js requires NO edits.
// displayName and zone fields are visual-only additions.

export const BOARD_SPACES = [
  // ─── SERVER ROOM (top-left island, spaces 0-5) ────────────────────────────
  { id: 0,  type: 'start',    name: 'DC Entrance',       displayName: 'DC Entrance',       zone: 'serverRoom', x: 130, y: 165, next: [1],      isStart: true },
  { id: 1,  type: 'coin',     name: 'Server Budget',     displayName: 'Server Budget',     zone: 'serverRoom', x: 175, y: 105, next: [2] },
  { id: 2,  type: 'question', name: 'System Audit',      displayName: 'System Audit',      zone: 'serverRoom', x: 245, y: 105, next: [3] },
  { id: 3,  type: 'badluck',  name: 'System Failure',    displayName: 'System Failure',    zone: 'serverRoom', x: 315, y: 105, next: [4] },
  { id: 4,  type: 'fork',     name: 'Network Junction',  displayName: 'Network Junction',  zone: 'serverRoom', x: 355, y: 165, next: [5, 24] },
  { id: 5,  type: 'shop',     name: 'Tech Procurement',  displayName: 'Tech Procurement',  zone: 'serverRoom', x: 315, y: 225, next: [6] },

  // ─── TOP CABLE BRIDGE (Server Room → NOC) ────────────────────────────────
  { id: 6,  type: 'coin',     name: 'Cable Route',       displayName: 'Cable Route',       zone: 'bridge',     x: 430, y: 115, next: [7] },

  // ─── NOC (top-right island, spaces 7-11) ─────────────────────────────────
  { id: 7,  type: 'coin',     name: 'NOC Credits',       displayName: 'NOC Credits',       zone: 'noc',        x: 515, y: 100, next: [8] },
  { id: 8,  type: 'event',    name: 'Incident Response', displayName: 'Incident Response', zone: 'noc',        x: 590, y: 100, next: [9] },
  { id: 9,  type: 'question', name: 'Security Quiz',     displayName: 'Security Quiz',     zone: 'noc',        x: 660, y: 100, next: [10] },
  { id: 10, type: 'star',     name: 'SLA Achievement',   displayName: 'SLA Achievement',   zone: 'noc',        x: 730, y: 100, next: [11] },
  { id: 11, type: 'question', name: 'Network Test',      displayName: 'Network Test',      zone: 'noc',        x: 755, y: 175, next: [12] },

  // ─── RIGHT CABLE BRIDGE (NOC → Storage) ──────────────────────────────────
  { id: 12, type: 'badluck',  name: 'DDoS Attack',       displayName: 'DDoS Attack',       zone: 'bridge',     x: 760, y: 295, next: [13] },

  // ─── STORAGE ARRAY (bottom-right island, spaces 13-17) ───────────────────
  { id: 13, type: 'coin',     name: 'Storage Budget',    displayName: 'Storage Budget',    zone: 'storage',    x: 755, y: 400, next: [14] },
  { id: 14, type: 'shop',     name: 'Vendor Portal',     displayName: 'Vendor Portal',     zone: 'storage',    x: 685, y: 400, next: [15] },
  { id: 15, type: 'question', name: 'Config Review',     displayName: 'Config Review',     zone: 'storage',    x: 615, y: 400, next: [16] },
  { id: 16, type: 'fork',     name: 'Routing Table',     displayName: 'Routing Table',     zone: 'storage',    x: 555, y: 400, next: [17, 27] },
  { id: 17, type: 'question', name: 'Disk Audit',        displayName: 'Disk Audit',        zone: 'storage',    x: 510, y: 455, next: [18] },

  // ─── BOTTOM CABLE BRIDGE (Storage → Power) ───────────────────────────────
  { id: 18, type: 'event',    name: 'Critical Alert',    displayName: 'Critical Alert',    zone: 'bridge',     x: 430, y: 475, next: [19] },

  // ─── POWER & COOLING (bottom-left island, spaces 19-23) ──────────────────
  { id: 19, type: 'coin',     name: 'Power Credits',     displayName: 'Power Credits',     zone: 'power',      x: 320, y: 475, next: [20] },
  { id: 20, type: 'badluck',  name: 'Power Outage',      displayName: 'Power Outage',      zone: 'power',      x: 250, y: 475, next: [21] },
  { id: 21, type: 'minigame', name: 'Benchmark Chall.',  displayName: 'Benchmark Chall.',  zone: 'power',      x: 185, y: 475, next: [22] },
  { id: 22, type: 'coin',     name: 'UPS Refund',        displayName: 'UPS Refund',        zone: 'power',      x: 130, y: 420, next: [23] },
  { id: 23, type: 'question', name: 'Safety Exam',       displayName: 'Safety Exam',       zone: 'power',      x: 130, y: 295, next: [0] },

  // ─── BACKBONE SHORTCUT 1 (fork@4 → 24→25→26 → rejoins at space 15) ───────
  { id: 24, type: 'question', name: 'Core Query',        displayName: 'Core Query',        zone: 'backbone',   x: 430, y: 185, next: [25] },
  { id: 25, type: 'star',     name: 'Uptime Trophy',     displayName: 'Uptime Trophy',     zone: 'backbone',   x: 430, y: 295, next: [26] },
  { id: 26, type: 'badluck',  name: 'Data Loss',         displayName: 'Data Loss',         zone: 'backbone',   x: 530, y: 390, next: [15] },

  // ─── BACKBONE SHORTCUT 2 (fork@16 → 27→28→29 → rejoins at space 22) ──────
  { id: 27, type: 'coin',     name: 'Backbone Credits',  displayName: 'Backbone Credits',  zone: 'backbone',   x: 470, y: 335, next: [28] },
  { id: 28, type: 'coin',     name: 'Fiber Bonus',       displayName: 'Fiber Bonus',       zone: 'backbone',   x: 380, y: 335, next: [29] },
  { id: 29, type: 'question', name: 'Protocol Exam',     displayName: 'Protocol Exam',     zone: 'backbone',   x: 290, y: 360, next: [22] },
];

// ── Zone metadata — used by Board.jsx to position/size island platforms ───────
// cx/cy: SVG-space center. w/h: SVG-space bounding box (before SCALE division).
// Board.jsx converts via toWorld(cx, cy) and divides w/h by SCALE.
export const ZONES = {
  serverRoom: { label: 'Server Room',     cx: 243, cy: 165, w: 310, h: 215, accentColor: '#2980B9' },
  noc:        { label: 'NOC',             cx: 635, cy: 145, w: 310, h: 155, accentColor: '#27AE60' },
  storage:    { label: 'Storage Array',   cx: 635, cy: 428, w: 315, h: 140, accentColor: '#8E44AD' },
  power:      { label: 'Power & Cooling', cx: 225, cy: 393, w: 285, h: 220, accentColor: '#E67E22' },
};

export const SPACE_COLORS = {
  start:    '#2ECC71',
  coin:     '#27AE60',
  badluck:  '#E74C3C',
  question: '#2980B9',
  star:     '#F39C12',
  shop:     '#8E44AD',
  event:    '#D35400',
  minigame: '#16A085',
  fork:     '#7F8C8D',
};

export const SPACE_ICONS = {
  start:    '🏢',
  coin:     '💰',
  badluck:  '🔓',
  question: '💻',
  star:     '🏆',
  shop:     '🛒',
  event:    '🚨',
  minigame: '⚙️',
  fork:     '🔀',
};

export function getNextSpaces(spaceId) {
  return BOARD_SPACES[spaceId]?.next ?? [];
}

export function isForkSpace(spaceId) {
  return BOARD_SPACES[spaceId]?.next.length > 1;
}
