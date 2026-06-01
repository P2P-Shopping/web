import {
    ArrowLeft,
    List,
    LocateFixed,
    Navigation,
    Play,
    Square,
    X,
    ZoomIn,
    ZoomOut,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import Modal from "../../components/Modal/Modal";
import { useStore } from "../../context/useStore";
import { getApiBaseUrl } from "../../services/api";
import {
    startSimulation,
    stopSimulation,
} from "../../services/simulationService";

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
    productNotFound: string;
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
    MIN_ZOOM: 0.05,
    MAX_ZOOM: 4,
    PAN_PADDING: 96,
};

const USER_GPS_DEFAULT = { lat: 47.151726, lng: 27.587914 };

// Removed hardcoded store bounds and SVG.

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

const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

function getShelfPosition(
    x: number,
    y: number,
    instruction: string,
    shelfWidth: number,
    shelfHeight: number,
    zoom: number,
): { shelfX: number; shelfY: number } {
    if (instruction.includes("dreapta")) {
        return { shelfX: x - 5 / zoom, shelfY: y - shelfHeight / 2 };
    }
    if (instruction.includes("stânga") || instruction.includes("stanga")) {
        return {
            shelfX: x - shelfWidth + 5 / zoom,
            shelfY: y - shelfHeight / 2,
        };
    }
    return { shelfX: x - shelfWidth / 2, shelfY: y - shelfHeight + 5 / zoom };
}

function drawShelves(
    ctx: CanvasRenderingContext2D,
    storeRoute: ReturnType<typeof useStore.getState>["route"],
    anchor: Coordinate,
    storePolygon: Coordinate[] | null,
    zoom: number,
) {
    if (storeRoute.length === 0) return;

    ctx.save();
    if (storePolygon && storePolygon.length > 0) {
        ctx.beginPath();
        storePolygon.forEach((coord, idx) => {
            const p = getRelativePixels(coord, anchor);
            if (idx === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.clip();
    }

    ctx.fillStyle = "#2D2D3A";
    ctx.strokeStyle = "#4A4A5A";
    ctx.lineWidth = 2 / zoom;

    storeRoute.forEach((product) => {
        if (
            product.type === "USER" ||
            product.itemId === "user_loc" ||
            product.name === "Tu"
        )
            return;
        const { x, y } = getRelativePixels(product, anchor);
        const instruction = (product.audio_instruction || "").toLowerCase();
        const shelfWidth = 40 / zoom;
        const shelfHeight = 80 / zoom;
        const shelfRadius = 4 / zoom;
        const { shelfX, shelfY } = getShelfPosition(
            x,
            y,
            instruction,
            shelfWidth,
            shelfHeight,
            zoom,
        );

        ctx.beginPath();
        ctx.roundRect(shelfX, shelfY, shelfWidth, shelfHeight, shelfRadius);
        ctx.fill();
        ctx.stroke();
    });
    ctx.restore();
}

function drawRouteArrows(
    ctx: CanvasRenderingContext2D,
    storeRoute: ReturnType<typeof useStore.getState>["route"],
    userPos: Point,
    anchor: Coordinate,
    theme: ThemeColors,
    timestamp: number,
    zoom: number,
) {
    if (storeRoute.length === 0) return;

    const pulseIntensity = Math.abs(Math.sin(timestamp / 500)) / 2 + 0.5;

    ctx.beginPath();
    ctx.strokeStyle = theme.route;
    ctx.lineWidth = 4 / zoom;
    ctx.globalAlpha = pulseIntensity;
    ctx.setLineDash([10 / zoom, 10 / zoom]);
    ctx.moveTo(userPos.x, userPos.y);

    let lastP = userPos;
    storeRoute.forEach((product) => {
        const { x, y } = getRelativePixels(product, anchor);
        ctx.lineTo(lastP.x, y);
        ctx.lineTo(x, y);
        lastP = { x, y };
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    if (zoom > 1.2) {
        ctx.fillStyle = theme.route;
        storeRoute.forEach((product) => {
            if (
                product.type === "USER" ||
                product.itemId === "user_loc" ||
                product.name === "Tu"
            )
                return;
            const { x, y } = getRelativePixels(product, anchor);
            ctx.beginPath();
            ctx.arc(x, y, 10 / zoom, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

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
    const [isRouting, setIsRouting] = useState(false);

    const originGps = useRef<Coordinate | null>(null);
    const targetGps = useRef<Coordinate>({ lat: 0, lng: 0 });
    const currentRenderedGps = useRef<Coordinate>({ lat: 0, lng: 0 });
    const isFirstLocationUpdate = useRef(true);
    const camera = useRef<CameraState>({ x: 0, y: 0, zoom: 1 });
    const userLocation = useStore((state) => state.userLocation);
    const setNavigationMode = useStore((state) => state.setNavigationMode);
    const lastPanPoint = useRef<Point | null>(null);
    const gestureState = useRef<{
        initialDist: number;
        initialZoom: number;
        initialPinchWorld: Point | null;
    }>({ initialDist: 0, initialZoom: 1, initialPinchWorld: null });

    // Removed static SVG background.

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
            width: Math.max(1, Math.round(rect.width || globalThis.innerWidth)),
            height: Math.max(
                1,
                Math.round(rect.height || globalThis.innerHeight),
            ),
        };

        const pointsToBound = [];
        if (storeRoute.length > 0) {
            for (const p of storeRoute) {
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

    const storeRoute = useStore((state) => state.route);
    const targetStoreId = useStore((state) => state.targetStoreId);

    // --- NOU: Stare pentru Perimetrul Magazinului (GeoJSON Polygon) ---
    const [storePolygon, setStorePolygon] = useState<Coordinate[] | null>(null);

    useEffect(() => {
        if (!targetStoreId) return;
        const fetchPolygon = async () => {
            try {
                const baseUrl = getApiBaseUrl();
                const res = await fetch(
                    `${baseUrl}/api/routing/store/${targetStoreId}/polygon`,
                    {
                        headers: {
                            Authorization: `Bearer ${useStore.getState().token}`,
                        },
                        credentials: "include",
                    },
                );
                if (res.ok) {
                    const geojsonStr = await res.text();
                    const geojson = JSON.parse(geojsonStr);
                    if (
                        geojson.type === "Polygon" &&
                        geojson.coordinates.length > 0
                    ) {
                        const coords = geojson.coordinates[0].map(
                            (c: [number, number]) => ({
                                lng: c[0],
                                lat: c[1],
                            }),
                        );
                        setStorePolygon(coords);
                    }
                }
            } catch (err) {
                console.warn("Could not fetch store polygon", err);
            }
        };
        fetchPolygon();
    }, [targetStoreId]);

    const centerOnPolygon = () => {
        if (!storePolygon || storePolygon.length === 0 || !originGps.current)
            return;
        let sumLat = 0;
        let sumLng = 0;
        storePolygon.forEach((p) => {
            sumLat += p.lat;
            sumLng += p.lng;
        });
        const centerLat = sumLat / storePolygon.length;
        const centerLng = sumLng / storePolygon.length;

        const anchor = originGps.current;
        const centerPixels = getRelativePixels(
            { lat: centerLat, lng: centerLng },
            anchor,
        );
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Calculate bounds of polygon to determine zoom
        let minX = Number.POSITIVE_INFINITY,
            maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY,
            maxY = Number.NEGATIVE_INFINITY;
        storePolygon.forEach((coord) => {
            const p = getRelativePixels(coord, anchor);
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        });

        const polyWidth = maxX - minX;
        const polyHeight = maxY - minY;

        let newZoom = camera.current.zoom;
        if (polyWidth > 0 && polyHeight > 0) {
            const zoomX = rect.width / (polyWidth * 1.2);
            const zoomY = rect.height / (polyHeight * 1.2);
            newZoom = clamp(
                Math.min(zoomX, zoomY),
                MAP_CONFIG.MIN_ZOOM,
                MAP_CONFIG.MAX_ZOOM,
            );
        }

        camera.current.zoom = newZoom;
        clampCameraPosition(
            -centerPixels.x * newZoom,
            -centerPixels.y * newZoom,
            newZoom,
        );
    };

    // Recalculează bounds-urile magazinului
    // biome-ignore lint/correctness/useExhaustiveDependencies: centerOnPolygon causes render loop
    useEffect(() => {
        if (storePolygon && storePolygon.length > 0 && hasLocationLock) {
            centerOnPolygon();
        }
    }, [storePolygon, hasLocationLock]);

    useEffect(() => {
        if (!hasLocationLock) return;
        setIsRouting(false);
    }, [hasLocationLock]);

    useEffect(() => {
        if (!hasLocationLock) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || !originGps.current) return;

        const rootStyles = getComputedStyle(document.documentElement);
        const theme: ThemeColors = {
            product:
                rootStyles.getPropertyValue("--color-accent").trim() ||
                "#e024c5", // Roz / Mov
            productNotFound: "#555566", // GRI pentru 0% Confidence
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
            lastTime ??= timestamp;
            const dt = (timestamp - lastTime) / 1000;
            lastTime = timestamp;

            const safeDt = Math.min(dt, 0.1);

            let didSave = false;
            try {
                const rect = canvas.parentElement?.getBoundingClientRect();
                const targetW = Math.max(
                    1,
                    Math.round(rect?.width || globalThis.innerWidth),
                );
                const targetH = Math.max(
                    1,
                    Math.round(rect?.height || globalThis.innerHeight),
                );
                const dpr = globalThis.devicePixelRatio || 1;
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

                // --- NOU: Desenează Perimetrul Magazinului ---
                if (storePolygon && storePolygon.length > 0) {
                    ctx.beginPath();
                    storePolygon.forEach((coord, idx) => {
                        const p = getRelativePixels(coord, anchor);
                        if (idx === 0) ctx.moveTo(p.x, p.y);
                        else ctx.lineTo(p.x, p.y);
                    });
                    ctx.closePath();
                    // Umplem cu culoarea de suprafață a magazinului
                    ctx.fillStyle = "#1e1e26";
                    ctx.fill();
                    ctx.lineWidth = 4 / camera.current.zoom;
                    ctx.strokeStyle = "#3D3D4A";
                    ctx.stroke();
                }

                // --- NOU: Desenează Rafturi Dinamice bazate pe produse ---
                drawShelves(
                    ctx,
                    storeRoute,
                    anchor,
                    storePolygon,
                    camera.current.zoom,
                );
                // ---------------------------------------------------------------

                // --- MODIFICARE: Logica de afisare Traseu cu Săgeți ---
                drawRouteArrows(
                    ctx,
                    storeRoute,
                    userPos,
                    anchor,
                    theme,
                    timestamp,
                    camera.current.zoom,
                );

                // --- MODIFICARE: Logica de afisare Produse ---
                storeRoute.forEach((product) => {
                    if (
                        product.type === "USER" ||
                        product.itemId === "user_loc" ||
                        product.name === "Tu"
                    )
                        return;
                    const { x, y } = getRelativePixels(product, anchor);
                    const dotSize = 7 / camera.current.zoom;

                    ctx.beginPath();
                    ctx.arc(x, y, dotSize, 0, Math.PI * 2);

                    const confScore = (product as { confidence_score?: number })
                        .confidence_score;

                    if (confScore === 0.9595) {
                        ctx.fillStyle = theme.product;
                    } else if (confScore !== undefined && confScore < 0.1) {
                        ctx.fillStyle = theme.productNotFound;
                    } else {
                        ctx.fillStyle = theme.product;
                    }

                    ctx.fill();

                    // NOU: Afișăm textul MEREU cu un fundal de tip "pill" pentru lizibilitate maximă
                    const fontSize = Math.max(12 / camera.current.zoom, 8);
                    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
                    const textWidth = ctx.measureText(product.name).width;
                    const padding = 6 / camera.current.zoom;

                    // Fundal pentru text
                    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
                    ctx.beginPath();
                    ctx.roundRect(
                        x + dotSize + 2 / camera.current.zoom,
                        y - fontSize / 1.5,
                        textWidth + padding * 2,
                        fontSize * 1.4,
                        4 / camera.current.zoom,
                    );
                    ctx.fill();

                    // Textul propriu-zis
                    ctx.fillStyle = "white";
                    ctx.fillText(
                        product.name,
                        x + dotSize + 2 / camera.current.zoom + padding,
                        y + fontSize / 4,
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
    }, [canvasRef, hasLocationLock, storeRoute, storePolygon]);

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

    useEffect(() => {
        if (userLocation) {
            targetGps.current = {
                lat: userLocation.lat,
                lng: userLocation.lng,
            };
            if (isFirstLocationUpdate.current) {
                originGps.current = { ...targetGps.current };
                currentRenderedGps.current = { ...targetGps.current };
                isFirstLocationUpdate.current = false;
                setHasLocationLock(true);
            }
        }
    }, [userLocation]);

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
        clampCameraPosition(camera.current.x, camera.current.y, nextZoom);
    };

    const zoomOut = () => {
        const oldZoom = camera.current.zoom;
        const nextZoom = Math.max(oldZoom / 1.5, MAP_CONFIG.MIN_ZOOM);
        const zoomRatio = nextZoom / oldZoom;
        camera.current.zoom = nextZoom;
        camera.current.x *= zoomRatio;
        camera.current.y *= zoomRatio;
        clampCameraPosition(camera.current.x, camera.current.y, nextZoom);
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
        currentGps: currentRenderedGps.current,
        recenterCamera: () => {
            if (storePolygon && storePolygon.length > 0) {
                centerOnPolygon();
            } else {
                recenterCamera();
            }
        },
        zoomIn,
        zoomOut,
        exitIndoor: () => setNavigationMode("city"),
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

interface StoreMapProps {
    onToggleSidebar?: () => void;
    isSidebarExpanded?: boolean;
}

const StoreMap: React.FC<StoreMapProps> = ({
    onToggleSidebar,
    isSidebarExpanded: externalIsSidebarExpanded,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [internalIsSidebarExpanded, setInternalIsSidebarExpanded] =
        useState(false);
    const [isCoordsModalOpen, setIsCoordsModalOpen] = useState(false);

    const isSidebarExpanded =
        externalIsSidebarExpanded ?? internalIsSidebarExpanded;
    const toggleSidebar =
        onToggleSidebar ??
        (() => setInternalIsSidebarExpanded(!internalIsSidebarExpanded));

    useEffect(() => {
        const originalInlineStyle = document.body.getAttribute("style");
        document.body.style.overflow = "hidden";
        return () => {
            if (originalInlineStyle === null) {
                document.body.removeAttribute("style");
            } else {
                document.body.setAttribute("style", originalInlineStyle);
            }
        };
    }, []);

    useEffect(() => {
        if (!isSidebarExpanded) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isSidebarExpanded) {
                toggleSidebar();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isSidebarExpanded, toggleSidebar]);

    const isSimulationActive = useStore((state) => state.isSimulationActive);

    const {
        isDragging,
        hasLocationLock,
        gpsError,
        isRouting,
        currentGps,
        handlers,
        recenterCamera,
        zoomIn,
        zoomOut,
        exitIndoor,
    } = useMapEngine(canvasRef);

    const routeWarnings = useStore((state) => state.routeWarnings);
    const storeRoute = useStore((state) => state.route);
    const activeShoppingSession = useStore(
        (state) => state.activeShoppingSession,
    );
    const targetStoreTransit = useStore((state) => state.targetStoreTransit);
    const [dismissedWarnings, setDismissedWarnings] = useState<boolean>(false);
    const [dismissedNewStore, setDismissedNewStore] = useState<boolean>(false);
    const isNewCustomStore =
        storeRoute.length === 0 &&
        (!!activeShoppingSession?.storeCandidateSubmissionId ||
            activeShoppingSession?.officialStore === false ||
            targetStoreTransit === null);

    // Reset dismissed state when new warnings arrive
    useEffect(() => {
        if (routeWarnings.length > 0) setDismissedWarnings(false);
    }, [routeWarnings]);

    if (!hasLocationLock) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4 bg-bg">
                <div className="w-12 h-12 border-4 border-border border-t-accent rounded-full animate-spin" />
                <h2 className="text-xl font-bold text-text-strong tracking-tight">
                    {gpsError || "Acquiring GPS Signal..."}
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

                {isNewCustomStore && !dismissedNewStore && (
                    <div className="absolute inset-0 z-20 flex items-end sm:items-center justify-center p-4 sm:p-6 pointer-events-none">
                        <div className="relative max-w-xl rounded-2xl sm:rounded-3xl border border-accent/30 bg-surface/95 p-4 sm:p-6 shadow-2xl backdrop-blur-xl pointer-events-auto">
                            <button
                                type="button"
                                onClick={() => setDismissedNewStore(true)}
                                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-text-muted hover:text-text-strong hover:bg-bg-muted transition-colors"
                                aria-label="Dismiss"
                            >
                                <X size={14} />
                            </button>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">
                                New Store Detected
                            </p>
                            <h3 className="mt-2 text-base font-black text-text-strong">
                                This is a new store.
                            </h3>
                            <p className="mt-1 text-sm leading-relaxed text-text-muted">
                                Check items from your list while shopping so we
                                can learn this layout and build better routes
                                for your next visit.
                            </p>
                        </div>
                    </div>
                )}

                {gpsError && (
                    <div
                        role="alert"
                        aria-live="assertive"
                        className="absolute top-4 left-4 right-4 z-20 px-4 py-3 bg-danger text-white rounded-xl text-sm font-bold shadow-lg"
                    >
                        {gpsError}
                    </div>
                )}

                {routeWarnings.length > 0 &&
                    !dismissedWarnings &&
                    !isNewCustomStore && (
                        <div
                            role="alert"
                            aria-live="polite"
                            className="absolute bottom-4 left-4 right-4 z-20 px-4 py-3 bg-danger/90 text-white rounded-xl text-sm shadow-lg backdrop-blur-sm"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-col gap-1">
                                    {routeWarnings.map((warning) => (
                                        <p
                                            key={warning}
                                            className="font-medium"
                                        >
                                            ⚠️ {warning}
                                        </p>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="shrink-0 mt-0.5 text-white/70 hover:text-white transition-colors"
                                    onClick={() => setDismissedWarnings(true)}
                                    aria-label="Dismiss warnings"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    )}
            </div>

            {/* Map Control Bar - Separated from map view */}
            <div className="relative z-3000 bg-surface/80 backdrop-blur-xl border-t border-border h-16 sm:h-21 px-3 sm:px-6 flex items-center justify-between shadow-[0_-8px_30px_rgba(0,0,0,0.04)] shrink-0">
                <div className="flex items-center gap-2 sm:gap-4">
                    {import.meta.env.DEV && (
                        <button
                            type="button"
                            className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${isSimulationActive ? "bg-orange-500 text-white animate-pulse" : "bg-blue-500 text-white"}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isSimulationActive) {
                                    stopSimulation();
                                } else {
                                    startSimulation();
                                }
                            }}
                            title={
                                isSimulationActive
                                    ? "Stop Simulation"
                                    : "Start Simulation"
                            }
                        >
                            {isSimulationActive ? (
                                <Square size={18} />
                            ) : (
                                <Play size={18} className="ml-0.5" />
                            )}
                        </button>
                    )}

                    <button
                        type="button"
                        className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-accent text-text-on-accent rounded-full shadow-[0_4px_12px_var(--color-accent-glow)] transition-all hover:bg-accent-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                        onClick={(e) => {
                            e.stopPropagation();
                            recenterCamera();
                        }}
                        title="Recenter Map"
                    >
                        <LocateFixed size={18} />
                    </button>

                    <button
                        type="button"
                        className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-danger text-white rounded-full shadow-lg transition-all hover:bg-danger/80 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                        onClick={(e) => {
                            e.stopPropagation();
                            exitIndoor();
                        }}
                        title="Exit Indoor Mode"
                    >
                        <ArrowLeft size={18} />
                    </button>

                    <button
                        type="button"
                        className="hidden sm:flex w-10 h-10 sm:w-12 sm:h-12 items-center justify-center bg-bg-muted text-text-strong border border-border rounded-full shadow-sm transition-all hover:bg-surface hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsCoordsModalOpen(true);
                        }}
                        title="Live Coordinates"
                    >
                        <Navigation size={18} />
                    </button>

                    <div className="hidden sm:flex items-center bg-bg-muted border border-border rounded-2xl p-1">
                        <button
                            type="button"
                            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-text-strong hover:bg-surface rounded-xl transition-all active:scale-90"
                            onClick={(e) => {
                                e.stopPropagation();
                                zoomIn();
                            }}
                            title="Zoom In"
                        >
                            <ZoomIn size={16} />
                        </button>
                        <div className="w-px h-5 bg-border mx-1" />
                        <button
                            type="button"
                            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-text-strong hover:bg-surface rounded-xl transition-all active:scale-90"
                            onClick={(e) => {
                                e.stopPropagation();
                                zoomOut();
                            }}
                            title="Zoom Out"
                        >
                            <ZoomOut size={16} />
                        </button>
                    </div>
                </div>

                <button
                    type="button"
                    className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-full font-bold text-sm shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 ${
                        isSidebarExpanded
                            ? "bg-accent text-text-on-accent"
                            : "bg-text-strong text-bg"
                    }`}
                    onClick={(e) => {
                        e.stopPropagation();
                        toggleSidebar();
                    }}
                    aria-label={isSidebarExpanded ? "Close List" : "Show List"}
                >
                    {isSidebarExpanded ? (
                        <X size={18} className="rotate-90" />
                    ) : (
                        <List size={18} />
                    )}
                    <span className="hidden sm:inline">
                        {isSidebarExpanded ? "Close List" : "View List"}
                    </span>
                </button>
            </div>

            <Modal
                isOpen={isCoordsModalOpen}
                onClose={() => setIsCoordsModalOpen(false)}
                title="Live Store Coordinates"
            >
                <div className="flex flex-col gap-6 p-2">
                    <div className="flex items-center gap-4 bg-bg-muted p-4 rounded-2xl border border-border">
                        <div className="p-3 bg-accent/10 rounded-xl text-accent">
                            <Navigation size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">
                                Current Location
                            </p>
                            <p className="text-sm font-mono font-bold text-text-strong">
                                {currentGps.lat.toFixed(6)},{" "}
                                {currentGps.lng.toFixed(6)}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-text-muted">Latitude</span>
                            <span className="font-mono font-bold text-text-strong">
                                {currentGps.lat}
                            </span>
                        </div>
                        <div className="h-px bg-border" />
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-text-muted">Longitude</span>
                            <span className="font-mono font-bold text-text-strong">
                                {currentGps.lng}
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="w-full py-4 bg-text-strong text-bg rounded-2xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                        onClick={() => setIsCoordsModalOpen(false)}
                    >
                        Dismiss
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default StoreMap;
