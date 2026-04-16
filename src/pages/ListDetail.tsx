import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import stompClient from "../services/socketService";
import { useStore } from "../context/useStore";
import { usePresenceStore } from "../context/usePresenceStore";
import type { RejectionPayload } from "../dto/SyncPayload";
import type { PresencePayload, PresenceEventType } from "../dto/PresencePayload";
import PresenceBar from "../components/PresenceBar";
import type { StompSubscription } from "@stomp/stompjs";
import type { Item } from "../context/useStore";

/**
 * Prepares mock sync payloads.
 */
class SyncPayloadBuilder {
  private payload: Record<string, any> = {
    actionType: "CHECK_OFF",
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
 * Uses Axios to fetch the full list topology directly from the active backend server.
 * Returns blank array fallback if failed instead of throwing runtime interrupts.
 * @param {string | undefined} id - Unique associated list UUID.
 * @returns {Promise<Item[]>} Decoded shopping list items directly from Postgres.
 */
const fetchRealItems = async (id: string | undefined): Promise<Item[]> => {
  if (!id) return [];
  try {
    const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";
    const token = localStorage.getItem("jwt_token") || "";
    const res = await window.fetch(`${API_URL}/api/lists/${id}`, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": token ? `Bearer ${token}` : ""
      }
    });
    if (res.status === 403) throw new Error("403_FORBIDDEN");
    if (!res.ok) throw new Error("List load rejected.");
    const data = await res.json();
    if (!data.items || !Array.isArray(data.items)) return [];
    
    return data.items.map((p: any) => ({
      id: String(p.id ?? crypto.randomUUID()),
      name: sanitizeString(p.name ?? ""),
      checked: Boolean(p.checked),
    }));
  } catch (err: any) {
    if (err.message === "403_FORBIDDEN") throw err;
    if (import.meta.env.DEV) console.error("REST Backend missing/failed for list:", err);
    return [];
  }
};

/**
 * Detailed shopping list route view allowing dynamic and optimistic edits 
 * properly syncing over WebSocket endpoints. 
 */
const ListDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [newItemName, setNewItemName] = useState("");
  const [permissionStatus, setPermissionStatus] = useState<PermissionState | null>(null);
  const [showBanner, setShowBanner] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Store Hooks
  const items = useStore((state) => state.items);
  const setItemsFromFetch = useStore((state) => state.setItemsFromFetch);
  const toggleItemOptimistic = useStore((state) => state.toggleItemOptimistic);
  const handleItemSyncBroadcast = useStore((state) => state.handleItemSyncBroadcast);
  const addItemLocal = useStore((state) => state.addItemLocal);
  
  const conflictItems = useStore((state) => state.conflictItems);
  const setItemConflict = useStore((state) => state.setItemConflict);
  const backupGlobalItemState = useStore((state) => state.backupItemState);
  const getBackupItemState = useStore((state) => state.getBackupItemState);
  const rawTriggerStoreRollback = useStore((state) => state.rollbackItemState);
  
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  const [isForbidden, setIsForbidden] = useState(false);
  const [collaboratorEmail, setCollaboratorEmail] = useState("");

  const triggerStoreRollback = React.useCallback((itemId: string) => {
    rawTriggerStoreRollback(itemId);
    setSyncErrorMessage("⚠️ Sync error: Failed to save changes to the database. Item reverted.");
    setTimeout(() => setSyncErrorMessage(null), 5000);
  }, [rawTriggerStoreRollback]);

  const handlePresenceEvent = usePresenceStore((state) => state.handlePresenceEvent);
  const clearAllTimeouts = usePresenceStore((state) => state.clearAllTimeouts);

  const pendingRollbacksRef = useRef(
    new Map<string, { timeoutId: number; itemId?: string; rollback: () => void }>(),
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
    let updateSub: StompSubscription | null = null;
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

        // Add WebSocket Listener Action (handleItemSyncBroadcast)
        updateSub = stompClient.subscribe(`/topic/list/${id}`, (message) => {
          try {
             const updatePayload = JSON.parse(message.body);
             if (updatePayload.action === "ADD" || updatePayload.action === "TOGGLE" || updatePayload.actionType === "ADD" || updatePayload.actionType === "TOGGLE") {
                 // Clear rollback timer for this item
                 for (const [receipt, entry] of pendingRollbacksRef.current.entries()) {
                   if (entry.itemId === updatePayload.itemId) {
                     clearTimeout(entry.timeoutId);
                     pendingRollbacksRef.current.delete(receipt);
                   }
                 }
                 
                 if (updatePayload.action === "ADD" || updatePayload.actionType === "ADD") {
                     fetchRealItems(id).then(setItemsFromFetch).catch(() => {});
                 } else {
                     handleItemSyncBroadcast(updatePayload.itemId, updatePayload.checked);
                 }
             }
          } catch(e) {
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
      if (updateSub) {
        updateSub.unsubscribe();
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

  // Sync items when ID changes via REST fetch immediately
  useEffect(() => {
    setIsLoading(true);
    setIsForbidden(false);
    fetchRealItems(id).then((fetched) => {
      setItemsFromFetch(fetched);
      setIsLoading(false);
    }).catch(err => {
      if (err.message === "403_FORBIDDEN") {
        setIsForbidden(true);
        setIsLoading(false);
      }
    });
  }, [id, setItemsFromFetch]);

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
    if (newItemName.trim() === "" || !id) return;
    const tempId = crypto.randomUUID();
    const newItem: Item = {
      id: tempId,
      name: newItemName,
      checked: false,
    };
    
    // Optimistic local update
    addItemLocal(newItem);
    setNewItemName("");

    if (!stompClient.connected) {
      triggerStoreRollback(tempId);
      return;
    }

    const payload = new SyncPayloadBuilder()
      .setListId(id)
      .setItemId(tempId)
      .setChecked(false)
      .build();
    
    const rawPayload = JSON.parse(payload);
    rawPayload.actionType = "ADD";
    rawPayload.name = newItemName;
    
    stompClient.publish({
      destination: `/app/list/${id}/update`,
      body: JSON.stringify(rawPayload)
    });
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

    backupGlobalItemState({ ...currentItem }); // Bind state immediately prior to modifications against the global layout

    toggleItemOptimistic(itemId, newChecked);

    if (!id) return;

    const payloadObj = JSON.parse(new SyncPayloadBuilder()
      .setListId(id)
      .setItemId(itemId)
      .setChecked(newChecked)
      .build());
    
    payloadObj.actionType = "TOGGLE";
    const payload = JSON.stringify(payloadObj);

    if (!stompClient.connected) {
      triggerStoreRollback(itemId);
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
        itemId,
        rollback: () => {
          triggerStoreRollback(itemId);
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
        triggerStoreRollback(itemId);
      }
    }
  };

  if (isLoading) {
    return <div className="loading-spinner">Loading list details...</div>;
  }

  if (isForbidden) {
    return (
      <div className="list-detail-container" style={{ textAlign: "center", marginTop: "50px" }}>
        <h2>Access Denied</h2>
        <p>You are not a collaborator on this list.</p>
        <button className="add-button" onClick={() => window.location.href = "/my-lists"} style={{ marginTop: "20px" }}>
          Go to My Lists
        </button>
      </div>
    );
  }

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collaboratorEmail.trim() || !id) return;
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";
      const token = localStorage.getItem("jwt_token") || "";
      const res = await window.fetch(`${API_URL}/api/lists/${id}/collaborators`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ email: collaboratorEmail })
      });
      if (res.ok) {
        setCollaboratorEmail("");
        alert("Collaborator added successfully!");
      } else {
        alert("Failed to add collaborator.");
      }
    } catch (e) {
      console.error(e);
      alert("Error adding collaborator.");
    }
  };

  return (
    <div className="list-detail-container">
      {syncErrorMessage && (
        <div className="location-warning-banner" style={{ marginBottom: '10px' }}>
          <span>{syncErrorMessage}</span>
          <button className="close-banner-btn" onClick={() => setSyncErrorMessage(null)}>✕</button>
        </div>
      )}

      {showBanner && permissionStatus === "denied" && (
        <div className="location-warning-banner">
          <span>Location access is disabled. Some features may be limited.</span>
          <button className="close-banner-btn" onClick={() => setShowBanner(false)}>✕</button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <button className="add-button" onClick={() => window.location.href = "/my-lists"} style={{ padding: "5px 10px" }}>
          ← Back to My Lists
        </button>
        <form onSubmit={handleAddCollaborator} style={{ display: "flex", gap: "10px" }}>
          <input
            type="email"
            value={collaboratorEmail}
            onChange={(e) => setCollaboratorEmail(e.target.value)}
            placeholder="Collaborator Email"
            className="add-input"
            style={{ width: "200px" }}
          />
          <button type="submit" className="add-button">Add</button>
        </form>
      </div>

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
