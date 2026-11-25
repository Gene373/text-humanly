import { config, isVkConfigured } from '../config.ts';
import { logger } from '../logger.ts';
import { prisma } from '../db.ts';

/**
 * Бот сообщества ВКонтакте на Bots Long Poll API.
 *
 * Документация: https://dev.vk.com/ru/api/bots/getting-started
 *  - параметры сервера: groups.getLongPollServer
 *  - опрос событий:    {server}?act=a_check&key=…&ts=…&wait=25
 *  - отправка:         messages.send
 *
 * Ключ доступа сообщества (VK_ACCESS_TOKEN) — секрет: не логируется и не отдаётся клиенту.
 */

interface LongPollServer {
  server: string;
  key: string;
  ts: string;
}

interface LongPollUpdate {
  type: string;
  object?: {
    message?: {
      id?: number;
      date?: number;
      from_id?: number;
      peer_id?: number;
      text?: string;
      out?: number;
    };
  };
}

interface LongPollResponse {
  ts?: string;
  updates?: LongPollUpdate[];
  failed?: number;
}

let longPoll: LongPollServer | null = null;
let lastTs = '0';
let running = false;
let loopPromise: Promise<void> | null = null;

const MSK = 'Europe/Moscow';

function formatMoscow(date: Date): string {
  return date.toLocaleString('ru-RU', {
    timeZone: MSK,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatTokens(value: number): string {
  return value.toLocaleString('ru-RU');
}

/** Универсальный вызов метода VK API. */
async function callVk<T>(method: string, params: Record<string, string | number>): Promise<T> {
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    access_token: config.vk.accessToken,
    v: config.vk.apiVersion,
  });

  const response = await fetch(`https://api.vk.com/method/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: query,
  });

  const data = (await response.json()) as {
    response?: T;
    error?: { error_code?: number; error_msg?: string };
  };

  if (data.error) {
    // error_msg от VK не содержит токена — можно логировать.
    throw new Error(`VK ${method}: ${data.error.error_msg ?? 'неизвестная ошибка'}`);
  }

  if (data.response === undefined) {
    throw new Error(`VK ${method}: пустой ответ`);
  }

  return data.response;
}

async function fetchLongPollServer(): Promise<LongPollServer> {
  const server = await callVk<LongPollServer>('groups.getLongPollServer', {
    group_id: config.vk.groupId,
  });
  return server;
}

/** Один запрос к Long Poll. Возвращает события и обновляет ts. */
async function checkEvents(): Promise<LongPollUpdate[]> {
  if (!longPoll) {
    longPoll = await fetchLongPollServer();
    lastTs = longPoll.ts;
  }

  const url =
    `${longPoll.server}?act=a_check&key=${encodeURIComponent(longPoll.key)}` +
    `&ts=${encodeURIComponent(lastTs)}&wait=25`;

  const response = await fetch(url);
  const data = (await response.json()) as LongPollResponse;

  if (data.failed) {
    if (data.failed === 1) {
      // История событий устарела — продолжаем с нового ts.
      if (data.ts) lastTs = data.ts;
      return [];
    }

    // 2 — ключ устарел, 3 — потеряна информация о сервере, 4 — неверный токен.
    if (data.failed === 4) {
      throw new Error('VK: неверный ключ доступа сообщества (проверьте VK_ACCESS_TOKEN)');
    }

    longPoll = await fetchLongPollServer();
    lastTs = longPoll.ts;
    return [];
  }

  if (data.ts) lastTs = data.ts;
  return data.updates ?? [];
}

/** Отправляет сообщение от имени сообщества. */
async function sendMessage(peerId: number, message: string): Promise<void> {
  await callVk('messages.send', {
    peer_id: peerId,
    message,
    random_id: Math.floor(Math.random() * 2 ** 31),
  });
}

/** Кто имеет право на команды бота. Пустой список — все. */
function isAdmin(vkUserId: number): boolean {
  if (config.vk.adminIds.length === 0) return true;
  return config.vk.adminIds.includes(vkUserId);
}

/** Последние запросы: кто, когда, сколько токенов. */
async function buildStatsReport(): Promise<string> {
  const notifications = await prisma.vkNotification.findMany({
    take: 10,
    orderBy: { sentAt: 'desc' },
    include: { user: { select: { email: true } } },
  });

  if (notifications.length === 0) {
    return 'Пока нет обработанных запросов.';
  }

  const lines = notifications.map((n, index) => {
    const tokens =
      n.totalTokens > 0 ? `${formatTokens(n.totalTokens)} ток.` : 'локальный режим';
    return `${index + 1}. ${n.user.email}\n   ${formatMoscow(n.sentAt)} · ${tokens}`;
  });

  return `Последние запросы (до 10):\n\n${lines.join('\n\n')}`;
}

async function buildTodayReport(): Promise<string> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const rows = await prisma.vkNotification.findMany({
    where: { sentAt: { gte: start } },
    include: { user: { select: { email: true } } },
  });

  if (rows.length === 0) {
    return 'Сегодня запросов ещё не было.';
  }

  const totalTokens = rows.reduce((sum, row) => sum + row.totalTokens, 0);
  const uniqueUsers = new Set(rows.map((row) => row.userId)).size;

  return (
    `Статистика за сегодня:\n` +
    `• Запросов: ${rows.length}\n` +
    `• Пользователей: ${uniqueUsers}\n` +
    `• Токенов потрачено: ${formatTokens(totalTokens)}`
  );
}

const HELP_TEXT =
  'Команды бота:\n' +
  '/stats — последние 10 запросов\n' +
  '/today — статистика за сегодня\n' +
  '/help — эта справка';

/** Обрабатывает одно входящее сообщение. */
async function handleMessage(message: NonNullable<LongPollUpdate['object']>['message']): Promise<void> {
  if (!message || message.out === 1) return;

  const fromId = message.from_id ?? message.peer_id ?? 0;
  const peerId = message.peer_id ?? fromId;
  const text = (message.text ?? '').trim().toLowerCase();
  if (!fromId || !text) return;

  // Диагностика: видно, что событие дошло до бота. Текст команды короткий и не является секретом.
  logger.info({ fromId, peerId, text: text.slice(0, 50) }, 'VK: входящее сообщение');

  if (!isAdmin(fromId)) {
    logger.warn({ fromId }, 'VK: команда от не-администратора отклонена');
    return;
  }

  try {
    if (text === '/stats' || text === 'статистика') {
      await sendMessage(peerId, await buildStatsReport());
      return;
    }

    if (text === '/today' || text === 'сегодня') {
      await sendMessage(peerId, await buildTodayReport());
      return;
    }

    if (text === '/help' || text === 'помощь' || text === 'начать' || text === 'start') {
      await sendMessage(peerId, HELP_TEXT);
      return;
    }

    await sendMessage(peerId, `Не понял команду.\n\n${HELP_TEXT}`);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'VK: не удалось обработать сообщение',
    );
  }
}

async function loop(): Promise<void> {
  while (running) {
    try {
      const updates = await checkEvents();
      for (const update of updates) {
        if (update.type === 'message_new') {
          await handleMessage(update.object?.message);
        }
      }
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'VK: сбой цикла Long Poll',
      );
      // Пауза перед повтором, чтобы не зациклиться на ошибке.
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

/** Запускает бота, если заданы ключ и ID сообщества. */
export function startVkBot(): void {
  if (!isVkConfigured()) {
    logger.info(
      'VK-бот выключен: задайте VK_ACCESS_TOKEN и VK_GROUP_ID в server/.env',
    );
    return;
  }

  if (running) return;
  running = true;
  logger.info({ groupId: config.vk.groupId }, 'VK-бот запущен (Long Poll)');
  loopPromise = loop();
}

/** Останавливает бота. */
export function stopVkBot(): void {
  running = false;
  loopPromise = null;
  logger.info('VK-бот остановлен');
}

/**
 * Уведомляет о запросе: кто, когда, сколько токенов.
 * Отправляется в VK_NOTIFY_PEER_ID (если задан) и сохраняется в историю.
 */
export async function notifyRequest(
  userId: string,
  usage: { totalTokens: number },
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const now = new Date();
  const totalTokens = usage.totalTokens;

  // История ведётся всегда, даже если бот выключен — она нужна для /stats.
  try {
    await prisma.vkNotification.create({
      data: {
        userId,
        vkUserId: config.vk.notifyPeerId || 0,
        totalTokens,
      },
    });
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'VK: не удалось сохранить уведомление',
    );
  }

  if (!isVkConfigured() || config.vk.notifyPeerId === 0) return;

  const tokensText = totalTokens > 0 ? formatTokens(totalTokens) : '0 (локальный режим)';
  const message =
    `Новый запрос\n` +
    `Пользователь: ${user?.email ?? userId}\n` +
    `Время (МСК): ${formatMoscow(now)}\n` +
    `Потрачено токенов: ${tokensText}`;

  try {
    await sendMessage(config.vk.notifyPeerId, message);
    logger.info({ userId, totalTokens }, 'VK: уведомление отправлено');
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'VK: не удалось отправить уведомление',
    );
  }
}
