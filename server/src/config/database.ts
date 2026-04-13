import { Database } from 'node-sqlite3-wasm';
import path from 'path';
import fs from 'fs';
import { DB_PATH } from './env';
import { createTables } from '../db/schema';
import { seedDatabase } from '../db/seed';
import { logger } from '../utils/logger';

// Resolve the DB path relative to the project root (two levels up from src/config)
const resolvedDbPath = path.resolve(__dirname, '../../', DB_PATH);

// Ensure the data directory exists
const dataDir = path.dirname(resolvedDbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  logger.info(`Created data directory: ${dataDir}`);
}

// Create/open the SQLite database
export const db = new Database(resolvedDbPath);

// node-sqlite3-wasm has no .pragma() — use exec() instead
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// node-sqlite3-wasm has no .transaction() — add a compatible shim
(db as any).transaction = function (fn: (...args: any[]) => any) {
  return function (...args: any[]) {
    (db as any).exec('BEGIN');
    try {
      const result = fn(...args);
      (db as any).exec('COMMIT');
      return result;
    } catch (err) {
      (db as any).exec('ROLLBACK');
      throw err;
    }
  };
};

// node-sqlite3-wasm's stmt.run/get/all() take a single value argument,
// but better-sqlite3 uses spread args: stmt.run(a, b, c).
// Patch prepare() so all statements accept the better-sqlite3 calling convention.
const _origPrepare = db.prepare.bind(db);
(db as any).prepare = function (sql: string) {
  const stmt = _origPrepare(sql);
  function normalizeArgs(args: any[]) {
    if (args.length === 0) return undefined;
    if (args.length === 1) return args[0]; // single value or object — pass as-is
    return args; // multiple positional → array
  }
  const origRun = stmt.run.bind(stmt);
  const origGet = stmt.get.bind(stmt);
  const origAll = stmt.all.bind(stmt);
  (stmt as any).run = (...args: any[]) => origRun(normalizeArgs(args));
  (stmt as any).get = (...args: any[]) => origGet(normalizeArgs(args));
  (stmt as any).all = (...args: any[]) => origAll(normalizeArgs(args));
  return stmt;
};

logger.info(`Database opened at: ${resolvedDbPath}`);

/**
 * Initialize the database by creating all tables and seeding initial data.
 * Safe to call multiple times — uses IF NOT EXISTS.
 */
export function initializeDatabase(): void {
  try {
    createTables(db);
    logger.info('Database schema created/verified.');

    seedDatabase(db);
    logger.info('Database seed check complete.');
  } catch (err) {
    logger.error(`Database initialization failed: ${(err as Error).message}`);
    throw err;
  }
}

export default db;
