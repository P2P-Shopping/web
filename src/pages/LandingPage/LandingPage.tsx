import {
    Brain,
    ChevronLeft,
    ChevronRight,
    MapPin,
    Network,
    Route,
    Store,
    Users,
} from "lucide-react";

import type React from "react";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Logo, ThemeSwitcher } from "../../components";

const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return;
        isDragging.current = true;
        startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
        scrollLeft.current = scrollContainerRef.current.scrollLeft;
        scrollContainerRef.current.style.cursor = "grabbing";
        scrollContainerRef.current.style.userSelect = "none";
    };

    const handleMouseLeave = () => {
        if (!scrollContainerRef.current) return;
        isDragging.current = false;
        scrollContainerRef.current.style.cursor = "grab";
    };

    const handleMouseUp = () => {
        if (!scrollContainerRef.current) return;
        isDragging.current = false;
        scrollContainerRef.current.style.cursor = "grab";
        scrollContainerRef.current.style.removeProperty("user-select");
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX.current) * 1.5;
        scrollContainerRef.current.scrollLeft = scrollLeft.current - walk;
    };

    const scroll = (direction: "left" | "right") => {
        if (scrollContainerRef.current) {
            const scrollAmount = direction === "left" ? -360 : 360;
            scrollContainerRef.current.scrollBy({
                left: scrollAmount,
                behavior: "smooth",
            });
        }
    };

    const features = [
        {
            id: "p2p",
            icon: <MapPin size={28} />,
            title: "Crowdsourced P2P Locations",
            description:
                "When you check off an item, the app remembers its location. The next user looking for the same product gets guided straight to the exact aisle.",
            colorClass: "text-blue-500 bg-blue-500/10",
        },
        {
            id: "store",
            icon: <Store size={28} />,
            title: "Smart Store Locator",
            description:
                "Based on your shopping list and community data, we suggest the nearest supermarket that has all your desired items in stock.",
            colorClass: "text-green-500 bg-green-500/10",
        },
        {
            id: "users",
            icon: <Users size={28} />,
            title: "Real-Time Shared Lists",
            description:
                "Collaborate with family or friends. Multiple people can add, edit, and check off items simultaneously without any conflicts.",
            colorClass: "text-purple-500 bg-purple-500/10",
        },
        {
            id: "ai",
            icon: <Brain size={28} />,
            title: "AI Shopping Assistant",
            description:
                "Instantly import recipes and lists using our AI agent. It automatically recognizes ingredients, quantities, and categorizes them for you.",
            colorClass: "text-amber-500 bg-amber-500/10",
        },
        {
            id: "tsp",
            icon: <Network size={28} />,
            title: "Multi-Agent TSP Routing",
            description:
                "Shopping with a group? Our Traveling Salesperson algorithms dynamically split the list and create synchronized, optimal routes for everyone.",
            colorClass: "text-cyan-500 bg-cyan-500/10",
        },
        {
            id: "indoor",
            icon: <Route size={28} />,
            title: "Optimized Indoor Routing",
            description:
                "Stop wandering around the store. We generate the shortest, most efficient indoor path to grab all the items on your list.",
            colorClass: "text-rose-500 bg-rose-500/10",
        },
    ];

    return (
        <div className="min-h-screen bg-bg flex flex-col font-sans transition-colors duration-300">
            {/* Navbar */}
            <header className="w-full px-6 py-4 bg-bg border-b border-border flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <Logo className="h-8 w-auto" alt="uCart Logo" />
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    <ThemeSwitcher />
                    <button
                        type="button"
                        onClick={() => navigate("/login")}
                        className="hidden sm:block px-4 py-2 text-text-muted font-bold hover:text-text-strong transition-colors"
                    >
                        Log In
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/register")}
                        className="inline-flex items-center gap-2 px-4 sm:px-[18px] py-2 sm:py-[9px] bg-accent text-text-on-accent rounded-md text-sm font-bold transition-all duration-200 ease-out shadow-[0_2px_10px_var(--color-accent-glow)] hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_18px_var(--color-accent-glow)] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-3"
                    >
                        Register
                    </button>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative pt-16 pb-20 sm:py-32 px-6 text-center overflow-hidden shrink-0">
                {/* Ambient Glow Blobs */}
                <div
                    className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-accent/8 blur-[100px] pointer-events-none"
                    style={{
                        animation:
                            "pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                    }}
                />
                <div
                    className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-purple-500/8 blur-[120px] pointer-events-none"
                    style={{
                        animation:
                            "pulse 10s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                    }}
                />

                <div className="relative z-10 max-w-4xl mx-auto">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-text-strong tracking-tight mb-6 leading-tight">
                        Find any product, instantly. <br />
                        <span className="text-accent">
                            Together we map the stores.
                        </span>
                    </h1>

                    <p className="text-base sm:text-lg text-text-muted mb-10 max-w-2xl mx-auto leading-relaxed">
                        The smart shopping assistant that learns from the
                        community. Find the exact shelf, get the optimal route,
                        and collaborate with your family in real-time.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            type="button"
                            onClick={() => navigate("/register")}
                            className="inline-flex justify-center items-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 bg-accent text-text-on-accent rounded-md text-base sm:text-lg font-bold transition-all duration-200 ease-out shadow-[0_2px_10px_var(--color-accent-glow)] hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_18px_var(--color-accent-glow)] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-3 w-full sm:w-auto"
                        >
                            Get Started Now!
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate("/login")}
                            className="sm:hidden inline-flex justify-center items-center gap-2 px-6 py-3.5 bg-bg-muted text-text-strong rounded-md text-base font-bold border border-border w-full"
                        >
                            Log In
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="bg-surface border-t border-border py-14 sm:py-20 shrink-0">
                <div className="max-w-6xl mx-auto px-5 sm:px-6 mb-8 sm:mb-10">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-text-strong tracking-tight mb-2">
                        Everything you need
                    </h2>
                    <p className="text-text-muted">
                        Scroll to explore our smart features
                    </p>
                </div>

                <div className="relative w-full group">
                    {/* Left Button */}
                    <button
                        type="button"
                        onClick={() => scroll("left")}
                        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-surface/85 backdrop-blur-md border border-border shadow-md text-text-strong opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all duration-300 hover:scale-105 hover:bg-surface cursor-pointer hidden md:flex"
                        aria-label="Scroll left"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    {/* Right Button */}
                    <button
                        type="button"
                        onClick={() => scroll("right")}
                        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-surface/85 backdrop-blur-md border border-border shadow-md text-text-strong opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all duration-300 hover:scale-105 hover:bg-surface cursor-pointer hidden md:flex"
                        aria-label="Scroll right"
                    >
                        <ChevronRight size={20} />
                    </button>

                    {/* biome-ignore lint/a11y/noStaticElementInteractions: Horizontal drag-to-scroll container */}
                    <div
                        ref={scrollContainerRef}
                        onMouseDown={handleMouseDown}
                        onMouseLeave={handleMouseLeave}
                        onMouseUp={handleMouseUp}
                        onMouseMove={handleMouseMove}
                        className="flex gap-4 sm:gap-6 px-5 sm:px-6 pb-4 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing select-none"
                        style={{
                            scrollbarWidth: "none",
                            msOverflowStyle: "none",
                        }}
                    >
                        {features.map((feature) => (
                            <div
                                key={feature.id}
                                className="shrink-0 w-[280px] sm:w-[340px] flex flex-col p-6 sm:p-8 rounded-2xl border border-border bg-bg shadow-sm transition-transform hover:-translate-y-1 duration-300"
                            >
                                <div
                                    className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 ${feature.colorClass}`}
                                >
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-extrabold text-text-strong mb-3 tracking-tight">
                                    {feature.title}
                                </h3>
                                <p className="text-base text-text-muted leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        ))}
                        <div className="shrink-0 w-2" aria-hidden="true" />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="w-full py-8 sm:py-10 flex flex-col items-center justify-center bg-bg border-t border-border shrink-0">
                <div className="flex items-center gap-2 mb-4 opacity-50">
                    <Logo
                        variant="icon"
                        className="h-6 w-auto"
                        alt="uCart Icon"
                    />
                    <span className="font-bold text-text-strong tracking-tight">
                        uCart
                    </span>
                </div>
                <p className="text-sm text-text-muted font-medium">
                    © {new Date().getFullYear()} uCart. Built for a smarter
                    shopping experience.
                </p>
            </footer>
        </div>
    );
};

export default LandingPage;
