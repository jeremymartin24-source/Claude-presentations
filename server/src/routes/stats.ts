import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// GET /api/stats/overview
router.get('/overview', requireAdmin, (req: Request, res: Response) => {
  const totalGames = (db.prepare('SELECT COUNT(*) as count FROM game_sessions WHERE status = ?').get('ended') as any)?.count || 0;
  const totalPlayers = (db.prepare('SELECT COUNT(*) as count FROM players').get() as any)?.count || 0;
  const avgScore = (db.prepare('SELECT AVG(final_score) as avg FROM players').get() as any)?.avg || 0;

  const gameTypeCounts = db.prepare(`
    SELECT game_type, COUNT(*) as count
    FROM game_sessions WHERE status = 'ended'
    GROUP BY game_type ORDER BY count DESC
  `).all();

  const topStudents = db.prepare(`
    SELECT name, MAX(final_score) as best_score, COUNT(*) as games_played
    FROM players GROUP BY name
    ORDER BY best_score DESC LIMIT 10
  `).all();

  res.json({
    totalGames,
    totalPlayers,
    avgScore: Math.round(avgScore),
    gameTypeCounts,
    topStudents,
  });
});

// GET /api/stats/recent
router.get('/recent', requireAdmin, (req: Request, res: Response) => {
  const recent = db.prepare(`
    SELECT gs.*, c.name as course_name, COUNT(p.id) as player_count
    FROM game_sessions gs
    LEFT JOIN courses c ON gs.course_id = c.id
    LEFT JOIN players p ON p.session_id = gs.id
    WHERE gs.status = 'ended'
    GROUP BY gs.id
    ORDER BY gs.ended_at DESC
    LIMIT 10
  `).all();
  res.json(recent);
});

export default router;
