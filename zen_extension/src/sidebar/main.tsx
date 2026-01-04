import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./App.css";

// Get the root element
const rootElement = document.getElementById("root");

// Ensure root exists
if (!rootElement) {
    throw new Error("Root element not found. Check sidebar.html has <div id='root'>");
}

// Create React root and render
const root = createRoot(rootElement);

root.render(
    <StrictMode>
        <App />
    </StrictMode>
);
