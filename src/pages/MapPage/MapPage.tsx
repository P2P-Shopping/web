import { useNavigate } from "react-router-dom";
import { Card } from "../../components";
import { useStore } from "../../context/useStore";
import { loadRoute } from "../../services/loadRoute";

const MapPage = () => {
    const userLocation = useStore((state) => state.userLocation);
    const setTargetStoreLocation = useStore(
        (state) => state.setTargetStoreLocation,
    );
    const items = useStore((state) => state.items);
    const setStatus = useStore((state) => state.setStatus);
    const navigate = useNavigate();

    const handleMockGeofenceEntry = async () => {
        if (items.length === 0) {
            setStatus("Add some items to your list first!");
            return;
        }

        // 1. Simulate the store being exactly where the user is currently standing
        // This ensures the backend and the Canvas map have a valid anchor point
        setTargetStoreLocation({
            lat: userLocation.lat,
            lng: userLocation.lng,
        });

        // 2. Extract item IDs for the backend
        const productIds = items.map((item) => item.id);

        try {
            setStatus("Calculating route...");
            // 3. Fire the backend lazy-loading TSP math
            await loadRoute(productIds, userLocation.lat, userLocation.lng);

            // 4. Instantly switch to the indoor canvas Map
            navigate("/nav", { replace: true });
            setStatus("Navigating to store entrance");
        } catch (error) {
            console.error("Geofence entry simulation failed:", error);
            setStatus("Failed to calculate route. Please try again.");
        }
    };

    return (
        <div className="flex-1 p-7 max-w-[1200px] mx-auto w-full flex flex-col gap-6">
            <Card title="Live City Tracking">
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-text-muted font-medium">
                        Current GPS Coordinates:
                    </p>
                    <div className="flex items-center gap-4 p-4 bg-bg-muted rounded-xl border border-border">
                        <div className="flex-1 flex flex-col gap-1 items-center justify-center border-r border-border">
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                                Latitude
                            </span>
                            <span className="text-xl font-black text-text-strong font-mono">
                                {userLocation.lat.toFixed(5)}
                            </span>
                        </div>
                        <div className="flex-1 flex flex-col gap-1 items-center justify-center">
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                                Longitude
                            </span>
                            <span className="text-xl font-black text-text-strong font-mono">
                                {userLocation.lng.toFixed(5)}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>

            <Card title="Geofence Simulation">
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-text-muted leading-relaxed">
                        In production, the app automatically transitions to the
                        indoor map when your GPS gets within 150 meters of the
                        target store. For this demo, use the button below to
                        simulate crossing that threshold.
                    </p>

                    <button
                        type="button"
                        onClick={handleMockGeofenceEntry}
                        className="mt-2 w-full py-4 bg-accent text-text-on-accent rounded-xl font-bold tracking-wide transition-all hover:scale-[1.01] active:scale-[0.98] shadow-[0_4px_14px_var(--color-accent-glow)]"
                    >
                        🧪 Simulate Entering Store
                    </button>
                </div>
            </Card>
        </div>
    );
};

export default MapPage;
