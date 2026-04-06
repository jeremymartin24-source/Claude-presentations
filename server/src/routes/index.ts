import { Router } from 'express';
import coursesRouter from './courses';
import questionsRouter from './questions';
import gamesRouter from './games';
import sessionsRouter from './sessions';
import importRouter from './import';
import settingsRouter from './settings';
import statsRouter from './stats';

const router = Router();

router.use('/courses', coursesRouter);
router.use('/', questionsRouter);
router.use('/games', gamesRouter);
router.use('/sessions', sessionsRouter);
router.use('/import', importRouter);
router.use('/settings', settingsRouter);
router.use('/stats', statsRouter);

export default router;
