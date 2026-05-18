import {
    AlertCircle,
    Camera,
    CheckCircle2,
    ChevronDown,
    Plus,
    Settings,
    Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
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
import type { ProductSuggestion } from "../../services/api";
import api, {
    aiMultimodalRequest,
    fetchProductSuggestions,
} from "../../services/api";
import stompClient from "../../services/socketService";
import { useListsStore } from "../../store/useListsStore";
import type { ListCategory } from "../../types";

import ListMembersModal from "../Dashboard/ListMembersModal";
import { useFinishShopping } from "./useFinishShopping";
import { useImportItems } from "./useImportItems";
import { useListPageEffects } from "./useListPageEffects";

interface Item {
    id: string;
    name: string;
    checked: boolean;
    brand?: string;
    quantity?: string;
    price?: number;
    category?: string;
    isRecurrent?: boolean;
    positionIndex?: number;
    claimedBy?: string;
    claimedAt?: number;
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
    positionIndex?: number;
    claimedBy?: string;
    claimedAt?: number;
}

interface ApiShoppingList {
    id: string;
    category?: ListCategory;
    items?: ApiListItem[];
    ownerEmail?: string;
    collaborators?: import("../../types").CollaboratorInfo[];
}

interface ListDetailProps {
    isEmbedded?: boolean;
    listIdOverride?: string;
}

type SyncActionHandler = (prev: Item[], payload: SyncPayload) => Item[];

const handleCheckOff: SyncActionHandler = (prev, payload) => {
    if (!payload.itemId) return prev;
    return prev.map((item) =>
        item.id === payload.itemId
            ? { ...item, checked: Boolean(payload.checked) }
            : item,
    );
};

const handleUpdate: SyncActionHandler = (prev, payload) => {
    if (!payload.itemId || !payload.content) return prev;
    try {
        const updated = JSON.parse(payload.content) as Item;
        return prev.map((item) =>
            item.id === payload.itemId ? { ...item, ...updated } : item,
        );
    } catch (e) {
        console.error("Failed to parse incoming UPDATE item JSON", e);
    }
    return prev;
};

const handleDelete: SyncActionHandler = (prev, payload) => {
    if (!payload.itemId) return prev;
    return prev.filter((item) => item.id !== payload.itemId);
};

const handleBulkDelete: SyncActionHandler = (prev, payload) => {
    if (!payload.itemIds) return prev;
    const deletedIds = new Set(payload.itemIds);
    return prev.filter((item) => !deletedIds.has(item.id));
};

const handleAdd: SyncActionHandler = (prev, payload) => {
    if (!payload.content) return prev;
    try {
        const newItem = JSON.parse(payload.content) as Item;
        if (!prev.some((i) => i.id === newItem.id)) {
            return [...prev, newItem];
        }
    } catch (e) {
        console.error("Failed to parse incoming ADD item JSON", e);
    }
    return prev;
};

const handleClaim: SyncActionHandler = (prev, payload) => {
    if (!payload.itemId) return prev;
    let claimedBy = payload.claimedBy;
    let claimedAt = payload.timestamp;
    if (payload.content) {
        try {
            const parsed = JSON.parse(payload.content) as Partial<Item>;
            claimedBy = parsed.claimedBy ?? claimedBy;
            claimedAt = parsed.claimedAt ?? claimedAt;
        } catch {
            console.debug(
                "Failed to parse claim content JSON, using top-level values",
            );
        }
    }
    return prev.map((item) =>
        item.id === payload.itemId ? { ...item, claimedBy, claimedAt } : item,
    );
};

const handleUnclaim: SyncActionHandler = (prev, payload) => {
    if (!payload.itemId) return prev;
    return prev.map((item) =>
        item.id === payload.itemId
            ? { ...item, claimedBy: undefined, claimedAt: undefined }
            : item,
    );
};

const SYNC_ACTION_HANDLERS: Record<string, SyncActionHandler> = {
    CHECK_OFF: handleCheckOff,
    UPDATE: handleUpdate,
    DELETE: handleDelete,
    BULK_DELETE: handleBulkDelete,
    ADD: handleAdd,
    CLAIM_ITEM: handleClaim,
    UNCLAIM_ITEM: handleUnclaim,
};

const useListItems = (effectiveListId: string | undefined) => {
    const { updateList } = useListsStore();
    const [items, setItems] = useState<Item[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncFailed, setSyncFailed] = useState(false);
    const [authFailed, setAuthFailed] = useState(false);
    const isServerConnected = useStore((state) => state.isServerConnected);

    const itemsRef = useRef(items);
    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    const pendingSyncItems = useRef(new Set<string>());
    const lastSyncTimestamp = useRef<number>(0);

    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);

    /**
     * Retrieves the base URL for API requests.
     */
    const getBaseUrl = useCallback(() => {
        const base =
            import.meta.env.VITE_API_URL ||
            import.meta.env.VITE_API_BASE_URL ||
            "http://localhost:8081";
        return base === "/" ? "" : base;
    }, []);

    /**
     * Constructs the necessary headers for authentication and content type.
     */
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

    const handleUnauthorizedResponse = useCallback(() => {
        useStore.getState().setAuth(null);
        setAuthFailed(true);
    }, []);

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
                    positionIndex: item.positionIndex,
                    claimedBy: item.claimedBy,
                    claimedAt: item.claimedAt,
                }));
                setItems(mappedItems);
                if (
                    currentList.category ||
                    currentList.ownerEmail ||
                    currentList.collaborators
                ) {
                    useListsStore.getState().updateList(targetListId, {
                        category: currentList.category,
                        ownerEmail: currentList.ownerEmail,
                        collaborators: currentList.collaborators,
                    });
                }
                syncListItemsInStore(mappedItems, targetListId);
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
        [syncListItemsInStore, effectiveListId],
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
                const res = await fetch(
                    `${getBaseUrl()}/api/lists/${effectiveListId}/items`,
                    {
                        method: "POST",
                        headers: getAuthHeaders(true),
                        body: JSON.stringify({
                            name: item.name,
                            isChecked: false,
                            brand: item.brand?.trim()
                                ? item.brand.trim()
                                : null,
                            quantity: item.quantity?.trim()
                                ? item.quantity.trim()
                                : null,
                            category: item.category || null,
                            timestamp: Date.now(),
                        }),
                        credentials: "include",
                    },
                );

                if (!res.ok) {
                    if (res.status === 401) {
                        handleUnauthorizedResponse();
                    }
                    throw new Error(`Failed to save item: ${item.name}`);
                }
            }
            await fetchListData(effectiveListId);
            setIsReviewModalOpen(false);
        } catch (err) {
            console.error("handleReviewConfirm error:", err);
            setError("Error saving some items. Please check your list.");
            await fetchListData(effectiveListId);
        }
    };

    const applySyncAction = useCallback(
        (prev: Item[], payload: SyncPayload): Item[] => {
            const handler = SYNC_ACTION_HANDLERS[payload.action];
            if (!handler) return prev;
            return handler(prev, payload);
        },
        [],
    );

    const handleSyncMessage = useCallback(
        (message: { body: string }) => {
            try {
                const payload = JSON.parse(message.body) as SyncPayload;

                if (payload.status === "Rejection") {
                    const itemId = payload.itemId;
                    if (
                        itemId &&
                        pendingSyncItems.current.has(itemId) &&
                        payload.action !== "ADD"
                    ) {
                        pendingSyncItems.current.delete(itemId);
                        const item = itemsRef.current.find(
                            (i) => i.id === itemId,
                        );
                        toast.error("Conflict Warning", {
                            description: `Conflict detected for "${item?.name || "an item"}". Your change was reverted because another user made a more recent update.`,
                            duration: 4000,
                        });
                    }
                    return;
                }

                setItems((prev) => {
                    const next = applySyncAction(prev, payload);
                    if (next !== prev) {
                        syncListItemsInStore(next);
                    }
                    return next;
                });
            } catch (err) {
                console.error("Failed to parse sync message:", err);
            }
        },
        [applySyncAction, syncListItemsInStore],
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
        const updateSubscription = stompClient.subscribe(
            `/topic/list/${effectiveListId}`,
            handleSyncMessage,
        );

        return () => {
            updateSubscription?.unsubscribe();
        };
    }, [effectiveListId, handleSyncMessage, isServerConnected]);

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

    const buildItemPayload = (item: Item, overrides?: Partial<Item>) => ({
        name: overrides?.name ?? item.name,
        isChecked: overrides?.checked ?? item.checked,
        brand: overrides?.brand ?? item.brand ?? null,
        quantity: overrides?.quantity ?? item.quantity ?? null,
        price: overrides?.price ?? item.price ?? null,
        category: overrides?.category ?? item.category ?? null,
        isRecurrent: overrides?.isRecurrent ?? item.isRecurrent ?? false,
        positionIndex:
            overrides?.positionIndex ?? item.positionIndex ?? undefined,
        timestamp: Date.now(),
    });

    const publishSync = useCallback(
        (action: SyncPayload["action"], item: Item) => {
            if (!effectiveListId || !stompClient.connected) return;

            let timestamp = Date.now();
            if (timestamp <= lastSyncTimestamp.current) {
                timestamp = lastSyncTimestamp.current + 1;
            }
            lastSyncTimestamp.current = timestamp;

            pendingSyncItems.current.add(item.id);
            stompClient.publish({
                destination: `/app/list/${effectiveListId}/update`,
                body: JSON.stringify({
                    action,
                    itemId: item.id,
                    content: JSON.stringify(item),
                    timestamp,
                }),
            });
        },
        [effectiveListId],
    );

    const restoreItem = useCallback(
        (itemToRestore: Item) => {
            setItems((prev) => {
                if (prev.some((i) => i.id === itemToRestore.id)) return prev;
                const restored = [...prev, itemToRestore];
                syncListItemsInStore(restored);
                // Dacă ștergerea a eșuat pe server sau s-a dat Undo, re-difuzăm adăugarea
                publishSync("ADD", itemToRestore);
                return restored;
            });
        },
        [syncListItemsInStore, publishSync],
    );

    const restoreItems = useCallback(
        (itemsToRestore: Item[]) => {
            setItems((prev) => {
                const existingIds = new Set(prev.map((i) => i.id));
                const newItems = itemsToRestore.filter(
                    (i) => !existingIds.has(i.id),
                );
                if (newItems.length === 0) return prev;
                const restored = [...prev, ...newItems];
                syncListItemsInStore(restored);
                for (const item of newItems) {
                    publishSync("ADD", item);
                }
                return restored;
            });
        },
        [syncListItemsInStore, publishSync],
    );

    const createNewItem = async (
        listId: string,
        name: string,
        quantity?: string,
        brand?: string,
        price?: number,
    ) => {
        const newItem: Item = {
            id: crypto.randomUUID(),
            name: name.trim(),
            checked: false,
            brand: brand || undefined,
            quantity: quantity || undefined,
            price: price ?? undefined,
            positionIndex: Date.now(), // Fallback optimistic position
        };

        const optimisticItems = [...items, newItem];
        setItems(optimisticItems);
        syncListItemsInStore(optimisticItems);

        try {
            const res = await api.post<ApiListItem>(
                `/api/lists/${listId}/items`,
                buildItemPayload(newItem),
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
                positionIndex: createdApiItem.positionIndex,
            };

            await fetchListData(listId);
            publishSync("ADD", createdItem);
        } catch (err) {
            if (!navigator.onLine) {
                useStore.getState().enqueueAction({
                    id: crypto.randomUUID(),
                    type: "ADD_ITEM",
                    payload: {
                        listId,
                        itemId: newItem.id,
                        name: newItem.name,
                        brand: newItem.brand,
                        quantity: newItem.quantity,
                        price: newItem.price,
                        positionIndex: newItem.positionIndex,
                    },
                    timestamp: Date.now(),
                });
                return;
            }
            console.error("addItem error:", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to add the product.",
            );
            rollbackItem(newItem.id);
        }
    };

    const addItem = async (
        name: string,
        quantity?: string,
        brand?: string,
        price?: number,
    ) => {
        if (!effectiveListId || effectiveListId === "default") return;
        if (!name.trim()) return;

        await createNewItem(effectiveListId, name, quantity, brand, price);
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
            let timestamp = Date.now();
            if (timestamp <= lastSyncTimestamp.current) {
                timestamp = lastSyncTimestamp.current + 1;
            }
            lastSyncTimestamp.current = timestamp;

            const payload = {
                name: currentItem.name,
                isChecked: newChecked,
                brand: currentItem.brand ?? null,
                quantity: currentItem.quantity ?? null,
                price: currentItem.price ?? null,
                category: currentItem.category ?? null,
                isRecurrent: currentItem.isRecurrent ?? false,
                positionIndex: currentItem.positionIndex ?? null,
                timestamp,
            };
            await api.put(`/api/items/${itemId}`, payload);

            if (effectiveListId && stompClient.connected) {
                pendingSyncItems.current.add(itemId);
                const syncPayload: SyncPayload = {
                    action: "CHECK_OFF",
                    itemId,
                    checked: newChecked,
                    timestamp,
                };
                stompClient.publish({
                    destination: `/app/list/${effectiveListId}/update`,
                    body: JSON.stringify(syncPayload),
                });
            }
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
     * Optimistically deletes an item with a 5-second Undo window.
     * Falls back to offline queue if the permanent deletion fails.
     */
    const deleteItem = async (itemId: string) => {
        if (!effectiveListId || effectiveListId === "default") return;

        const itemToDelete = items.find((item) => item.id === itemId);
        if (!itemToDelete) return;

        // 1. Ștergere optimistă
        const nextItems = items.filter((item) => item.id !== itemId);
        setItems(nextItems);
        syncListItemsInStore(nextItems);

        // 2. Broadcast imediat al ștergerii (shallow delete)
        publishSync("DELETE", itemToDelete);

        const timerId = setTimeout(async () => {
            try {
                const res = await fetch(`${getBaseUrl()}/api/items/${itemId}`, {
                    method: "DELETE",
                    headers: getAuthHeaders(),
                    credentials: "include",
                });

                if (!res.ok) {
                    if (res.status === 401) {
                        handleUnauthorizedResponse();
                        return;
                    }
                    throw new Error(`Failed to delete item (${res.status})`);
                }

                // Notă: Broadcast-ul de DELETE a fost trimis deja la pasul 2.
            } catch (err) {
                console.error("deleteItem error:", err);

                if (!navigator.onLine) {
                    useStore.getState().enqueueAction({
                        id: crypto.randomUUID(),
                        type: "DELETE_ITEM",
                        payload: { listId: effectiveListId, itemId },
                        timestamp: Date.now(),
                    });
                    return;
                }

                restoreItem(itemToDelete);
            }
        }, 5000);

        toast("Item deleted.", {
            duration: 5000,
            action: {
                label: "Undo",
                onClick: () => {
                    clearTimeout(timerId);
                    restoreItem(itemToDelete);
                },
            },
        });
    };

    const clearCompletedItems = async () => {
        if (!effectiveListId || effectiveListId === "default") return;

        const checkedItems = items.filter((item) => item.checked);
        if (checkedItems.length === 0) return;

        const nextItems = items.filter((item) => !item.checked);
        setItems(nextItems);
        syncListItemsInStore(nextItems);

        const deletedIds = checkedItems.map((item) => item.id);

        if (effectiveListId && stompClient.connected) {
            stompClient.publish({
                destination: `/app/list/${effectiveListId}/update`,
                body: JSON.stringify({
                    action: "BULK_DELETE",
                    itemIds: deletedIds,
                    timestamp: Date.now(),
                }),
            });
        }

        const timerId = setTimeout(async () => {
            try {
                await api.delete<{ deletedItemIds: string[] }>(
                    `/api/lists/${effectiveListId}/items/completed`,
                );
            } catch (err) {
                console.error("clearCompletedItems error:", err);

                if (!navigator.onLine) {
                    useStore.getState().enqueueAction({
                        id: crypto.randomUUID(),
                        type: "CLEAR_COMPLETED",
                        payload: { listId: effectiveListId },
                        timestamp: Date.now(),
                    });
                    return;
                }

                restoreItems(checkedItems);
                const errorMessage =
                    err instanceof Error
                        ? err.message
                        : "Failed to clear completed items.";
                setError(errorMessage);
                fetchListData(effectiveListId);
            }
        }, 5000);

        const count = checkedItems.length;
        toast(`Cleared ${count} completed item${count === 1 ? "" : "s"}.`, {
            duration: 5000,
            action: {
                label: "Undo",
                onClick: () => {
                    clearTimeout(timerId);
                    restoreItems(checkedItems);
                },
            },
        });
    };

    const reorderItem = async (reorderedItems: Item[], movedItem: Item) => {
        if (!effectiveListId || effectiveListId === "default") return;
        setItems(reorderedItems);
        syncListItemsInStore(reorderedItems);

        try {
            let timestamp = Date.now();
            if (timestamp <= lastSyncTimestamp.current) {
                timestamp = lastSyncTimestamp.current + 1;
            }
            lastSyncTimestamp.current = timestamp;

            const payload = buildItemPayload(movedItem, {
                positionIndex: movedItem.positionIndex,
            });
            const finalPayload = { ...payload, timestamp };
            await api.put(`/api/items/${movedItem.id}`, finalPayload);

            publishSync("UPDATE", movedItem);
        } catch (err) {
            console.error("reorderItem error:", err);
            // Optionally could rollback if needed, but keeping it optimistic for drag and drop
            fetchListData(effectiveListId); // Refetch to sync state
        }
    };

    const claimItem = useCallback(
        (itemId: string) => {
            const currentUser = useStore.getState().user;
            if (
                !currentUser?.email ||
                !effectiveListId ||
                !stompClient.connected
            )
                return;
            const claimedBy = currentUser.email;

            setItems((prev) => {
                const next = prev.map((item) =>
                    item.id === itemId
                        ? { ...item, claimedBy, claimedAt: Date.now() }
                        : item,
                );
                syncListItemsInStore(next);
                return next;
            });

            const item = items.find((i) => i.id === itemId);
            if (!item) return;

            const updatedItem = { ...item, claimedBy, claimedAt: Date.now() };
            let timestamp = Date.now();
            if (timestamp <= lastSyncTimestamp.current) {
                timestamp = lastSyncTimestamp.current + 1;
            }
            lastSyncTimestamp.current = timestamp;

            pendingSyncItems.current.add(itemId);
            stompClient.publish({
                destination: `/app/list/${effectiveListId}/update`,
                body: JSON.stringify({
                    action: "CLAIM_ITEM",
                    itemId,
                    claimedBy,
                    content: JSON.stringify(updatedItem),
                    timestamp,
                }),
            });
        },
        [effectiveListId, items, syncListItemsInStore],
    );

    const unclaimItem = useCallback(
        (itemId: string) => {
            const currentUser = useStore.getState().user;
            if (
                !currentUser?.email ||
                !effectiveListId ||
                !stompClient.connected
            )
                return;

            setItems((prev) => {
                const next = prev.map((item) =>
                    item.id === itemId
                        ? {
                              ...item,
                              claimedBy: undefined,
                              claimedAt: undefined,
                          }
                        : item,
                );
                syncListItemsInStore(next);
                return next;
            });

            const item = items.find((i) => i.id === itemId);
            if (!item) return;

            const updatedItem = {
                ...item,
                claimedBy: undefined,
                claimedAt: undefined,
            };
            let timestamp = Date.now();
            if (timestamp <= lastSyncTimestamp.current) {
                timestamp = lastSyncTimestamp.current + 1;
            }
            lastSyncTimestamp.current = timestamp;

            pendingSyncItems.current.add(itemId);
            stompClient.publish({
                destination: `/app/list/${effectiveListId}/update`,
                body: JSON.stringify({
                    action: "UNCLAIM_ITEM",
                    itemId,
                    claimedBy: null,
                    content: JSON.stringify(updatedItem),
                    timestamp,
                }),
            });
        },
        [effectiveListId, items, syncListItemsInStore],
    );

    return {
        items,
        isLoading,
        error,
        syncFailed,
        authFailed,
        addItem,
        toggleItem,
        deleteItem,
        clearCompletedItems,
        reorderItem,
        claimItem,
        unclaimItem,
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
        [handlePresenceEvent],
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
        const displayName =
            user?.firstName?.trim() || user?.email?.split("@")[0] || undefined;

        console.debug("[ws] subscribing list presence", effectiveListId);
        const presenceSubscription = stompClient.subscribe(
            `/topic/list/${effectiveListId}/presence`,
            handlePresenceMessage,
        );

        const membersSubscription = stompClient.subscribe(
            `/topic/lists/${effectiveListId}/members`,
            () => {
                useListsStore.getState().fetchLists();
            },
        );

        if (stompClient.connected) {
            const joinEvent = {
                eventType: "JOIN" as const,
                username,
                displayName,
                listId: effectiveListId,
            };

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
                        displayName,
                        listId: effectiveListId,
                    }),
                });
                console.debug("[ws] sent presence LEAVE", username);
            }
            presenceSubscription?.unsubscribe();
            membersSubscription?.unsubscribe();
            clearPresence();
        };
    }, [
        effectiveListId,
        clearPresence,
        user,
        handlePresenceMessage,
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
            const username = user?.email || "Anonymous";
            const displayName =
                user?.firstName?.trim() ||
                user?.email?.split("@")[0] ||
                undefined;

            const typingEvent = {
                eventType: "TYPING" as const,
                username,
                displayName,
                listId: effectiveListId,
            };
            stompClient.publish({
                destination: `/app/list/${effectiveListId}/presence`,
                body: JSON.stringify(typingEvent),
            });
            lastTypingSentRef.current = now;
        }
    }, [effectiveListId, user]);

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

/**
 * Custom hook to extract duplicate Autocomplete logic.
 */
const useProductAutocomplete = (
    inputValue: string,
    onSuggestionSelect: (suggestion: ProductSuggestion) => void,
    isDisabled: boolean = false,
) => {
    const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    useEffect(() => {
        if (!inputValue.trim() || isDisabled) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        let isMounted = true;

        const timerId = setTimeout(async () => {
            try {
                const results = await fetchProductSuggestions(inputValue);
                if (isMounted) {
                    setSuggestions(results);
                    setShowSuggestions(true);
                    setActiveIndex(-1);
                }
            } catch (error) {
                if (isMounted)
                    console.error("Eroare la fetch sugestii:", error);
            }
        }, 300);

        return () => {
            isMounted = false;
            clearTimeout(timerId);
        };
    }, [inputValue, isDisabled]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (!showSuggestions || suggestions.length === 0) return;
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((prev) =>
                    prev < suggestions.length - 1 ? prev + 1 : prev,
                );
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
            } else if (e.key === "Enter" && activeIndex >= 0) {
                e.preventDefault();
                onSuggestionSelect(suggestions[activeIndex]);
                setShowSuggestions(false);
                setActiveIndex(-1);
            } else if (e.key === "Escape") {
                setShowSuggestions(false);
            }
        },
        [activeIndex, onSuggestionSelect, showSuggestions, suggestions],
    );

    const selectSuggestion = useCallback(
        (suggestion: ProductSuggestion) => {
            onSuggestionSelect(suggestion);
            setShowSuggestions(false);
            setActiveIndex(-1);
        },
        [onSuggestionSelect],
    );

    return {
        suggestions,
        showSuggestions,
        setShowSuggestions,
        activeIndex,
        handleKeyDown,
        selectSuggestion,
    };
};

/**
 * Shared Dropdown Component to fix Code Duplication
 */
const SuggestionsDropdown = ({
    showSuggestions,
    suggestions,
    activeIndex,
    onSelect,
}: {
    showSuggestions: boolean;
    suggestions: ProductSuggestion[];
    activeIndex: number;
    onSelect: (suggestion: ProductSuggestion) => void;
}) => {
    if (!showSuggestions || suggestions.length === 0) return null;

    return (
        <ul className="absolute top-[100%] left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto p-0 list-none">
            {suggestions.map((suggestion, index) => (
                <li key={suggestion.name}>
                    <button
                        type="button"
                        className={`w-full text-left px-4 py-3 flex justify-between items-center text-sm font-medium text-text-strong cursor-pointer outline-none focus:bg-bg-muted border-b border-border/50 last:border-0 transition-colors ${
                            index === activeIndex
                                ? "bg-bg-muted"
                                : "hover:bg-bg-muted"
                        }`}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onSelect(suggestion);
                        }}
                    >
                        <span className="font-bold">{suggestion.name}</span>
                        <div className="flex items-center gap-3 text-[11px]">
                            {suggestion.brand && (
                                <span className="text-text-muted uppercase opacity-70 tracking-wider">
                                    {suggestion.brand}
                                </span>
                            )}
                            {suggestion.price !== null &&
                                suggestion.price !== undefined && (
                                    <span className="font-black text-accent bg-accent-subtle px-2 py-1 rounded-md">
                                        {suggestion.price} lei
                                    </span>
                                )}
                        </div>
                    </button>
                </li>
            ))}
        </ul>
    );
};

/** Component for the item name input field inside the add modal, with Autocomplete. */
const ItemNameField = ({
    idPrefix,
    value,
    onChange,
    onTyping,
    isMobile,
    setQuantity,
    setBrand,
    setPrice,
}: {
    idPrefix: string;
    value: string;
    onChange: (val: string) => void;
    onTyping?: () => void;
    isMobile: boolean;
    setQuantity: (val: string) => void;
    setBrand: (val: string) => void;
    setPrice: (val: string) => void;
}) => {
    const handleSelect = useCallback(
        (suggestion: ProductSuggestion) => {
            onChange(suggestion.name);
            if (suggestion.brand) setBrand(suggestion.brand);
            if (suggestion.price !== undefined && suggestion.price !== null) {
                setPrice(String(suggestion.price));
            } else {
                setPrice("");
            }
            if (suggestion.quantity) {
                setQuantity(suggestion.quantity);
            } else {
                setQuantity("1");
            }
        },
        [onChange, setBrand, setPrice, setQuantity],
    );

    const {
        suggestions,
        showSuggestions,
        setShowSuggestions,
        activeIndex,
        handleKeyDown,
        selectSuggestion,
    } = useProductAutocomplete(value, handleSelect, false);

    return (
        <div className="flex flex-col gap-1.5 relative">
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
                onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onBlur={() => setShowSuggestions(false)}
                onKeyDown={handleKeyDown}
                placeholder={isMobile ? "e.g. Milk" : "e.g., Milk"}
                required
                autoComplete="off"
                className="w-full px-3.5 py-2.5 bg-bg-muted border-1.5 border-border rounded-md text-base text-text-strong outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)] transition-all"
            />

            <SuggestionsDropdown
                showSuggestions={showSuggestions}
                suggestions={suggestions}
                activeIndex={activeIndex}
                onSelect={selectSuggestion}
            />
        </div>
    );
};

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
                    setQuantity={setQuantity}
                    setBrand={setBrand}
                    setPrice={setPrice}
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

/** Inline form component for quickly adding items without details. ACUM CU MEMORIE PENTRU AUTO-FILL! */
const InlineAddForm = ({
    addInputRef,
    newItemName,
    onNameChange,
    onSubmit,
    onOpenDetails,
    isReadOnly,
    isEmbedded,
    onAddFullItem,
}: {
    addInputRef: React.RefObject<HTMLInputElement | null>;
    newItemName: string;
    onNameChange: (val: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onOpenDetails: (suggestion?: ProductSuggestion | null) => void;
    isReadOnly: boolean;
    isEmbedded: boolean;
    onAddFullItem: (suggestion: ProductSuggestion) => void;
}) => {
    const [selectedSuggestion, setSelectedSuggestion] =
        useState<ProductSuggestion | null>(null);

    const handleSelect = useCallback(
        (suggestion: ProductSuggestion) => {
            onNameChange(suggestion.name);
            setSelectedSuggestion(suggestion);
        },
        [onNameChange],
    );

    const {
        suggestions,
        showSuggestions,
        setShowSuggestions,
        activeIndex,
        handleKeyDown,
        selectSuggestion,
    } = useProductAutocomplete(newItemName, handleSelect, isReadOnly);

    const handleKeyDownWithOverride = (
        e: React.KeyboardEvent<HTMLInputElement>,
    ) => {
        if (e.key === "Enter" && activeIndex >= 0) {
            e.preventDefault();
            onAddFullItem(suggestions[activeIndex]);
            setShowSuggestions(false);
        } else {
            handleKeyDown(e);
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemName.trim()) return;

        if (selectedSuggestion?.name === newItemName) {
            onAddFullItem(selectedSuggestion);
        } else {
            onSubmit(e);
        }
        setSelectedSuggestion(null);
    };

    return (
        <form
            onSubmit={handleFormSubmit}
            className={`flex items-center gap-2 bg-surface border border-border rounded-xl p-[10px_14px] shadow-sm relative ${isEmbedded ? "" : "max-[600px]:hidden"}`}
        >
            <input
                ref={addInputRef}
                type="text"
                value={newItemName}
                onChange={(e) => {
                    onNameChange(e.target.value);
                    setSelectedSuggestion(null);
                }}
                onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onBlur={() => setShowSuggestions(false)}
                onKeyDown={handleKeyDownWithOverride}
                placeholder={isReadOnly ? "List is read-only" : "Add item..."}
                disabled={isReadOnly}
                autoComplete="off"
                className={`flex-1 min-w-0 border-none bg-transparent text-sm text-text-strong outline-none px-1 ${isReadOnly ? "cursor-not-allowed opacity-50" : ""}`}
            />

            <SuggestionsDropdown
                showSuggestions={showSuggestions}
                suggestions={suggestions}
                activeIndex={activeIndex}
                onSelect={selectSuggestion}
            />

            <button
                type="button"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-bg-muted text-text-muted hover:text-accent border border-border transition-all shrink-0"
                disabled={isReadOnly}
                onClick={() => onOpenDetails(selectedSuggestion)}
            >
                <Settings size={18} />
            </button>
            <button
                type="submit"
                disabled={isReadOnly}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-text-strong text-bg transition-all shrink-0 hover:opacity-90"
            >
                <Plus size={18} strokeWidth={3} />
            </button>
        </form>
    );
};

interface ListTitleProps {
    isEditingName: boolean;
    editedName: string;
    setEditedName: (name: string) => void;
    onBlur: () => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onClickEdit: () => void;
    activeListName: string;
    currentUserRole?: "ADMIN" | "EDITOR";
    isReadOnly: boolean;
}

const ListTitle = ({
    isEditingName,
    editedName,
    setEditedName,
    onBlur,
    onKeyDown,
    onClickEdit,
    activeListName,
    currentUserRole,
    isReadOnly,
}: ListTitleProps) => {
    if (isEditingName) {
        return (
            <input
                className="text-2xl font-black text-text-strong bg-transparent border-b-2 border-accent outline-none w-full"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
            />
        );
    }
    if (currentUserRole === "ADMIN") {
        return (
            <button
                type="button"
                onClick={onClickEdit}
                disabled={isReadOnly}
                className="text-2xl font-black text-text-strong tracking-tight hover:text-accent transition-colors cursor-pointer bg-transparent border-none p-0 text-left disabled:cursor-not-allowed disabled:hover:text-text-strong"
            >
                {activeListName || "Shopping List"}
            </button>
        );
    }
    return (
        <h1 className="text-2xl font-black text-text-strong tracking-tight">
            {activeListName || "Shopping List"}
        </h1>
    );
};

const ListDetail = ({
    isEmbedded = false,
    listIdOverride,
}: ListDetailProps) => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const effectiveListId = listIdOverride ?? id;

    const [showShareModal, setShowShareModal] = useState(false);

    const {
        lists,
        isLoading: listsLoading,
        fetchLists,
        renameList,
    } = useListsStore();

    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState("");

    const handleRenameSubmit = async () => {
        if (
            !effectiveListId ||
            effectiveListId === "default" ||
            !editedName.trim()
        ) {
            setIsEditingName(false);
            setEditedName(activeList?.name || "");
            return;
        }
        if (editedName.trim() !== activeList?.name) {
            await renameList(effectiveListId, editedName.trim());
        }
        setIsEditingName(false);
    };

    const {
        items,
        isLoading: itemsLoading,
        error,
        authFailed,
        addItem,
        toggleItem,
        deleteItem,
        clearCompletedItems,
        reorderItem,
        claimItem,
        unclaimItem,
        setError,
        isReviewModalOpen,
        setIsReviewModalOpen,
        reviewItems,
        handleReviewConfirm,
    } = useListItems(effectiveListId);

    const { sendTypingEvent } = useListPresence(effectiveListId);

    const user = useStore((state) => state.user);
    const displayNames = usePresenceStore((state) => state.displayNames);

    const [newItemName, setNewItemName] = useState("");
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showMobileAddModal, setShowMobileAddModal] = useState(false);
    const [showExpandedDetails, setShowExpandedDetails] = useState(false);

    const [detailName, setDetailName] = useState("");
    const [detailQuantity, setDetailQuantity] = useState("");
    const [detailBrand, setDetailBrand] = useState("");
    const [detailPrice, setDetailPrice] = useState("");

    const {
        isFinishing,
        showFinishModal,
        setShowFinishModal,
        finishStoreName,
        setFinishStoreName,
        receiptImage,
        setReceiptImage,
        isFinishDisabled,
        handleFinishShopping,
    } = useFinishShopping({ effectiveListId, setError });

    const { permissionStatus, showBanner, setShowBanner, isScrolled } =
        useListPageEffects();

    const [sortMode, setSortMode] = useState<
        "alphabetical" | "chronological" | "custom"
    >("chronological");

    const scrolledPaddingClass = isEmbedded
        ? " -mt-6 pt-6 pb-3"
        : " -mt-3 pt-3 pb-3";

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
    const isRecipeList = activeList?.category === "RECIPE";
    const isTemplateList =
        activeList?.category === "RECIPE" ||
        activeList?.category === "FREQUENT";

    const canImportIntoNormalList =
        (isRecipeList || activeList?.category === "FREQUENT") &&
        items.length > 0;

    const {
        showImportModal,
        selectedTargetListId,
        setSelectedTargetListId,
        selectedImportItemIds,
        setSelectedImportItemIds,
        isImportingItems,
        importNewListName,
        setImportNewListName,
        openImportModal,
        toggleImportSelection,
        clearImportState,
        handleImportIntoNormalList,
    } = useImportItems({
        effectiveListId,
        isRecipeList,
        activeList,
        items,
        normalLists,
        setError,
        fetchLists,
    });
    useEffect(() => {
        if (activeList?.name) {
            setEditedName(activeList.name);
        }
    }, [activeList?.name]);
    const activeCollaborationUsers = useMemo(() => {
        const current = activeList;
        if (!current) return [];

        const users = new Set<string>();
        if (current.ownerEmail) users.add(current.ownerEmail);
        for (const c of current.collaborators || []) {
            users.add(c.email);
        }
        return Array.from(users);
    }, [activeList]);

    const estimatedTotal = useMemo(() => {
        return items
            .reduce((sum, item) => {
                const qtyStr = (item.quantity || "1").trim();
                const qty = /^\d+(?:\.\d+)?$/.test(qtyStr)
                    ? Number.parseFloat(qtyStr)
                    : 1;
                return sum + (item.price || 0) * qty;
            }, 0)
            .toFixed(2);
    }, [items]);

    useEffect(() => {
        if (lists.length === 0) {
            fetchLists();
        }
    }, [lists.length, fetchLists]);

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

    const openDetailsModal = (suggestion?: ProductSuggestion | null) => {
        setDetailName(newItemName);
        if (suggestion) {
            setDetailQuantity(suggestion.quantity ?? "1");
            setDetailBrand(suggestion.brand ?? "");
            setDetailPrice(
                suggestion.price === null || suggestion.price === undefined
                    ? ""
                    : String(suggestion.price),
            );
            if (suggestion.brand || suggestion.price) {
                setShowExpandedDetails(true);
            }
        } else {
            setDetailQuantity("");
            setDetailBrand("");
            setDetailPrice("");
        }
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

    const isReadOnly = authFailed;
    const wrapperClassName = isEmbedded
        ? "w-full flex flex-col h-full bg-surface/50"
        : "flex justify-center items-start p-20px bg-bg";
    const contentClassName = `w-full ${isEmbedded ? "" : "max-w-[860px]"} mx-auto flex flex-col gap-4 box-border ${isEmbedded ? "p-6" : "max-[600px]:pb-[100px]"}`;

    const handleInstantAdd = (suggestion: ProductSuggestion) => {
        const finalPrice =
            suggestion.price !== null && suggestion.price !== undefined
                ? Number(suggestion.price)
                : undefined;

        addItem(
            suggestion.name,
            suggestion.quantity || "1",
            suggestion.brand || undefined,
            finalPrice,
        );

        setNewItemName("");
    };

    const listNameDisplay = (
        <ListTitle
            isEditingName={isEditingName}
            editedName={editedName}
            setEditedName={setEditedName}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") {
                    setEditedName(activeList?.name || "");
                    setIsEditingName(false);
                }
            }}
            onClickEdit={() => setIsEditingName(true)}
            activeListName={activeList?.name || ""}
            currentUserRole={activeList?.currentUserRole}
            isReadOnly={isReadOnly}
        />
    );

    return (
        <div className={wrapperClassName}>
            <div className={contentClassName}>
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
                        <div
                            className={`sticky top-0 z-30 flex flex-col gap-3 transition-all duration-200 ${
                                isEmbedded ? "-mx-6 px-6" : ""
                            } ${
                                isScrolled
                                    ? "bg-bg/85 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border-b border-border/50" +
                                      scrolledPaddingClass
                                    : ""
                            }`}
                        >
                            <div className="flex justify-between items-end px-1">
                                <div className="flex flex-col gap-1">
                                    {listNameDisplay}
                                    <div className="flex flex-col">
                                        <h2 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-0.5">
                                            Collaboration
                                        </h2>
                                        <div className="flex items-center gap-2">
                                            <PresenceBar
                                                variant="avatars"
                                                allUsers={
                                                    activeCollaborationUsers
                                                }
                                            />
                                            {activeList?.currentUserRole && (
                                                <span
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        activeList.currentUserRole ===
                                                        "ADMIN"
                                                            ? "bg-accent-subtle text-accent"
                                                            : "bg-bg-muted text-text-muted border border-border"
                                                    }`}
                                                >
                                                    {activeList.currentUserRole ===
                                                    "ADMIN"
                                                        ? "Admin"
                                                        : "Editor"}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap justify-end gap-2">
                                    {!isReadOnly &&
                                        !isTemplateList &&
                                        items.some((item) => item.checked) && (
                                            <button
                                                type="button"
                                                onClick={clearCompletedItems}
                                                className="inline-flex items-center gap-2 px-3.5 py-2 bg-bg-muted text-text-strong border border-border rounded-lg text-xs font-bold transition-all hover:border-danger hover:text-danger"
                                            >
                                                <CheckCircle2
                                                    size={14}
                                                    strokeWidth={2.5}
                                                />
                                                Clear Completed
                                            </button>
                                        )}
                                    {canImportIntoNormalList && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                openImportModal();
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
                                        <Users size={14} strokeWidth={2.5} />
                                        Members
                                        {activeList?.collaborators &&
                                            activeList.collaborators.length >
                                                0 && (
                                                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-accent/15 text-[10px] font-bold">
                                                    {
                                                        activeList.collaborators
                                                            .length
                                                    }
                                                </span>
                                            )}
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
                                onAddFullItem={handleInstantAdd}
                            />

                            <div className="min-h-[16px] px-2 flex items-center justify-between mt-2 mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
                                        Sort:
                                    </span>
                                    <select
                                        value={sortMode}
                                        onChange={(e) =>
                                            setSortMode(
                                                e.target.value as
                                                    | "alphabetical"
                                                    | "chronological"
                                                    | "custom",
                                            )
                                        }
                                        className="bg-surface border border-border rounded-md text-xs font-semibold px-2 py-1 text-text-strong outline-none focus:border-accent transition-colors"
                                    >
                                        <option value="chronological">
                                            Chronological
                                        </option>
                                        <option value="alphabetical">
                                            Alphabetical
                                        </option>
                                        <option value="custom">Custom</option>
                                    </select>
                                </div>
                                <PresenceBar variant="typing" />
                            </div>
                        </div>

                        <div className="bg-surface border border-border rounded-xl shadow-sm min-h-[120px] overflow-hidden flex-1">
                            {itemsLoading ? (
                                <div className="flex flex-col items-center justify-center gap-4 p-[60px_20px] text-text-muted">
                                    <div className="w-8 h-8 border-[3px] border-border border-t-accent rounded-full animate-spin" />
                                    <p>Loading...</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/50 h-full overflow-y-auto p-4 flex flex-col">
                                    <ShoppingListItems
                                        items={items}
                                        onCheck={toggleItem}
                                        onDelete={deleteItem}
                                        disabled={isReadOnly}
                                        checkable={!isTemplateList}
                                        sortMode={sortMode}
                                        onReorder={reorderItem}
                                        onClaim={claimItem}
                                        onUnclaim={unclaimItem}
                                        currentUserEmail={user?.email}
                                        displayNames={displayNames}
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
                                            {!isTemplateList && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setShowFinishModal(true)
                                                    }
                                                    className="w-full py-3.5 bg-accent text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all"
                                                >
                                                    Finish Shopping
                                                </button>
                                            )}
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
                            disabled={isFinishDisabled}
                            onClick={handleFinishShopping}
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
                subtitle={`Copy items from "${activeList?.name || "Shopping List"}". Duplicate items will have their quantities merged.`}
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
                    handleImportIntoNormalList();
                }}
                isSubmitting={isImportingItems}
                submitLabel="Import selected"
                submittingLabel="Importing..."
                allowNewList={true}
                newListName={importNewListName}
                onNewListNameChange={setImportNewListName}
            />

            {showShareModal && (
                <ListMembersModal
                    listId={effectiveListId ?? ""}
                    listName={
                        lists.find((l) => l.id === effectiveListId)?.name ||
                        "Shopping List"
                    }
                    collaborators={activeList?.collaborators ?? []}
                    currentUserRole={activeList?.currentUserRole}
                    onClose={() => setShowShareModal(false)}
                    onLeaveSuccess={() => navigate("/dashboard")}
                />
            )}
        </div>
    );
};

export default ListDetail;
