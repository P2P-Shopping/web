import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import stompClient from "../services/socketService";

interface Item {
  id: string;
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

const sanitizeString = (input: unknown): string => {
  const s = String(input ?? "");
  const withoutScripts = s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  return withoutScripts.replace(/[<>&]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"
  );
};

const sanitizeItemsForStorage = (items: Item[]): Item[] =>
  items.map((item) => ({
    id: String(item.id),
    name: sanitizeString(item.name),
    checked: Boolean(item.checked),
  }));

// Citim strict ce e în memorie, fără să mai adăugăm mock-uri aici
const readItems = (id: string | undefined): Item[] => {
  if (!id) return [];
  const saved = localStorage.getItem(`list-${id}`);
  
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p) => ({
          id: String(p.id ?? crypto.randomUUID()),
          name: sanitizeString(p.name ?? ""),
          checked: Boolean(p.checked),
        }));
      }
    } catch {
      console.error("Corrupted data in storage");
    }
  }
  return []; 
};

const ListDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isNavView = location.pathname.includes("/nav");

  const [items, setItems] = useState<Item[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [permissionStatus, setPermissionStatus] = useState<PermissionState | null>(null);
  const [showBanner, setShowBanner] = useState(true);

  const pendingRollbacksRef = useRef(
    new Map<string, { timeoutId: number; rollback: () => void }>()
  );
  const handlersWrappedRef = useRef(false);
  const RECEIPT_TIMEOUT_MS = 5000;

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
          console.error("Rollback failed during WebSocket error:", err);
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

  // Încărcarea datelor + Logica de Mock
  useEffect(() => {
    const storedItems = readItems(id);
    
    // Dacă memoria e goală ȘI suntem pe pagina de hartă, băgăm mock-urile
    if (storedItems.length === 0 && isNavView) {
      setItems([
        { id: "1", name: "Lapte de ovăz", checked: false },
        { id: "2", name: "Pâine integrală", checked: false },
        { id: "3", name: "Roșii cherry", checked: false },
        { id: "4", name: "Detergent de rufe", checked: false },
      ]);
    } else {
      // Altfel (dacă suntem pe ruta /list sau avem deja date), încărcăm normal
      setItems(storedItems);
    }
  }, [id, isNavView]);

  // Persistă elementele în localStorage DOAR dacă nu sunt doar mock-urile de pe hartă
  useEffect(() => {
    if (!id || items.length === 0) return;

    const savedData = localStorage.getItem(`list-${id}`);
    const currentDataString = JSON.stringify(sanitizeItemsForStorage(items));

    // DACĂ suntem pe hartă ȘI nu există încă date salvate, NU salvăm mock-urile automat
    // Asta previne "poluarea" memoriei
    if (isNavView && !savedData) {
      return; 
    }

    // Salvăm doar dacă s-a schimbat ceva față de ce era în memorie
    if (currentDataString !== savedData) {
      localStorage.setItem(`list-${id}`, currentDataString);
    }
  }, [items, id, isNavView]);

  // Safe Permission Check
  useEffect(() => {
    let isMounted = true;
    let permResult: PermissionStatus | null = null;

    const handler = () => {
      if (isMounted && permResult) setPermissionStatus(permResult.state);
    };

    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" as PermissionName }).then((result) => {
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

    const previousItems = [...items];

    setItems((prevItems) =>
      prevItems.map((item) => (item.id === itemId ? { ...item, checked: newChecked } : item))
    );

    if (!id) return;

    // Dacă suntem offline, oprim execuția aici ca să NU se dea rollback la UI
    if (!stompClient.connected) {
      console.warn("Offline Mode: Produsul a fost bifat local, dar nu s-a putut sincroniza cu serverul.");
      return; 
    }

    const payload = new SyncPayloadBuilder()
      .setListId(id)
      .setItemId(itemId)
      .setChecked(newChecked)
      .build();

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
        } catch (err) {
          console.error("Rollback failed (timeout):", err);
        }
        pendingRollbacksRef.current.delete(receiptId);
      }, RECEIPT_TIMEOUT_MS);

      pendingRollbacksRef.current.set(receiptId, {
        timeoutId,
        rollback: () => {
          setItems(previousItems);
          console.error("Optimistic UI failed (no receipt), state reverted for item:", itemId);
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
        error instanceof Error ? error.message : error
      );
    }
  };

  return (
    <div className="list-detail-container">
      {showBanner && permissionStatus === "denied" && (
        <div className="location-warning-banner">
          <span>Location access is disabled. Some features may be limited.</span>
          <button className="close-banner-btn" onClick={() => setShowBanner(false)}>
            ✕
          </button>
        </div>
      )}

      {/* Am lăsat input-ul aici, în caz că utilizatorul își amintește de un produs direct în magazin */}
      <form onSubmit={addItem} className="add-item-form">
        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="Add new item..."
          className="add-input"
        />
        <button type="submit" className="add-button">
          Add Item
        </button>
      </form>

      <ul className="shopping-list">
        {items.map((item) => (
          <li key={item.id} className={`shopping-item ${item.checked ? "item-completed" : ""}`}>
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => handleCheck(item.id)}
              className="item-checkbox"
            />
            <span className="item-text">{item.name}</span>
          </li>
        ))}
      </ul>

      {items.length === 0 && <p className="empty-msg">Your list is empty!</p>}
    </div>
  );
};

export default ListDetail;