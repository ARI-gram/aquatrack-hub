// src/main.tsx
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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