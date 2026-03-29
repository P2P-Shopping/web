import { useEffect } from "react";
import { useStore } from "../context/useStore";
import { loadMockRoute } from "../services/loadRoute";

const RoutePage = () => {
  const route = useStore((state) => state.route);

  useEffect(() => {
    loadMockRoute();
  }, []);

  return (
    <>
      <div className="section-header">
        <h3>My Route</h3>
        <span className="count-badge">{route.length} puncte</span>
      </div>

      <ul className="route-list">
        {route.map((point, index) => (
          <li key={index} className="route-item">
            <div className="point-info">
              <span className="point-icon">📍</span>
              <span className="point-name">{point.name}</span>
            </div>
            <div className="point-coords">
              Lat: {point.lat.toFixed(6)} • Lng: {point.lng.toFixed(6)}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
};

export default RoutePage;
