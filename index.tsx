
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif', color: 'red' }}>
          <h1>Something went wrong.</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.toString()}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

// Domain Redirection Logic: Force traffic to kplfoodcoopmarket.co.ke
// NOTE: Temporarily disabled to prevent "Server IP address not found" errors in preview 
// while the main domain DNS is propagating or being configured.
/*
const MAIN_DOMAIN = 'kplfoodcoopmarket.co.ke';
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  
  // Only redirect if we are on a vercel.app subdomain
  if (hostname.endsWith('.vercel.app')) {
    const targetUrl = `https://${MAIN_DOMAIN}${window.location.pathname}${window.location.search}`;
    console.log(`Redirecting to main domain: ${targetUrl}`);
    window.location.replace(targetUrl);
  }
}
*/

const boot = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  if ((window as any).hideHubLoader) {
    (window as any).hideHubLoader();
  }

  try {
    const root = createRoot(rootElement);
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (err) {
    console.error("Mount Failure:", err);
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
