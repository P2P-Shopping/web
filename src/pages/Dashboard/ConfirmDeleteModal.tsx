import { useEffect, useRef } from "react";
import "./CreateListModal.css";

interface ConfirmDeleteModalProps {
    listId: string;
    listName: string;
    onCancel: () => void;
    onConfirm: (listId: string) => void;
}

const ConfirmDeleteModal = ({
    listId,
    listName,
    onCancel,
    onConfirm,
}: ConfirmDeleteModalProps) => {
    const dialogRef = useRef<HTMLDialogElement | null>(null);
    const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        dialogRef.current?.showModal();
        const rafId = window.requestAnimationFrame(() => {
            confirmButtonRef.current?.focus();
        });

        return () => {
            window.cancelAnimationFrame(rafId);
            dialogRef.current?.close();
        };
    }, []);

    return (
        <dialog
            ref={dialogRef}
            className="modal-backdrop"
            aria-labelledby="confirm-delete-title"
            onCancel={(e) => {
                e.preventDefault();
                onCancel();
            }}
            onKeyDown={(e) => {
                if (e.key === "Escape") {
                    e.preventDefault();
                    onCancel();
                }
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onCancel();
                }
            }}
        >
            <div className="modal-content">
                <div className="modal-header">
                    <h2 id="confirm-delete-title">Confirmă ștergerea</h2>
                    <button
                        type="button"
                        className="close-btn"
                        onClick={onCancel}
                        aria-label="Închide"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="24"
                            height="24"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            aria-hidden="true"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="modal-body">
                    <p>
                        Ștergi lista <strong>{listName}</strong>?
                    </p>
                </div>

                <div className="modal-footer">
                    <button
                        type="button"
                        className="cancel-btn"
                        onClick={onCancel}
                    >
                        Renunță
                    </button>
                    <button
                        ref={confirmButtonRef}
                        type="button"
                        className="submit-btn"
                        onClick={() => onConfirm(listId)}
                    >
                        Șterge
                    </button>
                </div>
            </div>
        </dialog>
    );
};

export default ConfirmDeleteModal;
