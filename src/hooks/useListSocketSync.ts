import { useEffect, useRef } from "react";
import stompClient from "../services/socketService";
import { useListsStore } from "../store/useListsStore";

/**
 * Task #21: Edge Case UI Polish
 * Hook to manage WebSocket connections and detect wildly out of sync states.
 * @param listId - The ID of the list to synchronize.
 */
export const useListSocketSync = (listId: string | undefined) => {
    const isHardSyncing = useListsStore((state) => state.isHardSyncing);
    const forceHardRefresh = useListsStore((state) => state.forceHardRefresh);
    const currentList = useListsStore((state) => state.currentList);

    // We track the last version we knew about to detect missed updates
    const localVersionRef = useRef<number>(0);

    useEffect(() => {
        // Keep ref synced with local store state
        // @ts-ignore
        localVersionRef.current = currentList?.version || 0;
    }, [currentList]);

    useEffect(() => {
        if (!listId) return;

        if (!stompClient.connected) {
            stompClient.activate();
        }

        const subscription = stompClient.subscribe(
            `/topic/list/${listId}`,
            (message) => {
                // 1. Prevent overlapping actions if a hard refresh is already wiping the list
                if (useListsStore.getState().isHardSyncing) {
                    console.warn(
                        "Update ignored: UI is currently hard syncing.",
                    );
                    return;
                }

                const payload = JSON.parse(message.body);
                const serverVersion =
                    payload.version || payload.updateCount || 0;

                // 2. Detect the messy reality: Are we wildly out of sync?
                // If the incoming version is more than 1 step ahead of our local version, we missed updates.
                if (
                    serverVersion > 0 &&
                    serverVersion > localVersionRef.current + 1
                ) {
                    console.error(
                        `[Network Sync] Missed updates detected. Local: ${localVersionRef.current}, Server: ${serverVersion}. Wiping local state and forcing hard refresh...`,
                    );
                    forceHardRefresh(listId);
                    return;
                }

                // 3. Keep local version reference perfectly in sync
                if (serverVersion > 0) {
                    localVersionRef.current = serverVersion;
                }
            },
        );

        // Explicitly remove subscription on cleanup
        return () => {
            subscription.unsubscribe();
        };
    }, [listId, forceHardRefresh]);

    return { isHardSyncing };
};
