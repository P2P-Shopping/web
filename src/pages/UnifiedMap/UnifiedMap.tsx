import L from "leaflet";
import type React from "react";
import { useEffect, useState } from "react";
import {
    Circle,
    MapContainer,
    Marker,
    Polygon,
    Polyline,
    Popup,
    // TileLayer,
    useMap,
    useMapEvents,
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
    Maximize2,
    Satellite,
    X,
    Zap,
} from "lucide-react";
import { useStore } from "../../context/useStore";
import {
    DEMO_STORE_LOCATION,
    GEOFENCE_RADIUS_METERS,
} from "../../services/geofence";
import { loadRoute } from "../../services/loadRoute";
import { teleport } from "../../services/mockEmitter";
import { useListsStore } from "../../store/useListsStore";
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
    lat: number;
    lng: number;
    address?: string;
    transit?: {
        driving?: { timeMins: number; distanceKm: string | number };
        walking?: { timeMins: number; distanceKm: string | number };
    };
}

const MOCK_STORES: StoreRecommendation[] = [
    {
        id: "store-1",
        name: "Kaufland Tudor Vladimirescu",
        address: "Strada Theodor Pallady",
        lat: 47.1532,
        lng: 27.5891,
        stockMatchPercentage: 98,
        transit: {
            driving: { timeMins: 5, distanceKm: 1.2 },
            walking: { timeMins: 15, distanceKm: 1.2 },
        },
    },
    {
        id: "store-2",
        name: "Carrefour Felicia",
        address: "Strada Bucium",
        lat: 47.1495,
        lng: 27.592,
        stockMatchPercentage: 95,
        transit: {
            driving: { timeMins: 8, distanceKm: 2.5 },
            walking: { timeMins: 30, distanceKm: 2.2 },
        },
    },
];

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

const UnifiedMap: React.FC = () => {
    const userLocation = useStore((state) => state.userLocation);
    const setUserLocation = useStore((state) => state.setUserLocation);
    const targetStoreLocation = useStore((state) => state.targetStoreLocation);
    const setTargetStoreLocation = useStore(
        (state) => state.setTargetStoreLocation,
    );
    const navigationMode = useStore((state) => state.navigationMode);
    const setNavigationMode = useStore((state) => state.setNavigationMode);
    const route = useStore((state) => state.route);
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
    const isMicroView = navigationMode === "indoor";

    const activeTarget = targetStoreLocation || DEMO_STORE_LOCATION;

    useEffect(() => {
        // Automatic geofence transitions disabled per user request
    }, []);

    const handleListSelect = (listId: string) => {
        const selectedList = lists.find((l) => l.id === listId);
        if (!selectedList) return;

        setSelectedListId(listId);
        setItems(selectedList.items);
        setIsShowingStores(false);
        setRecommendedStores([]);
    };

    const handleFetchStores = async () => {
        if (!selectedListId) return;
        const selectedList = lists.find((l) => l.id === selectedListId);
        if (!selectedList) return;

        setIsFetchingStores(true);
        try {
            const itemIds = selectedList.items.map((item) => item.id) || [];
            if (itemIds.length === 0) {
                setRecommendedStores(MOCK_STORES);
                setIsShowingStores(true);
                return;
            }

            const baseUrlResolved =
                import.meta.env.VITE_API_URL ||
                import.meta.env.VITE_API_BASE_URL ||
                "http://localhost:8081";
            const baseUrl = baseUrlResolved === "/" ? "" : baseUrlResolved;

            const response = await fetch(
                `${baseUrl}/api/routing/stores-match`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userLat: userLocation.lat,
                        userLng: userLocation.lng,
                        radiusInMeters: 5000,
                        itemIds: itemIds,
                    }),
                },
            );

            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const data = await response.json();
            const storesArray = Array.isArray(data) ? data : [data];

            const mappedStores: StoreRecommendation[] = storesArray.map(
                (store: ApiStoreMatch) => ({
                    id: store.storeId,
                    name: store.storeName,
                    address: store.address || "Address unavailable",
                    lat: store.lat || DEMO_STORE_LOCATION.lat,
                    lng: store.lng || DEMO_STORE_LOCATION.lng,
                    stockMatchPercentage: Math.round(
                        (store.matchedItems / Math.max(itemIds.length, 1)) *
                            100,
                    ),
                    transit: {
                        driving: store.transit?.driving || {
                            timeMins: 10,
                            distanceKm: 2,
                        },
                        walking: store.transit?.walking || {
                            timeMins: 30,
                            distanceKm: 2,
                        },
                    },
                }),
            );

            setRecommendedStores(
                mappedStores.length > 0 ? mappedStores : MOCK_STORES,
            );
            setIsShowingStores(true);
        } catch (error) {
            console.warn("Backend match failed, using mock stores", error);
            setRecommendedStores(MOCK_STORES);
            setIsShowingStores(true);
        } finally {
            setIsFetchingStores(false);
        }
    };

    const handleStartRoute = (store: StoreRecommendation) => {
        setTargetStoreLocation({ lat: store.lat, lng: store.lng });
        setNavigationMode("city");
    };

    const handleRecenter = () => {
        setIsAutoCenterEnabled(true);
        setUserLocation({ ...userLocation });
    };

    const handleSimulateEntry = () => {
        setIsAutoCenterEnabled(true);
        teleport(activeTarget.lat + 0.0001, activeTarget.lng + 0.0001);
    };

    const handleSimulateExit = () => {
        setIsAutoCenterEnabled(true);
        teleport(activeTarget.lat + 0.01, activeTarget.lng + 0.01);
    };

    const handleForceIndoor = () => {
        setIsAutoCenterEnabled(true);
        setTargetStoreLocation(DEMO_STORE_LOCATION);
        forceIndoorMode();
    };

    const handleDemoTSP = async () => {
        const demoItems = [
            {
                id: "11111111-a1b2-c3d4-e5f6-1234567890ab",
                name: "Produs 1",
                checked: false,
            },
            {
                id: "22222222-b2c3-d4e5-f6a7-2345678901bc",
                name: "Produs 2",
                checked: false,
            },
            {
                id: "33333333-c3d4-e5f6-a7b8-3456789012cd",
                name: "Produs 3",
                checked: false,
            },
            {
                id: "44444444-d4e5-f6a7-b8c9-4567890123de",
                name: "Produs 4",
                checked: false,
            },
            {
                id: "55555555-e5f6-a7b8-c9d0-5678901234ef",
                name: "Produs 5",
                checked: false,
            },
            {
                id: "66666666-f6a7-b8c9-d0e1-6789012345f0",
                name: "Produs 6",
                checked: false,
            },
        ];

        setItems(demoItems);
        handleForceIndoor();
        // Teleport to entrance (center of Palas Mall geofence)
        teleport(DEMO_STORE_LOCATION.lat, DEMO_STORE_LOCATION.lng);

        // Compute and display the TSP route using frontend mock (Palas Mall data)
        await loadRoute(
            demoItems.map((i) => i.id),
            DEMO_STORE_LOCATION.lat,
            DEMO_STORE_LOCATION.lng,
        );
    };

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

    return (
        <div className="flex flex-col h-full overflow-hidden bg-bg">
            <div className="relative flex-1 overflow-hidden">
                {isMicroView ? (
                    <StoreMap />
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
                        {/* 
                      NOTE FOR LATER: Map tiles and OSM attribution are hidden per user request. 
                      Re-enable the TileLayer below to show the real-world map again.
                    */}
                        {/* <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    /> */}
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
                                positions={[
                                    [userLocation.lat, userLocation.lng],
                                    [activeTarget.lat, activeTarget.lng],
                                ]}
                                pathOptions={{
                                    color: "var(--color-blue-neon)",
                                    weight: 3,
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
                        className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-[1000] min-[1000px]:hidden animate-fade-in"
                        onClick={() => setIsSidebarExpanded(false)}
                        aria-label="Close List"
                    />
                )}

                <div
                    className={`absolute z-[1001] transition-all duration-500 ease-in-out min-[1000px]:top-0 min-[1000px]:bottom-0 min-[1000px]:right-0 min-[1000px]:w-[400px] min-[1000px]:border-l min-[1000px]:border-border ${isSidebarExpanded ? "translate-x-0" : "translate-x-full"} max-[1000px]:left-0 max-[1000px]:right-0 max-[1000px]:bottom-0 max-[1000px]:rounded-t-[32px] max-[1000px]:max-h-[85vh] bg-surface/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden`}
                >
                    <div className="min-[1000px]:hidden w-12 h-1.5 bg-border rounded-full mx-auto my-4 shrink-0" />

                    <div className="flex-1 overflow-y-auto p-6 pt-2">
                        {!selectedListId ? (
                            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <header>
                                    <h2 className="text-2xl font-black text-text-strong uppercase tracking-tight">
                                        Plan Your Route
                                    </h2>
                                    <p className="text-sm text-text-muted mt-1 leading-relaxed">
                                        Select a shopping list to discover the
                                        best retail locations near you.
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
                                                onClick={() =>
                                                    handleListSelect(list.id)
                                                }
                                                className="flex items-center justify-between p-6 bg-surface border border-border/60 rounded-[28px] hover:border-accent hover:bg-accent-subtle/30 transition-all group text-left shadow-sm hover:shadow-xl hover:-translate-y-0.5 relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 left-0 w-1.5 h-full bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="font-extrabold text-text-strong group-hover:text-accent transition-colors text-lg leading-tight">
                                                        {list.name}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted px-2.5 py-1 bg-bg-muted rounded-full border border-border/30">
                                                            {list.items
                                                                ?.length ||
                                                                0}{" "}
                                                            items
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
                        ) : isShowingStores ? (
                            <div className="flex flex-col gap-6 animate-in slide-in-from-right-4">
                                <header className="flex flex-col gap-4">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setIsShowingStores(false)
                                        }
                                        className="flex items-center gap-2 text-xs font-black text-accent uppercase tracking-widest hover:-translate-x-1 transition-transform w-fit"
                                    >
                                        <ArrowLeft size={14} /> Back to items
                                    </button>
                                    <div className="flex justify-between items-end">
                                        <div className="text-left">
                                            <h2 className="text-2xl font-black text-text-strong uppercase tracking-tight">
                                                Best Matches
                                            </h2>
                                            <p className="text-xs text-text-muted mt-1">
                                                Found {recommendedStores.length}{" "}
                                                stores nearby.
                                            </p>
                                        </div>
                                        <div className="flex bg-bg-muted p-1 rounded-2xl border border-border shadow-inner">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setTransportMode("driving")
                                                }
                                                className={`p-2.5 rounded-xl transition-all ${transportMode === "driving" ? "bg-surface text-accent shadow-sm" : "text-text-muted hover:text-text-strong"}`}
                                            >
                                                <Car size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setTransportMode("walking")
                                                }
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
                                                        {
                                                            store.stockMatchPercentage
                                                        }
                                                        %
                                                    </span>
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-text-muted">
                                                        Stock
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                                                <div className="text-xs font-bold text-text-strong flex items-center gap-4">
                                                    <div className="flex items-center gap-1.5">
                                                        {transportMode ===
                                                        "driving" ? (
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
                                                        {
                                                            store.transit[
                                                                transportMode
                                                            ].timeMins
                                                        }{" "}
                                                        min
                                                    </div>
                                                    <div className="w-1 h-1 rounded-full bg-border" />
                                                    <span className="text-text-muted">
                                                        {
                                                            store.transit[
                                                                transportMode
                                                            ].distanceKm
                                                        }{" "}
                                                        km
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleStartRoute(store)
                                                    }
                                                    className="px-6 py-2.5 bg-text-strong text-bg rounded-2xl text-xs font-black shadow-lg hover:scale-105 active:scale-95 transition-all"
                                                >
                                                    START NAVIGATION
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="relative animate-in fade-in slide-in-from-right-4 duration-500 h-full flex flex-col">
                                <header className="flex items-center gap-4 mb-4 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedListId(null)}
                                        className="flex items-center justify-center w-8 h-8 rounded-full bg-bg-muted text-text-muted hover:text-accent hover:bg-accent-subtle transition-all"
                                        title="Back to lists"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                    <h2 className="text-xl font-black text-text-strong uppercase tracking-tight truncate">
                                        {
                                            lists.find(
                                                (l) => l.id === selectedListId,
                                            )?.name
                                        }
                                    </h2>
                                </header>

                                <div className="flex-1 overflow-hidden flex flex-col relative">
                                    {targetStoreLocation && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setTargetStoreLocation(null)
                                            }
                                            className="absolute top-2 right-2 p-2 text-text-muted hover:text-accent z-10 transition-colors bg-surface/80 backdrop-blur rounded-lg"
                                            title="Cancel Route"
                                        >
                                            <X size={18} />
                                        </button>
                                    )}
                                    <div className="flex-1 overflow-y-auto scrollbar-thin">
                                        <ListDetail
                                            isEmbedded={true}
                                            listIdOverride={
                                                selectedListId ?? undefined
                                            }
                                            onSwitchList={() =>
                                                setSelectedListId(null)
                                            }
                                        />
                                    </div>

                                    {!targetStoreLocation && (
                                        <div className="pt-6 mt-4 border-t border-border shrink-0">
                                            <button
                                                type="button"
                                                onClick={handleFetchStores}
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
                                                        <Zap
                                                            size={20}
                                                            fill="currentColor"
                                                        />
                                                        PLAN MY ROUTE
                                                    </>
                                                )}
                                            </button>
                                            <p className="text-[10px] text-text-muted text-center mt-3 font-bold uppercase tracking-widest opacity-60">
                                                Discover stores with best stock
                                                & transit time
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
                    <div
                        className={`px-4 py-2 rounded-full font-bold text-xs uppercase tracking-widest shadow-lg border backdrop-blur-md ${isMicroView ? "bg-accent text-white border-accent" : "bg-surface/80 text-text-strong border-border"}`}
                    >
                        {isMicroView
                            ? "Micro View: Indoor"
                            : "Macro View: City"}
                    </div>
                </div>

                <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
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
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${!isMockGpsEnabled ? "bg-blue-600 text-white" : "text-text-muted hover:text-text-strong"}`}
                            title="Use Real Device GPS"
                        >
                            <Satellite size={12} />
                            Real
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={
                            isMicroView
                                ? handleSimulateExit
                                : handleSimulateEntry
                        }
                        className="flex items-center gap-2 px-4 py-2 bg-surface/90 backdrop-blur-md border border-border rounded-xl text-xs font-bold text-text-strong shadow-lg hover:bg-surface transition-all active:scale-95"
                    >
                        <Zap size={14} className="text-accent" />
                        {isMicroView ? "Simulate Exit" : "Simulate Entry"}
                    </button>

                    <button
                        type="button"
                        onClick={handleDemoTSP}
                        className="flex items-center gap-2 px-4 py-2 bg-accent text-white border border-accent/20 rounded-xl text-xs font-black shadow-lg hover:scale-105 transition-all active:scale-95"
                    >
                        <Zap size={14} fill="currentColor" />
                        Demo TSP Route
                    </button>

                    {!isMicroView && (
                        <button
                            type="button"
                            onClick={handleForceIndoor}
                            className="flex items-center gap-2 px-4 py-2 bg-surface/90 backdrop-blur-md border border-border rounded-xl text-xs font-bold text-text-strong shadow-lg hover:bg-surface transition-all active:scale-95"
                        >
                            <Maximize2 size={14} className="text-green-500" />
                            Force Indoor
                        </button>
                    )}
                </div>
            </div>

            {!isMicroView && (
                <div className="relative z-[1002] bg-surface/80 backdrop-blur-xl border-t border-border h-[84px] px-6 flex items-center justify-between shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
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
