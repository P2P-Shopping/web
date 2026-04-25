import { Check, ChevronLeft, Plus, Sparkles, Trash2 } from "lucide-react";
import {
    type MouseEvent,
    type ReactNode,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { PresenceBar } from "../../components";
import { useListsStore } from "../../store/useListsStore";
import type { Item } from "../../types";
import ListDetail from "../ListDetail/ListDetail";
import AiImportModal from "./AiImportModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import CreateListModal from "./CreateListModal";

const PREVIEW_LIMIT = 2;

const Dashboard = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [deleteTarget, setDeleteTarget] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const {
        lists,
        isLoading,
        isModalOpen,
        deletingListId,
        fetchLists,
        deleteList,
        openModal,
        closeModal,
    } = useListsStore();

    const showAiImport = searchParams.get("import") === "ai";

    useEffect(() => {
        void fetchLists();
    }, [fetchLists]);

    const selectedListId = searchParams.get("list");
    const selectedList = useMemo(
        () => lists.find((list) => list.id === selectedListId) ?? null,
        [lists, selectedListId],
    );

    const handleCardClick = (listId: string) => {
        setSearchParams({ list: listId });
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

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

    const cancelDeleteList = () => {
        setDeleteTarget(null);
    };

    const clearSelectedList = () => {
        setSearchParams({});
    };

    const getItemsCount = (items: Item[]) => {
        const checked = items.filter((item) => item.checked).length;
        if (items.length === 0) {
            return "No items";
        }

        const label = items.length === 1 ? "item" : "items";
        return `${checked}/${items.length} ${label}`;
    };

    let mainContent: ReactNode;
    if (isLoading) {
        mainContent = (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-text-muted text-sm">
                <div className="w-9 h-9 border-[3px] border-border border-t-accent rounded-full animate-spin" />
                <p>Loading lists...</p>
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
    } else {
        mainContent = (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
                {lists.map((list) => {
                    const uncheckedItems = list.items.filter(
                        (item) => !item.checked,
                    );
                    return (
                        <div key={list.id} className="relative group">
                            <button
                                type="button"
                                className="w-full h-full text-left relative bg-surface border border-border rounded-xl p-[22px_22px_18px] cursor-pointer transition-all duration-200 ease-out hover:border-accent-border hover:shadow-md hover:shadow-accent-glow/20 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 flex flex-col gap-[18px] outline-none"
                                onClick={() => handleCardClick(list.id)}
                                aria-label={`Open list ${list.name}`}
                            >
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <h3
                                            className="text-lg font-bold text-text-strong leading-tight truncate"
                                            title={list.name}
                                        >
                                            {list.name}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 pr-12">
                                        <span className="px-2.5 py-1 rounded-full bg-bg-muted text-text-muted text-[11px] font-semibold border border-border whitespace-nowrap">
                                            {formatDate(list.updatedAt)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3.5 mt-auto">
                                    <div className="flex flex-wrap gap-1.5">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-subtle text-accent text-xs font-semibold whitespace-nowrap">
                                            {getItemsCount(list.items)}
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-subtle text-accent text-xs font-semibold whitespace-nowrap">
                                            {list.ownerName || "You"}
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        {(() => {
                                            if (list.items.length === 0) {
                                                return (
                                                    <div className="flex flex-col items-center justify-center py-8 rounded-xl border-2 border-dashed border-border/40 text-text-muted/60 gap-1.5">
                                                        <Plus size={20} />
                                                        <span className="text-[11px] font-bold uppercase tracking-wider">
                                                            Empty List
                                                        </span>
                                                    </div>
                                                );
                                            }

                                            if (uncheckedItems.length === 0) {
                                                return (
                                                    <div className="flex flex-col items-center justify-center py-8 rounded-xl bg-success-subtle/10 border border-success-border/20 text-success gap-2 animate-in fade-in zoom-in-95 duration-500">
                                                        <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center">
                                                            <Check
                                                                size={20}
                                                                className="text-success"
                                                            />
                                                        </div>
                                                        <span className="text-[11px] font-extrabold uppercase tracking-widest">
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
                                                                    className="w-[18px] h-[18px] border-2 border-border-strong rounded-[5px] shrink-0 flex items-center justify-center transition-all bg-surface"
                                                                    aria-hidden="true"
                                                                />
                                                                <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                                                                    {item.name}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    {uncheckedItems.length >
                                                        PREVIEW_LIMIT && (
                                                        <div className="flex items-center justify-center p-[6px_12px] rounded-md bg-bg-muted border border-border text-[11px] font-bold text-text-muted transition-all hover:bg-border/40">
                                                            and another{" "}
                                                            {uncheckedItems.length -
                                                                PREVIEW_LIMIT}{" "}
                                                            unchecked items
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </button>

                            <button
                                type="button"
                                className="absolute top-5 right-5 flex items-center justify-center w-8.5 h-8.5 border border-border rounded-md bg-bg-muted text-text-muted transition-all duration-200 ease-out hover:bg-danger-subtle hover:text-danger hover:border-danger-border shrink-0 focus-visible:outline-2 focus-visible:outline-danger focus-visible:outline-offset-2 z-10"
                                onClick={(e) =>
                                    handleDeleteList(e, list.id, list.name)
                                }
                                title={`Delete ${list.name}`}
                                aria-label={`Delete list ${list.name}`}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="flex flex-col bg-bg">
            <header className="flex items-center justify-between gap-4 px-7 py-5 bg-surface border-b border-border sticky top-0 z-100 max-[600px]:p-4 max-[600px]:flex-wrap">
                {selectedList ? (
                    <>
                        <button
                            type="button"
                            className="inline-flex items-center justify-center w-[38px] h-[38px] border border-border rounded-md bg-bg-muted text-text-strong transition-all duration-200 ease-out hover:bg-accent-subtle hover:border-accent-border hover:text-accent shrink-0 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                            onClick={clearSelectedList}
                            aria-label="Back to lists"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <h1 className="flex-1 ml-3 text-[22px] font-extrabold text-text-strong tracking-tight">
                            {selectedList.name}
                        </h1>
                        <div className="flex items-center gap-4 shrink-0 max-[600px]:w-full max-[600px]:justify-between">
                            <PresenceBar variant="avatars" />
                        </div>
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
            {showAiImport && (
                <AiImportModal
                    onClose={() => {
                        setSearchParams((prev) => {
                            const next = new URLSearchParams(prev);
                            next.delete("import");
                            return next;
                        });
                    }}
                />
            )}
        </div>
    );
};

export default Dashboard;
