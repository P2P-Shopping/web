import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeStore } from "../../store/useThemeStore";

export default function ThemeSwitcher() {
    const { theme, toggleTheme } = useThemeStore();

    return (
        <button
            type="button"
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-bg-muted text-text-strong transition-all duration-300 hover:bg-border active:scale-90 group relative overflow-hidden shadow-sm"
            onClick={toggleTheme}
            aria-label={`Current theme: ${theme}. Click to switch.`}
            title={`Current theme: ${theme}. Click to switch.`}
        >
            <div
                className={`relative flex flex-col transition-transform duration-500 ease-spring ${
                    theme === "light"
                        ? "translate-y-0"
                        : theme === "system"
                          ? "translate-y-[-33.33%]"
                          : "translate-y-[-66.66%]"
                }`}
            >
                {/* Sun Icon */}
                <div className="flex items-center justify-center w-10 h-10">
                    <Sun className="w-5 h-5 text-warning" />
                </div>

                {/* System/Monitor Icon */}
                <div className="flex items-center justify-center w-10 h-10">
                    <Monitor className="w-5 h-5 text-accent" />
                </div>

                {/* Moon Icon */}
                <div className="flex items-center justify-center w-10 h-10">
                    <Moon className="w-5 h-5 text-accent" />
                </div>
            </div>
        </button>
    );
}
