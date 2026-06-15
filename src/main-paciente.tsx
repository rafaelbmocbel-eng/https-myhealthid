import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import AppPaciente from "./AppPaciente.tsx";
import { installSupabaseLockPatch } from "./lib/navigatorLockPatch";
import "./index.css";

installSupabaseLockPatch();

const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

const host = window.location.hostname;
const isPreviewHost =
  host.includes("id-preview--") ||
  host.includes("lovableproject.com") ||
  host.endsWith(".sandbox.lovable.dev");

const isSafeForSW = !isInIframe && !isPreviewHost && !import.meta.env.DEV;

if (!isSafeForSW && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

const DYNAMIC_IMPORT_RELOAD_KEY = "myhealthid-pac.dynamic-import-reload";
const DYNAMIC_IMPORT_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script/i;
const LAZY_DEFAULT_ERROR_PATTERN =
  /Cannot read properties of undefined \(reading 'default'\)|undefined is not an object \(evaluating '.*\.default'\)/i;

const reloadOnDynamicImportFailure = () => {
  if (document.visibilityState !== "visible") return;
  const last = Number(window.sessionStorage.getItem(DYNAMIC_IMPORT_RELOAD_KEY) || 0);
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

window.addEventListener("error", (event) => {
  const message = event.error instanceof Error ? event.error.message : event.message || "";
  const stack = event.error instanceof Error ? event.error.stack || "" : "";
  if (!LAZY_DEFAULT_ERROR_PATTERN.test(message)) return;
  if (!/vendor-react|react-dom|react\.production/i.test(stack)) return;
  reloadOnDynamicImportFailure();
});

if (isSafeForSW) {
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;
        const check = () => registration.update().catch(() => undefined);
        window.setInterval(check, 60_000);
      },
      onNeedRefresh() {
        console.info("[PWA] Nova versão disponível. Será aplicada ao recarregar.");
      },
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <AppPaciente />
  </HelmetProvider>
);
