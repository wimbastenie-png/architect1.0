import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline werken: service worker alleen in de gebouwde app (niet tijdens het ontwikkelen).
if ((import.meta as unknown as { env: { PROD: boolean } }).env.PROD && "serviceWorker" in navigator && !new URLSearchParams(location.search).has("geen-sw")) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("./sw.js").catch(() => { /* geen offline, de app werkt gewoon */ }); });
}
