import { useEffect, useState } from "react";

export const useListPageEffects = () => {
    const [permissionStatus, setPermissionStatus] =
        useState<PermissionState | null>(null);
    const [showBanner, setShowBanner] = useState(true);
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        let isMounted = true;
        let permResult: PermissionStatus | null = null;

        const handler = () => {
            if (isMounted && permResult) setPermissionStatus(permResult.state);
        };

        if (navigator.permissions) {
            navigator.permissions
                .query({ name: "geolocation" })
                .then((result) => {
                    if (!isMounted) return;
                    permResult = result;
                    setPermissionStatus(result.state);
                    result.addEventListener("change", handler);
                })
                .catch(() => {});
        }

        return () => {
            isMounted = false;
            permResult?.removeEventListener("change", handler);
        };
    }, []);

    useEffect(() => {
        if (permissionStatus === "denied") {
            setShowBanner(true);
        }
    }, [permissionStatus]);

    useEffect(() => {
        const scrollContainer = document.querySelector("main");
        if (!scrollContainer) return;
        const handleScroll = () => {
            setIsScrolled(scrollContainer.scrollTop > 10);
        };
        scrollContainer.addEventListener("scroll", handleScroll, {
            passive: true,
        });
        return () =>
            scrollContainer.removeEventListener("scroll", handleScroll);
    }, []);

    return { permissionStatus, showBanner, setShowBanner, isScrolled };
};
