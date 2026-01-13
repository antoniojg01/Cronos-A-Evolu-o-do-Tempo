
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);

// Remove o loader após a aplicação ser renderizada
setTimeout(() => {
  if (typeof window !== 'undefined' && (window as any).hideAppLoader) {
    (window as any).hideAppLoader();
  }
}, 100);