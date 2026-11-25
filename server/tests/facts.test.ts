import { describe, expect, it } from 'vitest';
import { checkFactsPreserved, checkStructurePreserved } from '../src/services/facts.ts';

describe('checkFactsPreserved', () => {
  it('подтверждает сохранение чисел и имён', () => {
    const source = 'Исследование МГУ 2023 года показало рост на 15%.';
    const result = 'В 2023 году учёные из МГУ выяснили: рост составил 15%.';
    expect(checkFactsPreserved(source, result).ok).toBe(true);
  });

  it('находит потерянное число', () => {
    const check = checkFactsPreserved('Рост составил 15% в 2023 году.', 'Рост был заметным.');
    expect(check.ok).toBe(false);
    expect(check.missingNumbers).toContain('15%');
  });

  it('находит потерянное имя собственное', () => {
    const check = checkFactsPreserved('Теория Эйнштейна описывает гравитацию.', 'Одна теория описывает гравитацию.');
    expect(check.ok).toBe(false);
    expect(check.missingNames).toContain('Эйнштейна');
  });

  it('считает числа с запятой и точкой эквивалентными', () => {
    const check = checkFactsPreserved('Значение равно 3,14.', 'Значение равно 3.14.');
    expect(check.ok).toBe(true);
  });
});

describe('checkStructurePreserved', () => {
  it('сохраняет заголовки и списки', () => {
    const source = '## Заголовок\n\n- пункт один\n- пункт два';
    const result = '## Заголовок\n\n- пункт один\n- пункт два';
    expect(checkStructurePreserved(source, result).ok).toBe(true);
  });

  it('замечает потерянный заголовок', () => {
    const check = checkStructurePreserved('## Раздел\n\nТекст.', 'Текст.');
    expect(check.ok).toBe(false);
    expect(check.missingHeadings).toBe(1);
  });

  it('замечает потерянную формулу', () => {
    const check = checkStructurePreserved('Формула $E = mc^2$ важна.', 'Формула важна.');
    expect(check.ok).toBe(false);
    expect(check.missingFormulas).toContain('$E = mc^2$');
  });
});
