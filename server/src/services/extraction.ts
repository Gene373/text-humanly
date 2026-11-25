import { createRequire } from 'node:module';
import mammoth from 'mammoth';
import { logger } from '../logger.ts';

const require = createRequire(import.meta.url);

export class ExtractionError extends Error {
  constructor(message: string, readonly code: 'pdf' | 'docx' | 'ocr' | 'empty' | 'unsupported') {
    super(message);
    this.name = 'ExtractionError';
  }
}

interface PdfParseResult {
  text: string;
  numpages?: number;
}

type PdfParse = (buffer: Buffer) => Promise<PdfParseResult>;

function loadPdfParse(): PdfParse {
  // pdf-parse 1.x — CommonJS. Импортируем напрямую lib/pdf-parse.js,
  // потому что index.js при отсутствии module.parent включает debug-режим
  // и пытается прочитать несуществующий тестовый файл.
  const pdfParse = require('pdf-parse/lib/pdf-parse.js') as PdfParse;
  return pdfParse;
}

function normalizeExtracted(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await loadPdfParse()(buffer);
    const text = normalizeExtracted(data.text ?? '');
    if (!text) {
      throw new ExtractionError(
        'В PDF не найден текст. Возможно, это скан — загрузите его как фото.',
        'empty',
      );
    }
    return text;
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    logger.warn({ error }, 'не удалось разобрать PDF');
    throw new ExtractionError(
      'Не удалось прочитать PDF. Проверьте, что файл не повреждён и не защищён паролем.',
      'pdf',
    );
  }
}

export async function extractDocx(buffer: Buffer): Promise<string> {
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    const text = normalizeExtracted(value ?? '');
    if (!text) {
      throw new ExtractionError('В документе не найден текст.', 'empty');
    }
    return text;
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    logger.warn({ error }, 'не удалось разобрать DOCX');
    throw new ExtractionError('Не удалось прочитать DOCX. Проверьте, что файл не повреждён.', 'docx');
  }
}

let ocrWorkerPromise: Promise<import('tesseract.js').Worker> | null = null;

async function getOcrWorker(lang: string) {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker(lang, undefined, { logger: () => {} });
    })().catch((error) => {
      ocrWorkerPromise = null;
      throw error;
    });
  }
  return ocrWorkerPromise;
}

export async function extractImage(buffer: Buffer, lang: string): Promise<string> {
  try {
    const worker = await getOcrWorker(lang);
    const { data } = await worker.recognize(buffer);
    const text = normalizeExtracted(data.text ?? '');
    if (!text) {
      throw new ExtractionError(
        'На фото не удалось распознать текст. Сделайте снимок чётче и ровнее.',
        'empty',
      );
    }
    return text;
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    logger.error({ error }, 'ошибка OCR');
    throw new ExtractionError(
      'Сервис распознавания недоступен. Попробуйте ещё раз или вставьте текст вручную.',
      'ocr',
    );
  }
}

export function detectKind(filename: string, mimetype: string): 'pdf' | 'docx' | 'image' | null {
  const lower = filename.toLowerCase();
  if (mimetype === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  ) {
    return 'docx';
  }
  if (
    mimetype.startsWith('image/') ||
    /\.(jpe?g|png|webp|bmp|heic)$/.test(lower)
  ) {
    return 'image';
  }
  return null;
}
