import { useEffect, useRef, useState } from 'react';
import { Camera, FileText, Image as ImageIcon, Loader2, Type } from 'lucide-react';
import { ApiError, uploadFile } from '../api/client';
import { useAppStore } from '../stores/appStore';

type Tab = 'text' | 'file' | 'photo';

const TABS: Array<{ id: Tab; label: string; short: string; icon: typeof Type }> = [
  { id: 'text', label: 'Вставить текст', short: 'Текст', icon: Type },
  { id: 'file', label: 'Загрузить файл', short: 'Файл', icon: FileText },
  { id: 'photo', label: 'Загрузить фото', short: 'Фото', icon: ImageIcon },
];

const MAX_LENGTH = 10000;

export function InputPanel({ onToast }: { onToast: (message: string, kind?: 'success' | 'error') => void }) {
  const { text, setText } = useAppStore();
  const [tab, setTab] = useState<Tab>('text');
  const [uploading, setUploading] = useState(false);
  const [fileInfo, setFileInfo] = useState<{ name: string; kind: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const remaining = MAX_LENGTH - text.length;
  const counterTone = remaining < 0 ? 'text-danger' : remaining < 500 ? 'text-danger' : 'text-ink-muted';

  useEffect(() => {
    if (tab === 'text') setFileInfo(null);
  }, [tab]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const response = await uploadFile(file);
      setText(response.text);
      setFileInfo({ name: response.filename, kind: response.kind });
      setTab('text');
      onToast(
        response.truncated
          ? 'Текст распознан, но обрезан до 10 000 знаков'
          : 'Текст из файла добавлен в поле',
        response.truncated ? 'error' : 'success',
      );
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : 'Не удалось обработать файл. Попробуйте ещё раз.';
      onToast(message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (event: React.DragEvent, expected: 'file' | 'photo') => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    if (expected === 'photo' && !isImage) {
      onToast('Для этой вкладки нужна фотография (JPG, PNG, WebP)', 'error');
      return;
    }
    void handleUpload(file);
  };

  return (
    <section className="card p-4 sm:p-6" aria-labelledby="input-heading">
      <h2 id="input-heading" className="mb-4 text-[18px] font-semibold leading-[26px]">
        Текст для упрощения
      </h2>

      <div
        role="tablist"
        aria-label="Способ ввода текста"
        className="mb-4 flex gap-1 rounded-pill bg-bg p-1"
      >
        {TABS.map(({ id, label, short, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              aria-label={label}
              onClick={() => setTab(id)}
              className={`flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-pill px-2 text-[13px] font-medium transition-colors sm:gap-2 sm:px-3 sm:text-[14px] ${
                active
                  ? 'bg-surface font-semibold text-primary shadow-card'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              <Icon size={16} aria-hidden className="shrink-0" />
              <span className="sm:hidden">{short}</span>
              <span className="hidden truncate sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'text' && (
        <div>
          {fileInfo && (
            <div className="mb-3 flex items-center gap-2 rounded-btn bg-success-soft px-3 py-2 text-[13px] leading-[18px] text-ink">
              <FileText size={16} className="shrink-0 text-success" aria-hidden />
              <span className="truncate">{fileInfo.name}</span>
              <span className="text-ink-muted">— текст добавлен</span>
            </div>
          )}

          <label htmlFor="source-text" className="sr-only">
            Введите или вставьте текст
          </label>
          <textarea
            id="source-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Вставьте лекцию, статью или конспект — до 10 000 знаков. Заголовки, списки и формулы сохранятся."
            maxLength={MAX_LENGTH + 500}
            className="field min-h-[150px] resize-y font-serif text-[16px] leading-[27px] sm:min-h-[200px]"
            aria-describedby="char-counter"
          />
          <div id="char-counter" className={`mt-2 text-right text-[13px] leading-[18px] ${counterTone}`}>
            {text.length.toLocaleString('ru-RU')} / {MAX_LENGTH.toLocaleString('ru-RU')}
          </div>
        </div>
      )}

      {tab === 'file' && (
        <div>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => onDrop(event, 'file')}
            className={`flex flex-col items-center justify-center rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary-soft' : 'border-border bg-bg'
            }`}
          >
            {uploading ? (
              <>
                <Loader2 size={28} className="animate-spin text-primary" aria-hidden />
                <p className="mt-3 text-[15px] text-ink-muted" role="status">
                  Читаем документ…
                </p>
              </>
            ) : (
              <>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <FileText size={22} aria-hidden />
                </span>
                <p className="mt-4 text-[15px] leading-6">
                  Перетащите файл сюда или{' '}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    выберите на устройстве
                  </button>
                </p>
                <p className="mt-1.5 text-[13px] leading-[18px] text-ink-muted">
                  PDF или DOCX, до 20 МБ
                </p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
              event.target.value = '';
            }}
          />
        </div>
      )}

      {tab === 'photo' && (
        <div>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => onDrop(event, 'photo')}
            className={`flex flex-col items-center justify-center rounded-card border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary-soft' : 'border-border bg-bg'
            }`}
          >
            {uploading ? (
              <>
                <Loader2 size={28} className="animate-spin text-primary" aria-hidden />
                <p className="mt-3 text-[15px] text-ink-muted" role="status">
                  Распознаём текст…
                </p>
              </>
            ) : (
              <>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Camera size={22} aria-hidden />
                </span>
                <p className="mt-4 text-[15px] leading-6">
                  Сфотографируйте страницу или{' '}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    выберите из галереи
                  </button>
                </p>
                <p className="mt-1.5 text-[13px] leading-[18px] text-ink-muted">
                  JPG, PNG или WebP, до 20 МБ
                </p>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="btn-outline w-full sm:w-auto"
                  >
                    <ImageIcon size={18} aria-hidden />
                    Выбрать фото
                  </button>
                  <label className="btn-primary w-full cursor-pointer sm:w-auto">
                    <Camera size={18} aria-hidden />
                    Сделать фото
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleUpload(file);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </>
            )}
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleUpload(file);
              event.target.value = '';
            }}
          />
        </div>
      )}
    </section>
  );
}

export { MAX_LENGTH };
