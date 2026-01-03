
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

console.log("System: Hub Engine Booting...");

const RootComponent = () => {
  React.useEffect(() => {
    // Explicitly notify the system we are running
    if ((window as any).hideHubLoader) {
      setTimeout((window as any).hideHubLoader, 300);
    }
  }, []);

  return <App />;
};

const mount = () => {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    console.error("System Failure: #root missing.");
    return;
  }

  try {
    const root = createRoot(rootElement);
    root.render(<RootComponent />);
    console.log("System: React reconciliation started.");
  } catch (err) {
    console.error("System Failure: Mount failed", err);
    // Visual error report for the user if hosting fails to run modules correctly
    rootElement.innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: sans-serif;">
        <h2 style="color: #ef4444;">Initialization Error</h2>
        <p style="color: #64748b;">${err instanceof Error ? err.message : 'Unknown bootstrap error'}</p>
        <button onclick="location.reload()" style="background:#022c22; color:white; padding:10px 20px; border-radius:8px; border:none; cursor:pointer;">Retry</button>
      </div>
    `;
    if ((window as any).hideHubLoader) (window as any).hideHubLoader();
  }
};

// Handle ready state correctly
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
