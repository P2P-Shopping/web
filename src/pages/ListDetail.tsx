import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import stompClient from "../services/socketService";

interface Item {
  id: string; // Added unique ID
  name: string;
  checked: boolean;
}

const readItems = (id: string | undefined): Item[] => {
  if (!id) return [];
  const saved = localStorage.getItem(`list-${id}`);
  return saved ? JSON.parse(saved) : [];
};

const ListDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [permissionStatus, setPermissionStatus] = useState<PermissionState | null>(null);
  const [showBanner, setShowBanner] = useState(true);

  // Sync items when ID changes
  useEffect(() => {
    setItems(readItems(id));
  }, [id]);

  // Persist items to localStorage
  useEffect(() => {
    if (!id) return;
    localStorage.setItem(`list-${id}`, JSON.stringify(items));
  }, [items, id]);

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
    const previousItems = [...items]; // Backup state for potential rollback
    const targetItem = items.find((item) => item.id === itemId);
    
    if (!targetItem) return;

    const nextStatus = !targetItem.checked;

    // Optimistic UI Update: change state immediately
    setItems(
      items.map((item) => (item.id === itemId ? { ...item, checked: nextStatus } : item))
    );

    try {
      if (!stompClient.connected) {
        // Fix for SonarCloud: Passing a specific message to the Error constructor
        throw new Error("Unable to sync: WebSocket connection is closed");
      }

      stompClient.publish({
        destination: `/app/list/${id}/update`,
        body: JSON.stringify({
          action: "UPDATE",
          itemId: itemId,
          content: JSON.stringify({ checked: nextStatus }),
        }),
      });
    } catch (error) {
      // Fix for SonarCloud: Explicitly handling the exception with a rollback and logging
      setItems(previousItems);
      console.error("Optimistic UI failed, state reverted:", error instanceof Error ? error.message : error);
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
