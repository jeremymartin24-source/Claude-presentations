import Database from 'better-sqlite3';

/**
 * Create a new game session record and return its ID.
 */
export function createSession(
  db: Database.Database,
  gameType: string,
  bankId: number | null,
  courseId: number | null,
  pin: string,
  settings: Record<string, unknown>,
): number {
  const stmt = db.prepare(`
    INSERT INTO game_sessions (game_type, course_id, bank_id, pin, settings, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `);
  const result = stmt.run(gameType, courseId ?? null, bankId ?? null, pin, JSON.stringify(settings));
  return result.lastInsertRowid as number;
}

/**
 * Mark a session as ended by setting ended_at and status.
 */
export function endSession(db: Database.Database, sessionId: number): void {
  db.prepare(`
    UPDATE game_sessions
    SET ended_at = CURRENT_TIMESTAMP, status = 'ended'
    WHERE id = ?
  `).run(sessionId);
}

/**
 * Save a player's final result for a session.
 */
export function savePlayer(
  db: Database.Database,
  sessionId: number,
  name: string,
  team: string | null,
  finalScore: number,
): void {
  db.prepare(`
    INSERT INTO players (session_id, name, team, final_score)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, name, team ?? null, finalScore);
}

/**
 * Record a buzzer event (for Jeopardy / Speed Round etc).
 */
export function saveBuzzerEvent(
  db: Database.Database,
  sessionId: number,
  playerName: string,
  questionId: number | null,
  buzzTime: number,
  wasCorrect: boolean,
): void {
  db.prepare(`
    INSERT INTO buzzer_events (session_id, player_name, question_id, buzz_time, was_correct)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, playerName, questionId ?? null, buzzTime, wasCorrect ? 1 : 0);
}
