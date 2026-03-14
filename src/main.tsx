import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { installSupabaseLockPatch } from "./lib/navigatorLockPatch";
import "./index.css";

installSupabaseLockPatch();

createRoot(document.getElementById("root")!).render(<App />);
