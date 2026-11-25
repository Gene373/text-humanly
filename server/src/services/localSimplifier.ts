// Локальный (rule-based) упроститель русского текста.
// Используется, когда LLM_API_KEY не задан, а также в тестах.
// Работает построчно, чтобы не разрушать заголовки, списки и формулы.
//
// Важно: в JavaScript \b не работает с кириллицей, поэтому границы слова
// задаются явными lookaround-проверками.
// Все замены подобраны так, чтобы не ломать согласование по роду и падежу.

type Level = 'slightly_simpler' | 'beginner';

interface RawReplacement {
  pattern: string;
  value: string;
}

interface Replacement {
  pattern: RegExp;
  value: string;
}

const WORD_LEFT = '(?<![а-яёa-z0-9_])';
const WORD_RIGHT = '(?![а-яёa-z0-9_])';

function compile(raw: RawReplacement[]): Replacement[] {
  return raw.map(({ pattern, value }) => ({
    pattern: new RegExp(`${WORD_LEFT}(?:${pattern})${WORD_RIGHT}`, 'gi'),
    value,
  }));
}

// Канцелярские обороты и «тяжёлые» слова. Безопасные замены.
const CLICHES: Replacement[] = compile([
  // Составные обороты — идут первыми, чтобы не развалиться на части.
  { pattern: 'в\\s+настоящее\\s+время\\s+в\\s+связи\\s+с\\s+тем,?\\s+что', value: 'так как' },
  { pattern: 'в\\s+настоящее\\s+время', value: 'сейчас' },
  { pattern: 'в\\s+данный\\s+момент', value: 'сейчас' },
  { pattern: 'в\\s+настоящий\\s+период', value: 'сейчас' },
  { pattern: 'на\\s+сегодняшний\\s+день', value: 'сегодня' },
  { pattern: 'в\\s+связи\\s+с\\s+этим', value: 'поэтому' },
  { pattern: 'в\\s+силу\\s+этого', value: 'поэтому' },
  { pattern: 'в\\s+связи\\s+с\\s+тем,?\\s+что', value: 'так как' },
  { pattern: 'в\\s+силу\\s+того,?\\s+что', value: 'так как' },
  { pattern: 'по\\s+причине\\s+того,?\\s+что', value: 'так как' },
  { pattern: 'вследствие\\s+того,?\\s+что', value: 'так как' },
  { pattern: 'таким\\s+образом', value: 'значит' },
  { pattern: 'тем\\s+не\\s+менее', value: 'но' },
  { pattern: 'вместе\\s+с\\s+тем', value: 'но' },
  { pattern: 'в\\s+свою\\s+очередь', value: 'а' },
  { pattern: 'достаточно\\s+часто', value: 'часто' },
  { pattern: 'как\\s+правило', value: 'обычно' },
  { pattern: 'в\\s+большинстве\\s+случаев', value: 'обычно' },
  { pattern: 'в\\s+ряде\\s+случаев', value: 'иногда' },
  { pattern: 'необходимо\\s+отметить,?\\s+что', value: 'важно, что' },
  { pattern: 'следует\\s+отметить,?\\s+что', value: 'важно, что' },
  { pattern: 'стоит\\s+отметить,?\\s+что', value: 'важно, что' },
  { pattern: 'следует\\s+подчеркнуть,?\\s+что', value: 'важно, что' },
  { pattern: 'не\\s+вызывает\\s+сомнений,?\\s+что', value: 'ясно, что' },
  { pattern: 'посредством', value: 'с помощью' },
  { pattern: 'при\\s+помощи', value: 'с помощью' },
  { pattern: 'в\\s+процессе', value: 'во время' },
  { pattern: 'в\\s+ходе', value: 'во время' },
  { pattern: 'на\\s+основании', value: 'на основе' },
  { pattern: 'данные\\s+положения', value: 'эти идеи' },

  // «данный» — по родам и падежам
  { pattern: 'данный', value: 'этот' },
  { pattern: 'данная', value: 'эта' },
  { pattern: 'данное', value: 'это' },
  { pattern: 'данные', value: 'эти' },
  { pattern: 'данного', value: 'этого' },
  { pattern: 'данной', value: 'этой' },
  { pattern: 'данных', value: 'этих' },
  { pattern: 'данным', value: 'этим' },
  { pattern: 'данными', value: 'этими' },
  { pattern: 'данную', value: 'эту' },

  // «вышеуказанный» — по родам
  { pattern: 'вышеуказанный', value: 'этот' },
  { pattern: 'вышеуказанная', value: 'эта' },
  { pattern: 'вышеуказанное', value: 'это' },
  { pattern: 'вышеуказанные', value: 'эти' },

  // глаголы «канцелярского» вида
  { pattern: 'осуществляется', value: 'идёт' },
  { pattern: 'осуществляются', value: 'идут' },
  { pattern: 'осуществлялся', value: 'шёл' },
  { pattern: 'осуществлялась', value: 'шла' },
  { pattern: 'осуществлялось', value: 'шло' },
  { pattern: 'осуществить', value: 'сделать' },
  { pattern: 'осуществление', value: 'выполнение' },
  { pattern: 'производится', value: 'делается' },
  { pattern: 'производятся', value: 'делаются' },
  { pattern: 'производить', value: 'делать' },
  { pattern: 'представляет\\s+собой', value: '—' },
  { pattern: 'функционирует', value: 'работает' },
  { pattern: 'функционируют', value: 'работают' },
  { pattern: 'применяется', value: 'используется' },
  { pattern: 'применяются', value: 'используются' },
  { pattern: 'применять', value: 'использовать' },
  { pattern: 'полагать', value: 'считать' },
  { pattern: 'детерминирует', value: 'определяет' },
  { pattern: 'детерминируют', value: 'определяют' },

  { pattern: 'процесс\\s+оптимизации\\s+образовательного\\s+процесса', value: 'улучшение обучения' },
  { pattern: 'процесс\\s+оптимизации', value: 'улучшение' },
  { pattern: 'процесс\\s+обучения', value: 'обучение' },
  { pattern: 'является\\s+достаточно\\s+эффективным', value: 'работает достаточно хорошо' },
  { pattern: 'является\\s+эффективным', value: 'работает хорошо' },
  { pattern: 'является\\s+основой', value: 'лежит в основе' },

  // «оптимизация» — по падежам
  { pattern: 'оптимизация', value: 'улучшение' },
  { pattern: 'оптимизации', value: 'улучшения' },
  { pattern: 'оптимизацию', value: 'улучшение' },
  { pattern: 'оптимизацией', value: 'улучшением' },

  // «реализация» — по падежам
  { pattern: 'реализация', value: 'выполнение' },
  { pattern: 'реализации', value: 'выполнения' },
  { pattern: 'реализацию', value: 'выполнение' },
  { pattern: 'реализацией', value: 'выполнением' },

  // «интеграция», «трансформация», «верификация», «идентификация»
  { pattern: 'интеграция', value: 'объединение' },
  { pattern: 'интеграции', value: 'объединения' },
  { pattern: 'трансформация', value: 'изменение' },
  { pattern: 'трансформации', value: 'изменения' },
  { pattern: 'верификация', value: 'проверка' },
  { pattern: 'верификации', value: 'проверки' },
  { pattern: 'идентификация', value: 'определение' },
  { pattern: 'идентификации', value: 'определения' },
  { pattern: 'актуализация', value: 'обновление' },
  { pattern: 'актуализации', value: 'обновления' },
  { pattern: 'классификация', value: 'деление на группы' },
  { pattern: 'классификации', value: 'деления на группы' },
  { pattern: 'интерпретация', value: 'толкование' },
  { pattern: 'интерпретации', value: 'толкования' },
  { pattern: 'методология', value: 'подход' },
  { pattern: 'методологии', value: 'подхода' },
  { pattern: 'парадигма', value: 'модель' },
  { pattern: 'парадигмы', value: 'модели' },

  // прилагательные — по родам
  { pattern: 'релевантный', value: 'важный' },
  { pattern: 'релевантная', value: 'важная' },
  { pattern: 'релевантное', value: 'важное' },
  { pattern: 'релевантные', value: 'важные' },
  { pattern: 'концептуальный', value: 'общий' },
  { pattern: 'концептуальная', value: 'общая' },
  { pattern: 'концептуальное', value: 'общее' },
  { pattern: 'концептуальные', value: 'общие' },
  { pattern: 'эффективный', value: 'действенный' },
  { pattern: 'эффективная', value: 'действенная' },
  { pattern: 'эффективное', value: 'действенное' },
  { pattern: 'эффективные', value: 'действенные' },

  { pattern: 'однако', value: 'но' },
]);

const BEGINNER_EXTRA: Replacement[] = compile([
  { pattern: 'следовательно', value: 'поэтому' },
  { pattern: 'соответственно', value: 'поэтому' },
  { pattern: 'принципиально', value: 'важно' },
  { pattern: 'преимущественно', value: 'в основном' },
  { pattern: 'непосредственно', value: 'прямо' },
  { pattern: 'фактически', value: 'на деле' },
  { pattern: 'в\\s+определённой\\s+мере', value: 'частично' },
  { pattern: 'в\\s+значительной\\s+степени', value: 'сильно' },
  { pattern: 'систематизация', value: 'упорядочивание' },
  { pattern: 'систематизации', value: 'упорядочивания' },
  { pattern: 'дифференциация', value: 'разделение' },
  { pattern: 'дифференциации', value: 'разделения' },
  { pattern: 'конкретизация', value: 'уточнение' },
  { pattern: 'конкретизации', value: 'уточнения' },
  { pattern: 'апробация', value: 'проверка' },
  { pattern: 'апробации', value: 'проверки' },
  { pattern: 'декомпозиция', value: 'разбиение на части' },
  { pattern: 'декомпозиции', value: 'разбиения на части' },
  { pattern: 'корреляция', value: 'связь' },
  { pattern: 'корреляции', value: 'связи' },
  { pattern: 'компетенция', value: 'навык' },
  { pattern: 'компетенции', value: 'навыка' },
  { pattern: 'критерий', value: 'признак' },
  { pattern: 'критерии', value: 'признаки' },
  { pattern: 'критериев', value: 'признаков' },
  { pattern: 'аспект', value: 'сторона' },
  { pattern: 'аспекты', value: 'стороны' },
  { pattern: 'аспектов', value: 'сторон' },
  { pattern: 'феномен', value: 'явление' },
  { pattern: 'феномены', value: 'явления' },
  { pattern: 'компонент', value: 'часть' },
  { pattern: 'компоненты', value: 'части' },
  { pattern: 'элемент', value: 'часть' },
  { pattern: 'элементы', value: 'части' },
  { pattern: 'тенденция', value: 'направление' },
  { pattern: 'тенденции', value: 'направления' },
  { pattern: 'параметр', value: 'показатель' },
  { pattern: 'параметры', value: 'показатели' },
]);

const SKIP_LINE_RE = /^\s*(#{1,6}\s|[-*•]\s|\d+[.)]\s|\||>|```|\$\$)/;
const FORMULA_RE = /\$[^$]+\$/g;

function preserveFormulas(line: string, transform: (chunk: string) => string): string {
  const parts: string[] = [];
  const masked = line.replace(FORMULA_RE, (match) => {
    parts.push(match);
    return `\u0000${parts.length - 1}\u0000`;
  });
  const transformed = transform(masked);
  return transformed.replace(/\u0000(\d+)\u0000/g, (_, index: string) => parts[Number(index)]);
}

function splitLongSentence(sentence: string, maxWords: number): string[] {
  if (sentence.split(/\s+/).length <= maxWords) return [sentence];

  const breakMarkers = /,\s+(?:котор\w+|поэтому|при\s+этом|однако|но)\s+/i;
  const chunks: string[] = [];
  let rest = sentence;

  while (rest.split(/\s+/).length > maxWords) {
    const match = breakMarkers.exec(rest);
    if (!match || match.index === 0) break;
    const head = rest.slice(0, match.index).trim();
    const tail = rest.slice(match.index + match[0].length).trim();
    if (head.split(/\s+/).length < 5 || tail.split(/\s+/).length < 4) break;
    chunks.push(`${head}.`);
    rest = tail.charAt(0).toUpperCase() + tail.slice(1);
  }

  chunks.push(rest);
  return chunks;
}

// Чистка артефактов, которые могут появиться после замен.
function cleanup(text: string): string {
  return text
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])(?=[а-яёa-z])/gi, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\b(?:это)\s+(?:это)\b/gi, 'это')
    .replace(/\bважно,\s+что\s+важно,\s+что\b/gi, 'важно, что')
    .replace(/\bпотому\s+что\s+(?=[а-яё])/gi, 'потому что ')
    .trim();
}

function capitalizeSentences(text: string): string {
  return text.replace(/(^|[.!?]\s+|\n)([а-яёa-z])/g, (_match, prefix: string, letter: string) =>
    `${prefix}${letter.toUpperCase()}`,
  );
}

function simplifyParagraph(paragraph: string, level: Level): string {
  const replacements = level === 'beginner' ? [...CLICHES, ...BEGINNER_EXTRA] : CLICHES;

  let result = preserveFormulas(paragraph, (chunk) => {
    let value = chunk;
    for (const { pattern, value: replacement } of replacements) {
      value = value.replace(pattern, replacement);
    }
    return value;
  });

  result = cleanup(result);

  const maxWords = level === 'beginner' ? 16 : 24;
  const sentences = result.split(/(?<=[.!?])\s+/);
  const simplified = sentences.flatMap((sentence) => splitLongSentence(sentence, maxWords));

  return capitalizeSentences(cleanup(simplified.join(' ')));
}

export function simplifyLocally(text: string, level: Level): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const output: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const paragraph = buffer.join(' ').replace(/\s+/g, ' ').trim();
    if (paragraph) output.push(simplifyParagraph(paragraph, level));
    buffer = [];
  };

  for (const line of lines) {
    if (line.trim() === '') {
      flush();
      output.push('');
      continue;
    }

    if (SKIP_LINE_RE.test(line)) {
      flush();
      const listMatch = line.match(/^(\s*(?:[-*•]|\d+[.)])\s+)(.*)$/);
      if (listMatch) {
        output.push(`${listMatch[1]}${simplifyParagraph(listMatch[2], level)}`);
      } else {
        output.push(line.replace(/\s+$/, ''));
      }
      continue;
    }

    buffer.push(line.trim());
  }

  flush();

  return output
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
