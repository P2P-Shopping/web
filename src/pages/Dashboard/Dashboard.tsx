import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Columns,
    Layout,
    Plus,
    Sparkles,
} from "lucide-react";
import {
    type MouseEvent,
    type ReactNode,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { ImportItemsModal, ListCard } from "../../components";
import { useListsStore } from "../../store/useListsStore";
import { buildItemDuplicateKey } from "../../utils/listUtils";
import ListDetail from "../ListDetail/ListDetail";
import AiImportModal from "./AiImportModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import CreateListModal from "./CreateListModal";

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
        addList,
        deleteList,
        addItem,
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
    const [activeTab, setActiveTab] = useState<
        "NORMAL" | "RECIPE" | "FREQUENT"
    >("NORMAL");
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
        new Set(),
    );

    useEffect(() => {
        localStorage.setItem("dashboard_display_mode", displayMode);
    }, [displayMode]);

    const toggleSection = (section: string) => {
        setCollapsedSections((prev) => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    };

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

    const handleDragStart = (e: React.DragEvent, listId: string) => {
        setDraggedListId(listId);

        const list = lists.find((l) => l.id === listId);
        if (list) {
            // Create a simplified drag ghost element
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
            // Offset the ghost so it's to the right and slightly below the cursor
            e.dataTransfer.setDragImage(ghost, -15, 25);

            // Cleanup ghost element after the browser has taken the snapshot
            setTimeout(() => {
                if (document.body.contains(ghost)) {
                    document.body.removeChild(ghost);
                }
            }, 0);
        }
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
        } catch (error) {
            console.error("Bulk add failed:", error);
            setIsImportingItems(false);
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
            // Switch to normal tab if in tab mode
            setActiveTab("NORMAL");
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
            <div className="max-w-[800px] mx-auto w-full flex-1 flex flex-col min-h-0">
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
    } else if (hasGroupedLists) {
        if (displayMode === "tabs") {
            mainContent = (
                <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-2 border border-border p-1 bg-surface rounded-xl sticky top-[-28px] z-20 shadow-sm">
                        {sectionOrder.map((section) => (
                            <button
                                key={section}
                                type="button"
                                onClick={() => setActiveTab(section)}
                                onDragOver={(e) => {
                                    if (section === "NORMAL" && draggedListId) {
                                        const draggedList = lists.find(
                                            (l) => l.id === draggedListId,
                                        );
                                        if (
                                            draggedList &&
                                            (draggedList.category ===
                                                "RECIPE" ||
                                                draggedList.category ===
                                                    "FREQUENT")
                                        ) {
                                            e.preventDefault();
                                            setDragOverListId("TAB_NORMAL");
                                        }
                                    }
                                }}
                                onDragLeave={() => {
                                    if (dragOverListId === "TAB_NORMAL")
                                        setDragOverListId(null);
                                }}
                                onDrop={(e) => {
                                    if (section === "NORMAL" && draggedListId) {
                                        e.preventDefault();
                                        void handleCopyListToNormal(
                                            draggedListId,
                                        );
                                        setDragOverListId(null);
                                    }
                                }}
                                className={`px-4 py-2 text-sm font-bold rounded-md transition-all flex items-center gap-2 ${
                                    activeTab === section
                                        ? "bg-accent text-text-on-accent shadow-md"
                                        : dragOverListId === "TAB_NORMAL" &&
                                            section === "NORMAL"
                                          ? "bg-accent-subtle text-accent ring-2 ring-accent"
                                          : "text-text-muted hover:text-text-strong hover:bg-bg-muted"
                                }`}
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
                        {groupedLists[activeTab].map((list) => (
                            <li
                                key={list.id}
                                draggable={
                                    activeTab !== "NORMAL" &&
                                    list.items.length > 0
                                }
                                onDragStart={(e) => handleDragStart(e, list.id)}
                                onDragEnd={resetDragState}
                                className={
                                    activeTab !== "NORMAL" &&
                                    list.items.length > 0
                                        ? "cursor-grab active:cursor-grabbing"
                                        : ""
                                }
                            >
                                <ListCard
                                    list={list}
                                    onClick={() => handleCardClick(list.id)}
                                    onDelete={(e) =>
                                        handleDeleteList(e, list.id, list.name)
                                    }
                                    isDeleting={deletingListId === list.id}
                                />
                            </li>
                        ))}
                        {groupedLists[activeTab].length === 0 && (
                            <li className="col-span-full py-20 text-center text-text-muted list-none">
                                No lists in this category
                            </li>
                        )}
                    </ul>
                </div>
            );
        } else {
            mainContent = (
                <div className="flex flex-col gap-8 pb-4">
                    {sectionOrder.map((section) => {
                        const sectionLists = groupedLists[section];
                        const isCollapsed = collapsedSections.has(section);

                        return (
                            <section
                                key={section}
                                className="flex flex-col gap-4"
                            >
                                <div className="flex items-center justify-between border-b border-border pb-3">
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                toggleSection(section)
                                            }
                                            className="p-1 hover:bg-bg-muted rounded text-text-muted transition-colors"
                                            title={
                                                isCollapsed
                                                    ? "Expand"
                                                    : "Collapse"
                                            }
                                        >
                                            {isCollapsed ? (
                                                <ChevronRight size={20} />
                                            ) : (
                                                <ChevronDown size={20} />
                                            )}
                                        </button>
                                        <h2 className="text-lg font-extrabold text-text-strong tracking-tight">
                                            {sectionLabels[section]}
                                        </h2>
                                        <span className="px-2 py-0.5 rounded-full bg-bg-muted text-text-muted text-xs font-bold">
                                            {sectionLists.length}
                                        </span>
                                    </div>
                                </div>

                                {!isCollapsed && (
                                    <ul className="flex flex-row gap-5 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-border items-stretch min-h-[200px]">
                                        {sectionLists.map((list) => (
                                            <li
                                                key={list.id}
                                                draggable={
                                                    section !== "NORMAL" &&
                                                    list.items.length > 0
                                                }
                                                onDragStart={(e) =>
                                                    handleDragStart(e, list.id)
                                                }
                                                onDragEnd={resetDragState}
                                                onDragOver={(e) => {
                                                    if (section !== "NORMAL")
                                                        return;
                                                    if (
                                                        !draggedListId ||
                                                        draggedListId ===
                                                            list.id
                                                    )
                                                        return;
                                                    e.preventDefault();
                                                    setDragOverListId(list.id);
                                                }}
                                                onDragLeave={() => {
                                                    if (
                                                        dragOverListId ===
                                                        list.id
                                                    ) {
                                                        setDragOverListId(null);
                                                    }
                                                }}
                                                onDrop={(e) => {
                                                    if (section !== "NORMAL")
                                                        return;
                                                    e.preventDefault();
                                                    handleDropOnNormalList(
                                                        list.id,
                                                    );
                                                }}
                                                className={`w-[320px] shrink-0 rounded-xl transition-all ${
                                                    section !== "NORMAL" &&
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
                                                        deletingListId ===
                                                        list.id
                                                    }
                                                />
                                            </li>
                                        ))}
                                        {sectionLists.length === 0 && (
                                            <li className="w-full py-10 text-center text-text-muted border-2 border-dashed border-border rounded-xl list-none">
                                                No lists in this category
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </section>
                        );
                    })}
                </div>
            );
        }
    } else {
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
    }

    return (
        <div className="flex flex-col bg-bg h-full overflow-hidden">
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

            <main
                className={`flex-1 p-7 max-w-[1200px] mx-auto w-full box-border max-[600px]:p-4 ${showAiImport ? "overflow-hidden flex flex-col" : "overflow-y-auto scrollbar-thin"}`}
            >
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
            <ImportItemsModal
                isOpen={Boolean(importSourceList && importTargetList)}
                onClose={clearImportSelection}
                sourceListName={importSourceList?.name}
                sourceItems={importSourceList?.items ?? []}
                targetList={importTargetList}
                selectedItemIds={selectedImportItemIds}
                onToggleItem={toggleImportItem}
                onConfirm={() => {
                    void confirmImportSelection();
                }}
                isSubmitting={isImportingItems}
            />
        </div>
    );
};

export default Dashboard;
