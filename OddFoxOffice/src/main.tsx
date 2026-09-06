import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/oddfox.css";
import "./styles/theme.css";
import "./styles/office.css";
import App from "./routes";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
