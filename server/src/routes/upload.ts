import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.ts';
import { requireAuth } from '../middleware/auth.ts';
import { ApiError } from '../middleware/errors.ts';
import {
  detectKind,
  ExtractionError,
  extractDocx,
  extractImage,
  extractPdf,
} from '../services/extraction.ts';

export const uploadRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
});

function handleMulterError(error: unknown) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new ApiError(413, 'file_too_large', 'Файл больше 20 МБ. Загрузите файл поменьше.');
    }
    return new ApiError(400, 'upload_error', 'Не удалось загрузить файл.');
  }
  return error;
}

uploadRouter.post('/upload', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, async (uploadError) => {
    try {
      if (uploadError) throw handleMulterError(uploadError);

      const file = req.file;
      if (!file) throw new ApiError(400, 'no_file', 'Файл не приложен.');

      const kind = detectKind(file.originalname, file.mimetype);
      if (!kind) {
        throw new ApiError(
          415,
          'unsupported_type',
          'Поддерживаются PDF, DOCX и изображения (JPG, PNG, WebP).',
        );
      }

      let text = '';
      if (kind === 'pdf') text = await extractPdf(file.buffer);
      if (kind === 'docx') text = await extractDocx(file.buffer);
      if (kind === 'image') text = await extractImage(file.buffer, config.ocrLang);

      const truncated = text.length > config.maxTextLength;
      const result = truncated ? text.slice(0, config.maxTextLength) : text;

      res.json({
        kind,
        filename: file.originalname,
        text: result,
        truncated,
        length: result.length,
        maxLength: config.maxTextLength,
      });
    } catch (error) {
      if (error instanceof ExtractionError) {
        const status = error.code === 'empty' ? 422 : error.code === 'unsupported' ? 415 : 400;
        next(new ApiError(status, error.code, error.message));
        return;
      }
      next(error);
    }
  });
});
