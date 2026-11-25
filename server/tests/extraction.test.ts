import { describe, expect, it } from 'vitest';
import { detectKind } from '../src/services/extraction.ts';

describe('detectKind', () => {
  it('распознаёт PDF по MIME и расширению', () => {
    expect(detectKind('lecture.pdf', 'application/pdf')).toBe('pdf');
    expect(detectKind('lecture.pdf', 'application/octet-stream')).toBe('pdf');
  });

  it('распознаёт DOCX', () => {
    const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    expect(detectKind('notes.docx', mime)).toBe('docx');
    expect(detectKind('notes.docx', '')).toBe('docx');
  });

  it('распознаёт изображения', () => {
    expect(detectKind('photo.jpg', 'image/jpeg')).toBe('image');
    expect(detectKind('scan.png', 'image/png')).toBe('image');
    expect(detectKind('scan.webp', 'image/webp')).toBe('image');
    expect(detectKind('scan.png', '')).toBe('image');
  });

  it('возвращает null для неподдерживаемых файлов', () => {
    expect(detectKind('archive.zip', 'application/zip')).toBeNull();
    expect(detectKind('notes.txt', 'text/plain')).toBeNull();
    expect(detectKind('old.doc', 'application/msword')).toBeNull();
  });
});
