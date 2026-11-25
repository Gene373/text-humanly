import 'node:process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Подхватываем server/.env (если файл есть).
 * Уже заданные переменные окружения имеют приоритет — так docker compose
 * и CI могут переопределять значения из файла.
 * Значения из .env никогда не логируются.
 */
function loadEnvFile(): void {
  const candidate = join(import.meta.dirname, '..', '.env');
  if (!existsSync(candidate)) return;

  try {
    process.loadEnvFile(candidate);
  } catch {
    // Некорректный .env не должен ломать запуск: работаем на значениях по умолчанию.
  }
}

loadEnvFile();

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function str(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

export type LlmProvider = 'auto' | 'gigachat' | 'openai' | 'local';

function readProvider(): LlmProvider {
  const raw = (process.env.LLM_PROVIDER ?? 'auto').trim().toLowerCase();
  return raw === 'gigachat' || raw === 'openai' || raw === 'local' ? raw : 'auto';
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: num('PORT', 4000),
  appUrl: process.env.APP_URL ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://app:app@localhost:5433/text_app',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev_secret_change_me_in_production',
  sessionTtlDays: num('SESSION_TTL_DAYS', 7),
  magicLinkTtlMinutes: num('MAGIC_LINK_TTL_MINUTES', 15),
  dailyLimit: num('DAILY_LIMIT', 3),
  maxTextLength: num('MAX_TEXT_LENGTH', 10000),
  llm: {
    provider: readProvider(),
    apiKey: process.env.LLM_API_KEY?.trim() ?? '',
    baseUrl: (process.env.LLM_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, ''),
    model: process.env.LLM_MODEL ?? 'gpt-4o-mini',
    timeoutMs: num('LLM_TIMEOUT_MS', 60000),
  },
  // GigaChat API: https://developers.sber.ru/docs/ru/gigachat/api/reference/rest/gigachat-api
  gigachat: {
    // Ключ авторизации из личного кабинета (Client ID + Client Secret в base64).
    // Пустое значение = GigaChat не используется.
    authKey: process.env.GIGACHAT_AUTH_KEY?.trim() ?? '',
    // GIGACHAT_API_PERS | GIGACHAT_API_B2B | GIGACHAT_API_CORP
    scope: str('GIGACHAT_SCOPE', 'GIGACHAT_API_PERS'),
    // Доступные модели: GigaChat-2, GigaChat-2-Pro, GigaChat-2-Max,
    // GigaChat-3-Lightning, GigaChat-3-Pro, GigaChat-3-Ultra.
    model: str('GIGACHAT_MODEL', 'GigaChat-2'),
    // С 17.07.2026 целевой адрес — api.giga.chat; старый gigachat.devices.sberbank.ru ещё работает.
    baseUrl: str('GIGACHAT_BASE_URL', 'https://api.giga.chat/v1').replace(/\/+$/, ''),
    oauthUrl: str('GIGACHAT_OAUTH_URL', 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'),
    // Путь к корневому сертификату НУЦ Минцифры (russian_trusted_root_ca_pem.crt).
    // Нужен, если ОС не доверяет цепочке api.giga.chat.
    caCertPath: str('GIGACHAT_CA_CERT_PATH'),
    userAgent: str('GIGACHAT_USER_AGENT', 'text-humanly/1.0'),
    timeoutMs: num('GIGACHAT_TIMEOUT_MS', num('LLM_TIMEOUT_MS', 60000)),
  },
  smtp: {
    host: process.env.SMTP_HOST?.trim() ?? '',
    port: num('SMTP_PORT', 587),
    user: process.env.SMTP_USER?.trim() ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? 'Текст по-человечески <no-reply@example.com>',
  },
  // ВКонтакте: бот сообщества на Bots Long Poll API.
  // Ключ доступа: Управление → Дополнительно → Работа с API → Создать ключ.
  // Документация: https://dev.vk.com/ru/api/bots/getting-started
  vk: {
    // Ключ доступа сообщества (секрет). Пусто = бот выключен.
    accessToken: process.env.VK_ACCESS_TOKEN?.trim() ?? '',
    // Числовой ID сообщества (без минуса).
    groupId: num('VK_GROUP_ID', 0),
    // Куда слать уведомления о запросах. По умолчанию — сам диалог с сообществом (-groupId).
    // Можно указать ID беседы или личного чата администратора.
    notifyPeerId: num('VK_NOTIFY_PEER_ID', 0),
    // Разрешённые VK ID администраторов через запятую (кто может запрашивать /stats). Пусто = все.
    adminIds: str('VK_ADMIN_IDS')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0),
    apiVersion: str('VK_API_VERSION', '5.199'),
    enabled: (process.env.VK_BOT_ENABLED ?? 'true').trim().toLowerCase() !== 'false',
  },
  ocrLang: process.env.OCR_LANG ?? 'rus',
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
} as const;

export type LlmEngine = 'gigachat' | 'openai' | 'local';

export const isGigaChatConfigured = () => config.gigachat.authKey.length > 0;
export const isOpenAiConfigured = () => config.llm.apiKey.length > 0;
export const isVkConfigured = () =>
  config.vk.enabled && config.vk.accessToken.length > 0 && config.vk.groupId > 0;

/**
 * Какой движок реально будет использован.
 * auto: GigaChat (если есть ключ авторизации) → OpenAI-совместимый (если есть ключ) → локальный.
 */
export function resolveEngine(): LlmEngine {
  if (config.llm.provider === 'local') return 'local';
  if (config.llm.provider === 'gigachat') return isGigaChatConfigured() ? 'gigachat' : 'local';
  if (config.llm.provider === 'openai') return isOpenAiConfigured() ? 'openai' : 'local';
  if (isGigaChatConfigured()) return 'gigachat';
  if (isOpenAiConfigured()) return 'openai';
  return 'local';
}

export const isLlmConfigured = () => resolveEngine() !== 'local';
export const isMailerConfigured = () => config.smtp.host.length > 0;
