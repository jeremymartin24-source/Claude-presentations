export function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateReadablePin(): string {
  const adjectives = ['FAST', 'BOLD', 'COOL', 'EPIC', 'FIRE', 'GOLD', 'NOVA', 'TECH'];
  const numbers = Math.floor(100 + Math.random() * 900).toString();
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  return `${adj}${numbers}`;
}
