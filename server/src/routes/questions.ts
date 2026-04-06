import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// GET /api/banks/:id
router.get('/banks/:id', (req: Request, res: Response) => {
  const bank = db.prepare(`
    SELECT qb.*, COUNT(q.id) as question_count
    FROM question_banks qb
    LEFT JOIN questions q ON q.bank_id = qb.id
    WHERE qb.id = ?
    GROUP BY qb.id
  `).get(req.params.id);
  if (!bank) return res.status(404).json({ error: 'Bank not found' });
  res.json(bank);
});

// PUT /api/banks/:id
router.put('/banks/:id', requireAdmin, (req: Request, res: Response) => {
  const { name, exam_type, difficulty } = req.body;
  db.prepare(
    'UPDATE question_banks SET name = ?, exam_type = ?, difficulty = ? WHERE id = ?'
  ).run(name, exam_type || 'general', difficulty || 'mixed', req.params.id);
  res.json({ success: true });
});

// DELETE /api/banks/:id
router.delete('/banks/:id', requireAdmin, (req: Request, res: Response) => {
  const result = db.prepare('DELETE FROM question_banks WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Bank not found' });
  res.json({ success: true });
});

// GET /api/banks/:id/questions
router.get('/banks/:id/questions', (req: Request, res: Response) => {
  const questions = db.prepare(
    'SELECT * FROM questions WHERE bank_id = ? ORDER BY category, difficulty, id'
  ).all(req.params.id);
  const parsed = questions.map((q: any) => ({
    ...q,
    options: q.options ? JSON.parse(q.options) : null,
  }));
  res.json(parsed);
});

// POST /api/banks/:id/questions
router.post('/banks/:id/questions', requireAdmin, (req: Request, res: Response) => {
  const { type, question, options, answer, hint, points, time_limit, category, difficulty } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'question and answer required' });
  const result = db.prepare(`
    INSERT INTO questions (bank_id, type, question, options, answer, hint, points, time_limit, category, difficulty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id, type || 'mc', question,
    options ? JSON.stringify(options) : null,
    answer, hint || null, points || 100, time_limit || 30,
    category || null, difficulty || 'medium'
  );
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(result.lastInsertRowid) as any;
  res.status(201).json({ ...q, options: q.options ? JSON.parse(q.options) : null });
});

// PUT /api/questions/:id
router.put('/questions/:id', requireAdmin, (req: Request, res: Response) => {
  const { type, question, options, answer, hint, points, time_limit, category, difficulty } = req.body;
  db.prepare(`
    UPDATE questions SET type=?, question=?, options=?, answer=?, hint=?, points=?, time_limit=?, category=?, difficulty=?
    WHERE id=?
  `).run(
    type, question, options ? JSON.stringify(options) : null,
    answer, hint || null, points, time_limit, category || null, difficulty,
    req.params.id
  );
  const q = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id) as any;
  res.json({ ...q, options: q.options ? JSON.parse(q.options) : null });
});

// DELETE /api/questions/:id
router.delete('/questions/:id', requireAdmin, (req: Request, res: Response) => {
  const result = db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Question not found' });
  res.json({ success: true });
});

export default router;
