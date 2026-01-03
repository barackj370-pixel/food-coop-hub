
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

// Log for debugging visibility
console.log("System: Hub UI Rendering...");

const startApplication = () => {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    console.error("System Failure: #root element missing in DOM.");
    return;
  }

  try {
    const root = createRoot(rootElement);
    root.render(<App />);
    console.log("System: Render successfully dispatched.");
  } catch (err) {
    console.error("System Failure: Could not mount React tree.", err);
  }
};

// Initiate boot process
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApplication);
} else {
  startApplication();
}
