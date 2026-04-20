import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "react-router-dom";
import stompClient from "../../services/socketService";
import ShoppingListItems from "../../components/ShoppingList/ShoppingListItems";
import "./ListDetail.css";

interface Item {
    id: string;
    name: string;
    checked: boolean;
}

interface ListDetailProps {
    isEmbedded?: boolean;
}

const ListDetail: React.FC<ListDetailProps> = ({ isEmbedded = false }) => {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const isNavView = location.pathname.includes("/nav");

    const [items, setItems] = useState<Item[]>([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [newItemName, setNewItemName] = useState("");
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const RECEIPT_TIMEOUT_MS = 5000;
    const pendingRollbacksRef = useRef(new Map<string, { timeoutId: number; rollback: () => void }>());

    useEffect(() => {
        const fetchListData = async () => {
            // 1. VERIFICARE PREVENTIVĂ: Skip fetch pe hartă sau pentru rute demo
            if (isEmbedded || !id || id === "default") {
                setItems([
                    { id: "1", name: "Lapte de ovăz", checked: false },
                    { id: "2", name: "Pâine integrală", checked: false },
                    { id: "3", name: "Roșii cherry", checked: false },
                    { id: "4", name: "Detergent de rufe", checked: false },
                ]);
                setIsLoading(false);
                return; 
            }

            setIsLoading(true);
            try {
                // 2. CONFIGURARE URL ȘI TOKEN: Eliminăm hardcodarea portului
                const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8081";
                const token = localStorage.getItem("token");

                // 3. SECUTIZARE HEADERS: Evităm "Bearer null"
                const headers: HeadersInit = {
                    "Content-Type": "application/json"
                };
                if (token) {
                    headers["Authorization"] = `Bearer ${token}`;
                }

                const response = await fetch(`${baseUrl}/api/lists`, { headers });

                if (!response.ok) throw new Error(`Eroare server: ${response.status}`);

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
                    throw new Error("Lista nu a fost găsită.");
                }
            } catch (err: any) {
                console.error("Eroare la fetch:", err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchListData();
    }, [id, isNavView, isEmbedded]); 

    const handleCheck = (itemId: string) => {
        const currentItem = items.find((item) => item.id === itemId);
        if (!currentItem) return;
        const previousItems = [...items];
        const newChecked = !currentItem.checked;
        
        // Update local rapid
        setItems(prev => prev.map(it => it.id === itemId ? { ...it, checked: newChecked } : it));

        // Sincronizare live prin WebSockets
        if (id && stompClient.connected) {
            const payload = JSON.stringify({ eventType: "ITEM_TOGGLED", listId: id, itemId: itemId, checked: newChecked });
            const receiptId = `rcpt-${crypto.randomUUID()}`;
            const timeoutId = window.setTimeout(() => {
                const entry = pendingRollbacksRef.current.get(receiptId);
                if (entry) { entry.rollback(); pendingRollbacksRef.current.delete(receiptId); }
            }, RECEIPT_TIMEOUT_MS);
            
            pendingRollbacksRef.current.set(receiptId, { timeoutId, rollback: () => setItems(previousItems) });
            stompClient.publish({ destination: "/app/sync", body: payload, headers: { receipt: receiptId } });
        }
    };

    const addItem = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newItemName.trim(); // CodeRabbit fix: trimming corect
        if (trimmedName === "") return;

        const newItem: Item = { 
            id: crypto.randomUUID(), 
            name: trimmedName, 
            checked: false 
        };

        // Update stării folosind varianta funcțională pentru a evita datele vechi
        setItems((prevItems) => [...prevItems, newItem]);
        setNewItemName("");

        // Sincronizare live pentru adăugare
        if (id && stompClient.connected) {
            const payload = JSON.stringify({
                eventType: "ITEM_ADDED",
                listId: id,
                item: newItem 
            });
            stompClient.publish({ destination: "/app/sync", body: payload });
        }
    };

    // listContent definit aici pentru a păstra focusul la input
    const listContent = (
        <>
            <div className="sidebar-header">
                <h3>Shopping List</h3>
                {isNavView && (
                    <button className="close-sidebar-btn" onClick={() => setIsSidebarOpen(false)}>
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                )}
            </div>
            <form onSubmit={addItem} className="add-item-form-sidebar">
                <input 
                    type="text" 
                    value={newItemName} 
                    onChange={(e) => setNewItemName(e.target.value)} 
                    placeholder="Add item..." 
                    className="sidebar-input" 
                />
                <button type="submit" className="sidebar-add-btn">Add</button>
            </form>
            <ShoppingListItems items={items} onCheck={handleCheck} />
        </>
    );

    return (
        <div className={isNavView ? "nav-sidebar-wrapper" : "full-page-wrapper"}>
            {isNavView ? (
                <>
                    {!isSidebarOpen && (
                        <div className="open-list-container">
                            <button className="open-list-btn-modern" onClick={() => setIsSidebarOpen(true)}>
                                <span className="cart-icon">🛒</span> Open List
                            </button>
                        </div>
                    )}
                    <div className={`list-detail-sidebar ${isSidebarOpen ? "open" : ""}`}>
                        {listContent}
                    </div>
                </>
            ) : (
                <div className="centered-list-card">
                    {listContent}
                </div>
            )}
        </div>
    );
};

export default ListDetail;