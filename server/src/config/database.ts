import Database, { Database as DatabaseType } from 'better-sqlite3';
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
export const db: DatabaseType = new Database(resolvedDbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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
