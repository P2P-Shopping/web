import { useEffect } from "react";
import { useStore } from "../../context/useStore";
import { loadRoute } from "../../services/loadRoute";

const RoutePage = () => {
    const route = useStore((state) => state.route);

    useEffect(() => {
        loadRoute(
            [
                "33333333-c3d4-e5f6-a7b8-3456789012cd",
                "22222222-b2c3-d4e5-f6a7-2345678901bc",
                "11111111-a1b2-c3d4-e5f6-1234567890ab",
                "66666666-f6a7-b8c9-d0e1-6789012345f0",
                "55555555-e5f6-a7b8-c9d0-5678901234ef",
                "44444444-d4e5-f6a7-b8c9-4567890123de",
            ],
            47.156,
            27.587,
        );
    }, []);

    return (
        <div className="flex-1 p-7 max-w-[1200px] mx-auto w-full flex flex-col gap-6">
            <header className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-text-strong tracking-tighter">
                    My Route
                </h2>
                <span className="px-3 py-1 bg-accent/10 text-accent text-xs font-bold rounded-full uppercase tracking-wider">
                    {route.length} points
                </span>
            </header>

            <ul className="flex flex-col gap-3 list-none p-0 m-0">
                {route.map((point) => (
                    <li
                        key={point.itemId}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 bg-surface border border-border rounded-2xl shadow-sm hover:shadow-md transition-all group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 flex items-center justify-center bg-bg-muted rounded-full group-hover:bg-accent-subtle transition-colors">
                                <span className="text-xl">📍</span>
                            </div>
                            <span className="text-lg font-bold text-text-strong">
                                {point.name}
                            </span>
                        </div>

                        <div className="flex flex-col sm:items-end gap-1 text-[13px] font-mono text-text-muted">
                            <span>
                                Lat:{" "}
                                <strong className="text-text-strong">
                                    {point.lat.toFixed(6)}
                                </strong>
                            </span>
                            <span>
                                Lng:{" "}
                                <strong className="text-text-strong">
                                    {point.lng.toFixed(6)}
                                </strong>
                            </span>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default RoutePage;
