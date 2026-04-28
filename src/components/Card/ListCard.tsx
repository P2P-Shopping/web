import { CalendarDays, Check, Plus, ShoppingCart, Trash2 } from "lucide-react";
import type React from "react";
import { useStore } from "../../context/useStore";
import type { ShoppingList } from "../../types";

/**
 * Props for the ListCard component.
 */
interface ListCardProps {
    list: ShoppingList;
    onClick?: () => void;
    onDelete?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    isDeleting?: boolean;
}

const PREVIEW_LIMIT = 2;

/**
 * Component to display a summary card for a shopping list.
 * Merged with Dashboard design for rich previews and states.
 */
export default function ListCard({
    list,
    onClick,
    onDelete,
    isDeleting,
}: Readonly<ListCardProps>) {
    const currentUser = useStore((state) => state.user);
    const totalItems = (list.items || []).length;
    const checkedItems = (list.items || []).filter(
        (item) => item.checked,
    ).length;
    const uncheckedItems = (list.items || []).filter((item) => !item.checked);

    const progress =
        totalItems === 0 ? 0 : Math.round((checkedItems / totalItems) * 100);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getItemsCountLabel = () => {
        if (totalItems === 0) return "No items";
        const label = totalItems === 1 ? "item" : "items";
        return `${checkedItems}/${totalItems} ${label}`;
    };

    const getOwnerLabel = () => {
        if (!currentUser) return list.ownerName?.split(" ")[0] || "Unknown";

        const userEmail = currentUser.email.toLowerCase().trim();
        const listOwnerEmail = list.ownerEmail?.toLowerCase().trim();

        // Ensure string comparison for IDs as they might be numbers in some states
        const listUserId = list.userId ? String(list.userId) : null;
        const currentUserId = currentUser.userId
            ? String(currentUser.userId)
            : null;

        const isOwner =
            (listUserId && listUserId === currentUserId) ||
            (listOwnerEmail && listOwnerEmail === userEmail);

        if (isOwner) return "You";
        if (!list.ownerName) return "Unknown";

        // Show only first name
        return list.ownerName.split(" ")[0];
    };

    return (
        <div className="relative group h-full">
            <button
                type="button"
                onClick={onClick}
                className="w-full h-full text-left relative bg-surface border border-border rounded-xl p-[22px_22px_18px] cursor-pointer transition-all duration-200 ease-out hover:border-accent-border hover:shadow-md hover:shadow-accent-glow/20 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 flex flex-col gap-[18px] outline-none"
            >
                <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <ShoppingCart
                                size={14}
                                className="text-accent shrink-0"
                            />
                            <h3
                                className="text-lg font-bold text-text-strong leading-tight truncate"
                                title={list.name}
                            >
                                {list.name}
                            </h3>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-text-muted">
                            <CalendarDays size={12} />
                            <span>{formatDate(list.updatedAt)}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3.5 mt-auto">
                    <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-subtle text-accent text-xs font-semibold whitespace-nowrap">
                            {getItemsCountLabel()}
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-subtle text-accent text-xs font-semibold whitespace-nowrap">
                            {getOwnerLabel()}
                        </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {(() => {
                            if (totalItems === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-6 rounded-xl border-2 border-dashed border-border/40 text-text-muted/60 gap-1.5">
                                        <Plus size={18} />
                                        <span className="text-xs font-bold uppercase tracking-wider">
                                            Empty List
                                        </span>
                                    </div>
                                );
                            }

                            if (uncheckedItems.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-6 rounded-xl bg-success-subtle/10 border border-success-border/20 text-success gap-2">
                                        <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                                            <Check
                                                size={18}
                                                className="text-success"
                                            />
                                        </div>
                                        <span className="text-xs font-extrabold uppercase tracking-widest">
                                            All items checked
                                        </span>
                                    </div>
                                );
                            }

                            return (
                                <>
                                    {uncheckedItems
                                        .slice(0, PREVIEW_LIMIT)
                                        .map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center gap-2.5 p-[8px_12px] rounded-md bg-bg-subtle border border-border text-sm text-text transition-colors duration-200 ease-out"
                                            >
                                                <span
                                                    className="w-[16px] h-[16px] border-2 border-border-strong rounded-[4px] shrink-0 flex items-center justify-center transition-all bg-surface"
                                                    aria-hidden="true"
                                                />
                                                <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                                                    {item.name}
                                                </span>
                                            </div>
                                        ))}
                                    {uncheckedItems.length > PREVIEW_LIMIT && (
                                        <div className="flex items-center justify-center p-[6px_12px] rounded-md bg-bg-muted border border-border text-xs font-bold text-text-muted">
                                            +
                                            {uncheckedItems.length -
                                                PREVIEW_LIMIT}{" "}
                                            more
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>

                    {/* Progress Bar Integration */}
                    <div className="pt-1">
                        <div className="w-full bg-bg-muted rounded-full h-1 overflow-hidden">
                            <div
                                className="bg-accent h-full rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                </div>
            </button>

            {onDelete && (
                <button
                    type="button"
                    className={`absolute top-5 right-5 flex items-center justify-center w-8.5 h-8.5 border border-border rounded-md bg-bg-muted text-text-muted transition-all duration-200 ease-out hover:bg-danger-subtle hover:text-danger hover:border-danger-border shrink-0 focus-visible:outline-2 focus-visible:outline-danger focus-visible:outline-offset-2 z-10 ${
                        isDeleting ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    onClick={onDelete}
                    disabled={isDeleting}
                    title="Delete list"
                    aria-label="Delete list"
                >
                    <Trash2 size={16} />
                </button>
            )}
        </div>
    );
}
