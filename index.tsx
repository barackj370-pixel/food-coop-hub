
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (err) {
  console.error("Mounting error:", err);
  const overlay = document.getElementById('error-overlay');
  if (overlay) {
    overlay.style.display = 'block';
    overlay.innerText += `\n\nMounting Error: ${err.message}`;
  }
}
