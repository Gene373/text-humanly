// Плоские 2D-векторные иллюстрации в палитре приложения.
// Стиль: тонкие контуры, закруглённые формы, много воздуха.
// Все декоративные элементы скрыты от скринридеров.

const ACCENT = '#2F5BEA';
const SOFT = '#EAEFFF';
const MUTED = '#6B7280';
const BORDER = '#E3E6ED';
const SUCCESS = '#1F9D6B';
const SUCCESS_SOFT = '#E4F4EC';
const DANGER = '#D64545';
const DANGER_SOFT = '#FBEAEA';

interface IllustrationProps {
  className?: string;
}

export function ReadingIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 240 160"
      className={className}
      role="img"
      aria-label="Человек читает учебный текст"
      fill="none"
    >
      <ellipse cx="120" cy="146" rx="88" ry="8" fill={SOFT} />
      <rect x="52" y="44" width="136" height="92" rx="10" fill={SOFT} />
      <rect x="64" y="30" width="112" height="92" rx="8" fill="#fff" stroke={BORDER} strokeWidth="2" />
      <rect x="78" y="48" width="62" height="6" rx="3" fill={ACCENT} opacity="0.9" />
      <rect x="78" y="64" width="84" height="5" rx="2.5" fill={BORDER} />
      <rect x="78" y="78" width="72" height="5" rx="2.5" fill={BORDER} />
      <rect x="78" y="92" width="80" height="5" rx="2.5" fill={BORDER} />
      <rect x="78" y="106" width="46" height="5" rx="2.5" fill={SUCCESS} opacity="0.7" />
      <circle cx="188" cy="52" r="16" fill={SOFT} />
      <path d="M188 44v16M180 52h16" stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="46" cy="112" r="9" fill={SOFT} />
      <circle cx="202" cy="118" r="6" fill={SOFT} />
    </svg>
  );
}

export function TransformIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 240 160"
      className={className}
      role="img"
      aria-label="Сложный текст превращается в понятный"
      fill="none"
    >
      <ellipse cx="120" cy="146" rx="86" ry="8" fill={SOFT} />
      <rect x="26" y="38" width="76" height="92" rx="8" fill="#fff" stroke={BORDER} strokeWidth="2" />
      <rect x="38" y="54" width="52" height="5" rx="2.5" fill={MUTED} opacity="0.45" />
      <rect x="38" y="68" width="44" height="5" rx="2.5" fill={MUTED} opacity="0.45" />
      <rect x="38" y="82" width="50" height="5" rx="2.5" fill={MUTED} opacity="0.45" />
      <rect x="38" y="96" width="36" height="5" rx="2.5" fill={MUTED} opacity="0.45" />
      <rect x="38" y="110" width="46" height="5" rx="2.5" fill={MUTED} opacity="0.45" />

      <path d="M110 84h20" stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M124 76l8 8-8 8" stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />

      <rect x="138" y="38" width="76" height="92" rx="8" fill={SUCCESS_SOFT} stroke={SUCCESS} strokeWidth="2" />
      <rect x="150" y="54" width="46" height="6" rx="3" fill={SUCCESS} />
      <rect x="150" y="70" width="52" height="5" rx="2.5" fill={SUCCESS} opacity="0.55" />
      <rect x="150" y="84" width="42" height="5" rx="2.5" fill={SUCCESS} opacity="0.55" />
      <rect x="150" y="98" width="50" height="5" rx="2.5" fill={SUCCESS} opacity="0.55" />
      <rect x="150" y="112" width="34" height="5" rx="2.5" fill={SUCCESS} opacity="0.55" />
    </svg>
  );
}

export function LimitIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 240 160"
      className={className}
      role="img"
      aria-label="Часы: попытки на сегодня закончились"
      fill="none"
    >
      <ellipse cx="120" cy="146" rx="76" ry="8" fill={SOFT} />
      <circle cx="120" cy="80" r="48" fill="#fff" stroke={BORDER} strokeWidth="3" />
      <circle cx="120" cy="80" r="38" fill={SOFT} />
      <path d="M120 60v22l14 10" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="120" cy="80" r="4" fill={ACCENT} />
      <rect x="106" y="20" width="28" height="8" rx="4" fill={ACCENT} opacity="0.85" />
      <circle cx="66" cy="52" r="5" fill={SOFT} />
      <circle cx="178" cy="112" r="7" fill={SOFT} />
      <circle cx="182" cy="48" r="4" fill={SOFT} />
    </svg>
  );
}

export function RejectedIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 240 160"
      className={className}
      role="img"
      aria-label="Щит: текст не прошёл проверку"
      fill="none"
    >
      <ellipse cx="120" cy="146" rx="74" ry="8" fill={SOFT} />
      <path
        d="M120 26l40 14v34c0 26-17 44-40 54-23-10-40-28-40-54V40l40-14z"
        fill="#fff"
        stroke={BORDER}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M120 38l29 10v26c0 19-12 32-29 40-17-8-29-21-29-40V48l29-10z"
        fill={DANGER_SOFT}
      />
      <path d="M120 62v20" stroke={DANGER} strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="120" cy="92" r="2.4" fill={DANGER} />
      <circle cx="54" cy="60" r="5" fill={SOFT} />
      <circle cx="188" cy="104" r="6" fill={SOFT} />
      <circle cx="186" cy="50" r="4" fill={SOFT} />
    </svg>
  );
}

export function EmptyInputIllustration({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 240 120"
      className={className}
      role="img"
      aria-label="Пустое поле ввода"
      fill="none"
    >
      <rect x="40" y="26" width="160" height="70" rx="10" fill="#fff" stroke={BORDER} strokeWidth="2" />
      <rect x="58" y="46" width="70" height="6" rx="3" fill={BORDER} />
      <rect x="58" y="62" width="96" height="6" rx="3" fill={BORDER} />
      <rect x="58" y="78" width="52" height="6" rx="3" fill={BORDER} />
      <circle cx="172" cy="34" r="10" fill={SOFT} />
      <path d="M172 29v10M167 34h10" stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="34" cy="96" r="6" fill={SOFT} />
      <circle cx="206" cy="22" r="4" fill={SOFT} />
    </svg>
  );
}
