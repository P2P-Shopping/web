import { create } from "zustand";
import type { PresencePayload } from "../dto/PresencePayload";

/**
 * State snapshot of an item maintained for rollback purposes.
 */
export interface PresenceState {
  activeUsers: Set<string>;
  typingUsers: Record<string, ReturnType<typeof setTimeout>>;
  handlePresenceEvent: (payload: PresencePayload) => void;
  clearAllTimeouts: () => void;
}

/**
 * Global application store hook using Zustand.
 */
export const usePresenceStore = create<PresenceState>((set, get) => ({
  activeUsers: new Set(),
  typingUsers: {},

  /**
   * Processes an incoming presence event and updates the active and typing user states.
   * @param {PresencePayload} payload - The presence event payload.
   */
  handlePresenceEvent: (payload: PresencePayload) => {
    const { username, eventType } = payload;
    set((state) => {
      const newActiveUsers = new Set(state.activeUsers);
      const newTypingUsers = { ...state.typingUsers };

      if (eventType === 'JOIN') {
        newActiveUsers.add(username);
      } else if (eventType === 'LEAVE') {
        newActiveUsers.delete(username);
        if (newTypingUsers[username]) {
          clearTimeout(newTypingUsers[username]);
          delete newTypingUsers[username];
        }
      } else if (eventType === 'TYPING') {
        newActiveUsers.add(username);
        if (newTypingUsers[username]) {
          clearTimeout(newTypingUsers[username]);
        }
        newTypingUsers[username] = setTimeout(() => {
          set((s) => {
            const currentTypingUsers = { ...s.typingUsers };
            delete currentTypingUsers[username];
            return { typingUsers: currentTypingUsers };
          });
        }, 2000);
      }

      return { activeUsers: newActiveUsers, typingUsers: newTypingUsers };
    });
  },

  /**
   * Clears all active typing timeouts to prevent memory leaks when the application unmounts.
   */
  clearAllTimeouts: () => {
    const { typingUsers } = get();
    Object.values(typingUsers).forEach((timer) => clearTimeout(timer));
    set({ typingUsers: {} });
  }
}));
