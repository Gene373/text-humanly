import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../db.ts';
import { hashToken } from '../utils/tokens.ts';

export const SESSION_COOKIE = 'tph_session';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token: string | undefined = req.cookies?.[SESSION_COOKIE];
  if (!token) return next();

  try {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (session && session.expiresAt > new Date()) {
      req.user = { id: session.user.id, email: session.user.email };
    }
  } catch {
    // Тихо игнорируем — запрос продолжится как неавторизованный.
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'unauthorized', message: 'Нужно войти в аккаунт.' });
    return;
  }
  next();
}
