import { Card } from "../../components";
import { useStore } from "../../context/useStore";

const MapPage = () => {
    const userLocation = useStore((state) => state.userLocation);

    return (
        <div className="flex-1 p-7 max-w-[1200px] mx-auto w-full">
            <Card title="Live GPS Tracking">
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-text-muted font-medium">
                        Real-time simulated coordinates:
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
        </div>
    );
};

export default MapPage;
