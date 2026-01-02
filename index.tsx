import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const renderApp = () => {
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

  // Hide loading screen after rendering starts
  setTimeout(() => {
    const loader = document.getElementById('loading-screen');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 500);
    }
  }, 200);
};

try {
  renderApp();
} catch (err) {
  console.error("Mounting error:", err);
  if ((window as any).showError) {
    (window as any).showError("Mounting Error", err);
  }
}