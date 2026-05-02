import { useStore } from "../context/useStore";

let currentLat = 47.151726;
let currentLng = 27.587914;
let intervalId: ReturnType<typeof setInterval> | null = null;

export const startMockEmitter = () => {
    if (intervalId) return;

    const state = useStore.getState();
    currentLat = state.userLocation?.lat ?? 47.151726;
    currentLng = state.userLocation?.lng ?? 27.587914;

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
    }, 1000);
};

export const teleport = (lat: number, lng: number) => {
    currentLat = lat;
    currentLng = lng;
    useStore.getState().setUserLocation({ lat, lng });
};

export const stopMockEmitter = () => {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
};
