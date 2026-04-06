import { Request, Response, NextFunction } from 'express';
import { ADMIN_PASSWORD } from '../config/env';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const provided = req.headers['x-admin-password'] as string | undefined;

  if (!provided) {
    res.status(401).json({ error: 'Missing x-admin-password header', status: 401 });
    return;
  }

  if (provided !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Invalid admin password', status: 401 });
    return;
  }

  next();
}
