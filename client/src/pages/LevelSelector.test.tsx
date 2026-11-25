import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LevelSelector } from '../pages/LevelSelector';

describe('LevelSelector', () => {
  it('показывает оба уровня и отмечает выбранный', () => {
    render(<LevelSelector value="slightly_simpler" onChange={() => {}} />);

    const gentle = screen.getByRole('radio', { name: /Чуть проще/i });
    const beginner = screen.getByRole('radio', { name: /Как для новичка/i });

    expect(gentle).toHaveAttribute('aria-checked', 'true');
    expect(beginner).toHaveAttribute('aria-checked', 'false');
  });

  it('сообщает о смене уровня', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<LevelSelector value="slightly_simpler" onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: /Как для новичка/i }));
    expect(onChange).toHaveBeenCalledWith('beginner');
  });

  it('блокирует переключение при disabled', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<LevelSelector value="beginner" onChange={onChange} disabled />);

    const gentle = screen.getByRole('radio', { name: /Чуть проще/i });
    expect(gentle).toBeDisabled();

    await user.click(gentle);
    expect(onChange).not.toHaveBeenCalled();
  });
});
