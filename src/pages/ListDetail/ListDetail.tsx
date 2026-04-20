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

const ListDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [items, setItems] = useState<Item[]>([]);
    const [newItemName, setNewItemName] = useState("");
    const [brand, setBrand] = useState("");
    const [quantity, setQuantity] = useState("");
    const [category, setCategory] = useState("Altele");
    const [isRecurrent, setIsRecurrent] = useState(false);
    
    const [recipeText, setRecipeText] = useState("");
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchListData = async () => {
        if (!id || id === "default") {
            setIsLoading(false);
            return;
        }
        try {
            const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8081";
            const token = localStorage.getItem("token");
            const response = await fetch(`${baseUrl}/api/lists`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Failed to fetch lists");

            const allLists = await response.json();
            const currentList = allLists.find((l: any) => l.id === id);

            if (currentList) {
                const mappedItems = currentList.items.map((it: any) => ({
                    id: it.id,
                    name: it.name,
                    checked: it.isChecked,
                    brand: it.brand,
                    price: it.price,
                    quantity: it.quantity,
                    category: it.category,
                    isRecurrent: it.isRecurrent
                }));
                setItems(mappedItems);
            }
        } catch (err: any) {
            setError("Nu s-a putut sincroniza lista.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchListData();
    }, [id]);

    const handleAiImport = async () => {
        if (!recipeText.trim() || !id) return;
        setIsAiLoading(true);
        setError(null);
        try {
            const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8081";
            const token = localStorage.getItem("token");
            
            const response = await fetch(`${baseUrl}/api/ai/recipe-to-list`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ rawText: recipeText, listId: id })
            });

            if (response.ok) {
                setRecipeText("");
                await fetchListData(); // Refresh listă
            } else {
                throw new Error("AI Service error");
            }
        } catch (err) {
            setError("Eroare la procesarea AI. Verifică backend-ul.");
        } finally {
            setIsAiLoading(false);
        }
    };

    const addItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (newItemName.trim() === "") return;

        const newItem: Item = {
            id: crypto.randomUUID(),
            name: newItemName.trim(),
            checked: false,
            brand: brand || undefined,
            quantity: quantity || undefined,
            category: category,
            isRecurrent: isRecurrent
        };

        setItems(prev => [...prev, newItem]);
        setNewItemName(""); setBrand(""); setQuantity(""); // Reset formular

        if (id && stompClient.connected) {
            stompClient.publish({
                destination: "/app/sync",
                body: JSON.stringify({ eventType: "ITEM_ADDED", listId: id, item: newItem })
            });
        }
    };

    const handleCheck = (itemId: string) => {
        const currentItem = items.find(it => it.id === itemId);
        if (!currentItem) return;

        const newChecked = !currentItem.checked;
        
        // Optimistic UI
        setItems(prev => prev.map(it => it.id === itemId ? { ...it, checked: newChecked } : it));

        if (id && stompClient.connected) {
            stompClient.publish({
                destination: "/app/sync",
                body: JSON.stringify({ 
                    eventType: "ITEM_TOGGLED", 
                    listId: id, 
                    itemId: itemId, 
                    checked: newChecked 
                })
            });
        }
    };

    return (
        <div className="full-page-wrapper">
            <div className="centered-list-card">
                <h3 style={{ textAlign: 'center', color: '#2e1a5e', marginBottom: '20px' }}>Shopping List</h3>
                
                {error && <div className="error-msg">⚠️ {error}</div>}

                {/* Task 13: Secțiunea AI Magic */}
                <div className="ai-import-section">
                    <textarea 
                        rows={3}
                        value={recipeText}
                        onChange={(e) => setRecipeText(e.target.value)}
                        placeholder="Paste your recipe here (e.g. 2 eggs, milk...)"
                    />
                    <button onClick={handleAiImport} className="ai-btn" disabled={isAiLoading}>
                        {isAiLoading ? "✨ Processing..." : "AI Magic Import"}
                    </button>
                </div>

                {/* Task 12: Formular Adăugare Manuală */}
                <form onSubmit={addItem} className="add-item-form-sidebar">
                    <input 
                        type="text" value={newItemName} 
                        onChange={e => setNewItemName(e.target.value)} 
                        placeholder="Item Name*" className="sidebar-input" required 
                    />
                    <div className="row-inputs">
                        <input 
                            type="text" value={brand} 
                            onChange={e => setBrand(e.target.value)} 
                            placeholder="Brand" className="sidebar-input" 
                        />
                        <input 
                            type="text" value={quantity} 
                            onChange={e => setQuantity(e.target.value)} 
                            placeholder="Qty" className="sidebar-input" 
                        />
                    </div>
                    <select 
                        value={category} 
                        onChange={e => setCategory(e.target.value)} 
                        className="sidebar-input"
                    >
                        <option value="Altele">Category...</option>
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
                            onChange={e => setIsRecurrent(e.target.checked)} 
                        />
                        Add to frequent items
                    </label>
                    <button type="submit" className="sidebar-add-btn">Add to List</button>
                </form>

                {isLoading ? (
                    <p style={{ textAlign: 'center', marginTop: '20px' }}>Loading list...</p>
                ) : (
                    <ShoppingListItems items={items} onCheck={handleCheck} />
                )}
            </div>
        </div>
    );
};

export default ListDetail;