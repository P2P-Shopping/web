import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Modal } from "../";

export type ReviewItem = {
    id: string;
    name: string;
    brand?: string;
    quantity?: string;
    category?: string;
};

export type ReviewSubmission = {
    listName: string;
    items: ReviewItem[];
};

type EditableField = "name" | "brand" | "quantity" | "category";

type SmartReviewModalProps = {
    isOpen: boolean;
    items: ReviewItem[];
    initialListName?: string;
    onClose: () => void;
    onConfirm: (payload: ReviewSubmission) => void;
};

const SmartReviewModal = ({
    isOpen,
    items,
    initialListName,
    onClose,
    onConfirm,
}: SmartReviewModalProps) => {
    const [editedItems, setEditedItems] = useState<ReviewItem[]>(items);
    const [listName, setListName] = useState(initialListName || "");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const prevIsOpen = useRef(false);

    // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally omitting items to prevent overwriting user edits
    useEffect(() => {
        if (isOpen && !prevIsOpen.current) {
            setEditedItems(items);
            setListName(initialListName || "");
            setIsSubmitting(false);
        }
        prevIsOpen.current = isOpen;
    }, [isOpen, initialListName]);

    const updateItem = (index: number, field: EditableField, value: string) => {
        setEditedItems((prev) =>
            prev.map((item, i) =>
                i === index ? { ...item, [field]: value } : item,
            ),
        );
    };

    const removeItem = (itemId: string) => {
        setEditedItems((prev) => prev.filter((item) => item.id !== itemId));
    };

    const handleConfirm = () => {
        setIsSubmitting(true);
        onConfirm({
            listName: listName.trim(),
            items: editedItems,
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Review AI results"
            subtitle="Verify items and brands before saving to your list."
            initialFocusSelector="input"
            maxWidth="900px"
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 text-sm font-semibold text-text-strong bg-bg-muted rounded-xl hover:bg-border transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={
                            isSubmitting ||
                            !listName.trim() ||
                            editedItems.length === 0 ||
                            editedItems.some((item) => !item.name.trim())
                        }
                        onClick={handleConfirm}
                        className="px-5 py-2.5 text-sm font-bold text-white bg-text-strong rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? "Saving..." : "Confirm & Save"}
                    </button>
                </div>
            }
        >
            <div className="space-y-4">
                <div className="rounded-xl border border-border bg-bg-muted p-4">
                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="review-list-name"
                            className="text-xs font-semibold uppercase tracking-wider text-text-muted"
                        >
                            List Name
                        </label>
                        <input
                            id="review-list-name"
                            className="w-full min-w-0 px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent outline-none"
                            value={listName}
                            onChange={(e) => setListName(e.target.value)}
                            placeholder="Give this list a name"
                        />
                    </div>
                </div>
                {editedItems.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border bg-bg-muted px-4 py-8 text-center text-sm text-text-muted">
                        No items left to save.
                    </div>
                )}
                {editedItems.map((item, index) => (
                    <div
                        key={item.id}
                        className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-bg-muted p-4 lg:grid-cols-12"
                    >
                        <div className="flex flex-col gap-1 lg:col-span-5">
                            <label
                                htmlFor={`item-${index}-name`}
                                className="text-xs font-semibold uppercase tracking-wider text-text-muted"
                            >
                                Product Name
                            </label>
                            <input
                                id={`item-${index}-name`}
                                className="w-full min-w-0 break-words whitespace-normal px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent outline-none"
                                value={item.name}
                                onChange={(e) =>
                                    updateItem(index, "name", e.target.value)
                                }
                                placeholder="Product Name"
                            />
                        </div>
                        <div className="flex flex-col gap-1 lg:col-span-2">
                            <label
                                htmlFor={`item-${index}-brand`}
                                className="text-xs font-semibold uppercase tracking-wider text-text-muted"
                            >
                                Brand
                            </label>
                            <input
                                id={`item-${index}-brand`}
                                className="w-full min-w-0 break-words whitespace-normal px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent outline-none"
                                value={item.brand || ""}
                                onChange={(e) =>
                                    updateItem(index, "brand", e.target.value)
                                }
                                placeholder="Brand"
                            />
                        </div>
                        <div className="flex flex-col gap-1 lg:col-span-2">
                            <label
                                htmlFor={`item-${index}-quantity`}
                                className="text-xs font-semibold uppercase tracking-wider text-text-muted"
                            >
                                Quantity
                            </label>
                            <input
                                id={`item-${index}-quantity`}
                                className="w-full min-w-0 break-words whitespace-normal px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent outline-none"
                                value={item.quantity || ""}
                                onChange={(e) =>
                                    updateItem(
                                        index,
                                        "quantity",
                                        e.target.value,
                                    )
                                }
                                placeholder="Quantity"
                            />
                        </div>
                        <div className="flex flex-col gap-1 lg:col-span-2">
                            <label
                                htmlFor={`item-${index}-category`}
                                className="text-xs font-semibold uppercase tracking-wider text-text-muted"
                            >
                                Category
                            </label>
                            <input
                                id={`item-${index}-category`}
                                className="w-full min-w-0 break-words whitespace-normal px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent outline-none font-medium text-accent"
                                value={item.category || ""}
                                onChange={(e) =>
                                    updateItem(
                                        index,
                                        "category",
                                        e.target.value,
                                    )
                                }
                                placeholder="Category"
                            />
                        </div>
                        <div className="flex flex-col gap-1 lg:col-span-1">
                            <span
                                aria-hidden="true"
                                className="text-xs font-semibold uppercase tracking-wider text-transparent"
                            >
                                Actions
                            </span>
                            <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                disabled={isSubmitting}
                                className="inline-flex min-h-10 items-center justify-center gap-2 self-stretch rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-sm font-semibold text-danger transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={`Delete ${item.name}`}
                            >
                                <Trash2 size={16} />
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </Modal>
    );
};

export default SmartReviewModal;
