import {
    Car,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Footprints,
    MapPin,
    Store,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useListsStore } from "../../store/useListsStore";

// --- 1. INTERFEȚE ȘI DATE MOCK ---
export interface StoreRecommendation {
    id: string;
    name: string;
    address: string;
    stockMatchPercentage: number;
    transit: {
        driving: { timeMins: number; distanceKm: string | number };
        walking: { timeMins: number; distanceKm: string | number };
    };
}

const MOCK_STORES: StoreRecommendation[] = [
    {
        id: "store-1",
        name: "Kaufland Tudor Vladimirescu",
        address: "Bulevardul Chimiei",
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
        stockMatchPercentage: 95,
        transit: {
            driving: { timeMins: 8, distanceKm: 2.5 },
            walking: { timeMins: 30, distanceKm: 2.2 },
        },
    },
    {
        id: "store-3",
        name: "Mega Image",
        address: "Bulevardul Carol I",
        stockMatchPercentage: 82,
        transit: {
            driving: { timeMins: 12, distanceKm: 3.0 },
            walking: { timeMins: 45, distanceKm: 3.5 },
        },
    },
];

const RoutePage = () => {
    const navigate = useNavigate();
    const { lists } = useListsStore();

    // --- STATE ---
    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    const [transportMode, setTransportMode] = useState<"driving" | "walking">(
        "driving",
    );
    const [isCalculating, setIsCalculating] = useState(false);
    const [recommendedStores, setRecommendedStores] = useState<
        StoreRecommendation[]
    >([]);

    // --- LOGICA DE INTEGRARE BACKEND ---
    const handleListSelect = async (listId: string) => {
        setSelectedListId(listId);
        setIsCalculating(true);

        try {
            const selectedList = lists.find((l) => l.id === listId);
            const itemIds = selectedList?.items.map((item) => item.id) || [];

            if (itemIds.length === 0) {
                console.warn("Lista este goală. Folosim Mock Stores.");
                setRecommendedStores(MOCK_STORES);
                setIsCalculating(false);
                return;
            }

            const baseUrl =
                import.meta.env.VITE_API_URL || "http://localhost:8081";

            // Apel către noul endpoint pe care trebuie să-l expună backend-ul
            const response = await fetch(
                `${baseUrl}/api/routing/stores-match`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        // Decomentează liniile de mai jos dacă endpoint-ul necesită autentificare (JWT)
                        // "Authorization": `Bearer ${localStorage.getItem("token")}`
                    },
                    body: JSON.stringify({
                        userLat: 47.151726, // Coordonate Iași (hardcodate temporar)
                        userLng: 27.587914,
                        radiusInMeters: 5000,
                        itemIds: itemIds,
                    }),
                },
            );

            if (!response.ok) {
                throw new Error(`Eroare HTTP: ${response.status}`);
            }

            const data = await response.json();

            // Ne asigurăm că data este un array. Dacă backend-ul returnează un singur obiect (LIMIT 1), îl punem în array.
            const storesArray = Array.isArray(data) ? data : [data];

            const mappedStores: StoreRecommendation[] = storesArray.map(
                (store: any) => {
                    const distanceKm = (store.distanceMeters / 1000).toFixed(1);
                    return {
                        id: store.storeId,
                        name: store.storeName,
                        address:
                            store.address || "Adresă indisponibilă momentan",
                        stockMatchPercentage: Math.round(
                            (store.matchedItems / Math.max(itemIds.length, 1)) *
                                100,
                        ),
                        transit: {
                            // Fallback temporar: dacă backend-ul nu dă timpul de condus, îl estimăm noi ochiometric (ex: 30km/h)
                            driving: store.transit?.driving || {
                                timeMins:
                                    Math.round(
                                        (store.distanceMeters / 1000 / 30) * 60,
                                    ) || 5,
                                distanceKm: distanceKm,
                            },
                            // Fallback temporar: estimare mers pe jos (ex: 5km/h)
                            walking: store.transit?.walking || {
                                timeMins:
                                    Math.round(
                                        (store.distanceMeters / 1000 / 5) * 60,
                                    ) || 15,
                                distanceKm: distanceKm,
                            },
                        },
                    };
                },
            );

            setRecommendedStores(
                mappedStores.length > 0 ? mappedStores : MOCK_STORES,
            );
        } catch (error) {
            console.warn(
                "Backend endpoint /stores-match nu este gata sau a eșuat. Se aplică fallback la MOCK_STORES.",
                error,
            );
            setRecommendedStores(MOCK_STORES);
        } finally {
            setIsCalculating(false);
        }
    };

    // --- VIEW: SELECTOR DE LISTĂ ---
    if (!selectedListId) {
        return (
            <div className="flex-1 p-6 max-w-[860px] mx-auto w-full flex flex-col gap-6 max-[600px]:pb-[100px]">
                <header className="mb-2">
                    <h2 className="text-2xl font-black text-text-strong tracking-tighter uppercase italic">
                        Select List to Route
                    </h2>
                    <p className="text-sm text-text-muted mt-1">
                        Alege o listă pentru a găsi cel mai apropiat magazin cu
                        stoc disponibil.
                    </p>
                </header>

                {lists.length === 0 ? (
                    <div className="bg-surface border border-border rounded-xl p-8 text-center flex flex-col items-center gap-3">
                        <Store
                            size={40}
                            className="text-text-muted opacity-50"
                        />
                        <p className="text-text-muted font-medium">
                            Nu ai nicio listă creată.
                        </p>
                        <button
                            onClick={() => navigate("/dashboard")}
                            className="mt-2 px-4 py-2 bg-accent text-white rounded-lg font-bold text-sm hover:bg-accent/90 transition-colors"
                        >
                            Mergi la Dashboard
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {lists.map((list) => (
                            <button
                                key={list.id}
                                onClick={() => handleListSelect(list.id)}
                                className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl hover:border-accent hover:shadow-md transition-all text-left group"
                            >
                                <div className="flex flex-col gap-1 min-w-0">
                                    <span className="font-bold text-text-strong text-lg truncate group-hover:text-accent transition-colors">
                                        {list.name}
                                    </span>
                                    <span className="text-sm text-text-muted">
                                        {list.items?.length || 0} items
                                    </span>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-bg-muted flex items-center justify-center group-hover:bg-accent-subtle transition-colors">
                                    <ChevronRight
                                        size={20}
                                        className="text-text-muted group-hover:text-accent"
                                    />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // --- VIEW: STORE SELECTION ---
    return (
        <div className="flex-1 p-6 max-w-[860px] mx-auto w-full flex flex-col gap-6 max-[600px]:pb-[100px]">
            <header className="flex flex-col gap-4 mb-2">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-text-strong tracking-tighter uppercase italic">
                            Store Matcher
                        </h2>
                        <button
                            onClick={() => setSelectedListId(null)}
                            className="text-[11px] font-bold text-text-muted hover:text-accent uppercase tracking-wider mt-1 flex items-center gap-1"
                        >
                            <ChevronDown size={12} className="rotate-90" />
                            Schimbă Lista
                        </button>
                    </div>

                    {/* TRANSPORT TOGGLE */}
                    <div className="flex bg-bg-muted p-1 rounded-xl border border-border">
                        <button
                            onClick={() => setTransportMode("driving")}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                transportMode === "driving"
                                    ? "bg-surface text-accent shadow-sm"
                                    : "text-text-muted hover:text-text-strong"
                            }`}
                        >
                            <Car size={16} />
                            <span className="max-[400px]:hidden">Driving</span>
                        </button>
                        <button
                            onClick={() => setTransportMode("walking")}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                transportMode === "walking"
                                    ? "bg-surface text-accent shadow-sm"
                                    : "text-text-muted hover:text-text-strong"
                            }`}
                        >
                            <Footprints size={16} />
                            <span className="max-[400px]:hidden">Walking</span>
                        </button>
                    </div>
                </div>
            </header>

            {isCalculating ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-10 h-10 border-4 border-border border-t-accent rounded-full animate-spin" />
                    <p className="text-text-muted font-medium animate-pulse">
                        Calculating optimal routes & stock...
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {/* Folosim state-ul recommendedStores în loc de MOCK_STORES direct */}
                    {recommendedStores.map((store, index) => {
                        const isTopMatch = index === 0;
                        const transit = store.transit[transportMode];

                        return (
                            <div
                                key={store.id}
                                className={`relative p-5 rounded-2xl border transition-all ${
                                    isTopMatch
                                        ? "bg-accent-subtle/20 border-accent shadow-[0_4px_20px_var(--color-accent-glow)]"
                                        : "bg-surface border-border hover:border-text-muted"
                                }`}
                            >
                                {isTopMatch && (
                                    <div className="absolute -top-3 left-5 px-3 py-1 bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 shadow-sm">
                                        <CheckCircle2 size={12} />
                                        Best Match
                                    </div>
                                )}

                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex flex-col gap-1">
                                        <h3 className="text-lg font-black text-text-strong leading-tight">
                                            {store.name}
                                        </h3>
                                        <div className="flex items-center gap-1 text-sm text-text-muted">
                                            <MapPin size={14} />
                                            {store.address}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end">
                                        <div className="text-2xl font-black text-accent tracking-tighter">
                                            {store.stockMatchPercentage}%
                                        </div>
                                        <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                                            Stock Match
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between">
                                    <div className="flex items-center gap-4 text-sm font-semibold text-text-strong">
                                        <div className="flex items-center gap-1.5">
                                            {transportMode === "driving" ? (
                                                <Car
                                                    size={16}
                                                    className="text-text-muted"
                                                />
                                            ) : (
                                                <Footprints
                                                    size={16}
                                                    className="text-text-muted"
                                                />
                                            )}
                                            {transit.timeMins} min
                                        </div>
                                        <div className="w-1 h-1 rounded-full bg-border" />
                                        <div className="text-text-muted">
                                            {transit.distanceKm} km
                                        </div>
                                    </div>

                                    <button
                                        onClick={() =>
                                            navigate(`/nav/${selectedListId}`)
                                        }
                                        className={`px-5 py-2 rounded-xl text-sm font-bold transition-transform active:scale-95 ${
                                            isTopMatch
                                                ? "bg-accent text-white shadow-md hover:opacity-90"
                                                : "bg-text-strong text-bg hover:opacity-80"
                                        }`}
                                    >
                                        Start Route
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default RoutePage;
