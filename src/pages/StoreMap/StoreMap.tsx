import React, { useRef, useEffect, useState } from "react";
import "./StoreMap.css"; // Asta rămâne la fel pentru că e în același folder
import ListDetail from "../ListDetail/ListDetail"; // Am ieșit un folder în sus (..), apoi am intrat în ListDetail
// 1. Dummy GPS Data
const USER_GPS = { lat: 44.4268, lng: 26.1025 };

const PRODUCTS_GPS = [
    { id: 1, lat: 44.4269, lng: 26.1026 },
    { id: 2, lat: 44.4267, lng: 26.1023 },
    { id: 3, lat: 44.4268, lng: 26.1028 },
    { id: 4, lat: 44.427, lng: 26.1024 },
];

// 2. Conversion Configuration
const METERS_PER_DEGREE_LAT = 111320;
const PIXELS_PER_METER = 20;

// Helper function to convert GPS to relative X/Y pixels
function getRelativePixels(
    targetLat: number,
    targetLng: number,
    refLat: number,
    refLng: number,
) {
    const dLat = targetLat - refLat;
    const dLng = targetLng - refLng;

    const metersPerDegreeLng =
        METERS_PER_DEGREE_LAT * Math.cos(refLat * (Math.PI / 180));

    const x = dLng * metersPerDegreeLng * PIXELS_PER_METER;
    const y = -(dLat * METERS_PER_DEGREE_LAT) * PIXELS_PER_METER;

    return { x, y };
}

function StoreMap() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // --- STATE ---
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // STATE PENTRU SIDEBAR

    // --- REFS ---
    const lastPos = useRef({ x: 0, y: 0 });
    const activePointerId = useRef<number | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const offsetX = canvas.width / 2 + pan.x;
        const offsetY = canvas.height / 2 + pan.y;

        ctx.save();
        ctx.translate(offsetX, offsetY);

        // Draw Products
        PRODUCTS_GPS.forEach((product) => {
            const { x, y } = getRelativePixels(
                product.lat,
                product.lng,
                USER_GPS.lat,
                USER_GPS.lng,
            );

            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fillStyle = "red";
            ctx.fill();
        });

        // Draw User
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fillStyle = "blue";
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }, [pan]);

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (activePointerId.current === null) {
            activePointerId.current = e.pointerId;
            setIsDragging(true);
            lastPos.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDragging || e.pointerId !== activePointerId.current) return;

        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;

        setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (e.pointerId === activePointerId.current) {
            setIsDragging(false);
            activePointerId.current = null;
        }
    };

    return (
        <div className="container">
            <div className="navbar">
                <button
                    className="backButton"
                    onClick={() => window.history.back()}
                >
                    ←
                </button>
                <h3>In-store navigation</h3>

                {/* BUTON PENTRU DESCHIDERE/ÎNCHIDERE SIDEBAR */}
                <button
                    className="toggle-sidebar-btn"
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                    {isSidebarOpen ? "Close List ✕" : "Open List 🛒"}
                </button>
            </div>

            <div className="mapContainer">
                <canvas
                    ref={canvasRef}
                    className={`canvas ${isDragging ? "dragging" : ""}`}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                />
            </div>

            {/* CONTAINERUL PENTRU SIDEBAR */}
            <div className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
                <ListDetail />
            </div>
        </div>
    );
}

export default StoreMap;
