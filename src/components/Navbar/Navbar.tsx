import { Link, useLocation } from "react-router-dom";
import { ThemeSwitcher } from "..";
import "./Navbar.css";

const NAV_LINKS = [
    { to: "/dashboard", label: "My Lists" },
    { to: "/list/default", label: "AI Import" },
    { to: "/route", label: "Route" },
    { to: "/nav", label: "Store Map" },
    { to: "/map", label: "Map" },
];

export default function Navbar() {
    const { pathname } = useLocation();

    return (
        <header className="navbar">
            <div className="navbar-inner">
                <Link to="/dashboard" className="navbar-brand">
                    <span className="navbar-brand-name">P2P Shopping</span>
                </Link>

                <nav className="navbar-nav" aria-label="Main navigation">
                    {NAV_LINKS.map(({ to, label }) => (
                        <Link
                            key={to}
                            to={to}
                            className={`nav-link ${pathname.startsWith(to) ? "nav-link--active" : ""}`}
                        >
                            {label}
                        </Link>
                    ))}
                    <div className="navbar-actions">
                        <ThemeSwitcher />
                    </div>
                </nav>
            </div>
        </header>
    );
}
