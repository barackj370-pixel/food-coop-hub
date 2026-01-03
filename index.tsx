
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const boot = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  const log = (window as any).logToHub;
  if (log) log("System: Initiating Mount Sequence...");

  try {
    const root = createRoot(rootElement);
    
    const Bootstrap = () => {
      React.useEffect(() => {
        if (log) log("System: UI Mounted.");
        // Immediate call to hide loader once the wrapper is ready
        if ((window as any).hideHubLoader) {
          (window as any).hideHubLoader();
        }
      }, []);

      return <App />;
    };

    root.render(<Bootstrap />);
    
  } catch (err) {
    console.error("Mount Failure:", err);
    if (log) log(`System Error: ${err}`);
    if ((window as any).hideHubLoader) (window as any).hideHubLoader();
  }
};

// Use an immediate execution pattern
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
