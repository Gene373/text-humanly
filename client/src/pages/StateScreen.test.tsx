import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StateScreen } from '../pages/StateScreen';

describe('StateScreen', () => {
  it('показывает экран исчерпанного лимита', () => {
    render(<StateScreen kind="limit" resetsAt="2026-11-25T00:00:00.000Z" onBack={() => {}} />);

    expect(screen.getByRole('heading', { name: 'На сегодня всё' })).toBeInTheDocument();
    expect(screen.getByText(/Новые попытки появятся/)).toBeInTheDocument();
  });

  it('показывает экран отказа контента', () => {
    render(<StateScreen kind="rejected" onBack={() => {}} />);

    expect(
      screen.getByRole('heading', { name: 'Этот текст не получится упростить' }),
    ).toBeInTheDocument();
  });

  it('возвращает к форме по кнопке', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<StateScreen kind="rejected" onBack={onBack} />);

    await user.click(screen.getByRole('button', { name: 'Вернуться к вводу' }));
    expect(onBack).toHaveBeenCalled();
  });
});
