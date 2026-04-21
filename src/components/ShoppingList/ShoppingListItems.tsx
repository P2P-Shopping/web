import { useMemo } from "react";
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
    currency?: string;
    locale?: string;
}

const ShoppingListItems: React.FC<Props> = ({
    items,
    onCheck,
    currency = "RON",
    locale = "ro-RO",
}) => {
    const formatter = useMemo(() => {
        try {
            return new Intl.NumberFormat(locale, {
                style: "currency",
                currency: currency,
            });
        } catch {
            return null;
        }
    }, [locale, currency]);

    if (items.length === 0) {
        return <p className="empty-msg">Your list is empty!</p>;
    }

    const formatPrice = (price: number) => {
        if (formatter) {
            return formatter.format(price);
        }
        return `${price.toFixed(2)} ${currency}`;
    };

    return (
        <ul className="shopping-list">
            {items.map((item) => (
                <li
                    key={item.id}
                    className={`shopping-list-item ${item.checked ? "item-completed" : ""}`}
                >
                    <label className="shopping-item-label">
                        <input
                            type="checkbox"
                            className="item-checkbox"
                            checked={item.checked}
                            onChange={() => onCheck(item.id)}
                        />
                        <div>
                            <span
                                className={`shopping-item-name ${item.checked ? "completed" : ""}`}
                            >
                                {item.name}
                            </span>
                            <div className="shopping-item-meta">
                                {item.brand && <span>{item.brand}</span>}
                                {item.quantity && (
                                    <span> • {item.quantity}</span>
                                )}
                                {item.price != null && (
                                    <span> • {formatPrice(item.price)}</span>
                                )}
                                {item.category && (
                                    <span className="shopping-item-category">
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
