import type React from "react";

interface Item {
    id: string;
    name: string;
    checked: boolean;
}

interface Props {
    items: Item[];
    onCheck: (id: string) => void;
}

const ShoppingListItems: React.FC<Props> = ({ items, onCheck }) => {
    if (items.length === 0)
        return <p className="empty-msg">Your list is empty!</p>;

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
                            checked={item.checked}
                            onChange={() => onCheck(item.id)}
                            className="item-checkbox"
                        />
                        <span className="item-text">{item.name}</span>
                    </label>
                </li>
            ))}
        </ul>
    );
};

export default ShoppingListItems;
