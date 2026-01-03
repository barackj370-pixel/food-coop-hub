import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const boot = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  try {
    // Notify window for boot logging
    if ((window as any).BOOT_LOG) (window as any).BOOT_LOG.push(`${new Date().toLocaleTimeString()} - React Mount Started`);
    
    const root = createRoot(rootElement);
    
    const RootWrapper = () => {
      React.useEffect(() => {
        if ((window as any).BOOT_LOG) (window as any).BOOT_LOG.push(`${new Date().toLocaleTimeString()} - App Ready`);
        if ((window as any).hideHubLoader) {
          setTimeout((window as any).hideHubLoader, 100);
        }
      }, []);
      return <App />;
    };

    root.render(<RootWrapper />);
    
  } catch (err) {
    console.error("Critical Mount Failure:", err);
    if ((window as any).hideHubLoader) (window as any).hideHubLoader();
    
    rootElement.innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: sans-serif;">
        <h2 style="color: #ef4444;">Bootstrap Failure</h2>
        <p style="color: #64748b;">${err instanceof Error ? err.message : 'Unknown error during React mount'}</p>
        <button onclick="location.reload()" style="background:#022c22; color:white; padding:10px 20px; border-radius:8px; border:none; cursor:pointer;">Retry</button>
      </div>
    `;
  }
};

// Start the engine
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
