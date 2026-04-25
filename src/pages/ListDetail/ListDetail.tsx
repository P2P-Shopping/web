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
}
/**
 * Custom hook to manage shopping list items, including fetching, adding, and toggling.
 */
const useListItems = (effectiveListId: string | undefined) => {
    const { updateList } = useListsStore();
    const [items, setItems] = useState<Item[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncFailed, setSyncFailed] = useState(false);

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
                        setSyncFailed(true);
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
                setSyncFailed(true);
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
    /**
     * Adds a new item to the current shopping list with optional details.
     */
    const addItem = async (
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
        } catch (err) {
            console.error("addItem error:", err);
            setError("Failed to add the product.");
            rollbackItem(newItem.id);
        }
    };

    const toggleItem = async (itemId: string) => {
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
        } catch (err) {
            console.error("toggleItem error:", err);
            setError("Failed to update the product.");
            revertItemChecked(itemId, currentItem.checked);
        }
    };

    const deleteItem = async (itemId: string) => {
        if (!effectiveListId || effectiveListId === "default") return;
        const nextItems = items.filter((item) => item.id !== itemId);
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
        } catch (err) {
            console.error("deleteItem error:", err);
            setError("Failed to delete the product.");
            fetchListData(effectiveListId);
        }
    };

    return {
        items,
        isLoading,
        error,
        syncFailed,
        addItem,
        toggleItem,
        deleteItem,
        setError,
    };
};

const useListPresence = (effectiveListId: string | undefined) => {
    const { handlePresenceEvent, clearPresence } = usePresenceStore();
    const user = useStore((state) => state.user);
    const isServerConnected = useStore((state) => state.isServerConnected);
    const lastTypingSentRef = useRef<number>(0);

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
            handlePresenceEvent(joinEvent);
        }

        return () => {
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

    return { sendTypingEvent };
};

const ListSelectionView = ({
    lists,
    isLoading,
    onSelect,
}: {
    lists: { id: string; name: string; items: Item[] }[];
    isLoading: boolean;
    onSelect: (id: string) => void;
}) => {
    if (lists.length === 0 && !isLoading) {
        return (
            <p className="text-center py-10 text-text-muted italic text-sm">
                No lists found. Create one in the dashboard!
            </p>
        );
    }
    return (
        <div className="flex flex-col gap-2">
            {lists.map((list) => (
                <button
                    type="button"
                    key={list.id}
                    onClick={() => onSelect(list.id)}
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
    );
};

interface AddItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    title: string;
    subtitle?: string;
    idPrefix: string;
    itemName: string;
    setItemName: (val: string) => void;
    quantity: string;
    setQuantity: (val: string) => void;
    brand: string;
    setBrand: (val: string) => void;
    price: string;
    setPrice: (val: string) => void;
    onTyping?: () => void;
    isMobile?: boolean;
    showExpanded?: boolean;
    setShowExpanded?: (val: boolean) => void;
}

const ItemNameField = ({
    idPrefix,
    value,
    onChange,
    onTyping,
    isMobile,
}: {
    idPrefix: string;
    value: string;
    onChange: (val: string) => void;
    onTyping?: () => void;
    isMobile: boolean;
}) => (
    <div className="flex flex-col gap-1.5">
        <label
            htmlFor={`${idPrefix}-item-name`}
            className="text-[13px] font-semibold text-text-strong"
        >
            Item Name
        </label>
        <input
            id={`${idPrefix}-item-name`}
            type="text"
            value={value}
            onChange={(e) => {
                onChange(e.target.value);
                onTyping?.();
            }}
            placeholder={isMobile ? "e.g. Milk" : "e.g., Milk"}
            required
            className="w-full px-3.5 py-2.5 bg-bg-muted border-1.5 border-border rounded-md text-base text-text-strong outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)] transition-all"
        />
    </div>
);

const ExpandDetailsButton = ({
    showExpanded,
    onClick,
}: {
    showExpanded: boolean;
    onClick: () => void;
}) => (
    <button
        type="button"
        className="flex items-center justify-between w-full p-[12px_14px] bg-bg-muted border border-border rounded-md text-text-strong text-sm font-semibold cursor-pointer transition-all hover:bg-border/50"
        onClick={onClick}
    >
        {showExpanded ? "Fewer details" : "Add details (qty, price...)"}
        <ChevronDown
            size={16}
            className="transition-transform duration-200"
            style={{
                transform: showExpanded ? "rotate(180deg)" : "none",
            }}
        />
    </button>
);

const ItemDetailsFields = ({
    idPrefix,
    quantity,
    setQuantity,
    price,
    setPrice,
    brand,
    setBrand,
    isMobile,
}: {
    idPrefix: string;
    quantity: string;
    setQuantity: (val: string) => void;
    price: string;
    setPrice: (val: string) => void;
    brand: string;
    setBrand: (val: string) => void;
    isMobile: boolean;
}) => (
    <div
        className={
            isMobile
                ? "flex flex-col gap-4 p-4 bg-bg-subtle rounded-xl border border-border border-dashed animate-in slide-in-from-top-2 duration-200"
                : "grid grid-cols-2 gap-4"
        }
    >
        <div className="flex flex-col gap-1.5">
            <label
                htmlFor={`${idPrefix}-quantity`}
                className={`text-[13px] font-semibold ${isMobile ? "text-text-muted" : "text-text-strong"}`}
            >
                Quantity
            </label>
            <input
                id={`${idPrefix}-quantity`}
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={isMobile ? "e.g. 2 pcs" : "e.g., 2"}
                className={`w-full ${isMobile ? "px-3 py-2 bg-surface" : "px-3.5 py-2.5 bg-bg-muted"} border border-border rounded-md text-sm text-text-strong outline-none focus:border-accent transition-all`}
            />
        </div>
        <div className="flex flex-col gap-1.5">
            <label
                htmlFor={`${idPrefix}-price`}
                className={`text-[13px] font-semibold ${isMobile ? "text-text-muted" : "text-text-strong"}`}
            >
                Price {isMobile ? "" : "(Optional)"}
            </label>
            <input
                id={`${idPrefix}-price`}
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={isMobile ? "0.00" : "e.g., 4.99"}
                className={`w-full ${isMobile ? "px-3 py-2 bg-surface" : "px-3.5 py-2.5 bg-bg-muted"} border border-border rounded-md text-sm text-text-strong outline-none focus:border-accent transition-all`}
            />
        </div>
        <div
            className={`flex flex-col gap-1.5 ${isMobile ? "" : "col-span-2"}`}
        >
            <label
                htmlFor={`${idPrefix}-brand`}
                className={`text-[13px] font-semibold ${isMobile ? "text-text-muted" : "text-text-strong"}`}
            >
                Brand {isMobile ? "" : "(Optional)"}
            </label>
            <input
                id={`${idPrefix}-brand`}
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder={isMobile ? "e.g. Zuzu" : "e.g., Organic Valley"}
                className={`w-full ${isMobile ? "px-3 py-2 bg-surface" : "px-3.5 py-2.5 bg-bg-muted"} border border-border rounded-md text-sm text-text-strong outline-none focus:border-accent transition-all`}
            />
        </div>
    </div>
);

const AddItemDetailsModal = ({
    isOpen,
    onClose,
    onSubmit,
    title,
    subtitle,
    idPrefix,
    itemName,
    setItemName,
    quantity,
    setQuantity,
    brand,
    setBrand,
    price,
    setPrice,
    onTyping,
    isMobile = false,
    showExpanded = true,
    setShowExpanded,
}: AddItemModalProps) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            subtitle={subtitle}
            initialFocusSelector={`#${idPrefix}-item-name`}
            footer={
                <div className="grid grid-cols-2 gap-3 w-full">
                    <button
                        type="button"
                        className="px-6 py-2.5 bg-bg-muted text-text-strong border border-border rounded-md text-sm font-semibold transition-all hover:bg-border"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form={`${idPrefix}-details-form`}
                        className="inline-flex items-center justify-center px-6 py-2.5 bg-text-strong text-bg border-none rounded-md text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                    >
                        {isMobile ? "Add" : "Add Item"}
                    </button>
                </div>
            }
        >
            <form
                id={`${idPrefix}-details-form`}
                onSubmit={onSubmit}
                className="flex flex-col gap-4"
            >
                <ItemNameField
                    idPrefix={idPrefix}
                    value={itemName}
                    onChange={setItemName}
                    onTyping={onTyping}
                    isMobile={isMobile}
                />

                {isMobile && setShowExpanded && (
                    <ExpandDetailsButton
                        showExpanded={showExpanded}
                        onClick={() => setShowExpanded(!showExpanded)}
                    />
                )}

                {showExpanded && (
                    <ItemDetailsFields
                        idPrefix={idPrefix}
                        quantity={quantity}
                        setQuantity={setQuantity}
                        price={price}
                        setPrice={setPrice}
                        brand={brand}
                        setBrand={setBrand}
                        isMobile={isMobile}
                    />
                )}
            </form>
        </Modal>
    );
};

const ListErrorAlert = ({
    error,
    isEmbedded,
}: {
    error: string;
    isEmbedded: boolean;
}) => (
    <div
        className={`bg-danger-subtle text-danger border border-danger-border p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-300 ${isEmbedded ? "mb-2" : "-mt-2 mb-2"}`}
    >
        <AlertCircle size={20} className="shrink-0" />
        <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-none mb-1">System Error</p>
            <p className="text-[13px] opacity-90 leading-tight">{error}</p>
        </div>
    </div>
);

const ListHeader = ({
    effectiveListId,
    onSwitchList,
}: {
    effectiveListId: string;
    onSwitchList: () => void;
}) => (
    <header className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-black text-text-strong tracking-tighter uppercase italic">
            {effectiveListId === "default" ? "Select a List" : "Shopping List"}
        </h2>
        {effectiveListId !== "default" && (
            <button
                type="button"
                onClick={onSwitchList}
                className="text-[10px] font-bold text-accent hover:underline uppercase"
            >
                Switch List
            </button>
        )}
    </header>
);

const InlineAddForm = ({
    addInputRef,
    newItemName,
    onNameChange,
    onSubmit,
    onOpenDetails,
    isReadOnly,
    isEmbedded,
}: {
    addInputRef: React.RefObject<HTMLInputElement | null>;
    newItemName: string;
    onNameChange: (val: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onOpenDetails: () => void;
    isReadOnly: boolean;
    isEmbedded: boolean;
}) => (
    <form
        onSubmit={onSubmit}
        className={`flex items-center gap-2 bg-surface border border-border rounded-xl p-[10px_14px] shadow-sm ${isEmbedded ? "" : "max-[600px]:hidden"}`}
    >
        <input
            ref={addInputRef}
            type="text"
            value={newItemName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={
                isReadOnly ? "List is read-only (sync failed)" : "Add item..."
            }
            disabled={isReadOnly}
            className={`flex-1 min-w-0 border-none bg-transparent text-sm text-text-strong outline-none px-1 ${isReadOnly ? "cursor-not-allowed opacity-50" : ""}`}
        />
        <button
            type="button"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-bg-muted text-text-muted hover:text-accent hover:bg-accent-subtle hover:border-accent-border border border-border transition-all shrink-0"
            disabled={isReadOnly}
            onClick={onOpenDetails}
            aria-label="Add item details"
        >
            <Settings size={18} />
        </button>
        <button
            type="submit"
            disabled={isReadOnly}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-text-strong text-bg transition-all shrink-0 ${isReadOnly ? "opacity-30 cursor-not-allowed" : "hover:opacity-90"}`}
            aria-label="Add"
        >
            <Plus size={18} strokeWidth={3} />
        </button>
    </form>
);

const ListDetail = ({
    isEmbedded = false,
    listIdOverride,
}: ListDetailProps) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const effectiveListId = listIdOverride ?? id;

    const {
        items,
        isLoading,
        error,
        syncFailed,
        addItem,
        toggleItem,
        deleteItem,
    } = useListItems(effectiveListId);

    const { sendTypingEvent } = useListPresence(effectiveListId);

    const [newItemName, setNewItemName] = useState("");
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showMobileAddModal, setShowMobileAddModal] = useState(false);
    const [showExpandedDetails, setShowExpandedDetails] = useState(false);

    const [detailName, setDetailName] = useState("");
    const [detailQuantity, setDetailQuantity] = useState("");
    const [detailBrand, setDetailBrand] = useState("");
    const [detailPrice, setDetailPrice] = useState("");

    const addInputRef = useRef<HTMLInputElement | null>(null);
    const { lists, fetchLists } = useListsStore();

    useEffect(() => {
        if (isEmbedded && lists.length === 0) {
            fetchLists();
        }
    }, [isEmbedded, lists.length, fetchLists]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: reset on change
    useEffect(() => {
        resetDetailFields();
    }, [effectiveListId]);

    const resetDetailFields = useCallback(() => {
        setShowDetailsModal(false);
        setShowMobileAddModal(false);
        setShowExpandedDetails(false);
        setNewItemName("");
        setDetailName("");
        setDetailQuantity("");
        setDetailBrand("");
        setDetailPrice("");
    }, []);

    const handleNewItemNameChange = (name: string) => {
        setNewItemName(name);
        sendTypingEvent();
    };

    const handleInlineAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemName.trim()) return;
        addItem(newItemName);
        setNewItemName("");
    };

    const openDetailsModal = () => {
        setDetailName(newItemName);
        setDetailQuantity("");
        setDetailBrand("");
        setDetailPrice("");
        setShowDetailsModal(true);
    };

    const handleDetailsSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const price = detailPrice ? Number.parseFloat(detailPrice) : undefined;
        addItem(detailName, detailQuantity, detailBrand, price);

        setShowDetailsModal(false);
        setShowMobileAddModal(false);
        setShowExpandedDetails(false);

        setDetailName("");
        setDetailQuantity("");
        setDetailBrand("");
        setDetailPrice("");
        setNewItemName("");
    };

    const isReadOnly = syncFailed;

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
                    <ListHeader
                        effectiveListId={effectiveListId ?? "default"}
                        onSwitchList={() => navigate("/nav/default")}
                    />
                )}

                {error && (
                    <ListErrorAlert error={error} isEmbedded={isEmbedded} />
                )}

                {effectiveListId === "default" && isEmbedded ? (
                    <ListSelectionView
                        lists={lists}
                        isLoading={isLoading}
                        onSelect={(listId) => navigate(`/nav/${listId}`)}
                    />
                ) : (
                    <>
                        <div className="flex flex-col gap-1.5">
                            <InlineAddForm
                                addInputRef={addInputRef}
                                newItemName={newItemName}
                                onNameChange={handleNewItemNameChange}
                                onSubmit={handleInlineAdd}
                                onOpenDetails={openDetailsModal}
                                isReadOnly={isReadOnly}
                                isEmbedded={isEmbedded}
                            />

                            <div className="min-h-[20px] px-2 flex items-center">
                                <PresenceBar variant="typing" />
                            </div>
                        </div>

                        <div className="bg-surface border border-border rounded-xl shadow-sm min-h-[120px] overflow-hidden flex-1">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center gap-4 p-[60px_20px] text-text-muted">
                                    <div className="w-8 h-8 border-[3px] border-border border-t-accent rounded-full animate-spin" />
                                    <p>Loading...</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/50 h-full overflow-y-auto p-4">
                                    <ShoppingListItems
                                        items={items}
                                        onCheck={toggleItem}
                                        onDelete={deleteItem}
                                        disabled={isReadOnly}
                                    />
                                    {items.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-border flex justify-between items-center bg-bg-muted/30 -mx-4 -mb-4 px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                                                    Estimated Total
                                                </span>
                                                <span className="text-xs text-text-muted opacity-70">
                                                    {items.length} items
                                                </span>
                                            </div>
                                            <span className="text-xl font-black text-accent tracking-tight">
                                                {items
                                                    .reduce((sum, item) => {
                                                        const qtyStr =
                                                            item.quantity ||
                                                            "1";
                                                        const qtyMatch =
                                                            qtyStr.match(
                                                                /(\d+(?:\.\d+)?)/,
                                                            );
                                                        const qty = qtyMatch
                                                            ? Number.parseFloat(
                                                                  qtyMatch[1],
                                                              )
                                                            : 1;
                                                        return (
                                                            sum +
                                                            (item.price || 0) *
                                                                qty
                                                        );
                                                    }, 0)
                                                    .toFixed(2)}{" "}
                                                lei
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {!isReadOnly && (
                <button
                    type="button"
                    className="hidden max-[600px]:flex fixed bottom-24 right-6 w-[60px] h-[60px] rounded-full bg-accent text-white border-none items-center justify-center shadow-[0_4px_12px_var(--color-accent-glow)] cursor-pointer transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_var(--color-accent-glow)] active:scale-95 z-100"
                    onClick={() => {
                        setDetailName(newItemName);
                        setShowMobileAddModal(true);
                    }}
                    aria-label="Add Item"
                >
                    <Plus size={28} strokeWidth={3} />
                </button>
            )}

            <AddItemDetailsModal
                isOpen={showMobileAddModal}
                onClose={resetDetailFields}
                onSubmit={handleDetailsSubmit}
                title="Add Item"
                idPrefix="mobile"
                itemName={detailName}
                setItemName={setDetailName}
                quantity={detailQuantity}
                setQuantity={setDetailQuantity}
                brand={detailBrand}
                setBrand={setDetailBrand}
                price={detailPrice}
                setPrice={setDetailPrice}
                onTyping={sendTypingEvent}
                isMobile={true}
                showExpanded={showExpandedDetails}
                setShowExpanded={setShowExpandedDetails}
            />

            <AddItemDetailsModal
                isOpen={showDetailsModal}
                onClose={resetDetailFields}
                onSubmit={handleDetailsSubmit}
                title="Add Item Details"
                subtitle="Add optional details like quantity, brand, and price"
                idPrefix="ld"
                itemName={detailName}
                setItemName={setDetailName}
                quantity={detailQuantity}
                setQuantity={setDetailQuantity}
                brand={detailBrand}
                setBrand={setDetailBrand}
                price={detailPrice}
                setPrice={setDetailPrice}
                onTyping={sendTypingEvent}
            />
        </div>
    );
};

export default ListDetail;
