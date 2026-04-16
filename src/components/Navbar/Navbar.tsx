import { Link } from "react-router-dom";
import "./Navbar.css";

interface NavbarProps {
    isConnected: boolean;
    handlePingPress: () => void;
}

export default function Navbar({ isConnected, handlePingPress }: NavbarProps) {
    return (
        <header className="main-header">
            <nav className="nav-menu">
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
                <Link to="/list/default" className="nav-link">
                    List
                </Link>

                <button
                    type="button"
                    className="nav-link ping-button"
                    onClick={handlePingPress}
                    disabled={!isConnected}
                    style={{
                        color: isConnected ? "inherit" : "gray",
                        cursor: isConnected ? "pointer" : "not-allowed",
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
    );
}
