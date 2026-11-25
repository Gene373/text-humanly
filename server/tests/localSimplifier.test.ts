import { describe, expect, it } from 'vitest';
import { simplifyLocally } from '../src/services/localSimplifier.ts';

describe('simplifyLocally', () => {
  it('убирает канцелярит', () => {
    const result = simplifyLocally('В настоящее время данный подход является эффективным.', 'slightly_simpler');
    expect(result).not.toContain('В настоящее время');
    expect(result).not.toContain('данный');
  });

  it('сохраняет числа и имена', () => {
    const result = simplifyLocally('Исследование МГУ 2023 года показало рост на 15%.', 'beginner');
    expect(result).toContain('МГУ');
    expect(result).toContain('2023');
    expect(result).toContain('15%');
  });

  it('сохраняет заголовки, списки и формулы', () => {
    const source = '## Раздел\n\n- Первый пункт\n- Второй пункт\n\nФормула: $E = mc^2$';
    const result = simplifyLocally(source, 'beginner');
    expect(result).toContain('## Раздел');
    expect(result).toContain('- ');
    expect(result).toContain('$E = mc^2$');
  });

  it('не оставляет двойных пробелов и пробелов перед знаками', () => {
    const result = simplifyLocally('Данный  подход , является  основой .', 'beginner');
    expect(result).not.toMatch(/\s{2,}/);
    expect(result).not.toMatch(/\s+[,.;:]/);
  });

  it('возвращает пустую строку для пустого ввода', () => {
    expect(simplifyLocally('', 'beginner')).toBe('');
    expect(simplifyLocally('   \n\n  ', 'beginner')).toBe('');
  });

  it('сохраняет переводы строк между абзацами', () => {
    const result = simplifyLocally('Первый абзац.\n\nВторой абзац.', 'beginner');
    expect(result.split('\n\n').length).toBeGreaterThanOrEqual(2);
  });

  it('делает текст короче или равным по длине', () => {
    const source = 'В настоящее время осуществляется процесс оптимизации образовательного процесса.';
    const result = simplifyLocally(source, 'beginner');
    expect(result.length).toBeLessThanOrEqual(source.length);
  });
});
