import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./shims/buffer-global";
import { App } from "./App";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
