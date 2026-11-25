import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.ts';
import { logger } from '../logger.ts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: 'not_found', message: 'Метод не найден.' });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
  logger.error({ error }, 'необработанная ошибка');

  res.status(500).json({
    error: 'internal_error',
    message: config.isProduction ? 'Что-то пошло не так. Попробуйте позже.' : message,
  });
}
