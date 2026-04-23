import { useThemeStore } from "../../store/useThemeStore";

export default function ThemeSwitcher() {
    const { theme, toggleTheme } = useThemeStore();

    return (
        <button
            type="button"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-bg-muted text-text-strong transition-all duration-300 hover:bg-border active:scale-90 group relative overflow-hidden"
            onClick={toggleTheme}
            aria-label={`Current theme: ${theme}. Click to switch.`}
            title={`Current theme: ${theme}. Click to switch.`}
        >
            <div
                className={`relative flex flex-col transition-transform duration-500 ease-spring ${
                    theme === "light"
                        ? "translate-y-[33.33%]"
                        : theme === "dark"
                          ? "translate-y-[-33.33%]"
                          : "translate-y-0"
                }`}
            >
                {/* Sun Icon */}
                <div className="flex items-center justify-center w-9 h-9">
                    <svg
                        className="w-5 h-5 text-warning"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        role="img"
                        aria-labelledby="sun-title"
                    >
                        <title id="sun-title">Light Mode</title>
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                </div>

                {/* System/Monitor Icon */}
                <div className="flex items-center justify-center w-9 h-9">
                    <svg
                        className="w-5 h-5 text-accent"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        role="img"
                        aria-labelledby="system-title"
                    >
                        <title id="system-title">System Mode</title>
                        <rect
                            x="2"
                            y="3"
                            width="20"
                            height="14"
                            rx="2"
                            ry="2"
                        />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                </div>

                {/* Moon Icon */}
                <div className="flex items-center justify-center w-9 h-9">
                    <svg
                        className="w-5 h-5 text-accent"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        role="img"
                        aria-labelledby="moon-title"
                    >
                        <title id="moon-title">Dark Mode</title>
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                </div>
            </div>
        </button>
    );
}
