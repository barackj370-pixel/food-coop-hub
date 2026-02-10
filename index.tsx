
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const boot = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

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

// Service Worker Registration Logic
const registerServiceWorker = () => {
  // Check if we are in a secure context or localhost (Service Workers require HTTPS or localhost)
  const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if ('serviceWorker' in navigator && isSecure) {
    const handleRegistration = async () => {
       // specific delay to allow iframe/preview environments to settle
       await new Promise(resolve => setTimeout(resolve, 2000));

       try {
        // Use root-relative path '/sw.js'. 
        // We remove the explicit scope to let the browser determine the default scope (location of sw.js).
        // This often resolves 'origin mismatch' errors in cloud preview environments where base URLs might be proxied.
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW Registered:', registration.scope);
       } catch (err: any) {
         // Filter out known environment-specific errors that aren't critical
         // We convert everything to string to ensure we catch the error message content
         const errorText = (err?.message || String(err)).toLowerCase();
         
         if (errorText.includes('invalid state') || 
             errorText.includes('origin') || 
             errorText.includes('mismatch') ||
             errorText.includes('script resource is behind a redirect') ||
             errorText.includes('failed to register')) {
           console.log('SW Registration Skipped (Preview Environment limitation):', errorText);
         } else {
           console.warn('SW Registration Failed:', err);
         }
       }
    };

    if (document.readyState === 'complete') {
      handleRegistration();
    } else {
      window.addEventListener('load', handleRegistration);
    }
  }
};

// Execution Control
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Start SW registration
registerServiceWorker();
