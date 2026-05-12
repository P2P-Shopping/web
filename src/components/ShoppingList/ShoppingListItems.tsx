import type { DragEndEvent } from "@dnd-kit/core";
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical, Pencil, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useRef } from "react";

interface Item {
    id: string;
    name: string;
    checked: boolean;
    brand?: string;
    quantity?: string;
    price?: number;
    category?: string;
    positionIndex?: number;
}

interface Props {
    items: Item[];
    onCheck: (id: string) => void;
    onDelete?: (id: string) => void;
    onEdit?: (item: Item) => void;
    disabled?: boolean;
    /** When false, hides checkboxes (template mode). Defaults to true. */
    checkable?: boolean;
    sortMode?: "alphabetical" | "chronological" | "custom";
    onReorder?: (newItems: Item[], movedItem: Item) => void;
}

const formatPrice = (price: number) => `${price.toFixed(2)} RON`;

const ItemMetadata = ({ item }: { item: Item }) => {
    const parts: React.ReactNode[] = [];
    if (item.brand) {
        parts.push(
            <span
                key="brand"
                className="px-1.5 py-0.5 bg-bg-muted rounded text-xs uppercase font-bold tracking-wider"
            >
                {item.brand}
            </span>,
        );
    }
    if (item.quantity) {
        parts.push(<span key="qty">{item.quantity}</span>);
    }
    if (item.price != null) {
        parts.push(<span key="price">{formatPrice(item.price)}</span>);
    }

    return (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted mt-0.5">
            {parts.map((part, index) => {
                const partKey = (part as React.ReactElement).key || index;
                return (
                    <React.Fragment key={`meta-${partKey}`}>
                        {index > 0 && <span> • </span>}
                        {part}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

interface SortableItemRowProps {
    item: Item;
    checkable: boolean;
    disabled: boolean;
    onCheck: (id: string) => void;
    onDelete?: (id: string) => void;
    onEdit?: (item: Item) => void;
    isDraggable: boolean;
}

const SortableItemRow = ({
    item,
    checkable,
    disabled,
    onCheck,
    onDelete,
    onEdit,
    isDraggable,
}: SortableItemRowProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id, disabled: !isDraggable });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
        zIndex: isDragging ? 10 : undefined,
    };

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={`flex items-center justify-between p-4 bg-bg-subtle border border-border rounded-xl transition-all duration-200 hover:bg-surface hover:shadow-md group ${checkable && item.checked ? "opacity-60" : ""}`}
        >
            {isDraggable && (
                <div
                    {...attributes}
                    {...listeners}
                    className="mr-3 cursor-grab active:cursor-grabbing text-text-muted hover:text-text-strong touch-none"
                >
                    <GripVertical size={18} />
                </div>
            )}
            {checkable ? (
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
                        <ItemMetadata item={item} />
                    </div>
                </label>
            ) : (
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative flex items-center justify-center w-6 h-6 rounded-md bg-bg-muted border border-border shrink-0">
                        <div className="w-2 h-2 rounded-full bg-text-muted" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-base font-medium text-text-strong wrap-break-word">
                            {item.name}
                        </span>
                        <ItemMetadata item={item} />
                    </div>
                </div>
            )}
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

            {onEdit && (
                <button
                    type="button"
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted opacity-0 group-hover:opacity-100 transition-all hover:bg-bg-muted hover:text-accent shrink-0 outline-none"
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit(item);
                    }}
                    disabled={disabled}
                >
                    <Pencil size={16} />
                </button>
            )}
        </li>
    );
};

const ShoppingListItems: React.FC<Props> = ({
    items,
    onCheck,
    onDelete,
    onEdit,
    disabled = false,
    checkable = true,
    sortMode = "chronological",
    onReorder,
}) => {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const checkedSnapshotRef = useRef<Map<string, boolean>>(new Map());

    useEffect(() => {
        // Only add new items to snapshot so toggling doesn't jump until reload
        for (const item of items) {
            if (!checkedSnapshotRef.current.has(item.id)) {
                checkedSnapshotRef.current.set(item.id, item.checked);
            }
        }
    }, [items]);

    // Initialize snapshot on first render
    if (checkedSnapshotRef.current.size === 0 && items.length > 0) {
        for (const item of items) {
            checkedSnapshotRef.current.set(item.id, item.checked);
        }
    }

    const sortedItems = useMemo(() => {
        const snapshot = checkedSnapshotRef.current;
        const itemsCopy = [...items];

        if (sortMode === "custom") {
            return itemsCopy.sort((a, b) => {
                const idxA = items.findIndex((i) => i.id === a.id);
                const idxB = items.findIndex((i) => i.id === b.id);
                const posA = a.positionIndex ?? idxA * 1000000;
                const posB = b.positionIndex ?? idxB * 1000000;
                return posA - posB;
            });
        }

        // For alphabetical and chronological: unchecked first, checked last
        const getChecked = (item: Item) =>
            snapshot.get(item.id) ?? item.checked;

        if (sortMode === "alphabetical") {
            return itemsCopy.sort((a, b) => {
                const checkedDiff =
                    (getChecked(a) ? 1 : 0) - (getChecked(b) ? 1 : 0);
                if (checkedDiff !== 0) return checkedDiff;
                return a.name.localeCompare(b.name);
            });
        }

        // Chronological: stable order with checked at bottom
        return itemsCopy.sort((a, b) => {
            const checkedDiff =
                (getChecked(a) ? 1 : 0) - (getChecked(b) ? 1 : 0);
            return checkedDiff;
        });
    }, [items, sortMode]);

    if (items.length === 0) {
        return (
            <p className="text-center py-12 text-text-muted italic">
                Your list is empty!
            </p>
        );
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id || !onReorder) return;

        const oldIndex = sortedItems.findIndex((i) => i.id === active.id);
        const newIndex = sortedItems.findIndex((i) => i.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(sortedItems, oldIndex, newIndex);

        // Calculate new positionIndex using midpoint of neighbors
        const itemsWithPos = reordered.map((item) => {
            const origIdx = items.findIndex((i) => i.id === item.id);
            return {
                ...item,
                positionIndex: item.positionIndex ?? origIdx * 1000000,
            };
        });

        let newPos: number;
        const prevItem = newIndex > 0 ? itemsWithPos[newIndex - 1] : null;
        const nextItem =
            newIndex < itemsWithPos.length - 1
                ? itemsWithPos[newIndex + 1]
                : null;

        const prevPos = prevItem?.positionIndex ?? 0;
        const nextPos = nextItem?.positionIndex ?? prevPos + 2000000;

        if (prevItem && nextItem) {
            newPos = (prevPos + nextPos) / 2;
        } else if (nextItem) {
            newPos = nextPos - 1000000;
        } else {
            newPos = prevPos + 1000000;
        }

        const movedItem = {
            ...reordered[newIndex],
            positionIndex: newPos,
        };
        reordered[newIndex] = movedItem;

        onReorder(reordered, movedItem);
    };

    if (sortMode === "custom") {
        return (
            <div className="flex flex-col gap-2.5">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={sortedItems.map((i) => i.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
                            {sortedItems.map((item) => (
                                <SortableItemRow
                                    key={item.id}
                                    item={item}
                                    checkable={checkable}
                                    disabled={disabled}
                                    onCheck={onCheck}
                                    onDelete={onDelete}
                                    onEdit={onEdit}
                                    isDraggable={!disabled}
                                />
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>
            </div>
        );
    }

    // Group items by category for alphabetical/chronological modes
    const groupedItems = sortedItems.reduce(
        (acc, item) => {
            const category = item.category || "Other";
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(item);
            return acc;
        },
        {} as Record<string, Item[]>,
    );

    const categories = Object.keys(groupedItems).sort((a, b) =>
        a.localeCompare(b),
    );

    return (
        <div className="flex flex-col gap-8">
            {categories.map((category) => (
                <div key={category} className="flex flex-col gap-3">
                    <h3 className="text-xs font-bold text-text-muted uppercase tracking-widest px-1">
                        {category}
                    </h3>
                    <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
                        {groupedItems[category].map((item) => (
                            <SortableItemRow
                                key={item.id}
                                item={item}
                                checkable={checkable}
                                disabled={disabled}
                                onCheck={onCheck}
                                onDelete={onDelete}
                                onEdit={onEdit}
                                isDraggable={false}
                            />
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
};

export default ShoppingListItems;
