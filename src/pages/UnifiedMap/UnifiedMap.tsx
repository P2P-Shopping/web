import polyline from "@mapbox/polyline";
import L from "leaflet";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Circle,
    MapContainer,
    Marker,
    Polygon,
    Polyline,
    Popup,
    TileLayer,
    Tooltip,
    useMap,
    useMapEvents,
    ZoomControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
    ArrowLeft,
    Camera,
    Car,
    CheckCircle2,
    ChevronRight,
    Cpu,
    Footprints,
    List as ListIcon,
    LocateFixed,
    MapPin,
    Satellite,
    Volume2,
    VolumeX,
    X,
    Zap,
} from "lucide-react";
import { Modal } from "../../components";
import type { Coordinate, RoutePoint } from "../../context/useStore";
import { useStore } from "../../context/useStore";
import { GEOFENCE_RADIUS_METERS } from "../../services/geofence";
import { loadRoute } from "../../services/loadRoute";
import { teleport } from "../../services/mockEmitter";
import { useListsStore } from "../../store/useListsStore";
import type { Item, ShoppingList } from "../../types";
import ListDetail from "../ListDetail/ListDetail";
import { useFinishShopping } from "../ListDetail/useFinishShopping";
import StoreMap from "../StoreMap/StoreMap";
// --- Types & Constants ---
export interface StoreRecommendation {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    stockMatchPercentage: number;
    totalEstimatedPrice: number | null;
    priceCoveragePercentage: number;
    transit: {
        driving: { timeMins: number; distanceKm: string | number };
        walking: { timeMins: number; distanceKm: string | number };
    };
}

interface ApiStoreMatch {
    storeId: string;
    storeName: string;
    matchedItems: number;
    matchPercentage?: number;
    distanceMeters: number;
    totalEstimatedPrice?: number | null;
    pricedItems?: number;
    priceCoveragePercentage?: number;
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
    location?: { lat?: number; lng?: number };
    coords?: { lat?: number; lng?: number; lon?: number };
    point?: { lat?: number; lng?: number; lon?: number };
    x?: number;
    y?: number;
    px?: number;
    py?: number;
    lon?: number;
    address?: string;
    transit?: {
        driving?: { timeMins?: number; distanceKm?: string | number };
        walking?: { timeMins?: number; distanceKm?: string | number };
    };
}

const geocodeStore = async (
    storeName: string,
    address: string,
    userLocation: { lat: number; lng: number },
): Promise<{ lat: number; lng: number } | null> => {
    const parseFirstResult = (
        data: unknown,
    ): { lat: number; lng: number } | null => {
        if (!Array.isArray(data) || data.length === 0) return null;
        const first = data[0] as {
            lat?: string | number;
            lon?: string | number;
        };
        const lat = Number(first?.lat);
        const lng = Number(first?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
    };

    const tryNominatim = async (query: string, bounded: boolean) => {
        const delta = 0.25;
        const left = userLocation.lng - delta;
        const right = userLocation.lng + delta;
        const top = userLocation.lat + delta;
        const bottom = userLocation.lat - delta;
        const base = new URL("https://nominatim.openstreetmap.org/search");
        base.searchParams.set("q", query);
        base.searchParams.set("format", "json");
        base.searchParams.set("limit", "1");
        base.searchParams.set("countrycodes", "ro");
        if (bounded) {
            base.searchParams.set(
                "viewbox",
                `${left},${top},${right},${bottom}`,
            );
            base.searchParams.set("bounded", "1");
        }

        const response = await fetch(base.toString(), {
            headers: {
                Accept: "application/json",
            },
        });
        if (!response.ok) return null;
        return parseFirstResult(await response.json());
    };

    try {
        const fullQuery = `${storeName} ${address || ""}`.trim();
        const addressOnlyQuery = address.trim();

        return (
            (fullQuery && (await tryNominatim(fullQuery, true))) ||
            (addressOnlyQuery &&
                (await tryNominatim(addressOnlyQuery, true))) ||
            (fullQuery && (await tryNominatim(fullQuery, false))) ||
            (addressOnlyQuery &&
                (await tryNominatim(addressOnlyQuery, false))) ||
            null
        );
    } catch (err) {
        console.warn("Geocoding failed for store", storeName, err);
    }
    return null;
};

const fetchMacroTransit = async (
    storeId: string,
    userLocation: { lat: number; lng: number },
    baseUrl: string,
) => {
    const transit = {
        driving: { timeMins: 10, distanceKm: "2.0" },
        walking: { timeMins: 30, distanceKm: "2.0" },
    };

    try {
        const params = new URLSearchParams({
            userLat: String(userLocation.lat),
            userLng: String(userLocation.lng),
            storeId,
        });
        const res = await fetch(`${baseUrl}/api/routing/macro?${params}`, {
            headers: {
                Authorization: `Bearer ${useStore.getState().token}`,
            },
            credentials: "include",
        });
        if (!res.ok) return transit;

        const data = await res.json();
        if (data.driving) {
            transit.driving = {
                timeMins: Math.round(data.driving.durationSeconds / 60),
                distanceKm: (data.driving.distanceM / 1000).toFixed(1),
            };
        }
        if (data.walking) {
            transit.walking = {
                timeMins: Math.round(data.walking.durationSeconds / 60),
                distanceKm: (data.walking.distanceM / 1000).toFixed(1),
            };
        }
    } catch (err) {
        console.warn("Could not fetch macro-routing", err);
    }
    return transit;
};

const extractCoordsFromStore = (store: ApiStoreMatch) => {
    const parseNumber = (v: unknown) =>
        v != null && v !== "" ? Number(v) : Number.NaN;

    const rawLat =
        store.lat ??
        store.latitude ??
        store.location?.lat ??
        store.coords?.lat ??
        store.point?.lat ??
        store.y ??
        store.py;

    const rawLng =
        store.lng ??
        store.longitude ??
        store.location?.lng ??
        store.coords?.lon ??
        store.coords?.lng ??
        store.point?.lng ??
        store.point?.lon ??
        store.x ??
        store.px ??
        store.lon;

    return { lat: parseNumber(rawLat), lng: parseNumber(rawLng) };
};

const mapApiStoreToRecommendation = async (
    store: ApiStoreMatch,
    userLocation: { lat: number; lng: number },
    baseUrl: string,
    itemCount: number,
): Promise<StoreRecommendation> => {
    const realTransit = await fetchMacroTransit(
        store.storeId,
        userLocation,
        baseUrl,
    );

    let { lat, lng } = extractCoordsFromStore(store);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
        const coords = await geocodeStore(
            store.storeName,
            store.address || "",
            userLocation,
        );
        if (coords) {
            lat = coords.lat;
            lng = coords.lng;
        }
    }

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
        lat = userLocation.lat;
        lng = userLocation.lng;
    }

    // Calculate match percentage with proper validation
    let stockMatchPercentage = 0;
    if (
        store.matchPercentage !== undefined &&
        !Number.isNaN(store.matchPercentage)
    ) {
        // Use matchPercentage directly from API if available
        stockMatchPercentage = Math.max(
            0,
            Math.min(100, Math.round(store.matchPercentage)),
        );
    } else if (
        store.matchedItems !== undefined &&
        !Number.isNaN(store.matchedItems)
    ) {
        // Fallback to calculating from matchedItems
        stockMatchPercentage = Math.round(
            (store.matchedItems / Math.max(itemCount, 1)) * 100,
        );
    }
    // Ensure result is always a valid number between 0-100
    stockMatchPercentage = Math.max(
        0,
        Math.min(100, stockMatchPercentage || 0),
    );

    return {
        id: store.storeId,
        name: store.storeName,
        address: store.address || "Address unavailable",
        lat,
        lng,
        stockMatchPercentage,
        totalEstimatedPrice:
            store.totalEstimatedPrice !== undefined &&
            store.totalEstimatedPrice !== null &&
            Number.isFinite(Number(store.totalEstimatedPrice))
                ? Number(store.totalEstimatedPrice)
                : null,
        priceCoveragePercentage:
            store.priceCoveragePercentage !== undefined &&
            Number.isFinite(Number(store.priceCoveragePercentage))
                ? Math.max(
                      0,
                      Math.min(
                          100,
                          Math.round(Number(store.priceCoveragePercentage)),
                      ),
                  )
                : 0,
        transit: realTransit,
    };
};

const formatEstimatedPrice = (price: number | null): string => {
    if (price === null || !Number.isFinite(price)) {
        return "N/A";
    }
    return new Intl.NumberFormat("ro-RO", {
        style: "currency",
        currency: "RON",
        maximumFractionDigits: 2,
    }).format(price);
};

// Fix Leaflet marker icons
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

import { getApiBaseUrl, startShoppingRequest } from "../../services/api";

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const METERS_PER_DEGREE_LAT = 111320;

const getDistanceMeters = (a: Coordinate, b: Coordinate): number => {
    const metersPerDegreeLng =
        METERS_PER_DEGREE_LAT * Math.cos((a.lat * Math.PI) / 180);
    const dx = (b.lng - a.lng) * metersPerDegreeLng;
    const dy = (b.lat - a.lat) * METERS_PER_DEGREE_LAT;
    return Math.hypot(dx, dy);
};

const getPointToSegmentDistanceMeters = (
    point: Coordinate,
    segmentStart: Coordinate,
    segmentEnd: Coordinate,
): number => {
    const metersPerDegreeLng =
        METERS_PER_DEGREE_LAT * Math.cos((segmentStart.lat * Math.PI) / 180);
    const px = (point.lng - segmentStart.lng) * metersPerDegreeLng;
    const py = (point.lat - segmentStart.lat) * METERS_PER_DEGREE_LAT;
    const ax = 0;
    const ay = 0;
    const bx = (segmentEnd.lng - segmentStart.lng) * metersPerDegreeLng;
    const by = (segmentEnd.lat - segmentStart.lat) * METERS_PER_DEGREE_LAT;
    const lengthSquared = bx * bx + by * by;

    if (lengthSquared === 0) return Math.hypot(px, py);

    const t = Math.max(
        0,
        Math.min(1, ((px - ax) * bx + (py - ay) * by) / lengthSquared),
    );
    return Math.hypot(px - bx * t, py - by * t);
};

const getDistanceToRouteMeters = (
    point: Coordinate,
    routeOrigin: Coordinate,
    route: RoutePoint[],
): number => {
    const path = [routeOrigin, ...route.map(({ lat, lng }) => ({ lat, lng }))];
    if (path.length < 2) return Number.POSITIVE_INFINITY;

    return path.slice(1).reduce((nearest, segmentEnd, index) => {
        const segmentStart = path[index];
        return Math.min(
            nearest,
            getPointToSegmentDistanceMeters(point, segmentStart, segmentEnd),
        );
    }, Number.POSITIVE_INFINITY);
};

const normalizeLabel = (value: string) => value.trim().toLowerCase();

const isNormalShoppingList = (list: ShoppingList) =>
    (list.category ?? "NORMAL") === "NORMAL";

const alignRouteToItems = (
    route: RoutePoint[],
    items: Item[],
): RoutePoint[] => {
    if (route.length === 0 || items.length === 0) return route;

    const remainingItems = new Map(items.map((item) => [item.id, item]));
    const itemsByName = new Map(
        items.map((item) => [normalizeLabel(item.name), item]),
    );

    return route.map((point) => {
        const exactMatch = remainingItems.get(point.itemId);
        const nameMatch = itemsByName.get(normalizeLabel(point.name));
        const matchedItem = exactMatch ?? nameMatch;

        if (!matchedItem) return point;

        remainingItems.delete(matchedItem.id);
        return {
            ...point,
            itemId: matchedItem.id,
            name: matchedItem.name,
        };
    });
};

const MapController = ({
    center,
    isMicroView,
}: {
    center: [number, number];
    isMicroView: boolean;
}) => {
    const map = useMap();
    const isAutoCenterEnabled = useStore((state) => state.isAutoCenterEnabled);
    const [prevIsMicro, setPrevIsMicro] = useState(isMicroView);

    useEffect(() => {
        const isTransition = prevIsMicro !== isMicroView;
        if (isTransition) {
            setPrevIsMicro(isMicroView);
        }

        if (isAutoCenterEnabled || isTransition) {
            if (isMicroView) {
                map.setView(center, 19, { animate: true });
            } else {
                map.setView(center, isTransition ? 14 : map.getZoom(), {
                    animate: true,
                });
            }
        }
    }, [center, isMicroView, map, isAutoCenterEnabled, prevIsMicro]);
    return null;
};

const MapEvents = () => {
    const isAutoCenterEnabled = useStore((state) => state.isAutoCenterEnabled);
    const setIsAutoCenterEnabled = useStore(
        (state) => state.setIsAutoCenterEnabled,
    );

    useMapEvents({
        movestart: () => {
            if (isAutoCenterEnabled) setIsAutoCenterEnabled(false);
        },
    });
    return null;
};

// --- Sub-components for Sidebar ---

interface ListSelectionViewProps {
    lists: ShoppingList[];
    isMicroView: boolean;
    handleListSelect: (listId: string) => void;
}

const ListSelectionView: React.FC<ListSelectionViewProps> = ({
    lists,
    isMicroView,
    handleListSelect,
}) => (
    <div className="flex flex-col gap-4 sm:gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <header>
            <h2 className="text-xl sm:text-2xl font-black text-text-strong uppercase tracking-tight">
                {isMicroView ? "Shopping Lists" : "Plan Your Route"}
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">
                {isMicroView
                    ? "Select a list to navigate to its items."
                    : "Select a shopping list to discover the best retail locations near you."}
            </p>
        </header>
        <div className="flex flex-col gap-3 sm:gap-4">
            {lists.length === 0 ? (
                <div className="py-8 sm:py-12 text-center flex flex-col items-center gap-3 bg-bg-muted rounded-2xl sm:rounded-3xl border border-dashed border-border">
                    <ListIcon
                        size={28}
                        className="text-text-muted opacity-30"
                    />
                    <p className="text-xs sm:text-sm font-bold text-text-muted">
                        No lists found.
                    </p>
                </div>
            ) : (
                lists.map((list) => (
                    <button
                        key={list.id}
                        type="button"
                        onClick={() => handleListSelect(list.id)}
                        className="flex items-center justify-between p-4 sm:p-6 bg-surface border border-border/60 rounded-2xl sm:rounded-[28px] hover:border-accent hover:bg-accent-subtle/30 transition-all group text-left shadow-sm hover:shadow-xl hover:-translate-y-0.5 relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex flex-col gap-1 sm:gap-1.5">
                            <span className="font-extrabold text-text-strong group-hover:text-accent transition-colors text-sm sm:text-lg leading-tight">
                                {list.name}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-text-muted px-2 py-0.5 sm:px-2.5 sm:py-1 bg-bg-muted rounded-full border border-border/30">
                                    {list.items?.length || 0} items
                                </span>
                                {list.category && (
                                    <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-accent px-2 py-0.5 sm:px-2.5 sm:py-1 bg-accent-subtle rounded-full border border-accent-border/10">
                                        {list.category}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-bg-muted flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-all shadow-inner">
                            <ChevronRight
                                size={18}
                                className="transition-transform group-hover:translate-x-0.5"
                            />
                        </div>
                    </button>
                ))
            )}
        </div>
    </div>
);

interface StoreRecommendationViewProps {
    recommendedStores: StoreRecommendation[];
    transportMode: "driving" | "walking";
    setTransportMode: (mode: "driving" | "walking") => void;
    setSelectedListId: (id: string | null) => void;
    handleStartRoute: (store: StoreRecommendation) => void;
    onPickOwnStore: () => void;
}

const StoreRecommendationView: React.FC<StoreRecommendationViewProps> = ({
    recommendedStores,
    transportMode,
    setTransportMode,
    setSelectedListId,
    handleStartRoute,
    onPickOwnStore,
}) => (
    <div className="flex flex-col gap-4 sm:gap-6 animate-in slide-in-from-right-4">
        <header className="flex flex-col gap-3 sm:gap-4">
            <button
                type="button"
                onClick={() => setSelectedListId(null)}
                className="flex items-center gap-2 text-xs font-black text-accent uppercase tracking-widest hover:-translate-x-1 transition-transform w-fit"
            >
                <ArrowLeft size={14} /> Back to lists
            </button>
            <div className="flex justify-between items-end">
                <div className="text-left">
                    <h2 className="text-xl sm:text-2xl font-black text-text-strong uppercase tracking-tight">
                        Best Matches
                    </h2>
                    <p className="text-xs text-text-muted mt-1">
                        Found {recommendedStores.length} stores nearby.
                    </p>
                </div>
                <div className="flex bg-bg-muted p-1 rounded-xl sm:rounded-2xl border border-border shadow-inner">
                    <button
                        type="button"
                        onClick={() => setTransportMode("driving")}
                        className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all ${transportMode === "driving" ? "bg-surface text-accent shadow-sm" : "text-text-muted hover:text-text-strong"}`}
                    >
                        <Car size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setTransportMode("walking")}
                        className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl transition-all ${transportMode === "walking" ? "bg-surface text-accent shadow-sm" : "text-text-muted hover:text-text-strong"}`}
                    >
                        <Footprints size={16} />
                    </button>
                </div>
            </div>
        </header>
        <div className="flex flex-col gap-3 sm:gap-4">
            <button
                type="button"
                onClick={onPickOwnStore}
                className="w-full rounded-2xl sm:rounded-[24px] border border-dashed border-border px-4 sm:px-5 py-3 sm:py-4 text-left bg-surface hover:border-accent hover:bg-accent-subtle/30 transition-all"
            >
                <span className="block text-[10px] sm:text-xs font-black uppercase tracking-widest text-accent">
                    Pick Your Own Store
                </span>
                <span className="mt-1 block text-xs sm:text-sm text-text-muted">
                    Choose another store and save it in the review queue.
                </span>
            </button>
            {recommendedStores.map((store, idx) => (
                <div
                    key={store.id}
                    className={`p-4 sm:p-5 rounded-2xl sm:rounded-[28px] border transition-all relative ${idx === 0 ? "bg-accent/5 border-accent shadow-[0_8px_30px_rgba(var(--color-accent-rgb),0.1)]" : "bg-bg-muted border-border"}`}
                >
                    {idx === 0 && (
                        <div className="absolute -top-3 left-4 sm:left-6 px-2 sm:px-3 py-1 bg-accent text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 sm:gap-1.5 shadow-lg">
                            <CheckCircle2 size={10} />
                            Optimal Choice
                        </div>
                    )}
                    <div className="flex justify-between text-left">
                        <div className="flex flex-col gap-1">
                            <h3 className="font-black text-text-strong text-sm sm:text-lg leading-tight">
                                {store.name}
                            </h3>
                            <div className="text-[10px] sm:text-[11px] text-text-muted flex items-center gap-1">
                                <MapPin size={12} />
                                {store.address}
                            </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                            <span className="text-xl sm:text-2xl font-black text-accent tracking-tighter">
                                {store.stockMatchPercentage}%
                            </span>
                            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-text-muted">
                                Stock
                            </span>
                            <span className="mt-1 text-[9px] sm:text-[10px] font-bold text-text-strong">
                                {formatEstimatedPrice(
                                    store.totalEstimatedPrice,
                                )}
                            </span>
                            <span className="text-[8px] sm:text-[9px] uppercase tracking-widest text-text-muted">
                                Price ({store.priceCoveragePercentage}% priced)
                            </span>
                        </div>
                    </div>
                    <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-border/40 flex items-center justify-between">
                        <div className="text-[11px] sm:text-xs font-bold text-text-strong flex items-center gap-3 sm:gap-4">
                            <div className="flex items-center gap-1 sm:gap-1.5">
                                {transportMode === "driving" ? (
                                    <Car
                                        size={12}
                                        className="text-text-muted"
                                    />
                                ) : (
                                    <Footprints
                                        size={12}
                                        className="text-text-muted"
                                    />
                                )}
                                {store.transit[transportMode].timeMins} min
                            </div>
                            <div className="w-1 h-1 rounded-full bg-border" />
                            <span className="text-text-muted">
                                {store.transit[transportMode].distanceKm} km
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleStartRoute(store)}
                            className="px-4 py-2 sm:px-6 sm:py-2.5 bg-text-strong text-bg rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black shadow-lg hover:scale-105 active:scale-95 transition-all"
                        >
                            START NAVIGATION
                        </button>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

interface ListDetailViewProps {
    selectedListId: string;
    isMicroView: boolean;
    setSelectedListId: (id: string | null) => void;
    targetStoreLocation: { lat: number; lng: number } | null;
    setTargetStoreLocation: (loc: { lat: number; lng: number } | null) => void;
    handleFetchStores: () => void;
    isFetchingStores: boolean;
}

const ListDetailView: React.FC<ListDetailViewProps> = ({
    selectedListId,
    isMicroView,
    setSelectedListId,
    targetStoreLocation,
    setTargetStoreLocation,
    handleFetchStores,
    isFetchingStores,
}) => {
    const listName = useListsStore(
        (s) => s.lists.find((l) => l.id === selectedListId)?.name,
    );

    return (
        <div className="relative animate-in fade-in slide-in-from-right-4 duration-500 h-full flex flex-col">
            {!isMicroView && (
                <header className="flex items-center gap-2 mb-2 shrink-0 min-w-0">
                    <button
                        type="button"
                        onClick={() => setSelectedListId(null)}
                        className="flex items-center justify-center w-7 h-7 rounded-full bg-bg-muted text-text-muted hover:text-accent hover:bg-accent-subtle transition-all shrink-0"
                        title="Back"
                    >
                        <ArrowLeft size={14} />
                    </button>
                    <h2 className="text-sm font-bold text-text-strong truncate">
                        {listName}
                    </h2>
                </header>
            )}

            <div className="flex-1 overflow-hidden flex flex-col relative">
                {targetStoreLocation && (
                    <button
                        type="button"
                        onClick={() => setTargetStoreLocation(null)}
                        className="absolute top-2 right-2 p-2 text-text-muted hover:text-accent z-10 transition-colors bg-surface/80 backdrop-blur rounded-lg"
                        title="Cancel Route"
                    >
                        <X size={18} />
                    </button>
                )}
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                    <ListDetail
                        isEmbedded={true}
                        listIdOverride={selectedListId}
                    />
                </div>

                {!targetStoreLocation && !isMicroView && (
                    <div className="pt-3 mt-2 sm:pt-4 sm:mt-3 border-t border-border shrink-0">
                        <button
                            type="button"
                            onClick={() => handleFetchStores()}
                            disabled={isFetchingStores}
                            className="w-full py-3 sm:py-4 bg-accent text-white rounded-xl sm:rounded-2xl font-black text-sm sm:text-base shadow-[0_8px_25px_var(--color-accent-glow)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 sm:gap-3 disabled:opacity-70"
                        >
                            {isFetchingStores ? (
                                <>
                                    <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    FINDING BEST STORES...
                                </>
                            ) : (
                                <>
                                    <Zap size={16} fill="currentColor" />
                                    PLAN MY ROUTE
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

interface IndoorRouteListProps {
    listId: string;
    items: Item[];
    route: RoutePoint[];
}

const IndoorRouteList: React.FC<IndoorRouteListProps> = ({
    listId,
    items,
    route,
}) => {
    const [disappearingItemIds, setDisappearingItemIds] = useState<Set<string>>(
        () => new Set(),
    );
    const [finishError, setFinishError] = useState<string | null>(null);
    const updateItem = useListsStore((state) => state.updateItem);
    const setGlobalItems = useStore((state) => state.setItems);
    const {
        isFinishing,
        showFinishModal,
        setShowFinishModal,
        receiptImage,
        setReceiptImage,
        isFinishDisabled,
        handleFinishShopping,
        activeShoppingSession,
        syncActiveSession,
    } = useFinishShopping({
        effectiveListId: listId,
        setError: setFinishError,
    });
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const itemsByName = new Map(
        items.map((item) => [normalizeLabel(item.name), item]),
    );
    const uncheckedItems = items.filter((item) => !item.checked);
    const checkedItems = items.filter((item) => item.checked);
    const matchedRouteItems = route
        .map(
            (point) =>
                itemsById.get(point.itemId) ??
                itemsByName.get(normalizeLabel(point.name)),
        )
        .filter(
            (item, index, matchedItems): item is Item =>
                item !== undefined &&
                matchedItems.findIndex((entry) => entry?.id === item.id) ===
                    index,
        );
    const matchedIds = new Set(matchedRouteItems.map((item) => item.id));
    const orderedItems =
        route.length > 0
            ? [
                  ...matchedRouteItems,
                  ...uncheckedItems.filter((item) => !matchedIds.has(item.id)),
              ]
            : uncheckedItems;
    const visibleItems = orderedItems.filter(
        (item) => !item.checked || disappearingItemIds.has(item.id),
    );
    const canFinishShopping = activeShoppingSession?.listId === listId;

    const handleCheck = (item: Item) => {
        if (item.checked || disappearingItemIds.has(item.id)) return;

        setDisappearingItemIds((prev) => new Set(prev).add(item.id));

        globalThis.setTimeout(async () => {
            const updatedItems = items.map((entry) =>
                entry.id === item.id ? { ...entry, checked: true } : entry,
            );
            setGlobalItems(updatedItems);
            const didUpdate = await updateItem(listId, item.id, {
                checked: true,
            });

            if (!didUpdate) {
                setDisappearingItemIds((prev) => {
                    const next = new Set(prev);
                    next.delete(item.id);
                    return next;
                });
                setGlobalItems(items);
            }
        }, 220);
    };

    const handleUncheck = async (item: Item) => {
        if (!item.checked) return;
        const updatedItems = items.map((entry) =>
            entry.id === item.id ? { ...entry, checked: false } : entry,
        );
        setGlobalItems(updatedItems);
        const didUpdate = await updateItem(listId, item.id, {
            checked: false,
        });

        if (!didUpdate) {
            setGlobalItems(items);
        }
    };

    useEffect(() => {
        setDisappearingItemIds((prev) => {
            const activeUncheckedIds = new Set(
                items.filter((i) => !i.checked).map((i) => i.id),
            );
            const next = new Set(
                [...prev].filter((id) => activeUncheckedIds.has(id)),
            );
            return next.size === prev.size ? prev : next;
        });
    }, [items]);

    useEffect(() => {
        void syncActiveSession();
    }, [syncActiveSession]);

    return (
        <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <header>
                <h2 className="text-2xl font-black text-text-strong uppercase tracking-tight">
                    TSP Route
                </h2>
                <p className="text-sm text-text-muted mt-1 leading-relaxed">
                    {uncheckedItems.length} stops remaining
                </p>
            </header>

            {visibleItems.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center gap-3 bg-bg-muted rounded-3xl border border-dashed border-border">
                    <CheckCircle2
                        size={32}
                        className="text-accent opacity-70"
                    />
                    <p className="text-sm font-bold text-text-muted">
                        Route complete.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {visibleItems.map((item, index) => {
                        const isDisappearing = disappearingItemIds.has(item.id);
                        const formatPrice = (price: number) =>
                            `${price.toFixed(2)} RON`;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => handleCheck(item)}
                                className={`flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-border bg-bg-muted p-4 text-left transition-all duration-300 hover:border-accent hover:bg-accent-subtle/20 ${
                                    isDisappearing
                                        ? "max-h-0 translate-x-4 scale-95 p-0 opacity-0"
                                        : "max-h-32 opacity-100"
                                }`}
                            >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-black text-white">
                                    {index + 1}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-black text-text-strong">
                                        {item.name}
                                        {item.quantity && (
                                            <span className="ml-1 text-xs font-bold text-accent">
                                                x{item.quantity}
                                            </span>
                                        )}
                                    </span>
                                    {item.brand || item.price != null ? (
                                        <span className="flex items-center gap-1.5 text-[10px] text-text-muted mt-0.5">
                                            {item.brand && (
                                                <span className="px-1 py-0.5 bg-bg-muted rounded text-[9px] uppercase font-bold tracking-wider border border-border">
                                                    {item.brand}
                                                </span>
                                            )}
                                            {item.brand &&
                                                item.price != null && (
                                                    <span>•</span>
                                                )}
                                            {item.price != null && (
                                                <span className="font-bold text-accent">
                                                    {formatPrice(item.price)}
                                                </span>
                                            )}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                                            Tap to check off
                                        </span>
                                    )}
                                </span>
                                <CheckCircle2
                                    size={20}
                                    className="shrink-0 text-text-muted"
                                />
                            </button>
                        );
                    })}
                </div>
            )}

            {canFinishShopping && (
                <div className="sticky bottom-0 z-10 -mx-6 mt-auto border-t border-border bg-surface/95 px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md">
                    {finishError && (
                        <div
                            role="alert"
                            className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-xs font-bold text-danger"
                        >
                            {finishError}
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            setFinishError(null);
                            setShowFinishModal(true);
                        }}
                        className="w-full rounded-2xl bg-accent py-3.5 text-sm font-black text-white shadow-[0_4px_15px_var(--color-accent-glow)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        Finish Shopping
                    </button>
                </div>
            )}

            {checkedItems.length > 0 && (
                <div className="flex flex-col gap-3 border-t border-border pt-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                        Checked Items
                    </p>
                    {checkedItems.map((item) => (
                        <button
                            key={`checked-${item.id}`}
                            type="button"
                            onClick={() => void handleUncheck(item)}
                            className="flex w-full items-center gap-4 rounded-2xl border border-border bg-bg-muted p-4 text-left transition-all duration-200 hover:border-accent"
                        >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-600 text-sm font-black text-white">
                                <CheckCircle2 size={16} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-black text-text-strong line-through opacity-80">
                                    {item.name}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                                    Tap to uncheck
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            )}

            <Modal
                isOpen={showFinishModal}
                onClose={() => setShowFinishModal(false)}
                title="Finish Shopping"
                subtitle={
                    activeShoppingSession?.storeName
                        ? `Shopping at ${activeShoppingSession.storeName}. Add the receipt to complete the session.`
                        : "Add the receipt to complete the shopping session."
                }
            >
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-black uppercase text-text-strong tracking-wider">
                            Receipt Photo
                        </span>
                        <div className="relative">
                            <input
                                type="file"
                                accept="image/*"
                                id="indoor-receipt-cam"
                                className="hidden"
                                onChange={(event) =>
                                    setReceiptImage(
                                        event.target.files?.[0] || null,
                                    )
                                }
                            />
                            <label
                                htmlFor="indoor-receipt-cam"
                                className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-all ${receiptImage ? "border-accent bg-accent-subtle text-accent" : "border-border text-text-muted hover:border-accent"}`}
                            >
                                <Camera size={28} />
                                <span className="text-sm font-black">
                                    {receiptImage
                                        ? receiptImage.name
                                        : "TAKE PHOTO"}
                                </span>
                                <span className="text-xs font-bold uppercase opacity-50">
                                    Optional receipt
                                </span>
                            </label>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowFinishModal(false)}
                            className="rounded-lg bg-bg-muted py-3 font-bold"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={isFinishDisabled}
                            onClick={handleFinishShopping}
                            className="rounded-lg bg-text-strong py-3 font-bold text-bg transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isFinishing ? "Processing..." : "Complete"}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

const useStoreFootprint = (
    activeTarget: { lat: number; lng: number } | null,
) => {
    const setStoreFootprint = useStore((state) => state.setStoreFootprint);
    const [footprint, setFootprint] = useState<[number, number][]>(
        activeTarget
            ? [
                  [activeTarget.lat + 0.0005, activeTarget.lng - 0.0008],
                  [activeTarget.lat + 0.0005, activeTarget.lng + 0.0008],
                  [activeTarget.lat - 0.0005, activeTarget.lng + 0.0008],
                  [activeTarget.lat - 0.0005, activeTarget.lng - 0.0008],
              ]
            : [],
    );

    useEffect(() => {
        if (!activeTarget) return;

        const fetchFootprint = async () => {
            try {
                const query = `[out:json];way(around:150, ${activeTarget.lat}, ${activeTarget.lng})[building];out geom;`;
                const response = await fetch(
                    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
                );
                const data = await response.json();
                if (data.elements && data.elements.length > 0) {
                    const way = data.elements[0];
                    if (way.geometry) {
                        const coords: [number, number][] = way.geometry.map(
                            (p: { lat: number; lon: number }) => [p.lat, p.lon],
                        );
                        setFootprint(coords);
                        setStoreFootprint(
                            coords.map((c) => ({ lat: c[0], lng: c[1] })),
                        );
                    }
                }
            } catch (err) {
                console.warn("Could not fetch OSM footprint", err);
            }
        };
        fetchFootprint();
    }, [activeTarget, setStoreFootprint]);

    return footprint;
};

const useAudioNavigation = (
    userLocation: Coordinate,
    route: RoutePoint[],
    navigationMode: "city" | "indoor",
    isAudioEnabled: boolean,
    isSimulationActive: boolean,
) => {
    const spokenNodesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (isSimulationActive) {
            spokenNodesRef.current.clear();
        }
    }, [isSimulationActive]);

    useEffect(() => {
        if (
            !isAudioEnabled ||
            navigationMode !== "indoor" ||
            route.length === 0
        ) {
            return;
        }

        if (!("speechSynthesis" in globalThis)) {
            console.warn("Browser does not support speech synthesis.");
            return;
        }

        route.forEach((point) => {
            const distance = getDistanceMeters(userLocation, {
                lat: point.lat,
                lng: point.lng,
            });
            const nodeId = point.itemId || `${point.lat}-${point.lng}`;

            if (distance <= 3 && !spokenNodesRef.current.has(nodeId)) {
                spokenNodesRef.current.add(nodeId);

                if (!point.audio_instruction) return;

                try {
                    const AudioCtxConstructor =
                        globalThis.AudioContext ??
                        (
                            globalThis as {
                                webkitAudioContext?: typeof AudioContext;
                            }
                        ).webkitAudioContext;
                    if (!AudioCtxConstructor) return;
                    const audioCtx = new AudioCtxConstructor();
                    const oscillator = audioCtx.createOscillator();
                    const gainNode = audioCtx.createGain();
                    oscillator.connect(gainNode);
                    gainNode.connect(audioCtx.destination);
                    oscillator.type = "sine";
                    oscillator.frequency.setValueAtTime(
                        880,
                        audioCtx.currentTime,
                    );
                    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                    oscillator.start();
                    oscillator.stop(audioCtx.currentTime + 0.1);
                } catch (e) {
                    console.warn("Audio beep failed", e);
                }

                const utterance = new SpeechSynthesisUtterance(
                    point.audio_instruction,
                );
                utterance.lang = "ro-RO";
                utterance.rate = 1;

                setTimeout(() => {
                    globalThis.speechSynthesis.speak(utterance);
                }, 150);
            }
        });
    }, [userLocation, route, navigationMode, isAudioEnabled]);
    const resetSpokenNodes = useCallback(() => {
        spokenNodesRef.current.clear();
    }, []);

    return { resetSpokenNodes };
};

const UnifiedMap: React.FC = () => {
    const userLocation = useStore((state) => state.userLocation);
    const setUserLocation = useStore((state) => state.setUserLocation);
    const targetStoreLocation = useStore((state) => state.targetStoreLocation);
    const setTargetStoreLocation = useStore(
        (state) => state.setTargetStoreLocation,
    );
    const targetStoreId = useStore((state) => state.targetStoreId);
    const setTargetStoreId = useStore((state) => state.setTargetStoreId);
    const setActiveShoppingSession = useStore(
        (state) => state.setActiveShoppingSession,
    );
    const activeShoppingSession = useStore(
        (state) => state.activeShoppingSession,
    );
    const targetStoreTransit = useStore((state) => state.targetStoreTransit);
    const setTargetStoreTransit = useStore(
        (state) => state.setTargetStoreTransit,
    );
    const navigationMode = useStore((state) => state.navigationMode);
    const setNavigationMode = useStore((state) => state.setNavigationMode);
    const setHasEnteredStore = useStore((state) => state.setHasEnteredStore);
    const hasEnteredStore = useStore((state) => state.hasEnteredStore);
    const route = useStore((state) => state.route);
    const macroRouteGeometry = useStore((state) => state.macroRouteGeometry);
    const indoorItems = useStore((state) => state.items);
    const setItems = useStore((state) => state.setItems);
    const isAutoCenterEnabled = useStore((state) => state.isAutoCenterEnabled);
    const setIsAutoCenterEnabled = useStore(
        (state) => state.setIsAutoCenterEnabled,
    );
    const isMockGpsEnabled = useStore((state) => state.isMockGpsEnabled);
    const setIsMockGpsEnabled = useStore((state) => state.setIsMockGpsEnabled);
    const gpsError = useStore((state) => state.gpsError);
    const forceIndoorMode = useStore((state) => state.forceIndoorMode);
    const { lists } = useListsStore();

    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    const [isShowingStores, setIsShowingStores] = useState(false);
    const [isFetchingStores, setIsFetchingStores] = useState(false);
    const [recommendedStores, setRecommendedStores] = useState<
        StoreRecommendation[]
    >([]);
    const [showCustomStoreModal, setShowCustomStoreModal] = useState(false);
    const [customStoreName, setCustomStoreName] = useState("");
    const [customStoreAddress, setCustomStoreAddress] = useState("");
    const [customStoreNotes, setCustomStoreNotes] = useState("");
    const [isStartingShopping, setIsStartingShopping] = useState(false);
    const [transportMode, setTransportMode] = useState<"driving" | "walking">(
        "driving",
    );
    const isAudioEnabled = useStore((state) => state.isAudioEnabled);
    const setIsAudioEnabled = useStore((state) => state.setIsAudioEnabled);
    const isSimulationActive = useStore((state) => state.isSimulationActive);
    const routeOriginRef = useRef<Coordinate | null>(null);
    const lastDeviationRecalcRef = useRef<Coordinate | null>(null);

    const { resetSpokenNodes } = useAudioNavigation(
        userLocation,
        route,
        navigationMode,
        isAudioEnabled,
        isSimulationActive,
    );
    const isMicroView = navigationMode === "indoor";

    const activeTarget: Coordinate | null = targetStoreLocation;
    const shoppableLists = useMemo(
        () => lists.filter(isNormalShoppingList),
        [lists],
    );
    const selectedList = selectedListId
        ? shoppableLists.find((list) => list.id === selectedListId)
        : null;
    const activeIndoorItems =
        selectedList?.items && selectedList.items.length > 0
            ? selectedList.items
            : indoorItems;
    const remainingIndoorItemIds = useMemo(() => {
        return (
            activeIndoorItems
                .filter((item) => !item.checked)
                .map((item) => item.id) ?? []
        );
    }, [activeIndoorItems]);
    const activeTransit = targetStoreTransit ?? {
        driving: { timeMins: 0, distanceKm: "0.0" },
        walking: { timeMins: 0, distanceKm: "0.0" },
    };
    const isNewCustomStore =
        !!activeShoppingSession?.storeCandidateSubmissionId ||
        activeShoppingSession?.officialStore === false ||
        targetStoreTransit === null;

    const fetchMacroRoute = useCallback(
        async (storeId: string) => {
            try {
                const baseUrl = getApiBaseUrl();
                const loc = useStore.getState().userLocation;
                const params = new URLSearchParams({
                    userLat: String(loc.lat),
                    userLng: String(loc.lng),
                    storeId,
                });
                const response = await fetch(
                    `${baseUrl}/api/routing/macro?${params}`,
                    {
                        headers: {
                            Authorization: `Bearer ${useStore.getState().token}`,
                        },
                        credentials: "include",
                    },
                );
                if (!response.ok) {
                    useStore.getState().setMacroRouteGeometry([]);
                    return;
                }

                const data = await response.json();
                const polylineString = data[transportMode]?.polyline;

                if (!polylineString) {
                    useStore.getState().setMacroRouteGeometry([]);
                    return;
                }

                const decodedPath = polyline.decode(polylineString);
                useStore.getState().setMacroRouteGeometry(decodedPath);

                if (decodedPath.length > 0) {
                    const lastPoint = decodedPath[decodedPath.length - 1];
                    setTargetStoreLocation({
                        lat: lastPoint[0],
                        lng: lastPoint[1],
                    });
                }
            } catch (err) {
                console.error("Failed to start route:", err);
                useStore.getState().setMacroRouteGeometry([]);
            }
        },
        [transportMode, setTargetStoreLocation],
    );

    useEffect(() => {
        // Automatic geofence transitions disabled per user request
    }, []);

    // Restore shopping session after page refresh
    const restoredRef = useRef(false);
    useEffect(() => {
        if (restoredRef.current) return;
        if (!activeShoppingSession) return;

        restoredRef.current = true;

        // Restore selected list from persisted session
        const sessionListId = activeShoppingSession.listId;
        const matchingList = shoppableLists.find((l) => l.id === sessionListId);
        if (matchingList && !selectedListId) {
            setSelectedListId(sessionListId);
            setItems(matchingList.items);
        }

        // If we were in indoor mode, restore it
        if (
            navigationMode === "indoor" &&
            hasEnteredStore &&
            targetStoreLocation
        ) {
            teleport(targetStoreLocation.lat, targetStoreLocation.lng);
        }

        // If we had a target store in city mode, re-fetch macro route
        if (
            navigationMode === "city" &&
            targetStoreLocation &&
            targetStoreId &&
            macroRouteGeometry.length === 0
        ) {
            void fetchMacroRoute(targetStoreId);
        }
    }, [
        activeShoppingSession,
        shoppableLists,
        selectedListId,
        navigationMode,
        hasEnteredStore,
        targetStoreLocation,
        targetStoreId,
        macroRouteGeometry.length,
        fetchMacroRoute,
        setItems,
    ]);

    useEffect(() => {
        if (selectedListId && !selectedList) {
            setSelectedListId(null);
            setIsShowingStores(false);
            setRecommendedStores([]);
            setItems([]);
        }
    }, [selectedListId, selectedList, setItems]);

    useEffect(() => {
        if (navigationMode !== "indoor" || !selectedListId) {
            return;
        }

        setItems(activeIndoorItems);

        if (remainingIndoorItemIds.length === 0) {
            useStore.getState().setRoute([]);
            useStore.getState().setStatus("All items checked.");
            return;
        }

        // Grab the LATEST user location directly from the store
        // without making it a reactive dependency!
        const currentUserLocation = useStore.getState().userLocation;

        routeOriginRef.current = { ...currentUserLocation };
        lastDeviationRecalcRef.current = { ...currentUserLocation };

        void loadRoute(
            remainingIndoorItemIds,
            currentUserLocation.lat,
            currentUserLocation.lng,
            activeIndoorItems.filter((item) => !item.checked),
            targetStoreId || undefined,
        );
    }, [
        navigationMode,
        selectedListId,
        remainingIndoorItemIds.length,
        activeIndoorItems,
        setItems,
        targetStoreId,
        remainingIndoorItemIds,
    ]);

    useEffect(() => {
        if (
            navigationMode !== "indoor" ||
            activeIndoorItems.length === 0 ||
            route.length === 0
        ) {
            return;
        }

        const alignedRoute = alignRouteToItems(
            route,
            activeIndoorItems.filter((item) => !item.checked),
        );
        const routeChanged = alignedRoute.some(
            (point, index) =>
                point.itemId !== route[index]?.itemId ||
                point.name !== route[index]?.name,
        );

        if (routeChanged) {
            useStore.getState().setRoute(alignedRoute);
        }
    }, [navigationMode, route, activeIndoorItems]);

    useEffect(() => {
        if (
            navigationMode !== "indoor" ||
            remainingIndoorItemIds.length === 0 ||
            route.length === 0 ||
            !routeOriginRef.current
        ) {
            return;
        }

        const distanceToRoute = getDistanceToRouteMeters(
            userLocation,
            routeOriginRef.current,
            route,
        );
        const distanceFromLastRecalc = lastDeviationRecalcRef.current
            ? getDistanceMeters(userLocation, lastDeviationRecalcRef.current)
            : Number.POSITIVE_INFINITY;

        if (distanceToRoute < 15 || distanceFromLastRecalc < 8) {
            return;
        }

        routeOriginRef.current = { ...userLocation };
        lastDeviationRecalcRef.current = { ...userLocation };
        void loadRoute(
            remainingIndoorItemIds,
            userLocation.lat,
            userLocation.lng,
            activeIndoorItems.filter((item) => !item.checked),
            targetStoreId || undefined,
        );
    }, [
        navigationMode,
        remainingIndoorItemIds,
        route,
        userLocation,
        activeIndoorItems,
        targetStoreId,
    ]);

    // --- AUDIO NAVIGATION LOGIC ---
    // Extracting audio logic to useAudioNavigation hook...
    const handleListSelect = (listId: string) => {
        const selectedList = shoppableLists.find((l) => l.id === listId);
        if (!selectedList) return;

        setSelectedListId(listId);
        setItems(selectedList.items);
        setIsShowingStores(false);
        setRecommendedStores([]);
    };

    const handleFetchStores = async (listIdOverride?: string) => {
        const idToFetch = listIdOverride ?? selectedListId;
        if (!idToFetch) return;

        const selectedList = shoppableLists.find((l) => l.id === idToFetch);
        if (!selectedList) return;

        await fetchStoreRecommendations(selectedList);
    };

    const fetchStoreRecommendations = async (selectedList: ShoppingList) => {
        setIsFetchingStores(true);
        try {
            const itemIds =
                selectedList.items
                    .map((item) => item.catalogId || item.id)
                    .filter((id) => id !== undefined && id !== null) || [];
            if (itemIds.length === 0) {
                setRecommendedStores([]);
                setIsShowingStores(true);
                return;
            }

            const baseUrl = getApiBaseUrl();
            const response = await fetch(
                `${baseUrl}/api/routing/stores-match`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${useStore.getState().token}`,
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        userLat: userLocation.lat,
                        userLng: userLocation.lng,
                        radiusInMeters: 5000,
                        itemIds,
                    }),
                },
            );

            if (!response.ok) {
                console.error(`HTTP Error: ${response.status}`);
                setRecommendedStores([]);
                setIsShowingStores(true);
                return;
            }
            const data = await response.json();
            const storesArray = Array.isArray(data) ? data : [data];

            const mappedStores: StoreRecommendation[] = await Promise.all(
                storesArray.map((store: ApiStoreMatch) =>
                    mapApiStoreToRecommendation(
                        store,
                        userLocation,
                        baseUrl,
                        itemIds.length,
                    ),
                ),
            );

            setRecommendedStores(mappedStores);
            setIsShowingStores(true);
        } catch (error) {
            console.error("Backend match failed", error);
            setRecommendedStores([]);
            setIsShowingStores(true);
        } finally {
            setIsFetchingStores(false);
        }
    };

    const startShoppingSession = async (payload: {
        listId: string;
        storeId?: string;
        customStoreName?: string;
        customStoreAddress?: string;
        customStoreNotes?: string;
        latitude?: number;
        longitude?: number;
    }) => {
        setIsStartingShopping(true);
        try {
            const session = await startShoppingRequest(payload);
            setActiveShoppingSession(session);
            return session;
        } finally {
            setIsStartingShopping(false);
        }
    };

    const handleStartRoute = async (store: StoreRecommendation) => {
        if (!selectedListId || !selectedList) return;
        await startShoppingSession({
            listId: selectedListId,
            storeId: store.id,
        });
        setTargetStoreLocation({ lat: store.lat, lng: store.lng });
        setTargetStoreId(store.id);
        setTargetStoreTransit(store.transit);
        setHasEnteredStore(false);

        await fetchMacroRoute(store.id);

        setNavigationMode("city");
        setIsShowingStores(false);
    };

    const handleStartCustomStore = async () => {
        if (!selectedListId || !selectedList || !customStoreName.trim()) return;

        try {
            setIsStartingShopping(true);
            const trimmedAddress = customStoreAddress.trim();

            let coords = await geocodeStore(
                customStoreName.trim(),
                trimmedAddress,
                userLocation,
            );

            if (!coords && trimmedAddress.length > 0) {
                alert(
                    "Nu am putut localiza adresa introdusa. Verifica adresa sau foloseste un reper mai clar.",
                );
                return;
            }

            if (!coords) {
                console.warn(
                    "Geocoding failed for custom store, using current user location as fallback.",
                );
                coords = userLocation;
            }

            const session = await startShoppingSession({
                listId: selectedListId,
                customStoreName: customStoreName.trim(),
                customStoreAddress: trimmedAddress || undefined,
                customStoreNotes: customStoreNotes.trim() || undefined,
                latitude: coords.lat,
                longitude: coords.lng,
            });

            setTargetStoreId(session.storeId ?? null);
            setTargetStoreLocation({ lat: coords.lat, lng: coords.lng });
            setTargetStoreTransit(null);
            setHasEnteredStore(false);

            if (session.storeId) {
                await fetchMacroRoute(session.storeId);
            }

            setNavigationMode("city");
            setIsShowingStores(false);
            setShowCustomStoreModal(false);
            setCustomStoreName("");
            setCustomStoreAddress("");
            setCustomStoreNotes("");
        } catch (error) {
            console.error("Failed to start custom shopping session", error);
            alert("Nu am putut porni sesiunea de cumpărături.");
        } finally {
            setIsStartingShopping(false);
        }
    };

    const handleEnterIndoorMode = async () => {
        const activeList = shoppableLists.find((l) => l.id === selectedListId);
        const currentItems =
            activeList?.items.filter((item) => !item.checked) || [];

        if (currentItems.length === 0) {
            alert("Te rog selectează o listă care conține măcar un produs!");
            return;
        }

        if (!targetStoreLocation) return;

        const loc = targetStoreLocation;
        const distanceToStore = getDistanceMeters(userLocation, loc);
        const maxManualEntryDistance = GEOFENCE_RADIUS_METERS * 3;

        if (distanceToStore > maxManualEntryDistance) {
            alert(
                `Esti prea departe de magazin (${Math.round(distanceToStore)}m). Apropie-te de magazin pentru a intra în modul indoor.`,
            );
            return;
        }

        setIsAutoCenterEnabled(true);
        setTargetStoreLocation(loc);
        forceIndoorMode();

        teleport(loc.lat, loc.lng);

        setItems(activeList?.items || []);
        await loadRoute(
            currentItems.map((item) => item.id),
            loc.lat,
            loc.lng,
            currentItems,
            targetStoreId || undefined,
        );
    };

    const handleRecenter = () => {
        setIsAutoCenterEnabled(true);
        setUserLocation({ ...userLocation });
    };

    const footprint = useStoreFootprint(activeTarget);

    const renderSidebarContent = () => {
        if (!selectedListId) {
            return (
                <ListSelectionView
                    lists={shoppableLists}
                    isMicroView={isMicroView}
                    handleListSelect={handleListSelect}
                />
            );
        }

        if (isShowingStores && !isMicroView) {
            return (
                <StoreRecommendationView
                    recommendedStores={recommendedStores}
                    transportMode={transportMode}
                    setTransportMode={setTransportMode}
                    setSelectedListId={setSelectedListId}
                    handleStartRoute={handleStartRoute}
                    onPickOwnStore={() => setShowCustomStoreModal(true)}
                />
            );
        }

        if (isMicroView && selectedListId) {
            return (
                <IndoorRouteList
                    listId={selectedListId}
                    items={activeIndoorItems}
                    route={route}
                />
            );
        }

        return (
            <ListDetailView
                selectedListId={selectedListId}
                isMicroView={isMicroView}
                setSelectedListId={setSelectedListId}
                targetStoreLocation={targetStoreLocation}
                setTargetStoreLocation={setTargetStoreLocation}
                handleFetchStores={handleFetchStores}
                isFetchingStores={isFetchingStores}
            />
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-bg">
            <div className="relative flex-1 overflow-hidden">
                {isMicroView ? (
                    <StoreMap
                        isSidebarExpanded={isSidebarExpanded}
                        onToggleSidebar={() =>
                            setIsSidebarExpanded(!isSidebarExpanded)
                        }
                    />
                ) : (
                    <MapContainer
                        center={[userLocation.lat, userLocation.lng]}
                        zoom={14}
                        style={{
                            height: "100%",
                            width: "100%",
                            background: "var(--color-bg)",
                        }}
                        zoomControl={false}
                    >
                        <style>{`\n                            .leaflet-top.leaflet-left {\n                                margin-top: 60px;\n                            }\n                        `}</style>
                        <ZoomControl position="topleft" />

                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapEvents />
                        <MapController
                            center={[userLocation.lat, userLocation.lng]}
                            isMicroView={isMicroView}
                        />

                        {!targetStoreLocation &&
                            recommendedStores.map((store) => (
                                <Marker
                                    key={store.id}
                                    position={[store.lat, store.lng]}
                                    icon={L.divIcon({
                                        className: "store-marker",
                                        html: `<div style="color: var(--color-accent);"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg></div>`,
                                        iconSize: [24, 24],
                                        iconAnchor: [12, 24],
                                    })}
                                >
                                    <Popup>{store.name}</Popup>
                                </Marker>
                            ))}

                        {targetStoreLocation && !isNewCustomStore && (
                            <>
                                <Circle
                                    center={[
                                        targetStoreLocation.lat,
                                        targetStoreLocation.lng,
                                    ]}
                                    radius={GEOFENCE_RADIUS_METERS}
                                    pathOptions={{
                                        color: isMicroView
                                            ? "var(--color-green-neon)"
                                            : "var(--color-accent)",
                                        fillOpacity: 0.1,
                                        dashArray: "5, 10",
                                    }}
                                />
                                <Polygon
                                    positions={footprint}
                                    pathOptions={{
                                        color: "var(--color-accent)",
                                        fillColor: "var(--color-accent-subtle)",
                                        fillOpacity: isMicroView ? 0.3 : 0.1,
                                        weight: 2,
                                    }}
                                />
                                <Marker
                                    position={[
                                        targetStoreLocation.lat,
                                        targetStoreLocation.lng,
                                    ]}
                                    icon={L.divIcon({
                                        className: "target-store-icon",
                                        html: `<div style="color: var(--color-accent);"><svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg></div>`,
                                        iconSize: [32, 32],
                                        iconAnchor: [16, 32],
                                    })}
                                />
                            </>
                        )}

                        {targetStoreLocation &&
                            !isMicroView &&
                            macroRouteGeometry.length > 0 && (
                                <Polyline
                                    positions={macroRouteGeometry}
                                    pathOptions={{
                                        color: "var(--color-blue-neon)",
                                        weight: 4,
                                        dashArray: "10, 10",
                                    }}
                                />
                            )}

                        {isMicroView && route.length > 0 && (
                            <>
                                <Polyline
                                    positions={[
                                        [userLocation.lat, userLocation.lng],
                                        ...route.map(
                                            (p) =>
                                                [p.lat, p.lng] as [
                                                    number,
                                                    number,
                                                ],
                                        ),
                                    ]}
                                    pathOptions={{
                                        color: "var(--color-green-neon)",
                                        weight: 4,
                                    }}
                                />
                                {route.map((point, idx) => (
                                    <Marker
                                        key={point.itemId}
                                        position={[point.lat, point.lng]}
                                        icon={L.divIcon({
                                            className: "route-idx",
                                            html: `<div style="background: var(--color-accent); color: white; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; border: 2px solid white; font-size: 10px;">${idx + 1}</div>`,
                                            iconSize: [22, 22],
                                            iconAnchor: [11, 11],
                                        })}
                                    >
                                        <Popup>{point.name}</Popup>
                                        <Tooltip
                                            permanent
                                            direction="top"
                                            offset={[0, -10]}
                                            className="custom-tooltip"
                                        >
                                            <span className="font-black uppercase text-[9px] tracking-tighter">
                                                {point.name}
                                            </span>
                                        </Tooltip>
                                    </Marker>
                                ))}
                            </>
                        )}
                        <Marker
                            position={[userLocation.lat, userLocation.lng]}
                        />
                    </MapContainer>
                )}

                {isSidebarExpanded && (
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-2400 min-[1000px]:hidden animate-fade-in"
                        onClick={() => setIsSidebarExpanded(false)}
                        aria-label="Close List"
                    />
                )}

                <div
                    className={`absolute z-2500 transition-all duration-500 ease-in-out top-0 bottom-0 right-0 bg-surface/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden border-l border-border ${isSidebarExpanded ? "translate-x-0" : "translate-x-full"} max-[640px]:w-[85vw] sm:max-[1000px]:w-80 min-[1000px]:w-100`}
                >
                    <div className="hidden max-[640px]:flex justify-center px-4 pt-3 pb-1 shrink-0">
                        <div className="w-10 h-1 bg-border rounded-full" />
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6 pt-1 sm:pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
                        {renderSidebarContent()}
                    </div>
                </div>

                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-3000 flex flex-col gap-1.5 sm:gap-2 items-start">
                    {/* Badge-ul de View */}
                    {import.meta.env.DEV && (
                        <div
                            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full font-bold text-[10px] sm:text-xs uppercase tracking-widest shadow-lg border backdrop-blur-md w-fit ${isMicroView ? "bg-accent text-white border-accent" : "bg-surface/80 text-text-strong border-border"}`}
                        >
                            {isMicroView
                                ? "Micro View: Indoor"
                                : "Macro View: City"}
                        </div>
                    )}

                    {/* Butonul de Audio (Doar pe Indoor) */}
                    {isMicroView && (
                        <div className="flex w-fit bg-surface/90 backdrop-blur-md border border-border rounded-lg sm:rounded-xl p-0.5 sm:p-1 shadow-lg">
                            <button
                                type="button"
                                onClick={() => {
                                    if (isAudioEnabled) {
                                        globalThis.speechSynthesis.cancel();
                                    } else {
                                        resetSpokenNodes();
                                    }
                                    setIsAudioEnabled(!isAudioEnabled);
                                }}
                                className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-2 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-tighter transition-all ${isAudioEnabled ? "bg-accent text-white" : "text-text-muted hover:text-text-strong"}`}
                                title={
                                    isAudioEnabled
                                        ? "Mute Voice"
                                        : "Unmute Voice"
                                }
                            >
                                {isAudioEnabled ? (
                                    <Volume2 size={14} />
                                ) : (
                                    <VolumeX size={14} />
                                )}
                                {isAudioEnabled ? "ON" : "OFF"}
                            </button>
                        </div>
                    )}
                </div>

                {/* GPS Error Banner */}
                {gpsError && !isMicroView && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-3000 max-w-[90vw] sm:max-w-md">
                        <div className="flex items-center gap-2 px-3 py-2 bg-warning/90 text-white rounded-full text-xs font-bold shadow-lg backdrop-blur-md">
                            <span className="shrink-0">⚠</span>
                            <span className="truncate">{gpsError}</span>
                        </div>
                    </div>
                )}

                {/* BUTOANELE MOCK / REAL GPS - RIGHT SIDE CORNER (dev only) */}
                {import.meta.env.DEV && (
                    <div className="absolute top-4 right-4 z-3000">
                        <div className="flex bg-surface/90 backdrop-blur-md border border-border rounded-xl p-1 shadow-lg">
                            <button
                                type="button"
                                onClick={() => setIsMockGpsEnabled(true)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${isMockGpsEnabled ? "bg-accent text-white" : "text-text-muted hover:text-text-strong"}`}
                                title="Use Mock GPS (Drift)"
                            >
                                <Cpu size={12} />
                                Mock
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsMockGpsEnabled(false)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${isMockGpsEnabled ? "text-text-muted hover:text-text-strong" : "bg-blue-600 text-white"}`}
                                title="Use Real Device GPS"
                            >
                                <Satellite size={12} />
                                Real
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {!isMicroView && targetStoreLocation && (
                <div
                    className={`absolute bottom-20 sm:bottom-28 left-3 sm:left-6 z-2000 rounded-2xl sm:rounded-3xl border border-border bg-surface/95 p-3 sm:p-5 shadow-2xl backdrop-blur-xl transition-all duration-500 ${isSidebarExpanded ? "right-3 sm:right-6 min-[1000px]:right-106" : "right-3 sm:right-6"}`}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-tight text-text-strong">
                                Route Active
                            </h3>
                            <p className="text-xs font-medium text-text-muted">
                                Head to the store entrance
                            </p>
                        </div>
                        <div className="flex rounded-xl border border-border bg-bg-muted p-1 shadow-inner">
                            <button
                                type="button"
                                onClick={() => setTransportMode("driving")}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${transportMode === "driving" ? "bg-surface text-accent shadow-sm" : "text-text-muted hover:text-text-strong"}`}
                            >
                                <Car size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">
                                    {activeTransit.driving.timeMins}m
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setTransportMode("walking")}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${transportMode === "walking" ? "bg-surface text-accent shadow-sm" : "text-text-muted hover:text-text-strong"}`}
                            >
                                <Footprints size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">
                                    {activeTransit.walking.timeMins}m
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setTargetStoreLocation(null);
                                setTargetStoreTransit(null);
                                useStore.getState().setMacroRouteGeometry([]);
                            }}
                            className="flex-1 rounded-2xl border border-border bg-bg-muted py-3 text-xs font-black text-text-strong transition-colors hover:bg-bg"
                        >
                            CANCEL
                        </button>
                        <button
                            type="button"
                            onClick={handleEnterIndoorMode}
                            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-xs font-black text-white shadow-[0_4px_15px_var(--color-accent-glow)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <CheckCircle2 size={16} />
                            ARRIVED
                        </button>
                    </div>
                </div>
            )}

            {!isMicroView && (
                <div className="relative z-3000 flex h-16 sm:h-21 items-center justify-between border-t border-border bg-surface/80 px-3 sm:px-6 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl">
                    <div className="flex items-center gap-2 sm:gap-4">
                        <button
                            type="button"
                            onClick={handleRecenter}
                            className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 ${isAutoCenterEnabled ? "bg-accent text-text-on-accent" : "bg-surface border border-border text-text-strong"}`}
                            title={
                                isAutoCenterEnabled
                                    ? "Auto-Center On"
                                    : "Auto-Center Off"
                            }
                        >
                            <LocateFixed size={18} />
                        </button>
                        {!isAutoCenterEnabled && (
                            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest text-accent animate-pulse">
                                Manual Mode
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                        className={`flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-3 rounded-full font-bold text-sm shadow-lg transition-all active:scale-95 ${isSidebarExpanded ? "bg-accent text-text-on-accent" : "bg-text-strong text-bg"}`}
                    >
                        {isSidebarExpanded ? (
                            <X size={18} />
                        ) : (
                            <ListIcon size={18} />
                        )}
                        <span className="hidden sm:inline">
                            {isSidebarExpanded
                                ? "Close Panel"
                                : "Route Planner"}
                        </span>
                    </button>
                </div>
            )}
            <Modal
                isOpen={showCustomStoreModal}
                onClose={() => setShowCustomStoreModal(false)}
                title="Pick Your Own Store"
                subtitle="Custom stores stay outside the official store data until they are reviewed."
                maxWidth="400px"
            >
                <div className="flex flex-col gap-3">
                    <input
                        type="text"
                        maxLength={80}
                        value={customStoreName}
                        onChange={(event) =>
                            setCustomStoreName(event.target.value)
                        }
                        placeholder="Store name"
                        className="w-full px-3 py-2.5 bg-bg-muted border border-border rounded-lg text-sm outline-none focus:border-accent"
                    />
                    <input
                        type="text"
                        maxLength={120}
                        value={customStoreAddress}
                        onChange={(event) =>
                            setCustomStoreAddress(event.target.value)
                        }
                        placeholder="Address or landmark"
                        className="w-full px-3 py-2.5 bg-bg-muted border border-border rounded-lg text-sm outline-none focus:border-accent"
                    />
                    <textarea
                        value={customStoreNotes}
                        onChange={(event) =>
                            setCustomStoreNotes(event.target.value)
                        }
                        placeholder="Optional notes"
                        className="w-full min-h-16 sm:min-h-24 px-3 py-2.5 bg-bg-muted border border-border rounded-lg text-sm outline-none focus:border-accent resize-none"
                    />
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => setShowCustomStoreModal(false)}
                            className="py-2.5 bg-bg-muted rounded-lg font-bold text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={
                                isStartingShopping || !customStoreName.trim()
                            }
                            onClick={handleStartCustomStore}
                            className="py-2.5 bg-accent text-white rounded-lg font-bold text-sm disabled:opacity-50"
                        >
                            Start Shopping
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default UnifiedMap;
