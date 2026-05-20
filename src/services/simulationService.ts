import { useStore } from "../context/useStore";

let simulationInterval: ReturnType<typeof setTimeout> | null = null;

export const startSimulation = async () => {
    const state = useStore.getState();
    const route = state.route;

    if (route.length === 0) {
        console.warn("No route to simulate.");
        return;
    }

    // Enable audio for simulation
    state.setIsAudioEnabled(true);
    state.setIsSimulationActive(true);

    // Initial delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    for (const point of route) {
        if (!useStore.getState().isSimulationActive) break;

        // Move user to the point
        useStore.getState().setUserLocation({
            lat: point.lat,
            lng: point.lng,
        });

        // Wait for audio instruction to likely finish (approx 5s per point)
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    state.setIsSimulationActive(false);
};

export const stopSimulation = () => {
    useStore.getState().setIsSimulationActive(false);
    if (simulationInterval) {
        clearTimeout(simulationInterval);
        simulationInterval = null;
    }
};
