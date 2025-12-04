import { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';

export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  next(createError(404, `Route ${req.method} ${req.path} not found`));
}













