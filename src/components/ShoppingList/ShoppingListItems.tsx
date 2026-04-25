import { Check, Trash2 } from "lucide-react";
import React from "react";

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
    disabled?: boolean;
}

const formatPrice = (price: number) => `${price.toFixed(2)} RON`;

const ShoppingListItems: React.FC<Props> = ({
    items,
    onCheck,
    onDelete,
    disabled = false,
}) => {
    if (items.length === 0) {
        return (
            <p className="text-center py-12 text-text-muted italic">
                Your list is empty!
            </p>
        );
    }

    return (
        <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
            {items.map((item) => (
                <li
                    key={item.id}
                    className={`flex items-center justify-between p-4 bg-bg-subtle border border-border rounded-xl transition-all duration-200 hover:bg-surface hover:shadow-md group ${item.checked ? "opacity-60" : ""}`}
                >
                    <label
                        className={`flex items-center gap-4 flex-1 min-w-0 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >
                        <input
                            type="checkbox"
                            className="sr-only"
                            checked={item.checked}
                            onChange={() => onCheck(item.id)}
                            disabled={disabled}
                        />
                        <div
                            className={`relative flex items-center justify-center w-6 h-6 rounded-md border-2 transition-all shrink-0 ${item.checked ? "bg-success border-success" : "bg-surface border-border-strong group-hover:border-accent"}`}
                        >
                            {item.checked && (
                                <Check
                                    size={14}
                                    strokeWidth={4}
                                    className="text-white"
                                />
                            )}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                            <span
                                className={`text-base font-medium text-text-strong wrap-break-word transition-all ${item.checked ? "line-through opacity-60" : ""}`}
                            >
                                {item.name}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted mt-0.5">
                                {(() => {
                                    const parts: React.ReactNode[] = [];
                                    if (item.brand) {
                                        parts.push(
                                            <span
                                                key="brand"
                                                className="px-1.5 py-0.5 bg-bg-muted rounded text-[10px] uppercase font-bold tracking-wider"
                                            >
                                                {item.brand}
                                            </span>,
                                        );
                                    }
                                    if (item.quantity) {
                                        parts.push(
                                            <span key="qty">
                                                {item.quantity}
                                            </span>,
                                        );
                                    }
                                    if (item.price != null) {
                                        parts.push(
                                            <span key="price">
                                                {formatPrice(item.price)}
                                            </span>,
                                        );
                                    }
                                    if (item.category) {
                                        parts.push(
                                            <span
                                                key="category"
                                                className="text-accent/70 font-medium"
                                            >
                                                {`#${item.category}`}
                                            </span>,
                                        );
                                    }

                                    return parts.map((part, index) => {
                                        const partKey =
                                            (part as React.ReactElement).key ||
                                            index;
                                        return (
                                            <React.Fragment
                                                key={`meta-${partKey}`}
                                            >
                                                {index > 0 && <span> • </span>}
                                                {part}
                                            </React.Fragment>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </label>
                    {onDelete && (
                        <button
                            type="button"
                            className="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all hover:bg-danger-subtle hover:text-danger shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item.id);
                            }}
                            disabled={disabled}
                            aria-label={`Remove ${item.name}`}
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </li>
            ))}
        </ul>
    );
};

export default ShoppingListItems;
