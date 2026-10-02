import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { connect } from "./api";
import { App } from "./App";
import "./styles.css";

void connect().then(
  () =>
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  (error: Error) => {
    document.getElementById("root")!.textContent = `Systemathic could not start: ${error.message}`;
  },
);
