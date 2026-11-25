import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom не реализует эти API, а компоненты их используют.
// Свойства задаются один раз на весь файл setup (он общий для всех тестов).
if (!('scrollTo' in window) || typeof window.scrollTo !== 'function') {
  Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true });
}

if (typeof URL.createObjectURL !== 'function') {
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:mock'),
    configurable: true,
    writable: true,
  });
}

if (typeof URL.revokeObjectURL !== 'function') {
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
    writable: true,
  });
}

// clipboard переустанавливаем перед каждым тестом: restoreAllMocks в afterEach
// снимает мок, и в следующем тесте он снова нужен рабочим.
beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
