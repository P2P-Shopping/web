import { create } from "zustand";
import type { PresenceEventType } from "../dto/PresencePayload";

/**
 * Interface defining the payload dispatched to the presence store.
 */
export interface PresenceEvent {
    username: string;
    eventType: PresenceEventType;
    listId: string;
    activeUsers?: string[];
}

/**
 * Interface defining the Zustand store state and actions for managing connected user presence.
 */
interface PresenceState {
    /**
     * Collection of actively connected users.
     */
    activeUsers: Set<string>;
    /**
     * Map linking a typing username to their active javascript timeout ID.
     */
    typingUsers: Record<string, number>;

    /**
     * Processes an incoming presence event and updates state.
     * @param event The presence event object containing username and eventType.
     */
    handlePresenceEvent: (event: PresenceEvent) => void;

    /**
     * Called during unmount or list change to ensure 100% memory leak cleanup.
     * Clears any lingering typing timeouts and resets active users.
     */
    clearPresence: () => void;
}

/**
 * A dedicated Zustand store to manage real-time presence state (users viewing the list and typing indicators)
 * cleanly and separate from the list items.
 */
export const usePresenceStore = create<PresenceState>((set, get) => ({
    activeUsers: new Set<string>(),
    typingUsers: {},

    handlePresenceEvent: (event: PresenceEvent) => {
        const { username, eventType, activeUsers } = event;

        // CRITICAL: Handle the server-authoritative roster overwrite
        if (eventType === "ROSTER_UPDATE" && activeUsers) {
            set({ activeUsers: new Set(activeUsers) });
        } else if (eventType === "JOIN") {
            set((state) => {
                const newSet = new Set(state.activeUsers);
                newSet.add(username);
                return { activeUsers: newSet };
            });
        } else if (eventType === "LEAVE") {
            set((state) => {
                const newSet = new Set(state.activeUsers);
                newSet.delete(username);

                const newTyping = { ...state.typingUsers };
                if (newTyping[username]) {
                    globalThis.clearTimeout(newTyping[username]);
                    delete newTyping[username];
                }
                return { activeUsers: newSet, typingUsers: newTyping };
            });
        } else if (eventType === "TYPING") {
            const currentTyping = get().typingUsers;
            if (currentTyping[username]) {
                globalThis.clearTimeout(currentTyping[username]);
            }

            const timeoutId = globalThis.setTimeout(() => {
                set((innerState) => {
                    const updatedTyping = { ...innerState.typingUsers };
                    delete updatedTyping[username];
                    return { typingUsers: updatedTyping };
                });
            }, 4000);

            set((state) => {
                const newSet = new Set(state.activeUsers);
                newSet.add(username);
                return {
                    activeUsers: newSet,
                    typingUsers: {
                        ...state.typingUsers,
                        [username]: timeoutId,
                    },
                };
            });
        }
    },

    clearPresence: () => {
        const currentTyping = get().typingUsers;
        Object.values(currentTyping).forEach((id) => {
            globalThis.clearTimeout(id);
        });
        set({ activeUsers: new Set(), typingUsers: {} });
    },
}));
