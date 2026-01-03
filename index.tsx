
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

// Log to help debugging in the browser console
console.log("System: Hub Engine Booting...");

const init = () => {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    console.error("System: #root target missing in DOM.");
    // Emergency hide if we can't even find root
    if ((window as any).hideHubLoader) (window as any).hideHubLoader();
    return;
  }

  try {
    const root = createRoot(rootElement);
    root.render(<App />);
    
    // Hide loader immediately after starting the render
    // Use a small delay to allow the browser to process the first frame
    setTimeout(() => {
      console.log("System: Hub UI Mounted.");
      if ((window as any).hideHubLoader) (window as any).hideHubLoader();
    }, 100);

  } catch (err) {
    console.error("System: Critical render crash:", err);
    if ((window as any).hideHubLoader) (window as any).hideHubLoader();
  }
};

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Global safety timeout: if nothing happens in 4 seconds, force hide the loader
setTimeout(() => {
  if (document.getElementById('loading-screen')) {
    console.warn("System: Loader stuck. Forcing display.");
    if ((window as any).hideHubLoader) (window as any).hideHubLoader();
  }
}, 4000);
