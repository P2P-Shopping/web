import L from "leaflet";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
    Circle,
    MapContainer,
    Marker,
    Polygon,
    Polyline,
    Popup,
    TileLayer,
    useMap,
    useMapEvents,
    ZoomControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
    ArrowLeft,
    Car,
    CheckCircle2,
    ChevronRight,
    Cpu,
    Footprints,
    List as ListIcon,
    LocateFixed,
    MapPin,
    Satellite,
    X,
    Zap,
} from "lucide-react";
import type { AppState, Coordinate, RoutePoint } from "../../context/useStore";
import { useStore } from "../../context/useStore";
import {
    DEMO_STORE_LOCATION,
    GEOFENCE_RADIUS_METERS,
} from "../../services/geofence";
import { loadRoute } from "../../services/loadRoute";
import { teleport } from "../../services/mockEmitter";
import { useListsStore } from "../../store/useListsStore";
import type { Item, ShoppingList } from "../../types";
import ListDetail from "../ListDetail/ListDetail";
import StoreMap from "../StoreMap/StoreMap";

// --- Types & Constants ---
export interface StoreRecommendation {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    stockMatchPercentage: number;
    transit: {
        driving: { timeMins: number; distanceKm: string | number };
        walking: { timeMins: number; distanceKm: string | number };
    };
}

interface ApiStoreMatch {
    storeId: string;
    storeName: string;
    matchedItems: number;
    distanceMeters: number;
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
    try {
        const query = encodeURIComponent(`${storeName} ${address || ""}`);
        const delta = 0.25;
        const left = userLocation.lng - delta;
        const right = userLocation.lng + delta;
        const top = userLocation.lat + delta;
        const bottom = userLocation.lat - delta;
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&viewbox=${left},${top},${right},${bottom}&bounded=1`;
        const nomRes = await fetch(nomUrl, {
            headers: {
                Accept: "application/json",
            },
        });
        if (nomRes.ok) {
            const nomData = await nomRes.json();
            if (Array.isArray(nomData) && nomData.length > 0) {
                return {
                    lat: Number(nomData[0].lat),
                    lng: Number(nomData[0].lon),
                };
            }
        }
    } catch (err) {
        console.warn("Geocoding failed for store", storeName, err);
    }
    return null;
};

const mapApiStoreToRecommendation = async (
    store: ApiStoreMatch,
    userLocation: { lat: number; lng: number },
    baseUrl: string,
    itemCount: number,
): Promise<StoreRecommendation> => {
    const realTransit = {
        driving: { timeMins: 10, distanceKm: "2.0" },
        walking: { timeMins: 30, distanceKm: "2.0" },
    };

    try {
        const params = new URLSearchParams({
            userLat: String(userLocation.lat),
            userLng: String(userLocation.lng),
            storeId: store.storeId,
        });
        const macroRes = await fetch(`${baseUrl}/api/routing/macro?${params}`);
        if (macroRes.ok) {
            const macroData = await macroRes.json();
            if (macroData.driving) {
                realTransit.driving = {
                    timeMins: Math.round(
                        macroData.driving.durationSeconds / 60,
                    ),
                    distanceKm: (macroData.driving.distanceM / 1000).toFixed(1),
                };
            }
            if (macroData.walking) {
                realTransit.walking = {
                    timeMins: Math.round(
                        macroData.walking.durationSeconds / 60,
                    ),
                    distanceKm: (macroData.walking.distanceM / 1000).toFixed(1),
                };
            }
        }
    } catch (err) {
        console.warn("Could not fetch macro-routing", err);
    }

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

    let lat = parseNumber(rawLat);
    let lng = parseNumber(rawLng);

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
        lat = DEMO_STORE_LOCATION.lat;
        lng = DEMO_STORE_LOCATION.lng;
    }

    return {
        id: store.storeId,
        name: store.storeName,
        address: store.address || "Address unavailable",
        lat,
        lng,
        stockMatchPercentage: Math.round(
            (store.matchedItems / Math.max(itemCount, 1)) * 100,
        ),
        transit: realTransit,
    };
};

// Fix Leaflet marker icons
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

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
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <header>
            <h2 className="text-2xl font-black text-text-strong uppercase tracking-tight">
                {isMicroView ? "Shopping Lists" : "Plan Your Route"}
            </h2>
            <p className="text-sm text-text-muted mt-1 leading-relaxed">
                {isMicroView
                    ? "Select a list to navigate to its items."
                    : "Select a shopping list to discover the best retail locations near you."}
            </p>
        </header>
        <div className="flex flex-col gap-4">
            {lists.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center gap-3 bg-bg-muted rounded-3xl border border-dashed border-border">
                    <ListIcon
                        size={32}
                        className="text-text-muted opacity-30"
                    />
                    <p className="text-sm font-bold text-text-muted">
                        No lists found.
                    </p>
                </div>
            ) : (
                lists.map((list) => (
                    <button
                        key={list.id}
                        type="button"
                        onClick={() => handleListSelect(list.id)}
                        className="flex items-center justify-between p-6 bg-surface border border-border/60 rounded-[28px] hover:border-accent hover:bg-accent-subtle/30 transition-all group text-left shadow-sm hover:shadow-xl hover:-translate-y-0.5 relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex flex-col gap-1.5">
                            <span className="font-extrabold text-text-strong group-hover:text-accent transition-colors text-lg leading-tight">
                                {list.name}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-text-muted px-2.5 py-1 bg-bg-muted rounded-full border border-border/30">
                                    {list.items?.length || 0} items
                                </span>
                                {list.category && (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-accent px-2.5 py-1 bg-accent-subtle rounded-full border border-accent-border/10">
                                        {list.category}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-bg-muted flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-all shadow-inner">
                            <ChevronRight
                                size={22}
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
}

const StoreRecommendationView: React.FC<StoreRecommendationViewProps> = ({
    recommendedStores,
    transportMode,
    setTransportMode,
    setSelectedListId,
    handleStartRoute,
}) => (
    <div className="flex flex-col gap-6 animate-in slide-in-from-right-4">
        <header className="flex flex-col gap-4">
            <button
                type="button"
                onClick={() => setSelectedListId(null)}
                className="flex items-center gap-2 text-xs font-black text-accent uppercase tracking-widest hover:-translate-x-1 transition-transform w-fit"
            >
                <ArrowLeft size={14} /> Back to lists
            </button>
            <div className="flex justify-between items-end">
                <div className="text-left">
                    <h2 className="text-2xl font-black text-text-strong uppercase tracking-tight">
                        Best Matches
                    </h2>
                    <p className="text-xs text-text-muted mt-1">
                        Found {recommendedStores.length} stores nearby.
                    </p>
                </div>
                <div className="flex bg-bg-muted p-1 rounded-2xl border border-border shadow-inner">
                    <button
                        type="button"
                        onClick={() => setTransportMode("driving")}
                        className={`p-2.5 rounded-xl transition-all ${transportMode === "driving" ? "bg-surface text-accent shadow-sm" : "text-text-muted hover:text-text-strong"}`}
                    >
                        <Car size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setTransportMode("walking")}
                        className={`p-2.5 rounded-xl transition-all ${transportMode === "walking" ? "bg-surface text-accent shadow-sm" : "text-text-muted hover:text-text-strong"}`}
                    >
                        <Footprints size={18} />
                    </button>
                </div>
            </div>
        </header>
        <div className="flex flex-col gap-4">
            {recommendedStores.map((store, idx) => (
                <div
                    key={store.id}
                    className={`p-5 rounded-[28px] border transition-all relative ${idx === 0 ? "bg-accent/5 border-accent shadow-[0_8px_30px_rgba(var(--color-accent-rgb),0.1)]" : "bg-bg-muted border-border"}`}
                >
                    {idx === 0 && (
                        <div className="absolute -top-3 left-6 px-3 py-1 bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 shadow-lg">
                            <CheckCircle2 size={12} />
                            Optimal Choice
                        </div>
                    )}
                    <div className="flex justify-between text-left">
                        <div className="flex flex-col gap-1">
                            <h3 className="font-black text-text-strong text-lg leading-tight">
                                {store.name}
                            </h3>
                            <div className="text-[11px] text-text-muted flex items-center gap-1">
                                <MapPin size={12} />
                                {store.address}
                            </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                            <span className="text-2xl font-black text-accent tracking-tighter">
                                {store.stockMatchPercentage}%
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">
                                Stock
                            </span>
                        </div>
                    </div>
                    <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                        <div className="text-xs font-bold text-text-strong flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                {transportMode === "driving" ? (
                                    <Car
                                        size={14}
                                        className="text-text-muted"
                                    />
                                ) : (
                                    <Footprints
                                        size={14}
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
                            className="px-6 py-2.5 bg-text-strong text-bg rounded-2xl text-xs font-black shadow-lg hover:scale-105 active:scale-95 transition-all"
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
    lists: ShoppingList[];
    isMicroView: boolean;
    setSelectedListId: (id: string | null) => void;
    targetStoreLocation: { lat: number; lng: number } | null;
    setTargetStoreLocation: (loc: { lat: number; lng: number } | null) => void;
    handleFetchStores: () => void;
    isFetchingStores: boolean;
}

const ListDetailView: React.FC<ListDetailViewProps> = ({
    selectedListId,
    lists,
    isMicroView,
    setSelectedListId,
    targetStoreLocation,
    setTargetStoreLocation,
    handleFetchStores,
    isFetchingStores,
}) => (
    <div className="relative animate-in fade-in slide-in-from-right-4 duration-500 h-full flex flex-col">
        <header className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-4 min-w-0">
                {!isMicroView && (
                    <button
                        type="button"
                        onClick={() => setSelectedListId(null)}
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-bg-muted text-text-muted hover:text-accent hover:bg-accent-subtle transition-all shrink-0"
                        title="Switch List"
                    >
                        <ArrowLeft size={18} />
                    </button>
                )}
                <h2 className="text-xl font-black text-text-strong uppercase tracking-tight truncate">
                    {lists.find((l) => l.id === selectedListId)?.name}
                </h2>
            </div>
            {!isMicroView && (
                <button
                    type="button"
                    onClick={() => setSelectedListId(null)}
                    className="text-xs font-bold text-accent hover:underline uppercase shrink-0 whitespace-nowrap"
                >
                    Switch List
                </button>
            )}
        </header>

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
                <ListDetail isEmbedded={true} listIdOverride={selectedListId} />
            </div>

            {!targetStoreLocation && !isMicroView && (
                <div className="pt-6 mt-4 border-t border-border shrink-0">
                    <button
                        type="button"
                        onClick={() => handleFetchStores()}
                        disabled={isFetchingStores}
                        className="w-full py-4 bg-accent text-white rounded-2xl font-black text-base shadow-[0_8px_25px_var(--color-accent-glow)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70"
                    >
                        {isFetchingStores ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                FINDING BEST STORES...
                            </>
                        ) : (
                            <>
                                <Zap size={20} fill="currentColor" />
                                PLAN MY ROUTE
                            </>
                        )}
                    </button>
                    <p className="text-[10px] text-text-muted text-center mt-3 font-bold uppercase tracking-widest opacity-60">
                        Discover stores with best stock & transit time
                    </p>
                </div>
            )}
        </div>
    </div>
);

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
    const updateItem = useListsStore((state) => state.updateItem);
    const setGlobalItems = useStore((state) => state.setItems);
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const itemsByName = new Map(
        items.map((item) => [normalizeLabel(item.name), item]),
    );
    const uncheckedItems = items.filter((item) => !item.checked);
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

    const handleCheck = (item: Item) => {
        if (item.checked || disappearingItemIds.has(item.id)) return;

        setDisappearingItemIds((prev) => new Set(prev).add(item.id));

        window.setTimeout(async () => {
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

    useEffect(() => {
        setDisappearingItemIds((prev) => {
            const next = new Set(
                [...prev].filter((itemId) =>
                    items.some((item) => item.id === itemId && !item.checked),
                ),
            );
            return next.size === prev.size ? prev : next;
        });
    }, [items]);

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
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => handleCheck(item)}
                                className={`flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-bg-muted p-4 text-left transition-all duration-300 hover:border-accent hover:bg-accent-subtle/20 ${
                                    isDisappearing
                                        ? "max-h-0 translate-x-4 scale-95 p-0 opacity-0"
                                        : "max-h-24 opacity-100"
                                }`}
                            >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-black text-white">
                                    {index + 1}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-black text-text-strong">
                                        {item.name}
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                                        Tap to check off
                                    </span>
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
        </div>
    );
};

const useIndoorCityTransition = (
    navigationMode: "city" | "indoor",
    route: RoutePoint[],
    selectedListId: string | null,
    lists: ShoppingList[],
    setNavigationMode: (mode: "city" | "indoor") => void,
    setTargetStoreLocation: (loc: Coordinate | null) => void,
    setTargetStoreTransit: (transit: AppState["targetStoreTransit"]) => void,
) => {
    useEffect(() => {
        if (navigationMode === "indoor" && selectedListId) {
            const activeList = lists.find((l) => l.id === selectedListId);
            if (!activeList) return;

            if (
                activeList.items.length > 0 &&
                activeList.items.every((item) => item.checked)
            ) {
                const transitionTimer = setTimeout(() => {
                    setNavigationMode("city");
                    setTargetStoreLocation(null);
                    setTargetStoreTransit(null);
                    useStore.getState().setMacroRouteGeometry([]);
                }, 1000);

                return () => clearTimeout(transitionTimer);
            }

            const lastRoutePoint = route.at(-1);
            if (!lastRoutePoint) return;
            const lastItemState = activeList.items.find(
                (item) => item.id === lastRoutePoint.itemId,
            );

            if (lastItemState?.checked) {
                const transitionTimer = setTimeout(() => {
                    setNavigationMode("city");
                    setTargetStoreLocation(null);
                    setTargetStoreTransit(null);
                    useStore.getState().setMacroRouteGeometry([]);
                }, 1000);

                return () => clearTimeout(transitionTimer);
            }
        }
    }, [
        lists,
        selectedListId,
        route,
        navigationMode,
        setNavigationMode,
        setTargetStoreLocation,
        setTargetStoreTransit,
    ]);
};

const useStoreFootprint = (activeTarget: { lat: number; lng: number }) => {
    const [footprint, setFootprint] = useState<[number, number][]>([
        [activeTarget.lat + 0.0005, activeTarget.lng - 0.0008],
        [activeTarget.lat + 0.0005, activeTarget.lng + 0.0008],
        [activeTarget.lat - 0.0005, activeTarget.lng + 0.0008],
        [activeTarget.lat - 0.0005, activeTarget.lng - 0.0008],
    ]);

    useEffect(() => {
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
                    }
                }
            } catch (err) {
                console.warn("Could not fetch OSM footprint", err);
            }
        };
        fetchFootprint();
    }, [activeTarget]);

    return footprint;
};

const UnifiedMap: React.FC = () => {
    const userLocation = useStore((state) => state.userLocation);
    const setUserLocation = useStore((state) => state.setUserLocation);
    const targetStoreLocation = useStore((state) => state.targetStoreLocation);
    const setTargetStoreLocation = useStore(
        (state) => state.setTargetStoreLocation,
    );
    const targetStoreTransit = useStore((state) => state.targetStoreTransit);
    const setTargetStoreTransit = useStore(
        (state) => state.setTargetStoreTransit,
    );
    const navigationMode = useStore((state) => state.navigationMode);
    const setNavigationMode = useStore((state) => state.setNavigationMode);
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
    const forceIndoorMode = useStore((state) => state.forceIndoorMode);
    const { lists } = useListsStore();

    const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    const [isShowingStores, setIsShowingStores] = useState(false);
    const [isFetchingStores, setIsFetchingStores] = useState(false);
    const [recommendedStores, setRecommendedStores] = useState<
        StoreRecommendation[]
    >([]);
    const [transportMode, setTransportMode] = useState<"driving" | "walking">(
        "driving",
    );
    const routeOriginRef = useRef<Coordinate | null>(null);
    const lastDeviationRecalcRef = useRef<Coordinate | null>(null);
    const isMicroView = navigationMode === "indoor";

    const activeTarget = targetStoreLocation || DEMO_STORE_LOCATION;
    const selectedList = selectedListId
        ? lists.find((list) => list.id === selectedListId)
        : null;
    const activeIndoorItems =
        selectedList?.items && selectedList.items.length > 0
            ? selectedList.items
            : indoorItems;
    const remainingIndoorItemIds =
        activeIndoorItems
            .filter((item) => !item.checked)
            .map((item) => item.id) ?? [];
    const remainingIndoorItemKey = remainingIndoorItemIds.join("|");
    const activeTransit = targetStoreTransit ?? {
        driving: { timeMins: 0, distanceKm: "0.0" },
        walking: { timeMins: 0, distanceKm: "0.0" },
    };

    useEffect(() => {
        // Automatic geofence transitions disabled per user request
    }, []);

    useIndoorCityTransition(
        navigationMode,
        route,
        selectedListId,
        lists,
        setNavigationMode,
        setTargetStoreLocation,
        setTargetStoreTransit,
    );

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

        routeOriginRef.current = { ...userLocation };
        lastDeviationRecalcRef.current = { ...userLocation };
        void loadRoute(
            remainingIndoorItemIds,
            userLocation.lat,
            userLocation.lng,
            activeIndoorItems.filter((item) => !item.checked),
        );
    }, [
        navigationMode,
        selectedListId,
        activeIndoorItems,
        remainingIndoorItemKey,
        setItems,
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
        );
    }, [
        navigationMode,
        remainingIndoorItemKey,
        route,
        userLocation,
        activeIndoorItems,
    ]);

    const handleListSelect = (listId: string) => {
        const selectedList = lists.find((l) => l.id === listId);
        if (!selectedList) return;

        setSelectedListId(listId);
        setItems(selectedList.items);
        setIsShowingStores(false);
        setRecommendedStores([]);
    };

    const handleFetchStores = async (listIdOverride?: string) => {
        const idToFetch = listIdOverride ?? selectedListId;
        if (!idToFetch) return;

        const selectedList = lists.find((l) => l.id === idToFetch);
        if (!selectedList) return;

        setIsFetchingStores(true);
        try {
            const itemIds = selectedList.items.map((item) => item.id) || [];
            if (itemIds.length === 0) {
                setRecommendedStores([]);
                setIsShowingStores(true);
                return;
            }

            const apiBase =
                import.meta.env.VITE_API_URL ||
                import.meta.env.VITE_API_BASE_URL ||
                "http://localhost:8081";
            const baseUrl = apiBase === "/" ? "" : apiBase;

            const response = await fetch(
                `${baseUrl}/api/routing/stores-match`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
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

    const handleStartRoute = async (store: StoreRecommendation) => {
        setTargetStoreLocation({ lat: store.lat, lng: store.lng });
        setTargetStoreTransit(store.transit);

        try {
            const apiBase =
                import.meta.env.VITE_API_URL ||
                import.meta.env.VITE_API_BASE_URL ||
                "http://localhost:8081";
            const baseUrl = apiBase === "/" ? "" : apiBase;
            const params = new URLSearchParams({
                userLat: String(userLocation.lat),
                userLng: String(userLocation.lng),
                storeId: store.id,
            });
            const response = await fetch(
                `${baseUrl}/api/routing/macro?${params}`,
            );
            if (response.ok) {
                const data = await response.json();
                const geo = data[transportMode]?.geometry;
                if (geo && Array.isArray(geo)) {
                    useStore.getState().setMacroRouteGeometry(geo);
                } else {
                    useStore.getState().setMacroRouteGeometry([]);
                }
            } else {
                useStore.getState().setMacroRouteGeometry([]);
            }
        } catch (err) {
            console.error("Failed to start route:", err);
            useStore.getState().setMacroRouteGeometry([]);
        }

        setNavigationMode("city");
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
                    lists={lists}
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
                lists={lists}
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

                        {targetStoreLocation && (
                            <>
                                <Circle
                                    center={[
                                        activeTarget.lat,
                                        activeTarget.lng,
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
                                        activeTarget.lat,
                                        activeTarget.lng,
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

                        {targetStoreLocation && !isMicroView && (
                            <Polyline
                                positions={
                                    macroRouteGeometry.length > 0
                                        ? macroRouteGeometry
                                        : [
                                              [
                                                  userLocation.lat,
                                                  userLocation.lng,
                                              ],
                                              [
                                                  activeTarget.lat,
                                                  activeTarget.lng,
                                              ],
                                          ]
                                }
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
                                    />
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
                    className={`absolute z-2500 transition-all duration-500 ease-in-out min-[1000px]:top-0 min-[1000px]:bottom-0 min-[1000px]:right-0 min-[1000px]:w-100 min-[1000px]:border-l min-[1000px]:border-border ${isSidebarExpanded ? "translate-x-0" : "translate-x-full"} max-[1000px]:left-0 max-[1000px]:right-0 max-[1000px]:bottom-0 max-[1000px]:rounded-t-4xl max-[1000px]:max-h-[85vh] bg-surface/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden`}
                >
                    <div className="min-[1000px]:hidden w-12 h-1.5 bg-border rounded-full mx-auto my-4 shrink-0" />

                    <div className="flex-1 overflow-y-auto p-6 pt-2">
                        {renderSidebarContent()}
                    </div>
                </div>

                <div className="absolute top-4 left-4 z-1000 flex flex-col gap-2">
                    <div
                        className={`px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest shadow-lg border backdrop-blur-md ${isMicroView ? "bg-accent text-white border-accent" : "bg-surface/80 text-text-strong border-border"}`}
                    >
                        {isMicroView
                            ? "Micro View: Indoor"
                            : "Macro View: City"}
                    </div>
                </div>

                <div className="absolute top-4 right-4 z-1000 flex flex-col gap-2">
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

                    {/* Demo action buttons removed per UX request */}
                </div>
            </div>

            {!isMicroView && targetStoreLocation && (
                <div
                    className={`absolute bottom-28 left-6 z-2000 rounded-3xl border border-border bg-surface/95 p-5 shadow-2xl backdrop-blur-xl transition-all duration-500 ${isSidebarExpanded ? "right-6 min-[1000px]:right-106" : "right-6"}`}
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
                            onClick={async () => {
                                const activeList = lists.find(
                                    (l) => l.id === selectedListId,
                                );
                                const currentItems =
                                    activeList?.items.filter(
                                        (item) => !item.checked,
                                    ) || [];

                                if (currentItems.length === 0) {
                                    alert(
                                        "Te rog selectează o listă care conține măcar un produs!",
                                    );
                                    return;
                                }

                                const loc =
                                    targetStoreLocation || DEMO_STORE_LOCATION;

                                // Enable auto-center and enter indoor mode
                                setIsAutoCenterEnabled(true);
                                setTargetStoreLocation(loc);
                                setUserLocation(loc);
                                forceIndoorMode();

                                // Teleport mock GPS into the store
                                teleport(loc.lat, loc.lng);

                                setItems(activeList?.items || []);
                                await loadRoute(
                                    currentItems.map((item) => item.id),
                                    loc.lat,
                                    loc.lng,
                                    currentItems,
                                );
                            }}
                            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent py-3 text-xs font-black text-white shadow-[0_4px_15px_var(--color-accent-glow)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <CheckCircle2 size={16} />
                            ARRIVED
                        </button>
                    </div>
                </div>
            )}

            {!isMicroView && (
                <div className="relative z-3000 flex h-21 items-center justify-between border-t border-border bg-surface/80 px-6 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={handleRecenter}
                            className={`w-12 h-12 flex items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 ${isAutoCenterEnabled ? "bg-accent text-text-on-accent" : "bg-surface border border-border text-text-strong"}`}
                            title={
                                isAutoCenterEnabled
                                    ? "Auto-Center On"
                                    : "Auto-Center Off"
                            }
                        >
                            <LocateFixed size={20} />
                        </button>
                        {!isAutoCenterEnabled && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-accent animate-pulse">
                                Manual Mode
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold shadow-lg transition-all active:scale-95 ${isSidebarExpanded ? "bg-accent text-text-on-accent" : "bg-text-strong text-bg"}`}
                    >
                        {isSidebarExpanded ? (
                            <X size={20} />
                        ) : (
                            <ListIcon size={20} />
                        )}
                        <span className="hidden sm:inline">
                            {isSidebarExpanded
                                ? "Close Panel"
                                : "Route Planner"}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default UnifiedMap;
