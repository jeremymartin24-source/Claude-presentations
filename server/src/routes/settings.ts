import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// GET /api/settings
router.get('/', (req: Request, res: Response) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json(settings);
});

// PUT /api/settings
router.put('/', requireAdmin, (req: Request, res: Response) => {
  const updates = req.body as Record<string, string>;
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const updateMany = db.transaction((items: Record<string, string>) => {
    for (const [key, value] of Object.entries(items)) {
      stmt.run(key, String(value));
    }
  });
  updateMany(updates);
  res.json({ success: true });
});

export default router;
