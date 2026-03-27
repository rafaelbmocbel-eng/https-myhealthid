import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import { installSupabaseLockPatch } from "./lib/navigatorLockPatch";
import "./index.css";

declare const __APP_VERSION__: string;

installSupabaseLockPatch();

const APP_VERSION_STORAGE_KEY = "myhealthid.app.version";
const DYNAMIC_IMPORT_RELOAD_KEY = "myhealthid.dynamic-import-reload";
const DYNAMIC_IMPORT_ERROR_PATTERN = /Failed to fetch dynamically imported module|Importing a module script failed|Failed to load module script/i;

const clearBrowserCaches = async () => {
  if (!("caches" in window)) return;

  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
};

const forceLoadLatestVersion = async (registration?: ServiceWorkerRegistration) => {
  await clearBrowserCaches();

  if ("serviceWorker" in navigator) {
    const registrations = registration ? [registration] : await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((item) => item.unregister().catch(() => false)));
  }

  const url = new URL(window.location.href);
  url.searchParams.set("app_updated", Date.now().toString());
  window.location.replace(url.toString());
};

const reloadOnDynamicImportFailure = () => {
  const hasRetried = window.sessionStorage.getItem(DYNAMIC_IMPORT_RELOAD_KEY);
  if (hasRetried) return;

  window.sessionStorage.setItem(DYNAMIC_IMPORT_RELOAD_KEY, "1");
  void forceLoadLatestVersion();
};

const syncBuildVersion = async () => {
  const currentVersion = __APP_VERSION__;
  const savedVersion = window.localStorage.getItem(APP_VERSION_STORAGE_KEY);

  if (!savedVersion) {
    window.localStorage.setItem(APP_VERSION_STORAGE_KEY, currentVersion);
    return;
  }

  if (savedVersion !== currentVersion) {
    window.localStorage.setItem(APP_VERSION_STORAGE_KEY, currentVersion);
    await forceLoadLatestVersion();
  }

  window.sessionStorage.removeItem(DYNAMIC_IMPORT_RELOAD_KEY);
};

void syncBuildVersion();

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

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (!registration) return;

    const triggerUpdateCheck = () => registration.update().catch(() => undefined);

    window.setInterval(triggerUpdateCheck, 30 * 1000);
    window.addEventListener("focus", triggerUpdateCheck);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") triggerUpdateCheck();
    });

    if (registration.waiting) {
      void forceLoadLatestVersion(registration);
    }
  },
  onNeedRefresh() {
    void clearBrowserCaches().finally(() => {
      updateSW(true);
      window.setTimeout(() => {
        window.location.reload();
      }, 150);
    });
  },
});

createRoot(document.getElementById("root")!).render(<App />);
