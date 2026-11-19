
import React from "react";
import ReactDOM from "react-dom/client";

import FirstRunGate from "./FirstRunGate.jsx";
import "./index.css";
import "./theme.css";
import "./redesign.css";
import ThemeToggle, { initializeTheme } from "./ThemeToggle.jsx";

initializeTheme();

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <FirstRunGate />
    <ThemeToggle />
  </React.StrictMode>
);
