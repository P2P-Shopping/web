import type { StompSubscription } from "@stomp/stompjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
// 2. THIS IS NEW: Import your Navbar from your components/ folder
import { Navbar } from "./components";
// 1. Import your pages from your pages/ folder
import {
    ListDetail,
    LoginPage,
    MapPage,
    RegistrationPage,
    RoutePage,
    StoreMap,
} from "./pages";
import { startMockEmitter, stopMockEmitter } from "./services/mockEmitter";
import stompClient from "./services/socketService";

import "./App.css";

function App() {
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const _location = useLocation();
    const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
            setIsConnected(true);

            if (subscription) {
                subscription.unsubscribe();
            }

            subscription = stompClient.subscribe(
                "/topic/pong",
                handlePongMessage,
            );
        };

        stompClient.onWebSocketClose = () => {
            setIsConnected(false);
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
    }, [handlePongMessage]);

    const handleAuthSuccess = (result: unknown) => {
        console.info("Authentication successful", result);
    };

    const handlePingPress = () => {
        if (isConnected) {
            stompClient.publish({
                destination: "/app/ping",
                body: "Ping from React Navigation!",
            });
        } else {
            alert("Cannot ping. Server is disconnected.");
        }
    };

    return (
        <div className="app-container">
            {/* Toast Notification */}
            {toastMessage && (
                <div
                    style={{
                        position: "fixed",
                        top: "80px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "var(--accent, #aa3bff)",
                        color: "#fff",
                        padding: "10px 20px",
                        borderRadius: "8px",
                        zIndex: 1000,
                        boxShadow: "var(--shadow)",
                        fontWeight: "bold",
                    }}
                >
                    {toastMessage}
                </div>
            )}

            {/* 3. THIS IS NEW: Drop in your reusable Navbar component! 
          We pass it the variables it needs to make the Ping button work. */}
            <Navbar
                isConnected={isConnected}
                handlePingPress={handlePingPress}
            />

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
                    <Route path="/nav" element={<StoreMap />} />
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
