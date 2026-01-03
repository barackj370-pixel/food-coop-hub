
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const boot = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  try {
    const log = (window as any).logToHub;
    if (log) log("React: Initiating Mount...");
    
    const root = createRoot(rootElement);
    
    const Bootstrap = () => {
      React.useEffect(() => {
        if (log) log("React: Mount Successful.");
        if ((window as any).hideHubLoader) {
          // Small delay to ensure styles are painted before unmasking
          setTimeout((window as any).hideHubLoader, 150);
        }
      }, []);
      return <App />;
    };

    root.render(<Bootstrap />);
    
  } catch (err) {
    console.error("Mount Failure:", err);
    if ((window as any).logToHub) (window as any).logToHub(`Mount Failure: ${err}`);
    if ((window as any).hideHubLoader) (window as any).hideHubLoader();
  }
};

// Fire immediately if document is ready, otherwise wait
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  boot();
} else {
  document.addEventListener('DOMContentLoaded', boot);
}
