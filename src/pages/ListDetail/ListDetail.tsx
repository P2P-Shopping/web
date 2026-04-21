import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { PresenceBar } from "../../components";
import ShoppingListItems from "../../components/ShoppingList/ShoppingListItems";
import { usePresenceStore } from "../../context/usePresenceStore";
import { useStore } from "../../context/useStore";
import stompClient from "../../services/socketService";
import type { Item } from "../../types";
import { uuid } from "../../utils/uuid";
import "./ListDetail.css";

interface ListDetailProps {
    isEmbedded?: boolean;
}

const DEMO_ITEMS: Item[] = [
    { id: "1", name: "Lapte de ovăz", checked: false },
    { id: "2", name: "Pâine integrală", checked: false },
    { id: "3", name: "Roșii cherry", checked: false },
    { id: "4", name: "Detergent de rufe", checked: false },
];

const RECEIPT_TIMEOUT_MS = 5000;

interface StompLikeClient {
    connected: boolean;
    onConnect: (() => void) | undefined;
    onWebSocketError?: ((evt: unknown) => void) | undefined;
    onStompError?: ((frame: unknown) => void) | undefined;
    subscribe: typeof stompClient.subscribe;
    publish: typeof stompClient.publish;
}

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

const sanitizeString = (input: unknown): string =>
    removeScriptBlocks(String(input ?? "")).replace(/[<>&]/g, (c) =>
        c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
    );

const sanitizeItemsForStorage = (items: Item[]): Item[] =>
    items.map((item) => ({
        ...item,
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

        return parsed.map((item) => ({
            ...item,
            id: String(item.id ?? uuid()),
            name: sanitizeString(item.name ?? ""),
            checked: Boolean(item.checked),
        }));
    } catch {
        return [];
    }
};

interface ServerItem {
    id: string;
    name: string;
    isChecked: boolean;
    brand?: string;
    price?: number;
    quantity?: string;
    category?: string;
    isRecurrent?: boolean;
}

interface ServerList {
    id: string;
    items: ServerItem[];
}

const ListDetail: React.FC<ListDetailProps> = ({ isEmbedded = false }) => {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const isNavView = location.pathname.includes("/nav") || isEmbedded;

    const items = useStore((state) => state.items);
    const setItems = useStore((state) => state.setItems);
    const backupItemState = useStore((state) => state.backupItemState);
    const rollbackItemState = useStore((state) => state.rollbackItemState);
    const setItemConflict = useStore((state) => state.setItemConflict);
    const isOnline = useStore((state) => state.isOnline);
    const handlePresenceEvent = usePresenceStore(
        (state) => state.handlePresenceEvent,
    );
    const clearAllTimeouts = usePresenceStore(
        (state) => state.clearAllTimeouts,
    );

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [newItemName, setNewItemName] = useState("");
    const [brand, setBrand] = useState("");
    const [quantity, setQuantity] = useState("");
    const [category, setCategory] = useState("");
    const [isRecurrent, setIsRecurrent] = useState(false);

    const [, setPendingMutations] = useState<
        Array<{
            id: string;
            destination: string;
            body: string;
            headers?: Record<string, string>;
            rollback: () => void;
        }>
    >([]);

    const [recipeText, setRecipeText] = useState("");
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [permissionStatus, setPermissionStatus] =
        useState<PermissionState | null>(null);
    const [showBanner, setShowBanner] = useState(true);
    const [myUsername] = useState(() => {
        const stored = localStorage.getItem("p2p_username");
        const randomNum =
            globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % 1000;
        return stored || `User_${randomNum}`;
    });

    const pendingRollbacksRef = useRef(
        new Map<
            string,
            { timeoutId: ReturnType<typeof setTimeout>; rollback: () => void }
        >(),
    );
    const conflictTimeoutsRef = useRef<
        Record<string, ReturnType<typeof setTimeout>>
    >({});
    const handlersWrappedRef = useRef(false);
    const lastTypingEmitRef = useRef(0);
    const itemsRef = useRef<Item[]>(items);

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    const commitItems = useCallback(
        (nextItems: Item[]) => {
            itemsRef.current = nextItems;
            setItems(nextItems);
        },
        [setItems],
    );

    const fetchListData = useCallback(async () => {
        if (!id || id === "default") {
            return;
        }
        setIsLoading(true);
        try {
            const baseUrl =
                (import.meta as any).env.VITE_API_URL ||
                "http://localhost:8081";
            const token = localStorage.getItem("token");
            const response = await fetch(`${baseUrl}/api/lists`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) throw new Error("Failed to fetch lists");
            const allLists: ServerList[] = await response.json();
            const currentList = allLists.find((l) => l.id === id);

            if (currentList) {
                const mappedItems: Item[] = currentList.items.map((it) => ({
                    id: it.id,
                    name: it.name,
                    checked: it.isChecked,
                    brand: it.brand,
                    price: it.price,
                    quantity: it.quantity,
                    category: it.category,
                    isRecurrent: it.isRecurrent,
                }));
                commitItems(mappedItems);
            } else {
                commitItems(readItems(id));
            }
        } catch (err) {
            setError("Could not sync the list.");
            commitItems(readItems(id));
        } finally {
            setIsLoading(false);
        }
    }, [id, commitItems]);

    const handleAiImport = async () => {
        if (!recipeText.trim() || !id) return;
        setIsAiLoading(true);
        setError(null);
        try {
            const baseUrl =
                (import.meta as any).env.VITE_API_URL ||
                "http://localhost:8081";
            const token = localStorage.getItem("token");

            const response = await fetch(`${baseUrl}/api/ai/recipe-to-list`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ rawText: recipeText, listId: id }),
            });

            if (response.ok) {
                setRecipeText("");
                await fetchListData();
            } else {
                throw new Error("AI Service error");
            }
        } catch (err) {
            setError("AI processing error. Check the backend.");
        } finally {
            setIsAiLoading(false);
        }
    };

    const clearConflictTimeout = useCallback((itemId: string) => {
        const timeoutId = conflictTimeoutsRef.current[itemId];
        if (!timeoutId) return;
        clearTimeout(timeoutId);
        delete conflictTimeoutsRef.current[itemId];
    }, []);

    const flagConflict = useCallback(
        (itemId: string) => {
            setItemConflict(itemId, true);
            clearConflictTimeout(itemId);
            conflictTimeoutsRef.current[itemId] = globalThis.setTimeout(() => {
                setItemConflict(itemId, false);
                delete conflictTimeoutsRef.current[itemId];
            }, 3000);
        },
        [clearConflictTimeout, setItemConflict],
    );

    const handleRejection = useCallback(
        (itemId: string) => {
            if (!itemId) return;
            rollbackItemState(itemId);
            flagConflict(itemId);
        },
        [flagConflict, rollbackItemState],
    );

    useEffect(() => {
        if (handlersWrappedRef.current) return;
        handlersWrappedRef.current = true;

        const client = stompClient as StompLikeClient;
        const prevOnWS = client.onWebSocketError;
        const prevOnStomp = client.onStompError;

        const rollbackAllPending = () => {
            for (const [
                pendingId,
                entry,
            ] of pendingRollbacksRef.current.entries()) {
                clearTimeout(entry.timeoutId);
                try {
                    entry.rollback();
                } finally {
                    pendingRollbacksRef.current.delete(pendingId);
                }
            }
        };

        client.onWebSocketError = (evt: unknown) => {
            try {
                prevOnWS?.(evt);
            } catch (error) {
                console.error("Error in previous WS handler:", error);
            }
            rollbackAllPending();
        };

        client.onStompError = (frame: unknown) => {
            try {
                prevOnStomp?.(frame);
            } catch (error) {
                console.error("Error in previous STOMP handler:", error);
            }
            rollbackAllPending();
        };

        return () => {
            client.onWebSocketError = prevOnWS;
            client.onStompError = prevOnStomp;
        };
    }, []);

    useEffect(() => {
        if (!id) return;
        if (isEmbedded || id === "default") {
            setItems(DEMO_ITEMS);
            return;
        }
        fetchListData();
    }, [id, isEmbedded, fetchListData, setItems]);

    useEffect(() => {
        if (!id || id === "default") return;
        localStorage.setItem(
            `list-${id}`,
            JSON.stringify(sanitizeItemsForStorage(items)),
        );
    }, [items, id]);

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
                })
                .catch(() => {});
        }
        return () => {
            isMounted = false;
            permResult?.removeEventListener("change", handler);
        };
    }, []);

    const handleTyping = () => {
        const now = Date.now();
        if (
            now - lastTypingEmitRef.current <= 500 ||
            !stompClient.connected ||
            !id ||
            !isOnline
        )
            return;
        lastTypingEmitRef.current = now;
        stompClient.publish({
            destination: `/app/list/${id}/presence`,
            body: JSON.stringify({
                eventType: "TYPING",
                username: myUsername,
                listId: id,
            }),
        });
        handlePresenceEvent({
            eventType: "TYPING",
            username: myUsername,
            listId: id,
        });
    };

    const flushPendingMutations = useCallback(() => {
        if (!stompClient.connected) return;
        setPendingMutations((prev) => {
            if (prev.length === 0) return prev;
            for (const mutation of prev) {
                try {
                    stompClient.publish({
                        destination: mutation.destination,
                        body: mutation.body,
                        headers: mutation.headers,
                    });
                } catch (error) {
                    console.error("Failed to flush mutation:", error);
                    mutation.rollback();
                }
            }
            return [];
        });
    }, []);

    useEffect(() => {
        if (stompClient.connected) flushPendingMutations();
    }, [flushPendingMutations]);

    useEffect(() => {
        if (!id) return;
        let rejectSub: { unsubscribe: () => void } | undefined;
        let presenceSub: { unsubscribe: () => void } | undefined;
        let updateSub: { unsubscribe: () => void } | undefined;
        const prevOnConnect = stompClient.onConnect;

        const connectAndSubscribe = () => {
            if (!stompClient.connected) return;

            rejectSub = stompClient.subscribe(
                `/topic/list/${id}/errors`,
                (message) => {
                    try {
                        const payload = JSON.parse(message.body);
                        if (payload.itemId) handleRejection(payload.itemId);
                    } catch (error) {
                        console.error("Error parsing reject payload", error);
                    }
                },
            );

            updateSub = stompClient.subscribe(
                `/topic/list/${id}`,
                (message) => {
                    try {
                        const payload = JSON.parse(message.body);
                        if (payload.status === "Rejection" && payload.itemId) {
                            handleRejection(payload.itemId);
                            return;
                        }
                        if (
                            payload.itemId &&
                            (payload.action === "UPDATE_ITEM" ||
                                payload.actionType === "UPDATE_ITEM")
                        ) {
                            const newChecked = payload.checked;
                            if (typeof newChecked === "boolean") {
                                commitItems(
                                    itemsRef.current.map((item) =>
                                        item.id === payload.itemId
                                            ? { ...item, checked: newChecked }
                                            : item,
                                    ),
                                );
                            }
                        }
                    } catch (error) {
                        console.error("Error parsing update payload", error);
                    }
                },
            );

            presenceSub = stompClient.subscribe(
                `/topic/list/${id}/presence`,
                (message) => {
                    try {
                        const payload = JSON.parse(message.body);
                        handlePresenceEvent({
                            username: payload.username,
                            eventType: payload.eventType,
                            listId: id,
                        });
                    } catch (error) {
                        console.error("Error parsing presence payload", error);
                    }
                },
            );

            stompClient.publish({
                destination: `/app/list/${id}/presence`,
                body: JSON.stringify({
                    eventType: "JOIN",
                    username: myUsername,
                    listId: id,
                }),
            });
            handlePresenceEvent({
                eventType: "JOIN",
                username: myUsername,
                listId: id,
            });
        };

        if (stompClient.connected) {
            connectAndSubscribe();
        } else {
            stompClient.onConnect = (frame) => {
                prevOnConnect?.(frame);
                connectAndSubscribe();
                flushPendingMutations();
            };
        }

        return () => {
            stompClient.onConnect = prevOnConnect;
            if (stompClient.connected) {
                stompClient.publish({
                    destination: `/app/list/${id}/presence`,
                    body: JSON.stringify({
                        eventType: "LEAVE",
                        username: myUsername,
                        listId: id,
                    }),
                });
            }
            rejectSub?.unsubscribe();
            presenceSub?.unsubscribe();
            updateSub?.unsubscribe();
            Object.values(conflictTimeoutsRef.current).forEach(clearTimeout);
            conflictTimeoutsRef.current = {};
            clearAllTimeouts();
        };
    }, [
        id,
        handlePresenceEvent,
        myUsername,
        clearAllTimeouts,
        commitItems,
        handleRejection,
        flushPendingMutations,
    ]);

    const addItem = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newItemName.trim();
        if (!trimmedName) return;

        const newItem: Item = {
            id: uuid(),
            name: trimmedName,
            checked: false,
        };

        const previousItems = itemsRef.current;
        commitItems([...previousItems, newItem]);
        setNewItemName("");
        setBrand("");
        setQuantity("");

        if (!id) return;
        const mutationBody = JSON.stringify({
            eventType: "ITEM_ADDED",
            listId: id,
            item: newItem,
        });
        const rollback = () => {
            commitItems(previousItems);
            setError("Failed to add item. Reverting changes.");
        };

        if (stompClient.connected && isOnline) {
            try {
                stompClient.publish({
                    destination: "/app/sync",
                    body: mutationBody,
                });
            } catch (error) {
                console.error("Failed to publish item:", error);
                rollback();
            }
        } else {
            setPendingMutations((prev) => [
                ...prev,
                {
                    id: uuid(),
                    destination: "/app/sync",
                    body: mutationBody,
                    rollback,
                },
            ]);
            setError("Connection lost. Item will be synced when back online.");
        }
    };

    const handleCheck = (itemId: string) => {
        const currentItem = itemsRef.current.find((it) => it.id === itemId);
        if (!currentItem) return;

        const newChecked = !currentItem.checked;
        backupItemState({ ...currentItem });
        const previousItems = itemsRef.current;
        commitItems(
            itemsRef.current.map((item) =>
                item.id === itemId ? { ...item, checked: newChecked } : item,
            ),
        );

        if (!id) return;
        const mutationBody = JSON.stringify({
            eventType: "ITEM_TOGGLED",
            listId: id,
            itemId,
            checked: newChecked,
        });
        const rollback = () => {
            commitItems(previousItems);
            setError("Failed to sync item state. Reverting.");
        };

        if (!stompClient.connected || !isOnline) {
            setPendingMutations((prev) => [
                ...prev,
                {
                    id: uuid(),
                    destination: "/app/sync",
                    body: mutationBody,
                    rollback,
                },
            ]);
            setError(
                "Connection lost. Change will be synced when back online.",
            );
            return;
        }

        const receiptId = `rcpt-${uuid()}`;
        const timeoutId = globalThis.setTimeout(() => {
            const entry = pendingRollbacksRef.current.get(receiptId);
            if (!entry) return;
            pendingRollbacksRef.current.delete(receiptId);
            entry.rollback();
        }, RECEIPT_TIMEOUT_MS);

        pendingRollbacksRef.current.set(receiptId, {
            timeoutId,
            rollback: () => {
                handleRejection(itemId);
                console.error(
                    "Optimistic UI failed, state reverted for item:",
                    itemId,
                );
            },
        });

        try {
            stompClient.publish({
                destination: "/app/sync",
                body: mutationBody,
                headers: { receipt: receiptId },
            });
        } catch (error) {
            const entry = pendingRollbacksRef.current.get(receiptId);
            if (entry) {
                clearTimeout(entry.timeoutId);
                pendingRollbacksRef.current.delete(receiptId);
                entry.rollback();
            }
            console.error("Optimistic UI failed, state reverted:", error);
        }
    };

    const listContent = (
        <>
            <div className="sidebar-header">
                <h3>Shopping List</h3>
                {isNavView && (
                    <button
                        type="button"
                        className="close-sidebar-btn"
                        aria-label="Close shopping list"
                        onClick={() => setIsSidebarOpen(false)}
                    >
                        <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            width="20"
                            height="20"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <title>Close shopping list</title>
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                )}
            </div>
            {error && <div className="error-msg">⚠️ {error}</div>}
            <div className="ai-import-section">
                <textarea
                    rows={3}
                    value={recipeText}
                    onChange={(e) => setRecipeText(e.target.value)}
                    placeholder="Paste your recipe here (e.g. 2 eggs, milk...)"
                />
                <button
                    type="button"
                    onClick={handleAiImport}
                    className="ai-btn"
                    disabled={isAiLoading}
                >
                    {isAiLoading ? "✨ Processing..." : "AI Magic Import"}
                </button>
            </div>
            <form onSubmit={addItem} className="add-item-form-sidebar">
                <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => {
                        setNewItemName(e.target.value);
                        handleTyping();
                    }}
                    placeholder="Item Name*"
                    className="sidebar-input"
                    required
                />
                <div className="row-inputs">
                    <input
                        type="text"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        placeholder="Brand"
                        className="sidebar-input"
                    />
                    <input
                        type="text"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="Qty"
                        className="sidebar-input"
                    />
                </div>
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="sidebar-input"
                    required
                >
                    <option value="" disabled hidden>
                        Category...
                    </option>
                    <option value="Altele">Altele</option>
                    <option value="Lactate">Lactate</option>
                    <option value="Legume">Legume</option>
                    <option value="Carne">Carne</option>
                    <option value="Băuturi">Băuturi</option>
                    <option value="Dulciuri">Dulciuri</option>
                </select>
                <label className="recurrence-label">
                    <input
                        type="checkbox"
                        checked={isRecurrent}
                        onChange={(e) => setIsRecurrent(e.target.checked)}
                    />
                    Add to frequent items
                </label>
                <button type="submit" className="sidebar-add-btn">
                    Add to List
                </button>
            </form>
            {isLoading ? (
                <p style={{ textAlign: "center", marginTop: "20px" }}>
                    Loading list...
                </p>
            ) : (
                <ShoppingListItems items={items} onCheck={handleCheck} />
            )}
        </>
    );

    return (
        <div
            className={isNavView ? "nav-sidebar-wrapper" : "full-page-wrapper"}
        >
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
            {isNavView ? (
                <>
                    {!isSidebarOpen && (
                        <div className="open-list-container">
                            <button
                                type="button"
                                className="open-list-btn-modern"
                                onClick={() => setIsSidebarOpen(true)}
                            >
                                <span className="cart-icon">🛒</span> Open List
                            </button>
                        </div>
                    )}
                    <div
                        className={`list-detail-sidebar ${isSidebarOpen ? "open" : ""}`}
                    >
                        {listContent}
                    </div>
                </>
            ) : (
                <div className="centered-list-card">{listContent}</div>
            )}
        </div>
    );
};

export default ListDetail;
