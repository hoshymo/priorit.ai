import React from 'react';

export type ThemeMode = 'light' | 'dark';

export const ThemeContext = React.createContext<{
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
} | null>(null);
