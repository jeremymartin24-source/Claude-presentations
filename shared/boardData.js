// 30-space Mario Party board
// Layout: outer ring (24 spaces) + 2 inner shortcut paths (3 spaces each)
// Outer ring goes clockwise: top row → right col → bottom row → left col → back to start
// Fork spaces have multiple entries in `next` array — player chooses direction

export const BOARD_SPACES = [
  // ─── TOP ROW (left → right, y=60) ───
  { id: 0,  type: 'start',    name: 'Start',       x: 80,  y: 60,  next: [1],      isStart: true },
  { id: 1,  type: 'coin',     name: 'Coin +3',      x: 180, y: 60,  next: [2] },
  { id: 2,  type: 'question', name: 'Question',     x: 280, y: 60,  next: [3] },
  { id: 3,  type: 'badluck',  name: 'Bad Luck',     x: 380, y: 60,  next: [4] },
  { id: 4,  type: 'fork',     name: 'Fork',         x: 480, y: 60,  next: [5, 24] },   // ← FORK
  { id: 5,  type: 'coin',     name: 'Coin +3',      x: 580, y: 60,  next: [6] },
  { id: 6,  type: 'shop',     name: 'Shop',         x: 680, y: 60,  next: [7] },
  { id: 7,  type: 'question', name: 'Question',     x: 780, y: 60,  next: [8] },

  // ─── RIGHT COLUMN (top → bottom, x=830) ───
  { id: 8,  type: 'event',    name: 'Event!',       x: 830, y: 150, next: [9] },
  { id: 9,  type: 'coin',     name: 'Coin +3',      x: 830, y: 250, next: [10] },
  { id: 10, type: 'star',     name: 'Star Space',   x: 830, y: 350, next: [11] },
  { id: 11, type: 'question', name: 'Question',     x: 830, y: 450, next: [12] },

  // ─── BOTTOM ROW (right → left, y=530) ───
  { id: 12, type: 'badluck',  name: 'Bad Luck',     x: 780, y: 530, next: [13] },
  { id: 13, type: 'coin',     name: 'Coin +3',      x: 680, y: 530, next: [14] },
  { id: 14, type: 'shop',     name: 'Shop',         x: 580, y: 530, next: [15] },
  { id: 15, type: 'question', name: 'Question',     x: 480, y: 530, next: [16] },
  { id: 16, type: 'event',    name: 'Event!',       x: 380, y: 530, next: [17] },
  { id: 17, type: 'question', name: 'Question',     x: 280, y: 530, next: [18] },
  { id: 18, type: 'badluck',  name: 'Bad Luck',     x: 180, y: 530, next: [19] },
  { id: 19, type: 'fork',     name: 'Fork',         x: 80,  y: 530, next: [20, 27] }, // ← FORK

  // ─── LEFT COLUMN (bottom → top, x=30) ───
  { id: 20, type: 'question', name: 'Question',     x: 30,  y: 450, next: [21] },
  { id: 21, type: 'minigame', name: 'Mini-Game!',   x: 30,  y: 350, next: [22] },
  { id: 22, type: 'coin',     name: 'Coin +3',      x: 30,  y: 250, next: [23] },
  { id: 23, type: 'question', name: 'Question',     x: 30,  y: 150, next: [0] },

  // ─── INNER SHORTCUT 1 (from fork@4, rejoins at 15) ───
  //   cuts straight through center-right area
  { id: 24, type: 'question', name: 'Question',     x: 480, y: 170, next: [25] },
  { id: 25, type: 'star',     name: 'Star Space',   x: 480, y: 300, next: [26] },
  { id: 26, type: 'badluck',  name: 'Bad Luck',     x: 480, y: 420, next: [15] },

  // ─── INNER SHORTCUT 2 (from fork@19, rejoins at 21) ───
  //   cuts across lower-left interior
  { id: 27, type: 'coin',     name: 'Coin +3',      x: 170, y: 470, next: [28] },
  { id: 28, type: 'coin',     name: 'Coin +3',      x: 270, y: 420, next: [29] },
  { id: 29, type: 'question', name: 'Question',     x: 270, y: 340, next: [21] },
];

export const SPACE_COLORS = {
  start:    '#FFD700',
  coin:     '#2ECC71',
  badluck:  '#E74C3C',
  question: '#3498DB',
  star:     '#F1C40F',
  shop:     '#9B59B6',
  event:    '#1ABC9C',
  minigame: '#FF69B4',
  fork:     '#ECF0F1',
};

export const SPACE_ICONS = {
  start:    '🏁',
  coin:     '🪙',
  badluck:  '💀',
  question: '❓',
  star:     '⭐',
  shop:     '🛒',
  event:    '🎴',
  minigame: '🎮',
  fork:     '🍴',
};

// Build adjacency info for path-finding (server uses this for movement)
export function getNextSpaces(spaceId) {
  return BOARD_SPACES[spaceId]?.next ?? [];
}

export function isForkSpace(spaceId) {
  return BOARD_SPACES[spaceId]?.next.length > 1;
}
