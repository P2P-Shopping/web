import { CalendarDays, ChevronRight, ShoppingCart } from "lucide-react";
import type { ShoppingList } from "../../types";

/**
 * Props for the ListCard component.
 */
interface ListCardProps {
    list: ShoppingList;
    onClick?: () => void;
}

/**
 * Component to display a summary card for a shopping list.
 * Shows the list name, creation date, and progress of checked items.
 */
export default function ListCard({ list, onClick }: ListCardProps) {
    const { totalItems, checkedItems } = (list.items || []).reduce(
        (acc, item) => {
            acc.totalItems++;
            if (item.checked) acc.checkedItems++;
            return acc;
        },
        { totalItems: 0, checkedItems: 0 },
    );

    const progress =
        totalItems === 0 ? 0 : Math.round((checkedItems / totalItems) * 100);

    const formattedDate = new Date(list.createdAt).toLocaleDateString(
        undefined,
        {
            day: "numeric",
            month: "short",
            year: "numeric",
        },
    );

    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full bg-surface border border-border rounded-2xl p-4 text-left transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:border-accent/30 group"
        >
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-accent-subtle text-accent rounded-xl group-hover:scale-110 transition-transform duration-300">
                        <ShoppingCart size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-text-strong text-lg line-clamp-1">
                            {list.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-text-muted mt-0.5">
                            <CalendarDays size={12} />
                            <span>{formattedDate}</span>
                        </div>
                    </div>
                </div>
                <ChevronRight
                    size={20}
                    className="text-text-muted group-hover:text-accent group-hover:translate-x-1 transition-all duration-300"
                />
            </div>

            <div className="mt-4">
                <div className="flex justify-between text-[11px] font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                    <span>Progres</span>
                    <span>
                        {checkedItems} / {totalItems}
                    </span>
                </div>
                <div className="w-full bg-bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                        className="bg-accent h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </button>
    );
}
