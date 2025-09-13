import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import './index.css';
import { UserProvider } from "./Usercontext";
import { SnackbarProvider } from 'notistack';
import { ThemeProvider, createTheme } from '@mui/material/styles';
// get base URL string from base property in vite.config.ts
const base = import.meta.env.BASE_URL;

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const theme = createTheme({
  palette: {
    // 例: primaryカラーをカスタマイズ
    // primary: {
    //   main: '#1976d2',
    // },
  },
});
root.render(
  <React.StrictMode>
    <BrowserRouter basename={base}>
      <UserProvider>
        {/* --- ▼▼▼ theme={theme} を渡す ▼▼▼ --- */}
        <ThemeProvider theme={theme}>
          <SnackbarProvider maxSnack={3} autoHideDuration={5000}>
            {/* AppとAppRoutesが兄弟になっているのはおそらく間違いです。
                通常はAppコンポーネント内でルーティングを処理します。*/}
            <AppRoutes />
          </SnackbarProvider>
        </ThemeProvider>
      </UserProvider>
    </BrowserRouter>
  </React.StrictMode>
);