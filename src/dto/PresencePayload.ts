/**
 * Types and structures for WebSocket presence events.
 */

/**
 * Union type representing the possible presence events broadcasted.
 * JOIN: A user entered the list.
 * LEAVE: A user exited the list.
 * TYPING: A user is actively typing a new item.
 * SYNC: Legacy peer-to-peer sync request (deprecated).
 * ROSTER_UPDATE: Master list of active users sent by the server.
 */
export type PresenceEventType =
    | "JOIN"
    | "LEAVE"
    | "TYPING"
    | "SYNC"
    | "ROSTER_UPDATE";

/**
 * Data Transfer Object for presence synchronization.
 * Maps incoming STOMP presence messages from the server.
 */
export interface PresencePayload {
    /** The username (email) of the user triggering the event */
    username: string;
    /** A human-friendly display name for the user (e.g. firstName or email prefix) */
    displayName?: string;
    /** The action the user is performing */
    eventType: PresenceEventType;
    /** The list ID this presence event corresponds to */
    listId: string;
    /** Master roster of active users (emails). */
    activeUsers?: string[];
    /** Map of email → display name for all users in the room. */
    displayNames?: Record<string, string>;
}
