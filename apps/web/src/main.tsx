import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/montserrat";
import { App } from "@/app/App.js";
import { initializeTheme } from "@/shared/lib/index.js";
import { initializeLocale } from "@/shared/config/index.js";
import "@/shared/styles/tokens.css";

initializeTheme();
initializeLocale();

createRoot(document.getElementById("root")!).render(
    <App />
);
