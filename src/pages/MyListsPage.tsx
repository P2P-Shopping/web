import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface ShoppingList {
  id: string;
  title: string;
}

const MyListsPage: React.FC = () => {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchLists = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";
      const token = localStorage.getItem("jwt_token") || "";
      
      const res = await window.fetch(`${API_URL}/api/lists`, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        }
      });
      
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          navigate("/login");
          return;
        }
        throw new Error("Failed to load lists.");
      }
      
      const data = await res.json();
      setLists(data || []);
    } catch (err: any) {
      console.error("Error fetching lists:", err);
      setError(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, [navigate]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";
      const token = localStorage.getItem("jwt_token") || "";
      
      const res = await window.fetch(`${API_URL}/api/lists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ title: newTitle })
      });
      
      if (!res.ok) throw new Error("Failed to create list.");
      
      const newList = await res.json();
      setLists((prev) => [...prev, newList]);
      setNewTitle("");
    } catch (err: any) {
      console.error("Error creating list:", err);
      alert(err.message || "Error creating list.");
    }
  };

  return (
    <div className="list-detail-container" style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
      <h2>My Shopping Lists</h2>
      
      <form onSubmit={handleCreateList} className="add-item-form" style={{ marginBottom: "30px" }}>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New List Title..."
          className="add-input"
        />
        <button type="submit" className="add-button">Create</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}
      
      {isLoading ? (
        <div className="loading-spinner">Loading lists...</div>
      ) : (
        <ul className="shopping-list" style={{ listStyleType: "none", padding: 0 }}>
          {lists.map((list) => (
            <li key={list.id} className="shopping-item" style={{ cursor: "pointer", display: "flex", justifyContent: "space-between" }} onClick={() => navigate(`/list/${list.id}`)}>
              <span className="item-text" style={{ fontWeight: "bold" }}>{list.title}</span>
              <span>→</span>
            </li>
          ))}
          {lists.length === 0 && <p className="empty-msg">You don't have any lists yet!</p>}
        </ul>
      )}
    </div>
  );
};

export default MyListsPage;
