import { useStore } from "../context/useStore";

let intervalId: number | null = null;

export const startMockEmitter = () => {
    if (intervalId) return;

    const { userLocation } = useStore.getState();
    let currentLat = userLocation?.lat ?? 47.151726;
    let currentLng = userLocation?.lng ?? 27.587914;

    intervalId = globalThis.setInterval(() => {
        currentLat += (Math.random() - 0.5) * 0.00005;
        currentLng += (Math.random() - 0.5) * 0.00005;

        useStore.getState().setUserLocation({
            lat: currentLat,
            lng: currentLng,
        });
        console.log("GPS Update:", currentLat, currentLng);
    }, 1000);
};

export const stopMockEmitter = () => {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
};
