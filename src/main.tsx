import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('CopyX: main.tsx is loading and attempting to render App.');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);