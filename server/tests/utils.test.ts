import { describe, expect, it } from 'vitest';
import { currentDayKey, nextDayStartsAt } from '../src/utils/day.ts';
import { hashToken, generateToken, maskEmail } from '../src/utils/tokens.ts';

describe('currentDayKey', () => {
  it('считает день по Москве (UTC+3)', () => {
    // 2026-11-24T22:30:00Z — в Москве уже 25 ноября
    expect(currentDayKey(new Date('2026-11-24T22:30:00Z'))).toBe('2026-11-25');
    // 2026-11-24T20:59:00Z — в Москве ещё 24 ноября
    expect(currentDayKey(new Date('2026-11-24T20:59:00Z'))).toBe('2026-11-24');
  });
});

describe('nextDayStartsAt', () => {
  it('возвращает полночь следующего московского дня', () => {
    const next = nextDayStartsAt(new Date('2026-11-24T10:00:00Z'));
    // 2026-11-25 00:00 MSK === 2026-11-24 21:00 UTC
    expect(next.toISOString()).toBe('2026-11-24T21:00:00.000Z');
  });
});

describe('tokens', () => {
  it('генерирует разные токены', () => {
    expect(generateToken()).not.toBe(generateToken());
  });

  it('хеширует токен детерминированно и необратимо', () => {
    const token = 'abc';
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toContain('abc');
    expect(hashToken(token)).toHaveLength(64);
  });

  it('маскирует email', () => {
    expect(maskEmail('student@university.ru')).toBe('st*****@university.ru');
  });
});
