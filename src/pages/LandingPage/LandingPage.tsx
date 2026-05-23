import {
    Brain,
    MapPin,
    Network,
    Route,
    Sparkles,
    Store,
    Users,
} from "lucide-react";

import type React from "react";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import ucartIconLight from "../../assets/ucart-icon.svg";
import ucartIconDark from "../../assets/ucart-icon-dark.svg";

import ucartLogoLight from "../../assets/ucart-logo-text.svg";
import ucartLogoDark from "../../assets/ucart-logo-text-dark.svg";
import { ThemeSwitcher } from "../../components";
import { useThemeStore } from "../../store/useThemeStore";

const LandingPage: React.FC = () => {
    const { theme } = useThemeStore();

    const isDark =
        theme === "dark" ||
        (theme === "system" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches);

    const currentLogo = isDark ? ucartLogoDark : ucartLogoLight;
    const currentIcon = isDark ? ucartIconDark : ucartIconLight;

    const navigate = useNavigate();
    const scrollContainerRef = useRef<HTMLDivElement>(null);

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
            <header className="w-full px-7 py-5 bg-bg/95 backdrop-blur-md border-b border-border sticky top-0 z-50 flex justify-between items-center max-[600px]:p-4">
                <div className="flex items-center gap-2">
                    <img
                        src={currentLogo}
                        alt="uCart Logo"
                        className="h-8 w-auto"
                    />
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
            <main className="flex-grow flex flex-col items-center justify-center text-center px-4 pt-20 pb-16">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-bold mb-8">
                    <Sparkles size={16} />
                    <span>The next generation of shopping</span>
                </div>

                <h1 className="text-5xl sm:text-6xl max-w-4xl font-extrabold text-text-strong tracking-tight mb-6 leading-tight">
                    Find any product, instantly. <br />
                    <span className="text-accent">
                        Together we map the stores.
                    </span>
                </h1>

                <p className="text-lg text-text-muted mb-10 max-w-2xl leading-relaxed">
                    The smart shopping assistant that learns from the community.
                    Find the exact shelf, get the optimal route, and collaborate
                    with your family in real-time.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                        type="button"
                        onClick={() => navigate("/register")}
                        className="inline-flex justify-center items-center gap-2 px-8 py-4 bg-accent text-text-on-accent rounded-md text-lg font-bold transition-all duration-200 ease-out shadow-[0_2px_10px_var(--color-accent-glow)] hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_18px_var(--color-accent-glow)] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-3"
                    >
                        Get Started Now!
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/login")}
                        className="sm:hidden inline-flex justify-center items-center gap-2 px-8 py-4 bg-bg-muted text-text-strong rounded-md text-lg font-bold border border-border"
                    >
                        Log In
                    </button>
                </div>
            </main>

            {/* Sliding Features Section */}
            <section className="bg-surface py-20 border-t border-border">
                <div className="max-w-6xl mx-auto px-6 mb-10 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-extrabold text-text-strong tracking-tight mb-2">
                            Everything you need
                        </h2>
                        <p className="text-text-muted">
                            Swipe to explore our smart features
                        </p>
                    </div>
                </div>

                {/* Carousel Container */}
                <div
                    ref={scrollContainerRef}
                    className="flex overflow-x-auto snap-x snap-mandatory gap-6 px-6 pb-8 w-full scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                    {features.map((feature) => (
                        <div
                            key={feature.id}
                            className="shrink-0 w-[85vw] sm:w-[340px] snap-center flex flex-col p-8 rounded-2xl border border-border bg-bg shadow-sm transition-transform hover:-translate-y-1 duration-300"
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

                    {/* Spacer for the end of the scroll */}
                    <div className="shrink-0 w-4 sm:w-8" aria-hidden="true" />
                </div>
            </section>

            {/* Footer */}
            <footer className="w-full py-10 flex flex-col items-center justify-center bg-bg border-t border-border">
                <div className="flex items-center gap-2 mb-4 opacity-50">
                    <img
                        src={currentIcon}
                        alt="uCart Icon"
                        className="h-6 w-auto"
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
