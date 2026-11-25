import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import * as tls from 'node:tls';
import { config, isGigaChatConfigured } from '../config.ts';
import { logger } from '../logger.ts';

/**
 * Клиент GigaChat API.
 *
 * Документация: https://developers.sber.ru/docs/ru/gigachat/api/reference/rest/gigachat-api
 *  - токен: POST {oauthUrl} (form-urlencoded, Basic <ключ авторизации>, заголовок RqUID)
 *  - запросы: POST {baseUrl}/chat/completions с Authorization: Bearer <токен>
 *  - токен живёт 30 минут
 *
 * Секреты (ключ авторизации, access_token) никогда не попадают в логи.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class GigaChatError extends Error {
  constructor(
    message: string,
    readonly code: 'not_configured' | 'auth' | 'upstream' | 'timeout',
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GigaChatError';
  }
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;
let pendingToken: Promise<CachedToken> | null = null;
let caInstalled = false;

/** Убирает префикс «Basic », если пользователь скопировал заголовок целиком. */
function normalizeAuthKey(raw: string): string {
  return raw.replace(/^basic\s+/i, '').trim();
}

/**
 * Путь к сертификату НУЦ Минцифры.
 * Приоритет: GIGACHAT_CA_CERT_PATH → server/certs/russian_trusted_root_ca_pem.crt.
 */
function resolveCaCertPath(): string | null {
  if (config.gigachat.caCertPath) return config.gigachat.caCertPath;

  // server/certs/... — путь считается от каталога этого модуля (src/services).
  const bundled = join(import.meta.dirname, '..', '..', 'certs', 'russian_trusted_root_ca_pem.crt');
  return existsSync(bundled) ? bundled : null;
}

/**
 * Подключает корневой сертификат НУЦ Минцифры к доверенным.
 * Без него api.giga.chat отдаёт ошибку валидации цепочки
 * (UNABLE_TO_GET_ISSUER_CERT_LOCALLY).
 */
function ensureCaCertificate(): void {
  if (caInstalled) return;
  caInstalled = true;

  const path = resolveCaCertPath();
  if (!path) return;

  try {
    const certificate = readFileSync(path, 'utf8');

    // Node 22.19+/24+: добавляем сертификат в доверенные на лету.
    if (typeof tls.getCACertificates === 'function' && typeof tls.setDefaultCACertificates === 'function') {
      tls.setDefaultCACertificates([...tls.getCACertificates('default'), certificate]);
      logger.info('GigaChat: корневой сертификат НУЦ Минцифры подключён');
      return;
    }

    logger.warn(
      'GigaChat: версия Node не поддерживает добавление сертификата на лету. ' +
        'Установите NODE_EXTRA_CA_CERTS=путь/к/russian_trusted_root_ca_pem.crt',
    );
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'GigaChat: не удалось загрузить корневой сертификат НУЦ Минцифры',
    );
  }
}

function describeFailure(status: number): string {
  switch (status) {
    case 400:
      return 'некорректный запрос к GigaChat';
    case 401:
      return 'GigaChat отклонил токен доступа';
    case 402:
      return 'закончились токены на тарифе GigaChat';
    case 403:
      return 'нет доступа к модели GigaChat (проверьте scope)';
    case 404:
      return `модель «${config.gigachat.model}» не найдена — проверьте GIGACHAT_MODEL`;
    case 413:
      return 'слишком большой запрос для GigaChat';
    case 422:
      return 'GigaChat не смог обработать запрос';
    case 429:
      return 'превышен лимит запросов к GigaChat';
    default:
      return `GigaChat ответил кодом ${status}`;
  }
}

async function fetchAccessToken(): Promise<CachedToken> {
  ensureCaCertificate();

  const authKey = normalizeAuthKey(config.gigachat.authKey);
  const body = new URLSearchParams({ scope: config.gigachat.scope });

  const response = await fetch(config.gigachat.oauthUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      RqUID: randomUUID(),
      Authorization: `Basic ${authKey}`,
      'User-Agent': config.gigachat.userAgent,
    },
    body,
  });

  if (!response.ok) {
    // Тело ответа может содержать диагностику, но не секреты — логируем только код.
    logger.error({ status: response.status }, 'GigaChat: не удалось получить токен доступа');
    const reason =
      response.status === 400 || response.status === 401
        ? 'GigaChat отклонил ключ авторизации (проверьте GIGACHAT_AUTH_KEY и GIGACHAT_SCOPE)'
        : describeFailure(response.status);
    throw new GigaChatError(reason, 'auth', response.status);
  }

  const data = (await response.json()) as { access_token?: string; expires_at?: number };
  if (!data.access_token) {
    throw new GigaChatError('GigaChat не вернул токен доступа', 'auth');
  }

  // expires_at приходит числом, но в разных версиях API — в секундах или миллисекундах.
  // Значения больше 1e12 — это уже миллисекунды (2023 год в мс ≈ 1.7e12).
  let expiresAt = Date.now() + 25 * 60_000;
  if (typeof data.expires_at === 'number' && Number.isFinite(data.expires_at)) {
    const raw = data.expires_at > 1e12 ? data.expires_at : data.expires_at * 1000;
    // Обновляем заранее, с запасом 60 секунд.
    expiresAt = raw - 60_000;
  }

  logger.info(
    { scope: config.gigachat.scope, expiresInSeconds: Math.round((expiresAt - Date.now()) / 1000) },
    'GigaChat: получен новый токен доступа',
  );

  return { value: data.access_token, expiresAt };
}

/** Возвращает действующий токен: из кеша или новый. Параллельные запросы ждут один запрос. */
async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  if (!pendingToken) {
    pendingToken = fetchAccessToken()
      .then((token) => {
        cachedToken = token;
        return token;
      })
      .finally(() => {
        pendingToken = null;
      });
  }

  return (await pendingToken).value;
}

/** Сбрасывает кеш токена (например, после ответа 401). */
export function resetGigaChatToken(): void {
  cachedToken = null;
}

interface CompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ChatResult {
  content: string;
  usage: TokenUsage;
}

const EMPTY_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

async function postCompletion(
  messages: ChatMessage[],
  token: string,
  temperature: number,
  signal: AbortSignal,
): Promise<Response> {
  ensureCaCertificate();

  return fetch(`${config.gigachat.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': config.gigachat.userAgent,
    },
    body: JSON.stringify({
      model: config.gigachat.model,
      temperature,
      messages,
    }),
    signal,
  });
}

/**
 * Отправляет запрос в GigaChat и возвращает текст ответа вместе с расходом токенов.
 * При 401 токен перевыпускается и запрос повторяется один раз.
 */
export async function gigachatChatWithUsage(
  messages: ChatMessage[],
  temperature = 0.2,
): Promise<ChatResult> {
  if (!isGigaChatConfigured()) {
    throw new GigaChatError('GIGACHAT_AUTH_KEY не задан', 'not_configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.gigachat.timeoutMs);

  try {
    let token = await getAccessToken();
    let response = await postCompletion(messages, token, temperature, controller.signal);

    if (response.status === 401) {
      logger.warn('GigaChat: токен отклонён, перевыпускаем');
      resetGigaChatToken();
      token = await getAccessToken(true);
      response = await postCompletion(messages, token, temperature, controller.signal);
    }

    if (!response.ok) {
      logger.error(
        { status: response.status, model: config.gigachat.model },
        'GigaChat: ошибка запроса',
      );
      throw new GigaChatError(describeFailure(response.status), 'upstream', response.status);
    }

    const data = (await response.json()) as CompletionResponse;
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new GigaChatError('GigaChat вернул пустой ответ', 'upstream');

    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    const totalTokens = data.usage?.total_tokens ?? inputTokens + outputTokens;

    return { content, usage: { inputTokens, outputTokens, totalTokens } };
  } catch (error) {
    if (error instanceof GigaChatError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new GigaChatError('GigaChat не ответил вовремя', 'timeout');
    }
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      'GigaChat: сбой сетевого запроса',
    );
    throw new GigaChatError('Сбой запроса к GigaChat', 'upstream');
  } finally {
    clearTimeout(timer);
  }
}

/** Совместимая обёртка: только текст ответа. */
export async function gigachatChat(messages: ChatMessage[], temperature = 0.2): Promise<string> {
  const result = await gigachatChatWithUsage(messages, temperature);
  return result.content;
}

export { EMPTY_USAGE };
