import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import { installSupabaseLockPatch } from "./lib/navigatorLockPatch";
import "./index.css";

installSupabaseLockPatch();

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    if (!registration) return;

    const triggerUpdateCheck = () => registration.update().catch(() => undefined);

    window.setInterval(triggerUpdateCheck, 60 * 1000);
    window.addEventListener("focus", triggerUpdateCheck);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") triggerUpdateCheck();
    });
  },
  onNeedRefresh() {
    updateSW(true);
  },
});

createRoot(document.getElementById("root")!).render(<App />);
