import { Loader2 } from 'lucide-react';

export function ProcessingScreen() {
  return (
    <section
      className="card fade-in-up flex flex-col items-center px-6 py-14 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 size={36} className="animate-spin text-primary" aria-hidden />
      <h2 className="mt-5 text-[20px] font-semibold leading-7">Обрабатываем текст…</h2>
      <p className="mt-2 max-w-[320px] text-[15px] leading-6 text-ink-muted">
        Переписываем сложные формулировки и проверяем, что факты, имена и цифры остались на месте.
      </p>

      <div className="mt-8 w-full max-w-[360px] space-y-2.5" aria-hidden>
        {[100, 92, 78, 86, 60].map((width, index) => (
          <div
            key={index}
            className="h-3 animate-pulse rounded-full bg-bg"
            style={{ width: `${width}%`, animationDelay: `${index * 120}ms` }}
          />
        ))}
      </div>
    </section>
  );
}
