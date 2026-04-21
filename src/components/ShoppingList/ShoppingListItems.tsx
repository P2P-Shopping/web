import type React from "react";

interface Item {
    id: string;
    name: string;
    checked: boolean;
    brand?: string;
    quantity?: string;
    price?: number;
    category?: string;
}

interface Props {
    items: Item[];
    onCheck: (id: string) => void;
}

const ShoppingListItems: React.FC<Props> = ({ items, onCheck }) => {
    if (items.length === 0) {
        return <p className="empty-msg">Your list is empty!</p>;
    }

    return (
        <ul className="shopping-list">
            {items.map((item) => (
                <li
                    key={item.id}
                    className={`shopping-item ${item.checked ? "item-completed" : ""}`}
                >
                    <label className="item-label">
                        <input
                            type="checkbox"
                            className="item-checkbox"
                            checked={item.checked}
                            onChange={() => onCheck(item.id)}
                        />
                        <div>
                            <span
                                style={{
                                    fontSize: "16px",
                                    fontWeight: "bold",
                                    color: "#2e1a5e",
                                    textDecoration: item.checked
                                        ? "line-through"
                                        : "none",
                                    opacity: item.checked ? 0.6 : 1,
                                }}
                            >
                                {item.name}
                            </span>
                            <div style={{ fontSize: "12px", color: "#444" }}>
                                {item.brand && <span>{item.brand}</span>}
                                {item.quantity && (
                                    <span> • {item.quantity}</span>
                                )}
                                {item.price != null && (
                                    <span> • {item.price.toFixed(2)} RON</span>
                                )}
                                {item.category && (
                                    <span
                                        style={{
                                            fontStyle: "italic",
                                            color: "#6c4ab3",
                                        }}
                                    >
                                        {` [${item.category}]`}
                                    </span>
                                )}
                            </div>
                        </div>
                    </label>
                </li>
            ))}
        </ul>
    );
};

export default ShoppingListItems;
