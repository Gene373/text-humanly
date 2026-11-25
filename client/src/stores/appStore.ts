import { create } from 'zustand';
import type { Level, Usage, User } from '../api/client';

export type Screen = 'form' | 'processing' | 'result' | 'limit' | 'rejected';

interface AppState {
  user: User | null;
  usage: Usage | null;
  text: string;
  level: Level;
  result: string;
  screen: Screen;
  error: string | null;
  engine: 'llm' | 'local' | null;

  setUser: (user: User | null) => void;
  setUsage: (usage: Usage | null) => void;
  setText: (text: string) => void;
  setLevel: (level: Level) => void;
  setScreen: (screen: Screen) => void;
  setError: (error: string | null) => void;
  setResult: (result: string, engine: 'llm' | 'local') => void;
  resetToForm: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  usage: null,
  text: '',
  level: 'slightly_simpler',
  result: '',
  screen: 'form',
  error: null,
  engine: null,

  setUser: (user) => set({ user }),
  setUsage: (usage) => set({ usage }),
  setText: (text) => set({ text }),
  setLevel: (level) => set({ level }),
  setScreen: (screen) => set({ screen }),
  setError: (error) => set({ error }),
  setResult: (result, engine) => set({ result, engine, screen: 'result', error: null }),
  resetToForm: () => set({ screen: 'form', error: null }),
}));
