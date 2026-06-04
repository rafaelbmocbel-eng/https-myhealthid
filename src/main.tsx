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

// Apenas hosts de PREVIEW/sandbox (não a produção em *.lovable.app).
// O domínio canônico de produção é "https-myhealthid.lovable.app" e PRECISA
// registrar o Service Worker, senão o Android não instala como PWA e o app
// abre dentro de um Chrome Custom Tab (com barra "X / URL" no topo).
const host = window.location.hostname;
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  host.endsWith(".sandbox.lovable.dev");

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
const DYNAMIC_IMPORT_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script/i;
// React.lazy() resolves `module.default` — when a stale chunk is loaded after a
// deploy, the module object can be undefined and React throws this exact message
// from inside vendor-react. Treat it as a chunk-mismatch and reload (throttled).
const LAZY_DEFAULT_ERROR_PATTERN =
  /Cannot read properties of undefined \(reading 'default'\)|undefined is not an object \(evaluating '.*\.default'\)/i;

const reloadOnDynamicImportFailure = () => {
  // Note: allowed in DEV too — Vite HMR restarts can leave stale module URLs
  // on the preview host. The 5-minute throttle below prevents reload loops.
  if (document.visibilityState !== "visible") return;
  const last = Number(window.sessionStorage.getItem(DYNAMIC_IMPORT_RELOAD_KEY) || 0);
  // Only allow one reload per 5 minutes — prevents reload loops on transient errors
  if (Date.now() - last < 5 * 60_000) return;
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
  if (!DYNAMIC_IMPORT_ERROR_PATTERN.test(message)) return;
  event.preventDefault();
  reloadOnDynamicImportFailure();
});

// React.lazy() reading `.default` from an undefined module = stale chunk after deploy.
window.addEventListener("error", (event) => {
  const message = event.error instanceof Error ? event.error.message : event.message || "";
  const stack = event.error instanceof Error ? event.error.stack || "" : "";
  if (!LAZY_DEFAULT_ERROR_PATTERN.test(message)) return;
  // Only reload when the failure comes from a vendor/react lazy resolution,
  // not from arbitrary user code that happens to read `.default`.
  if (!/vendor-react|react-dom|react\.production/i.test(stack)) return;
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

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
