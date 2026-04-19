import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import stompClient from "../../services/socketService";
import ShoppingListItems from "../../components/ShoppingList/ShoppingListItems";
import "./ListDetail.css";

interface Item {
    id: string;
    name: string;
    checked: boolean;
    brand?: string;
    quantity?: string;
    price?: number;
    category?: string;
    isRecurrent?: boolean;
}

<<<<<<< HEAD
const ListDetail: React.FC = () => {
=======
const generateTempId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return URL.createObjectURL(new Blob()).split('/').pop() || `temp-${Date.now()}`;
};

const ListDetail: React.FC<{ isEmbedded?: boolean }> = ({ isEmbedded = false }) => {
>>>>>>> 44b6818e13395b0ce909ac69cea5f4fbf9459fba
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const isNavView = location.pathname.includes("/nav") || isEmbedded;

    const [items, setItems] = useState<Item[]>([]);
    const [newItemName, setNewItemName] = useState("");
<<<<<<< HEAD
    const [brand, setBrand] = useState("");
    const [quantity, setQuantity] = useState("");
    const [category, setCategory] = useState("Altele");
    const [isRecurrent, setIsRecurrent] = useState(false);
    
    const [recipeText, setRecipeText] = useState("");
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchListData = async () => {
        if (!id) return;
        try {
            const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8081";
            const token = localStorage.getItem("token");
            const response = await fetch(`${baseUrl}/api/lists`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const allLists = await response.json();
            const currentList = allLists.find((l: any) => l.id === id);
            if (currentList) {
                setItems(currentList.items.map((it: any) => ({
                    id: it.id, name: it.name, checked: it.isChecked,
                    brand: it.brand, price: it.price, quantity: it.quantity,
                    category: it.category, isRecurrent: it.isRecurrent
                })));
            }
        } catch (err) { setError("Failed to sync data."); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchListData(); }, [id]);

    const handleAiImport = async () => {
        if (!recipeText.trim()) return;
        setIsAiLoading(true);
        try {
            const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8081";
            const token = localStorage.getItem("token");
            const response = await fetch(`${baseUrl}/api/ai/recipe-to-list`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ rawText: recipeText, listId: id })
            });
            if (response.ok) { setRecipeText(""); fetchListData(); }
        } catch (e) { setError("AI Service unavailable."); }
        finally { setIsAiLoading(false); }
    };

    const addItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemName.trim()) return;
        const newItem: Item = {
            id: crypto.randomUUID(), name: newItemName.trim(), checked: false,
            brand, quantity, category, isRecurrent
        };
        setItems(prev => [...prev, newItem]);
        setNewItemName(""); setBrand(""); setQuantity("");
        if (id && stompClient.connected) {
            stompClient.publish({
                destination: "/app/sync",
                body: JSON.stringify({ eventType: "ITEM_ADDED", listId: id, item: newItem })
            });
        }
    };

    const handleCheck = (itemId: string) => {
        const currentItem = items.find(it => it.id === itemId);
=======
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState<boolean>(stompClient.connected);
    
    // REINTODUS: Starea originală pentru toggle
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        const checkConnection = () => setIsOnline(stompClient.connected);
        checkConnection();
        const intervalId = setInterval(checkConnection, 1000);
        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        const fetchListData = async () => {
            if (!id || id === "default") {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8081";
                const headers: HeadersInit = { "Content-Type": "application/json" };
                const response = await fetch(`${baseUrl}/api/lists`, { headers });

                if (!response.ok) throw new Error(`Server error: ${response.status}`);

                const allLists: any[] = await response.json();
                const currentList = allLists.find(l => l.id === id);

                if (currentList) {
                    setItems(currentList.items.map((it: any) => ({
                        id: it.id,
                        name: it.name,
                        checked: it.isChecked 
                    })));
                } else {
                    throw new Error("List not found.");
                }
            } catch (err: any) {
                setError(err.message || "Failed to load items.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchListData();
    }, [id]);

    const addItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!stompClient.connected || !id) {
            setError("Cannot sync. Reconnecting...");
            return; 
        }
        const trimmedName = newItemName.trim();
        if (trimmedName === "") return;

        const newItem: Item = { id: generateTempId(), name: trimmedName, checked: false };
        setItems(prev => [...prev, newItem]);
        setNewItemName("");

        stompClient.publish({
            destination: "/app/sync",
            body: JSON.stringify({ eventType: "ITEM_ADDED", listId: id, item: newItem })
        });
    };

    const handleCheck = (itemId: string) => {
        if (!stompClient.connected || !id) return;
        const currentItem = items.find((item) => item.id === itemId);
>>>>>>> 44b6818e13395b0ce909ac69cea5f4fbf9459fba
        if (!currentItem) return;
        const newChecked = !currentItem.checked;
        setItems(prev => prev.map(it => it.id === itemId ? { ...it, checked: newChecked } : it));
<<<<<<< HEAD
        if (id && stompClient.connected) {
            stompClient.publish({
                destination: "/app/sync",
                body: JSON.stringify({ eventType: "ITEM_TOGGLED", listId: id, itemId, checked: newChecked })
            });
        }
    };

    return (
        <div className="full-page-wrapper">
            <div className="centered-list-card">
                <h3 style={{ textAlign: 'center', color: '#2e1a5e' }}>Shopping List</h3>
                
                {error && <div className="error-msg">{error}</div>}

                {/* Secțiunea AI Magic */}
                <div className="ai-import-section">
                    <textarea 
                        rows={3} value={recipeText}
                        onChange={(e) => setRecipeText(e.target.value)}
                        placeholder="Paste a recipe (e.g. 2 eggs, Zuzu milk...)"
                    />
                    <button onClick={handleAiImport} className="ai-btn" disabled={isAiLoading}>
                        {isAiLoading ? "✨ Processing..." : "AI Magic Import"}
                    </button>
                </div>

                {/* Formular Manual Vertical */}
                <form onSubmit={addItem} className="add-item-form-sidebar">
                    <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Item Name*" className="sidebar-input" required />
                    <div className="row-inputs">
                        <input type="text" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Brand" className="sidebar-input" />
                        <input type="text" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Qty" className="sidebar-input" />
                    </div>
                    <select value={category} onChange={e => setCategory(e.target.value)} className="sidebar-input">
                        <option value="Altele">Category...</option>
                        <option value="Lactate">Lactate</option>
                        <option value="Legume">Legume</option>
                        <option value="Carne">Carne</option>
                        <option value="Băuturi">Băuturi</option>
                    </select>
                    <label className="recurrence-label">
                        <input type="checkbox" checked={isRecurrent} onChange={e => setIsRecurrent(e.target.checked)} />
                        Add to frequent items
                    </label>
                    <button type="submit" className="sidebar-add-btn">Add to List</button>
                </form>

                {isLoading ? <p style={{textAlign:'center'}}>Loading...</p> : <ShoppingListItems items={items} onCheck={handleCheck} />}
            </div>
=======

        stompClient.publish({ 
            destination: "/app/sync", 
            body: JSON.stringify({ eventType: "ITEM_TOGGLED", listId: id, itemId: itemId, checked: newChecked }) 
        });
    };
    
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

            {!isOnline && <div className="offline-banner">⚠️ Offline</div>}
            {error && <div className="error-msg">{error}</div>}

            <form onSubmit={addItem} className="add-item-form-sidebar">
                <input 
                    type="text" 
                    value={newItemName} 
                    onChange={(e) => setNewItemName(e.target.value)} 
                    placeholder="Add item..."
                    className="sidebar-input"
                    disabled={!isOnline || !id}
                />
                <button type="submit" className="sidebar-add-btn">Add</button>
            </form>

            {isLoading ? <div className="loading-spinner">🔄</div> : <ShoppingListItems items={items} onCheck={handleCheck} />}
        </>
    );

    return (
        <div className={isNavView ? "nav-sidebar-wrapper" : "full-page-wrapper"}>
            {isNavView ? (
                <>
                    {/* BUTONUL ORIGINAL RESTAURAT */}
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
>>>>>>> 44b6818e13395b0ce909ac69cea5f4fbf9459fba
        </div>
    );
};

export default ListDetail;