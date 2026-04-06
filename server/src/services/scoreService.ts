/**
 * Time-based score: max points scaled by how quickly the player answered.
 * Minimum award is 20% of base points (so slow players still get something).
 */
export function calculateTimedScore(
  points: number,
  timeLimit: number,
  responseTimeMs: number,
): number {
  const timeLimitMs = timeLimit * 1000;
  const elapsed = Math.min(responseTimeMs, timeLimitMs);
  const ratio = 1 - elapsed / timeLimitMs;
  // Clamp between 0.2 and 1.0 so there's always a small reward for answering
  const factor = Math.max(0.2, ratio);
  return Math.round(points * factor);
}

/**
 * Apply a streak bonus multiplier.
 *  streak 0–2  → ×1.0
 *  streak 3–4  → ×1.25
 *  streak 5–6  → ×1.5
 *  streak 7+   → ×2.0
 */
export function applyStreakBonus(score: number, streak: number): number {
  let multiplier = 1.0;
  if (streak >= 7) {
    multiplier = 2.0;
  } else if (streak >= 5) {
    multiplier = 1.5;
  } else if (streak >= 3) {
    multiplier = 1.25;
  }
  return Math.round(score * multiplier);
}

/**
 * Confidence wager scoring.
 * wageredPercent: 10–100
 * correct: add wagered% of base points
 * wrong:   subtract wagered% of base points (floor at 0)
 */
export function calculateWager(
  baseScore: number,
  wageredPercent: number,
  correct: boolean,
): number {
  const clampedPercent = Math.max(10, Math.min(100, wageredPercent));
  const wagerAmount = Math.round(baseScore * (clampedPercent / 100));
  if (correct) {
    return baseScore + wagerAmount;
  } else {
    return Math.max(0, baseScore - wagerAmount);
  }
}
