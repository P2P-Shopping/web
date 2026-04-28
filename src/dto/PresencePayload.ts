/**
 * Types and structures for WebSocket presence events.
 */

/**
 * Union type representing the possible presence events broadcasted.
 * JOIN: A user entered the list.
 * LEAVE: A user exited the list.
 * TYPING: A user is actively typing a new item.
 */
export type PresenceEventType = "JOIN" | "LEAVE" | "TYPING" | "SYNC";

/**
 * Data Transfer Object for presence synchronization.
 * Maps incoming STOMP presence messages from the server.
 */
export interface PresencePayload {
    /** The username of the user triggering the event */
    username: string;
    /** The action the user is performing */
    eventType: PresenceEventType;
    /** The list ID this presence event corresponds to */
    listId: string;
}
