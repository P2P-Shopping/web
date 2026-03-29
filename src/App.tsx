import { useEffect } from "react";
import { startMockEmitter, stopMockEmitter } from "./services/mockEmitter";
import { Routes, Route, Link } from "react-router-dom";
import MapPage from "./pages/MapPage";
import RoutePage from "./pages/RoutePage";
import "./App.css";

function App() {
  useEffect(() => {
    startMockEmitter();
    return () => stopMockEmitter();
  }, []);

  return (
    <div className="app-container">
      <header className="main-header">
        <nav className="nav-menu">
          <Link to="/" className="nav-link">
            Map
          </Link>
          <Link to="/route" className="nav-link">
            Route
          </Link>
        </nav>
        <div className="logo-section">
          <span className="cart-icon">🛒</span>
          <h1>P2P Shopping</h1>
        </div>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/route" element={<RoutePage />} />
        </Routes>
      </main>
    </div>
  );
}
export default App;
