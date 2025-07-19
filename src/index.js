import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App"; // This should exist: src/App.js
import "./index.css";    // Optional: if you have CSS

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
