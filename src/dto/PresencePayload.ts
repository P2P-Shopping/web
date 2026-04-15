/**
 * Defines the possible action types for presence and synchronization payloads.
 */
export type PresenceEventType = 'JOIN' | 'LEAVE' | 'TYPING';

/**
 * Interface representing an incoming presence payload from the server.
 */
export interface PresencePayload {
  listId: string;
  username: string;
  eventType: PresenceEventType;
}
