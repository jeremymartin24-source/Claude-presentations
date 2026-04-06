import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// GET /api/sessions
router.get('/', requireAdmin, (req: Request, res: Response) => {
  const sessions = db.prepare(`
    SELECT gs.*, c.name as course_name,
      COUNT(DISTINCT p.id) as player_count,
      MAX(p.final_score) as top_score
    FROM game_sessions gs
    LEFT JOIN courses c ON gs.course_id = c.id
    LEFT JOIN players p ON p.session_id = gs.id
    GROUP BY gs.id
    ORDER BY gs.started_at DESC
    LIMIT 100
  `).all();
  res.json(sessions);
});

// GET /api/sessions/:id
router.get('/:id', requireAdmin, (req: Request, res: Response) => {
  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  const players = db.prepare(
    'SELECT * FROM players WHERE session_id = ? ORDER BY final_score DESC'
  ).all(req.params.id);
  res.json({ ...session as object, players });
});

// GET /api/sessions/:id/export
router.get('/:id/export', requireAdmin, (req: Request, res: Response) => {
  const players = db.prepare(
    'SELECT name, team, final_score, joined_at FROM players WHERE session_id = ? ORDER BY final_score DESC'
  ).all(req.params.id) as any[];

  let csv = 'Rank,Name,Team,Score\n';
  players.forEach((p, i) => {
    csv += `${i + 1},"${p.name}","${p.team || ''}",${p.final_score}\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="session-${req.params.id}.csv"`);
  res.send(csv);
});

export default router;
