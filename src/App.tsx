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

        stompClient.onStompError = (frame) => {
            console.error("Broker error:", frame.headers.message);
            setServerConnected(false);
            setToastMessage("Connection lost. Retrying...");
            setTimeout(() => setToastMessage(null), 3000);
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
            stompClient.onStompError = () => {};
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
        <div className="min-h-svh flex flex-col bg-bg transition-colors duration-300">
            {showNavbar && <Navbar />}
            <OfflineBanner />

            {toastMessage && (
                <div
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-500 px-6 py-3 bg-text-strong text-bg rounded-full shadow-2xl text-sm font-bold animate-in fade-in slide-in-from-bottom-4 duration-300"
                    role="status"
                    aria-live="polite"
                >
                    {toastMessage}
                </div>
            )}

            <main
                className={`flex-1 flex flex-col ${showNavbar ? "pb-[72px]" : ""}`}
            >
                <Routes>
                    <Route
                        path="/login"
                        element={
                            token ? (
                                <Navigate to="/dashboard" replace />
                            ) : (
                                <div className="flex-1 flex items-center justify-center p-6 bg-bg min-h-svh">
                                    <LoginPage />
                                </div>
                            )
                        }
                    />
                    <Route
                        path="/register"
                        element={
                            token ? (
                                <Navigate to="/dashboard" replace />
                            ) : (
                                <div className="flex-1 flex items-center justify-center p-6 bg-bg min-h-svh">
                                    <RegistrationPage
                                        onAuthSuccess={handleAuthSuccess}
                                    />
                                </div>
                            )
                        }
                    />
                    <Route path="/map" element={<MapPage />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/nav/:id?" element={<StoreMap />} />
                    <Route path="/route" element={<RoutePage />} />
                    <Route path="/list/:id" element={<ListDetail />} />
                    <Route
                        path="/"
                        element={
                            token ? (
                                <Navigate to="/dashboard" replace />
                            ) : (
                                <Navigate to="/login" replace />
                            )
                        }
                    />
                    <Route
                        path="*"
                        element={
                            <div className="flex-1 flex items-center justify-center text-text-muted">
                                Page not found
                            </div>
                        }
                    />
                </Routes>
            </main>
        </div>
    );
}

export default App;
