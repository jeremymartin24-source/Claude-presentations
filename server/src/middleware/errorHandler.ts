import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  status?: number;
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const status = err.status ?? err.statusCode ?? 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`[${req.method}] ${req.path} → ${status}: ${message}`, err);

  res.status(status).json({
    error: message,
    status,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
}
