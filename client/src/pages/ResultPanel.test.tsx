import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultPanel } from '../pages/ResultPanel';
import { useAppStore } from '../stores/appStore';

describe('ResultPanel', () => {
  it('рендерит заголовки, списки и формулы', () => {
    useAppStore.setState({
      result: '## Раздел\n\nОбычный абзац.\n\n- пункт один\n- пункт два\n\nФормула: $E = mc^2$',
      engine: 'local',
      screen: 'result',
    });

    render(<ResultPanel onToast={() => {}} />);

    expect(screen.getByRole('heading', { name: 'Раздел' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('E = mc^2')).toBeInTheDocument();
  });

  it('копирует текст и сообщает об успехе', async () => {
    useAppStore.setState({ result: 'Простой текст.', engine: 'llm', screen: 'result' });
    const onToast = vi.fn();
    // userEvent подменяет navigator.clipboard своим стабом, поэтому
    // проверяем итоговое содержимое буфера обмена, а не сам вызов.
    const user = userEvent.setup();

    render(<ResultPanel onToast={onToast} />);
    await user.click(screen.getByRole('button', { name: /Копировать/ }));

    expect(await navigator.clipboard.readText()).toBe('Простой текст.');
    expect(onToast).toHaveBeenCalledWith('Текст скопирован', 'success');
    expect(await screen.findByRole('button', { name: /Скопировано/ })).toBeInTheDocument();
  });

  it('возвращает к вводу нового текста', async () => {
    useAppStore.setState({ result: 'Текст.', engine: 'llm', screen: 'result' });
    const user = userEvent.setup();

    render(<ResultPanel onToast={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Упростить другой текст/ }));

    expect(useAppStore.getState().screen).toBe('form');
  });

  it('показывает подпись движка', () => {
    useAppStore.setState({ result: 'Текст.', engine: 'local', screen: 'result' });
    render(<ResultPanel onToast={() => {}} />);
    expect(screen.getByText(/встроенным алгоритмом/i)).toBeInTheDocument();
  });
});
