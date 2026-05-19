import { Check } from "lucide-react";
import type { Item, ShoppingList } from "../../types";
import { buildItemDuplicateKey } from "../../utils/listUtils";
import Modal from "../Modal/Modal";

interface ImportItemsModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    sourceListName?: string;
    sourceItems: Item[];
    targetList?: ShoppingList | null;
    // For when multiple target lists are available
    availableTargetLists?: ShoppingList[];
    selectedTargetListId?: string;
    onTargetListChange?: (id: string) => void;
    // Selection state
    selectedItemIds: Set<string>;
    onToggleItem: (itemId: string) => void;
    onSelectAllEligible?: (itemIds: string[]) => void;
    onClearSelection?: () => void;
    // Confirmation
    onConfirm: () => void;
    isSubmitting: boolean;
    submitLabel?: string;
    submittingLabel?: string;
    // New list creation
    allowNewList?: boolean;
    newListName?: string;
    onNewListNameChange?: (name: string) => void;
}

const ImportItemsModal = ({
    isOpen,
    onClose,
    title = "Add items to this list",
    subtitle,
    sourceListName,
    sourceItems,
    targetList,
    availableTargetLists,
    selectedTargetListId,
    onTargetListChange,
    selectedItemIds,
    onToggleItem,
    onSelectAllEligible,
    onClearSelection,
    onConfirm,
    isSubmitting,
    submitLabel = "Add selected",
    submittingLabel = "Adding...",
    allowNewList = false,
    newListName = "",
    onNewListNameChange,
}: ImportItemsModalProps) => {
    // Determine the active target list for duplicate checking
    const activeTargetList =
        targetList ||
        availableTargetLists?.find((l) => l.id === selectedTargetListId);

    const existingKeys = new Set(
        (activeTargetList?.items ?? []).map((item) =>
            buildItemDuplicateKey(item),
        ),
    );

    const duplicateCount = sourceItems.filter((item) =>
        existingKeys.has(buildItemDuplicateKey(item)),
    ).length;

    const selectedCount = sourceItems.filter((item) =>
        selectedItemIds.has(item.id),
    ).length;

    const defaultSubtitle =
        sourceListName && activeTargetList
            ? `Choose which items from "${sourceListName}" to add to "${activeTargetList.name}".`
            : subtitle;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            subtitle={defaultSubtitle}
            maxWidth="720px"
        >
            <div className="flex flex-col gap-5">
                {availableTargetLists && onTargetListChange && (
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-2">
                            <label
                                htmlFor="target-normal-list"
                                className="text-[13px] font-semibold text-text-strong"
                            >
                                Target normal list
                            </label>
                            <select
                                id="target-normal-list"
                                value={selectedTargetListId}
                                onChange={(e) =>
                                    onTargetListChange(e.target.value)
                                }
                                className="w-full rounded-xl border border-border bg-bg-muted px-3.5 py-3 text-sm text-text-strong outline-none transition-all focus:border-accent"
                            >
                                {allowNewList && (
                                    <option value="NEW_LIST">
                                        + Create new list
                                    </option>
                                )}
                                {availableTargetLists.map((list) => (
                                    <option key={list.id} value={list.id}>
                                        {list.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {allowNewList &&
                            selectedTargetListId === "NEW_LIST" &&
                            onNewListNameChange && (
                                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <label
                                        htmlFor="new-list-name"
                                        className="text-[13px] font-semibold text-text-strong"
                                    >
                                        New list name
                                    </label>
                                    <input
                                        id="new-list-name"
                                        type="text"
                                        value={newListName}
                                        maxLength={50}
                                        onChange={(e) =>
                                            onNewListNameChange(
                                                e.target.value.replace(
                                                    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
                                                    "",
                                                ),
                                            )
                                        }
                                        placeholder="Enter list name..."
                                        className="w-full rounded-xl border border-border bg-bg-muted px-3.5 py-3 text-sm text-text-strong outline-none transition-all focus:border-accent"
                                    />
                                </div>
                            )}
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg-subtle px-4 py-3">
                    <p className="text-sm text-text-muted">
                        <span className="font-semibold text-text-strong">
                            {sourceItems.length}
                        </span>{" "}
                        items to add.{" "}
                        {duplicateCount > 0 && (
                            <>
                                <span className="font-semibold text-text-strong">
                                    {duplicateCount}
                                </span>{" "}
                                will have quantities merged.
                            </>
                        )}
                    </p>
                    {(onSelectAllEligible || onClearSelection) && (
                        <div className="flex flex-wrap gap-2">
                            {onSelectAllEligible && (
                                <button
                                    type="button"
                                    className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-strong transition-all hover:border-accent hover:text-accent"
                                    onClick={() =>
                                        onSelectAllEligible(
                                            sourceItems.map((item) => item.id),
                                        )
                                    }
                                >
                                    Select all
                                </button>
                            )}
                            {onClearSelection && (
                                <button
                                    type="button"
                                    className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-muted transition-all hover:text-text-strong"
                                    onClick={onClearSelection}
                                >
                                    Clear selection
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-border bg-bg-subtle p-3">
                    <div className="flex flex-col gap-2">
                        {sourceItems.map((item) => {
                            const isDuplicate = existingKeys.has(
                                buildItemDuplicateKey(item),
                            );
                            const isSelected = selectedItemIds.has(item.id);

                            return (
                                <label
                                    key={item.id}
                                    htmlFor={`import-item-${item.id}`}
                                    className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition-all cursor-pointer ${
                                        isDuplicate
                                            ? "border-accent/30 bg-accent-subtle/30 hover:border-accent"
                                            : "border-border bg-surface hover:border-accent"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        id={`import-item-${item.id}`}
                                        checked={isSelected}
                                        onChange={() => onToggleItem(item.id)}
                                        aria-label={`Select ${item.name}`}
                                    />
                                    <div
                                        className={`relative flex items-center justify-center w-6 h-6 rounded-md border-2 transition-all shrink-0 mt-0.5 ${
                                            isSelected
                                                ? "bg-accent border-accent"
                                                : "bg-surface border-border-strong group-hover:border-accent"
                                        }`}
                                    >
                                        {isSelected && (
                                            <Check
                                                size={14}
                                                strokeWidth={4}
                                                className="text-white"
                                            />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-text-strong">
                                                {item.name}
                                            </span>
                                            {item.brand && (
                                                <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] font-semibold text-accent">
                                                    {item.brand}
                                                </span>
                                            )}
                                            {isDuplicate && (
                                                <span className="rounded-full bg-warning-subtle px-2 py-0.5 text-[11px] font-semibold text-warning-strong">
                                                    Will merge qty
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-text-muted">
                                            {item.quantity && (
                                                <span>{item.quantity}</span>
                                            )}
                                            {item.category && (
                                                <span>{item.category}</span>
                                            )}
                                        </div>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-text-muted">
                        {selectedCount} item{selectedCount === 1 ? "" : "s"}{" "}
                        selected.
                    </p>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            className="rounded-lg border border-border bg-bg-muted px-4 py-2.5 text-sm font-semibold text-text-strong transition-all hover:bg-border"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={onConfirm}
                            disabled={selectedCount === 0 || isSubmitting}
                        >
                            {isSubmitting ? submittingLabel : submitLabel}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ImportItemsModal;
