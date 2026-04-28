import { ChevronLeft, Plus, Sparkles } from "lucide-react";
import {
    type MouseEvent,
    type ReactNode,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { ListCard, Modal } from "../../components";
import { useListsStore } from "../../store/useListsStore";
import type { ShoppingList } from "../../types";
import ListDetail from "../ListDetail/ListDetail";
import AiImportModal from "./AiImportModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import CreateListModal from "./CreateListModal";

const buildItemDuplicateKey = (item: { name?: string; brand?: string }) =>
    `${item.name?.trim().toLowerCase() ?? ""}::${item.brand?.trim().toLowerCase() ?? ""}`;

interface ImportSelectionModalProps {
    isOpen: boolean;
    sourceList: ShoppingList | null;
    targetList: ShoppingList | null;
    selectedItemIds: Set<string>;
    isSubmitting: boolean;
    onClose: () => void;
    onToggleItem: (itemId: string) => void;
    onConfirm: () => void;
}

const ImportSelectionModal = ({
    isOpen,
    sourceList,
    targetList,
    selectedItemIds,
    isSubmitting,
    onClose,
    onToggleItem,
    onConfirm,
}: ImportSelectionModalProps) => {
    const existingKeys = new Set(
        (targetList?.items ?? []).map((item) => buildItemDuplicateKey(item)),
    );
    const sourceItems = sourceList?.items ?? [];
    const eligibleItems = sourceItems.filter(
        (item) => !existingKeys.has(buildItemDuplicateKey(item)),
    );
    const selectedCount = eligibleItems.filter((item) =>
        selectedItemIds.has(item.id),
    ).length;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Add items to this list"
            subtitle={
                sourceList && targetList
                    ? `Choose which items from "${sourceList.name}" to add to "${targetList.name}".`
                    : undefined
            }
            maxWidth="720px"
        >
            <div className="flex flex-col gap-5">
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
                                    className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition-all ${
                                        isDuplicate
                                            ? "cursor-not-allowed border-border bg-bg-muted opacity-60"
                                            : "cursor-pointer border-border bg-surface hover:border-accent"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected && !isDuplicate}
                                        onChange={() => onToggleItem(item.id)}
                                        disabled={isDuplicate}
                                        className="mt-1 h-4 w-4 rounded border-border"
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
                                                    Already in target
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
                            {isSubmitting ? "Adding..." : "Add selected"}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

/**
 * Main dashboard component that displays the user's shopping lists.
 * Handles list selection, deletion, and rendering the details view.
 */
const Dashboard = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [deleteTarget, setDeleteTarget] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [draggedListId, setDraggedListId] = useState<string | null>(null);
    const [dragOverListId, setDragOverListId] = useState<string | null>(null);
    const [importSourceListId, setImportSourceListId] = useState<string | null>(
        null,
    );
    const [importTargetListId, setImportTargetListId] = useState<string | null>(
        null,
    );
    const [selectedImportItemIds, setSelectedImportItemIds] = useState<
        Set<string>
    >(new Set());
    const [isImportingItems, setIsImportingItems] = useState(false);
    const {
        lists,
        isLoading,
        isModalOpen,
        deletingListId,
        fetchLists,
        deleteList,
        addItem,
        openModal,
        closeModal,
    } = useListsStore();

    const showAiImport = searchParams.get("import") === "ai";
    const isOverlayOpen = isModalOpen || showAiImport;

    useEffect(() => {
        void fetchLists();
    }, [fetchLists]);

    const selectedListId = searchParams.get("list");
    const selectedList = useMemo(
        () => lists.find((list) => list.id === selectedListId) ?? null,
        [lists, selectedListId],
    );

    const groupedLists = useMemo(
        () => ({
            NORMAL: lists.filter(
                (list) => (list.category ?? "NORMAL") === "NORMAL",
            ),
            RECIPE: lists.filter((list) => list.category === "RECIPE"),
            FREQUENT: lists.filter((list) => list.category === "FREQUENT"),
        }),
        [lists],
    );

    const sectionOrder = ["NORMAL", "RECIPE", "FREQUENT"] as const;
    const sectionLabels: Record<(typeof sectionOrder)[number], string> = {
        NORMAL: "Normal lists",
        RECIPE: "Recipe lists",
        FREQUENT: "Frequent lists",
    };

    const hasGroupedLists = sectionOrder.some(
        (section) => groupedLists[section].length > 0,
    );
    const importSourceList = useMemo(
        () => lists.find((list) => list.id === importSourceListId) ?? null,
        [importSourceListId, lists],
    );
    const importTargetList = useMemo(
        () => lists.find((list) => list.id === importTargetListId) ?? null,
        [importTargetListId, lists],
    );

    /**
     * Updates the URL search parameters to select a specific list.
     * @param listId - The ID of the list to select.
     */
    const handleCardClick = (listId: string) => {
        setSearchParams({ list: listId });
    };

    /**
     * Opens the deletion confirmation modal for a specific list.
     */
    const handleDeleteList = (
        e: MouseEvent<HTMLButtonElement>,
        listId: string,
        listName: string,
    ) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteError(null);
        setDeleteTarget({ id: listId, name: listName });
    };

    /**
     * Confirms and processes the deletion of a list.
     * @param listId - The ID of the list to delete.
     */
    const confirmDeleteList = async (listId: string) => {
        try {
            const deleted = await deleteList(listId);
            if (deleted) {
                setDeleteError(null);
                setDeleteTarget(null);
            } else {
                setDeleteError("Failed to delete the list. Please try again.");
            }
        } catch (error) {
            setDeleteError(
                error instanceof Error ? error.message : "An error occurred",
            );
        }
    };

    /**
     * Cancels the deletion process and closes the modal.
     */
    const cancelDeleteList = () => {
        setDeleteTarget(null);
    };

    /**
     * Clears the currently selected list from the URL search parameters.
     */
    const clearSelectedList = () => {
        setSearchParams({});
    };

    const clearImport = () => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete("import");
            return next;
        });
    };

    const resetDragState = () => {
        setDraggedListId(null);
        setDragOverListId(null);
    };

    const clearImportSelection = () => {
        setImportSourceListId(null);
        setImportTargetListId(null);
        setSelectedImportItemIds(new Set());
        setIsImportingItems(false);
        resetDragState();
    };

    const handleDragStart = (listId: string) => {
        setDraggedListId(listId);
    };

    const handleDropOnNormalList = (targetListId: string) => {
        if (!draggedListId || draggedListId === targetListId) {
            resetDragState();
            return;
        }

        const sourceList = lists.find((list) => list.id === draggedListId);
        const targetList = lists.find((list) => list.id === targetListId);

        if (
            !sourceList ||
            !targetList ||
            (sourceList.category !== "RECIPE" &&
                sourceList.category !== "FREQUENT") ||
            (targetList.category ?? "NORMAL") !== "NORMAL"
        ) {
            resetDragState();
            return;
        }

        const existingKeys = new Set(
            targetList.items.map((item) => buildItemDuplicateKey(item)),
        );
        const eligibleItemIds = sourceList.items
            .filter((item) => !existingKeys.has(buildItemDuplicateKey(item)))
            .map((item) => item.id);

        setImportSourceListId(sourceList.id);
        setImportTargetListId(targetList.id);
        setSelectedImportItemIds(new Set(eligibleItemIds));
        resetDragState();
    };

    const toggleImportItem = (itemId: string) => {
        setSelectedImportItemIds((prev) => {
            const next = new Set(prev);
            if (next.has(itemId)) {
                next.delete(itemId);
            } else {
                next.add(itemId);
            }
            return next;
        });
    };

    const confirmImportSelection = async () => {
        if (!importSourceList || !importTargetList) return;

        const existingKeys = new Set(
            importTargetList.items.map((item) => buildItemDuplicateKey(item)),
        );
        const itemsToImport = importSourceList.items.filter(
            (item) =>
                selectedImportItemIds.has(item.id) &&
                !existingKeys.has(buildItemDuplicateKey(item)),
        );

        if (itemsToImport.length === 0) {
            clearImportSelection();
            return;
        }

        setIsImportingItems(true);

        try {
            for (const item of itemsToImport) {
                const added = await addItem(importTargetList.id, {
                    name: item.name,
                    checked: false,
                    brand: item.brand,
                    quantity: item.quantity,
                    category: item.category,
                    price: item.price,
                    isRecurrent: false,
                });

                if (!added) {
                    throw new Error(`Failed to add ${item.name}`);
                }
            }

            clearImportSelection();
        } catch (_error) {
            setIsImportingItems(false);
        }
    };

    let mainContent: ReactNode;
    if (isLoading && !isOverlayOpen) {
        mainContent = (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-text-muted text-sm">
                <div className="w-9 h-9 border-[3px] border-border border-t-accent rounded-full animate-spin" />
                <p>Loading lists...</p>
            </div>
        );
    } else if (showAiImport) {
        mainContent = (
            <div className="max-w-[800px] mx-auto w-full h-[calc(100vh-130px)]">
                <AiImportModal onClose={clearImport} />
            </div>
        );
    } else if (lists.length === 0) {
        mainContent = (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-2.5">
                <span className="text-5xl mb-2 opacity-60" aria-hidden="true">
                    🛒
                </span>
                <h2 className="text-xl text-text-strong font-bold">
                    No lists yet
                </h2>
                <p className="text-sm text-text-muted mb-4">
                    Create your first shared shopping list!
                </p>
                <button
                    type="button"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-text-on-accent rounded-md text-base font-bold transition-all duration-200 ease-out shadow-[0_2px_10px_var(--color-accent-glow)] hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_18px_var(--color-accent-glow)] focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-3"
                    onClick={openModal}
                >
                    <Plus size={20} />
                    Create a List
                </button>
            </div>
        );
    } else if (selectedList) {
        mainContent = (
            <div className="max-w-[860px] mx-auto w-full">
                <ListDetail listIdOverride={selectedList.id} />
            </div>
        );
    } else if (!hasGroupedLists) {
        mainContent = (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
                {lists.map((list) => (
                    <div key={list.id}>
                        <ListCard
                            list={list}
                            onClick={() => handleCardClick(list.id)}
                            onDelete={(e) =>
                                handleDeleteList(e, list.id, list.name)
                            }
                            isDeleting={deletingListId === list.id}
                        />
                    </div>
                ))}
            </div>
        );
    } else {
        mainContent = (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {sectionOrder.map((section) => {
                    const sectionLists = groupedLists[section];
                    if (sectionLists.length === 0) return null;

                    return (
                        <section
                            key={section}
                            className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm"
                        >
                            <div className="flex items-end justify-between gap-3">
                                <div>
                                    <h2 className="text-base font-extrabold text-text-strong tracking-tight">
                                        {sectionLabels[section]}
                                    </h2>
                                    <p className="text-xs text-text-muted mt-0.5">
                                        {`${sectionLists.length} ${sectionLists.length === 1 ? "list" : "lists"}`}
                                    </p>
                                </div>
                                {section !== "NORMAL" && (
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                                        Drag onto a normal list
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-col gap-4">
                                {sectionLists.map((list) => (
                                    <div
                                        key={list.id}
                                        // Folosim role="listitem" dacă e într-o listă,
                                        // sau lăsăm interactivitatea pe ListCard
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (
                                                e.key === "Enter" ||
                                                e.key === " "
                                            ) {
                                                e.preventDefault();
                                                handleCardClick(list.id);
                                            }
                                        }}
                                        draggable={
                                            section !== "NORMAL" &&
                                            list.items.length > 0
                                        }
                                        onDragStart={() =>
                                            handleDragStart(list.id)
                                        }
                                        onDragEnd={resetDragState}
                                        onDragOver={(e) => {
                                            if (section !== "NORMAL") return;
                                            if (
                                                !draggedListId ||
                                                draggedListId === list.id
                                            )
                                                return;
                                            e.preventDefault();
                                            setDragOverListId(list.id);
                                        }}
                                        onDragLeave={() => {
                                            if (dragOverListId === list.id) {
                                                setDragOverListId(null);
                                            }
                                        }}
                                        onDrop={(e) => {
                                            if (section !== "NORMAL") return;
                                            e.preventDefault();
                                            handleDropOnNormalList(list.id);
                                        }}
                                        className={`rounded-xl transition-all ${
                                            section !== "NORMAL" &&
                                            list.items.length > 0
                                                ? "cursor-grab active:cursor-grabbing"
                                                : ""
                                        } ${
                                            dragOverListId === list.id
                                                ? "scale-[1.01] ring-2 ring-accent ring-offset-2 ring-offset-bg"
                                                : ""
                                        }`}
                                    >
                                        <ListCard
                                            list={list}
                                            onClick={() =>
                                                handleCardClick(list.id)
                                            }
                                            onDelete={(e) =>
                                                handleDeleteList(
                                                    e,
                                                    list.id,
                                                    list.name,
                                                )
                                            }
                                            isDeleting={
                                                deletingListId === list.id
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="flex flex-col bg-bg">
            <header className="flex items-center justify-between gap-4 px-7 py-5 bg-surface border-b border-border sticky top-0 z-100 max-[600px]:p-4 max-[600px]:flex-wrap">
                {selectedList || showAiImport ? (
                    <>
                        <button
                            type="button"
                            className="inline-flex items-center justify-center w-[38px] h-[38px] border border-border rounded-md bg-bg-muted text-text-strong transition-all duration-200 ease-out hover:bg-accent-subtle hover:border-accent-border hover:text-accent shrink-0 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                            onClick={
                                showAiImport ? clearImport : clearSelectedList
                            }
                            aria-label="Back"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <h1 className="flex-1 ml-3 text-[22px] font-extrabold text-text-strong tracking-tight">
                            {showAiImport
                                ? "AI Shopping Assistant"
                                : selectedList?.name}
                        </h1>
                    </>
                ) : (
                    <>
                        <div className="flex flex-col">
                            <h1 className="text-[22px] font-extrabold text-text-strong tracking-tight">
                                My Lists
                            </h1>
                            <p className="text-[13px] text-text-muted mt-0.5">
                                {`${lists.length} ${lists.length === 1 ? "list" : "lists"}`}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 max-[600px]:w-full">
                            <button
                                type="button"
                                className="inline-flex items-center gap-[7px] px-[18px] py-[9px] bg-bg-muted text-text-strong border border-border rounded-md text-sm font-bold transition-all duration-200 ease-out hover:bg-border hover:-translate-y-px active:translate-y-0 max-[600px]:flex-1 max-[600px]:justify-center"
                                onClick={() =>
                                    setSearchParams((prev) => {
                                        const next = new URLSearchParams(prev);
                                        next.set("import", "ai");
                                        return next;
                                    })
                                }
                            >
                                <Sparkles size={18} className="text-accent" />
                                AI Import
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center gap-[7px] px-[18px] py-[9px] bg-accent text-text-on-accent border-none rounded-md text-sm font-bold transition-all duration-200 ease-out shadow-[0_2px_10px_var(--color-accent-glow)] shrink-0 hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_18px_var(--color-accent-glow)] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-3 max-[600px]:flex-1 max-[600px]:justify-center"
                                onClick={openModal}
                            >
                                <Plus size={20} />
                                New List
                            </button>
                        </div>
                    </>
                )}
            </header>

            <main className="flex-1 p-7 max-w-[1200px] mx-auto w-full box-border max-[600px]:p-4">
                {mainContent}
            </main>

            {isModalOpen && <CreateListModal onClose={closeModal} />}
            {deleteTarget && (
                <ConfirmDeleteModal
                    listId={deleteTarget.id}
                    listName={deleteTarget.name}
                    isDeleting={deletingListId === deleteTarget.id}
                    error={deleteError}
                    onCancel={cancelDeleteList}
                    onConfirm={confirmDeleteList}
                />
            )}
            <ImportSelectionModal
                isOpen={Boolean(importSourceList && importTargetList)}
                sourceList={importSourceList}
                targetList={importTargetList}
                selectedItemIds={selectedImportItemIds}
                isSubmitting={isImportingItems}
                onClose={clearImportSelection}
                onToggleItem={toggleImportItem}
                onConfirm={() => {
                    void confirmImportSelection();
                }}
            />
        </div>
    );
};

export default Dashboard;
