import { useEffect, useState } from 'react';
import { fetchMe } from './api/client';
import { LoginScreen } from './pages/LoginScreen';
import { MainScreen } from './pages/MainScreen';
import { VerifyScreen } from './pages/VerifyScreen';
import { useAppStore } from './stores/appStore';

function isVerifyRoute(pathname: string) {
  return pathname === '/auth/verify' || pathname.startsWith('/auth/verify/');
}

export default function App() {
  const { user, setUser } = useAppStore();
  const [checking, setChecking] = useState(true);
  const [verifyMode] = useState(() => isVerifyRoute(window.location.pathname));

  useEffect(() => {
    if (verifyMode) {
      setChecking(false);
      return;
    }

    fetchMe()
      .then((response) => setUser(response.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, [setUser, verifyMode]);

  if (verifyMode) return <VerifyScreen />;

  if (checking) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div
          className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary-soft border-t-primary"
          role="status"
          aria-label="Загрузка"
        />
      </main>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        onDevLogin={(url) => {
          // В dev-режиме без SMTP подсказываем пользователю ссылку в консоли.
          console.info('Ссылка для входа:', url);
        }}
      />
    );
  }

  return <MainScreen />;
}
