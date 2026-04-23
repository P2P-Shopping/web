import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ShoppingListItems from "../../components/ShoppingList/ShoppingListItems";
import stompClient from "../../services/socketService";
import { useListsStore } from "../../store/useListsStore";
import { Modal } from "../../components";
import "./ListDetail.css";

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
    listTitle,
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

    const getBaseUrl = () =>
        import.meta.env.VITE_API_URL || "http://localhost:8081";

    const getAuthHeaders = (withContentType = false): HeadersInit => {
        const token = localStorage.getItem("token");
        return {
            ...(withContentType ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    const syncListItemsInStore = (
        nextItems: Item[],
        targetListId = effectiveListId,
    ) => {
        if (!targetListId || targetListId === "default") return;
        updateList(targetListId, { items: nextItems });
    };

    const fetchListData = useCallback(async (targetListId = effectiveListId) => {
        if (!targetListId || targetListId === "default") {
            setItems([]);
            setIsLoading(false);
            return;
        }
        try {
            const response = await fetch(`${getBaseUrl()}/api/lists`, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error("Failed to fetch lists");
            const allLists = (await response.json()) as ApiShoppingList[];
            const currentList = allLists.find((list) => list.id === targetListId);
            if (!currentList) { setItems([]); return; }
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
    }, [effectiveListId, updateList]);

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
                isEmbedded ? "list-detail-sidebar open" : "full-page-wrapper"
            }
        >
            <div className="centered-list-card">
                {error && <div className="error-msg">{error}</div>}

                {isNewListPage ? (
                    <>
                        <h3 className="list-detail-title">AI List Generator</h3>
                        <p className="list-detail-helper">
                            Paste a recipe or ingredient list and a new shopping
                            list will be created automatically.
                        </p>
                        <div className="ai-import-section">
                            <textarea
                                rows={5}
                                value={recipeText}
                                onChange={(e) => setRecipeText(e.target.value)}
                                placeholder="Paste your recipe here (e.g. 2 eggs, milk...)"
                            />
                            <button
                                onClick={handleAiImport}
                                className="ai-btn"
                                disabled={isAiLoading}
                                type="button"
                            >
                                {isAiLoading
                                    ? "Processing..."
                                    : "Generate List"}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* ── Inline add bar (Desktop) ── */}
                        <form
                            onSubmit={handleInlineAdd}
                            className="add-item-bar desktop-only"
                        >
                            <input
                                ref={addInputRef}
                                type="text"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                placeholder="Add item (e.g., Milk, Bread)..."
                                className="add-item-input"
                            />
                            <button
                                type="button"
                                className="details-btn"
                                onClick={openDetailsModal}
                            >
                                Details
                            </button>
                            <button type="submit" className="add-btn">
                                <svg
                                    viewBox="0 0 24 24"
                                    width="16"
                                    height="16"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    fill="none"
                                    aria-hidden="true"
                                >
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Add
                            </button>
                        </form>

                        {/* ── Items list ── */}
                        <div className="items-card">
                            {isLoading ? (
                                <div className="ld-loading-container">
                                    <div className="loading-spinner" />
                                    <p>Se încarcă produsele...</p>
                                </div>
                            ) : (
                                <ShoppingListItems
                                    items={items}
                                    onCheck={handleCheck}
                                    onDelete={handleDelete}
                                />
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Mobile FAB */}
            <button 
                className="mobile-fab" 
                onClick={() => setShowMobileAddModal(true)}
                aria-label="Add Item"
            >
                <svg viewBox="0 0 24 24" width="28" height="28" stroke="currentColor" strokeWidth="3" fill="none">
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
                        <button type="button" className="cancel-btn" onClick={closeMobileAddModal}>Anulează</button>
                        <button type="submit" form="mobile-add-form" className="submit-btn">Adaugă</button>
                    </>
                }
            >
                <form id="mobile-add-form" onSubmit={handleDetailsSubmit} className="mobile-add-form">
                    <div className="ld-field">
                        <label htmlFor="mobile-item-name">Nume Produs</label>
                        <input
                            id="mobile-item-name"
                            type="text"
                            value={detailName}
                            onChange={(e) => setDetailName(e.target.value)}
                            placeholder="ex: Lapte"
                            required
                        />
                    </div>

                    <button 
                        type="button" 
                        className="mobile-details-toggle"
                        onClick={() => setShowExpandedDetails(!showExpandedDetails)}
                    >
                        {showExpandedDetails ? "Mai puține detalii" : "Adaugă detalii (cantitate, preț...)"}
                        <svg 
                            viewBox="0 0 24 24" 
                            width="16" 
                            height="16" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            fill="none"
                            style={{ transform: showExpandedDetails ? "rotate(180deg)" : "none" }}
                        >
                            <path d="M6 9l6 6 6-6" />
                        </svg>
                    </button>

                    {showExpandedDetails && (
                        <div className="mobile-expanded-fields">
                            <div className="ld-field">
                                <label htmlFor="m-qty">Cantitate</label>
                                <input
                                    id="m-qty"
                                    type="text"
                                    value={detailQuantity}
                                    onChange={(e) => setDetailQuantity(e.target.value)}
                                    placeholder="ex: 2 buc"
                                />
                            </div>
                            <div className="ld-field">
                                <label htmlFor="m-brand">Brand</label>
                                <input
                                    id="m-brand"
                                    type="text"
                                    value={detailBrand}
                                    onChange={(e) => setDetailBrand(e.target.value)}
                                    placeholder="ex: Zuzu"
                                />
                            </div>
                            <div className="ld-field">
                                <label htmlFor="m-price">Preț</label>
                                <input
                                    id="m-price"
                                    type="number"
                                    step="0.01"
                                    value={detailPrice}
                                    onChange={(e) => setDetailPrice(e.target.value)}
                                    placeholder="0.00"
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
                            className="ld-cancel-btn"
                            onClick={closeDetailsModal}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="ld-details-form"
                            className="ld-submit-btn"
                        >
                            Add Item
                        </button>
                    </>
                }
            >
                <form
                    id="ld-details-form"
                    onSubmit={handleDetailsSubmit}
                    className="ld-modal-body-form"
                >
                    <div className="ld-field">
                        <label htmlFor="ld-item-name">Item Name</label>
                        <input
                            id="ld-item-name"
                            type="text"
                            value={detailName}
                            onChange={(e) => setDetailName(e.target.value)}
                            placeholder="e.g., Milk"
                            required
                        />
                    </div>
                    <div className="ld-field">
                        <label htmlFor="ld-quantity">Quantity</label>
                        <input
                            id="ld-quantity"
                            type="text"
                            value={detailQuantity}
                            onChange={(e) => setDetailQuantity(e.target.value)}
                            placeholder="e.g., 2"
                        />
                    </div>
                    <div className="ld-field">
                        <label htmlFor="ld-brand">Brand (Optional)</label>
                        <input
                            id="ld-brand"
                            type="text"
                            value={detailBrand}
                            onChange={(e) => setDetailBrand(e.target.value)}
                            placeholder="e.g., Organic Valley"
                        />
                    </div>
                    <div className="ld-field">
                        <label htmlFor="ld-price">Price (Optional)</label>
                        <input
                            id="ld-price"
                            type="number"
                            step="0.01"
                            min="0"
                            value={detailPrice}
                            onChange={(e) => setDetailPrice(e.target.value)}
                            placeholder="e.g., 4.99"
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
                <div className="ld-stores-list">
                    {MOCK_STORES.map((store) => (
                        <div key={store.id} className="ld-store-item">
                            <div className="ld-store-info">
                                <div className="ld-store-name-row">
                                    <span className="ld-store-name">
                                        {store.name}
                                    </span>
                                    {store.bestMatch && (
                                        <span className="ld-best-match-badge">
                                            Best Match
                                        </span>
                                    )}
                                </div>
                                <span className="ld-store-address">
                                    {store.address}
                                </span>
                            </div>
                            <button type="button" className="ld-go-btn">
                                <svg
                                    viewBox="0 0 24 24"
                                    width="15"
                                    height="15"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    fill="none"
                                    aria-hidden="true"
                                >
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
