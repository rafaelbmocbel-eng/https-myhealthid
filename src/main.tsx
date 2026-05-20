import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import { installSupabaseLockPatch } from "./lib/navigatorLockPatch";
import "./index.css";

installSupabaseLockPatch();

// ── Detect hostile environments for SW ──
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com") ||
  window.location.hostname.includes("lovable.app");

const isSafeForSW = !isInIframe && !isPreviewHost && !import.meta.env.DEV;

// ── Unregister stale SWs in unsafe environments ──
if (!isSafeForSW && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

// ── Dynamic import error recovery ──
// Only reload when:
//   1. The page is currently visible (user is actively using the app)
//   2. We haven't already tried reloading recently
// This prevents the "app reinicia ao reabrir" issue on mobile, where the OS
// suspends the tab, chunks expire, and an automatic reload kills user state.
const DYNAMIC_IMPORT_RELOAD_KEY = "myhealthid.dynamic-import-reload";
const STALE_CHUNK_ERROR_PATTERN =
  /Cannot read properties of undefined \(reading 'default'\)|undefined is not an object \(evaluating '.*\.default'\)/i;
const DYNAMIC_IMPORT_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script/i;

const reloadOnDynamicImportFailure = () => {
  // Skip in dev — Vite HMR frequently invalidates chunks and would reload the
  // page mid-edit, kicking the user out of whatever they were doing.
  if (import.meta.env.DEV) return;
  // Don't reload if the tab is hidden — the user just brought the app back
  // from background; a reload would wipe their state.
  if (document.visibilityState !== "visible") {
    // Defer: try again only when the user explicitly navigates next time
    return;
  }
  const last = Number(window.sessionStorage.getItem(DYNAMIC_IMPORT_RELOAD_KEY) || 0);
  // Only allow one reload per 30s window
  if (Date.now() - last < 30_000) return;
  window.sessionStorage.setItem(DYNAMIC_IMPORT_RELOAD_KEY, String(Date.now()));
  window.location.reload();
};

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  reloadOnDynamicImportFailure();
});

window.addEventListener("unhandledrejection", (event) => {
  const message =
    event.reason instanceof Error
      ? event.reason.message
      : typeof event.reason === "string"
        ? event.reason
        : "";
  if (!DYNAMIC_IMPORT_ERROR_PATTERN.test(message) && !STALE_CHUNK_ERROR_PATTERN.test(message)) return;
  event.preventDefault();
  reloadOnDynamicImportFailure();
});

window.addEventListener("error", (event) => {
  const message = event.error instanceof Error ? event.error.message : event.message || "";
  if (!STALE_CHUNK_ERROR_PATTERN.test(message)) return;
  event.preventDefault();
  reloadOnDynamicImportFailure();
});

// ── Register SW only in production, outside iframes ──
if (isSafeForSW) {
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        // Check for updates every 60s (not 30s to reduce churn)
        const check = () => registration.update().catch(() => undefined);
        window.setInterval(check, 60_000);
      },
      onNeedRefresh() {
        // Silently apply update — the user will get it on next navigation
        // No forced reload to avoid jarring UX
        console.info("[PWA] Nova versão disponível. Será aplicada ao recarregar.");
      },
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
