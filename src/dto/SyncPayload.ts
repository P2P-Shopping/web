export type ActionType = "UPDATE_ITEM" | "DELETE_ITEM" | "USER_PRESENCE";

export abstract class SyncPayload {
    actionType: ActionType;
    entityId: string;
    originUserId: string;
    timestamp: string;

    constructor(
        actionType: ActionType,
        entityId: string,
        originUserId: string,
    ) {
        this.actionType = actionType;
        this.entityId = entityId;
        this.originUserId = originUserId;
        this.timestamp = new Date().toISOString();
    }

    abstract validateSchema(): boolean;

    protected validateBaseSchema(): boolean {
        return Boolean(
            this.actionType &&
                this.entityId &&
                this.originUserId &&
                this.timestamp,
        );
    }

    // [REPARAT EROAREA 2]: Funcție care validează AUTOMAT și transformă în JSON.
    // Dacă un coleg trimite date greșite, aplicația va da eroare aici, protejând serverul.
    serialize(): string {
        if (!this.validateSchema()) {
            throw new Error(
                `Invalid payload schema for action: ${this.actionType}`,
            );
        }
        return JSON.stringify(this);
    }
}

export class ItemEditPayload extends SyncPayload {
    fieldName: string;
    // [REPARAT EROAREA 1]: Acum suportă și text, și true/false, și numere.
    newValue: string | boolean | number | null;

    constructor(
        entityId: string,
        originUserId: string,
        fieldName: string,
        newValue: string | boolean | number | null,
    ) {
        super("UPDATE_ITEM", entityId, originUserId);
        this.fieldName = fieldName;
        this.newValue = newValue;
    }

    validateSchema(): boolean {
        return (
            this.validateBaseSchema() &&
            this.actionType === "UPDATE_ITEM" &&
            Boolean(this.fieldName) &&
            this.newValue !== undefined
        );
    }
}

// [REPARAT CHICHIȚA 4]: Am adăugat formularul pentru ștergerea unui produs.
export class ItemDeletePayload extends SyncPayload {
    constructor(entityId: string, originUserId: string) {
        super("DELETE_ITEM", entityId, originUserId);
    }

    validateSchema(): boolean {
        return this.validateBaseSchema() && this.actionType === "DELETE_ITEM";
    }
}

export class PresencePayload extends SyncPayload {
    status: string;

    constructor(entityId: string, originUserId: string, status: string) {
        super("USER_PRESENCE", entityId, originUserId);
        this.status = status;
    }

    validateSchema(): boolean {
        return (
            this.validateBaseSchema() &&
            this.actionType === "USER_PRESENCE" &&
            Boolean(this.status)
        );
    }
}
