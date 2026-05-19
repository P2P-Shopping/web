import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Columns,
    Layout,
    Plus,
    Sparkles,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ImportItemsModal, ListCard } from "../../components";
import { useStore } from "../../context/useStore";
import { useListsStore } from "../../store/useListsStore";
import type { Item, ListCategory, ShoppingList } from "../../types";
import { buildItemDuplicateKey, mergeQuantities } from "../../utils/listUtils";
import ListDetail from "../ListDetail/ListDetail";
import AiImportModal from "./AiImportModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import CreateListModal from "./CreateListModal";
import PendingInviteCard from "./PendingInviteCard";

type TabType = "NORMAL" | "RECIPE" | "FREQUENT";

// --- Sub-components for Dashboard ---

interface DashboardEmptyStateProps {
    openModal: () => void;
}

const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({
    openModal,
}) => (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-2.5">
        <span className="text-5xl mb-2 opacity-60" aria-hidden="true">
            🛒
        </span>
        <h2 className="text-xl text-text-strong font-bold">No lists yet</h2>
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

interface PendingInvitesSectionProps {
    invitations: import("../../types").PendingInvitation[];
}

const PendingInvitesSection: React.FC<PendingInvitesSectionProps> = ({
    invitations,
}) => {
    if (invitations.length === 0) return null;

    return (
        <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-extrabold text-text-strong tracking-tight">
                        Pending Invites
                    </h2>
                    <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-bold">
                        {invitations.length}
                    </span>
                </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                {invitations.map((invitation) => (
                    <PendingInviteCard
                        key={invitation.id}
                        invitation={invitation}
                    />
                ))}
            </div>
        </section>
    );
};

interface ListCategorySectionProps {
    section: string;
    label: string;
    lists: ShoppingList[];
    isCollapsed: boolean;
    onToggle: () => void;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onDragEnd: () => void;
    onDragOver: (e: React.DragEvent, id: string) => void;
    onDragLeave: (id: string) => void;
    onDrop: (e: React.DragEvent, id: string) => void;
    dragOverListId: string | null;
    onCardClick: (id: string) => void;
    onDeleteList: (
        e: React.MouseEvent<HTMLButtonElement>,
        id: string,
        name: string,
    ) => void;
    deletingListId: string | null;
    userEmail?: string;
}

const ListCategorySection: React.FC<ListCategorySectionProps> = ({
    label,
    lists,
    isCollapsed,
    onToggle,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop,
    dragOverListId,
    onCardClick,
    onDeleteList,
    deletingListId,
    userEmail,
}) => (
    <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onToggle}
                    className="p-1 hover:bg-bg-muted rounded text-text-muted transition-colors"
                    title={isCollapsed ? "Expand" : "Collapse"}
                >
                    {isCollapsed ? (
                        <ChevronRight size={20} />
                    ) : (
                        <ChevronDown size={20} />
                    )}
                </button>
                <h2 className="text-lg font-extrabold text-text-strong tracking-tight">
                    {label}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-bg-muted text-text-muted text-xs font-bold">
                    {lists.length}
                </span>
            </div>
        </div>

        {!isCollapsed && (
            <ul className="flex flex-row gap-5 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-border items-stretch min-h-[200px]">
                {lists.map((list) => (
                    <li
                        key={list.id}
                        draggable={list.items.length > 0}
                        onDragStart={(e) => onDragStart(e, list.id)}
                        onDragEnd={onDragEnd}
                        onDragOver={(e) => onDragOver(e, list.id)}
                        onDragLeave={() => onDragLeave(list.id)}
                        onDrop={(e) => onDrop(e, list.id)}
                        className={`w-[320px] shrink-0 rounded-xl transition-all ${
                            list.items.length > 0
                                ? "cursor-grab active:cursor-grabbing"
                                : ""
                        } ${
                            dragOverListId === list.id
                                ? "scale-[1.02] ring-2 ring-accent ring-offset-4 ring-offset-bg"
                                : ""
                        }`}
                    >
                        <ListCard
                            list={list}
                            onClick={() => onCardClick(list.id)}
                            onDelete={
                                list.ownerEmail === userEmail
                                    ? (e) => onDeleteList(e, list.id, list.name)
                                    : undefined
                            }
                            isDeleting={deletingListId === list.id}
                        />
                    </li>
                ))}
                {lists.length === 0 && (
                    <li className="w-full py-10 text-center text-text-muted border-2 border-dashed border-border rounded-xl list-none">
                        No lists in this category
                    </li>
                )}
            </ul>
        )}
    </section>
);

/**
 * Main dashboard component that displays the user's shopping lists.
 * Handles list selection, deletion, and rendering the details view.
 */
/**
 * Custom hook to handle drag and drop logic for Dashboard.
 */
const useDashboardDnD = (
    lists: ShoppingList[],
    addItem: (listId: string, item: Omit<Item, "id">) => Promise<boolean>,
    addList: (
        name: string,
        category?: ListCategory,
    ) => Promise<ShoppingList | null>,
    setActiveTab: (tab: TabType) => void,
) => {
    const [draggedListId, setDraggedListId] = useState<string | null>(null);
    const [dragOverListId, setDragOverListId] = useState<string | null>(null);
    const draggedListIdRef = useRef<string | null>(null);

    const resetDragState = () => {
        setDraggedListId(null);
        setDragOverListId(null);
        draggedListIdRef.current = null;
    };

    const handleDragStart = (e: React.DragEvent, listId: string) => {
        setDraggedListId(listId);
        draggedListIdRef.current = listId;

        const list = lists.find((l) => l.id === listId);
        if (list) {
            const ghost = document.createElement("div");
            ghost.style.position = "absolute";
            ghost.style.top = "-1000px";
            ghost.style.padding = "10px 20px";
            ghost.style.background =
                "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)";
            ghost.style.color = "white";
            ghost.style.borderRadius = "16px";
            ghost.style.boxShadow =
                "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)";
            ghost.style.zIndex = "-1000";
            ghost.style.pointerEvents = "none";
            ghost.style.border = "1px solid rgba(255, 255, 255, 0.2)";

            ghost.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 2px; font-family: sans-serif; padding-left: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-weight: 800; font-size: 15px; white-space: nowrap; letter-spacing: -0.01em;">${list.name}</span>
                    </div>
                    <div style="font-size: 11px; font-weight: 600; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.02em;">
                        ${list.items.length} items • ${list.category || "NORMAL"}
                    </div>
                </div>
            `;

            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, -15, 25);
            setTimeout(() => ghost.remove(), 0);
        }
    };

    const handleCopyListToNormal = async (listId: string) => {
        const sourceList = lists.find((l) => l.id === listId);
        if (!sourceList) return;

        const newList = await addList(`${sourceList.name} (Copy)`, "NORMAL");
        if (newList) {
            for (const item of sourceList.items) {
                await addItem(newList.id, {
                    name: item.name,
                    checked: false,
                    brand: item.brand,
                    quantity: item.quantity,
                    category: item.category,
                    price: item.price,
                    isRecurrent: false,
                });
            }
            setActiveTab("NORMAL");
        }
    };

    const handleTabDragOver = (e: React.DragEvent, section: string) => {
        const currentId = draggedListIdRef.current;
        if (section === "NORMAL" && currentId) {
            e.preventDefault();
            setDragOverListId("TAB_NORMAL");
        }
    };

    const handleTabDragLeave = () => {
        if (dragOverListId === "TAB_NORMAL") setDragOverListId(null);
    };

    const handleTabDrop = (e: React.DragEvent, section: string) => {
        const currentId = draggedListIdRef.current;
        if (section === "NORMAL" && currentId) {
            e.preventDefault();
            void handleCopyListToNormal(currentId);
            setDragOverListId(null);
        }
    };

    return {
        draggedListId,
        draggedListIdRef,
        dragOverListId,
        setDragOverListId,
        resetDragState,
        handleDragStart,
        handleCopyListToNormal,
        handleTabDragOver,
        handleTabDragLeave,
        handleTabDrop,
    };
};

/**
 * Custom hook to handle list management (deletion) logic for Dashboard.
 */
const useDashboardListManagement = (
    deleteList: (id: string) => Promise<boolean>,
) => {
    const [deleteTarget, setDeleteTarget] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const handleDeleteList = (
        e: React.MouseEvent<HTMLButtonElement>,
        id: string,
        name: string,
    ) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteError(null);
        setDeleteTarget({ id, name });
    };

    const confirmDeleteList = async (listId: string) => {
        try {
            if (await deleteList(listId)) {
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

    const closeDeleteModal = () => setDeleteTarget(null);

    return {
        deleteTarget,
        deleteError,
        handleDeleteList,
        confirmDeleteList,
        closeDeleteModal,
    };
};

/**
 * Custom hook to handle bulk import logic for Dashboard.
 */
const useDashboardImport = (
    lists: ShoppingList[],
    addItem: (listId: string, item: Omit<Item, "id">) => Promise<boolean>,
    updateItem: (
        listId: string,
        itemId: string,
        updates: Partial<Item>,
    ) => Promise<boolean>,
    resetDragState: () => void,
) => {
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

    const importSourceList = useMemo(
        () => lists.find((list) => list.id === importSourceListId) ?? null,
        [importSourceListId, lists],
    );
    const importTargetList = useMemo(
        () => lists.find((list) => list.id === importTargetListId) ?? null,
        [importTargetListId, lists],
    );

    const clearImportSelection = () => {
        setImportSourceListId(null);
        setImportTargetListId(null);
        setSelectedImportItemIds(new Set());
        setIsImportingItems(false);
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

        const existingByKey = new Map(
            importTargetList.items.map((item) => [
                buildItemDuplicateKey(item),
                item,
            ]),
        );
        const newItems: Omit<Item, "id">[] = [];

        setIsImportingItems(true);

        try {
            for (const item of importSourceList.items) {
                if (!selectedImportItemIds.has(item.id)) continue;

                const dupKey = buildItemDuplicateKey(item);
                const existing = existingByKey.get(dupKey);

                if (existing) {
                    const mergedQty = mergeQuantities(
                        existing.quantity,
                        item.quantity,
                    );
                    await updateItem(importTargetList.id, existing.id, {
                        quantity: mergedQty,
                    });
                } else {
                    newItems.push({
                        name: item.name,
                        checked: false,
                        brand: item.brand,
                        quantity: item.quantity,
                        category: item.category,
                        price: item.price,
                        isRecurrent: false,
                    });
                }
            }

            for (const newItem of newItems) {
                await addItem(importTargetList.id, newItem);
            }

            clearImportSelection();
        } catch (error) {
            console.error("Bulk add failed:", error);
            setIsImportingItems(false);
        }
    };

    const handleDropOnNormalList = (
        targetListId: string,
        draggedListId: string | null,
    ) => {
        if (!draggedListId || draggedListId === targetListId) {
            resetDragState();
            return;
        }

        const sourceList = lists.find((list) => list.id === draggedListId);
        const targetList = lists.find((list) => list.id === targetListId);

        if (!sourceList || !targetList) {
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

    return {
        importSourceList,
        importTargetList,
        selectedImportItemIds,
        isImportingItems,
        clearImportSelection,
        toggleImportItem,
        confirmImportSelection,
        handleDropOnNormalList,
    };
};

interface DashboardHeaderProps {
    selectedList: ShoppingList | null;
    showAiImport: boolean;
    listsCount: number;
    currentListName?: string | null;
    displayMode: "split" | "tabs";
    setDisplayMode: (mode: "split" | "tabs") => void;
    onBack: () => void;
    onAiImport: () => void;
    onNewList: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    selectedList,
    showAiImport,
    listsCount,
    currentListName,
    displayMode,
    setDisplayMode,
    onBack,
    onAiImport,
    onNewList,
}) => {
    const showDetailHeader = Boolean(selectedList) || showAiImport;
    const detailTitle = showAiImport
        ? "AI Shopping Assistant"
        : selectedList?.name;
    const listCountLabel = listsCount === 1 ? "list" : "lists";
    const listSummary = currentListName
        ? `${currentListName} • ${listsCount} total`
        : `${listsCount} ${listCountLabel}`;

    return (
        <header className="flex items-center justify-between gap-4 px-7 py-5 bg-surface border-b border-border sticky top-0 z-100 max-[600px]:p-4 max-[600px]:flex-wrap">
            {showDetailHeader ? (
                <>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center w-[38px] h-[38px] border border-border rounded-md bg-bg-muted text-text-strong transition-all duration-200 ease-out hover:bg-accent-subtle hover:border-accent-border hover:text-accent shrink-0 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                        onClick={onBack}
                        aria-label="Back"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="flex-1 ml-3 text-[22px] font-extrabold text-text-strong tracking-tight">
                        {detailTitle}
                    </h1>
                </>
            ) : (
                <>
                    <div className="flex flex-col">
                        <h1 className="text-[22px] font-extrabold text-text-strong tracking-tight">
                            My Lists
                        </h1>
                        <p className="text-[13px] text-text-muted mt-0.5">
                            {listSummary}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 max-[600px]:w-full">
                        <div className="flex items-center bg-bg-muted border border-border rounded-md p-1 mr-2">
                            <button
                                type="button"
                                onClick={() => setDisplayMode("split")}
                                className={`p-1.5 rounded transition-all ${displayMode === "split" ? "bg-surface shadow-sm text-accent" : "text-text-muted hover:text-text-strong"}`}
                                title="Split View"
                            >
                                <Columns size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setDisplayMode("tabs")}
                                className={`p-1.5 rounded transition-all ${displayMode === "tabs" ? "bg-surface shadow-sm text-accent" : "text-text-muted hover:text-text-strong"}`}
                                title="Tabbed View"
                            >
                                <Layout size={18} />
                            </button>
                        </div>
                        <button
                            type="button"
                            className="inline-flex items-center gap-[7px] px-[18px] py-[9px] bg-bg-muted text-text-strong border border-border rounded-md text-sm font-bold transition-all duration-200 ease-out hover:bg-border hover:-translate-y-px active:translate-y-0 max-[600px]:flex-1 max-[600px]:justify-center"
                            onClick={onAiImport}
                        >
                            <Sparkles size={18} className="text-accent" />
                            AI Import
                        </button>
                        <button
                            type="button"
                            className="inline-flex items-center gap-[7px] px-[18px] py-[9px] bg-accent text-text-on-accent border-none rounded-md text-sm font-bold transition-all duration-200 ease-out shadow-[0_2px_10px_var(--color-accent-glow)] shrink-0 hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_4px_18px_var(--color-accent-glow)] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-3 max-[600px]:flex-1 max-[600px]:justify-center"
                            onClick={onNewList}
                        >
                            <Plus size={20} />
                            New List
                        </button>
                    </div>
                </>
            )}
        </header>
    );
};

interface DashboardTabsViewProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
    groupedLists: Record<string, ShoppingList[]>;
    sectionOrder: readonly TabType[];
    sectionLabels: Record<string, string>;
    onCardClick: (id: string) => void;
    onDeleteList: (
        e: React.MouseEvent<HTMLButtonElement>,
        id: string,
        name: string,
    ) => void;
    deletingListId: string | null;
    handleDragStart: (e: React.DragEvent, id: string) => void;
    resetDragState: () => void;
    handleTabDragOver: (e: React.DragEvent, section: string) => void;
    handleTabDragLeave: () => void;
    handleTabDrop: (e: React.DragEvent, section: string) => void;
    handleDropOnNormalList: (
        targetListId: string,
        draggedListId: string | null,
    ) => void;
    draggedListIdRef: React.RefObject<string | null>;
    setDragOverListId: (id: string | null) => void;
    dragOverListId: string | null;
    getTabClassName: (section: string) => string;
    userEmail?: string;
}

const DashboardTabsView: React.FC<DashboardTabsViewProps> = ({
    activeTab,
    setActiveTab,
    groupedLists,
    sectionOrder,
    sectionLabels,
    onCardClick,
    onDeleteList,
    deletingListId,
    handleDragStart,
    resetDragState,
    handleTabDragOver,
    handleTabDragLeave,
    handleTabDrop,
    handleDropOnNormalList,
    draggedListIdRef,
    setDragOverListId,
    dragOverListId,
    getTabClassName,
    userEmail,
}) => (
    <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2 border border-border p-1 bg-surface rounded-xl sticky top-[-28px] z-20 shadow-sm overflow-x-auto scrollbar-none w-fit mx-auto">
            {sectionOrder.map((section) => (
                <button
                    key={section}
                    type="button"
                    onClick={() => setActiveTab(section)}
                    onDragOver={(e) => handleTabDragOver(e, section)}
                    onDragLeave={handleTabDragLeave}
                    onDrop={(e) => handleTabDrop(e, section)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-2 shrink-0 ${getTabClassName(section)}`}
                >
                    {sectionLabels[section]}
                    <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                            activeTab === section
                                ? "bg-white/20"
                                : "bg-bg-muted text-text-muted"
                        }`}
                    >
                        {groupedLists[section].length}
                    </span>
                </button>
            ))}
        </div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5 mt-2">
            {groupedLists[activeTab].map((list) => {
                const isDraggingOver = dragOverListId === list.id;
                return (
                    <li
                        key={list.id}
                        draggable={list.items.length > 0}
                        onDragStart={(e) => handleDragStart(e, list.id)}
                        onDragEnd={resetDragState}
                        onDragOver={(e) => {
                            const currentDragged = draggedListIdRef.current;
                            if (!currentDragged || currentDragged === list.id)
                                return;
                            e.preventDefault();
                            setDragOverListId(list.id);
                        }}
                        onDragLeave={() => {
                            if (isDraggingOver) setDragOverListId(null);
                        }}
                        onDrop={(e) => {
                            const droppedId = draggedListIdRef.current;
                            if (!droppedId || droppedId === list.id) return;
                            e.preventDefault();
                            handleDropOnNormalList(list.id, droppedId);
                        }}
                        className={`${
                            list.items.length > 0
                                ? "cursor-grab active:cursor-grabbing"
                                : ""
                        } ${
                            isDraggingOver
                                ? "scale-[1.02] ring-2 ring-accent ring-offset-4 ring-offset-bg rounded-xl transition-all"
                                : ""
                        }`}
                    >
                        <ListCard
                            list={list}
                            onClick={() => onCardClick(list.id)}
                            onDelete={
                                list.ownerEmail === userEmail
                                    ? (e) => onDeleteList(e, list.id, list.name)
                                    : undefined
                            }
                            isDeleting={deletingListId === list.id}
                        />
                    </li>
                );
            })}
            {groupedLists[activeTab].length === 0 && (
                <li className="col-span-full py-20 text-center text-text-muted list-none">
                    No lists in this category
                </li>
            )}
        </ul>
    </div>
);

interface DashboardSplitViewProps {
    groupedLists: Record<string, ShoppingList[]>;
    sectionOrder: readonly TabType[];
    sectionLabels: Record<string, string>;
    collapsedSections: Set<string>;
    toggleSection: (section: string) => void;
    draggedListId: string | null;
    draggedListIdRef: React.MutableRefObject<string | null>;
    dragOverListId: string | null;
    setDragOverListId: (id: string | null) => void;
    handleDragStart: (e: React.DragEvent, id: string) => void;
    resetDragState: () => void;
    handleDropOnNormalList: (
        targetListId: string,
        draggedListId: string | null,
    ) => void;
    onCardClick: (id: string) => void;
    onDeleteList: (
        e: React.MouseEvent<HTMLButtonElement>,
        id: string,
        name: string,
    ) => void;
    deletingListId: string | null;
    userEmail?: string;
}

const DashboardSplitView: React.FC<DashboardSplitViewProps> = ({
    groupedLists,
    sectionOrder,
    sectionLabels,
    collapsedSections,
    toggleSection,
    draggedListIdRef,
    dragOverListId,
    setDragOverListId,
    handleDragStart,
    resetDragState,
    handleDropOnNormalList,
    onCardClick,
    onDeleteList,
    deletingListId,
    userEmail,
}) => (
    <div className="flex flex-col gap-8 pb-4">
        {sectionOrder.map((section) => (
            <ListCategorySection
                key={section}
                section={section}
                label={sectionLabels[section]}
                lists={groupedLists[section]}
                isCollapsed={collapsedSections.has(section)}
                onToggle={() => toggleSection(section)}
                onDragStart={handleDragStart}
                onDragEnd={resetDragState}
                onDragOver={(e, id) => {
                    const currentDragged = draggedListIdRef.current;
                    if (!currentDragged || currentDragged === id) return;
                    e.preventDefault();
                    setDragOverListId(id);
                }}
                onDragLeave={(id) => {
                    if (dragOverListId === id) setDragOverListId(null);
                }}
                onDrop={(e, id) => {
                    const currentDragged = draggedListIdRef.current;
                    if (!currentDragged || currentDragged === id) return;
                    e.preventDefault();
                    handleDropOnNormalList(id, currentDragged);
                }}
                dragOverListId={dragOverListId}
                onCardClick={onCardClick}
                onDeleteList={onDeleteList}
                deletingListId={deletingListId}
                userEmail={userEmail}
            />
        ))}
    </div>
);

/**
 * Main dashboard component that displays the user's shopping lists.
 */
const Dashboard = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const user = useStore((state) => state.user);

    const {
        lists,
        currentList,
        isLoading,
        isModalOpen,
        deletingListId,
        pendingInvitations,
        fetchLists,
        fetchPendingInvitations,
        addList,
        deleteList,
        addItem,
        updateItem,
        openModal,
        closeModal,
    } = useListsStore();

    const [displayMode, setDisplayMode] = useState<"split" | "tabs">(() => {
        return (
            (localStorage.getItem("dashboard_display_mode") as
                | "split"
                | "tabs") || "split"
        );
    });
    const [activeTab, setActiveTab] = useState<TabType>("NORMAL");
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
        new Set(),
    );

    const {
        draggedListId,
        draggedListIdRef,
        dragOverListId,
        setDragOverListId,
        resetDragState,
        handleDragStart,
        handleTabDragOver,
        handleTabDragLeave,
        handleTabDrop,
    } = useDashboardDnD(lists, addItem, addList, setActiveTab);

    const {
        deleteTarget,
        deleteError,
        handleDeleteList,
        confirmDeleteList,
        closeDeleteModal,
    } = useDashboardListManagement(deleteList);

    const {
        importSourceList,
        importTargetList,
        selectedImportItemIds,
        isImportingItems,
        clearImportSelection,
        toggleImportItem,
        confirmImportSelection,
        handleDropOnNormalList,
    } = useDashboardImport(lists, addItem, updateItem, resetDragState);

    useEffect(() => {
        localStorage.setItem("dashboard_display_mode", displayMode);
    }, [displayMode]);

    useEffect(() => {
        fetchLists();
        fetchPendingInvitations();
    }, [fetchLists, fetchPendingInvitations]);

    const toggleSection = (section: string) => {
        setCollapsedSections((prev) => {
            const next = new Set(prev);
            if (next.has(section)) next.delete(section);
            else next.add(section);
            return next;
        });
    };

    const showAiImport = searchParams.get("import") === "ai";
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
        NORMAL: "Your cart",
        RECIPE: "Recipe lists",
        FREQUENT: "Frequent lists",
    };

    const hasGroupedLists = sectionOrder.some(
        (section) => groupedLists[section].length > 0,
    );

    const handleCardClick = (listId: string) =>
        setSearchParams({ list: listId });

    const clearImport = () =>
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete("import");
            return next;
        });

    const getTabClassName = (section: string) => {
        if (activeTab === section)
            return "bg-accent text-text-on-accent shadow-md";
        if (dragOverListId === "TAB_NORMAL" && section === "NORMAL")
            return "bg-accent-subtle text-accent ring-2 ring-accent";
        return "text-text-muted hover:text-text-strong hover:bg-bg-muted";
    };

    const renderDashboardContent = (): ReactNode => {
        if (isLoading && !(isModalOpen || showAiImport)) {
            return (
                <div className="flex flex-col items-center justify-center gap-4 py-20 text-text-muted text-sm">
                    <div className="w-9 h-9 border-[3px] border-border border-t-accent rounded-full animate-spin" />
                    <p>Loading lists...</p>
                </div>
            );
        }

        if (showAiImport) {
            return (
                <div className="max-w-[800px] mx-auto w-full flex-1 flex flex-col min-h-0">
                    <AiImportModal onClose={clearImport} />
                </div>
            );
        }

        if (lists.length === 0) {
            if (pendingInvitations.length > 0) {
                return (
                    <div className="flex flex-col gap-8">
                        <PendingInvitesSection
                            invitations={pendingInvitations}
                        />
                        <DashboardEmptyState openModal={openModal} />
                    </div>
                );
            }
            return <DashboardEmptyState openModal={openModal} />;
        }

        if (selectedList) {
            return (
                <div className="max-w-[860px] mx-auto w-full">
                    <ListDetail listIdOverride={selectedList.id} />
                </div>
            );
        }

        if (hasGroupedLists) {
            return (
                <div className="flex flex-col gap-8">
                    <PendingInvitesSection invitations={pendingInvitations} />
                    {displayMode === "tabs" ? (
                        <DashboardTabsView
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            groupedLists={groupedLists}
                            sectionOrder={sectionOrder}
                            sectionLabels={sectionLabels}
                            onCardClick={handleCardClick}
                            onDeleteList={handleDeleteList}
                            deletingListId={deletingListId}
                            handleDragStart={handleDragStart}
                            resetDragState={resetDragState}
                            handleTabDragOver={handleTabDragOver}
                            handleTabDragLeave={handleTabDragLeave}
                            handleTabDrop={handleTabDrop}
                            handleDropOnNormalList={handleDropOnNormalList}
                            draggedListIdRef={draggedListIdRef}
                            setDragOverListId={setDragOverListId}
                            dragOverListId={dragOverListId}
                            getTabClassName={getTabClassName}
                            userEmail={user?.email}
                        />
                    ) : (
                        <DashboardSplitView
                            groupedLists={groupedLists}
                            sectionOrder={sectionOrder}
                            sectionLabels={sectionLabels}
                            collapsedSections={collapsedSections}
                            toggleSection={toggleSection}
                            draggedListId={draggedListId}
                            draggedListIdRef={draggedListIdRef}
                            dragOverListId={dragOverListId}
                            setDragOverListId={setDragOverListId}
                            handleDragStart={handleDragStart}
                            resetDragState={resetDragState}
                            handleDropOnNormalList={handleDropOnNormalList}
                            onCardClick={handleCardClick}
                            onDeleteList={handleDeleteList}
                            deletingListId={deletingListId}
                            userEmail={user?.email}
                        />
                    )}
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-8">
                <PendingInvitesSection invitations={pendingInvitations} />
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
                    {lists.map((list) => (
                        <li key={list.id} className="list-none">
                            <ListCard
                                list={list}
                                onClick={() => handleCardClick(list.id)}
                                onDelete={
                                    list.ownerEmail === user?.email
                                        ? (e) =>
                                              handleDeleteList(
                                                  e,
                                                  list.id,
                                                  list.name,
                                              )
                                        : undefined
                                }
                                isDeleting={deletingListId === list.id}
                            />
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    return (
        <div className="flex flex-col bg-bg h-full overflow-hidden">
            <DashboardHeader
                selectedList={selectedList}
                showAiImport={showAiImport}
                listsCount={lists.length}
                currentListName={currentList?.name}
                displayMode={displayMode}
                setDisplayMode={setDisplayMode}
                onBack={showAiImport ? clearImport : () => setSearchParams({})}
                onAiImport={() =>
                    setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set("import", "ai");
                        return next;
                    })
                }
                onNewList={openModal}
            />

            <main
                className={`flex-1 p-7 max-w-[1200px] mx-auto w-full box-border max-[600px]:p-4 ${showAiImport ? "overflow-hidden flex flex-col" : "overflow-y-auto scrollbar-thin"}`}
            >
                {renderDashboardContent()}
            </main>

            {isModalOpen && <CreateListModal onClose={closeModal} />}
            {deleteTarget && (
                <ConfirmDeleteModal
                    listId={deleteTarget.id}
                    listName={deleteTarget.name}
                    isDeleting={deletingListId === deleteTarget.id}
                    error={deleteError}
                    onCancel={closeDeleteModal}
                    onConfirm={confirmDeleteList}
                />
            )}
            <ImportItemsModal
                isOpen={Boolean(importSourceList && importTargetList)}
                onClose={clearImportSelection}
                sourceListName={importSourceList?.name}
                sourceItems={importSourceList?.items ?? []}
                targetList={importTargetList}
                selectedItemIds={selectedImportItemIds}
                onToggleItem={toggleImportItem}
                onConfirm={confirmImportSelection}
                isSubmitting={isImportingItems}
            />
        </div>
    );
};

export default Dashboard;
