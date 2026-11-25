/**
 * Проверка настройки VK-бота без вывода секретов.
 *
 * Запуск: npm run check:vk
 *
 * Показывает: задан ли ключ (длина и первые символы), ID сообщества,
 * peer_id для уведомлений, список админов, и делает запрос
 * groups.getLongPollServer для проверки прав.
 */

import { config, isVkConfigured } from '../src/config.ts';

function mask(value: string): string {
  if (!value) return '(пусто)';
  return `задан, ${value.length} символов, начинается с «${value.slice(0, 6)}…»`;
}

async function main() {
  console.log('--- VK-бот: проверка настроек ---');
  console.log('Включён      :', config.vk.enabled);
  console.log('Ключ доступа :', mask(config.vk.accessToken));
  console.log('ID сообщества:', config.vk.groupId || '(не задан)');
  console.log('Peer для увед:', config.vk.notifyPeerId || '(0 — без отправки)');
  console.log('Админы       :', config.vk.adminIds.length ? config.vk.adminIds.join(', ') : '(все)');
  console.log('Версия API   :', config.vk.apiVersion);
  console.log('');

  if (!isVkConfigured()) {
    console.log('❌ Бот не настроен.');
    console.log('   Задайте VK_ACCESS_TOKEN и VK_GROUP_ID в server/.env.');
    process.exitCode = 1;
    return;
  }

  try {
    const params = new URLSearchParams({
      group_id: String(config.vk.groupId),
      access_token: config.vk.accessToken,
      v: config.vk.apiVersion,
    });

    const response = await fetch('https://api.vk.com/method/groups.getLongPollServer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const data = (await response.json()) as {
      response?: { server?: string; ts?: string };
      error?: { error_code?: number; error_msg?: string };
    };

    if (data.error) {
      console.log(`❌ Ошибка VK (код ${data.error.error_code}): ${data.error.error_msg}`);
      console.log('   Проверьте права ключа (messages, groups) и ID сообщества.');
      process.exitCode = 1;
      return;
    }

    if (!data.response?.server) {
      console.log('❌ VK не вернул адрес Long Poll сервера.');
      process.exitCode = 1;
      return;
    }

    console.log('✅ Ключ рабочий, Long Poll сервер доступен.');
    console.log('   Бот будет получать события сообщества при запуске сервера.');
  } catch (error) {
    console.log('❌ Сетевая ошибка:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

void main();
