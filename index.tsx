
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

const boot = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  try {
    const root = createRoot(rootElement);
    
    const Bootstrap = () => {
      React.useEffect(() => {
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
