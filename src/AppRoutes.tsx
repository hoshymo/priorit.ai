import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, useMediaQuery } from '@mui/material';
import { ThemeContext } from './ThemeContext';
import MainPage from './App1';
import SettingsPage from './Settings';

function AppRoutes() {
  // light/dark mode
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = React.useState<'light' | 'dark'>(
    prefersDarkMode ? 'dark' : 'light'
  );
  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          // background: {
          //   default: mode === 'light' ? '#f5f5f5' : '#121212',
          // },
        },
      }),
    [mode]
  );

  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />

        <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/settings" element={<SettingsPage />} />
        </Routes>

      </ThemeProvider>
    </ThemeContext.Provider>
  );
}

export default AppRoutes;
