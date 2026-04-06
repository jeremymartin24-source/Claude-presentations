import Database from 'better-sqlite3';

export function createTables(db: Database.Database): void {
  // ── Courses ─────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      subject     TEXT,
      description TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Question Banks ───────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS question_banks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id  INTEGER REFERENCES courses(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      exam_type  TEXT CHECK(exam_type IN ('midterm','final','general')) DEFAULT 'general',
      difficulty TEXT CHECK(difficulty IN ('easy','medium','hard','mixed')) DEFAULT 'mixed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Questions ────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_id    INTEGER REFERENCES question_banks(id) ON DELETE CASCADE,
      type       TEXT NOT NULL CHECK(type IN ('mc','tf','short','order','bingo_term')),
      question   TEXT NOT NULL,
      options    TEXT,
      answer     TEXT NOT NULL,
      hint       TEXT,
      points     INTEGER DEFAULT 100,
      time_limit INTEGER DEFAULT 30,
      category   TEXT,
      difficulty TEXT CHECK(difficulty IN ('easy','medium','hard')) DEFAULT 'medium'
    );
  `);

  // ── Game Sessions ────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS game_sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      game_type  TEXT NOT NULL,
      course_id  INTEGER,
      bank_id    INTEGER,
      pin        TEXT UNIQUE,
      settings   TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at   DATETIME,
      status     TEXT DEFAULT 'active'
    );
  `);

  // ── Players ──────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  INTEGER REFERENCES game_sessions(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      team        TEXT,
      final_score INTEGER DEFAULT 0,
      joined_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Buzzer Events ────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS buzzer_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  INTEGER,
      player_name TEXT,
      question_id INTEGER,
      buzz_time   INTEGER,
      was_correct INTEGER DEFAULT 0
    );
  `);

  // ── Settings ─────────────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Insert default settings (only if they don't already exist)
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);

  const defaults: Array<[string, string]> = [
    ['admin_password',       'unoh-admin-2024'],
    ['default_course_id',    '1'],
    ['sounds_enabled',       'true'],
    ['animations_enabled',   'true'],
    ['professor_name',       'Professor Martin'],
    ['university_name',      'University of Northwestern Ohio'],
    ['university_short',     'UNOH'],
  ];

  const insertMany = db.transaction((pairs: Array<[string, string]>) => {
    for (const [key, value] of pairs) {
      insertSetting.run(key, value);
    }
  });

  insertMany(defaults);
}
