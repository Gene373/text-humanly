// Локальный PostgreSQL для разработки без Docker.
//
//   npm run db:start   — инициализирует кластер (если нужно) и запускает сервер
//   npm run db:stop    — останавливает сервер
//   npm run db:status  — проверяет, отвечает ли порт
//
// Использует бинарники из @embedded-postgres (windows-x64 / darwin-arm64 / linux-x64).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(root, '..');
const dataDir = path.join(serverDir, '.pgdata');
const logFile = path.join(serverDir, 'pg.log');

const PORT = Number(process.env.PG_PORT ?? 5433);
const USER = 'app';
const DB_NAME = 'text_app';
const IS_WINDOWS = process.platform === 'win32';

const platformDir = {
  win32: 'windows-x64',
  darwin: 'darwin-arm64',
  linux: 'linux-x64',
}[process.platform];

if (!platformDir) {
  console.error(`[db] платформа ${process.platform} не поддерживается скриптом`);
  process.exit(1);
}

const binDir = path.join(
  serverDir,
  'node_modules',
  '@embedded-postgres',
  platformDir,
  'native',
  'bin',
);

const exe = (name) => path.join(binDir, IS_WINDOWS ? `${name}.exe` : name);

function portOpen() {
  return new Promise((resolve) => {
    const socket = net.connect(PORT, '127.0.0.1');
    socket.on('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function ensureDatabase() {
  const result = spawnSync(
    exe('createdb'),
    ['-h', '127.0.0.1', '-p', String(PORT), '-U', USER, DB_NAME],
    { stdio: 'pipe', encoding: 'utf8' },
  );

  if (result.status === 0) {
    console.log(`[db] база ${DB_NAME} создана`);
  } else if (/already exists/i.test(result.stderr ?? '')) {
    console.log(`[db] база ${DB_NAME} уже существует`);
  }
}

async function start() {
  if (!existsSync(exe('pg_ctl'))) {
    console.error('[db] не найден pg_ctl. Выполните npm install.');
    process.exit(1);
  }

  if (await portOpen()) {
    console.log(`[db] уже запущена на localhost:${PORT}`);
    return;
  }

  if (!existsSync(path.join(dataDir, 'PG_VERSION'))) {
    mkdirSync(dataDir, { recursive: true });
    console.log('[db] инициализация кластера…');
    const init = spawnSync(
      exe('initdb'),
      ['-D', dataDir, '-U', USER, '--auth=trust', '--encoding=UTF8', '--locale=C'],
      { stdio: 'inherit' },
    );
    if (init.status !== 0) {
      console.error('[db] initdb завершился с ошибкой');
      process.exit(1);
    }
  }

  const child = spawn(
    exe('pg_ctl'),
    ['-D', dataDir, '-l', logFile, '-o', `-p ${PORT}`, 'start'],
    { detached: true, stdio: 'ignore' },
  );
  child.unref();

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (await portOpen()) {
      console.log(`[db] запущена на localhost:${PORT} (логи: ${logFile})`);
      ensureDatabase();
      return;
    }
  }

  console.error('[db] не удалось дождаться запуска, смотрите pg.log');
  process.exit(1);
}

function stop() {
  const result = spawnSync(exe('pg_ctl'), ['-D', dataDir, 'stop', '-m', 'fast'], {
    stdio: 'inherit',
  });
  if (result.status === 0) console.log('[db] остановлена');
}

const command = process.argv[2] ?? 'start';

if (command === 'start') {
  await start();
} else if (command === 'stop') {
  stop();
} else if (command === 'status') {
  console.log((await portOpen()) ? `[db] работает на localhost:${PORT}` : '[db] не запущена');
} else {
  console.error(`[db] неизвестная команда: ${command}`);
  process.exit(1);
}
