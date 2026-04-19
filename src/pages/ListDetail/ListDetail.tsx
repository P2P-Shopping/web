import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import stompClient from "../../services/socketService";
import ShoppingListItems from "../../components/ShoppingList/ShoppingListItems";
import "./ListDetail.css";

interface Item {
    id: string;
    name: string;
    checked: boolean;
}

const ListDetail: React.FC<{ isEmbedded?: boolean }> = ({ isEmbedded = false }) => {
    const { id } = useParams<{ id: string }>();
    const [items, setItems] = useState<Item[]>([]);
    const [newItemName, setNewItemName] = useState("");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    
    // NEW: Stări pentru erori și conectivitate
    const [error, setError] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

    const isNavView = useLocation().pathname.includes("/nav");

    // Monitorizăm conexiunea la internet a dispozitivului
    useEffect(() => {
        const handleStatusChange = () => setIsOnline(navigator.onLine);
        window.addEventListener("online", handleStatusChange);
        window.addEventListener("offline", handleStatusChange);
        return () => {
            window.removeEventListener("online", handleStatusChange);
            window.removeEventListener("offline", handleStatusChange);
        };
    }, []);

    useEffect(() => {
        const fetchListData = async () => {
            // Nu încercăm fetch dacă suntem pe o rută demo sau fără ID
            if (isEmbedded || !id || id === "default") {
                setIsLoading(false);
                setError("Select a real list to start syncing.");
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8081";
                const token = localStorage.getItem("token");
                const headers: HeadersInit = { "Content-Type": "application/json" };
                
                if (token) {
                    headers["Authorization"] = `Bearer ${token}`;
                } else {
                    throw new Error("Nu ești logată! Te rugăm să mergi pe pagina de Login.");
                }

                // Revenim la endpoint-ul care știm sigur că există în backend-ul tău
                const response = await fetch(`${baseUrl}/api/lists`, { headers });

                if (!response.ok) {
                    throw new Error(`Eroare server: ${response.status} (Verifică dacă token-ul e valid)`);
                }

                const allLists: any[] = await response.json();
                const currentList = allLists.find(l => l.id === id);

                if (currentList) {
                    const mappedItems = currentList.items.map((it: any) => ({
                        id: it.id,
                        name: it.name,
                        checked: it.isChecked 
                    }));
                    setItems(mappedItems);
                } else {
                    throw new Error("Lista nu a fost găsită în baza de date.");
                }
            } catch (err: any) {
                setError(err.message || "Failed to load items.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchListData();
    }, [id, isEmbedded]);

    // ... handleCheck și addItem rămân la fel, dar verifică isOnline
    const addItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isOnline) return; // Blocăm adăugarea dacă nu avem net
        
        const trimmedName = newItemName.trim();
        if (trimmedName === "") return;

        const newItem: Item = { id: crypto.randomUUID(), name: trimmedName, checked: false };
        setItems((prev) => [...prev, newItem]);
        setNewItemName("");

        if (id && stompClient.connected) {
            stompClient.publish({
                destination: "/app/sync",
                body: JSON.stringify({ eventType: "ITEM_ADDED", listId: id, item: newItem })
            });
        }
    };

    const handleCheck = (itemId: string) => {
        // Nu permitem modificări dacă suntem offline
        if (!isOnline) return;

        const currentItem = items.find((item) => item.id === itemId);
        if (!currentItem) return;

        const newChecked = !currentItem.checked;

        // Update local imediat (Optimistic UI)
        setItems(prev => prev.map(it => it.id === itemId ? { ...it, checked: newChecked } : it));

        // Trimitem modificarea prin WebSocket
        if (id && stompClient.connected) {
            const payload = JSON.stringify({ 
                eventType: "ITEM_TOGGLED", 
                listId: id, 
                itemId: itemId, 
                checked: newChecked 
            });
            
            stompClient.publish({ 
                destination: "/app/sync", 
                body: payload 
            });
        }
    };
    
    const listContent = (
        <>
            <div className="sidebar-header">
                <h3>Shopping List</h3>
                {isNavView && (
                    <button className="close-sidebar-btn" >
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                )}
            </div>

            {/* MUTAT AICI: Mesajele de eroare stau acum sub header, pe propriul lor rând */}
            {!isOnline && <div className="offline-banner">⚠️ Offline Mode - Changes won't sync</div>}
            {error && <div className="error-msg">{error}</div>}

            <form onSubmit={addItem} className="add-item-form-sidebar">
                <input 
                    type="text" 
                    value={newItemName} 
                    onChange={(e) => setNewItemName(e.target.value)} 
                    placeholder={isOnline ? "Add item..." : "Offline..."}
                    className="sidebar-input"
                    disabled={!isOnline}
                />
                <button type="submit" className="sidebar-add-btn" disabled={!isOnline || isLoading}>Add</button>
            </form>

            {isLoading ? (
                <div className="loading-spinner">Loading list... 🔄</div>
            ) : (
                <ShoppingListItems items={items} onCheck={handleCheck} />
            )}
        </>
    );

    return (
        <div className={isNavView ? "nav-sidebar-wrapper" : "full-page-wrapper"}>
            <div className={isNavView ? "list-detail-sidebar open" : "centered-list-card"}>
                {listContent}
            </div>
        </div>
    );
};
export default ListDetail;