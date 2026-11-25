// Генерирует валидные PDF (с кириллицей) и DOCX для ручной проверки загрузки.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const root = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(root, '..', 'tmp-samples');
mkdirSync(outDir, { recursive: true });

const paragraphs = [
  'В настоящее время в связи с тем, что осуществляется процесс оптимизации образовательного процесса, необходимо отметить, что данный подход является достаточно эффективным.',
  'Исследование 2023 года показало рост успеваемости на 15% среди студентов МГУ.',
  'Ключевые выводы:',
  '• Данный метод является основой обучения.',
  '• Оптимизация процессов происходит в течение учебного года.',
];

// --- PDF ---
async function buildPdf(): Promise<void> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
  });

  doc.registerFont('Cyrillic', 'C:/Windows/Fonts/arial.ttf');
  doc.font('Cyrillic').fontSize(14).text('Лекция 1. Оптимизация обучения', { underline: true });
  doc.moveDown();
  doc.fontSize(11);
  for (const paragraph of paragraphs) {
    doc.text(paragraph);
    doc.moveDown(0.6);
  }
  doc.end();

  writeFileSync(path.join(outDir, 'sample.pdf'), await done);
}

// --- DOCX ---
async function buildDocx(content: string): Promise<void> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${content}</w:t></w:r></w:p>
  </w:body>
</w:document>`,
  );

  writeFileSync(
    path.join(outDir, 'sample.docx'),
    await zip.generateAsync({ type: 'nodebuffer' }),
  );
}

await buildPdf();
await buildDocx(paragraphs.join(' '));
console.log('готово:', outDir);
