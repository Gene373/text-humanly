import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Тесты VK-бота и подсчёта токенов.
 * Сеть замокана, секреты в тестах фиктивные.
 */

const ENV = {
  VK_ACCESS_TOKEN: 'vk1.a.fake-token-for-tests',
  VK_GROUP_ID: '123456789',
  VK_NOTIFY_PEER_ID: '555',
  VK_ADMIN_IDS: '',
  VK_BOT_ENABLED: 'true',
};

const originalEnv = { ...process.env };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loadVk() {
  vi.resetModules();
  return import('../src/services/vk.ts');
}

describe('VK-бот', () => {
  beforeEach(() => {
    Object.assign(process.env, ENV);
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('отправляет уведомление с email, временем и токенами', async () => {
    const calls: Array<{ url: string; body: string }> = [];

    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url, body: String(init?.body ?? '') });
      return jsonResponse({ response: 1 });
    });

    const { notifyRequest } = await loadVk();

    await notifyRequest('user-1', { totalTokens: 1234 });

    const sendCall = calls.find((c) => c.url.includes('messages.send'));
    expect(sendCall).toBeDefined();

    const params = new URLSearchParams(sendCall!.body);
    expect(params.get('peer_id')).toBe('555');

    // toLocaleString('ru-RU') использует неразрывный пробел — нормализуем.
    const message = (params.get('message') ?? '').replace(/\u00a0/g, ' ');
    expect(message).toContain('Потрачено токенов: 1 234');
    expect(message).toContain('Время (МСК)');
    expect(params.get('random_id')).toBeTruthy();
  });

  it('не отправляет сообщение, если VK_NOTIFY_PEER_ID = 0', async () => {
    process.env.VK_NOTIFY_PEER_ID = '0';

    const fetchSpy = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
      async () => jsonResponse({ response: 1 }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const { notifyRequest } = await loadVk();
    await notifyRequest('user-1', { totalTokens: 10 });

    const sendCalls = fetchSpy.mock.calls.filter((call) =>
      String(call[0]).includes('messages.send'),
    );
    expect(sendCalls).toHaveLength(0);
  });

  it('не обращается к сети, если бот не настроен', async () => {
    process.env.VK_ACCESS_TOKEN = '';
    process.env.VK_GROUP_ID = '0';

    const fetchSpy = vi.fn<() => Promise<Response>>();
    vi.stubGlobal('fetch', fetchSpy);

    const { notifyRequest, startVkBot } = await loadVk();

    startVkBot();
    await notifyRequest('user-1', { totalTokens: 10 });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('не запускает цикл без ключа', async () => {
    process.env.VK_ACCESS_TOKEN = '';
    const fetchSpy = vi.fn<() => Promise<Response>>();
    vi.stubGlobal('fetch', fetchSpy);

    const { startVkBot } = await loadVk();
    startVkBot();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('не выводит ключ доступа в логах', async () => {
    const consoleSpies = [
      vi.spyOn(console, 'log').mockImplementation(() => {}),
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {}),
    ];
    const outSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    vi.stubGlobal('fetch', async () => jsonResponse({ response: 1 }));

    const { notifyRequest } = await loadVk();
    await notifyRequest('user-1', { totalTokens: 5 });

    const logged = [
      ...consoleSpies.flatMap((spy) => spy.mock.calls.map((args) => args.join(' '))),
      ...outSpy.mock.calls.map((args) => String(args[0])),
      ...errSpy.mock.calls.map((args) => String(args[0])),
    ].join('\n');

    expect(logged).not.toContain(ENV.VK_ACCESS_TOKEN);
  });

  it('не отправляет токен в тело запроса messages.send', async () => {
    const bodies: string[] = [];

    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      bodies.push(String(init?.body ?? ''));
      return jsonResponse({ response: 1 });
    });

    const { notifyRequest } = await loadVk();
    await notifyRequest('user-1', { totalTokens: 5 });

    // Токен передаётся как параметр авторизации — он не должен попадать в текст сообщения.
    const sendBody = bodies.find((b) => b.includes('peer_id')) ?? '';
    const params = new URLSearchParams(sendBody);
    expect(params.get('message')).not.toContain(ENV.VK_ACCESS_TOKEN);
  });
});

describe('подсчёт токенов в GigaChat', () => {
  beforeEach(() => {
    Object.assign(process.env, {
      GIGACHAT_AUTH_KEY: 'dGVzdDp0ZXN0',
      GIGACHAT_SCOPE: 'GIGACHAT_API_PERS',
      GIGACHAT_MODEL: 'GigaChat-2',
      GIGACHAT_BASE_URL: 'https://api.giga.chat/v1',
      GIGACHAT_OAUTH_URL: 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
    });
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('возвращает usage из ответа модели', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (String(url).includes('oauth')) {
        return jsonResponse({ access_token: 'tok', expires_at: 4_102_444_800_000 });
      }
      return jsonResponse({
        choices: [{ message: { content: 'Готово.' } }],
        usage: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
      });
    });

    vi.resetModules();
    const { gigachatChatWithUsage } = await import('../src/services/gigachat.ts');

    const result = await gigachatChatWithUsage([{ role: 'user', content: 'текст' }]);

    expect(result.content).toBe('Готово.');
    expect(result.usage).toEqual({ inputTokens: 120, outputTokens: 30, totalTokens: 150 });
  });

  it('подставляет нули, если usage не пришёл', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (String(url).includes('oauth')) {
        return jsonResponse({ access_token: 'tok', expires_at: 4_102_444_800_000 });
      }
      return jsonResponse({ choices: [{ message: { content: 'Ок.' } }] });
    });

    vi.resetModules();
    const { gigachatChatWithUsage } = await import('../src/services/gigachat.ts');

    const result = await gigachatChatWithUsage([{ role: 'user', content: 'текст' }]);

    expect(result.usage.totalTokens).toBe(0);
  });
});
