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
    onDelete?: (id: string) => void;
}

const formatPrice = (price: number) => `${price.toFixed(2)} RON`;

const ShoppingListItems: React.FC<Props> = ({ items, onCheck, onDelete }) => {
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
                                className="item-name-text"
                                style={{
                                    textDecoration: item.checked
                                        ? "line-through"
                                        : "none",
                                    opacity: item.checked ? 0.6 : 1,
                                }}
                            >
                                {item.name}
                            </span>
                            <div className="item-meta-text">
                                {item.brand && <span>{item.brand}</span>}
                                {item.quantity && (
                                    <span> • {item.quantity}</span>
                                )}
                                {item.price != null && (
                                    <span> • {formatPrice(item.price)}</span>
                                )}
                                {item.category && (
                                    <span className="item-category-text">
                                        {` [${item.category}]`}
                                    </span>
                                )}
                            </div>
                        </div>
                    </label>
                    {onDelete && (
                        <button
                            type="button"
                            className="item-inline-remove"
                            onClick={() => onDelete(item.id)}
                            aria-label="Remove item"
                        >
                            ×
                        </button>
                    )}
                </li>
            ))}
        </ul>
    );
};

export default ShoppingListItems;

