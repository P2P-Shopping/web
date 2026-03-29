import { useStore } from "../context/useStore";

const MapPage = () => {
  const userLocation = useStore((state) => state.userLocation);

  return (
    <section className="card">
      <h2 className="card-title">Live GPS Tracking</h2>
      <div className="gps-info">
        <p className="label">Real-time simulated coordinates:</p>
        <div className="coordinates">
          <span className="coord-box">
            Lat: <strong>{userLocation.lat.toFixed(5)}</strong>
          </span>
          <span className="coord-separator">|</span>
          <span className="coord-box">
            Lng: <strong>{userLocation.lng.toFixed(5)}</strong>
          </span>
        </div>
      </div>
    </section>
  );
};

export default MapPage;
