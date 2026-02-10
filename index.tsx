
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const boot = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  // Register Service Worker for Offline Capabilities
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('SW Registered: ', registration.scope);
        })
        .catch(err => {
          console.log('SW Registration Failed: ', err);
        });
    });
  }

  try {
    const root = createRoot(rootElement);
    
    const Bootstrap = () => {
      React.useEffect(() => {
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
    if ((window as any).hideHubLoader) (window as any).hideHubLoader();
  }
};

// Use an immediate execution pattern
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}