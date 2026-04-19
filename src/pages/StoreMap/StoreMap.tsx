import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import "./StoreMap.css";
import ListDetail from "../ListDetail/ListDetail";

const USER_GPS = { lat: 47.151726, lng: 27.587914 };
const rootStyles = getComputedStyle(document.documentElement);
const productColor = rootStyles.getPropertyValue("--product-dot").trim() || "#FF3366";
const userColor = rootStyles.getPropertyValue("--user-dot").trim() || "#00D4FF";

const METERS_PER_DEGREE_LAT = 111320;
const PIXELS_PER_METER = 20;

function getRelativePixels(targetLat: number, targetLng: number, refLat: number, refLng: number) {
    const dLat = targetLat - refLat;
    const dLng = targetLng - refLng;
    const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(refLat * (Math.PI / 180));
    const x = dLng * metersPerDegreeLng * PIXELS_PER_METER;
    const y = -(dLat * METERS_PER_DEGREE_LAT) * PIXELS_PER_METER;
    return { x, y };
}

const StoreMap = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { id: listId } = useParams<{ id: string }>();
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [routePoints, setRoutePoints] = useState<any[]>([]);
    const [isRouting, setIsRouting] = useState<boolean>(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const activePointerId = useRef<number | null>(null);

    useEffect(() => {
        const fetchRoute = async () => {
            if (!listId || listId === "default") return;
            setIsRouting(true);
            try {
                const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8081";
                const response = await fetch(`${baseUrl}/api/routing/calculate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ listId: listId, userLat: USER_GPS.lat, userLng: USER_GPS.lng })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.route) { 
                        const productsOnly = data.route.filter((p: any) => p.itemId !== "user_loc");
                        setRoutePoints(productsOnly);
                    }
                }
            } catch (error) { console.error(error); } finally { setIsRouting(false); }
        };
        fetchRoute();
    }, [listId]);

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
        routePoints.forEach((product) => {
            const { x, y } = getRelativePixels(product.lat, product.lng, USER_GPS.lat, USER_GPS.lng);
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fillStyle = productColor;
            ctx.fill();
            ctx.fillStyle = "white";
            ctx.font = "12px Arial";
            ctx.fillText(product.name, x + 12, y + 4);
        });
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fillStyle = userColor;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }, [pan, routePoints]);

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
        <div className="mapContainer">
            {isRouting && <div className="routing-loader">Calculating route...</div>}
            <canvas
                ref={canvasRef}
                className={`canvas ${isDragging ? "dragging" : ""}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerCancel={handlePointerUp}
            />
            {/* ListDetail gestionează acum singur butonul și starea sa de deschidere */}
            <ListDetail isEmbedded={true} />
        </div>
    );
};

export default StoreMap;