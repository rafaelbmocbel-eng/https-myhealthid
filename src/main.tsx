import { createRoot } from "react-dom/client";
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

// ── Dynamic import error recovery (one retry only) ──
const DYNAMIC_IMPORT_RELOAD_KEY = "myhealthid.dynamic-import-reload";
const DYNAMIC_IMPORT_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script/i;

const reloadOnDynamicImportFailure = () => {
  if (window.sessionStorage.getItem(DYNAMIC_IMPORT_RELOAD_KEY)) return;
  window.sessionStorage.setItem(DYNAMIC_IMPORT_RELOAD_KEY, "1");
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
  if (!DYNAMIC_IMPORT_ERROR_PATTERN.test(message)) return;
  event.preventDefault();
  reloadOnDynamicImportFailure();
});

// Clear the retry flag on successful load
window.sessionStorage.removeItem(DYNAMIC_IMPORT_RELOAD_KEY);

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
