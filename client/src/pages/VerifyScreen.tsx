import { useEffect, useState } from 'react';
import { ApiError, verifyLogin } from '../api/client';
import { Logo } from '../components/Logo';
import { useAppStore } from '../stores/appStore';

export function VerifyScreen() {
  const setUser = useAppStore((state) => state.setUser);
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [message, setMessage] = useState('Проверяем ссылку…');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') ?? '';

    if (!token) {
      setStatus('error');
      setMessage('В ссылке нет токена. Запросите новую ссылку для входа.');
      return;
    }

    verifyLogin(token)
      .then((response) => {
        setUser(response.user);
        window.location.replace('/');
      })
      .catch((error) => {
        setStatus('error');
        setMessage(
          error instanceof ApiError
            ? error.message
            : 'Ссылка недействительна. Запросите новую ссылку для входа.',
        );
      });
  }, [setUser]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>

      <div className="card w-full px-6 py-10 text-center">
        {status === 'loading' ? (
          <>
            <div
              className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-primary-soft border-t-primary"
              role="status"
              aria-label="Проверяем ссылку"
            />
            <p className="mt-4 text-[16px] leading-6 text-ink-muted">{message}</p>
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-semibold leading-7">Ссылка не сработала</h1>
            <p className="mx-auto mt-3 max-w-[340px] text-[16px] leading-[26px] text-ink-muted">
              {message}
            </p>
            <a href="/" className="btn-primary mt-7 w-full">
              Запросить новую ссылку
            </a>
          </>
        )}
      </div>
    </main>
  );
}
