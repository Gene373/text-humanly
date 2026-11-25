import pino from 'pino';
import { config } from './config.ts';

/**
 * Поля, которые никогда не должны попасть в лог.
 * Ключ авторизации GigaChat и токены доступа не логируются ни при каких условиях.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'authorization',
  'Authorization',
  'apiKey',
  'authKey',
  'access_token',
  'accessToken',
  'password',
  'pass',
  'GIGACHAT_AUTH_KEY',
  'LLM_API_KEY',
  'VK_ACCESS_TOKEN',
];

export const logger = pino({
  level: config.isProduction ? 'info' : 'debug',
  redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  transport: config.isProduction
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
});
