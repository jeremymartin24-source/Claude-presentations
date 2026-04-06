import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { requireAdmin } from '../middleware/auth';
import { generateReadablePin } from '../utils/pinGenerator';
import { registerPin, removePin } from '../services/pinService';
import QRCode from 'qrcode';
import os from 'os';

const router = Router();

function getLanIP(): string {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const net of iface || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

// POST /api/games/create
router.post('/create', requireAdmin, async (req: Request, res: Response) => {
  const { game_type, bank_id, course_id, settings } = req.body;
  if (!game_type) return res.status(400).json({ error: 'game_type required' });

  const pin = generateReadablePin();
  const sessionResult = db.prepare(`
    INSERT INTO game_sessions (game_type, course_id, bank_id, pin, settings, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(game_type, course_id || null, bank_id || null, pin, JSON.stringify(settings || {}));

  registerPin(pin, {
    sessionId: sessionResult.lastInsertRowid as number,
    gameType: game_type,
    bankId: bank_id,
  });

  // In production use the public Railway URL, otherwise use LAN IP
  const baseUrl = process.env.PUBLIC_URL
    || (process.env.NODE_ENV === 'production'
        ? 'https://claude-presentations-production.up.railway.app'
        : `http://${getLanIP()}:3000`);
  const joinUrl = `${baseUrl}/join?pin=${pin}`;
  const qrDataUrl = await QRCode.toDataURL(joinUrl, {
    color: { dark: '#680001', light: '#ffffff' },
    width: 300,
    margin: 2,
  });

  res.status(201).json({
    pin,
    sessionId: sessionResult.lastInsertRowid,
    joinUrl,
    qrDataUrl,
  });
});

// GET /api/games/:pin
router.get('/:pin', (req: Request, res: Response) => {
  const session = db.prepare(
    'SELECT * FROM game_sessions WHERE pin = ? AND status = ?'
  ).get(req.params.pin, 'active');
  if (!session) return res.status(404).json({ error: 'Game not found or already ended' });
  res.json(session);
});

// DELETE /api/games/:pin
router.delete('/:pin', requireAdmin, (req: Request, res: Response) => {
  db.prepare(
    "UPDATE game_sessions SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE pin = ?"
  ).run(req.params.pin);
  removePin(req.params.pin);
  res.json({ success: true });
});

export default router;
