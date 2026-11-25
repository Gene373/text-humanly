/**
 * Проверка подключения к GigaChat без вывода секретов.
 *
 * Запуск: npm run check:gigachat
 *
 * Скрипт читает ключ из server/.env (GIGACHAT_AUTH_KEY), запрашивает токен
 * и делает минимальный запрос к модели. В консоль попадают только:
 *  - настроен ли ключ (да/нет) и его длина;
 *  - scope, модель, адреса;
 *  - код ответа и текст ошибки от API.
 * Сам ключ и токен доступа не печатаются.
 */

import { config, isGigaChatConfigured } from '../src/config.ts';
import { GigaChatError, gigachatChat } from '../src/services/gigachat.ts';

function mask(value: string): string {
  if (!value) return '(пусто)';
  return `задан, ${value.length} символов, начинается с «${value.slice(0, 4)}…»`;
}

async function main() {
  console.log('--- GigaChat: проверка подключения ---');
  console.log('LLM_PROVIDER :', config.llm.provider);
  console.log('Ключ         :', mask(config.gigachat.authKey));
  console.log('Scope        :', config.gigachat.scope);
  console.log('Модель       :', config.gigachat.model);
  console.log('Base URL     :', config.gigachat.baseUrl);
  console.log('OAuth URL    :', config.gigachat.oauthUrl);
  console.log('Сертификат   :', config.gigachat.caCertPath || 'server/certs/russian_trusted_root_ca_pem.crt');
  console.log('');

  if (!isGigaChatConfigured()) {
    console.log('❌ GIGACHAT_AUTH_KEY не задан.');
    console.log('   Добавьте ключ авторизации в server/.env и повторите запуск.');
    process.exitCode = 1;
    return;
  }

  try {
    const answer = await gigachatChat(
      [
        { role: 'system', content: 'Отвечай очень коротко.' },
        { role: 'user', content: 'Скажи одно слово: работает' },
      ],
      0,
    );

    console.log('✅ Токен получен, модель ответила.');
    console.log('   Ответ модели:', answer.slice(0, 120).replace(/\s+/g, ' '));
  } catch (error) {
    if (error instanceof GigaChatError) {
      console.log(`❌ Ошибка (${error.code}${error.status ? `, HTTP ${error.status}` : ''}): ${error.message}`);
      if (error.code === 'auth') {
        console.log('   Проверьте: ключ скопирован полностью, scope соответствует тарифу,');
        console.log('   сертификат НУЦ Минцифры установлен или лежит в server/certs/.');
      }
    } else {
      console.log('❌ Непредвиденная ошибка:', error instanceof Error ? error.message : String(error));
    }
    process.exitCode = 1;
  }
}

void main();
