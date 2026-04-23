import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Modal } from "../../components";
import ShoppingListItems from "../../components/ShoppingList/ShoppingListItems";
import stompClient from "../../services/socketService";
import { useListsStore } from "../../store/useListsStore";

interface Item {
    id: string;
    name: string;
    checked: boolean;
    brand?: string;
    quantity?: string;
    price?: number;
    category?: string;
    isRecurrent?: boolean;
}

interface ApiListItem {
    id: string;
    name: string;
    isChecked?: boolean;
    brand?: string;
    quantity?: string;
    price?: number;
    category?: string;
    isRecurrent?: boolean;
}

interface ApiShoppingList {
    id: string;
    items?: ApiListItem[];
}

interface CreatedListResponse {
    id: string;
}

interface ListDetailProps {
    isEmbedded?: boolean;
    listIdOverride?: string;
    listTitle?: string;
    showAiImport?: boolean;
    showStoresModal?: boolean;
    onCloseStoresModal?: () => void;
}

const MOCK_STORES = [
    {
        id: "1",
        name: "SuperMart Downtown",
        address: "123 Main St, New York, NY 10001",
        bestMatch: true,
    },
    {
        id: "2",
        name: "FreshMart Uptown",
        address: "456 Broadway, New York, NY 10012",
        bestMatch: false,
    },
    {
        id: "3",
        name: "QuickShop Mall",
        address: "789 Park Ave, New York, NY 10016",
        bestMatch: false,
    },
];

const ListDetail = ({
    isEmbedded = false,
    listIdOverride,
    listTitle: _listTitle,
    showAiImport = true,
    showStoresModal = false,
    onCloseStoresModal,
}: ListDetailProps) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const effectiveListId = listIdOverride ?? id;
    const isNewListPage = effectiveListId === "default" && showAiImport;
    const { updateList } = useListsStore();

    const [items, setItems] = useState<Item[]>([]);
    const [newItemName, setNewItemName] = useState("");
    const [recipeText, setRecipeText] = useState("");
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [detailName, setDetailName] = useState("");
    const [detailQuantity, setDetailQuantity] = useState("");
    const [detailBrand, setDetailBrand] = useState("");
    const [detailPrice, setDetailPrice] = useState("");

    const addInputRef = useRef<HTMLInputElement | null>(null);

    const getBaseUrl = useCallback(
        () => import.meta.env.VITE_API_URL || "http://localhost:8081",
        [],
    );

    const getAuthHeaders = useCallback(
        (withContentType = false): HeadersInit => {
            const token = localStorage.getItem("token");
            return {
                ...(withContentType
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            };
        },
        [],
    );

    const syncListItemsInStore = useCallback(
        (nextItems: Item[], targetListId = effectiveListId) => {
            if (!targetListId || targetListId === "default") return;
            updateList(targetListId, { items: nextItems });
        },
        [effectiveListId, updateList],
    );

    const fetchListData = useCallback(
        async (targetListId = effectiveListId) => {
            if (!targetListId || targetListId === "default") {
                setItems([]);
                setIsLoading(false);
                return;
            }
            try {
                const response = await fetch(`${getBaseUrl()}/api/lists`, {
                    headers: getAuthHeaders(),
                });
                if (!response.ok) throw new Error("Failed to fetch lists");
                const allLists = (await response.json()) as ApiShoppingList[];
                const currentList = allLists.find(
                    (list) => list.id === targetListId,
                );
                if (!currentList) {
                    setItems([]);
                    return;
                }
                const mappedItems = (currentList.items ?? []).map((item) => ({
                    id: item.id,
                    name: item.name,
                    checked: Boolean(item.isChecked),
                    brand: item.brand,
                    price: item.price,
                    quantity: item.quantity,
                    category: item.category,
                    isRecurrent: item.isRecurrent,
                }));
                setItems(mappedItems);
                syncListItemsInStore(mappedItems, targetListId);
            } catch {
                setError("Nu s-a putut sincroniza lista.");
            } finally {
                setIsLoading(false);
            }
        },
        [effectiveListId, getAuthHeaders, getBaseUrl, syncListItemsInStore],
    );

    useEffect(() => {
        setIsLoading(true);
        void fetchListData();
    }, [fetchListData]);

    // Sync detail name when modal opens
    useEffect(() => {
        if (showDetailsModal) {
            setDetailName(newItemName);
        }
    }, [showDetailsModal, newItemName]);

    const openDetailsModal = () => {
        setDetailName(newItemName);
        setDetailQuantity("");
        setDetailBrand("");
        setDetailPrice("");
        setShowDetailsModal(true);
    };

    const closeDetailsModal = () => setShowDetailsModal(false);
    const closeStoresModal = () => onCloseStoresModal?.();

    const commitItem = (
        name: string,
        quantity?: string,
        brand?: string,
        price?: number,
    ) => {
        if (!name.trim()) return;
        const newItem: Item = {
            id: crypto.randomUUID(),
            name: name.trim(),
            checked: false,
            brand: brand || undefined,
            quantity: quantity || undefined,
            price: price ?? undefined,
        };
        const optimisticItems = [...items, newItem];
        setItems(optimisticItems);
        syncListItemsInStore(optimisticItems);
        setNewItemName("");

        void fetch(`${getBaseUrl()}/api/lists/${effectiveListId}/items`, {
            method: "POST",
            headers: getAuthHeaders(true),
            body: JSON.stringify({
                name: newItem.name,
                isChecked: false,
                brand: newItem.brand ?? null,
                quantity: newItem.quantity ?? null,
                price: newItem.price ?? null,
                category: null,
                isRecurrent: false,
                timestamp: Date.now(),
            }),
        })
            .then(async (res) => {
                if (!res.ok) throw new Error("Failed to add item");
                await fetchListData(effectiveListId);
            })
            .catch(() => {
                setError("Nu s-a putut adăuga produsul.");
                const rolledBack = optimisticItems.filter(
                    (i) => i.id !== newItem.id,
                );
                setItems(rolledBack);
                syncListItemsInStore(rolledBack);
            });

        if (effectiveListId && stompClient.connected) {
            stompClient.publish({
                destination: "/app/sync",
                body: JSON.stringify({
                    eventType: "ITEM_ADDED",
                    listId: effectiveListId,
                    item: newItem,
                }),
            });
        }
    };

    const handleInlineAdd = (e: React.FormEvent) => {
        e.preventDefault();
        commitItem(newItemName);
    };

    const handleDetailsSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const price = detailPrice ? parseFloat(detailPrice) : undefined;
        commitItem(detailName, detailQuantity, detailBrand, price);
        setShowDetailsModal(false);
        setShowMobileAddModal(false);
        setShowExpandedDetails(false);

        // Reset detail fields
        setDetailName("");
        setDetailQuantity("");
        setDetailBrand("");
        setDetailPrice("");
    };

    const handleCheck = (itemId: string) => {
        const currentItem = items.find((item) => item.id === itemId);
        if (!currentItem) return;
        const newChecked = !currentItem.checked;
        const nextItems = items.map((item) =>
            item.id === itemId ? { ...item, checked: newChecked } : item,
        );
        setItems(nextItems);
        syncListItemsInStore(nextItems);
        void fetch(`${getBaseUrl()}/api/items/${itemId}`, {
            method: "PUT",
            headers: getAuthHeaders(true),
            body: JSON.stringify({
                name: currentItem.name,
                isChecked: newChecked,
                brand: currentItem.brand ?? null,
                quantity: currentItem.quantity ?? null,
                price: currentItem.price ?? null,
                category: currentItem.category ?? null,
                isRecurrent: currentItem.isRecurrent ?? false,
                timestamp: Date.now(),
            }),
        }).catch(() => {
            setError("Nu s-a putut actualiza produsul.");
            const rolledBack = items.map((item) =>
                item.id === itemId
                    ? { ...item, checked: currentItem.checked }
                    : item,
            );
            setItems(rolledBack);
            syncListItemsInStore(rolledBack);
        });
        if (effectiveListId && stompClient.connected) {
            stompClient.publish({
                destination: "/app/sync",
                body: JSON.stringify({
                    eventType: "ITEM_TOGGLED",
                    listId: effectiveListId,
                    itemId,
                    checked: newChecked,
                }),
            });
        }
    };

    const handleDelete = (itemId: string) => {
        const previousItems = items;
        const nextItems = previousItems.filter((item) => item.id !== itemId);
        setItems(nextItems);
        syncListItemsInStore(nextItems);
        void fetch(`${getBaseUrl()}/api/items/${itemId}`, {
            method: "DELETE",
            headers: getAuthHeaders(),
        }).catch(() => {
            setError("Nu s-a putut șterge produsul.");
            setItems(previousItems);
            syncListItemsInStore(previousItems);
        });
    };

    const createListFromPlaceholder = async (): Promise<string> => {
        const response = await fetch(`${getBaseUrl()}/api/lists`, {
            method: "POST",
            headers: getAuthHeaders(true),
            body: JSON.stringify({
                title: `AI Generated ${new Date().toISOString().slice(0, 10)}`,
            }),
        });
        if (!response.ok) throw new Error("Failed to create list");
        const createdList = (await response.json()) as CreatedListResponse;
        return createdList.id;
    };

    const handleAiImport = async () => {
        if (!recipeText.trim() || !effectiveListId) return;
        setIsAiLoading(true);
        setError(null);
        try {
            const targetListId =
                effectiveListId === "default"
                    ? await createListFromPlaceholder()
                    : effectiveListId;
            const response = await fetch(
                `${getBaseUrl()}/api/ai/recipe-to-list`,
                {
                    method: "POST",
                    headers: getAuthHeaders(true),
                    body: JSON.stringify({
                        text: recipeText,
                        listId: targetListId,
                    }),
                },
            );
            if (!response.ok) throw new Error("AI Service error");
            setRecipeText("");
            if (effectiveListId === "default") {
                navigate(`/dashboard?list=${targetListId}`);
                return;
            }
            await fetchListData(targetListId);
        } catch {
            setError("Eroare la procesarea AI. Verifică backend-ul.");
        } finally {
            setIsAiLoading(false);
        }
    };

    const [showMobileAddModal, setShowMobileAddModal] = useState(false);
    const [showExpandedDetails, setShowExpandedDetails] = useState(false);

    const closeMobileAddModal = () => {
        setShowMobileAddModal(false);
        setShowExpandedDetails(false);
        setNewItemName("");
    };

    return (
        <div
            className={
                isEmbedded
                    ? "w-full"
                    : "flex justify-center items-start min-h-[calc(100svh-60px)] p-[28px_20px] bg-bg"
            }
        >
            <div className="w-full max-w-[860px] mx-auto flex flex-col gap-4 box-border max-[600px]:pb-[100px]">
                {error && (
                    <div className="bg-danger-subtle text-danger border border-danger-border p-[10px_14px] rounded-md text-[13px] font-medium">
                        {error}
                    </div>
                )}

                {isNewListPage ? (
                    <div className="flex flex-col gap-2">
                        <h3 className="text-lg font-bold text-text-strong text-center mb-2">
                            AI List Generator
                        </h3>
                        <p className="text-sm text-text-muted text-center leading-relaxed mb-4">
                            Paste a recipe or ingredient list and a new shopping
                            list will be created automatically.
                        </p>
                        <div className="bg-accent-subtle border border-accent-border p-[18px] rounded-lg flex flex-col gap-3">
                            <textarea
                                rows={5}
                                value={recipeText}
                                onChange={(e) => setRecipeText(e.target.value)}
                                placeholder="Paste your recipe here (e.g. 2 eggs, milk...)"
                                className="w-full bg-surface border-1.5 border-border text-text-strong p-[12px_14px] rounded-md resize-none text-sm leading-relaxed min-h-[120px] outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)]"
                            />
                            <button
                                onClick={handleAiImport}
                                className="w-full p-3 rounded-md border-none bg-accent text-text-on-accent text-sm font-bold cursor-pointer transition-all duration-200 ease-out hover:bg-accent-hover hover:-translate-y-px disabled:opacity-55 disabled:cursor-not-allowed disabled:transform-none"
                                disabled={isAiLoading}
                                type="button"
                            >
                                {isAiLoading
                                    ? "Processing..."
                                    : "Generate List"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* ── Inline add bar (Desktop) ── */}
                        <form
                            onSubmit={handleInlineAdd}
                            className="flex items-center gap-2 bg-surface border border-border rounded-xl p-[10px_14px] shadow-sm max-[600px]:hidden"
                        >
                            <input
                                ref={addInputRef}
                                type="text"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                placeholder="Add item (e.g., Milk, Bread)..."
                                className="flex-1 min-w-0 border-none bg-transparent text-sm text-text-strong outline-none px-1"
                            />
                            <button
                                type="button"
                                className="inline-flex items-center px-3.5 py-1.5 border-1.5 border-border-strong rounded-md bg-transparent text-text-strong text-[13px] font-semibold cursor-pointer transition-all duration-200 hover:bg-bg-muted shrink-0 whitespace-nowrap"
                                onClick={openDetailsModal}
                            >
                                Details
                            </button>
                            <button
                                type="submit"
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 border-none rounded-md bg-text-strong text-bg text-[13px] font-bold cursor-pointer transition-all duration-200 hover:opacity-85 hover:-translate-y-px active:translate-y-0 shrink-0 whitespace-nowrap"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    width="16"
                                    height="16"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    fill="none"
                                    role="img"
                                    aria-labelledby="add-icon-desktop"
                                >
                                    <title id="add-icon-desktop">Adaugă</title>
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Add
                            </button>
                        </form>

                        {/* ── Items list ── */}
                        <div className="bg-surface border border-border rounded-xl shadow-sm min-h-[120px] overflow-hidden">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center gap-4 p-[60px_20px] text-text-muted">
                                    <div className="w-8 h-8 border-3 border-border border-t-accent rounded-full animate-spin" />
                                    <p>Se încarcă produsele...</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/50">
                                    <ShoppingListItems
                                        items={items}
                                        onCheck={handleCheck}
                                        onDelete={handleDelete}
                                    />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Mobile FAB */}
            <button
                type="button"
                className="hidden max-[600px]:flex fixed bottom-6 right-6 w-[60px] h-[60px] rounded-full bg-accent text-white border-none items-center justify-center shadow-[0_4px_12px_var(--color-accent-glow)] cursor-pointer transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_var(--color-accent-glow)] active:scale-95 z-100"
                onClick={() => setShowMobileAddModal(true)}
                aria-label="Add Item"
            >
                <svg
                    viewBox="0 0 24 24"
                    width="28"
                    height="28"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    role="img"
                    aria-labelledby="add-icon-mobile"
                >
                    <title id="add-icon-mobile">Adaugă Produs</title>
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </button>

            {/* ── Mobile Add Item Modal ── */}
            <Modal
                isOpen={showMobileAddModal}
                onClose={closeMobileAddModal}
                title="Adaugă Produs"
                initialFocusSelector="#mobile-item-name"
                footer={
                    <>
                        <button
                            type="button"
                            className="px-6 py-2.5 bg-bg-muted text-text-strong border border-border rounded-md text-sm font-semibold transition-all hover:bg-border"
                            onClick={closeMobileAddModal}
                        >
                            Anulează
                        </button>
                        <button
                            type="submit"
                            form="mobile-add-form"
                            className="inline-flex items-center justify-center px-6 py-2.5 bg-text-strong text-bg border-none rounded-md text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                        >
                            Adaugă
                        </button>
                    </>
                }
            >
                <form
                    id="mobile-add-form"
                    onSubmit={handleDetailsSubmit}
                    className="flex flex-col gap-5"
                >
                    <div className="flex flex-col gap-2">
                        <label
                            htmlFor="mobile-item-name"
                            className="text-[13px] font-semibold text-text-strong"
                        >
                            Nume Produs
                        </label>
                        <input
                            id="mobile-item-name"
                            type="text"
                            value={detailName}
                            onChange={(e) => setDetailName(e.target.value)}
                            placeholder="ex: Lapte"
                            required
                            className="w-full px-3.5 py-2.5 bg-bg-muted border-1.5 border-border rounded-md text-base text-text-strong outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)] transition-all"
                        />
                    </div>

                    <button
                        type="button"
                        className="flex items-center justify-between w-full p-[12px_14px] bg-bg-muted border border-border rounded-md text-text-strong text-sm font-semibold cursor-pointer transition-all hover:bg-border/50"
                        onClick={() =>
                            setShowExpandedDetails(!showExpandedDetails)
                        }
                    >
                        {showExpandedDetails
                            ? "Mai puține detalii"
                            : "Adaugă detalii (cantitate, preț...)"}
                        <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            className="transition-transform duration-200"
                            style={{
                                transform: showExpandedDetails
                                    ? "rotate(180deg)"
                                    : "none",
                            }}
                            role="img"
                            aria-labelledby="expand-details-icon"
                        >
                            <title id="expand-details-icon">
                                {showExpandedDetails ? "Restrânge" : "Extinde"}
                            </title>
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    </button>

                    {showExpandedDetails && (
                        <div className="flex flex-col gap-4 p-4 bg-bg-subtle rounded-xl border border-border border-dashed animate-in slide-in-from-top-2 duration-200">
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="m-qty"
                                    className="text-xs font-semibold text-text-muted"
                                >
                                    Cantitate
                                </label>
                                <input
                                    id="m-qty"
                                    type="text"
                                    value={detailQuantity}
                                    onChange={(e) =>
                                        setDetailQuantity(e.target.value)
                                    }
                                    placeholder="ex: 2 buc"
                                    className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm outline-none focus:border-accent transition-all"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="m-brand"
                                    className="text-xs font-semibold text-text-muted"
                                >
                                    Brand
                                </label>
                                <input
                                    id="m-brand"
                                    type="text"
                                    value={detailBrand}
                                    onChange={(e) =>
                                        setDetailBrand(e.target.value)
                                    }
                                    placeholder="ex: Zuzu"
                                    className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm outline-none focus:border-accent transition-all"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="m-price"
                                    className="text-xs font-semibold text-text-muted"
                                >
                                    Preț
                                </label>
                                <input
                                    id="m-price"
                                    type="number"
                                    step="0.01"
                                    value={detailPrice}
                                    onChange={(e) =>
                                        setDetailPrice(e.target.value)
                                    }
                                    placeholder="0.00"
                                    className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm outline-none focus:border-accent transition-all"
                                />
                            </div>
                        </div>
                    )}
                </form>
            </Modal>

            {/* ── Add Item Details modal ── */}
            <Modal
                isOpen={showDetailsModal}
                onClose={closeDetailsModal}
                title="Add Item Details"
                subtitle="Add optional details like quantity, brand, and price"
                initialFocusSelector="#ld-item-name"
                footer={
                    <>
                        <button
                            type="button"
                            className="px-6 py-2.5 bg-bg-muted text-text-strong border border-border rounded-md text-sm font-semibold transition-all hover:bg-border"
                            onClick={closeDetailsModal}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="ld-details-form"
                            className="inline-flex items-center justify-center px-6 py-2.5 bg-text-strong text-bg border-none rounded-md text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                        >
                            Add Item
                        </button>
                    </>
                }
            >
                <form
                    id="ld-details-form"
                    onSubmit={handleDetailsSubmit}
                    className="flex flex-col gap-4"
                >
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="ld-item-name"
                            className="text-[13px] font-semibold text-text-strong"
                        >
                            Item Name
                        </label>
                        <input
                            id="ld-item-name"
                            type="text"
                            value={detailName}
                            onChange={(e) => setDetailName(e.target.value)}
                            placeholder="e.g., Milk"
                            required
                            className="w-full px-3.5 py-2.5 bg-bg-muted border-1.5 border-border rounded-md text-base text-text-strong outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)] transition-all"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="ld-quantity"
                                className="text-[13px] font-semibold text-text-strong"
                            >
                                Quantity
                            </label>
                            <input
                                id="ld-quantity"
                                type="text"
                                value={detailQuantity}
                                onChange={(e) =>
                                    setDetailQuantity(e.target.value)
                                }
                                placeholder="e.g., 2"
                                className="w-full px-3.5 py-2.5 bg-bg-muted border border-border rounded-md text-sm text-text-strong outline-none focus:border-accent transition-all"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="ld-price"
                                className="text-[13px] font-semibold text-text-strong"
                            >
                                Price (Optional)
                            </label>
                            <input
                                id="ld-price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={detailPrice}
                                onChange={(e) => setDetailPrice(e.target.value)}
                                placeholder="e.g., 4.99"
                                className="w-full px-3.5 py-2.5 bg-bg-muted border border-border rounded-md text-sm text-text-strong outline-none focus:border-accent transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="ld-brand"
                            className="text-[13px] font-semibold text-text-strong"
                        >
                            Brand (Optional)
                        </label>
                        <input
                            id="ld-brand"
                            type="text"
                            value={detailBrand}
                            onChange={(e) => setDetailBrand(e.target.value)}
                            placeholder="e.g., Organic Valley"
                            className="w-full px-3.5 py-2.5 bg-bg-muted border border-border rounded-md text-sm text-text-strong outline-none focus:border-accent transition-all"
                        />
                    </div>
                </form>
            </Modal>

            {/* ── Suggested Stores modal ── */}
            <Modal
                isOpen={showStoresModal}
                onClose={closeStoresModal}
                title="Suggested Stores"
                subtitle="Based on your shopping list and crowd-sourced data"
                maxWidth="500px"
            >
                <div className="flex flex-col gap-2.5 p-[0_4px_12px]">
                    {MOCK_STORES.map((store) => (
                        <div
                            key={store.id}
                            className="flex items-center justify-between gap-3 bg-bg-subtle border border-border rounded-xl p-[14px_16px] transition-all hover:border-border-strong group"
                        >
                            <div className="flex flex-col gap-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[15px] font-bold text-text-strong">
                                        {store.name}
                                    </span>
                                    {store.bestMatch && (
                                        <span className="inline-flex px-2 py-0.5 rounded-full bg-text-strong text-bg text-[10px] font-extrabold uppercase tracking-tight">
                                            Best Match
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs text-text-muted break-words">
                                    {store.address}
                                </span>
                            </div>
                            <button
                                type="button"
                                className="inline-flex items-center gap-1.5 px-4 py-2 border-none rounded-md bg-text-strong text-bg text-[13px] font-bold cursor-pointer transition-all hover:opacity-80 hover:-translate-y-px active:translate-y-0 shrink-0"
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    width="15"
                                    height="15"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    fill="none"
                                    role="img"
                                    aria-labelledby={`go-store-${store.id}`}
                                >
                                    <title id={`go-store-${store.id}`}>
                                        Navighează la magazin
                                    </title>
                                    <line x1="22" y1="2" x2="11" y2="13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                                Go
                            </button>
                        </div>
                    ))}
                </div>
            </Modal>
        </div>
    );
};

export default ListDetail;
