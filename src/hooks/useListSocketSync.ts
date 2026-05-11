import { useEffect, useRef } from "react";
import { useStore } from "../context/useStore";
import stompClient from "../services/socketService";
import { useListsStore } from "../store/useListsStore";

export const useListSocketSync = (listId: string | undefined) => {
    const isHardSyncing = useListsStore((state) => state.isHardSyncing);
    const forceHardRefresh = useListsStore((state) => state.forceHardRefresh);
    const currentList = useListsStore((state) => state.currentList);
    const isServerConnected = useStore((state) => state.isServerConnected);

    const localVersionRef = useRef<number>(0);
    const prevConnectedRef = useRef(isServerConnected);

    useEffect(() => {
        if (currentList && currentList.id === listId) {
            localVersionRef.current = currentList.version || 0;
        }
    }, [currentList, listId]);

    useEffect(() => {
        if (
            isServerConnected &&
            !prevConnectedRef.current &&
            listId &&
            currentList
        ) {
            console.warn(
                `[Network Sync] Reconnection detected for list ${listId}. Forcing hard refresh...`,
            );
            forceHardRefresh(listId).then(() => {
                const freshList = useListsStore.getState().currentList;
                if (freshList && freshList.id === listId) {
                    localVersionRef.current = freshList.version || 0;
                }
            });
        }
        prevConnectedRef.current = isServerConnected;
    }, [isServerConnected, listId, currentList, forceHardRefresh]);

    useEffect(() => {
        if (!listId) return;

        if (!stompClient.connected) {
            stompClient.activate();
        }

        const subscription = stompClient.subscribe(
            `/topic/list/${listId}`,
            (message) => {
                if (useListsStore.getState().isHardSyncing) {
                    return;
                }

                const payload = JSON.parse(message.body);

                if (payload.listId && payload.listId !== listId) {
                    return;
                }

                const serverVersion =
                    payload.version || payload.updateCount || 0;

                if (
                    serverVersion > 0 &&
                    serverVersion > localVersionRef.current + 1
                ) {
                    console.warn(
                        `[Network Sync] Missed updates detected. Local: ${localVersionRef.current}, Server: ${serverVersion}. Forcing hard refresh...`,
                    );
                    forceHardRefresh(listId);
                    return;
                }

                if (serverVersion > 0) {
                    localVersionRef.current = serverVersion;
                }
            },
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [listId, forceHardRefresh]);

    return { isHardSyncing };
};
