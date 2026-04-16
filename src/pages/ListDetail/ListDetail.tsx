import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import stompClient from "../../services/socketService";

import "./ListDetail.css";

interface Item {
    id: string; // Added unique ID
    name: string;
    checked: boolean;
}

class SyncPayloadBuilder {
    private payload: Record<string, any> = {
        eventType: "ITEM_TOGGLED",
        timestamp: Date.now(),
    };

    setListId(listId: string) {
        this.payload.listId = listId;
        return this;
    }

    setItemId(itemId: string) {
        this.payload.itemId = itemId;
        return this;
    }

    setChecked(checked: boolean) {
        this.payload.checked = checked;
        return this;
    }

    build() {
        return JSON.stringify(this.payload);
    }
}

// Sanitize strings to reduce risk of storing/executing malicious payloads.
const sanitizeString = (input: unknown): string => {
    const s = String(input ?? "");

    // Remove any <script>...</script> blocks entirely
    const withoutScripts = s.replace(
        /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
        "",
    );

    // Escape angle brackets and ampersands so stored values cannot be
    // interpreted as HTML if later injected into the DOM unsafely.
    return withoutScripts.replace(/[<>&]/g, (c) =>
        c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
    );
};

const sanitizeItemsForStorage = (items: Item[]): Item[] =>
    items.map((item) => ({
        id: String(item.id),
        name: sanitizeString(item.name),
        checked: Boolean(item.checked),
    }));

const readItems = (id: string | undefined): Item[] => {
    if (!id) return [];
    const saved = localStorage.getItem(`list-${id}`);
    if (!saved) return [];
    try {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return [];
        return parsed.map((p) => ({
            id: String(p.id ?? crypto.randomUUID()),
            name: sanitizeString(p.name ?? ""),
            checked: Boolean(p.checked),
        }));
    } catch {
        // Corrupted or malicious data in storage; return empty list instead of throwing.
        return [];
    }
};

const ListDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [items, setItems] = useState<Item[]>([]);
    const [newItemName, setNewItemName] = useState("");
    const [permissionStatus, setPermissionStatus] =
        useState<PermissionState | null>(null);
    const [showBanner, setShowBanner] = useState(true);

    // Track pending optimistic publishes so we can rollback on timeout or global errors.
    const pendingRollbacksRef = useRef(
        new Map<string, { timeoutId: number; rollback: () => void }>(),
    );
    const handlersWrappedRef = useRef(false);
    const RECEIPT_TIMEOUT_MS = 5000;

    // Wrap global STOMP/WebSocket error handlers so transmission failures trigger the same rollback path.
    useEffect(() => {
        if (handlersWrappedRef.current) return;
        handlersWrappedRef.current = true;

        const prevOnWS = (stompClient as any).onWebSocketError;
        const prevOnStomp = (stompClient as any).onStompError;

        (stompClient as any).onWebSocketError = (evt: any) => {
            try {
                prevOnWS?.(evt);
            } catch (e) {
                console.error("Error in previous onWebSocketError handler:", e);
            }

            for (const [id, entry] of pendingRollbacksRef.current.entries()) {
                try {
                    clearTimeout(entry.timeoutId);
                    entry.rollback();
                } catch (err) {
                    console.error(
                        "Rollback failed during WebSocket error:",
                        err,
                    );
                }
                pendingRollbacksRef.current.delete(id);
            }
        };

        (stompClient as any).onStompError = (frame: any) => {
            try {
                prevOnStomp?.(frame);
            } catch (e) {
                console.error("Error in previous onStompError handler:", e);
            }

            for (const [id, entry] of pendingRollbacksRef.current.entries()) {
                try {
                    clearTimeout(entry.timeoutId);
                    entry.rollback();
                } catch (err) {
                    console.error("Rollback failed during STOMP error:", err);
                }
                pendingRollbacksRef.current.delete(id);
            }
        };

        return () => {
            (stompClient as any).onWebSocketError = prevOnWS;
            (stompClient as any).onStompError = prevOnStomp;
        };
    }, []);

    // Sync items when ID changes
    useEffect(() => {
        setItems(readItems(id));
    }, [id]);

    // Persist items to localStorage
    useEffect(() => {
        if (!id) return;
        // Sanitize items before writing to browser storage to avoid persisting
        // potentially malicious payloads.
        const sanitized = sanitizeItemsForStorage(items);
        localStorage.setItem(`list-${id}`, JSON.stringify(sanitized));
    }, [items, id]);

    // Safe Permission Check
    useEffect(() => {
        let isMounted = true;
        let permResult: PermissionStatus | null = null;

        const handler = () => {
            if (isMounted && permResult) setPermissionStatus(permResult.state);
        };

        if (navigator.permissions) {
            navigator.permissions
                .query({ name: "geolocation" as PermissionName })
                .then((result) => {
                    if (!isMounted) return;
                    permResult = result;
                    setPermissionStatus(result.state);
                    result.addEventListener("change", handler);
                });
        }

        return () => {
            isMounted = false;
            permResult?.removeEventListener("change", handler);
        };
    }, []);

    const addItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (newItemName.trim() === "") return;
        const newItem: Item = {
            id: crypto.randomUUID(),
            name: newItemName,
            checked: false,
        };
        setItems([...items, newItem]);
        setNewItemName("");
    };

    const handleCheck = (itemId: string) => {
        const currentItem = items.find((item) => item.id === itemId);
        if (!currentItem) return;
        const newChecked = !currentItem.checked;

        // Backup state for potential rollback
        const previousItems = [...items];

        // Optimistic UI update (functional form to avoid stale closures)
        setItems((prevItems) =>
            prevItems.map((item) =>
                item.id === itemId ? { ...item, checked: newChecked } : item,
            ),
        );

        if (!id) return;

        const payload = new SyncPayloadBuilder()
            .setListId(id)
            .setItemId(itemId)
            .setChecked(newChecked)
            .build();

        if (!stompClient.connected) {
            setItems(previousItems);
            console.error("Unable to sync: WebSocket connection is closed");
            return;
        }

        const receiptId = `rcpt-${crypto.randomUUID()}`;

        try {
            // Register receipt watcher before sending so we don't miss quick receipts.
            if ((stompClient as any).watchForReceipt) {
                (stompClient as any).watchForReceipt(receiptId, () => {
                    const entry = pendingRollbacksRef.current.get(receiptId);
                    if (entry) {
                        clearTimeout(entry.timeoutId);
                        pendingRollbacksRef.current.delete(receiptId);
                    }
                });
            }

            // Prepare rollback + timeout in case no receipt arrives
            const timeoutId = window.setTimeout(() => {
                const entry = pendingRollbacksRef.current.get(receiptId);
                if (!entry) return;
                try {
                    entry.rollback();
                } catch (err) {
                    console.error("Rollback failed (timeout):", err);
                }
                pendingRollbacksRef.current.delete(receiptId);
            }, RECEIPT_TIMEOUT_MS);

            pendingRollbacksRef.current.set(receiptId, {
                timeoutId,
                rollback: () => {
                    setItems(previousItems);
                    console.error(
                        "Optimistic UI failed (no receipt), state reverted for item:",
                        itemId,
                    );
                },
            });

            stompClient.publish({
                destination: "/app/sync",
                body: payload,
                headers: { receipt: receiptId },
            });
        } catch (error) {
            const entry = pendingRollbacksRef.current.get(receiptId);
            if (entry) {
                clearTimeout(entry.timeoutId);
                entry.rollback();
                pendingRollbacksRef.current.delete(receiptId);
            } else {
                setItems(previousItems);
            }
            console.error(
                "Optimistic UI failed, state reverted:",
                error instanceof Error ? error.message : error,
            );
        }
    };

    return (
        <div className="list-detail-container">
            {showBanner && permissionStatus === "denied" && (
                <div className="location-warning-banner">
                    <span>
                        Location access is disabled. Some features may be
                        limited.
                    </span>
                    <button
                        type="button"
                        className="close-banner-btn"
                        onClick={() => setShowBanner(false)}
                    >
                        ✕
                    </button>
                </div>
            )}

            <form onSubmit={addItem} className="add-item-form">
                <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Add new item..."
                    className="add-input"
                />
                <button type="submit" className="add-button">
                    Add
                </button>
            </form>

            <ul className="shopping-list">
                {items.map((item) => (
                    <li
                        key={item.id}
                        className={`shopping-item ${item.checked ? "item-completed" : ""}`}
                    >
                        <label className="item-label">
                            <input
                                type="checkbox"
                                checked={item.checked}
                                onChange={() => handleCheck(item.id)}
                                className="item-checkbox"
                            />
                            <span className="item-text">{item.name}</span>
                        </label>
                    </li>
                ))}
            </ul>

            {items.length === 0 && (
                <p className="empty-msg">Your list is empty!</p>
            )}
        </div>
    );
};

export default ListDetail;
