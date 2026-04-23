import { Check, Trash2 } from "lucide-react";
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
                    <button
                        type="button"
                        className="flex items-center gap-4 cursor-pointer flex-1 min-w-0 border-none bg-transparent p-0 text-left"
                        onClick={() => onCheck(item.id)}
                        aria-label={`${item.checked ? "Uncheck" : "Check"} ${item.name}`}
                    >
                        <div
                            className={`relative flex items-center justify-center w-6 h-6 rounded-md border-2 transition-all shrink-0 ${item.checked ? "bg-success border-success" : "bg-surface border-border-strong group-hover:border-accent"}`}
                        >
                            {item.checked && (
                                <Check size={14} strokeWidth={4} className="text-white" />
                            )}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span
                                className={`text-base font-medium text-text-strong break-words transition-all ${item.checked ? "line-through opacity-60" : ""}`}
                            >
                                {item.name}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted mt-0.5">
                                {item.brand && (
                                    <span className="px-1.5 py-0.5 bg-bg-muted rounded text-[10px] uppercase font-bold tracking-wider">
                                        {item.brand}
                                    </span>
                                )}
                                {item.quantity && (
                                    <span>
                                        {item.brand ? "• " : ""}
                                        {item.quantity}
                                    </span>
                                )}
                                {item.price != null && (
                                    <span> • {formatPrice(item.price)}</span>
                                )}
                                {item.category && (
                                    <span className="text-accent/70 font-medium">
                                        {` #${item.category}`}
                                    </span>
                                )}
                            </div>
                        </div>
                    </button>
                    {onDelete && (
                        <button
                            type="button"
                            className="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted opacity-0 group-hover:opacity-100 transition-all hover:bg-danger-subtle hover:text-danger shrink-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item.id);
                            }}
                            aria-label="Remove item"
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
