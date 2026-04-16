import { create } from "zustand";
import type { PresenceEventType } from "../dto/PresencePayload";

/**
 * Interface defining the payload dispatched to the presence store.
 */
export interface PresenceEvent {
    username: string;
    eventType: PresenceEventType;
    listId: string;
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
     * Called during unmount to ensure 100% memory leak cleanup.
     * Clears any lingering typing timeouts.
     */
    clearAllTimeouts: () => void;
}

/**
 * A dedicated Zustand store to manage real-time presence state (users viewing the list and typing indicators)
 * cleanly and separate from the list items.
 */
export const usePresenceStore = create<PresenceState>((set, get) => ({
    activeUsers: new Set<string>(),
    typingUsers: {},

    handlePresenceEvent: (event: PresenceEvent) => {
        const { username, eventType } = event;
        
        if (eventType === "JOIN") {
            set((state) => {
                const newSet = new Set(state.activeUsers);
                newSet.add(username);
                return { activeUsers: newSet };
            });
        } 
        else if (eventType === "LEAVE") {
            set((state) => {
                const newSet = new Set(state.activeUsers);
                newSet.delete(username);
                
                const newTyping = { ...state.typingUsers };
                if (newTyping[username]) {
                    window.clearTimeout(newTyping[username]);
                    delete newTyping[username];
                }
                return { activeUsers: newSet, typingUsers: newTyping };
            });
        } 
        else if (eventType === "TYPING") {
            set((state) => {
                // Ensure the user is in activeUsers conceptually
                const newSet = new Set(state.activeUsers);
                newSet.add(username);
                
                const newTyping = { ...state.typingUsers };
                if (newTyping[username]) {
                    window.clearTimeout(newTyping[username]);
                }
                
                newTyping[username] = window.setTimeout(() => {
                    set((innerState) => {
                        const updatedTyping = { ...innerState.typingUsers };
                        delete updatedTyping[username];
                        return { typingUsers: updatedTyping };
                    });
                }, 2000);

                return { activeUsers: newSet, typingUsers: newTyping };
            });
        }
    },

    clearAllTimeouts: () => {
        const currentTyping = get().typingUsers;
        Object.values(currentTyping).forEach((id) => window.clearTimeout(id));
        set({ typingUsers: {} });
    },
}));
