import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeStore } from "../../store/useThemeStore";

export default function ThemeSwitcher() {
    const { theme, toggleTheme } = useThemeStore();

    return (
        <button
            type="button"
            className="w-10 h-10 rounded-xl bg-bg-muted text-text-strong transition-all duration-300 hover:bg-border active:scale-90 group relative overflow-hidden shadow-sm border border-border"
            onClick={toggleTheme}
            aria-label={`Current theme: ${theme}. Click to switch.`}
            title={`Current theme: ${theme}. Click to switch.`}
        >
            <div className="relative w-full h-full flex items-center justify-center">
                {/* Sun Icon */}
                <div
                    className={`absolute transition-all duration-500 ease-spring ${
                        theme === "light"
                            ? "opacity-100 scale-100 rotate-0"
                            : "opacity-0 scale-50 rotate-90"
                    }`}
                >
                    <Sun className="w-5 h-5 text-warning fill-warning/10" />
                </div>

                {/* System/Monitor Icon */}
                <div
                    className={`absolute transition-all duration-500 ease-spring ${
                        theme === "system"
                            ? "opacity-100 scale-100 rotate-0"
                            : "opacity-0 scale-50 rotate-90"
                    }`}
                >
                    <Monitor className="w-5 h-5 text-accent" />
                </div>

                {/* Moon Icon */}
                <div
                    className={`absolute transition-all duration-500 ease-spring ${
                        theme === "dark"
                            ? "opacity-100 scale-100 rotate-0"
                            : "opacity-0 scale-50 rotate-90"
                    }`}
                >
                    <Moon className="w-5 h-5 text-accent fill-accent/10" />
                </div>
            </div>
        </button>
    );
}
