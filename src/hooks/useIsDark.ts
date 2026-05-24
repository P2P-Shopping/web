import { useEffect, useState } from "react";
import { useThemeStore } from "../store/useThemeStore";

export const useIsDark = (): boolean => {
    const { theme } = useThemeStore();
    const [isDark, setIsDark] = useState<boolean>(() => {
        if (theme === "dark") return true;
        if (theme === "light") return false;
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    });

    useEffect(() => {
        if (theme === "dark") {
            setIsDark(true);
            return;
        }
        if (theme === "light") {
            setIsDark(false);
            return;
        }

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (e: MediaQueryListEvent): void => {
            setIsDark(e.matches);
        };

        setIsDark(mediaQuery.matches);
        mediaQuery.addEventListener("change", handleChange);

        return () => {
            mediaQuery.removeEventListener("change", handleChange);
        };
    }, [theme]);

    return isDark;
};
