import axios from "axios";
import { useCallback, useEffect, useRef } from "react";
import { useStore } from "../context/useStore";
import api from "../services/api";
import { useListsStore } from "../store/useListsStore";
import type { QueuedAction } from "../types";

/**
 * Custom hook that acts as a background sync engine.
 * It monitors the online status and processes any queued offline actions
 * when connectivity is restored.
 */
export const useOfflineSync = () => {
    const isOnline = useStore((state) => state.isOnline);
    const offlineQueue = useStore((state) => state.offlineQueue);
    const dequeueAction = useStore((state) => state.dequeueAction);
    const rollbackItemState = useStore((state) => state.rollbackItemState);
    const setItemConflict = useStore((state) => state.setItemConflict);
    const fetchLists = useListsStore((state) => state.fetchLists);

    const isProcessing = useRef(false);

    /**
     * Replays a single queued action by making the corresponding API call.
     */
    const replayAction = useCallback(async (action: QueuedAction) => {
        const { type, payload } = action;

        switch (type) {
            case "ADD_ITEM":
                await api.post(`/api/lists/${payload.listId}/items`, {
                    name: payload.name,
                    isChecked: Boolean(payload.checked),
                    brand: payload.brand ?? null,
                    quantity: payload.quantity ?? null,
                    price: payload.price ?? null,
                    category: payload.category ?? null,
                    isRecurrent: Boolean(payload.isRecurrent),
                    timestamp: action.timestamp,
                });
                break;

            case "TOGGLE_ITEM":
                if (!payload.itemId) break;
                await api.put(`/api/items/${payload.itemId}`, {
                    name: payload.name,
                    isChecked: payload.checked,
                    brand: payload.brand ?? null,
                    quantity: payload.quantity ?? null,
                    price: payload.price ?? null,
                    category: payload.category ?? null,
                    isRecurrent: payload.isRecurrent ?? false,
                    timestamp: action.timestamp,
                });
                break;

            case "DELETE_ITEM":
                if (!payload.itemId) break;
                await api.delete(`/api/items/${payload.itemId}`);
                break;

            default:
                console.warn(`Unknown action type: ${type}`);
        }
    }, []);

    /**
     * Iterates through the offline queue and attempts to replay each action.
     */
    const processQueue = useCallback(async () => {
        if (isProcessing.current) return;
        isProcessing.current = true;

        // Create a copy to avoid mutation issues during iteration
        const actions = [...offlineQueue];

        for (const action of actions) {
            try {
                await replayAction(action);
                dequeueAction(action.id);
            } catch (error: unknown) {
                console.error(`Failed to sync action ${action.type}:`, error);

                // Check for server rejection (e.g., 400 Bad Request or 409 Conflict)
                if (
                    axios.isAxiosError(error) &&
                    error.response &&
                    (error.response.status === 400 ||
                        error.response.status === 409)
                ) {
                    dequeueAction(action.id);
                    const itemId = action.payload.itemId;
                    if (itemId) {
                        rollbackItemState(itemId);
                        setItemConflict(itemId, true);

                        // Clear conflict flag after 5 seconds
                        setTimeout(() => {
                            setItemConflict(itemId, false);
                        }, 5000);
                    }
                } else {
                    // Network error or other transient failure, stop processing
                    // to try again later when connection is more stable.
                    break;
                }
            }
        }

        // Refresh the global lists state after sync attempt
        await fetchLists();
        isProcessing.current = false;
    }, [
        offlineQueue,
        replayAction,
        dequeueAction,
        rollbackItemState,
        setItemConflict,
        fetchLists,
    ]);

    useEffect(() => {
        if (isOnline && offlineQueue.length > 0 && !isProcessing.current) {
            processQueue();
        }
    }, [isOnline, offlineQueue.length, processQueue]);
};
