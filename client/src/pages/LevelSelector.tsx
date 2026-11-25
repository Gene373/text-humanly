import type { Level } from '../api/client';

interface LevelSelectorProps {
  value: Level;
  onChange: (level: Level) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{ id: Level; title: string; hint: string }> = [
  {
    id: 'slightly_simpler',
    title: 'Чуть проще',
    hint: 'Убираем канцелярит, но сохраняем академический тон и термины.',
  },
  {
    id: 'beginner',
    title: 'Как для новичка',
    hint: 'Совсем простой язык, короткие предложения, термины с пояснением.',
  },
];

export function LevelSelector({ value, onChange, disabled }: LevelSelectorProps) {
  return (
    <section className="card p-4 sm:p-6" aria-labelledby="level-heading">
      <h2 id="level-heading" className="mb-4 text-[18px] font-semibold leading-[26px]">
        Насколько упростить
      </h2>

      <div role="radiogroup" aria-labelledby="level-heading" className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={`flex items-start gap-3 rounded-btn border-2 p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                selected
                  ? 'border-primary bg-primary-soft'
                  : 'border-border bg-surface hover:border-primary/40'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected ? 'border-primary' : 'border-border'
                }`}
                aria-hidden
              >
                {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </span>
              <span>
                <span className="block text-[15px] font-semibold leading-5">{option.title}</span>
                <span className="mt-1 block text-[13px] leading-[18px] text-ink-muted">
                  {option.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
