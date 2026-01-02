import React from 'react';
import ReactDOM from 'react-dom/client';
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
    throw new Error("Could not find root element to mount to");
  }

  const root = ReactDOM.createRoot(rootElement);
  
  try {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    // Hide loading screen shortly after render starts
    setTimeout(hideLoader, 500);
  } catch (err) {
    console.error("Rendering error:", err);
    hideLoader();
    // Re-throw to be caught by the outer block
    throw err;
  }
};

try {
  renderApp();
} catch (err) {
  console.error("Initialization error:", err);
  hideLoader();
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 2rem; color: #ef4444; font-family: sans-serif; text-align: center;">
        <h1 style="font-size: 1.5rem; font-weight: bold;">System Initialization Error</h1>
        <p style="margin-top: 1rem;">${err instanceof Error ? err.message : 'Unknown error occurred'}</p>
        <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #064e3b; color: white; border-radius: 0.5rem; border: none; cursor: pointer;">Retry Application</button>
      </div>
    `;
  }
}