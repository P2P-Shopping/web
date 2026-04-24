import { List, LocateFixed, X, ZoomIn, ZoomOut } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import ListDetail from "../ListDetail/ListDetail";

interface Coordinate {
    lat: number;
    lng: number;
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

const USER_GPS_DEFAULT = { lat: 47.151726, lng: 27.587914 };

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

const generateLocalProducts = (centerGps: Coordinate): RoutePoint[] => {
    const latOffset = 0.00015;
    const lngOffset = 0.00015;

    return [
        {
            itemId: "1",
            lat: centerGps.lat + latOffset,
            lng: centerGps.lng + lngOffset,
            name: "Milk",
        },
        {
            itemId: "2",
            lat: centerGps.lat - latOffset,
            lng: centerGps.lng - lngOffset,
            name: "Bread",
        },
        {
            itemId: "3",
            lat: centerGps.lat + latOffset * 1.5,
            lng: centerGps.lng - lngOffset * 0.5,
            name: "Apples",
        },
        {
            itemId: "4",
            lat: centerGps.lat - latOffset * 0.8,
            lng: centerGps.lng + lngOffset * 1.2,
            name: "Coffee",
        },
    ];
};

const calculateNearestNeighborRoute = (
    startPoint: Point,
    products: RoutePoint[],
    anchor: Coordinate,
): RoutePoint[] => {
    const unvisited = [...products];
    const orderedRoute: RoutePoint[] = [];
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

interface RoutePoint {
    itemId: string;
    name: string;
    lat: number;
    lng: number;
}

const useMapEngine = (
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    listId: string | undefined,
) => {
    const [isDragging, setIsDragging] = useState(false);
    const [hasLocationLock, setHasLocationLock] = useState(false);
    const [gpsError, setGpsError] = useState<string | null>(null);
    const [isRouting, setIsRouting] = useState(false);

    const originGps = useRef<Coordinate | null>(null);
    const targetGps = useRef<Coordinate>({ lat: 0, lng: 0 });
    const currentRenderedGps = useRef<Coordinate>({ lat: 0, lng: 0 });
    const routePoints = useRef<RoutePoint[]>([]);
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
        const pointsToBound = [userPos];
        if (routePoints.current.length > 0) {
            for (const p of routePoints.current) {
                pointsToBound.push(getRelativePixels(p, anchor));
            }
        }

        const constraints = getCameraConstraints(
            pointsToBound,
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
        const controller = new AbortController();
        const fetchRoute = async () => {
            if (!listId || listId === "default") {
                if (originGps.current) {
                    routePoints.current = generateLocalProducts(
                        originGps.current,
                    );
                }
                return;
            }
            setIsRouting(true);
            try {
                const baseUrl =
                    import.meta.env.VITE_API_URL || "http://localhost:8081";
                const response = await fetch(
                    `${baseUrl}/api/routing/calculate`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        signal: controller.signal,
                        body: JSON.stringify({
                            listId: listId,
                            userLat:
                                targetGps.current.lat || USER_GPS_DEFAULT.lat,
                            userLng:
                                targetGps.current.lng || USER_GPS_DEFAULT.lng,
                        }),
                    },
                );

                if (controller.signal.aborted) return;

                if (response.ok) {
                    const data = await response.json();
                    if (data.route) {
                        const productsOnly: RoutePoint[] = data.route.filter(
                            (p: RoutePoint) => p.itemId !== "user_loc",
                        );
                        routePoints.current = productsOnly;
                    }
                }
            } catch (error) {
                if (controller.signal.aborted) return;
                console.error(error);
                if (originGps.current) {
                    routePoints.current = generateLocalProducts(
                        originGps.current,
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsRouting(false);
                }
            }
        };
        if (hasLocationLock) {
            fetchRoute();
        }
        return () => controller.abort();
    }, [listId, hasLocationLock]);

    useEffect(() => {
        if (!hasLocationLock) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || !originGps.current) return;

        const rootStyles = getComputedStyle(document.documentElement);
        const theme: ThemeColors = {
            product:
                rootStyles.getPropertyValue("--color-accent").trim() ||
                "#FF3366",
            user:
                rootStyles.getPropertyValue("--color-blue-neon").trim() ||
                "#00D4FF",
            route:
                rootStyles.getPropertyValue("--color-green-neon").trim() ||
                "#00FF66",
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

                if (routePoints.current.length > 0) {
                    const orderedRoute = calculateNearestNeighborRoute(
                        userPos,
                        routePoints.current,
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

                routePoints.current.forEach((product) => {
                    const { x, y } = getRelativePixels(product, anchor);
                    ctx.beginPath();
                    ctx.arc(x, y, 8 / camera.current.zoom, 0, Math.PI * 2);
                    ctx.fillStyle = theme.product;
                    ctx.fill();

                    ctx.fillStyle = "white";
                    ctx.font = `bold ${12 / camera.current.zoom}px Inter, sans-serif`;
                    ctx.fillText(
                        product.name,
                        x + 12 / camera.current.zoom,
                        y + 4 / camera.current.zoom,
                    );
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
            const newCoords = USER_GPS_DEFAULT;
            originGps.current = { ...newCoords };
            targetGps.current = { ...newCoords };
            currentRenderedGps.current = { ...newCoords };
            setHasLocationLock(true);
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const newCoords = { lat: latitude, lng: longitude };

                if (isFirstLocationUpdate.current) {
                    originGps.current = { ...newCoords };
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
                if (isFirstLocationUpdate.current) {
                    const newCoords = USER_GPS_DEFAULT;
                    originGps.current = { ...newCoords };
                    targetGps.current = { ...newCoords };
                    currentRenderedGps.current = { ...newCoords };
                    setHasLocationLock(true);
                    isFirstLocationUpdate.current = false;
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
            gestureState.current.initialPinchWorld = null;
        }
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

    const zoomIn = () => {
        const oldZoom = camera.current.zoom;
        const nextZoom = Math.min(oldZoom * 1.5, MAP_CONFIG.MAX_ZOOM);
        const zoomRatio = nextZoom / oldZoom;
        camera.current.zoom = nextZoom;
        camera.current.x *= zoomRatio;
        camera.current.y *= zoomRatio;
    };

    const zoomOut = () => {
        const oldZoom = camera.current.zoom;
        const nextZoom = Math.max(oldZoom / 1.5, MAP_CONFIG.MIN_ZOOM);
        const zoomRatio = nextZoom / oldZoom;
        camera.current.zoom = nextZoom;
        camera.current.x *= zoomRatio;
        camera.current.y *= zoomRatio;
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
        isRouting,
        recenterCamera,
        zoomIn,
        zoomOut,
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
    const { id: listId } = useParams<{ id: string }>();
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

    // Prevent browser scrolling when map is active
    useEffect(() => {
        const originalStyle = globalThis.getComputedStyle(
            document.body,
        ).overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, []);

    const {
        isDragging,
        hasLocationLock,
        gpsError,
        isRouting,
        handlers,
        recenterCamera,
        zoomIn,
        zoomOut,
    } = useMapEngine(canvasRef, listId);

    if (!hasLocationLock) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4 bg-bg">
                <div className="w-12 h-12 border-4 border-border border-t-accent rounded-full animate-spin" />
                <h2 className="text-xl font-bold text-text-strong tracking-tight">
                    {gpsError ? gpsError : "Acquiring GPS Signal... 🛰️"}
                </h2>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full overflow-hidden bg-bg-muted">
            <div
                className={`relative flex-1 overflow-hidden ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            >
                {isRouting && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-text-strong text-bg rounded-full text-xs font-bold shadow-lg animate-pulse">
                        Calculating route...
                    </div>
                )}

                <canvas
                    ref={canvasRef}
                    className="w-full h-full block bg-bg-muted touch-none"
                    {...handlers}
                />

                {gpsError && (
                    <div
                        className="absolute top-4 left-4 right-4 z-20 px-4 py-3 bg-danger text-white rounded-xl text-sm font-bold shadow-lg"
                        role="status"
                    >
                        {gpsError}
                    </div>
                )}

                {/* Sidebar Overlay (Mobile) */}
                {isSidebarExpanded && (
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-30 min-[1000px]:hidden animate-fade-in"
                        onClick={() => setIsSidebarExpanded(false)}
                        onKeyDown={(e) =>
                            e.key === "Escape" && setIsSidebarExpanded(false)
                        }
                        aria-label="Close list drawer"
                    />
                )}

                {/* Responsive Sidebar */}
                <div
                    aria-hidden={!isSidebarExpanded}
                    inert={!isSidebarExpanded ? true : undefined}
                    className={`
                        absolute z-30 transition-all duration-500 ease-spring
                        /* Desktop: Right-side Drawer */
                        min-[1000px]:top-0 min-[1000px]:bottom-0 min-[1000px]:right-0 
                        min-[1000px]:w-[400px] min-[1000px]:border-l min-[1000px]:border-border
                        ${
                            isSidebarExpanded
                                ? "min-[1000px]:translate-x-0"
                                : "min-[1000px]:translate-x-full"
                        }
                        
                        /* Mobile: Bottom Sheet */
                        max-[1000px]:left-0 max-[1000px]:right-0 max-[1000px]:bottom-0 
                        max-[1000px]:rounded-t-[32px] max-[1000px]:max-h-[85vh]
                        ${
                            isSidebarExpanded
                                ? "max-[1000px]:translate-y-0"
                                : "max-[1000px]:translate-y-full"
                        }
                        
                        ${!isSidebarExpanded ? "pointer-events-none" : ""}
                        bg-surface/90 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden
                    `}
                >
                    {/* Drag Handle for Mobile */}
                    <div className="min-[1000px]:hidden w-12 h-1.5 bg-border rounded-full mx-auto my-4 shrink-0" />

                    <div className="flex-1 overflow-y-auto px-1">
                        <ListDetail isEmbedded={true} />
                    </div>
                </div>
            </div>

            {/* Map Control Bar - Separated from map view */}
            <div className="relative z-40 bg-surface/80 backdrop-blur-xl border-t border-border h-[84px] px-6 flex items-center justify-between shadow-[0_-8px_30px_rgba(0,0,0,0.04)] shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        type="button"
                        className="w-12 h-12 flex items-center justify-center bg-accent text-text-on-accent rounded-full shadow-[0_4px_12px_var(--color-accent-glow)] transition-all hover:bg-accent-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                        onClick={(e) => {
                            e.stopPropagation();
                            recenterCamera();
                        }}
                        title="Recenter Map"
                    >
                        <LocateFixed size={20} />
                    </button>

                    <div className="flex items-center bg-bg-muted border border-border rounded-2xl p-1">
                        <button
                            type="button"
                            className="w-10 h-10 flex items-center justify-center text-text-strong hover:bg-surface rounded-xl transition-all active:scale-90"
                            onClick={(e) => {
                                e.stopPropagation();
                                zoomIn();
                            }}
                            title="Zoom In"
                        >
                            <ZoomIn size={18} />
                        </button>
                        <div className="w-px h-6 bg-border mx-1" />
                        <button
                            type="button"
                            className="w-10 h-10 flex items-center justify-center text-text-strong hover:bg-surface rounded-xl transition-all active:scale-90"
                            onClick={(e) => {
                                e.stopPropagation();
                                zoomOut();
                            }}
                            title="Zoom Out"
                        >
                            <ZoomOut size={18} />
                        </button>
                    </div>
                </div>

                <button
                    type="button"
                    className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 ${
                        isSidebarExpanded
                            ? "bg-accent text-text-on-accent"
                            : "bg-text-strong text-bg"
                    }`}
                    onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                    aria-label={isSidebarExpanded ? "Close List" : "Show List"}
                >
                    {isSidebarExpanded ? (
                        <X size={20} className="rotate-90" />
                    ) : (
                        <List size={20} />
                    )}
                    <span className="hidden sm:inline">
                        {isSidebarExpanded ? "Close List" : "View List"}
                    </span>
                </button>
            </div>
        </div>
    );
};

export default StoreMap;
