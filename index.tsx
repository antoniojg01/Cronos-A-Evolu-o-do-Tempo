
import React from 'react';
import ReactDOM from 'react-dom/client';

// Tentativa imediata de esconder o loader antes mesmo de carregar o App.tsx pesado
if ((window as any).hideAppLoader) {
  (window as any).hideAppLoader();
}

import App from './App.tsx';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
