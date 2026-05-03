/**
 * Action types for list synchronization, matching the server's ActionType enum.
 */
export type ActionType =
    | "ADD"
    | "UPDATE"
    | "DELETE"
    | "CHECK_OFF"
    | "TYPING"
    | "UNKNOWN";

/**
 * Data Transfer Object representing a real-time modification to a shopping list.
 * Aligned with the server's ListUpdatePayload.java.
 */
export interface SyncPayload {
    /**
     * The action type (e.g., ADD, UPDATE, DELETE, CHECK_OFF).
     * Server aliases this to actionType or action_type if needed.
     */
    action: ActionType;

    /** The unique identifier of the modified item. */
    itemId?: string;

    /** The text content or value of the item (used for ADD/UPDATE). */
    content?: string;

    /** The checked status of the item (used for CHECK_OFF). */
    checked?: boolean;

    /** Timestamp of the modification for conflict resolution. */
    timestamp?: number;

    /** Status of the operation, returned by the server. */
    status?: "Success" | "Rejection";

    /** Unique identifier for the client instance that sent this message. */
    senderId?: string;
}

/**
 * Payload indicating a rejection from the server.
 */
export interface RejectionPayload {
    /** The ID of the item that caused a conflict. */
    itemId: string;
    /** The ID of the list where the conflict occurred. */
    listId: string;
    /** Optional reason for the rejection. */
    reason?: string;
}
