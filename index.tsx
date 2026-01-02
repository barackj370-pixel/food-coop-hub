
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const hideLoader = () => {
  const loader = document.getElementById('loading-screen');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 500);
  }
};

const renderApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("Critical: #root element missing");
    return;
  }

  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    // Success - hide loader
    console.log("App mount initiated successfully");
    // We wait a bit for React to actually start the initial render cycle
    setTimeout(hideLoader, 800);
  } catch (err) {
    console.error("Rendering error:", err);
    hideLoader();
    rootElement.innerHTML = `
      <div style="padding: 2rem; color: #ef4444; font-family: sans-serif; text-align: center;">
        <h1 style="font-size: 1.5rem; font-weight: bold;">Render Error</h1>
        <p style="margin-top: 1rem;">${err instanceof Error ? err.message : 'Unknown error'}</p>
        <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #064e3b; color: white; border-radius: 0.5rem; border: none; cursor: pointer;">Retry System</button>
      </div>
    `;
  }
};

// Check for module load errors - common on GitHub Pages
window.addEventListener('error', (event) => {
  const isImportError = event.message.toLowerCase().includes('import') || event.message.toLowerCase().includes('syntaxerror');
  if (isImportError) {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="padding: 2rem; color: #f59e0b; font-family: sans-serif; text-align: center; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 1rem;">
          <h1 style="font-size: 1.5rem; font-weight: bold;">Module Loading Alert</h1>
          <p style="margin-top: 1rem;">The application is failing to load its logic files. If you are viewing this on GitHub Pages, ensure your browser supports ESM and that the .tsx files are being served correctly.</p>
          <p style="font-size: 0.8rem; color: #666; font-family: monospace; margin-top: 10px;">Debug Info: ${event.message}</p>
        </div>
      `;
    }
    hideLoader();
  }
});

try {
  renderApp();
} catch (err) {
  console.error("Initialization error:", err);
  hideLoader();
}
