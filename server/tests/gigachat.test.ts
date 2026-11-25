import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Тесты клиента GigaChat с полностью замоканным fetch.
 * Сеть не используется, секреты в коде тестов фиктивные.
 */

const ENV = {
  GIGACHAT_AUTH_KEY: 'dGVzdC1jbGllbnQtaWQ6dGVzdC1zZWNyZXQ=',
  GIGACHAT_SCOPE: 'GIGACHAT_API_PERS',
  GIGACHAT_MODEL: 'GigaChat-2',
  GIGACHAT_BASE_URL: 'https://api.giga.chat/v1',
  GIGACHAT_OAUTH_URL: 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
};

const originalEnv = { ...process.env };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loadModule() {
  vi.resetModules();
  return import('../src/services/gigachat.ts');
}

describe('GigaChat клиент', () => {
  beforeEach(() => {
    Object.assign(process.env, ENV);
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('получает токен с Basic-авторизацией и RqUID, затем вызывает chat/completions', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];

    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url === ENV.GIGACHAT_OAUTH_URL) {
        return jsonResponse({ access_token: 'token-1', expires_at: 4_102_444_800 });
      }
      return jsonResponse({ choices: [{ message: { content: 'Упрощённый текст.' } }] });
    });

    const { gigachatChat } = await loadModule();
    const result = await gigachatChat([{ role: 'user', content: 'Сложный текст' }]);

    expect(result).toBe('Упрощённый текст.');
    expect(calls).toHaveLength(2);

    const [oauth, completion] = calls;
    expect(oauth.url).toBe(ENV.GIGACHAT_OAUTH_URL);
    expect(oauth.init.method).toBe('POST');
    expect(oauth.init.body?.toString()).toBe('scope=GIGACHAT_API_PERS');

    const oauthHeaders = oauth.init.headers as Record<string, string>;
    expect(oauthHeaders.Authorization).toBe(`Basic ${ENV.GIGACHAT_AUTH_KEY}`);
    expect(oauthHeaders.RqUID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    expect(completion.url).toBe(`${ENV.GIGACHAT_BASE_URL}/chat/completions`);
    const completionHeaders = completion.init.headers as Record<string, string>;
    expect(completionHeaders.Authorization).toBe('Bearer token-1');
    expect(completionHeaders['User-Agent']).toBeTruthy();

    const payload = JSON.parse(String(completion.init.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(payload.model).toBe('GigaChat-2');
    expect(payload.messages).toHaveLength(1);
  });

  it('переиспользует закешированный токен', async () => {
    let oauthCalls = 0;

    vi.stubGlobal('fetch', async (url: string) => {
      if (url === ENV.GIGACHAT_OAUTH_URL) {
        oauthCalls += 1;
        return jsonResponse({ access_token: `token-${oauthCalls}`, expires_at: 4_102_444_800 });
      }
      return jsonResponse({ choices: [{ message: { content: 'ok' } }] });
    });

    const { gigachatChat } = await loadModule();
    await gigachatChat([{ role: 'user', content: 'раз' }]);
    await gigachatChat([{ role: 'user', content: 'два' }]);

    expect(oauthCalls).toBe(1);
  });

  it('перевыпускает токен после 401', async () => {
    let oauthCalls = 0;
    let completionCalls = 0;

    vi.stubGlobal('fetch', async (url: string) => {
      if (url === ENV.GIGACHAT_OAUTH_URL) {
        oauthCalls += 1;
        return jsonResponse({ access_token: `token-${oauthCalls}`, expires_at: 4_102_444_800 });
      }
      completionCalls += 1;
      if (completionCalls === 1) {
        return jsonResponse({ message: 'token expired' }, 401);
      }
      return jsonResponse({ choices: [{ message: { content: 'после обновления' } }] });
    });

    const { gigachatChat } = await loadModule();
    const result = await gigachatChat([{ role: 'user', content: 'текст' }]);

    expect(result).toBe('после обновления');
    expect(oauthCalls).toBe(2);
    expect(completionCalls).toBe(2);
  });

  it('превращает 429 в понятную ошибку upstream', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (url === ENV.GIGACHAT_OAUTH_URL) {
        return jsonResponse({ access_token: 'token', expires_at: 4_102_444_800 });
      }
      return jsonResponse({ message: 'too many requests' }, 429);
    });

    const { gigachatChat, GigaChatError } = await loadModule();

    await expect(gigachatChat([{ role: 'user', content: 'текст' }])).rejects.toThrow(
      GigaChatError,
    );

    await expect(gigachatChat([{ role: 'user', content: 'текст' }])).rejects.toMatchObject({
      code: 'upstream',
      status: 429,
    });
  });

  it('сообщает об ошибке авторизации при неверном ключе', async () => {
    vi.stubGlobal('fetch', async () => jsonResponse({ message: 'bad credentials' }, 401));

    const { gigachatChat } = await loadModule();

    await expect(gigachatChat([{ role: 'user', content: 'текст' }])).rejects.toMatchObject({
      code: 'auth',
      status: 401,
    });
  });

  it('не выполняет запрос без ключа авторизации', async () => {
    process.env.GIGACHAT_AUTH_KEY = '';
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { gigachatChat } = await loadModule();

    await expect(gigachatChat([{ role: 'user', content: 'текст' }])).rejects.toMatchObject({
      code: 'not_configured',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('не выводит ключ авторизации и токен в логах', async () => {
    const consoleSpies = [
      vi.spyOn(console, 'log').mockImplementation(() => {}),
      vi.spyOn(console, 'info').mockImplementation(() => {}),
      vi.spyOn(console, 'warn').mockImplementation(() => {}),
      vi.spyOn(console, 'error').mockImplementation(() => {}),
    ];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    vi.stubGlobal('fetch', async (url: string) => {
      if (url === ENV.GIGACHAT_OAUTH_URL) {
        return jsonResponse({ access_token: 'secret-access-token', expires_at: 4_102_444_800 });
      }
      return jsonResponse({ choices: [{ message: { content: 'ok' } }] });
    });

    const { gigachatChat } = await loadModule();
    await gigachatChat([{ role: 'user', content: 'текст' }]);

    const logged = [
      ...consoleSpies.flatMap((spy) => spy.mock.calls.map((args) => args.join(' '))),
      ...writeSpy.mock.calls.map((args) => String(args[0])),
      ...errSpy.mock.calls.map((args) => String(args[0])),
    ].join('\n');

    expect(logged).not.toContain(ENV.GIGACHAT_AUTH_KEY);
    expect(logged).not.toContain('secret-access-token');
  });
});
