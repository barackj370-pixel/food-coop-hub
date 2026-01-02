
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

console.log("System: Starting Hub Engine...");

const rootElement = document.getElementById('root');

const hideLoader = () => {
  const loader = document.getElementById('loading-screen');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => {
      if (loader.parentNode) loader.parentNode.removeChild(loader);
    }, 600);
  }
};

const init = () => {
  if (!rootElement) {
    console.error("System: #root target missing.");
    return;
  }

  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    
    // Hide loader once the rendering cycle has been initiated.
    // We use a small timeout to allow React 19 to perform the initial paint.
    setTimeout(() => {
      console.log("System: App mounting initiated.");
      hideLoader();
    }, 300);

  } catch (err) {
    console.error("System: Initialization crashed:", err);
    hideLoader();
  }
};

// Ensure DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
