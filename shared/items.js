// Items available for purchase and use in the Mario Party game

export const ITEMS = {
  extraRoll: {
    id: 'extraRoll',
    name: 'Extra Roll',
    description: 'Roll a bonus die this turn (add to your movement).',
    emoji: '🎲',
    price: 5,
    effectType: 'onUseBeforeRoll', // must be used before rolling
    effect: { type: 'extraRoll' },
  },
  speedBoots: {
    id: 'speedBoots',
    name: 'Speed Boots',
    description: 'Roll 2 dice and take the higher result.',
    emoji: '👟',
    price: 6,
    effectType: 'onUseBeforeRoll',
    effect: { type: 'doubleRoll', takeBest: true },
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    description: 'Block the next item used against you this round.',
    emoji: '🛡️',
    price: 5,
    effectType: 'passive',
    effect: { type: 'shield' },
  },
  warpPipe: {
    id: 'warpPipe',
    name: 'Warp Pipe',
    description: 'Teleport to any space on the board. (Host picks destination.)',
    emoji: '🟢',
    price: 8,
    effectType: 'onUseBeforeRoll',
    effect: { type: 'warp' },
  },
  thiefsGlove: {
    id: 'thiefsGlove',
    name: "Thief's Glove",
    description: 'Steal 5 coins from another player.',
    emoji: '🧤',
    price: 7,
    effectType: 'onUseBeforeRoll',
    effect: { type: 'steal', amount: 5 },
  },
  coinBag: {
    id: 'coinBag',
    name: 'Coin Bag',
    description: 'Instantly gain 5 coins.',
    emoji: '💰',
    price: 4,
    effectType: 'onUseBeforeRoll',
    effect: { type: 'gainCoins', amount: 5 },
  },
  luckyClover: {
    id: 'luckyClover',
    name: 'Lucky Clover',
    description: 'Your next correct question answer gives double coins.',
    emoji: '🍀',
    price: 6,
    effectType: 'passive',
    effect: { type: 'doubleQuestion' },
  },
  doubleStar: {
    id: 'doubleStar',
    name: 'Double Star',
    description: 'If you land on a Star Space this turn, gain 2 stars (still costs 20 coins each).',
    emoji: '⭐',
    price: 8,
    effectType: 'passive',
    effect: { type: 'doubleStar' },
  },
};

export const ITEMS_ARRAY = Object.values(ITEMS);

// Items available in the shop (random selection of 3 each visit)
export const SHOP_POOL = [
  'extraRoll',
  'speedBoots',
  'shield',
  'warpPipe',
  'thiefsGlove',
  'coinBag',
  'luckyClover',
  'doubleStar',
];
