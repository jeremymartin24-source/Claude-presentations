// Random event cards for Event spaces on the board

export const EVENTS = [
  {
    id: 'techSurge',
    name: 'Tech Surge! 🚀',
    description: 'An IT project bonus hits! All players gain 2 coins.',
    effect: { type: 'allGainCoins', amount: 2 },
    color: '#2ECC71',
  },
  {
    id: 'systemCrash',
    name: 'System Crash! 💥',
    description: 'A production outage strikes! Current player loses 5 coins.',
    effect: { type: 'currentLoseCoins', amount: 5 },
    color: '#E74C3C',
  },
  {
    id: 'luckyPacket',
    name: 'Lucky Packet! 📦',
    description: 'A mysterious data packet delivers riches! Current player gains 7 coins.',
    effect: { type: 'currentGainCoins', amount: 7 },
    color: '#F39C12',
  },
  {
    id: 'ransomware',
    name: 'Ransomware Attack! 🦠',
    description: 'Someone clicked a phishing link! The richest player loses 3 coins to the poorest.',
    effect: { type: 'stealFromRichest', amount: 3 },
    color: '#8E44AD',
  },
  {
    id: 'pityUpdate',
    name: 'Mandatory Update 🔄',
    description: 'Everyone donates 2 coins to the player in last place. That\'s team spirit!',
    effect: { type: 'allGiveToLast', amount: 2 },
    color: '#3498DB',
  },
  {
    id: 'dataRecovery',
    name: 'Data Recovery! 💾',
    description: 'Backup saved the day! The last-place player gains 5 coins.',
    effect: { type: 'giveToLast', amount: 5 },
    color: '#1ABC9C',
  },
  {
    id: 'bugBounty',
    name: 'Bug Bounty! 🐛',
    description: 'You found a critical vulnerability! All players gain 3 coins.',
    effect: { type: 'allGainCoins', amount: 3 },
    color: '#27AE60',
  },
  {
    id: 'cryptoMine',
    name: 'Crypto Mining ⛏️',
    description: 'Someone is mining crypto on the school servers! Current player gains 4 coins (shh).',
    effect: { type: 'currentGainCoins', amount: 4 },
    color: '#F1C40F',
  },
];

export function pickRandomEvent() {
  return EVENTS[Math.floor(Math.random() * EVENTS.length)];
}
