import StoreMap from "./components/StoreMap.tsx";
import { useEffect, useState, useRef } from "react";
import type { StompSubscription } from "@stomp/stompjs";
import stompClient from "./services/socketService";
import { startMockEmitter, stopMockEmitter } from "./services/mockEmitter";
import { Routes, Route, Link, useLocation, Navigate } from "react-router-dom";

// Auth Pages
import LoginPage from "./pages/LoginPage";
import RegistrationPage from "./pages/RegistrationPage";

import MapPage from "./pages/MapPage";
import RoutePage from "./pages/RoutePage";
import ListDetail from "./pages/ListDetail";
import MyListsPage from "./pages/MyListsPage";
import "./App.css";

function App() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const location = useLocation();
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      subscription = stompClient.subscribe("/topic/pong", (message) => {
        setToastMessage(`Server Response: ${message.body}`);
        if (toastTimeoutRef.current) {
          clearTimeout(toastTimeoutRef.current);
        }
        toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3000);
      });
    };

    stompClient.onWebSocketClose = () => {
      setIsConnected(false);
    };

    stompClient.activate();

    return () => {
      if (subscription) subscription.unsubscribe();
      stompClient.onConnect = () => {};
      stompClient.onWebSocketClose = () => {};
      stompClient.deactivate();
    };
  }, []);

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

  const isStoreMap = location.pathname === "/nav";

  if (isStoreMap) {
    return <StoreMap />;
  }

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

      <header className="main-header">
        <nav className="nav-menu">
          {/* Added your link to Login */}
          <Link to="/login" className="nav-link">
            Login
          </Link>
          <Link to="/register" className="nav-link">
            Register
          </Link>
          <Link to="/map" className="nav-link">
            Map
          </Link>
          <Link to="/route" className="nav-link">
            Route
          </Link>
          <Link to="/nav" className="nav-link">
            Store Map
          </Link>
          <Link to="/my-lists" className="nav-link">
            My Lists
          </Link>

          <button
            className="nav-link"
            onClick={handlePingPress}
            disabled={!isConnected}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              font: "inherit",
              color: isConnected ? "inherit" : "gray",
              cursor: isConnected ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            {isConnected ? "🟢 Ping Server" : "🔴 Disconnected"}
          </button>
        </nav>
        <div className="logo-section">
          <span className="cart-icon">🛒</span>
          <h1>P2P Shopping</h1>
        </div>
      </header>

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
                <RegistrationPage onAuthSuccess={handleAuthSuccess} />
              </div>
            }
          />
          <Route path="/map" element={<MapPage />} />
          <Route path="/nav" element={<StoreMap />} />
          <Route path="/route" element={<RoutePage />} />
          <Route path="/my-lists" element={<MyListsPage />} />
          <Route path="/list/:id" element={<ListDetail />} />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<div>Page not found</div>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
