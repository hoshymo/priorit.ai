import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import './index.css';
import { UserProvider } from "./Usercontext";

// get base URL string from base property in vite.config.ts
const base = import.meta.env.BASE_URL;

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <BrowserRouter basename={base}>
      <UserProvider>
        <AppRoutes />
      </UserProvider>
    </BrowserRouter>
  </React.StrictMode>
);
