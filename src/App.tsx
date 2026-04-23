import type { StompSubscription } from "@stomp/stompjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Navbar, OfflineBanner } from "./components";
import { useStore } from "./context/useStore";
import { useNetworkState } from "./hooks/useNetworkState";
import {
    Dashboard,
    ListDetail,
    LoginPage,
    MapPage,
    RegistrationPage,
    RoutePage,
    StoreMap,
} from "./pages";
import { startMockEmitter, stopMockEmitter } from "./services/mockEmitter";
import stompClient from "./services/socketService";
import { useThemeStore } from "./store/useThemeStore";

import "./App.css";

function App() {
    useNetworkState();
    const location = useLocation();
    const setServerConnected = useStore((state) => state.setServerConnected);
    const { theme } = useThemeStore();

    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const root = document.documentElement;
        if (theme === "system") {
            root.removeAttribute("data-theme");
        } else {
            root.setAttribute("data-theme", theme);
        }
    }, [theme]);

    const clearToastTimeout = useCallback(() => {
        if (!toastTimeoutRef.current) return;
        clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
    }, []);

    const handlePongMessage = useCallback(
        (message: { body: string }) => {
            setToastMessage(`Server Response: ${message.body}`);
            clearToastTimeout();
            toastTimeoutRef.current = setTimeout(() => {
                setToastMessage(null);
                toastTimeoutRef.current = null;
            }, 3000);
        },
        [clearToastTimeout],
    );

    useEffect(() => {
        startMockEmitter();
        return () => stopMockEmitter();
    }, []);

    useEffect(() => {
        let subscription: StompSubscription | null = null;

        stompClient.onConnect = () => {
            setServerConnected(true);

            if (subscription) {
                subscription.unsubscribe();
            }

            subscription = stompClient.subscribe(
                "/topic/pong",
                handlePongMessage,
            );
        };

        stompClient.onWebSocketClose = () => {
            setServerConnected(false);
        };

        stompClient.activate();

        return () => {
            if (subscription) subscription.unsubscribe();
            if (toastTimeoutRef.current) {
                clearTimeout(toastTimeoutRef.current);
                toastTimeoutRef.current = null;
            }
            stompClient.onConnect = () => {};
            stompClient.onWebSocketClose = () => {};
            stompClient.deactivate();
        };
    }, [handlePongMessage, setServerConnected]);

    const handleAuthSuccess = (result: unknown) => {
        console.info("Authentication successful", result);
    };

    // Determine if Navbar should be shown
    const token = localStorage.getItem("token");
    const isAuthPage =
        location.pathname === "/login" || location.pathname === "/register";
    const showNavbar = token && !isAuthPage;

    return (
        <div className="app-container">
            {showNavbar && <Navbar />}
            <OfflineBanner hasNavbar={!!showNavbar} />
            {toastMessage && (
                <div className="toast" role="status" aria-live="polite">
                    {toastMessage}
                </div>
            )}

            <main className="content">
                <Routes>
                    <Route
                        path="/login"
                        element={
                            <div className="auth-container">
                                <LoginPage />
                            </div>
                        }
                    />
                    <Route
                        path="/register"
                        element={
                            <div className="auth-container">
                                <RegistrationPage
                                    onAuthSuccess={handleAuthSuccess}
                                />
                            </div>
                        }
                    />
                    <Route path="/map" element={<MapPage />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/nav/:id?" element={<StoreMap />} />
                    <Route path="/route" element={<RoutePage />} />
                    <Route path="/list/:id" element={<ListDetail />} />
                    <Route
                        path="/"
                        element={<Navigate to="/login" replace />}
                    />
                    <Route path="*" element={<div>Page not found</div>} />
                </Routes>
            </main>
        </div>
    );
}

export default App;
