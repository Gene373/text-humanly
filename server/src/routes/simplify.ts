import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.ts';
import { prisma } from '../db.ts';
import { logger } from '../logger.ts';
import { requireAuth } from '../middleware/auth.ts';
import { ApiError } from '../middleware/errors.ts';
import { LlmError, simplifyText } from '../services/llm.ts';
import { moderateText } from '../services/moderation.ts';
import { currentDayKey, nextDayStartsAt } from '../utils/day.ts';
import { notifyRequest } from '../services/vk.ts';

export const simplifyRouter = Router();

const bodySchema = z.object({
  text: z.string().min(1, 'Введите текст').max(config.maxTextLength, 'Текст слишком длинный'),
  level: z.enum(['slightly_simpler', 'beginner']),
});

export async function countUsedToday(userId: string): Promise<number> {
  return prisma.request.count({
    where: { userId, requestDay: currentDayKey(), status: { in: ['success', 'rejected_content'] } },
  });
}

export function buildUsage(used: number) {
  return {
    limit: config.dailyLimit,
    used,
    remaining: Math.max(config.dailyLimit - used, 0),
    resetsAt: nextDayStartsAt().toISOString(),
  };
}

simplifyRouter.get('/usage', requireAuth, async (req, res, next) => {
  try {
    const used = await countUsedToday(req.user!.id);
    res.json(buildUsage(used));
  } catch (error) {
    next(error);
  }
});

simplifyRouter.post('/simplify', requireAuth, async (req, res, next) => {
  const userId = req.user!.id;

  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const isTooLong = issue?.code === 'too_big';
      throw new ApiError(
        isTooLong ? 413 : 400,
        isTooLong ? 'text_too_long' : 'invalid_input',
        issue?.message ?? 'Некорректный запрос.',
      );
    }

    const { text, level } = parsed.data;

    const used = await countUsedToday(userId);
    if (used >= config.dailyLimit) {
      throw new ApiError(
        403,
        'limit_exhausted',
        `Лимит на сегодня исчерпан: ${config.dailyLimit} из ${config.dailyLimit}. Новые попытки появятся завтра.`,
        buildUsage(used),
      );
    }

    const moderation = moderateText(text);
    if (!moderation.allowed) {
      await prisma.request.create({
        data: {
          userId,
          inputText: text,
          level,
          status: 'rejected_content',
          requestDay: currentDayKey(),
        },
      });

      logger.warn({ userId, reason: moderation.reason }, 'контент отклонён');

      throw new ApiError(
        422,
        'content_rejected',
        'К сожалению, этот текст не может быть обработан. Попробуйте другой фрагмент.',
      );
    }

    const outcome = await simplifyText(text, level);

    const saved = await prisma.request.create({
      data: {
        userId,
        inputText: text,
        level,
        resultText: outcome.text,
        status: 'success',
        requestDay: currentDayKey(),
      },
    });

    const usedAfter = used + 1;

    // Сохраняем реальный расход токенов по запросу.
    await prisma.requestToken.create({
      data: {
        userId,
        requestId: saved.id,
        inputTokens: outcome.usage.inputTokens,
        outputTokens: outcome.usage.outputTokens,
        totalTokens: outcome.usage.totalTokens,
      },
    });

    // Уведомление в VK не должно задерживать ответ пользователю.
    void notifyRequest(userId, { totalTokens: outcome.usage.totalTokens });

    res.json({
      id: saved.id,
      resultText: outcome.text,
      status: 'success',
      engine: outcome.engine,
      warnings: outcome.warnings,
      usage: buildUsage(usedAfter),
      tokensUsed: outcome.usage.totalTokens,
    });
  } catch (error) {
    if (error instanceof LlmError) {
      if (error.code === 'not_russian') {
        next(
          new ApiError(
            422,
            'not_russian',
            'Сервис работает только с русским языком. Проверьте текст.',
          ),
        );
        return;
      }
      next(new ApiError(502, 'llm_unavailable', 'Сервис обработки недоступен. Попробуйте ещё раз.'));
      return;
    }
    next(error);
  }
});
