import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import stompClient from "../../services/socketService";
import { useStore } from "../../context/useStore";
import { usePresenceStore } from "../../context/usePresenceStore";
import { PresenceBar } from "../../components";

import "./ListDetail.css";

interface Item {
    id: string; // Added unique ID
    name: string;
    checked: boolean;
}

class SyncPayloadBuilder {
    private payload: Record<string, any> = {
        actionType: "UPDATE_ITEM",
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
const removeScriptBlocks = (input: string): string => {
    const lowerInput = input.toLowerCase();
    const closingTag = "</script>";
    let cursor = 0;
    let output = "";

    while (cursor < input.length) {
        const start = lowerInput.indexOf("<script", cursor);
        if (start === -1) {
            output += input.slice(cursor);
            break;
        }

        const tagEnd = input.indexOf(">", start + 7);
        if (tagEnd === -1) {
            output += input.slice(cursor);
            break;
        }

        const closeStart = lowerInput.indexOf(closingTag, tagEnd + 1);
        if (closeStart === -1) {
            output += input.slice(cursor);
            break;
        }

        output += input.slice(cursor, start);
        cursor = closeStart + closingTag.length;
    }

    return output;
};

const sanitizeString = (input: unknown): string => {
    const s = String(input ?? "");

    // Remove any <script>...</script> blocks entirely
    const withoutScripts = removeScriptBlocks(s);

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

// Pure utility to apply state updates outside of the component to reduce nesting depth
const applyItemUpdate = (prevItems: Item[], itemId: string, newChecked: boolean): Item[] => {
    const idx = prevItems.findIndex((i) => i.id === itemId);
    if (idx === -1) return prevItems;
    const newArray = [...prevItems];
    newArray[idx] = { ...newArray[idx], checked: newChecked };
    return newArray;
};

const toggleItemChecked = (prevItems: Item[], itemId: string, newChecked: boolean): Item[] =>
    prevItems.map((item) =>
        item.id === itemId ? { ...item, checked: newChecked } : item,
    );

const ListDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [items, setItems] = useState<Item[]>([]);
    
    // Zustand hooks
    const conflictItems = useStore((state) => state.conflictItems);
    const setItemConflict = useStore((state) => state.setItemConflict);
    const handlePresenceEvent = usePresenceStore((state) => state.handlePresenceEvent);
    const clearAllTimeouts = usePresenceStore((state) => state.clearAllTimeouts);
    const isOnline = useStore((state) => state.isOnline);
    // Track active conflict timeouts to prevent memory leaks
    const conflictTimeoutsRef = useRef<Record<string, number>>({});
    // Local source-of-truth backup map for optimistic rollback in this component.
    const itemBackupsRef = useRef<Record<string, Item>>({});
    const clearBackup = (itemId: string) => {
        delete itemBackupsRef.current[itemId];
    };

    const [myUsername] = useState(() => {
        const stored = localStorage.getItem("p2p_username");
        const randomNum = globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % 1000;
        return stored || `User_${randomNum}`;
    });

    const handleRejection = (itemId: string) => {
        if (!itemId) return;
        const backup = itemBackupsRef.current[itemId];
        if (backup) {
            setItems((prevItems) =>
                prevItems.map((item) => (item.id === itemId ? backup : item)),
            );
            clearBackup(itemId);
        }
        setItemConflict(itemId, true);
        
        if (conflictTimeoutsRef.current[itemId]) {
            globalThis.clearTimeout(conflictTimeoutsRef.current[itemId]);
        }
        conflictTimeoutsRef.current[itemId] = globalThis.setTimeout(() => {
            setItemConflict(itemId, false);
            delete conflictTimeoutsRef.current[itemId];
        }, 3000);
    };

    const handleUpdatePayload = (payload: any) => {
        if (payload.status === "Rejection") {
            handleRejection(payload.itemId);
        } else if (payload.status === "Success" || !payload.status) {
            if (payload.itemId && (payload.action === "UPDATE_ITEM" || payload.actionType === "UPDATE_ITEM")) {
                const newChecked = payload.checked ?? payload.isChecked;
                setItems((prevItems) => applyItemUpdate(prevItems, payload.itemId, newChecked));
            }
        }
    };

    const onErrorsMessage = (message: any) => {
        try {
            const payload = JSON.parse(message.body);
            if (payload.actionType === "REJECT" || payload.actionType === "ERROR") {
                handleRejection(payload.itemId);
            }
        } catch (e) {
            console.error("Error parsing reject payload", e);
        }
    };

    const onUpdateMessage = (message: any) => {
        try {
            handleUpdatePayload(JSON.parse(message.body));
        } catch (e) {
            console.error("Error parsing update payload", e);
        }
    };

    const onPresenceMessage = (message: any) => {
        if (!id) return;
        try {
            const payload = JSON.parse(message.body);
            handlePresenceEvent({
                username: payload.username,
                eventType: payload.eventType,
                listId: id,
            });
        } catch (e) {
            console.error("Error parsing presence payload", e);
        }
    };

    useEffect(() => {
        if (!id) return;
        
        let rejectSub: any;
        let presenceSub: any;
        let updateSub: any;
        
        const connectAndSubscribe = () => {
            if (!stompClient.connected) return;
            
            rejectSub = stompClient.subscribe(`/topic/list/${id}/errors`, onErrorsMessage);
            updateSub = stompClient.subscribe(`/topic/list/${id}`, onUpdateMessage);
            presenceSub = stompClient.subscribe(`/topic/list/${id}/presence`, onPresenceMessage);

            stompClient.publish({
                destination: `/app/list/${id}/presence`,
                body: JSON.stringify({ eventType: "JOIN", username: myUsername, listId: id }),
            });
            handlePresenceEvent({ eventType: "JOIN", username: myUsername, listId: id });
        };

        if (stompClient.connected) {
            connectAndSubscribe();
        } else {
            stompClient.onConnect = () => connectAndSubscribe();
        }

        return () => {
            if (stompClient.connected) {
                stompClient.publish({
                    destination: `/app/list/${id}/presence`,
                    body: JSON.stringify({ eventType: "LEAVE", username: myUsername, listId: id }),
                });
            }
            if (rejectSub) rejectSub.unsubscribe();
            if (presenceSub) presenceSub.unsubscribe();
            if (updateSub) updateSub.unsubscribe();
            Object.values(conflictTimeoutsRef.current).forEach(tId => globalThis.clearTimeout(tId));
            conflictTimeoutsRef.current = {};
            clearAllTimeouts();
        };
    }, [id, setItemConflict, handlePresenceEvent, myUsername, clearAllTimeouts]);
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

    const lastTypingEmitRef = useRef<number>(0);

    const handleTyping = () => {
        const now = Date.now();
        if (now - lastTypingEmitRef.current > 500 && stompClient.connected && id && isOnline) {
            lastTypingEmitRef.current = now;
            stompClient.publish({
                destination: `/app/list/${id}/presence`,
                body: JSON.stringify({ eventType: "TYPING", username: myUsername, listId: id }),
            });
            handlePresenceEvent({ eventType: "TYPING", username: myUsername, listId: id });
        }
    };

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

        // Backup state for potential rollback in local component state
        itemBackupsRef.current[itemId] = { ...currentItem };

        // Optimistic UI update (functional form to avoid stale closures)
        setItems((prevItems) => toggleItemChecked(prevItems, itemId, newChecked));

        if (!id) return;

        const payload = new SyncPayloadBuilder()
            .setListId(id)
            .setItemId(itemId)
            .setChecked(newChecked)
            .build();

        if (!stompClient.connected || !isOnline) {
            handleRejection(itemId);
            console.error("Unable to sync: WebSocket connection is closed or device is offline");
            
            // Add a transient visual warning if they click while offline
            if (conflictTimeoutsRef.current[itemId]) {
                globalThis.clearTimeout(conflictTimeoutsRef.current[itemId]);
            }
            conflictTimeoutsRef.current[itemId] = globalThis.setTimeout(() => {
                setItemConflict(itemId, false);
                delete conflictTimeoutsRef.current[itemId];
            }, 3000);
            
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
                    clearBackup(itemId);
                });
            }

            // Prepare rollback + timeout in case no receipt arrives
            const timeoutId = globalThis.setTimeout(() => {
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
                    handleRejection(itemId);
                    console.error(
                        "Optimistic UI failed (no receipt), state reverted for item:",
                        itemId,
                    );
                },
            });

            stompClient.publish({
                destination: `/app/list/${id}/update`,
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
                handleRejection(itemId);
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

            <PresenceBar />

            <form onSubmit={addItem} className="add-item-form">
                <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => {
                        setNewItemName(e.target.value);
                        handleTyping();
                    }}
                    placeholder="Add new item..."
                    className="add-input"
                />
                <button type="submit" className="add-button">
                    Add
                </button>
            </form>

            <ul className="shopping-list">
                {items.map((item) => {
                    const isConflicting = conflictItems[item.id] === true;
                    return (
                    <li
                        key={item.id}
                        className={`shopping-item ${item.checked ? "item-completed" : ""} ${isConflicting ? "item-conflict" : ""}`}
                    >
                        <label className="item-label">
                            <input
                                type="checkbox"
                                checked={item.checked}
                                onChange={() => handleCheck(item.id)}
                                className="item-checkbox"
                            />
                            <span className="item-text">
                                {item.name} {isConflicting && <span className="warning-icon">⚠️</span>}
                            </span>
                        </label>
                    </li>
                )})}
            </ul>

            {items.length === 0 && (
                <p className="empty-msg">Your list is empty!</p>
            )}
        </div>
    );
};

export default ListDetail;
