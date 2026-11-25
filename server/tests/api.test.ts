import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.ts';
import { prisma } from '../src/db.ts';

const email = `test-${Date.now()}@example.com`;
let app: Express;
let cookie = '';

async function loginAs(targetEmail: string): Promise<string> {
  const loginResponse = await request(app)
    .post('/api/auth/request-login')
    .send({ email: targetEmail })
    .expect(200);

  const token = new URL(loginResponse.body.devLoginUrl).searchParams.get('token');
  const verifyResponse = await request(app).get(`/api/auth/verify?token=${token}`).expect(200);
  const raw = verifyResponse.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : [raw];
  return cookies[0].split(';')[0];
}

beforeAll(async () => {
  app = createApp();
  cookie = await loginAs(email);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: 'test-' } } });
  await prisma.$disconnect();
});

describe('GET /api/health', () => {
  it('отвечает ok', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body.ok).toBe(true);
  });
});

describe('аутентификация', () => {
  it('отклоняет некорректный email', async () => {
    const response = await request(app)
      .post('/api/auth/request-login')
      .send({ email: 'not-an-email' })
      .expect(400);
    expect(response.body.error).toBe('invalid_email');
  });

  it('отклоняет неверный токен', async () => {
    const response = await request(app).get('/api/auth/verify?token=wrong').expect(400);
    expect(response.body.error).toBe('invalid_token');
  });

  it('не даёт использовать токен дважды', async () => {
    const secondEmail = `test-twice-${Date.now()}@example.com`;
    const loginResponse = await request(app)
      .post('/api/auth/request-login')
      .send({ email: secondEmail })
      .expect(200);
    const token = new URL(loginResponse.body.devLoginUrl).searchParams.get('token');

    await request(app).get(`/api/auth/verify?token=${token}`).expect(200);
    await request(app).get(`/api/auth/verify?token=${token}`).expect(400);
  });

  it('возвращает текущего пользователя', async () => {
    const response = await request(app).get('/api/auth/me').set('Cookie', cookie).expect(200);
    expect(response.body.user.email).toBe(email);
  });

  it('возвращает null без cookie', async () => {
    const response = await request(app).get('/api/auth/me').expect(200);
    expect(response.body.user).toBeNull();
  });
});

describe('защита эндпоинтов', () => {
  it('не пускает без авторизации к /api/usage', async () => {
    await request(app).get('/api/usage').expect(401);
  });

  it('не пускает без авторизации к /api/simplify', async () => {
    await request(app).post('/api/simplify').send({ text: 'текст', level: 'beginner' }).expect(401);
  });
});

describe('лимит и валидация', () => {
  it('отклоняет пустой текст', async () => {
    const response = await request(app)
      .post('/api/simplify')
      .set('Cookie', cookie)
      .send({ text: '', level: 'beginner' })
      .expect(400);
    expect(response.body.error).toBe('invalid_input');
  });

  it('отклоняет неизвестный уровень', async () => {
    await request(app)
      .post('/api/simplify')
      .set('Cookie', cookie)
      .send({ text: 'Обычный текст лекции.', level: 'extreme' })
      .expect(400);
  });

  it('отклоняет текст длиннее 10 000 знаков', async () => {
    const response = await request(app)
      .post('/api/simplify')
      .set('Cookie', cookie)
      .send({ text: 'а'.repeat(10001), level: 'beginner' })
      .expect(413);
    expect(response.body.error).toBe('text_too_long');
  });

  it('отклоняет нерусский текст', async () => {
    const response = await request(app)
      .post('/api/simplify')
      .set('Cookie', cookie)
      .send({ text: 'This is an English text about physics research.', level: 'beginner' })
      .expect(422);
    expect(response.body.error).toBe('not_russian');
  });

  it('соблюдает лимит 3 попытки в день', async () => {
    const text = 'Данный подход является эффективным методом обучения студентов.';

    for (let index = 0; index < 3; index += 1) {
      const response = await request(app)
        .post('/api/simplify')
        .set('Cookie', cookie)
        .send({ text, level: 'slightly_simpler' });
      expect(response.status).toBe(200);
      expect(response.body.resultText.length).toBeGreaterThan(0);
      expect(response.body.usage.used).toBe(index + 1);
    }

    const blocked = await request(app)
      .post('/api/simplify')
      .set('Cookie', cookie)
      .send({ text, level: 'slightly_simpler' })
      .expect(403);
    expect(blocked.body.error).toBe('limit_exhausted');

    const usage = await request(app).get('/api/usage').set('Cookie', cookie).expect(200);
    expect(usage.body).toMatchObject({ limit: 3, used: 3, remaining: 0 });
  });
});
