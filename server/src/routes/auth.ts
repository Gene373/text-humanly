import { Router } from 'express';
import { z } from 'zod';
import { config, isMailerConfigured } from '../config.ts';
import { prisma } from '../db.ts';
import { logger } from '../logger.ts';
import { ApiError } from '../middleware/errors.ts';
import { SESSION_COOKIE } from '../middleware/auth.ts';
import { sendMagicLink } from '../services/mailer.ts';
import { generateToken, hashToken } from '../utils/tokens.ts';

export const authRouter = Router();

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email('Введите корректный email'),
});

const RATE_WINDOW_MS = 60_000;
const lastRequestByEmail = new Map<string, number>();

authRouter.post('/request-login', async (req, res, next) => {
  try {
    const parsed = emailSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'invalid_email', 'Введите корректный email.');
    }
    const { email } = parsed.data;

    const now = Date.now();
    const last = lastRequestByEmail.get(email) ?? 0;
    if (now - last < RATE_WINDOW_MS) {
      throw new ApiError(
        429,
        'too_many_requests',
        'Ссылку уже отправили. Подождите минуту перед повторной попыткой.',
      );
    }
    lastRequestByEmail.set(email, now);

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    const token = generateToken();
    const expiresAt = new Date(now + config.magicLinkTtlMinutes * 60_000);

    await prisma.loginToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
    });

    // Базовый адрес: APP_URL из окружения, иначе — из самого запроса.
    const baseUrl = (config.appUrl || `${req.protocol}://${req.get('host') ?? 'localhost'}`).replace(
      /\/$/,
      '',
    );
    const link = `${baseUrl}/auth/verify?token=${encodeURIComponent(token)}`;
    await sendMagicLink(email, link);

    logger.info({ email, mailer: isMailerConfigured() }, 'запрошен вход по ссылке');

    res.json({
      ok: true,
      message: 'Проверьте почту — мы отправили ссылку для входа.',
      // В dev без SMTP возвращаем ссылку, чтобы можно было войти локально.
      // В production это делает только явный флаг DEV_LOGIN_LINK (демо-стенд).
      ...(!isMailerConfigured() && (!config.isProduction || config.devLoginLink)
        ? { devLoginUrl: link }
        : {}),
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/verify', async (req, res, next) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) throw new ApiError(400, 'missing_token', 'Ссылка недействительна.');

    const record = await prisma.loginToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new ApiError(400, 'invalid_token', 'Ссылка устарела или уже использована.');
    }

    await prisma.loginToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    const sessionToken = generateToken();
    const sessionExpiresAt = new Date(
      Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000,
    );

    await prisma.session.create({
      data: {
        userId: record.userId,
        tokenHash: hashToken(sessionToken),
        expiresAt: sessionExpiresAt,
      },
    });

    res.cookie(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
      expires: sessionExpiresAt,
      path: '/',
    });

    res.json({ ok: true, user: { id: record.user.id, email: record.user.email } });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ?? null });
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const token: string | undefined = req.cookies?.[SESSION_COOKIE];
    if (token) {
      await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
