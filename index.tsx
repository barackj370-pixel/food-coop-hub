
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

console.log("Bootstrap: index.tsx loaded. Initializing React...");

const hideLoader = () => {
  const loader = document.getElementById('loading-screen');
  if (loader) {
    console.log("Bootstrap: Transitioning loader UI...");
    loader.style.opacity = '0';
    setTimeout(() => {
      if (loader.parentNode) loader.parentNode.removeChild(loader);
    }, 500);
  }
};

const renderApp = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("Critical: #root element not found in DOM.");
    return;
  }

  try {
    const root = createRoot(rootElement);
    console.log("Bootstrap: Root created, rendering App...");
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    
    // Check if App rendered successfully by looking for content after a delay
    setTimeout(() => {
      if (rootElement.hasChildNodes()) {
        console.log("Bootstrap: Success. DOM populated.");
        hideLoader();
      } else {
        console.warn("Bootstrap: Root element empty after render call.");
      }
    }, 100);
  } catch (err) {
    console.error("Critical Rendering Error:", err);
    hideLoader();
    rootElement.innerHTML = `
      <div style="padding: 2rem; color: #ef4444; font-family: sans-serif; text-align: center; border: 2px solid #fee2e2; border-radius: 20px; margin: 40px;">
        <h1 style="font-size: 1.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: -0.025em;">Engine Crash</h1>
        <p style="margin-top: 1rem; color: #64748b; font-weight: 500;">The React engine encountered a fatal exception during mount.</p>
        <p style="margin-top: 1rem; font-family: monospace; font-size: 12px; background: #f8fafc; padding: 10px; border-radius: 8px;">${err instanceof Error ? err.message : 'Unknown'}</p>
        <button onclick="location.reload()" style="margin-top: 1.5rem; padding: 12px 24px; background: #064e3b; color: white; border-radius: 12px; border: none; cursor: pointer; font-weight: 900; font-size: 12px; text-transform: uppercase;">Restart System</button>
      </div>
    `;
  }
};

// Initiate
renderApp();
