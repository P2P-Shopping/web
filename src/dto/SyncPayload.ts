/**
 * Defines the allowed actions that can be synchronized over the WebSocket.
 */
export type ActionType = 'UPDATE_ITEM' | 'DELETE_ITEM' | 'USER_PRESENCE';

/**
 * Base abstract class for standardizing outgoing WebSocket payloads.
 * Ensures the backend never receives malformed data.
 */
export abstract class SyncPayload {
  actionType: ActionType;
  entityId: string;
  originUserId: string;
  timestamp: string;

  constructor(actionType: ActionType, entityId: string, originUserId: string) {
    this.actionType = actionType;
    this.entityId = entityId;
    this.originUserId = originUserId;
    this.timestamp = new Date().toISOString(); 
  }

  /**
   * Must be implemented by child classes to validate their specific schema.
   */
  abstract validateSchema(): boolean;

  /**
   * Utility to validate the base fields required for any payload.
   */
  protected validateBaseSchema(): boolean {
    return Boolean(
      this.actionType && 
      this.entityId && 
      this.originUserId && 
      this.timestamp
    );
  }
}

/**
 * Payload for updating an item's state (e.g., toggling a checkbox).
 */
export class ItemEditPayload extends SyncPayload {
  fieldName: string;
  newValue: string;

  constructor(entityId: string, originUserId: string, fieldName: string, newValue: string) {
    super('UPDATE_ITEM', entityId, originUserId);
    this.fieldName = fieldName;
    this.newValue = newValue;
  }

  validateSchema(): boolean {
    return (
      this.validateBaseSchema() &&
      this.actionType === 'UPDATE_ITEM' &&
      Boolean(this.fieldName) &&
      this.newValue !== undefined
    );
  }
}

/**
 * Payload for broadcasting user presence (e.g., active, typing).
 */
export class PresencePayload extends SyncPayload {
  status: string;

  constructor(entityId: string, originUserId: string, status: string) {
    super('USER_PRESENCE', entityId, originUserId);
    this.status = status;
  }

  validateSchema(): boolean {
    return (
      this.validateBaseSchema() &&
      this.actionType === 'USER_PRESENCE' &&
      Boolean(this.status)
    );
  }
}