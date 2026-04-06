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

// Update iOS PWA title to match
const iosTitleMeta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
if (iosTitleMeta) {
  iosTitleMeta.content = isCustomerPortal ? 'My Water' : 'AquaTrack Staff';
}

// ── PWA Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => console.log('✅ AquaTrack SW registered'))
      .catch((err) => console.error('❌ SW registration failed:', err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);