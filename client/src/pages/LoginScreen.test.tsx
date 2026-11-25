import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginScreen } from '../pages/LoginScreen';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    requestLogin: vi.fn(),
  };
});

const { requestLogin } = await import('../api/client');

describe('LoginScreen', () => {
  it('показывает ошибку для некорректного email', async () => {
    const user = userEvent.setup();
    render(<LoginScreen onDevLogin={() => {}} />);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/корректный email/i);
    expect(requestLogin).not.toHaveBeenCalled();
  });

  it('отправляет ссылку и показывает подтверждение', async () => {
    vi.mocked(requestLogin).mockResolvedValue({
      ok: true,
      message: 'Проверьте почту',
      devLoginUrl: 'http://localhost/auth/verify?token=abc',
    });

    const onDevLogin = vi.fn();
    const user = userEvent.setup();
    render(<LoginScreen onDevLogin={onDevLogin} />);

    await user.type(screen.getByLabelText('Email'), 'student@university.ru');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByText('Проверьте почту')).toBeInTheDocument();
    expect(screen.getByText(/student@university.ru/)).toBeInTheDocument();
    expect(onDevLogin).toHaveBeenCalledWith('http://localhost/auth/verify?token=abc');
  });

  it('показывает сообщение сервера при ошибке', async () => {
    const { ApiError } = await import('../api/client');
    vi.mocked(requestLogin).mockRejectedValue(new ApiError(429, 'too_many_requests', 'Подождите минуту.'));

    const user = userEvent.setup();
    render(<LoginScreen onDevLogin={() => {}} />);

    await user.type(screen.getByLabelText('Email'), 'student@university.ru');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Подождите минуту.');
  });
});
