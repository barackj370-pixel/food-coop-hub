
import React from 'react';
import { createRoot } from 'react-dom/client';

// Defensive Bootstrapper: Using dynamic import to catch syntax/path errors
// which are the primary cause of the "blank white page" in static environments.
const boot = async () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  try {
    console.log("System: Resolving App Module...");
    // Dynamic import allows us to catch errors that static imports cannot
    const { default: App } = await import('./App.tsx');
    
    const root = createRoot(rootElement);
    
    const RootWrapper = () => {
      React.useEffect(() => {
        console.log("System: Hub UI Active.");
        if ((window as any).hideHubLoader) {
          setTimeout((window as any).hideHubLoader, 200);
        }
      }, []);
      return <App />;
    };

    root.render(<RootWrapper />);
    
  } catch (err) {
    console.error("System Failure:", err);
    
    // Fallback UI to explain why the white page is appearing
    rootElement.innerHTML = `
      <div style="padding: 40px; max-width: 600px; margin: 40px auto; font-family: sans-serif; background: white; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);">
        <h2 style="color: #e11d48; font-weight: 900; text-transform: uppercase; letter-spacing: -0.025em;">Bootstrap Failure</h2>
        <p style="color: #475569; line-height: 1.6;">The application encountered a module loading error. This usually happens when the browser cannot find the component files or fails to parse the TypeScript code.</p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 12px; color: #1e293b; margin: 20px 0; overflow-x: auto;">
          ${err instanceof Error ? err.message : 'Unknown error during import'}
        </div>
        <button onclick="location.reload()" style="background: #022c22; color: white; padding: 12px 24px; border-radius: 12px; border: none; font-weight: 800; cursor: pointer; width: 100%;">RETRY CONNECTION</button>
      </div>
    `;
    
    if ((window as any).hideHubLoader) (window as any).hideHubLoader();
  }
};

// Start the engine
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Emergency Failsafe for the Loader
setTimeout(() => {
  const loader = document.getElementById('loading-screen');
  if (loader && loader.style.opacity !== '0') {
    console.warn("System: Boot taking longer than expected. Unmasking.");
    if ((window as any).hideHubLoader) (window as any).hideHubLoader();
  }
}, 6000);
