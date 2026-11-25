import { LimitIllustration, RejectedIllustration } from '../components/illustrations';

interface StateScreenProps {
  kind: 'limit' | 'rejected';
  resetsAt?: string;
  onBack: () => void;
}

function formatReset(resetsAt?: string): string {
  if (!resetsAt) return 'Новые попытки появятся завтра.';
  const date = new Date(resetsAt);
  const formatted = date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `Новые попытки появятся ${formatted}.`;
}

export function StateScreen({ kind, resetsAt, onBack }: StateScreenProps) {
  const isLimit = kind === 'limit';

  return (
    <section className="card fade-in-up px-6 py-10 text-center" role="status" aria-live="polite">
      <div className="mx-auto mb-2 w-full max-w-[240px]">
        {isLimit ? (
          <LimitIllustration className="h-auto w-full" />
        ) : (
          <RejectedIllustration className="h-auto w-full" />
        )}
      </div>

      <h2 className="text-[24px] font-semibold leading-8">
        {isLimit ? 'На сегодня всё' : 'Этот текст не получится упростить'}
      </h2>

      <p className="mx-auto mt-3 max-w-[380px] text-[16px] leading-[26px] text-ink-muted">
        {isLimit
          ? `Вы использовали все попытки на сегодня. ${formatReset(resetsAt)}`
          : 'Похоже, текст содержит то, что мы не обрабатываем. Попробуйте другой фрагмент — например, из учебника или статьи.'}
      </p>

      <button type="button" onClick={onBack} className="btn-primary mt-8 w-full sm:w-auto">
        {isLimit ? 'Понятно' : 'Вернуться к вводу'}
      </button>
    </section>
  );
}
