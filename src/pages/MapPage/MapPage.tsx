import { Card } from "../../components";
import { useStore } from "../../context/useStore";
import {
    DEMO_STORE_LOCATION,
    GEOFENCE_RADIUS_METERS,
    getDistanceMeters,
} from "../../services/geofence";

const MapPage = () => {
    const userLocation = useStore((state) => state.userLocation);
    const setUserLocation = useStore((state) => state.setUserLocation);
    const setTargetStoreLocation = useStore(
        (state) => state.setTargetStoreLocation,
    );
    const targetStoreLocation = useStore((state) => state.targetStoreLocation);
    const navigationMode = useStore((state) => state.navigationMode);
    const hasEnteredStore = useStore((state) => state.hasEnteredStore);
    const setNavigationMode = useStore((state) => state.setNavigationMode);
    const setHasEnteredStore = useStore((state) => state.setHasEnteredStore);
    const setStatus = useStore((state) => state.setStatus);

    const activeTarget = targetStoreLocation ?? {
        ...DEMO_STORE_LOCATION,
    };
    const currentDistance = getDistanceMeters(userLocation, activeTarget);
    const isInsideGeofence = currentDistance <= GEOFENCE_RADIUS_METERS;

    const handleMockGeofenceEntry = () => {
        setTargetStoreLocation(activeTarget);
        setUserLocation(activeTarget);
        setNavigationMode("city");
        setHasEnteredStore(false);
        setStatus("Geofence threshold reached. Waiting for app transition.");
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
                            <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
                                Latitude
                            </span>
                            <span className="text-xl font-black text-text-strong font-mono">
                                {userLocation.lat.toFixed(5)}
                            </span>
                        </div>
                        <div className="flex-1 flex flex-col gap-1 items-center justify-center">
                            <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
                                Longitude
                            </span>
                            <span className="text-xl font-black text-text-strong font-mono">
                                {userLocation.lng.toFixed(5)}
                            </span>
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 text-sm">
                        <div className="rounded-xl border border-border bg-bg-muted p-3">
                            <div className="text-xs font-bold uppercase tracking-widest text-text-muted">
                                Mode
                            </div>
                            <div className="mt-1 font-black text-text-strong">
                                {navigationMode === "city"
                                    ? "City map"
                                    : "Indoor canvas"}
                            </div>
                        </div>
                        <div className="rounded-xl border border-border bg-bg-muted p-3">
                            <div className="text-xs font-bold uppercase tracking-widest text-text-muted">
                                Geofence
                            </div>
                            <div className="mt-1 font-black text-text-strong">
                                {isInsideGeofence ? "Inside" : "Outside"}
                            </div>
                        </div>
                        <div className="rounded-xl border border-border bg-bg-muted p-3">
                            <div className="text-xs font-bold uppercase tracking-widest text-text-muted">
                                Distance
                            </div>
                            <div className="mt-1 font-black text-text-strong">
                                {currentDistance.toFixed(0)} m
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            <Card title="Geofence Simulation">
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-text-muted leading-relaxed">
                        In production, the app switches from the city map to the
                        indoor canvas when GPS gets within{" "}
                        {GEOFENCE_RADIUS_METERS} meters of the target store. The
                        local state manager now mirrors that transition and
                        keeps the indoor route ready.
                    </p>

                    <button
                        type="button"
                        onClick={handleMockGeofenceEntry}
                        className="mt-2 w-full py-4 bg-accent text-text-on-accent rounded-xl font-bold tracking-wide transition-all hover:scale-[1.01] active:scale-[0.98] shadow-[0_4px_14px_var(--color-accent-glow)]"
                    >
                        Simulate geofence crossing
                    </button>

                    {hasEnteredStore && (
                        <div className="rounded-xl border border-border bg-bg-muted p-3 text-sm text-text-muted">
                            Indoor navigation is active. The canvas renderer
                            will use the mock TSP route when the store view
                            opens.
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default MapPage;
