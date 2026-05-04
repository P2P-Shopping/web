import type { StompSubscription } from "@stomp/stompjs";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    Navigate,
    Route,
    Routes,
    useLocation,
    useNavigate,
} from "react-router-dom";
import { Navbar, OfflineBanner } from "./components";
import { useStore } from "./context/useStore";
import { useNetworkState } from "./hooks/useNetworkState";
import { useOfflineSync } from "./hooks/useOfflineSync";
import {
    Dashboard,
    ListDetail,
    LoginPage,
    RegistrationPage,
    UnifiedMap,
} from "./pages";
import { checkAuthRequest } from "./services/authService";
import { DEMO_STORE_LOCATION, isWithinGeofence } from "./services/geofence";
import { loadRoute } from "./services/loadRoute";
import { startMockEmitter, stopMockEmitter } from "./services/mockEmitter";
import stompClient from "./services/socketService";
import { useThemeStore } from "./store/useThemeStore";

function ProtectedRoute({ children }: Readonly<{ children: React.ReactNode }>) {
    const authChecked = useStore((state) => state.authChecked);
    const isAuthenticated = useStore((state) => state.isAuthenticated);

    if (!authChecked) {
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

function GuestRoute({ children }: Readonly<{ children: React.ReactNode }>) {
    const authChecked = useStore((state) => state.authChecked);
    const isAuthenticated = useStore((state) => state.isAuthenticated);

    if (!authChecked) {
        return (
            <div className="flex-1 flex items-center justify-center p-6 bg-bg min-h-svh text-text-muted">
                Loading session...
            </div>
        );
    }

    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

function NotFound() {
    const authChecked = useStore((state) => state.authChecked);
    const isAuthenticated = useStore((state) => state.isAuthenticated);

    if (!authChecked) {
        return (
            <div className="flex-1 flex items-center justify-center p-6 bg-bg min-h-svh text-text-muted" />
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="flex-1 flex items-center justify-center text-text-muted">
            Page not found
        </div>
    );
}

function App() {
    useNetworkState();
    useOfflineSync();
    const location = useLocation();
    const navigate = useNavigate();
    const setServerConnected = useStore((state) => state.setServerConnected);
    const setAuth = useStore((state) => state.setAuth);
    const isAuthenticated = useStore((state) => state.isAuthenticated);
    const userLocation = useStore((state) => state.userLocation);
    const targetStoreLocation = useStore((state) => state.targetStoreLocation);
    const navigationMode = useStore((state) => state.navigationMode);
    const hasEnteredStore = useStore((state) => state.hasEnteredStore);
    const isTransitioningToStore = useStore(
        (state) => state.isTransitioningToStore,
    );
    const items = useStore((state) => state.items);
    const setNavigationMode = useStore((state) => state.setNavigationMode);
    const setHasEnteredStore = useStore((state) => state.setHasEnteredStore);
    const setIsTransitioningToStore = useStore(
        (state) => state.setIsTransitioningToStore,
    );
    const setStatus = useStore((state) => state.setStatus);
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

    const authChecked = useStore((state) => state.authChecked);

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;

        if (!authChecked) {
            // Safety timeout to prevent permanent "Loading session..."
            timeoutId = setTimeout(() => {
                if (!useStore.getState().authChecked) {
                    console.warn("Auth check timed out, proceeding as guest");
                    setAuth(null, null);
                }
            }, 12_000);

            checkAuthRequest()
                .then((user) => {
                    setAuth(user, (user as { token?: string })?.token);
                })
                .catch(() => {
                    setAuth(null, null);
                })
                .finally(() => {
                    clearTimeout(timeoutId);
                });
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [setAuth, authChecked]);

    const isMockGpsEnabled = useStore((state) => state.isMockGpsEnabled);
    const setUserLocation = useStore((state) => state.setUserLocation);

    useEffect(() => {
        if (isMockGpsEnabled) {
            startMockEmitter();
            return () => stopMockEmitter();
        }

        if (!navigator.geolocation) {
            console.error("Geolocation is not supported by this browser.");
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                setUserLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
            },
            (error) => {
                console.error("Real GPS error:", error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 1000,
                timeout: 5000,
            },
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [isMockGpsEnabled, setUserLocation]);

    useEffect(() => {
        if (
            navigationMode === "indoor" ||
            hasEnteredStore ||
            isTransitioningToStore
        ) {
            return;
        }

        const storeLocation = targetStoreLocation ?? DEMO_STORE_LOCATION;
        if (!isWithinGeofence(userLocation, storeLocation)) return;

        let cancelled = false;

        (async () => {
            setIsTransitioningToStore(true);
            setStatus("Geofence detected. Loading indoor canvas...");
            await loadRoute(
                items.map((item) => item.id),
                storeLocation.lat,
                storeLocation.lng,
            );

            if (cancelled) return;

            setNavigationMode("indoor");
            setHasEnteredStore(true);
            setStatus("Indoor canvas active.");

            if (!location.pathname.startsWith("/map")) {
                navigate("/map", { replace: true });
            }
        })()
            .catch((error) => {
                console.error("Geofence transition failed:", error);
                setStatus("Failed to enter indoor canvas.");
            })
            .finally(() => {
                if (!cancelled) {
                    setIsTransitioningToStore(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [
        hasEnteredStore,
        items,
        location.pathname,
        navigationMode,
        navigate,
        setHasEnteredStore,
        setNavigationMode,
        setStatus,
        setIsTransitioningToStore,
        targetStoreLocation,
        userLocation,
        isTransitioningToStore,
    ]);

    const token = useStore((state) => state.token);

    useEffect(() => {
        let subscription: StompSubscription | null = null;

        if (token) {
            stompClient.connectHeaders = {
                Authorization: `Bearer ${token}`,
            };
        } else {
            stompClient.connectHeaders = {};
        }

        stompClient.onConnect = () => {
            setServerConnected(true);
            console.debug("[ws] connected");

            if (subscription) {
                subscription.unsubscribe();
            }

            subscription = stompClient.subscribe(
                "/topic/pong",
                handlePongMessage,
            );
            console.debug("[ws] subscribed /topic/pong");
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
            console.debug("[ws] closed");
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
            (async () => {
                try {
                    await stompClient.deactivate();
                } catch (err) {
                    console.error("Failed to deactivate STOMP client:", err);
                }
            })();
        };
    }, [handlePongMessage, setServerConnected, clearToastTimeout, token]);

    // Determine if Navbar should be shown
    const searchParams = new URLSearchParams(location.search);
    const isAiImport = searchParams.get("import") === "ai";
    const isAuthPage =
        location.pathname === "/login" || location.pathname === "/register";
    const showNavbar = isAuthenticated && !isAuthPage && !isAiImport;

    return (
        <div className="h-svh flex flex-col bg-bg transition-colors duration-300 overflow-hidden">
            <OfflineBanner isAuthPage={isAuthPage} />

            <main
                className={`flex-1 flex flex-col ${isAiImport ? "overflow-hidden" : "overflow-y-auto"} min-h-0 relative`}
            >
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
                            <GuestRoute>
                                <div className="flex-1 flex items-center justify-center p-6 bg-bg min-h-svh">
                                    <LoginPage />
                                </div>
                            </GuestRoute>
                        }
                    />
                    <Route
                        path="/register"
                        element={
                            <GuestRoute>
                                <div className="flex-1 flex items-center justify-center p-6 bg-bg min-h-svh">
                                    <RegistrationPage />
                                </div>
                            </GuestRoute>
                        }
                    />
                    <Route
                        path="/map"
                        element={
                            <ProtectedRoute>
                                <UnifiedMap />
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
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </main>
            {showNavbar && <Navbar />}
        </div>
    );
}

export default App;