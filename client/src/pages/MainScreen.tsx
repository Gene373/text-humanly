import { useCallback, useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import {
  ApiError,
  fetchUsage,
  logout,
  simplifyText as apiSimplify,
  type Usage,
} from '../api/client';
import { Logo } from '../components/Logo';
import { useToast } from '../components/Toast';
import { useAppStore } from '../stores/appStore';
import { InputPanel, MAX_LENGTH } from './InputPanel';
import { LevelSelector } from './LevelSelector';
import { ProcessingScreen } from './ProcessingScreen';
import { ResultPanel } from './ResultPanel';
import { StateScreen } from './StateScreen';

const MIN_TEXT_LENGTH = 10;

function UsageBadge({ usage }: { usage: Usage | null }) {
  if (!usage) return null;

  const exhausted = usage.remaining === 0;
  const low = usage.remaining === 1;

  const tone = exhausted
    ? 'bg-danger-soft text-danger border-transparent'
    : low
      ? 'border-border bg-surface text-danger'
      : 'border-border bg-surface text-ink-muted';

  return (
    <span
      className={`inline-flex min-h-[32px] items-center rounded-pill border px-3 text-[13px] font-medium leading-[18px] ${tone}`}
      aria-live="polite"
    >
      {exhausted
        ? 'Лимит на сегодня исчерпан'
        : `Осталось попыток: ${usage.remaining} из ${usage.limit}`}
    </span>
  );
}

export function MainScreen() {
  const {
    user,
    usage,
    text,
    level,
    screen,
    error,
    setUser,
    setUsage,
    setLevel,
    setScreen,
    setError,
    setResult,
    resetToForm,
  } = useAppStore();

  const toast = useToast();
  const [pending, setPending] = useState(false);

  const refreshUsage = useCallback(async () => {
    try {
      const fresh = await fetchUsage();
      setUsage(fresh);
    } catch {
      // Молча игнорируем: индикатор лимита не критичен для работы формы.
    }
  }, [setUsage]);

  useEffect(() => {
    void refreshUsage();
  }, [refreshUsage]);

  const trimmed = text.trim();
  const tooLong = text.length > MAX_LENGTH;
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_TEXT_LENGTH;
  const limitExhausted = usage !== null && usage.remaining <= 0;
  const canSubmit = trimmed.length >= MIN_TEXT_LENGTH && !tooLong && !pending && !limitExhausted;

  const handleSimplify = async () => {
    if (!canSubmit) return;

    setPending(true);
    setError(null);
    setScreen('processing');

    const startedAt = Date.now();

    try {
      const response = await apiSimplify(trimmed, level);
      const elapsed = Date.now() - startedAt;
      if (elapsed < 700) {
        await new Promise((resolve) => setTimeout(resolve, 700 - elapsed));
      }
      setResult(response.resultText, response.engine);
      setUsage(response.usage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'limit_exhausted') {
          setScreen('limit');
          await refreshUsage();
        } else if (err.code === 'content_rejected' || err.code === 'not_russian') {
          setScreen('rejected');
          await refreshUsage();
        } else {
          setError(err.message);
          setScreen('form');
          toast.show(err.message, 'error');
        }
      } else {
        setError('Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.');
        setScreen('form');
        toast.show('Нет связи с сервером', 'error');
      }
    } finally {
      setPending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setUser(null);
      resetToForm();
    }
  };

  return (
    <div className="min-h-dvh">
      {toast.node}

      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-3 px-4 py-3">
          <Logo compact />
          <div className="flex items-center gap-2">
            <UsageBadge usage={usage} />
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-btn text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              aria-label={`Выйти из аккаунта ${user?.email ?? ''}`}
              title="Выйти"
            >
              <LogOut size={18} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[720px] px-4 pb-16 pt-6 sm:pt-8">
        <h1 className="mb-6 text-[26px] font-bold leading-8 tracking-[-0.02em] sm:text-[32px] sm:leading-10">
          Сделаем текст понятнее
        </h1>

        {screen === 'processing' && <ProcessingScreen />}

        {screen === 'result' && <ResultPanel onToast={toast.show} />}

        {screen === 'limit' && (
          <StateScreen kind="limit" resetsAt={usage?.resetsAt} onBack={resetToForm} />
        )}

        {screen === 'rejected' && <StateScreen kind="rejected" onBack={resetToForm} />}

        {screen === 'form' && (
          <div className="flex flex-col gap-4 sm:gap-6">
            <LevelSelector value={level} onChange={setLevel} disabled={pending} />

            <InputPanel onToast={toast.show} />

            {error && (
              <p
                role="alert"
                className="rounded-btn border border-danger/30 bg-danger-soft px-4 py-3 text-[14px] leading-5 text-danger"
              >
                {error}
              </p>
            )}

            <div>
              <button
                type="button"
                onClick={handleSimplify}
                disabled={!canSubmit}
                className="btn-primary w-full sm:w-auto sm:min-w-[220px]"
              >
                {pending ? 'Обрабатываем…' : 'Упростить'}
              </button>

              <p className="mt-3 text-[13px] leading-[18px] text-ink-muted">
                {limitExhausted
                  ? 'Лимит на сегодня исчерпан — новые попытки появятся завтра.'
                  : tooLong
                    ? `Текст длиннее ${MAX_LENGTH.toLocaleString('ru-RU')} знаков. Сократите его.`
                    : tooShort
                      ? 'Добавьте хотя бы одно полное предложение.'
                      : 'Факты, имена и цифры сохранятся. Структура текста не изменится.'}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
