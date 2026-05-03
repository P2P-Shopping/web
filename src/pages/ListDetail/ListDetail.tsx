import {
    AlertCircle,
    Camera,
    ChevronDown,
    Plus,
    Settings,
    UserPlus,
} from "lucide-react";
import type { IMessage } from "@stomp/stompjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ImportItemsModal,
    Modal,
    PresenceBar,
    type ReviewItem,
    type ReviewSubmission,
    SmartReviewModal,
} from "../../components";
import ShoppingListItems from "../../components/ShoppingList/ShoppingListItems";
import { usePresenceStore } from "../../context/usePresenceStore";
import { useStore } from "../../context/useStore";
import type { SyncPayload } from "../../dto/SyncPayload";
import api, {
    aiMultimodalRequest,
    finishShoppingRequest,
} from "../../services/api";
import stompClient, { socketService, clientInstanceId } from "../../services/socketService";
import { useListsStore } from "../../store/useListsStore";
import type { ListCategory } from "../../types";
import { buildItemDuplicateKey } from "../../utils/listUtils";
import ShareListModal from "../Dashboard/ShareListModal";

interface Item {
    id: string;
    name: string;
    checked: boolean;
    brand?: string;
    quantity?: string;
    price?: number;
    category?: string;
    isRecurrent?: boolean;
    createdAt?: number;
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
    createdAt?: number;
}

interface ApiShoppingList {
    id: string;
    category?: ListCategory;
    subcategory?: string;
    finalStore?: string;
    ownerEmail?: string;
    ownerName?: string;
    collaboratorEmails?: string[];
    items?: ApiListItem[];
}

interface ListDetailProps {
    isEmbedded?: boolean;
    listIdOverride?: string;
    onSwitchList?: () => void;
}

/**
 * Custom hook to manage shopping list items, including fetching, adding, toggling, and deleting items.
 * @param effectiveListId - The ID of the currently active list.
 */
const useListItems = (effectiveListId: string | undefined) => {
    const {
        updateList,
        applyIncomingSync,
        markPendingMutation,
        clearPendingMutation,
        syncListItemsFromServer,
    } = useListsStore();
    const [items, setItems] = useState<Item[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncFailed, setSyncFailed] = useState(false);
    const isServerConnected = useStore((state) => state.isServerConnected);

    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);

    /**
     * Synchronizes the local item state with the global store state.
     */
    const syncListItemsInStore = useCallback(
        (nextItems: Item[], targetListId = effectiveListId) => {
            if (!targetListId || targetListId === "default") return;
            updateList(targetListId, { items: nextItems });
        },
        [effectiveListId, updateList],
    );

    /**
     * Fetches the complete data for a specific shopping list from the server.
     */
    const fetchListData = useCallback(
        async (targetListId = effectiveListId) => {
            if (!targetListId || targetListId === "default") {
                setItems([]);
                setIsLoading(false);
                return;
            }
            try {
                const response = await api.get<ApiShoppingList>(
                    `/api/lists/${targetListId}`,
                );
                // Note: api.get returns response.data directly in the feature branch implementation of 'api' service usually,
                // but main seems to have switched to 'fetch' or a different api wrapper.
                // Looking at the conflict:
                // HEAD: const currentList = response.data;
                // main: if (!response.ok) { ... } const currentList = (await response.json()) as ApiShoppingList;
                // If 'api' is the axios-like wrapper from feature branch, it has .data.
                // Let's check what 'api' is.

                const currentList = response.data;
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
                    createdAt: item.createdAt,
                }));

                // Sort items: Unchecked first, then alphabetically
                const sortedItems = [...mappedItems].sort((a, b) => {
                    if (a.checked !== b.checked) {
                        return a.checked ? 1 : -1;
                    }
                    return a.name.localeCompare(b.name);
                });

                syncListItemsFromServer(targetListId, sortedItems);

                const reconciledItems =
                    useListsStore.getState().getListById(targetListId)?.items ??
                    sortedItems;

                setItems(reconciledItems.map((item) => ({ ...item })));
                
                useListsStore.getState().updateList(targetListId, {
                    category: currentList.category,
                    subcategory: currentList.subcategory,
                    finalStore: currentList.finalStore,
                    ownerEmail: currentList.ownerEmail,
                    ownerName: currentList.ownerName,
                    collaboratorEmails: currentList.collaboratorEmails,
                });
            } catch (error) {
                const errorMessage =
                    error instanceof Error
                        ? error.message
                        : "Failed to sync the list.";
                console.error("fetchListData error:", error);
                setError(errorMessage);
                setSyncFailed(true);
            } finally {
                setIsLoading(false);
            }
        },
        [effectiveListId, syncListItemsFromServer],
    );

    useEffect(() => {
        setIsLoading(true);
        fetchListData();
    }, [fetchListData]);

    const handleAiImport = async (recipeText: string) => {
        if (!recipeText.trim() || !effectiveListId) return;
        setIsLoading(true);
        setError(null);

        try {
            const response = await aiMultimodalRequest(recipeText, null);
            const aiData = response.data;

            let rawItems: {
                specificName?: string;
                genericName?: string;
                name?: string;
                brand?: string;
                quantity?: number | string;
                unit?: string;
                category?: string;
            }[] = [];
            if (aiData && typeof aiData === "object" && "items" in aiData) {
                rawItems = aiData.items ?? [];
            } else if (Array.isArray(aiData)) {
                rawItems = aiData;
            }

            const itemsToReview: ReviewItem[] = rawItems.map((item) => ({
                id: crypto.randomUUID(),
                name: item.genericName || item.specificName || item.name || "",
                brand: item.brand || undefined,
                quantity: item.quantity ? String(item.quantity) : undefined,
                category: item.category || undefined,
            }));

            setReviewItems(itemsToReview);
            setIsReviewModalOpen(true);
        } catch (err) {
            console.error("AI processing error:", err);
            setError("AI processing error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleReviewConfirm = async ({
        items: feedback,
    }: ReviewSubmission) => {
        try {
            for (const item of feedback) {
                const payload = {
                    name: item.name,
                    isChecked: false,
                    brand: item.brand?.trim() ? item.brand.trim() : null,
                    quantity: item.quantity?.trim() ? item.quantity.trim() : null,
                    category: item.category || null,
                    isRecurrent: false,
                    timestamp: Date.now(),
                };
                
                const res = await api.post<ApiListItem>(
                    `/api/lists/${effectiveListId}/items`,
                    payload
                );

                const createdItem = res.data;
                
                // Broadcast each new item to the room
                const syncPayload: SyncPayload = {
                    action: "ADD",
                    itemId: createdItem.id,
                    content: JSON.stringify({
                        id: createdItem.id,
                        name: createdItem.name,
                        checked: Boolean(createdItem.isChecked),
                        brand: createdItem.brand,
                        price: createdItem.price,
                        quantity: createdItem.quantity,
                        category: createdItem.category,
                        isRecurrent: createdItem.isRecurrent,
                        createdAt: createdItem.createdAt,
                    }),
                    timestamp: Date.now(),
                    senderId: clientInstanceId,
                };

                socketService.publish(
                    "/app/list/" + effectiveListId + "/update",
                    JSON.stringify(syncPayload)
                );
            }
            
            await fetchListData(effectiveListId);
            setIsReviewModalOpen(false);
        } catch (err) {
            console.error("handleReviewConfirm error:", err);
            setError("Error saving some items. Please check your list.");
            await fetchListData(effectiveListId);
        }
    };

    /**
     * Handles incoming list synchronization frames from STOMP.
     * @param message - STOMP message frame containing a serialized SyncPayload.
     */
    const handleSyncMessage = useCallback(
        (message: IMessage) => {
            try {
                const payload = JSON.parse(message.body) as SyncPayload;
                if (!effectiveListId || effectiveListId === "default") {
                    return;
                }

                // Ignore messages sent by ourselves to prevent duplicates with optimistic UI
                if (payload.senderId === clientInstanceId) {
                    console.debug("[ws] ignoring own broadcast", payload.action);
                    return;
                }

                applyIncomingSync(effectiveListId, payload);

                const nextItems =
                    useListsStore.getState().getListById(effectiveListId)
                        ?.items ?? [];
                setItems(nextItems.map((item) => ({ ...item })));
            } catch (err) {
                console.error("Failed to parse sync message:", err);
            }
        },
        [applyIncomingSync, effectiveListId],
    );

    useEffect(() => {
        if (
            !effectiveListId ||
            effectiveListId === "default" ||
            !isServerConnected
        ) {
            return;
        }

        console.debug("[ws] subscribing list sync", effectiveListId);
        const updateSubscription = socketService.subscribe(
            "/topic/list/" + effectiveListId,
            handleSyncMessage,
        );

        return () => {
            updateSubscription?.unsubscribe();
        };
    }, [effectiveListId, handleSyncMessage, isServerConnected]);

    /**
     * Reverts an item addition locally if the server request fails.
     */
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

    /**
     * Reverts an item's checked status if the server request fails.
     */
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
            createdAt: Date.now(),
        };

        markPendingMutation(newItem.id);
        
        // Find correct alphabetical position within unchecked section
        const uncheckedItems = items.filter(item => !item.checked);
        const checkedItems = items.filter(item => item.checked);
        
        // Find index in uncheckedItems
        let insertIdx = uncheckedItems.findIndex(item => item.name.localeCompare(newItem.name) > 0);
        if (insertIdx === -1) insertIdx = uncheckedItems.length;
        
        const nextUnchecked = [...uncheckedItems];
        nextUnchecked.splice(insertIdx, 0, newItem);
        
        const optimisticItems = [...nextUnchecked, ...checkedItems];

        setItems(optimisticItems);
        syncListItemsInStore(optimisticItems);

        try {
            const payload = {
                name: newItem.name,
                isChecked: false,
                brand: newItem.brand ?? null,
                quantity: newItem.quantity ?? null,
                price: newItem.price ?? null,
                category: null,
                isRecurrent: false,
                timestamp: Date.now(),
            };
            const res = await api.post<ApiListItem>(
                `/api/lists/${effectiveListId}/items`,
                payload,
            );

            const createdApiItem = res.data;
            const createdItem: Item = {
                id: createdApiItem.id,
                name: createdApiItem.name,
                checked: Boolean(createdApiItem.isChecked),
                brand: createdApiItem.brand,
                price: createdApiItem.price,
                quantity: createdApiItem.quantity,
                category: createdApiItem.category,
                isRecurrent: createdApiItem.isRecurrent,
                createdAt: createdApiItem.createdAt,
            };

            clearPendingMutation(newItem.id);
            await fetchListData(effectiveListId);

            const syncPayload: SyncPayload = {
                action: "ADD",
                itemId: createdItem.id,
                content: JSON.stringify({
                    ...createdItem,
                    createdAt: createdItem.createdAt,
                }),
                timestamp: Date.now(),
                senderId: clientInstanceId,
            };

            socketService.publish(
                "/app/list/" + effectiveListId + "/update",
                JSON.stringify(syncPayload),
            );
        } catch (err) {
            if (!navigator.onLine) {
                useStore.getState().enqueueAction({
                    id: crypto.randomUUID(),
                    type: "ADD_ITEM",
                    payload: {
                        listId: effectiveListId,
                        itemId: newItem.id,
                        name: newItem.name,
                        brand: newItem.brand,
                        quantity: newItem.quantity,
                        price: newItem.price,
                    },
                    timestamp: Date.now(),
                });
                return;
            }

            clearPendingMutation(newItem.id);
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "Failed to add the product.";
            console.error("addItem error:", err);
            setError(errorMessage);
            rollbackItem(newItem.id);
        }
    };

    /**
     * Toggles the checked status of an item and updates the server.
     */
    const toggleItem = async (itemId: string) => {
        if (!effectiveListId || effectiveListId === "default") return;
        const currentItem = items.find((item) => item.id === itemId);
        if (!currentItem) return;

        const newChecked = !currentItem.checked;
        markPendingMutation(itemId);
        const nextItems = items.map((item) =>
            item.id === itemId ? { ...item, checked: newChecked } : item,
        );
        setItems(nextItems);
        syncListItemsInStore(nextItems);

        try {
            const payload = {
                name: currentItem.name,
                isChecked: newChecked,
                brand: currentItem.brand ?? null,
                quantity: currentItem.quantity ?? null,
                price: currentItem.price ?? null,
                category: currentItem.category ?? null,
                isRecurrent: currentItem.isRecurrent ?? false,
                timestamp: Date.now(),
            };
            await api.put(`/api/items/${itemId}`, payload);

            const syncPayload: SyncPayload = {
                action: "CHECK_OFF",
                itemId,
                checked: newChecked,
                timestamp: Date.now(),
                senderId: clientInstanceId,
            };

            socketService.publish(
                "/app/list/" + effectiveListId + "/update",
                JSON.stringify(syncPayload),
            );
            clearPendingMutation(itemId);
        } catch (err) {
            if (!navigator.onLine) {
                useStore.getState().enqueueAction({
                    id: crypto.randomUUID(),
                    type: "TOGGLE_ITEM",
                    payload: {
                        listId: effectiveListId,
                        itemId,
                        checked: newChecked,
                        name: currentItem.name,
                        brand: currentItem.brand,
                        quantity: currentItem.quantity,
                        price: currentItem.price,
                        category: currentItem.category,
                        isRecurrent: currentItem.isRecurrent,
                    },
                    timestamp: Date.now(),
                });
                return;
            }

            clearPendingMutation(itemId);
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "Failed to update the product.";
            console.error("toggleItem error:", err);
            setError(errorMessage);
            revertItemChecked(itemId, currentItem.checked);
        }
    };

    /**
     * Deletes an item from the list and the server.
     */
    const deleteItem = async (itemId: string) => {
        if (!effectiveListId || effectiveListId === "default") return;
        markPendingMutation(itemId);
        const nextItems = items.filter((item) => item.id !== itemId);
        setItems(nextItems);
        syncListItemsInStore(nextItems);

        try {
            await api.delete(`/api/items/${itemId}`);

            const syncPayload: SyncPayload = {
                action: "DELETE",
                itemId,
                timestamp: Date.now(),
                senderId: clientInstanceId,
            };

            socketService.publish(
                "/app/list/" + effectiveListId + "/update",
                JSON.stringify(syncPayload),
            );
            clearPendingMutation(itemId);
        } catch (err) {
            if (!navigator.onLine) {
                useStore.getState().enqueueAction({
                    id: crypto.randomUUID(),
                    type: "DELETE_ITEM",
                    payload: {
                        listId: effectiveListId,
                        itemId,
                    },
                    timestamp: Date.now(),
                });
                return;
            }

            clearPendingMutation(itemId);
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "Failed to delete the product.";
            console.error("deleteItem error:", err);
            setError(errorMessage);
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
        handleAiImport,
        isReviewModalOpen,
        setIsReviewModalOpen,
        reviewItems,
        handleReviewConfirm,
    };
};

/**
 * Custom hook to manage user presence (JOIN, LEAVE, TYPING) via WebSocket.
 * Migrated to a server-authoritative roster model to fix late-arrival sync issues.
 */
const useListPresence = (effectiveListId: string | undefined) => {
    const { handlePresenceEvent, clearPresence } = usePresenceStore();
    const user = useStore((state) => state.user);
    const isServerConnected = useStore((state) => state.isServerConnected);
    const lastTypingSentRef = useRef<number>(0);

    const handlePresenceMessage = useCallback(
        (message: { body: string }) => {
            try {
                const event = JSON.parse(message.body);
                console.debug("[ws] presence received", event);
                handlePresenceEvent(event);
            } catch (err) {
                console.error("Failed to parse presence message:", err);
            }
        },
        [handlePresenceEvent]
    );

    useEffect(() => {
        if (
            !effectiveListId ||
            effectiveListId === "default" ||
            !isServerConnected
        ) {
            return;
        }
        const username = user?.email || "Anonymous";

        console.debug("[ws] subscribing list presence", effectiveListId);
        const presenceSubscription = stompClient.subscribe(
            `/topic/list/${effectiveListId}/presence`,
            handlePresenceMessage,
        );

        if (stompClient.connected) {
            const joinEvent = {
                eventType: "JOIN" as const,
                username,
                listId: effectiveListId,
            };
            
            // Notify server that we joined. 
            // The server will respond by broadcasting a ROSTER_UPDATE to all clients.
            stompClient.publish({
                destination: `/app/list/${effectiveListId}/presence`,
                body: JSON.stringify(joinEvent),
            });
            
            console.debug("[ws] sent presence JOIN", joinEvent);
        }

        return () => {
            if (stompClient.connected) {
                stompClient.publish({
                    destination: `/app/list/${effectiveListId}/presence`,
                    body: JSON.stringify({
                        eventType: "LEAVE",
                        username,
                        listId: effectiveListId,
                    }),
                });
                console.debug("[ws] sent presence LEAVE", username);
            }
            presenceSubscription?.unsubscribe();
            clearPresence();
        };
    }, [
        effectiveListId,
        handlePresenceEvent,
        clearPresence,
        user?.email,
        handlePresenceMessage,
        isServerConnected,
    ]);

    /**
     * Sends a typing event to the server to notify other connected users.
     */
    const sendTypingEvent = useCallback(() => {
        if (
            !effectiveListId ||
            effectiveListId === "default" ||
            !stompClient.connected
        )
            return;

        const now = Date.now();
        if (now - lastTypingSentRef.current > 1500) {
            const username = user?.email || "Anonymous";

            const typingEvent = {
                eventType: "TYPING" as const,
                username,
                listId: effectiveListId,
            };
            stompClient.publish({
                destination: `/app/list/${effectiveListId}/presence`,
                body: JSON.stringify(typingEvent),
            });
            lastTypingSentRef.current = now;
        }
    }, [effectiveListId, user?.email]);

    return { sendTypingEvent };
};

/**
 * Renders a view for selecting a list when no specific list is active.
 */
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

/** Component for the item name input field inside the add modal. */
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

/** Button to toggle the display of extra item details (price, brand, etc). */
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

/** Component containing the detailed input fields (quantity, price, brand). */
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

/** Modal component for adding an item with optional details. */
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

/** Component to display an error alert within the list detail view. */
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

/** Header component for the list detail view. */
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
                className="text-xs font-bold text-accent hover:underline uppercase"
            >
                Switch List
            </button>
        )}
    </header>
);

/** Inline form component for quickly adding items without details. */
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

/**
 * Main ListDetail component that orchestrates displaying items, managing presence, and handling item additions.
 */
const ListDetail = ({
    isEmbedded = false,
    listIdOverride,
    onSwitchList,
}: ListDetailProps) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const effectiveListId = listIdOverride ?? id;

    const [showShareModal, setShowShareModal] = useState(false);
    const { lists, isLoading: listsLoading, fetchLists } = useListsStore();

    const {
        items,
        isLoading: itemsLoading,
        error,
        syncFailed,
        addItem,
        toggleItem,
        deleteItem,
        setError,
        isReviewModalOpen,
        setIsReviewModalOpen,
        reviewItems,
        handleReviewConfirm,
    } = useListItems(effectiveListId);

    const { sendTypingEvent } = useListPresence(effectiveListId);

    const [newItemName, setNewItemName] = useState("");
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showMobileAddModal, setShowMobileAddModal] = useState(false);
    const [showExpandedDetails, setShowExpandedDetails] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [selectedTargetListId, setSelectedTargetListId] = useState("");
    const [selectedImportItemIds, setSelectedImportItemIds] = useState<
        Set<string>
    >(new Set());
    const [isImportingItems, setIsImportingItems] = useState(false);

    const [detailName, setDetailName] = useState("");
    const [detailQuantity, setDetailQuantity] = useState("");
    const [detailBrand, setDetailBrand] = useState("");
    const [detailPrice, setDetailPrice] = useState("");

    // Task 4 States
    const [isFinishing, setIsFinishing] = useState(false);
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [finishStoreName, setFinishStoreName] = useState("");
    const [receiptImage, setReceiptImage] = useState<File | null>(null);

    const [permissionStatus, setPermissionStatus] =
        useState<PermissionState | null>(null);
    const [showBanner, setShowBanner] = useState(true);

    const addInputRef = useRef<HTMLInputElement | null>(null);
    const activeList = useMemo(
        () => lists.find((list) => list.id === effectiveListId) ?? null,
        [effectiveListId, lists],
    );
    const normalLists = useMemo(
        () =>
            lists.filter(
                (list) =>
                    list.id !== effectiveListId &&
                    (list.category ?? "NORMAL") === "NORMAL",
            ),
        [effectiveListId, lists],
    );
    const canImportIntoNormalList =
        (activeList?.category === "RECIPE" ||
            activeList?.category === "FREQUENT") &&
        items.length > 0;

    const activeCollaborationUsers = useMemo(() => {
        const current = activeList;
        if (!current) return [];

        const users = new Set<string>();
        if (current.ownerEmail) users.add(current.ownerEmail);
        for (const email of current.collaboratorEmails || []) {
            users.add(email);
        }
        return Array.from(users);
    }, [activeList]);

    const estimatedTotal = useMemo(() => {
        return items
            .reduce((sum, item) => {
                /**
                 * Task 4: Fix miscomputation for strings like "500g"
                 * CodeRabbit: If the quantity is not purely numeric, count as 1.
                 */
                const qtyStr = (item.quantity || "1").trim();
                const qty = /^\d+(?:\.\d+)?$/.test(qtyStr)
                    ? Number.parseFloat(qtyStr)
                    : 1;
                return sum + (item.price || 0) * qty;
            }, 0)
            .toFixed(2);
    }, [items]);

    // Geolocation permission tracking
    useEffect(() => {
        let isMounted = true;
        let permResult: PermissionStatus | null = null;

        const handler = () => {
            if (isMounted && permResult) setPermissionStatus(permResult.state);
        };

        if (navigator.permissions) {
            navigator.permissions
                .query({ name: "geolocation" as PermissionName })
                .then((result) => {
                    if (!isMounted) return;
                    permResult = result;
                    setPermissionStatus(result.state);
                    result.addEventListener("change", handler);
                })
                .catch(() => {
                    // Fail silently for browsers with limited support
                });
        }

        return () => {
            isMounted = false;
            permResult?.removeEventListener("change", handler);
        };
    }, []);

    // Re-show banner if permission transitions to denied
    useEffect(() => {
        if (permissionStatus === "denied") {
            setShowBanner(true);
        }
    }, [permissionStatus]);

    useEffect(() => {
        if (lists.length === 0) {
            fetchLists();
        }
    }, [lists.length, fetchLists]);

    useEffect(() => {
        if (
            !showImportModal ||
            normalLists.length === 0 ||
            normalLists.some((list) => list.id === selectedTargetListId)
        ) {
            return;
        }

        setSelectedTargetListId(normalLists[0].id);
    }, [normalLists, selectedTargetListId, showImportModal]);

    const resetDetailFields = useCallback((_targetListId?: string) => {
        setShowDetailsModal(false);
        setShowMobileAddModal(false);
        setShowExpandedDetails(false);
        setNewItemName("");
        setDetailName("");
        setDetailQuantity("");
        setDetailBrand("");
        setDetailPrice("");
    }, []);

    useEffect(() => {
        resetDetailFields(effectiveListId);
    }, [effectiveListId, resetDetailFields]);

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

    const openImportModal = async () => {
        await fetchLists();
        const refreshedLists = useListsStore.getState().lists;
        const refreshedNormalLists = refreshedLists.filter(
            (list) =>
                list.id !== effectiveListId &&
                (list.category ?? "NORMAL") === "NORMAL",
        );

        if (refreshedNormalLists.length === 0) {
            setError("Create a normal list first, then try again.");
            return;
        }

        setSelectedTargetListId((currentId) =>
            refreshedNormalLists.some((list) => list.id === currentId)
                ? currentId
                : refreshedNormalLists[0].id,
        );
        setSelectedImportItemIds(new Set(items.map((item) => item.id)));
        setShowImportModal(true);
    };

    const toggleImportSelection = (itemId: string) => {
        setSelectedImportItemIds((prev) => {
            const next = new Set(prev);
            if (next.has(itemId)) {
                next.delete(itemId);
            } else {
                next.add(itemId);
            }
            return next;
        });
    };

    const clearImportState = () => {
        setShowImportModal(false);
        setSelectedImportItemIds(new Set());
        setIsImportingItems(false);
    };

    const handleImportIntoNormalList = async () => {
        if (!selectedTargetListId) return;

        const targetList = useListsStore
            .getState()
            .lists.find((list) => list.id === selectedTargetListId);
        if (!targetList) {
            setError("Target list could not be found.");
            return;
        }

        const existingKeys = new Set(
            targetList.items.map((item) => buildItemDuplicateKey(item)),
        );
        const itemsToImport = items.filter(
            (item) =>
                selectedImportItemIds.has(item.id) &&
                !existingKeys.has(buildItemDuplicateKey(item)),
        );

        if (itemsToImport.length === 0) {
            setError("All selected items already exist in the target list.");
            return;
        }

        setIsImportingItems(true);
        setError(null);

        try {
            for (const item of itemsToImport) {
                const added = await useListsStore
                    .getState()
                    .addItem(selectedTargetListId, {
                        name: item.name,
                        checked: false,
                        brand: item.brand,
                        quantity: item.quantity,
                        price: item.price,
                        category: item.category,
                        isRecurrent: targetList.category === "FREQUENT",
                    });

                if (!added) {
                    throw new Error(`Failed to add ${item.name}`);
                }
            }

            await fetchLists();
            clearImportState();
        } catch (importError) {
            const errorMessage =
                importError instanceof Error
                    ? importError.message
                    : "Failed to import the selected items.";
            setError(errorMessage);
            setIsImportingItems(false);
        }
    };

    const listContent = useMemo(() => {
        if (itemsLoading) {
            return (
                <div className="flex flex-col items-center justify-center gap-4 p-[60px_20px] text-text-muted">
                    <div className="w-8 h-8 border-[3px] border-border border-t-accent rounded-full animate-spin" />
                    <p>Loading...</p>
                </div>
            );
        }

        return (
            <div className="divide-y divide-border/50 h-full overflow-y-auto p-4 flex flex-col">
                <ShoppingListItems
                    items={items}
                    onCheck={toggleItem}
                    onDelete={deleteItem}
                    disabled={isReadOnly}
                />
                {items.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border flex flex-col bg-bg-muted/30 -mx-4 -mb-4 px-6 py-4 gap-4">
                        <div className="flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-text-muted uppercase tracking-widest">
                                    Estimated Total
                                </span>
                                <span className="text-xs text-text-muted opacity-70">
                                    {items.length} items
                                </span>
                            </div>
                            <span className="text-xl font-black text-accent tracking-tight">
                                {estimatedTotal} lei
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowFinishModal(true)}
                            className="w-full py-3.5 bg-accent text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
                        >
                            Finish Shopping
                        </button>
                    </div>
                )}
            </div>
        );
    }, [
        itemsLoading,
        items,
        toggleItem,
        deleteItem,
        isReadOnly,
        estimatedTotal,
    ]);

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
                        onSwitchList={
                            onSwitchList ?? (() => navigate("/nav/default"))
                        }
                    />
                )}

                {error && (
                    <ListErrorAlert error={error} isEmbedded={isEmbedded} />
                )}

                {showBanner && permissionStatus === "denied" && (
                    <div className="bg-warning-subtle text-warning-strong border border-warning-border p-4 rounded-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-300 mb-2">
                        <div className="flex items-center gap-3">
                            <AlertCircle size={20} className="shrink-0" />
                            <span className="text-sm font-medium">
                                Location access is disabled. Some features may
                                be limited.
                            </span>
                        </div>
                        <button
                            type="button"
                            className="text-text-muted hover:text-text-strong transition-colors p-1"
                            onClick={() => setShowBanner(false)}
                            aria-label="Close warning"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {effectiveListId === "default" && isEmbedded ? (
                    <ListSelectionView
                        lists={lists}
                        isLoading={listsLoading}
                        onSelect={(listId) => navigate(`/nav/${listId}`)}
                    />
                ) : (
                    <>
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-end px-1">
                                <div className="flex flex-col">
                                    <h2 className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] mb-0.5">
                                        Collaboration
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <PresenceBar
                                            variant="avatars"
                                            allUsers={activeCollaborationUsers}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-wrap justify-end gap-2">
                                    {canImportIntoNormalList && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                void openImportModal();
                                            }}
                                            className="inline-flex items-center gap-2 px-3.5 py-2 bg-bg-muted text-text-strong border border-border rounded-lg text-xs font-bold transition-all hover:border-accent hover:text-accent"
                                        >
                                            <Plus size={14} strokeWidth={2.5} />
                                            Add to normal list
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setShowShareModal(true)}
                                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-accent-subtle text-accent border border-accent-border/30 rounded-lg text-xs font-bold transition-all hover:bg-accent hover:text-white hover:-translate-y-px shadow-sm active:translate-y-0"
                                    >
                                        <UserPlus size={14} strokeWidth={2.5} />
                                        Invite
                                    </button>
                                </div>
                            </div>

                            <InlineAddForm
                                addInputRef={addInputRef}
                                newItemName={newItemName}
                                onNameChange={handleNewItemNameChange}
                                onSubmit={handleInlineAdd}
                                onOpenDetails={openDetailsModal}
                                isReadOnly={isReadOnly}
                                isEmbedded={isEmbedded}
                            />

                            <div className="min-h-[16px] px-2 flex items-center">
                                <PresenceBar variant="typing" />
                            </div>
                        </div>

                        <div className="bg-surface border border-border rounded-xl shadow-sm min-h-[120px] overflow-hidden flex-1">
                            {listContent}
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

            {/* Finish Shopping Modal */}
            <Modal
                isOpen={showFinishModal}
                onClose={() => setShowFinishModal(false)}
                title="Finish Shopping"
                subtitle="Enter store and take a photo of your receipt."
            >
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="store-name-input"
                            className="text-[11px] font-black uppercase text-text-strong tracking-wider"
                        >
                            Store Name
                        </label>
                        <input
                            id="store-name-input"
                            type="text"
                            value={finishStoreName}
                            onChange={(e) => setFinishStoreName(e.target.value)}
                            placeholder="e.g. Lidl"
                            className="p-3 bg-bg-muted border border-border rounded-xl outline-none focus:border-accent"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-black uppercase text-text-strong tracking-wider">
                            Receipt Photo
                        </span>
                        <div className="relative">
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                id="receipt-cam"
                                className="hidden"
                                onChange={(e) =>
                                    setReceiptImage(e.target.files?.[0] || null)
                                }
                            />
                            <label
                                htmlFor="receipt-cam"
                                className={`flex flex-col items-center gap-3 p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${receiptImage ? "border-accent bg-accent-subtle text-accent" : "border-border text-text-muted hover:border-accent"}`}
                            >
                                <Camera size={28} />
                                <span className="text-sm font-black">
                                    {receiptImage
                                        ? receiptImage.name
                                        : "TAKE PHOTO"}
                                </span>
                                <span className="text-xs uppercase font-bold opacity-50">
                                    Click to open camera
                                </span>
                            </label>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        <button
                            type="button"
                            onClick={() => setShowFinishModal(false)}
                            className="py-3 bg-bg-muted rounded-lg font-bold"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={
                                !finishStoreName.trim() ||
                                isFinishing ||
                                !effectiveListId ||
                                effectiveListId === "default"
                            }
                            onClick={async () => {
                                if (
                                    !effectiveListId ||
                                    effectiveListId === "default"
                                )
                                    return;
                                setIsFinishing(true);
                                try {
                                    await finishShoppingRequest({
                                        storeName: finishStoreName.trim(),
                                        receiptImage,
                                        listId: effectiveListId,
                                    });
                                    setShowFinishModal(false);
                                    setFinishStoreName("");
                                    setReceiptImage(null);
                                    navigate("/dashboard");
                                } catch (_err) {
                                    const errorMessage =
                                        _err instanceof Error
                                            ? _err.message
                                            : "Failed to complete shopping.";
                                    console.error(
                                        "Failed to complete shopping:",
                                        _err,
                                    );
                                    setError(errorMessage);
                                } finally {
                                    setIsFinishing(false);
                                }
                            }}
                            className="bg-text-strong text-bg py-3 rounded-lg font-bold disabled:opacity-50 transition-all active:scale-95"
                        >
                            {isFinishing ? "Processing..." : "Complete"}
                        </button>
                    </div>
                </div>
            </Modal>

            <SmartReviewModal
                isOpen={isReviewModalOpen}
                onClose={() => setIsReviewModalOpen(false)}
                items={reviewItems}
                onConfirm={handleReviewConfirm}
            />

            <ImportItemsModal
                isOpen={showImportModal}
                onClose={clearImportState}
                title="Add items to a normal list"
                subtitle={`Copy items from "${activeList?.name || "Shopping List"}" without duplicating products that already exist.`}
                sourceItems={items}
                availableTargetLists={normalLists}
                selectedTargetListId={selectedTargetListId}
                onTargetListChange={setSelectedTargetListId}
                selectedItemIds={selectedImportItemIds}
                onToggleItem={toggleImportSelection}
                onSelectAllEligible={(itemIds) =>
                    setSelectedImportItemIds(new Set(itemIds))
                }
                onClearSelection={() => setSelectedImportItemIds(new Set())}
                onConfirm={() => {
                    void handleImportIntoNormalList();
                }}
                isSubmitting={isImportingItems}
                submitLabel="Import selected"
                submittingLabel="Importing..."
            />

            {showShareModal && (
                <ShareListModal
                    listId={effectiveListId ?? ""}
                    listName={
                        lists.find((l) => l.id === effectiveListId)?.name ||
                        "Shopping List"
                    }
                    onClose={() => setShowShareModal(false)}
                />
            )}
        </div>
    );
};

export default ListDetail;
