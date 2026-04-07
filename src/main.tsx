// src/main.tsx
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Inject the correct manifest based on the current path ──
const isCustomerPortal = window.location.pathname.startsWith('/customer');

const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
if (manifestLink) {
  manifestLink.href = isCustomerPortal ? '/manifest-customer.json' : '/manifest-staff.json';
}

const iosTitleMeta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
if (iosTitleMeta) {
  iosTitleMeta.content = isCustomerPortal ? 'My Water' : 'AquaTrack Staff';
}

// ── PWA Service Worker ──
// Staff get /sw.js  (scope: /)
// Customers get /customer-sw.js  (scope: /customer/)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const swPath  = isCustomerPortal ? '/customer-sw.js' : '/sw.js';
    const swScope = isCustomerPortal ? '/customer/'      : '/';

    try {
      const registration = await navigator.serviceWorker.register(swPath, {
        scope: swScope,
      });
      console.log('✅ AquaTrack SW registered:', swPath);

      // Force the waiting SW to activate immediately (no need to close all tabs)
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // When a new SW installs, activate it right away too
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            // Reload once the new SW takes control so users get fresh assets
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              window.location.reload();
            }, { once: true });
          }
        });
      });
    } catch (err) {
      console.error('❌ SW registration failed:', err);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);