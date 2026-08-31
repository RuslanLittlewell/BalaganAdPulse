import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app/App.js";
import { initializeTheme } from "@/shared/lib/index.js";
import "@/shared/styles/tokens.css";

initializeTheme();

createRoot(document.getElementById("root")!).render(
    <App />
);
