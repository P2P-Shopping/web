import { AlertCircle, ChevronDown, Plus, Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Modal, PresenceBar } from "../../components";
import ShoppingListItems from "../../components/ShoppingList/ShoppingListItems";
import { usePresenceStore } from "../../context/usePresenceStore";
import { useStore } from "../../context/useStore";
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

interface ListDetailProps {
    isEmbedded?: boolean;
    listIdOverride?: string;
    listTitle?: string;
}

// getUsernameFromToken is no longer needed as we use the user state from the store

const ListDetail = ({
    isEmbedded = false,
    listIdOverride,
    listTitle: _listTitle,
}: ListDetailProps) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const effectiveListId = listIdOverride ?? id;
    const { updateList } = useListsStore();
    const { handlePresenceEvent, clearPresence } = usePresenceStore();
    const user = useStore((state) => state.user);
    const isServerConnected = useStore((state) => state.isServerConnected);

    const [items, setItems] = useState<Item[]>([]);
    const [newItemName, setNewItemName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [detailName, setDetailName] = useState("");
    const [detailQuantity, setDetailQuantity] = useState("");
    const [detailBrand, setDetailBrand] = useState("");
    const [detailPrice, setDetailPrice] = useState("");

    const addInputRef = useRef<HTMLInputElement | null>(null);
    const prevShowDetailsModalRef = useRef(showDetailsModal);

    const getBaseUrl = useCallback(
        () => import.meta.env.VITE_API_URL || "http://localhost:8081",
        [],
    );

    const getAuthHeaders = useCallback(
        (withContentType = false): HeadersInit => {
            return {
                ...(withContentType
                    ? { "Content-Type": "application/json" }
                    : {}),
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
                const response = await fetch(
                    `${getBaseUrl()}/api/lists/${targetListId}`,
                    {
                        headers: getAuthHeaders(),
                        credentials: "include",
                    },
                );
                if (!response.ok) {
                    if (response.status === 401) {
                        useStore.getState().setAuth(null);
                        throw new Error("Session expired.");
                    }
                    throw new Error("Failed to fetch list");
                }
                const currentList = (await response.json()) as ApiShoppingList;
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
            } catch (error) {
                console.error("fetchListData error:", error);
                setError("Failed to sync the list.");
            } finally {
                setIsLoading(false);
            }
        },
        [getBaseUrl, getAuthHeaders, syncListItemsInStore, effectiveListId],
    );

    useEffect(() => {
        setIsLoading(true);
        fetchListData();
    }, [fetchListData]);

    // Sync detail name when modal opens
    // biome-ignore lint/correctness/useExhaustiveDependencies: Only sync on open transition
    useEffect(() => {
        if (showDetailsModal && !prevShowDetailsModalRef.current) {
            setDetailName(newItemName);
        }
        prevShowDetailsModalRef.current = showDetailsModal;
    }, [showDetailsModal]); // Removed newItemName from deps to prevent clobbering

    // Reset local modal states when list changes
    // biome-ignore lint/correctness/useExhaustiveDependencies: Reset on ID change
    useEffect(() => {
        setShowDetailsModal(false);
        setShowMobileAddModal(false);
        setShowExpandedDetails(false);
    }, [effectiveListId]);

    // WebSocket Presence Logic
    useEffect(() => {
        if (
            !effectiveListId ||
            effectiveListId === "default" ||
            !isServerConnected
        ) {
            return;
        }

        const username = user?.firstName || user?.userId || "Anonymous";

        const subscription = stompClient.subscribe(
            `/topic/presence/${effectiveListId}`,
            (message) => {
                const event = JSON.parse(message.body);
                handlePresenceEvent(event);
            },
        );

        // Join
        if (stompClient.connected) {
            const joinEvent = {
                eventType: "JOIN" as const,
                username,
                listId: effectiveListId,
            };
            stompClient.publish({
                destination: `/app/presence/${effectiveListId}`,
                body: JSON.stringify(joinEvent),
            });
            // Optimistically add self to active users
            handlePresenceEvent(joinEvent);
        }

        return () => {
            // Leave
            if (stompClient.connected) {
                stompClient.publish({
                    destination: `/app/presence/${effectiveListId}`,
                    body: JSON.stringify({
                        eventType: "LEAVE",
                        username,
                        listId: effectiveListId,
                    }),
                });
            }
            subscription?.unsubscribe();
            clearPresence();
        };
    }, [
        effectiveListId,
        handlePresenceEvent,
        clearPresence,
        user?.firstName,
        user?.userId,
        isServerConnected,
    ]);

    // Typing Logic
    const lastTypingSentRef = useRef<number>(0);

    const sendTypingEvent = useCallback(() => {
        if (
            !effectiveListId ||
            effectiveListId === "default" ||
            !stompClient.connected
        )
            return;

        const now = Date.now();
        if (now - lastTypingSentRef.current > 1500) {
            const username = user?.firstName || user?.userId || "Anonymous";

            const typingEvent = {
                eventType: "TYPING" as const,
                username,
                listId: effectiveListId,
            };
            stompClient.publish({
                destination: `/app/presence/${effectiveListId}`,
                body: JSON.stringify(typingEvent),
            });
            handlePresenceEvent(typingEvent);
            lastTypingSentRef.current = now;
        }
    }, [effectiveListId, handlePresenceEvent, user?.firstName, user?.userId]);

    const handleNewItemNameChange = (name: string) => {
        setNewItemName(name);
        sendTypingEvent();
    };

    const openDetailsModal = () => {
        setDetailName(newItemName);
        setDetailQuantity("");
        setDetailBrand("");
        setDetailPrice("");
        setShowDetailsModal(true);
    };

    const rollbackItem = useCallback(
        (itemId: string) => {
            setItems((prev) => {
                const next = prev.filter((i) => i.id !== itemId);
                syncListItemsInStore(next);
                return next;
            });
        },
        [syncListItemsInStore],
    );

    const revertItemChecked = useCallback(
        (itemId: string, originalChecked: boolean) => {
            setItems((prev) => {
                const next = prev.map((item) =>
                    item.id === itemId
                        ? { ...item, checked: originalChecked }
                        : item,
                );
                syncListItemsInStore(next);
                return next;
            });
        },
        [syncListItemsInStore],
    );

    const closeDetailsModal = () => setShowDetailsModal(false);

    const commitItem = async (
        name: string,
        quantity?: string,
        brand?: string,
        price?: number,
    ) => {
        if (!effectiveListId || effectiveListId === "default") return;
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

        try {
            const res = await fetch(
                `${getBaseUrl()}/api/lists/${effectiveListId}/items`,
                {
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
                    credentials: "include",
                },
            );

            if (!res.ok) {
                if (res.status === 401) {
                    useStore.getState().setAuth(null);
                    throw new Error("Session expired.");
                }
                throw new Error("Failed to add item");
            }

            const createdApiItem = (await res.json()) as ApiListItem;
            const createdItem: Item = {
                id: createdApiItem.id,
                name: createdApiItem.name,
                checked: Boolean(createdApiItem.isChecked),
                brand: createdApiItem.brand,
                price: createdApiItem.price,
                quantity: createdApiItem.quantity,
                category: createdApiItem.category,
                isRecurrent: createdApiItem.isRecurrent,
            };

            await fetchListData(effectiveListId);

            // Publish after confirmation with server data
            if (stompClient.connected) {
                stompClient.publish({
                    destination: "/app/sync",
                    body: JSON.stringify({
                        eventType: "ITEM_ADDED",
                        listId: effectiveListId,
                        item: createdItem,
                    }),
                });
            }
        } catch {
            setError("Failed to add the product.");
            rollbackItem(newItem.id);
        }
    };

    const handleInlineAdd = (e: React.FormEvent) => {
        e.preventDefault();
        commitItem(newItemName);
    };

    const handleDetailsSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const price = detailPrice ? Number.parseFloat(detailPrice) : undefined;
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

    const handleCheck = async (itemId: string) => {
        if (!effectiveListId || effectiveListId === "default") return;
        const currentItem = items.find((item) => item.id === itemId);
        if (!currentItem) return;
        const newChecked = !currentItem.checked;
        const nextItems = items.map((item) =>
            item.id === itemId ? { ...item, checked: newChecked } : item,
        );
        setItems(nextItems);
        syncListItemsInStore(nextItems);

        try {
            const res = await fetch(`${getBaseUrl()}/api/items/${itemId}`, {
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
                credentials: "include",
            });

            if (!res.ok) {
                if (res.status === 401) {
                    useStore.getState().setAuth(null);
                    throw new Error("Session expired.");
                }
                throw new Error("Failed to update item");
            }
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
        } catch {
            setError("Failed to update the product.");
            revertItemChecked(itemId, currentItem.checked);
        }
    };

    const handleDelete = async (itemId: string) => {
        if (!effectiveListId || effectiveListId === "default") return;
        const previousItems = items;
        const nextItems = previousItems.filter((item) => item.id !== itemId);
        setItems(nextItems);
        syncListItemsInStore(nextItems);

        try {
            const res = await fetch(`${getBaseUrl()}/api/items/${itemId}`, {
                method: "DELETE",
                headers: getAuthHeaders(),
                credentials: "include",
            });

            if (!res.ok) {
                if (res.status === 401) {
                    useStore.getState().setAuth(null);
                    throw new Error("Session expired.");
                }
                throw new Error("Failed to delete item");
            }
        } catch {
            setError("Failed to delete the product.");
            fetchListData(effectiveListId);
        }
    };

    const [showMobileAddModal, setShowMobileAddModal] = useState(false);
    const [showExpandedDetails, setShowExpandedDetails] = useState(false);

    const closeMobileAddModal = () => {
        setShowMobileAddModal(false);
        setShowExpandedDetails(false);
        setNewItemName("");
    };

    const { lists, fetchLists } = useListsStore();

    // Fetch lists if embedded to allow selection
    useEffect(() => {
        if (isEmbedded && lists.length === 0) {
            fetchLists();
        }
    }, [isEmbedded, lists.length, fetchLists]);

    const handleListSelect = (listId: string) => {
        navigate(`/nav/${listId}`);
    };

    return (
        <div
            className={
                isEmbedded
                    ? "w-full flex flex-col h-full bg-surface/50"
                    : "flex justify-center items-start p-20px bg-bg"
            }
        >
            <div
                className={`w-full ${isEmbedded ? "" : "max-w-[860px]"} mx-auto flex flex-col gap-4 box-border ${isEmbedded ? "p-6" : "max-[600px]:pb-[100px]"}`}
            >
                {isEmbedded && (
                    <header className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-black text-text-strong tracking-tighter uppercase italic">
                            {effectiveListId === "default"
                                ? "Select a List"
                                : "Shopping List"}
                        </h2>
                        {effectiveListId !== "default" && (
                            <button
                                type="button"
                                onClick={() => handleListSelect("default")}
                                className="text-[10px] font-bold text-accent hover:underline uppercase"
                            >
                                Switch List
                            </button>
                        )}
                    </header>
                )}

                {error && (
                    <div
                        className={`bg-danger-subtle text-danger border border-danger-border p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-300 ${isEmbedded ? "mb-2" : "-mt-2 mb-2"}`}
                    >
                        <AlertCircle size={20} className="shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold leading-none mb-1">
                                System Error
                            </p>
                            <p className="text-[13px] opacity-90 leading-tight">
                                {error}
                            </p>
                        </div>
                    </div>
                )}

                {effectiveListId === "default" && isEmbedded ? (
                    <div className="flex flex-col gap-3">
                        {lists.length === 0 && !isLoading ? (
                            <p className="text-center py-10 text-text-muted italic text-sm">
                                No lists found. Create one in the dashboard!
                            </p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {lists.map((list) => (
                                    <button
                                        type="button"
                                        key={list.id}
                                        onClick={() =>
                                            handleListSelect(list.id)
                                        }
                                        className="flex items-center justify-between p-4 bg-surface border border-border rounded-xl hover:border-accent hover:shadow-md transition-all text-left"
                                    >
                                        <div className="flex flex-col gap-0.5 min-w-0">
                                            <span
                                                className="font-bold text-text-strong truncate"
                                                title={list.name}
                                            >
                                                {list.name}
                                            </span>
                                            <span className="text-xs text-text-muted">
                                                {list.items.length} items
                                            </span>
                                        </div>
                                        <ChevronDown
                                            size={18}
                                            className="-rotate-90 text-text-muted"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* ── Inline add bar (Desktop & Embedded) ── */}
                        <div className="flex flex-col gap-1.5">
                            <form
                                onSubmit={handleInlineAdd}
                                className={`flex items-center gap-2 bg-surface border border-border rounded-xl p-[10px_14px] shadow-sm ${isEmbedded ? "" : "max-[600px]:hidden"}`}
                            >
                                <input
                                    ref={addInputRef}
                                    type="text"
                                    value={newItemName}
                                    onChange={(e) =>
                                        handleNewItemNameChange(e.target.value)
                                    }
                                    placeholder={
                                        error === "Failed to sync the list."
                                            ? "List is read-only (sync failed)"
                                            : "Add item..."
                                    }
                                    disabled={
                                        error === "Failed to sync the list."
                                    }
                                    className={`flex-1 min-w-0 border-none bg-transparent text-sm text-text-strong outline-none px-1 ${error === "Failed to sync the list." ? "cursor-not-allowed opacity-50" : ""}`}
                                />
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-bg-muted text-text-muted hover:text-accent hover:bg-accent-subtle hover:border-accent-border border border-border transition-all shrink-0"
                                    disabled={
                                        error === "Failed to sync the list."
                                    }
                                    onClick={openDetailsModal}
                                    title={
                                        error === "Failed to sync the list."
                                            ? "Sync failed"
                                            : "Add item details"
                                    }
                                    aria-label="Add item details"
                                >
                                    <Settings size={18} />
                                </button>
                                <button
                                    type="submit"
                                    disabled={
                                        error === "Failed to sync the list."
                                    }
                                    className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-text-strong text-bg transition-all shrink-0 ${error === "Failed to sync the list." ? "opacity-30 cursor-not-allowed" : "hover:opacity-90"}`}
                                    aria-label="Add"
                                >
                                    <Plus size={18} strokeWidth={3} />
                                </button>
                            </form>

                            {/* ── Typing Indicator (Discord-style) ── */}
                            <div className="min-h-[20px] px-2 flex items-center">
                                <PresenceBar variant="typing" />
                            </div>
                        </div>

                        {/* ── Items list ── */}
                        <div className="bg-surface border border-border rounded-xl shadow-sm min-h-[120px] overflow-hidden flex-1">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center gap-4 p-[60px_20px] text-text-muted">
                                    <div className="w-8 h-8 border-3 border-border border-t-accent rounded-full animate-spin" />
                                    <p>Loading...</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/50 h-full overflow-y-auto p-4">
                                    <ShoppingListItems
                                        items={items}
                                        onCheck={handleCheck}
                                        onDelete={handleDelete}
                                        disabled={
                                            error === "Failed to sync the list."
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Mobile FAB */}
            {error !== "Failed to sync the list." && (
                <button
                    type="button"
                    className="hidden max-[600px]:flex fixed bottom-24 right-6 w-[60px] h-[60px] rounded-full bg-accent text-white border-none items-center justify-center shadow-[0_4px_12px_var(--color-accent-glow)] cursor-pointer transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_var(--color-accent-glow)] active:scale-95 z-100"
                    onClick={() => setShowMobileAddModal(true)}
                    aria-label="Add Item"
                >
                    <Plus size={28} strokeWidth={3} />
                </button>
            )}

            {/* ── Mobile Add Item Modal ── */}
            <Modal
                isOpen={showMobileAddModal}
                onClose={closeMobileAddModal}
                title="Add Item"
                initialFocusSelector="#mobile-item-name"
                footer={
                    <div className="grid grid-cols-2 gap-3 w-full">
                        <button
                            type="button"
                            className="px-6 py-2.5 bg-bg-muted text-text-strong border border-border rounded-md text-sm font-semibold transition-all hover:bg-border"
                            onClick={closeMobileAddModal}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="mobile-add-form"
                            className="inline-flex items-center justify-center px-6 py-2.5 bg-text-strong text-bg border-none rounded-md text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                        >
                            Add
                        </button>
                    </div>
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
                            Item Name
                        </label>
                        <input
                            id="mobile-item-name"
                            type="text"
                            value={detailName}
                            onChange={(e) => {
                                setDetailName(e.target.value);
                                sendTypingEvent();
                            }}
                            placeholder="e.g. Milk"
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
                            ? "Fewer details"
                            : "Add details (qty, price...)"}
                        <ChevronDown
                            size={16}
                            className="transition-transform duration-200"
                            style={{
                                transform: showExpandedDetails
                                    ? "rotate(180deg)"
                                    : "none",
                            }}
                        />
                    </button>

                    {showExpandedDetails && (
                        <div className="flex flex-col gap-4 p-4 bg-bg-subtle rounded-xl border border-border border-dashed animate-in slide-in-from-top-2 duration-200">
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="m-qty"
                                    className="text-xs font-semibold text-text-muted"
                                >
                                    Quantity
                                </label>
                                <input
                                    id="m-qty"
                                    type="text"
                                    value={detailQuantity}
                                    onChange={(e) =>
                                        setDetailQuantity(e.target.value)
                                    }
                                    placeholder="e.g. 2 pcs"
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
                                    placeholder="e.g. Zuzu"
                                    className="w-full px-3 py-2 bg-surface border border-border rounded-md text-sm outline-none focus:border-accent transition-all"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="m-price"
                                    className="text-xs font-semibold text-text-muted"
                                >
                                    Price
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
                    <div className="grid grid-cols-2 gap-3 w-full">
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
                    </div>
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
                            onChange={(e) => {
                                setDetailName(e.target.value);
                                sendTypingEvent();
                            }}
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
        </div>
    );
};

export default ListDetail;
