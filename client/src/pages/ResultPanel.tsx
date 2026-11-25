import { useMemo, useState } from 'react';
import { Check, Copy, Download, RotateCcw } from 'lucide-react';
import { useAppStore } from '../stores/appStore';

// Минимальный рендер сохранённой структуры: заголовки, списки, формулы.
function renderLine(line: string, key: number) {
  const heading = line.match(/^(#{1,6})\s+(.*)$/);
  if (heading) {
    const size = heading[1].length <= 2 ? 'text-[22px] leading-8' : 'text-[18px] leading-7';
    return (
      <h3 key={key} className={`mt-6 mb-2 font-semibold ${size}`}>
        {heading[2]}
      </h3>
    );
  }

  const listItem = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
  if (listItem) {
    return (
      <li key={key} className="ml-5 list-disc pl-1">
        {renderInline(listItem[1])}
      </li>
    );
  }

  if (!line.trim()) return <div key={key} className="h-3" aria-hidden />;

  return (
    <p key={key} className="mb-3">
      {renderInline(line)}
    </p>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\$[^$]+\$)/g);
  return parts.map((part, index) =>
    part.startsWith('$') && part.endsWith('$') && part.length > 2 ? (
      <code
        key={index}
        className="rounded-md bg-primary-soft px-1.5 py-0.5 font-mono text-[15px] text-primary"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export function ResultPanel({
  onToast,
}: {
  onToast: (message: string, kind?: 'success' | 'error') => void;
}) {
  const { result, engine, resetToForm } = useAppStore();
  const [copied, setCopied] = useState(false);

  const lines = useMemo(() => result.split('\n'), [result]);
  const isEmpty = result.trim().length === 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      onToast('Текст скопирован', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast('Не удалось скопировать. Выделите текст вручную.', 'error');
    }
  };

  const download = () => {
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'упрощённый-текст.txt';
    anchor.click();
    URL.revokeObjectURL(url);
    onToast('Файл сохранён', 'success');
  };

  return (
    <section
      className="card fade-in-up overflow-hidden"
      aria-labelledby="result-heading"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success-soft text-success">
            <Check size={15} strokeWidth={3} aria-hidden />
          </span>
          <h2 id="result-heading" className="text-[18px] font-semibold leading-[26px]">
            Понятным языком
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={copy} className="btn-ghost" disabled={isEmpty}>
            {copied ? <Check size={17} aria-hidden /> : <Copy size={17} aria-hidden />}
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
          <button type="button" onClick={download} className="btn-ghost" disabled={isEmpty}>
            <Download size={17} aria-hidden />
            Скачать .txt
          </button>
        </div>
      </div>

      <div className="bg-success-soft/40 px-4 py-5 sm:px-6">
        <div className="font-serif text-[16px] leading-[27px] text-ink">
          {isEmpty ? (
            <p className="text-ink-muted">Пока пусто — введите текст и нажмите «Упростить».</p>
          ) : (
            <div className="[&_li]:mb-1.5">{lines.map((line, index) => renderLine(line, index))}</div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-6">
        <p className="text-[13px] leading-[18px] text-ink-muted">
          {engine === 'local'
            ? 'Обработано встроенным алгоритмом упрощения.'
            : 'Обработано языковой моделью. Проверьте важные детали при необходимости.'}
        </p>
        <button type="button" onClick={resetToForm} className="btn-outline">
          <RotateCcw size={17} aria-hidden />
          Упростить другой текст
        </button>
      </div>
    </section>
  );
}
