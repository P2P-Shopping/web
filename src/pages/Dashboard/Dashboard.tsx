import { type MouseEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ListDetail from "../ListDetail/ListDetail";
import { useListsStore } from "../../store/useListsStore";
import type { Item } from "../../types";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import CreateListModal from "./CreateListModal";
import "./Dashboard.css";

const Dashboard = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [deleteTarget, setDeleteTarget] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const {
        lists,
        isLoading,
        isModalOpen,
        fetchLists,
        deleteList,
        openModal,
        closeModal,
    } = useListsStore();

    // Fetch lists on mount
    useEffect(() => {
        void fetchLists();
    }, [fetchLists]);

    const selectedListId = searchParams.get("list");
    const selectedList = useMemo(
        () => lists.find((list) => list.id === selectedListId) ?? null,
        [lists, selectedListId],
    );

    // Handle Card Click
    const handleCardClick = (listId: string) => {
        setSearchParams({ list: listId });
    };

    // Format date nicely
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("ro-RO", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // Handle delete list
    const handleDeleteList = (
        e: MouseEvent<HTMLButtonElement>,
        listId: string,
        listName: string,
    ) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteTarget({ id: listId, name: listName });
    };

    const confirmDeleteList = async (listId: string) => {
        const deleted = await deleteList(listId);
        if (deleted) {
            setDeleteTarget(null);
        }
    };

    const cancelDeleteList = () => {
        setDeleteTarget(null);
    };

    const clearSelectedList = () => {
        setSearchParams({});
    };

    // Calculate items count
    const getItemsCount = (items: Item[]) => {
        const checked = items.filter((item) => item.checked).length;
        if (items.length === 0) {
            return "Fără produse";
        }

        return `${checked}/${items.length} produse`;
    };

    let mainContent: ReactNode;
    if (isLoading) {
        mainContent = (
            <div className="loading-state">
                <div className="spinner" />
                <p>Se încarcă listele...</p>
            </div>
        );
    } else if (lists.length === 0) {
        mainContent = (
            <div className="empty-state">
                <h2>Nu ai nicio listă</h2>
                <p>Crează prima ta listă de cumpărături!</p>
                <button
                    type="button"
                    className="create-btn-primary"
                    onClick={openModal}
                >
                    Creează Listă
                </button>
            </div>
        );
    } else if (selectedList) {
        mainContent = (
            <div className="selected-list-view">
                <div className="selected-list-toolbar">
                    <button
                        type="button"
                        className="back-to-lists-btn"
                        onClick={clearSelectedList}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            aria-hidden="true"
                        >
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                        <span>All Lists</span>
                    </button>
                    <div className="selected-list-breadcrumb">
                        <span className="selected-list-label">Opened List</span>
                        <strong>{selectedList.name}</strong>
                    </div>
                </div>
                <ListDetail
                    listIdOverride={selectedList.id}
                    listTitle={selectedList.name}
                    showAiImport={false}
                />
            </div>
        );
    } else {
        mainContent = (
            <div className="lists-grid">
                {lists.map((list) => (
                    <div key={list.id} className="list-card-shell">
                        <div
                            className="list-card"
                            onClick={() => handleCardClick(list.id)}
                            onKeyUp={(e) =>
                                e.key === "Enter" && handleCardClick(list.id)
                            }
                            tabIndex={0}
                            role="button"
                            aria-label={`Deschide lista ${list.name}`}
                        >
                            <div className="card-header">
                                <div className="card-title-group">
                                    <p className="card-kicker">
                                        Listă partajată
                                    </p>
                                    <h3>{list.name}</h3>
                                </div>
                                <div className="card-actions">
                                    <span className="updated-pill">
                                        {formatDate(list.updatedAt)}
                                    </span>
                                    <button
                                        type="button"
                                        className="delete-btn"
                                        onClick={(e) =>
                                            handleDeleteList(
                                                e,
                                                list.id,
                                                list.name,
                                            )
                                        }
                                        title="Șterge lista"
                                        aria-label="Șterge lista"
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            width="16"
                                            height="16"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            fill="none"
                                            aria-hidden="true"
                                        >
                                            <polyline points="3,6 5,6 21,6" />
                                            <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="card-body">
                                <div className="list-stats">
                                    <span className="stat stat-pill">{getItemsCount(list.items)}</span>
                                    <span className="stat stat-pill">{list.ownerName || "Tu"}</span>
                                </div>

                                <div className="items-preview">
                                    {list.items.slice(0, 3).map((item) => (
                                        <div
                                            key={item.id}
                                            className={`item-preview ${item.checked ? "checked" : ""}`}
                                        >
                                            <span className="checkbox-icon" aria-hidden="true" />
                                            <span className="item-name">
                                                {item.name}
                                            </span>
                                        </div>
                                    ))}
                                    {list.items.length > 3 && (
                                        <div className="more-items">
                                            +{list.items.length - 3} produse în
                                            plus
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-content">
                    <h1>My Lists</h1>
                    <p className="subtitle">
                        {selectedList
                            ? selectedList.name
                            : `${lists.length} ${lists.length === 1 ? "listă" : "liste"}`}
                    </p>
                </div>
                {!selectedList && (
                    <button
                        type="button"
                        className="create-btn"
                        onClick={openModal}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="20"
                            height="20"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            aria-hidden="true"
                        >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Listă Nouă
                    </button>
                )}
            </header>

            {/* Content */}
            <main className="dashboard-content">{mainContent}</main>

            {/* Create List Modal */}
            {isModalOpen && <CreateListModal onClose={closeModal} />}
            {deleteTarget && (
                <ConfirmDeleteModal
                    listId={deleteTarget.id}
                    listName={deleteTarget.name}
                    onCancel={cancelDeleteList}
                    onConfirm={confirmDeleteList}
                />
            )}
        </div>
    );
};

export default Dashboard;
