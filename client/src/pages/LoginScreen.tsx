import { useState } from 'react';
import { Mail } from 'lucide-react';
import { ApiError, requestLogin } from '../api/client';
import { Logo } from '../components/Logo';
import { ReadingIllustration } from '../components/illustrations';

interface LoginScreenProps {
  onDevLogin: (url: string) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function LoginScreen({ onDevLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [devUrl, setDevUrl] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!EMAIL_RE.test(email.trim())) {
      setError('Введите корректный email, например student@university.ru');
      return;
    }

    setPending(true);
    try {
      const response = await requestLogin(email.trim());
      setSent(true);
      if (response.devLoginUrl) {
        setDevUrl(response.devLoginUrl);
        onDevLogin(response.devLoginUrl);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Не удалось отправить ссылку. Попробуйте ещё раз.',
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center px-4 py-12">
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>

      <div className="card px-6 py-8 sm:px-8">
        <div className="mx-auto mb-6 w-full max-w-[240px]">
          <ReadingIllustration className="h-auto w-full" />
        </div>

        <h1 className="text-center text-[28px] font-bold leading-9 tracking-[-0.02em] sm:text-[32px] sm:leading-10">
          Понятно о сложном
        </h1>
        <p className="mx-auto mt-3 max-w-[320px] text-center text-[16px] leading-[26px] text-ink-muted">
          Упрощаем учебные тексты, сохраняя факты, имена и цифры.
        </p>

        {sent ? (
          <div className="mt-8 rounded-btn bg-success-soft px-4 py-5 text-center">
            <p className="text-[16px] font-semibold leading-6 text-success">Проверьте почту</p>
            <p className="mt-1.5 text-[14px] leading-5 text-ink-muted">
              Мы отправили ссылку для входа на {email}.
            </p>
            {devUrl && (
              <a
                href={devUrl}
                className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-btn bg-surface px-4 text-[14px] font-semibold text-primary shadow-card"
              >
                Открыть ссылку (режим разработки)
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setDevUrl(null);
              }}
              className="btn-ghost mt-2 w-full"
            >
              Ввести другой email
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 flex flex-col gap-4" noValidate>
            <div>
              <label htmlFor="email" className="mb-2 block text-[15px] font-medium">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={18}
                  aria-hidden
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted"
                />
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="student@university.ru"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError(null);
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'email-error' : undefined}
                  className={`field pl-11 ${error ? 'field-error' : ''}`}
                />
              </div>
              {error && (
                <p id="email-error" role="alert" className="mt-2 text-[13px] leading-[18px] text-danger">
                  {error}
                </p>
              )}
            </div>

            <button type="submit" className="btn-primary w-full" disabled={pending}>
              {pending ? 'Отправляем…' : 'Войти'}
            </button>

            <p className="text-center text-[13px] leading-[18px] text-ink-muted">
              Пришлём ссылку для входа — пароль не нужен.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
