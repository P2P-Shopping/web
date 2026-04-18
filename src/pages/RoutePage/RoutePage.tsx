import { useEffect } from "react";
import { useStore } from "../../context/useStore";
import { loadMockRoute } from "../../services/loadRoute";

import "./RoutePage.css";

const RoutePage = () => {
    const route = useStore((state) => state.route);

    useEffect(() => {
        loadMockRoute();
    }, []);

    return (
        <div className="route-page-container">
            <div className="section-header">
                <h2>My Route</h2>
                <span className="count-badge">{route.length} points</span>
            </div>

            <ul className="route-list">
                {route.map((point) => (
                    <li key={point.itemId} className="route-item">
                        <div className="point-info">
                            <span className="point-icon">📍</span>
                            <span className="point-name">{point.name}</span>
                        </div>

                        {/* Split into two spans to force the wrap seen in the screenshot */}
                        <div className="point-coords">
                            <span>Lat: {point.lat.toFixed(6)} • Lng:</span>
                            <span>{point.lng.toFixed(6)}</span>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default RoutePage;
