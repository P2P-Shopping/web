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
import { checkAuthRequest } from "./services/authService";
import { startMockEmitter, stopMockEmitter } from "./services/mockEmitter";
import stompClient from "./services/socketService";
import { useThemeStore } from "./store/useThemeStore";

function ProtectedRoute({ children }: Readonly<{ children: React.ReactNode }>) {
    const isAuthenticated = useStore((state) => state.isAuthenticated);
    const [isLoading, setIsLoading] = useState(true);
    const setAuth = useStore((state) => state.setAuth);

    useEffect(() => {
        if (!isAuthenticated) {
            checkAuthRequest().then((user) => {
                setAuth(user);
                setIsLoading(false);
            });
        } else {
            setIsLoading(false);
        }
    }, [isAuthenticated, setAuth]);

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                Loading session...
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    return children;
}

function App() {
    useNetworkState();
    const location = useLocation();
    const setServerConnected = useStore((state) => state.setServerConnected);
    const setAuth = useStore((state) => state.setAuth);
    const isAuthenticated = useStore((state) => state.isAuthenticated);
    const { theme } = useThemeStore();

    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const root = document.documentElement;
        if (theme === "system") {
            delete root.dataset.theme;
        } else {
            root.dataset.theme = theme;
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
        checkAuthRequest().then((user) => {
            setAuth(user);
        });
        startMockEmitter();
        return () => stopMockEmitter();
    }, [setAuth]);

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
            clearToastTimeout();
            toastTimeoutRef.current = setTimeout(() => {
                setToastMessage(null);
                toastTimeoutRef.current = null;
            }, 3000);
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
    }, [handlePongMessage, setServerConnected, clearToastTimeout]);

    const handleAuthSuccess = (result: { email: string } | null) => {
        console.info("Authentication successful", result);
        setAuth(result);
    };

    // Determine if Navbar should be shown
    const isAuthPage =
        location.pathname === "/login" || location.pathname === "/register";
    const showNavbar = isAuthenticated && !isAuthPage;

    return (
        <div className="h-svh flex flex-col bg-bg transition-colors duration-300 overflow-hidden">
            <OfflineBanner />

            <main className="flex-1 flex flex-col overflow-y-auto min-h-0 relative">
                {toastMessage && (
                    <output
                        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-500 px-6 py-3 bg-text-strong text-bg rounded-full shadow-2xl text-sm font-bold animate-in fade-in slide-in-from-bottom-4 duration-300"
                        aria-live="polite"
                    >
                        {toastMessage}
                    </output>
                )}

                <Routes>
                    <Route
                        path="/login"
                        element={
                            isAuthenticated ? (
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
                            isAuthenticated ? (
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
                    <Route
                        path="/map"
                        element={
                            <ProtectedRoute>
                                <MapPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute>
                                <Dashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/nav/:id?"
                        element={
                            <ProtectedRoute>
                                <StoreMap />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/route"
                        element={
                            <ProtectedRoute>
                                <RoutePage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/list/:id"
                        element={
                            <ProtectedRoute>
                                <ListDetail />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/"
                        element={
                            isAuthenticated ? (
                                <Navigate to="/dashboard" replace />
                            ) : (
                                <Navigate to="/login" replace />
                            )
                        }
                    />
                    <Route
                        path="*"
                        element={
                            isAuthenticated ? (
                                <div className="flex-1 flex items-center justify-center text-text-muted">
                                    Page not found
                                </div>
                            ) : (
                                <Navigate to="/login" replace />
                            )
                        }
                    />
                </Routes>
            </main>
            {showNavbar && <Navbar />}
        </div>
    );
}

export default App;
