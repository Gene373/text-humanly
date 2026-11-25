import { createApp } from './app.ts';
import { config, isMailerConfigured, resolveEngine, isVkConfigured } from './config.ts';
import { logger } from './logger.ts';
import { prisma } from './db.ts';
import { startVkBot, stopVkBot } from './services/vk.ts';

const app = createApp();

function describeEngine(): string {
  const engine = resolveEngine();
  if (engine === 'gigachat') return `GigaChat (${config.gigachat.model}, ${config.gigachat.scope})`;
  if (engine === 'openai') return `${config.llm.model} @ ${config.llm.baseUrl}`;
  return 'локальный упроститель';
}

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      env: config.nodeEnv,
      llm: describeEngine(),
      mailer: isMailerConfigured() ? 'SMTP' : 'лог в консоль',
      vk: isVkConfigured() ? `группа ${config.vk.groupId}` : 'не настроен',
    },
    'сервер запущен',
  );
});

// Запускаем VK-бота если он настроен
startVkBot();

async function shutdown(signal: string) {
  logger.info({ signal }, 'останавливаем сервер');
  stopVkBot();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
