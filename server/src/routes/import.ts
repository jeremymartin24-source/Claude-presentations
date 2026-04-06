import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db } from '../config/database';
import { requireAdmin } from '../middleware/auth';
import { parseCSV } from '../services/csvService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/import/template
router.get('/template', (_req: Request, res: Response) => {
  const csv = `type,question,option_a,option_b,option_c,option_d,answer,hint,points,time_limit,category,difficulty
mc,What does CPU stand for?,Central Processing Unit,Central Power Unit,Computer Processing Unit,Central Program Unit,Central Processing Unit,,100,30,Hardware,easy
tf,RAM is volatile memory (loses data when power is off),True,False,,,True,,100,20,Hardware,easy
short,What is the full form of DNS?,,,,,Domain Name System,,100,30,Networking,medium
order,"Put these in order (use | to separate)",First|Second|Third|Fourth,,,,,,,30,General,medium
bingo_term,The layer of the OSI model responsible for routing between networks,,,,,Network Layer,,100,30,Networking,medium`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="questions-template.csv"');
  res.send(csv);
});

// POST /api/import/csv
router.post('/csv', requireAdmin, upload.single('file'), async (req: Request, res: Response) => {
  const bankId = req.body.bank_id;
  if (!bankId) return res.status(400).json({ error: 'bank_id required' });
  if (!req.file) return res.status(400).json({ error: 'file required' });

  const csvContent = req.file.buffer.toString('utf-8');
  const { valid, errors } = parseCSV(csvContent);

  if (valid.length === 0) {
    return res.status(400).json({ error: 'No valid questions found', errors });
  }

  const stmt = db.prepare(`
    INSERT INTO questions (bank_id, type, question, options, answer, hint, points, time_limit, category, difficulty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((qs: any[]) => {
    for (const q of qs) {
      stmt.run(bankId, q.type, q.question,
        q.options ? JSON.stringify(q.options) : null,
        q.answer, q.hint || null, q.points || 100, q.time_limit || 30,
        q.category || null, q.difficulty || 'medium');
    }
  });
  insertMany(valid);

  res.json({ imported: valid.length, errors });
});

// POST /api/import/json
router.post('/json', requireAdmin, (req: Request, res: Response) => {
  const { bank_id, questions } = req.body;
  if (!bank_id || !Array.isArray(questions)) {
    return res.status(400).json({ error: 'bank_id and questions array required' });
  }

  const stmt = db.prepare(`
    INSERT INTO questions (bank_id, type, question, options, answer, hint, points, time_limit, category, difficulty)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((qs: any[]) => {
    for (const q of qs) {
      stmt.run(bank_id, q.type || 'mc', q.question,
        q.options ? JSON.stringify(q.options) : null,
        q.answer, q.hint || null, q.points || 100, q.time_limit || 30,
        q.category || null, q.difficulty || 'medium');
    }
  });
  insertMany(questions);

  res.json({ imported: questions.length });
});

export default router;
