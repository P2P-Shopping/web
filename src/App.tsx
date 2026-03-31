import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import StoreMap from'./components/StoreMap.tsx'
import './App.css'

function App() {
  return <StoreMap />;
import { useEffect } from "react";
import { startMockEmitter, stopMockEmitter } from "./services/mockEmitter";
import { Routes, Route, Link } from "react-router-dom";
import MapPage from "./pages/MapPage";
import RoutePage from "./pages/RoutePage";
import RegistrationPage from "./pages/RegistrationPage";
import "./App.css";

function App() {
  useEffect(() => {
    startMockEmitter();
    return () => stopMockEmitter();
  }, []);
    const handleAuthSuccess = (authResult: any) => {
    console.info('Authentication successful');
  };

  return (
    <div className="app-container">
      <header className="main-header">
        <nav className="nav-menu">
          <Link to="/register" className="nav-link">Register</Link>
          <Link to="/map" className="nav-link">Map</Link>
          <Link to="/route" className="nav-link">Route</Link>
        </nav>
        <div className="logo-section">
          <span className="cart-icon">🛒</span>
          <h1>P2P Shopping</h1>
        </div>
      </header>

      <main className="content">
        <Routes>
          <Route path="/map" element={<MapPage />} />
          <Route path="/route" element={<RoutePage />} />
          <Route path="/register" element={
            <div className="auth-container">
               <RegistrationPage onAuthSuccess={handleAuthSuccess} />
             </div>
    } 
  />
        </Routes>
      </main>
    </div>
  );
}
export default App;