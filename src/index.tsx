import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App1';
import { UserProvider } from "./Usercontext";

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <UserProvider>
      <App />
    </UserProvider>
  </React.StrictMode>
);
