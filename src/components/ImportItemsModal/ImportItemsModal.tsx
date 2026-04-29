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

    const eligibleItems = sourceItems.filter(
        (item) => !existingKeys.has(buildItemDuplicateKey(item)),
    );

    const selectedCount = eligibleItems.filter((item) =>
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
                            onChange={(e) => onTargetListChange(e.target.value)}
                            className="w-full rounded-xl border border-border bg-bg-muted px-3.5 py-3 text-sm text-text-strong outline-none transition-all focus:border-accent"
                        >
                            {availableTargetLists.map((list) => (
                                <option key={list.id} value={list.id}>
                                    {list.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg-subtle px-4 py-3">
                    <p className="text-sm text-text-muted">
                        <span className="font-semibold text-text-strong">
                            {eligibleItems.length}
                        </span>{" "}
                        available to add.{" "}
                        <span className="font-semibold text-text-strong">
                            {sourceItems.length - eligibleItems.length}
                        </span>{" "}
                        already exist in the target list.
                    </p>
                    {(onSelectAllEligible || onClearSelection) && (
                        <div className="flex flex-wrap gap-2">
                            {onSelectAllEligible && (
                                <button
                                    type="button"
                                    className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-strong transition-all hover:border-accent hover:text-accent"
                                    onClick={() =>
                                        onSelectAllEligible(
                                            eligibleItems.map(
                                                (item) => item.id,
                                            ),
                                        )
                                    }
                                >
                                    Select all available
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
                                    className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition-all ${
                                        isDuplicate
                                            ? "cursor-not-allowed border-border bg-bg-muted opacity-60"
                                            : "cursor-pointer border-border bg-surface hover:border-accent"
                                    }`}
                                >
                                    <input
                                        id={`import-item-${item.id}`}
                                        type="checkbox"
                                        checked={isSelected && !isDuplicate}
                                        onChange={() => onToggleItem(item.id)}
                                        disabled={isDuplicate}
                                        className="mt-1 h-4 w-4 rounded border-border"
                                        aria-label={`Select ${item.name}`}
                                    />
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
                                                <span className="rounded-full bg-bg-muted px-2 py-0.5 text-[11px] font-semibold text-text-muted">
                                                    Already in list
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
