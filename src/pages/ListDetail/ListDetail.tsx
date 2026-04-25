import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ShoppingListItems from "../../components/ShoppingList/ShoppingListItems";
import stompClient from "../../services/socketService";
import { useListsStore } from "../../store/useListsStore";
import type { Item, ShoppingList as ApiShoppingList } from "../../types"; 
import "./ListDetail.css";

interface CreatedListResponse {
    id: string;
}

interface ListDetailProps {
    isEmbedded?: boolean;
    listIdOverride?: string;
    listTitle?: string;
    showAiImport?: boolean;
}

const ListDetail = ({
    isEmbedded = false,
    listIdOverride,
    listTitle,
    showAiImport = true,
}: ListDetailProps) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const effectiveListId = listIdOverride ?? id;
    const isNewListPage = effectiveListId === "default" && showAiImport;
    const { updateList } = useListsStore();

    const [items, setItems] = useState<Item[]>([]);
    const [newItemName, setNewItemName] = useState("");
    const [brand, setBrand] = useState("");
    const [quantity, setQuantity] = useState("");
    const [category, setCategory] = useState("");
    const [isRecurrent, setIsRecurrent] = useState(false);
    const [recipeText, setRecipeText] = useState("");
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getBaseUrl = () => import.meta.env.VITE_API_URL || "http://localhost:8081";

    const getAuthHeaders = (withContentType = false): HeadersInit => {
        const token = localStorage.getItem("token");
        return {
            ...(withContentType ? { "Content-Type": "application/json" } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    const syncListItemsInStore = (nextItems: Item[], targetListId = effectiveListId) => {
        if (!targetListId || targetListId === "default") {
            return;
        }
        updateList(targetListId, { items: nextItems });
    };

    const fetchListData = async (targetListId = effectiveListId) => {
        if (!targetListId || targetListId === "default") {
            setItems([]);
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch(`${getBaseUrl()}/api/lists`, {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error("Failed to fetch lists");
            }

            const allLists = (await response.json()) as ApiShoppingList[];
            const currentList = allLists.find((list) => list.id === targetListId);

            if (!currentList) {
                setItems([]);
                return;
            }

            const mappedItems = (currentList.items ?? []).map((item) => ({
                id: item.id,
                name: item.name,
                checked: Boolean((item as any).isChecked ?? item.checked),
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
    };

    useEffect(() => {
        setIsLoading(true);
        void fetchListData();
    }, [effectiveListId]);

    const createListFromPlaceholder = async (): Promise<string> => {
        const response = await fetch(`${getBaseUrl()}/api/lists`, {
            method: "POST",
            headers: getAuthHeaders(true),
            body: JSON.stringify({
                title: `AI Generated ${new Date().toISOString().slice(0, 10)}`,
            }),
        });

        if (!response.ok) {
            throw new Error("Failed to create list");
        }

        const createdList = (await response.json()) as CreatedListResponse;
        return createdList.id;
    };

    const handleAiImport = async () => {
        if (!recipeText.trim() || !id) {
            return;
        }

        setIsAiLoading(true);
        setError(null);

        try {
            const targetListId =
                effectiveListId === "default"
                    ? await createListFromPlaceholder()
                    : effectiveListId;

            const response = await fetch(`${getBaseUrl()}/api/ai/recipe-to-list`, {
                method: "POST",
                headers: getAuthHeaders(true),
                body: JSON.stringify({
                    text: recipeText,
                    listId: targetListId,
                }),
            });

            if (!response.ok) {
                throw new Error("AI Service error");
            }

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

    const addItem = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (newItemName.trim() === "") {
            return;
        }

        const newItem: Item = {
            id: crypto.randomUUID(),
            name: newItemName.trim(),
            checked: false,
            brand: brand || undefined,
            quantity: quantity || undefined,
            category,
            isRecurrent,
        };

        const optimisticItems = [...items, newItem];
        setItems(optimisticItems);
        syncListItemsInStore(optimisticItems);
        setNewItemName("");
        setBrand("");
        setQuantity("");
        setCategory("Altele");
        setIsRecurrent(false);

        void fetch(`${getBaseUrl()}/api/lists/${effectiveListId}/items`, {
            method: "POST",
            headers: getAuthHeaders(true),
            body: JSON.stringify({
                name: newItem.name,
                isChecked: newItem.checked,
                brand: newItem.brand ?? null,
                quantity: newItem.quantity ?? null,
                price: newItem.price ?? null,
                category: newItem.category ?? null,
                isRecurrent: newItem.isRecurrent ?? false,
                timestamp: Date.now(),
            }),
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error("Failed to add item");
                }
                await fetchListData(effectiveListId);
            })
            .catch(() => {
                setError("Nu s-a putut adăuga produsul.");
                const rolledBackItems = optimisticItems.filter(
                    (item) => item.id !== newItem.id,
                );
                setItems(rolledBackItems);
                syncListItemsInStore(rolledBackItems);
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

    const handleCheck = (itemId: string) => {
        const currentItem = items.find((item) => item.id === itemId);
        if (!currentItem) {
            return;
        }

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
            const rolledBackItems = items.map((item) =>
                item.id === itemId
                    ? { ...item, checked: currentItem.checked }
                    : item,
            );
            setItems(rolledBackItems);
            syncListItemsInStore(rolledBackItems);
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

    return (
        <div className={isEmbedded ? "list-detail-sidebar open" : "full-page-wrapper"}>
            <div className="centered-list-card">
                <h3
                    style={{
                        textAlign: "center",
                        color: "#2e1a5e",
                        marginBottom: "20px",
                    }}
                >
                    {isNewListPage ? "AI List Generator" : listTitle || "Shopping List"}
                </h3>

                {error && <div className="error-msg">{error}</div>}

                {isNewListPage ? (
                    <>
                        <p className="list-detail-helper">
                            Paste a recipe or ingredient list and a new shopping list will be created automatically.
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
                                {isAiLoading ? "Processing..." : "Generate List"}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <form onSubmit={addItem} className="add-item-form-sidebar">
                            <input
                                type="text"
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                placeholder="Item Name*"
                                className="sidebar-input"
                                required
                            />
                            <div className="row-inputs">
                                <input
                                    type="text"
                                    value={brand}
                                    onChange={(e) => setBrand(e.target.value)}
                                    placeholder="Brand"
                                    className="sidebar-input"
                                />
                                <input
                                    type="text"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    placeholder="Qty"
                                    className="sidebar-input"
                                />
                            </div>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="sidebar-input"
                            >
                                <option value="Altele">Category...</option>
                                <option value="Lactate">Lactate</option>
                                <option value="Legume">Legume</option>
                                <option value="Carne">Carne</option>
                                <option value="Băuturi">Băuturi</option>
                                <option value="Dulciuri">Dulciuri</option>
                            </select>
                            <label className="recurrence-label">
                                <input
                                    type="checkbox"
                                    checked={isRecurrent}
                                    onChange={(e) => setIsRecurrent(e.target.checked)}
                                />
                                Add to frequent items
                            </label>
                            <button type="submit" className="sidebar-add-btn">
                                Add to List
                            </button>
                        </form>

                        {isLoading ? (
                            <p style={{ textAlign: "center", marginTop: "20px" }}>
                                Loading list...
                            </p>
                        ) : (
                            <ShoppingListItems
                                items={items}
                                onCheck={handleCheck}
                                onDelete={handleDelete}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ListDetail;