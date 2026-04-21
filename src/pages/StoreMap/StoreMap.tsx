import type React from "react";
import { useEffect, useRef, useState } from "react";
import "./StoreMap.css";
import ListDetail from "../ListDetail/ListDetail";

interface Coordinate {
    lat: number;
    lng: number;
}

interface Product extends Coordinate {
    id: number;
    name: string;
}

interface Point {
    x: number;
    y: number;
}

interface CameraState {
    x: number;
    y: number;
    zoom: number;
}

interface ThemeColors {
    product: string;
    user: string;
    route: string;
}

interface ViewportSize {
    width: number;
    height: number;
}

interface CameraBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

const MAP_CONFIG = {
    METERS_PER_DEGREE_LAT: 111320,
    PIXELS_PER_METER: 20,
    GLIDE_SPEED: 0.1,
    MIN_ZOOM: 0.3,
    MAX_ZOOM: 4,
    PAN_PADDING: 96,
};

const getRelativePixels = (
    target: Coordinate,
    reference: Coordinate,
): Point => {
    const dLat = target.lat - reference.lat;
    const dLng = target.lng - reference.lng;
    const metersPerDegreeLng =
        MAP_CONFIG.METERS_PER_DEGREE_LAT *
        Math.cos(reference.lat * (Math.PI / 180));
    const x = dLng * metersPerDegreeLng * MAP_CONFIG.PIXELS_PER_METER;
    const y =
        -(dLat * MAP_CONFIG.METERS_PER_DEGREE_LAT) *
        MAP_CONFIG.PIXELS_PER_METER;
    return { x, y };
};

const generateLocalProducts = (centerGps: Coordinate): Product[] => {
    const latOffset = 0.00015;
    const lngOffset = 0.00015;

    return [
        {
            id: 1,
            lat: centerGps.lat + latOffset,
            lng: centerGps.lng + lngOffset,
            name: "Milk",
        },
        {
            id: 2,
            lat: centerGps.lat - latOffset,
            lng: centerGps.lng - lngOffset,
            name: "Bread",
        },
        {
            id: 3,
            lat: centerGps.lat + latOffset * 1.5,
            lng: centerGps.lng - lngOffset * 0.5,
            name: "Apples",
        },
        {
            id: 4,
            lat: centerGps.lat - latOffset * 0.8,
            lng: centerGps.lng + lngOffset * 1.2,
            name: "Coffee",
        },
    ];
};

const calculateNearestNeighborRoute = (
    startPoint: Point,
    products: Product[],
    anchor: Coordinate,
): Product[] => {
    const unvisited = [...products];
    const orderedRoute: Product[] = [];
    let currentPoint = { ...startPoint };

    while (unvisited.length > 0) {
        let nearestIdx = 0;
        let minDist = Infinity;
        for (let i = 0; i < unvisited.length; i++) {
            const pPx = getRelativePixels(unvisited[i], anchor);
            const dist = Math.hypot(
                pPx.x - currentPoint.x,
                pPx.y - currentPoint.y,
            );
            if (dist < minDist) {
                minDist = dist;
                nearestIdx = i;
            }
        }
        const nearestProduct = unvisited[nearestIdx];
        orderedRoute.push(nearestProduct);
        currentPoint = getRelativePixels(nearestProduct, anchor);
        unvisited.splice(nearestIdx, 1);
    }

    return orderedRoute;
};

const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

const getBounds = (points: Point[]): CameraBounds | null => {
    if (points.length === 0) return null;

    return points.slice(1).reduce(
        (bounds, point) => ({
            minX: Math.min(bounds.minX, point.x),
            maxX: Math.max(bounds.maxX, point.x),
            minY: Math.min(bounds.minY, point.y),
            maxY: Math.max(bounds.maxY, point.y),
        }),
        {
            minX: points[0].x,
            maxX: points[0].x,
            minY: points[0].y,
            maxY: points[0].y,
        },
    );
};

const getCameraConstraints = (
    points: Point[],
    viewport: ViewportSize,
    zoom: number,
    padding: number,
): CameraBounds | null => {
    const bounds = getBounds(points);
    if (!bounds) return null;

    const halfWidth = viewport.width / 2;
    const halfHeight = viewport.height / 2;

    return {
        minX: padding - halfWidth - bounds.minX * zoom,
        maxX: halfWidth - padding - bounds.maxX * zoom,
        minY: padding - halfHeight - bounds.minY * zoom,
        maxY: halfHeight - padding - bounds.maxY * zoom,
    };
};

const useMapEngine = (canvasRef: React.RefObject<HTMLCanvasElement | null>) => {
    const [isDragging, setIsDragging] = useState(false);
    const [hasLocationLock, setHasLocationLock] = useState(false);
    const [gpsError, setGpsError] = useState<string | null>(null);

    const originGps = useRef<Coordinate | null>(null);
    const targetGps = useRef<Coordinate>({ lat: 0, lng: 0 });
    const currentRenderedGps = useRef<Coordinate>({ lat: 0, lng: 0 });
    const localProducts = useRef<Product[]>([]);
    const isFirstLocationUpdate = useRef(true);
    const camera = useRef<CameraState>({ x: 0, y: 0, zoom: 1 });
    const lastPanPoint = useRef<Point | null>(null);
    const gestureState = useRef<{
        initialDist: number;
        initialZoom: number;
        initialPinchWorld: Point | null;
    }>({ initialDist: 0, initialZoom: 1, initialPinchWorld: null });

    const clampCameraPosition = (
        nextX: number,
        nextY: number,
        nextZoom = camera.current.zoom,
    ) => {
        const canvas = canvasRef.current;
        const anchor = originGps.current;

        if (!canvas || !anchor) {
            camera.current.x = nextX;
            camera.current.y = nextY;
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const viewport = {
            width: Math.max(1, Math.round(rect.width || window.innerWidth)),
            height: Math.max(1, Math.round(rect.height || window.innerHeight)),
        };

        const userPos = getRelativePixels(currentRenderedGps.current, anchor);
        const productPoints = localProducts.current.map((product) =>
            getRelativePixels(product, anchor),
        );
        const constraints = getCameraConstraints(
            [userPos, ...productPoints],
            viewport,
            nextZoom,
            MAP_CONFIG.PAN_PADDING,
        );

        if (!constraints) {
            camera.current.x = nextX;
            camera.current.y = nextY;
            return;
        }

        camera.current.x = clamp(nextX, constraints.minX, constraints.maxX);
        camera.current.y = clamp(nextY, constraints.minY, constraints.maxY);
    };

    useEffect(() => {
        if (!hasLocationLock) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || !originGps.current) return;

        const rootStyles = getComputedStyle(document.documentElement);
        const theme: ThemeColors = {
            product:
                rootStyles.getPropertyValue("--red-neon").trim() || "#FF3366",
            user:
                rootStyles.getPropertyValue("--blue-neon").trim() || "#00D4FF",
            route:
                rootStyles.getPropertyValue("--green-neon").trim() || "#00FF66",
        };

        let animationFrameId: number;
        let consecutiveErrors = 0;
        let lastTime: number | null = null;

        const renderLoop = (timestamp: number) => {
            if (lastTime === null) lastTime = timestamp;
            const dt = (timestamp - lastTime) / 1000;
            lastTime = timestamp;

            const safeDt = Math.min(dt, 0.1);

            let didSave = false;
            try {
                const rect = canvas.parentElement?.getBoundingClientRect();
                const targetW = Math.max(
                    1,
                    Math.round(rect?.width || window.innerWidth),
                );
                const targetH = Math.max(
                    1,
                    Math.round(rect?.height || window.innerHeight),
                );
                const dpr = window.devicePixelRatio || 1;
                const backingW = Math.max(1, Math.round(targetW * dpr));
                const backingH = Math.max(1, Math.round(targetH * dpr));

                if (canvas.style.width !== `${targetW}px`)
                    canvas.style.width = `${targetW}px`;
                if (canvas.style.height !== `${targetH}px`)
                    canvas.style.height = `${targetH}px`;
                if (canvas.width !== backingW) canvas.width = backingW;
                if (canvas.height !== backingH) canvas.height = backingH;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, targetW, targetH);

                const decayRate = MAP_CONFIG.GLIDE_SPEED * 60;
                const lerpFactor = 1 - Math.exp(-decayRate * safeDt);

                currentRenderedGps.current.lat +=
                    (targetGps.current.lat - currentRenderedGps.current.lat) *
                    lerpFactor;
                currentRenderedGps.current.lng +=
                    (targetGps.current.lng - currentRenderedGps.current.lng) *
                    lerpFactor;

                ctx.save();
                didSave = true;
                ctx.translate(
                    targetW / 2 + camera.current.x,
                    targetH / 2 + camera.current.y,
                );
                ctx.scale(camera.current.zoom, camera.current.zoom);

                const anchor = originGps.current;
                if (!anchor) return;
                const userPos = getRelativePixels(
                    currentRenderedGps.current,
                    anchor,
                );

                if (localProducts.current.length > 0) {
                    const orderedRoute = calculateNearestNeighborRoute(
                        userPos,
                        localProducts.current,
                        anchor,
                    );

                    ctx.beginPath();
                    ctx.strokeStyle = theme.route;
                    ctx.lineWidth = 4 / camera.current.zoom;
                    ctx.setLineDash([
                        10 / camera.current.zoom,
                        10 / camera.current.zoom,
                    ]);
                    ctx.moveTo(userPos.x, userPos.y);
                    orderedRoute.forEach((product) => {
                        const { x, y } = getRelativePixels(product, anchor);
                        ctx.lineTo(x, y);
                    });
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                localProducts.current.forEach((product) => {
                    const { x, y } = getRelativePixels(product, anchor);
                    ctx.beginPath();
                    ctx.arc(x, y, 8 / camera.current.zoom, 0, Math.PI * 2);
                    ctx.fillStyle = theme.product;
                    ctx.fill();
                });

                ctx.beginPath();
                ctx.arc(
                    userPos.x,
                    userPos.y,
                    12 / camera.current.zoom,
                    0,
                    Math.PI * 2,
                );
                ctx.fillStyle = theme.user;
                ctx.fill();
                ctx.strokeStyle = "white";
                ctx.lineWidth = 2 / camera.current.zoom;
                ctx.stroke();

                consecutiveErrors = 0;
            } catch (err) {
                console.error("Map Render Glitch:", err);
                consecutiveErrors++;
            } finally {
                if (didSave) ctx.restore();
                if (consecutiveErrors < 5) {
                    animationFrameId = requestAnimationFrame(renderLoop);
                }
            }
        };

        animationFrameId = requestAnimationFrame(renderLoop);
        return () => cancelAnimationFrame(animationFrameId);
    }, [canvasRef, hasLocationLock]);

    useEffect(() => {
        if (!("geolocation" in navigator)) {
            setGpsError("Geolocation is not supported by your browser.");
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const newCoords = { lat: latitude, lng: longitude };

                if (isFirstLocationUpdate.current) {
                    originGps.current = { ...newCoords };
                    localProducts.current = generateLocalProducts(newCoords);
                    targetGps.current = { ...newCoords };
                    currentRenderedGps.current = { ...newCoords };

                    isFirstLocationUpdate.current = false;
                    setGpsError(null);
                    setHasLocationLock(true);
                } else {
                    targetGps.current = { ...newCoords };
                    setGpsError(null);
                    setHasLocationLock(true);
                }
            },
            (error) => {
                console.warn("GPS Error:", error.message);

                if (error.code === error.PERMISSION_DENIED) {
                    setGpsError(
                        "Location access denied. Please allow GPS to use the map.",
                    );
                } else if (error.code === error.TIMEOUT) {
                    setGpsError(
                        "GPS signal lost. Make sure you are outside or have clear sky view.",
                    );
                } else {
                    setGpsError("Unable to acquire GPS signal.");
                }

                if (error.code === error.PERMISSION_DENIED) {
                    setHasLocationLock(false);
                }
            },
            {
                enableHighAccuracy: true,
                maximumAge: 10000,
                timeout: 27000,
            },
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length === 1) {
            lastPanPoint.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
            };
            setIsDragging(true);
        } else if (e.touches.length === 2) {
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dist = Math.hypot(
                t2.clientX - t1.clientX,
                t2.clientY - t1.clientY,
            );

            if (dist < 1) return;

            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();

            const pinchScreenX = (t1.clientX + t2.clientX) / 2 - rect.left;
            const pinchScreenY = (t1.clientY + t2.clientY) / 2 - rect.top;

            gestureState.current.initialDist = dist;
            gestureState.current.initialZoom = camera.current.zoom;
            gestureState.current.initialPinchWorld = {
                x:
                    (pinchScreenX - rect.width / 2 - camera.current.x) /
                    camera.current.zoom,
                y:
                    (pinchScreenY - rect.height / 2 - camera.current.y) /
                    camera.current.zoom,
            };
        }
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length === 1 && lastPanPoint.current) {
            const t = e.touches[0];
            const nextX =
                camera.current.x + (t.clientX - lastPanPoint.current.x);
            const nextY =
                camera.current.y + (t.clientY - lastPanPoint.current.y);
            clampCameraPosition(nextX, nextY);
            lastPanPoint.current = { x: t.clientX, y: t.clientY };
        } else if (
            e.touches.length === 2 &&
            gestureState.current.initialPinchWorld
        ) {
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dist = Math.hypot(
                t2.clientX - t1.clientX,
                t2.clientY - t1.clientY,
            );

            if (gestureState.current.initialDist < 1) return;

            const scaleRatio = dist / gestureState.current.initialDist;
            let newZoom = gestureState.current.initialZoom * scaleRatio;
            if (Number.isNaN(newZoom) || !Number.isFinite(newZoom)) return;
            newZoom = Math.min(
                Math.max(newZoom, MAP_CONFIG.MIN_ZOOM),
                MAP_CONFIG.MAX_ZOOM,
            );

            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();

            const pinchScreenX = (t1.clientX + t2.clientX) / 2 - rect.left;
            const pinchScreenY = (t1.clientY + t2.clientY) / 2 - rect.top;

            const nextX =
                pinchScreenX -
                rect.width / 2 -
                gestureState.current.initialPinchWorld.x * newZoom;
            const nextY =
                pinchScreenY -
                rect.height / 2 -
                gestureState.current.initialPinchWorld.y * newZoom;
            camera.current.zoom = newZoom;
            clampCameraPosition(nextX, nextY, newZoom);
        }
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length === 1) {
            lastPanPoint.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
            };
        } else {
            lastPanPoint.current = null;
            setIsDragging(false);
        }
        gestureState.current.initialPinchWorld = null;
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsDragging(true);
        lastPanPoint.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDragging || !lastPanPoint.current) return;
        const nextX = camera.current.x + (e.clientX - lastPanPoint.current.x);
        const nextY = camera.current.y + (e.clientY - lastPanPoint.current.y);
        clampCameraPosition(nextX, nextY);
        lastPanPoint.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseUp = () => {
        setIsDragging(false);
        lastPanPoint.current = null;
    };

    const recenterCamera = () => {
        if (!originGps.current) return;

        const userPos = getRelativePixels(
            currentRenderedGps.current,
            originGps.current,
        );
        clampCameraPosition(
            -userPos.x * camera.current.zoom,
            -userPos.y * camera.current.zoom,
        );
    };

    return {
        isDragging,
        hasLocationLock,
        gpsError,
        recenterCamera,
        handlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
            onTouchCancel: handleTouchEnd,
            onMouseDown: handleMouseDown,
            onMouseMove: handleMouseMove,
            onMouseUp: handleMouseUp,
            onMouseLeave: handleMouseUp,
        },
    };
};

const StoreMap: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { isDragging, hasLocationLock, gpsError, handlers, recenterCamera } =
        useMapEngine(canvasRef);

    if (!hasLocationLock) {
        return (
            <div className="map-loading-screen">
                <h2>{gpsError ? gpsError : "Acquiring GPS Signal... 🛰️"}</h2>
            </div>
        );
    }

    return (
        <div className={`mapContainer ${isDragging ? "dragging" : ""}`}>
            <canvas ref={canvasRef} className="map-canvas" {...handlers} />

            {gpsError && hasLocationLock && (
                <div className="map-status-banner" role="status">
                    {gpsError}
                </div>
            )}

            <button
                type="button"
                className="recenter-button"
                onClick={(e) => {
                    e.stopPropagation();
                    recenterCamera();
                }}
            >
                RECENTER
            </button>

            <ListDetail isEmbedded={true} />
        </div>
    );
};

export default StoreMap;