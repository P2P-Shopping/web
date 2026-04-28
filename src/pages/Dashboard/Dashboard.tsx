import { ChevronLeft, Plus, Sparkles } from "lucide-react";
import {
    type MouseEvent,
    type ReactNode,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useSearchParams } from "react-router-dom";
import { ListCard, PresenceBar } from "../../components";
import { useListsStore } from "../../store/useListsStore";
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
                {lists.map((list) => (
                    <ListCard
                        key={list.id}
                        list={list}
                        onClick={() => handleCardClick(list.id)}
                        onDelete={(e) =>
                            handleDeleteList(e, list.id, list.name)
                        }
                        isDeleting={deletingListId === list.id}
                    />
                ))}
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
