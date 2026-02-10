
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
        // Use relative path directly. Do NOT construct using window.location.origin or href
        // as cloud environments often have mismatched origins between iframe and top-level URL.
        const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        console.log('SW Registered:', registration.scope);
       } catch (err: any) {
         // Filter out known environment-specific errors that aren't critical
         const msg = (err?.message || '') + ' ' + (err?.toString() || '');
         if (msg.toLowerCase().includes('invalid state') || 
             msg.toLowerCase().includes('origin') || 
             msg.toLowerCase().includes('mismatch') ||
             msg.toLowerCase().includes('script resource is behind a redirect')) {
           console.log('SW Registration Skipped (Preview Environment limitation):', msg);
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
