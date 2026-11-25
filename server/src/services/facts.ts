// Проверка сохранности фактов: числа, даты и имена собственные оригинала
// должны встречаться в упрощённом тексте.

const NUMBER_RE = /\d+(?:[.,]\d+)?%?/g;

export function extractNumbers(text: string): string[] {
  const matches = text.match(NUMBER_RE) ?? [];
  return [...new Set(matches.map((value) => value.replace(',', '.')))];
}

export function extractCapitalized(text: string): string[] {
  // Слова с заглавной буквы не в начале предложения — грубая, но рабочая
  // эвристика для имён собственных в русском тексте.
  const cleaned = text.replace(/[«»"()]/g, ' ');
  const words = cleaned.split(/(?<=[.!?])\s+|\n+/);
  const result = new Set<string>();

  for (const sentence of words) {
    const tokens = sentence.split(/\s+/).filter(Boolean);
    tokens.forEach((token, index) => {
      const bare = token.replace(/[^А-Яа-яЁёA-Za-z-]/g, '');
      if (bare.length < 2) return;
      const isCapital = /^[А-ЯЁA-Z]/.test(bare);
      const isFirstInSentence = index === 0;
      if (isCapital && !isFirstInSentence) result.add(bare);
    });
  }

  return [...result];
}

export interface FactsCheck {
  ok: boolean;
  missingNumbers: string[];
  missingNames: string[];
}

export function checkFactsPreserved(source: string, result: string): FactsCheck {
  const normalizedResult = result.replace(/,/g, '.');
  const missingNumbers = extractNumbers(source).filter(
    (value) => !normalizedResult.includes(value),
  );
  const missingNames = extractCapitalized(source).filter(
    (name) => !result.includes(name),
  );

  return {
    ok: missingNumbers.length === 0 && missingNames.length === 0,
    missingNumbers,
    missingNames,
  };
}

export interface StructureCheck {
  ok: boolean;
  missingHeadings: number;
  missingListItems: number;
  missingFormulas: string[];
}

const FORMULA_RE = /\$[^$]+\$/g;

export function checkStructurePreserved(source: string, result: string): StructureCheck {
  const sourceHeadings = (source.match(/^\s{0,3}#{1,6}\s+\S/gm) ?? []).length;
  const resultHeadings = (result.match(/^\s{0,3}#{1,6}\s+\S/gm) ?? []).length;

  const sourceListItems = (source.match(/^\s*(?:[-*•]|\d+[.)])\s+\S/gm) ?? []).length;
  const resultListItems = (result.match(/^\s*(?:[-*•]|\d+[.)])\s+\S/gm) ?? []).length;

  const sourceFormulas = source.match(FORMULA_RE) ?? [];
  const missingFormulas = sourceFormulas.filter((formula) => !result.includes(formula));

  return {
    ok:
      resultHeadings >= sourceHeadings &&
      resultListItems >= sourceListItems &&
      missingFormulas.length === 0,
    missingHeadings: Math.max(sourceHeadings - resultHeadings, 0),
    missingListItems: Math.max(sourceListItems - resultListItems, 0),
    missingFormulas,
  };
}
