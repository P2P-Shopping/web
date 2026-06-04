import { GoogleOAuthProvider } from "@react-oauth/google";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";

const GOOGLE_CLIENT_ID = "1011433342347-l9445a7d8f14e06rcog3npas9uvsos96.apps.googleusercontent.com"

let rootElement = document.getElementById("root");
if (!rootElement) {
    rootElement = document.createElement("div");
    rootElement.id = "root";
    document.body.appendChild(rootElement);
}
console.log("CLIENT ID:", import.meta.env.VITE_GOOGLE_CLIENT_ID);
createRoot(rootElement).render(
    <StrictMode>
        <BrowserRouter>
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <App />
            </GoogleOAuthProvider>
        </BrowserRouter>
    </StrictMode>,
);
