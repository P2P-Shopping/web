import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface ThemeState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: "system",
            setTheme: (theme) => set({ theme }),
            toggleTheme: () => {
                const currentTheme = get().theme;
                if (currentTheme === "system") {
                    set({ theme: "light" });
                } else if (currentTheme === "light") {
                    set({ theme: "dark" });
                } else {
                    set({ theme: "system" });
                }
            },
        }),
        {
            name: "p2p-shopping-theme",
        },
    ),
);
