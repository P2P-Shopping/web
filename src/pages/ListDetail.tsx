import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import stompClient from "../services/socketService";
import axios from "axios";

interface Item {
  id: string; // Added unique ID
  name: string;
  checked: boolean;
}

class SyncPayloadBuilder {
  private payload: Record<string, any> = {
    eventType: "ITEM_TOGGLED",
    timestamp: Date.now()
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

  const [isSharing, setIsSharing] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareEmail.trim()) return;
    
    try {
      await axios.post(`/api/lists/${id}/share`, { email: shareEmail });
      setToast({ message: "Invitation sent successfully!", type: "success" });
      setShareEmail("");
      setIsSharing(false);
    } catch (err) {
      setToast({ message: "Failed to send invitation.", type: "error" });
    }
    
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

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
    setItems((prevItems) => 
      prevItems.map((item) => {
        if (item.id === itemId) {
          const newChecked = !item.checked;
          const payload = new SyncPayloadBuilder()
            .setListId(id || "unknown")
            .setItemId(item.id)
            .setChecked(newChecked)
            .build();
            
          if (stompClient.connected) {
            stompClient.publish({
              destination: "/app/sync",
              body: payload
            });
          }
          
          return { ...item, checked: newChecked };
        }
        return item;
      })
    );
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

      <div className="header-actions">
        <button onClick={() => setIsSharing(!isSharing)} className="share-btn">
          {isSharing ? "Cancel Share" : "Share List"}
        </button>
      </div>

      {isSharing && (
        <form onSubmit={handleShare} className="share-form">
          <input
            type="email"
            value={shareEmail}
            onChange={(e) => setShareEmail(e.target.value)}
            placeholder="Collaborator's email"
            className="share-input"
            required
          />
          <button type="submit" className="share-submit-btn">
            Send Invite
          </button>
        </form>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
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
