// Фильтр запрещённого контента.
// Три группы проверок: нецензурная лексика, запрещённые темы, попытки
// инъекции промпта. Мат ищется регулярками с границами слова, чтобы
// не задевать безобидные слова («суккуленты», «сукцессия», «тебе»).
//
// Важно: \w в JavaScript не включает кириллицу, поэтому «хвост» слова
// описывается явно как [а-яёa-z]*.

const TAIL = '[а-яёa-z]*';
const LEFT = '(?<![а-яёa-z])';
const RIGHT = '(?![а-яёa-z])';

function words(stems: string[]): RegExp[] {
  return stems.map((stem) => new RegExp(`${LEFT}(?:${stem})${TAIL}${RIGHT}`, 'i'));
}

const PROFANITY: RegExp[] = [
  ...words([
    'ху[йяеё]',
    'пизд',
    'бляд',
    'блят',
    'бля',
    'мудак',
    'мудил',
    'пидор',
    'пидар',
    'педик',
    'шлюх',
    'срак',
    'жоп',
    'говн',
    'мраз',
    'гандон',
    'залуп',
    'манда',
    'дроч',
    'долбо[её]б',
  ]),
  // «сука» и производные — отдельно, чтобы не задеть «суккулент».
  new RegExp(`${LEFT}сук[аиуеой]${TAIL}${RIGHT}`, 'i'),
  // Корни с приставками: заебал, наебать, уёбок, разъеб…
  new RegExp(`${LEFT}(?:за|на|отъ|у|до|разъ|съ|въ|подъ|объ|вы|пере|недо)[её]б${TAIL}${RIGHT}`, 'i'),
  // Само слово «еб…» в начале слова: ебать, ебал, ебуч, ебёт
  new RegExp(`${LEFT}[её]б(?:а|у|и|я|ё)${TAIL}${RIGHT}`, 'i'),
  // Отдельное слово «еб» / «ёб»
  new RegExp(`${LEFT}[её]б${RIGHT}`, 'i'),
];

const FORBIDDEN_TOPICS: RegExp[] = [
  /как\s+изготовить\s+взрывчат/i,
  /изготовлени[ея]\s+взрывчат/i,
  /сделать\s+бомб/i,
  /собрать\s+бомб/i,
  /как\s+убить/i,
  /как\s+отравить/i,
  /приготовить\s+наркотик/i,
  /синтез\S*\s+наркотик/i,
  /купить\s+наркотик/i,
  /взлом\S*\s+почт/i,
  /взломать\s+аккаунт/i,
  /украсть\s+парол/i,
  /\bddos\b/i,
  /кардинг/i,
  /обнал/i,
  /детск\S*\s+порн/i,
  /детская\s+порнограф/i,
];

const REJECT_PATTERNS: RegExp[] = [
  /игнорир(уй|уйте)\s+(все\s+)?(предыдущ|инструкц|правил)/i,
  /ты\s+теперь\s+(другой|другая|другую)\s+роль/i,
  /system\s*prompt/i,
  /reveal\s+(your\s+)?prompt/i,
];

export interface ModerationResult {
  allowed: boolean;
  reason?: 'profanity' | 'forbidden_topic' | 'prompt_injection';
}

export function moderateText(text: string): ModerationResult {
  const normalized = text.replace(/ё/g, 'е').replace(/Ё/g, 'Е');

  if (PROFANITY.some((pattern) => pattern.test(normalized))) {
    return { allowed: false, reason: 'profanity' };
  }

  if (FORBIDDEN_TOPICS.some((pattern) => pattern.test(normalized))) {
    return { allowed: false, reason: 'forbidden_topic' };
  }

  if (REJECT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { allowed: false, reason: 'prompt_injection' };
  }

  return { allowed: true };
}
