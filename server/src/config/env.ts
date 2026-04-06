import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (one level up from src)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const PORT: number = parseInt(process.env.PORT || '3001', 10);
export const ADMIN_PASSWORD: string = process.env.ADMIN_PASSWORD || 'unoh-admin-2024';
export const NODE_ENV: string = process.env.NODE_ENV || 'development';
export const DB_PATH: string = process.env.DB_PATH || './data/unoh_games.db';

export default {
  PORT,
  ADMIN_PASSWORD,
  NODE_ENV,
  DB_PATH,
};
