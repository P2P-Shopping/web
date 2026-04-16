import { useStore } from "../../context/useStore";
// 1. Import the Card
import { Card } from "../../components"; 
import "./MapPage.css";

const MapPage = () => {
  const userLocation = useStore((state) => state.userLocation);

  return (
    // 2. Wrap the content in the Card component!
    <Card title="Live GPS Tracking">
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
    </Card>
  );
};

export default MapPage;