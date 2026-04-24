import { useStore } from "../context/useStore";

let intervalId: ReturnType<typeof setInterval> | null = null;

export const startMockEmitter = () => {
    if (intervalId) return;

    const state = useStore.getState();
    let currentLat = state.userLocation?.lat ?? 47.151726;
    let currentLng = state.userLocation?.lng ?? 27.587914;

    intervalId = setInterval(() => {
        // Secure pseudo-random location mock update
        const randArray = new Uint32Array(2);
        globalThis.crypto.getRandomValues(randArray);
        const randLat = randArray[0] / 4294967295;
        const randLng = randArray[1] / 4294967295;

        currentLat += (randLat - 0.5) * 0.00005;
        currentLng += (randLng - 0.5) * 0.00005;

        useStore.getState().setUserLocation({
            lat: currentLat,
            lng: currentLng,
        });
        if (import.meta.env.DEV) {
            console.log("GPS Update:", currentLat, currentLng);
        }
    }, 1000);
};

export const stopMockEmitter = () => {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
};
