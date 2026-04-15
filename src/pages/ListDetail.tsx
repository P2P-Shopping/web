import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import stompClient from "../services/socketService";
import { useStore } from "../context/useStore";
import { usePresenceStore } from "../context/usePresenceStore";
import type { RejectionPayload } from "../dto/SyncPayload";
import type { PresencePayload, PresenceEventType } from "../dto/PresencePayload";
import PresenceBar from "../components/PresenceBar";
import type { StompSubscription } from "@stomp/stompjs";

/**
 * Structure mapping internal list items.
 */
interface Item {
  id: string;
  name: string;
  checked: boolean;
}

/**
 * Prepares mock sync payloads.
 */
class SyncPayloadBuilder {
  private payload: Record<string, any> = {
    eventType: "ITEM_TOGGLED",
    timestamp: Date.now(),
  };

  /** Sets target list ID */
  setListId(listId: string) {
    this.payload.listId = listId;
    return this;
  }

  /** Sets subject item ID */
  setItemId(itemId: string) {
    this.payload.itemId = itemId;
    return this;
  }

  /** Assigns checking boolean state */
  setChecked(checked: boolean) {
    this.payload.checked = checked;
    return this;
  }

  /** Stringifies payload payload wrapper */
  build() {
    return JSON.stringify(this.payload);
  }
}

/**
 * Sanitizes input strings before rendering or saving.
 * @param {unknown} input - Value to sanitize.
 * @returns {string} Safer string omitting structural injections.
 */
const sanitizeString = (input: unknown): string => {
  const s = String(input ?? "");
  const withoutScripts = s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  return withoutScripts.replace(/[<>&]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
  );
};

/**
 * Transforms items safely before caching locally.
 * @param {Item[]} items - Active data items.
 * @returns {Item[]} Escaped and structural item states.
 */
const sanitizeItemsForStorage = (items: Item[]): Item[] =>
  items.map((item) => ({
    id: String(item.id),
    name: sanitizeString(item.name),
    checked: Boolean(item.checked),
  }));

/**
 * Loads serialized and sanitized list item arrays from storage caches.
 * @param {string | undefined} id - Unique associated list UUID.
 * @returns {Item[]} Decoded shopping list items.
 */
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
    return [];
  }
};

/**
 * Detailed shopping list route view allowing dynamic and optimistic edits 
 * properly syncing over WebSocket endpoints. 
 */
const ListDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [permissionStatus, setPermissionStatus] = useState<PermissionState | null>(null);
  const [showBanner, setShowBanner] = useState(true);

  // Store Hooks
  const conflictItems = useStore((state) => state.conflictItems);
  const setItemConflict = useStore((state) => state.setItemConflict);
  const backupGlobalItemState = useStore((state) => state.backupItemState);
  const getBackupItemState = useStore((state) => state.getBackupItemState);
  const triggerStoreRollback = useStore((state) => state.rollbackItemState);
  const handlePresenceEvent = usePresenceStore((state) => state.handlePresenceEvent);
  const clearAllTimeouts = usePresenceStore((state) => state.clearAllTimeouts);

  const pendingRollbacksRef = useRef(
    new Map<string, { timeoutId: number; rollback: () => void }>(),
  );
  
  const activeConflictTimeoutsRef = useRef(new Map<string, number>());
  const handlersWrappedRef = useRef(false);
  const RECEIPT_TIMEOUT_MS = 5000;
  const lastTypingEmitRef = useRef<number>(0);

  // Safely initialize a persistent random guest name per browser session 
  // so you don't generate a new one every time you click "List"
  const [myUsername] = useState(() => {
    let name = localStorage.getItem("p2p_username");
    if (!name) {
      name = `Guest-${Math.floor(Math.random() * 1000)}`;
      localStorage.setItem("p2p_username", name);
    }
    return name;
  });

  // Cleanup map timers when component is completely unmounted 
  // preventing memory leak issues from trailing setTimeouts.
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      for (const [_, timerId] of activeConflictTimeoutsRef.current.entries()) {
        window.clearTimeout(timerId);
      }
      clearAllTimeouts();
    };
  }, [clearAllTimeouts]);

  // Configure Web socket listener explicitly tracking presence and errors
  useEffect(() => {
    if (!id) return;

    let errorSub: StompSubscription | null = null;
    let presenceSub: StompSubscription | null = null;
    let isSubscribed = false;

    const setupSubscriptions = () => {
      if (isSubscribed) return;
      isSubscribed = true;

      try {
        errorSub = stompClient.subscribe(`/topic/list/${id}/errors`, (message) => {
          try {
            const payload = JSON.parse(message.body) as RejectionPayload;
            
            if (payload.actionType === 'REJECT' && payload.itemId) {
              if (import.meta.env.DEV) {
                console.warn(`[DEV LOG] Conflict rejected by server payload: ${message.body}`);
              }

              const backupNode = getBackupItemState(payload.itemId);
              if (backupNode) { 
                 setItems((prev) => 
                   prev.map((i) => i.id === payload.itemId ? { ...i, ...backupNode } : i)
                 );
                 triggerStoreRollback(payload.itemId);
              }

              setItemConflict(payload.itemId, true);

              const existingTimeout = activeConflictTimeoutsRef.current.get(payload.itemId);
              if (existingTimeout) {
                window.clearTimeout(existingTimeout);
              }

              const conflictClearTimerId = window.setTimeout(() => {
                setItemConflict(payload.itemId, false);
                activeConflictTimeoutsRef.current.delete(payload.itemId);
              }, 3000);

              activeConflictTimeoutsRef.current.set(payload.itemId, conflictClearTimerId);
            }
          } catch (err) {
              // Ignore invalid payload
          }
        });

        presenceSub = stompClient.subscribe(`/topic/list/${id}/presence`, (message) => {
          try {
            const presencePayload = JSON.parse(message.body) as PresencePayload;
            handlePresenceEvent({
               username: presencePayload.username,
               eventType: presencePayload.eventType as PresenceEventType,
               listId: id,
            });
          } catch (e) {
            // Ignore
          }
        });

        // Add ourselves locally immediately for immediate UI feedback
        handlePresenceEvent({ eventType: "JOIN", username: myUsername, listId: id });

        // Announce we joined to peers
        stompClient.publish({
          destination: `/app/list/${id}/presence`,
          body: JSON.stringify({ eventType: "JOIN", username: myUsername, listId: id }),
        });

      } catch (e) {
         // Silently handle unconnected states
      }
    };

    let checkInterval: number;
    // Because Stomp JS connections are asynchronous, the client might not be connected instantly on mount.
    if (stompClient.connected) {
      setupSubscriptions();
    } else {
      checkInterval = window.setInterval(() => {
        if (stompClient.connected) {
          window.clearInterval(checkInterval);
          setupSubscriptions();
        }
      }, 200);
    }

    // STRICT MEMORY LEAK CLEANUP REQUIREMENT
    return () => {
      window.clearInterval(checkInterval);
      if (isSubscribed && stompClient.connected) {
         stompClient.publish({
           destination: `/app/list/${id}/presence`,
           body: JSON.stringify({ eventType: "LEAVE", username: myUsername, listId: id }),
         });
      }
      if (errorSub) {
        errorSub.unsubscribe();
      }
      if (presenceSub) {
        presenceSub.unsubscribe();
      }
      clearAllTimeouts();
    };
  }, [id, getBackupItemState, triggerStoreRollback, setItemConflict, handlePresenceEvent, myUsername, clearAllTimeouts]);

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
        console.error("Error in previous onWebSocketError handler");
      }

      for (const [recId, entry] of pendingRollbacksRef.current.entries()) {
        try {
          clearTimeout(entry.timeoutId);
          entry.rollback();
        } catch (err) { }
        pendingRollbacksRef.current.delete(recId);
      }
    };

    (stompClient as any).onStompError = (frame: any) => {
      try {
        prevOnStomp?.(frame);
      } catch (e) { }

      for (const [recId, entry] of pendingRollbacksRef.current.entries()) {
        try {
          clearTimeout(entry.timeoutId);
          entry.rollback();
        } catch (err) { }
        pendingRollbacksRef.current.delete(recId);
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

  /**
   * Pushes a new item onto the end of the array context.
   * @param {React.FormEvent} e - Dispatched Form Submit event.
   */
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

  /**
   * Throttles typing presence broadcast emissions while typing.
   */
  const handleTyping = () => {
    const now = Date.now();
    if (now - lastTypingEmitRef.current > 500 && stompClient.connected && id) {
      lastTypingEmitRef.current = now;
      stompClient.publish({
        destination: `/app/list/${id}/presence`,
        body: JSON.stringify({ eventType: "TYPING", username: myUsername, listId: id }),
      });
    }
  };

  /**
   * Reverses boolean active checked markers locally and sends optimistic 
   * synchronizations triggering receipt handlers upon server acknowledgment
   * @param {string} itemId - Target UUID row for the toggle
   */
  const handleCheck = (itemId: string) => {
    const currentItem = items.find((item) => item.id === itemId);
    if (!currentItem) return;
    const newChecked = !currentItem.checked;

    const previousItems = [...items];
    backupGlobalItemState({ ...currentItem }); // Bind state immediately prior to modifications against the global layout

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
      return;
    }

    const receiptId = `rcpt-${crypto.randomUUID()}`;

    try {
      if ((stompClient as any).watchForReceipt) {
        (stompClient as any).watchForReceipt(receiptId, () => {
          const entry = pendingRollbacksRef.current.get(receiptId);
          if (entry) {
            clearTimeout(entry.timeoutId);
            pendingRollbacksRef.current.delete(receiptId);
          }
        });
      }

      const timeoutId = window.setTimeout(() => {
        const entry = pendingRollbacksRef.current.get(receiptId);
        if (!entry) return;
        try {
          entry.rollback();
        } catch (err) { }
        pendingRollbacksRef.current.delete(receiptId);
      }, RECEIPT_TIMEOUT_MS);

      pendingRollbacksRef.current.set(receiptId, {
        timeoutId,
        rollback: () => {
          setItems(previousItems);
          triggerStoreRollback(itemId);
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
        triggerStoreRollback(itemId);
      }
    }
  };

  return (
    <div className="list-detail-container">
      {showBanner && permissionStatus === "denied" && (
        <div className="location-warning-banner">
          <span>Location access is disabled. Some features may be limited.</span>
          <button className="close-banner-btn" onClick={() => setShowBanner(false)}>✕</button>
        </div>
      )}

      <PresenceBar />

      <form onSubmit={addItem} className="add-item-form">
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={handleTyping}
          placeholder="Add new item..."
          className="add-input"
        />
        <button type="submit" className="add-button">Add</button>
      </form>

      <ul className="shopping-list">
        {items.map((item) => {
          const isConflicting = conflictItems[item.id] === true;
          return (
            <li
              key={item.id}
              style={isConflicting ? { border: '1px solid #ff4444', animation: 'shake 0.3s' } : undefined}
              className={`shopping-item ${item.checked ? "item-completed" : ""} ${isConflicting ? "item-conflict" : ""}`}
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => handleCheck(item.id)}
                className="item-checkbox"
                disabled={isConflicting}
              />
              <span className="item-text">{item.name}</span>
              {isConflicting && (
                <span className="conflict-warning-icon" title="Server rejected optimistic block revision" style={{ marginLeft: '10px' }}>
                  ⚠️
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {items.length === 0 && <p className="empty-msg">Your list is empty!</p>}
    </div>
  );
};

export default ListDetail;
