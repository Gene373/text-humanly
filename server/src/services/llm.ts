import { config, resolveEngine, type LlmEngine } from '../config.ts';
import { logger } from '../logger.ts';
import { checkFactsPreserved, checkStructurePreserved } from './facts.ts';
import { GigaChatError, gigachatChatWithUsage, type TokenUsage } from './gigachat.ts';
import { simplifyLocally } from './localSimplifier.ts';

export type Level = 'slightly_simpler' | 'beginner';

export class LlmError extends Error {
  constructor(message: string, readonly code: 'not_russian' | 'upstream' | 'timeout') {
    super(message);
    this.name = 'LlmError';
  }
}

const LEVEL_INSTRUCTIONS: Record<Level, string> = {
  slightly_simpler:
    'Заменяй канцеляризмы и пассивные конструкции на активные, упрощай синтаксис, ' +
    'но сохраняй академический тон и профессиональную терминологию.',
  beginner:
    'Пиши максимально простым разговорно-нейтральным языком. Расшифровывай каждый ' +
    'термин при первом употреблении в скобках. Короткие предложения. Минимум абстракций.',
};

function buildPrompt(text: string, level: Level): string {
  return `Ты — редактор, который переписывает сложные научные и учебные тексты простым русским языком.

Правила (обязательны):
1. Сохраняй ВСЕ факты, имена собственные, числа, даты, проценты и единицы измерения.
2. Сохраняй структуру: заголовки (строки, начинающиеся с #), маркированные и нумерованные списки, формулы в формате $...$.
3. Не добавляй резюме, глоссарии, вступления, пояснения и выводы — только переписанный текст.
4. Работай ТОЛЬКО с русским языком. Если текст не на русском, верни ровно {"error":"not_russian"}.
5. Не меняй смысл и не удаляй части текста.

Уровень упрощения: ${LEVEL_INSTRUCTIONS[level]}

Входной текст:
---
${text}
---

Верни ТОЛЬКО переписанный текст, без преамбул и пояснений.`;
}

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
}

const SYSTEM_PROMPT =
  'Ты аккуратный редактор учебных текстов. Отвечаешь только переписанным текстом на русском языке.';

function buildMessages(prompt: string) {
  return [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: prompt },
  ];
}

interface LlmReply {
  content: string;
  usage: TokenUsage;
}

const ZERO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

async function callOpenAiCompatible(prompt: string): Promise<LlmReply> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.llm.timeoutMs);

  try {
    const response = await fetch(`${config.llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.llm.apiKey}`,
      },
      body: JSON.stringify({
        model: config.llm.model,
        temperature: 0.2,
        messages: buildMessages(prompt),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error({ status: response.status, body: body.slice(0, 500) }, 'LLM вернул ошибку');
      throw new LlmError('Не удалось получить ответ от модели', 'upstream');
    }

    const data = (await response.json()) as ChatResponse;
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new LlmError('Пустой ответ модели', 'upstream');

    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;
    const totalTokens = data.usage?.total_tokens ?? inputTokens + outputTokens;

    return { content, usage: { inputTokens, outputTokens, totalTokens } };
  } catch (error) {
    if (error instanceof LlmError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LlmError('Модель не ответила вовремя', 'timeout');
    }
    logger.error({ error }, 'сбой запроса к LLM');
    throw new LlmError('Сбой запроса к модели', 'upstream');
  } finally {
    clearTimeout(timer);
  }
}

async function callLlm(prompt: string, engine: LlmEngine): Promise<LlmReply> {
  if (engine === 'gigachat') {
    try {
      return await gigachatChatWithUsage(buildMessages(prompt), 0.2);
    } catch (error) {
      if (error instanceof GigaChatError) {
        throw new LlmError(
          error.message,
          error.code === 'timeout' ? 'timeout' : 'upstream',
        );
      }
      throw error;
    }
  }

  return callOpenAiCompatible(prompt);
}

const CYRILLIC_RE = /[а-яё]/i;
const LATIN_WORD_RE = /\b[a-z]{4,}\b/gi;

function looksRussian(text: string): boolean {
  const cyrillic = (text.match(/[а-яё]/gi) ?? []).length;
  const latin = (text.match(LATIN_WORD_RE) ?? []).length;
  if (cyrillic === 0) return false;
  return cyrillic >= latin * 3;
}

function stripWrapping(text: string): string {
  return text
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/```$/i, '')
    .replace(/^\s*(переписанный текст|результат|упрощённый текст)\s*:\s*/i, '')
    .trim();
}

export interface SimplifyOutcome {
  text: string;
  attempts: number;
  warnings: string[];
  engine: 'llm' | 'local';
  /** Суммарный расход токенов по всем попыткам. */
  usage: TokenUsage;
}

export async function simplifyText(text: string, level: Level): Promise<SimplifyOutcome> {
  if (!looksRussian(text)) {
    throw new LlmError('Текст должен быть на русском языке', 'not_russian');
  }

  const engine = resolveEngine();

  if (engine === 'local') {
    logger.warn(
      { provider: config.llm.provider },
      'LLM не настроена — используется локальный алгоритм упрощения',
    );
    return {
      text: simplifyLocally(text, level),
      attempts: 1,
      warnings: ['llm_not_configured'],
      engine: 'local',
      usage: { ...ZERO_USAGE },
    };
  }

  const warnings: string[] = [];
  let best = '';
  let bestScore = -1;
  const maxAttempts = 2;

  // Токены тратятся на каждую попытку — суммируем все.
  const usage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const addUsage = (u: TokenUsage) => {
    usage.inputTokens += u.inputTokens;
    usage.outputTokens += u.outputTokens;
    usage.totalTokens += u.totalTokens;
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const retryNote =
      attempt > 1
        ? '\n\nВАЖНО: в прошлой попытке потерялись числа, имена или структура. Сохрани их полностью.'
        : '';

    const reply = await callLlm(buildPrompt(text, level) + retryNote, engine);
    addUsage(reply.usage);
    const candidate = stripWrapping(reply.content);

    if (candidate.includes('"not_russian"')) {
      throw new LlmError('Текст должен быть на русском языке', 'not_russian');
    }

    const facts = checkFactsPreserved(text, candidate);
    const structure = checkStructurePreserved(text, candidate);
    const score =
      (facts.ok ? 2 : 0) +
      (structure.ok ? 2 : 0) -
      facts.missingNumbers.length * 0.5 -
      facts.missingNames.length * 0.1;

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }

    if (facts.ok && structure.ok) {
      return { text: candidate, attempts: attempt, warnings, engine: 'llm', usage };
    }

    logger.warn({ attempt, facts, structure }, 'проверка сохранности не пройдена');
    warnings.push('facts_or_structure_fixed');
  }

  return { text: best, attempts: maxAttempts, warnings, engine: 'llm', usage };
}
