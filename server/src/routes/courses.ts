import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// GET /api/courses
router.get('/', (_req: Request, res: Response) => {
  const courses = db.prepare('SELECT * FROM courses ORDER BY name').all();
  res.json(courses);
});

// POST /api/courses
router.post('/', requireAdmin, (req: Request, res: Response) => {
  const { name, subject, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = db.prepare(
    'INSERT INTO courses (name, subject, description) VALUES (?, ?, ?)'
  ).run(name, subject || null, description || null);
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(course);
});

// PUT /api/courses/:id
router.put('/:id', requireAdmin, (req: Request, res: Response) => {
  const { name, subject, description } = req.body;
  db.prepare(
    'UPDATE courses SET name = ?, subject = ?, description = ? WHERE id = ?'
  ).run(name, subject || null, description || null, req.params.id);
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });
  res.json(course);
});

// DELETE /api/courses/:id
router.delete('/:id', requireAdmin, (req: Request, res: Response) => {
  const result = db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Course not found' });
  res.json({ success: true });
});

// GET /api/courses/:id/banks
router.get('/:id/banks', (req: Request, res: Response) => {
  const banks = db.prepare(`
    SELECT qb.*, COUNT(q.id) as question_count
    FROM question_banks qb
    LEFT JOIN questions q ON q.bank_id = qb.id
    WHERE qb.course_id = ?
    GROUP BY qb.id
    ORDER BY qb.exam_type, qb.name
  `).all(req.params.id);
  res.json(banks);
});

// POST /api/courses/:id/banks
router.post('/:id/banks', requireAdmin, (req: Request, res: Response) => {
  const { name, exam_type, difficulty } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const result = db.prepare(
    'INSERT INTO question_banks (course_id, name, exam_type, difficulty) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, name, exam_type || 'general', difficulty || 'mixed');
  const bank = db.prepare('SELECT * FROM question_banks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(bank);
});

export default router;
