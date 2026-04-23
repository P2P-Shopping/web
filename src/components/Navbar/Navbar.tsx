import {
    LayoutDashboard,
    Map as MapIcon,
    MapPinned,
    MoreHorizontal,
    Route as RouteIcon,
    Sparkles,
    X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import ThemeSwitcher from "../ThemeSwitcher/ThemeSwitcher";

const NAV_LINKS = [
    { to: "/dashboard", label: "My Lists", icon: LayoutDashboard },
    { to: "/list/default", label: "AI Import", icon: Sparkles },
    { to: "/route", label: "Route", icon: RouteIcon },
    { to: "/nav", label: "Store Map", icon: MapPinned },
    { to: "/map", label: "Map", icon: MapIcon },
];

export default function Navbar() {
    const { pathname } = useLocation();
    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);

    // Close more menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                moreMenuRef.current &&
                !moreMenuRef.current.contains(event.target as Node)
            ) {
                setIsMoreOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Close more menu on navigation
    // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is used as a trigger to close the menu
    useEffect(() => {
        setIsMoreOpen(false);
    }, [pathname]);

    // Split links into priority (visible) and extra (in more menu)
    // On mobile we might want fewer visible items. Let's show 4 + More.
    const priorityLinks = NAV_LINKS.slice(0, 4);
    const extraLinks = NAV_LINKS.slice(4);

    return (
        <nav className="relative bg-surface/80 backdrop-blur-xl border-t border-border h-[72px] pb-safe flex items-center shadow-[0_-8px_30px_rgba(0,0,0,0.04)] z-50">
            <div className="max-w-[600px] w-full mx-auto px-4 flex items-center justify-around relative">
                {priorityLinks.map(({ to, label, icon: Icon }) => (
                    <Link
                        key={to}
                        to={to}
                        className={`flex flex-col items-center gap-1 group relative py-1 px-3 transition-all duration-300 ${
                            pathname.startsWith(to)
                                ? "text-accent"
                                : "text-text-muted hover:text-text-strong"
                        }`}
                    >
                        <div
                            className={`p-2 rounded-xl transition-all duration-300 ${
                                pathname.startsWith(to)
                                    ? "bg-accent-subtle"
                                    : "group-hover:bg-bg-muted"
                            }`}
                        >
                            <Icon
                                size={22}
                                strokeWidth={pathname.startsWith(to) ? 2.5 : 2}
                            />
                        </div>
                        <span className="text-[10px] font-bold">{label}</span>
                    </Link>
                ))}

                {/* More Menu Toggle */}
                <button
                    type="button"
                    onClick={() => setIsMoreOpen(!isMoreOpen)}
                    className={`flex flex-col items-center gap-1 group py-1 px-3 transition-all duration-300 ${
                        isMoreOpen
                            ? "text-accent"
                            : "text-text-muted hover:text-text-strong"
                    }`}
                >
                    <div
                        className={`p-2 rounded-xl transition-all duration-300 ${
                            isMoreOpen
                                ? "bg-accent-subtle"
                                : "group-hover:bg-bg-muted"
                        }`}
                    >
                        {isMoreOpen ? (
                            <X size={22} />
                        ) : (
                            <MoreHorizontal size={22} />
                        )}
                    </div>
                    <span className="text-[10px] font-bold">More</span>
                </button>

                {/* More Menu Content */}
                {isMoreOpen && (
                    <div
                        ref={moreMenuRef}
                        className="absolute bottom-[84px] right-4 bg-surface border border-border rounded-2xl p-2 shadow-2xl min-w-[180px] animate-in slide-in-from-bottom-4 fade-in duration-300"
                    >
                        <div className="flex flex-col gap-1">
                            {extraLinks.map(({ to, label, icon: Icon }) => (
                                <Link
                                    key={to}
                                    to={to}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                        pathname.startsWith(to)
                                            ? "text-accent bg-accent-subtle font-bold"
                                            : "text-text-muted hover:text-text-strong hover:bg-bg-muted"
                                    }`}
                                >
                                    <Icon size={20} />
                                    <span className="text-sm">{label}</span>
                                </Link>
                            ))}
                            <div className="h-px bg-border my-1" />
                            <div className="px-4 py-2 flex items-center justify-between">
                                <span className="text-xs font-bold text-text-muted">
                                    Theme
                                </span>
                                <ThemeSwitcher />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}
