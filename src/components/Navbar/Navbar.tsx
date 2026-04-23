import { Link, useLocation } from "react-router-dom";
import { ThemeSwitcher } from "..";

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
        <header className="sticky top-0 z-100 bg-surface/80 backdrop-blur-md border-b border-border h-[60px] flex items-center">
            <div className="max-w-[1200px] w-full mx-auto px-7 flex items-center justify-between gap-6">
                <Link to="/dashboard" className="flex items-center group">
                    <span className="text-xl font-black text-text-strong tracking-tighter group-hover:text-accent transition-colors">
                        P2P Shopping
                    </span>
                </Link>

                <nav
                    className="flex items-center gap-1 overflow-x-auto scrollbar-none"
                    aria-label="Main navigation"
                >
                    {NAV_LINKS.map(({ to, label }) => (
                        <Link
                            key={to}
                            to={to}
                            className={`px-3 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${
                                pathname.startsWith(to)
                                    ? "text-accent bg-accent-subtle"
                                    : "text-text-muted hover:text-text-strong hover:bg-bg-muted"
                            }`}
                        >
                            {label}
                        </Link>
                    ))}
                    <div className="ml-4 pl-4 border-l border-border/50 flex items-center">
                        <ThemeSwitcher />
                    </div>
                </nav>
            </div>
        </header>
    );
}
