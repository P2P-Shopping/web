// ============================================
// CREATE LIST MODAL - Create new shopping list
// ============================================

import {
    type FormEvent,
    type KeyboardEvent,
    useEffect,
    useRef,
    useState,
} from "react";
import { useListsStore } from "../../store/useListsStore";
import "./CreateListModal.css";

interface CreateListModalProps {
    onClose: () => void;
}

const CreateListModal = ({ onClose }: CreateListModalProps) => {
    const [listName, setListName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const dialogRef = useRef<HTMLDialogElement | null>(null);
    const listNameInputRef = useRef<HTMLInputElement | null>(null);
    const isMountedRef = useRef(true);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const { addList } = useListsStore();

    useEffect(() => {
        previousFocusRef.current = document.activeElement as HTMLElement | null;
        isMountedRef.current = true;
        dialogRef.current?.showModal();
        const rafId = window.requestAnimationFrame(() => {
            listNameInputRef.current?.focus();
        });

        return () => {
            isMountedRef.current = false;
            window.cancelAnimationFrame(rafId);
            dialogRef.current?.close();
            previousFocusRef.current?.focus();
        };
    }, []);

    const focusableSelector =
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const trapFocus = (e: KeyboardEvent<HTMLDialogElement>) => {
        if (e.key === "Escape") {
            e.preventDefault();
            onClose();
            return;
        }

        if (e.key !== "Tab" || !dialogRef.current) return;

        const focusableElements = Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
        ).filter((element) => !element.hasAttribute("disabled"));

        if (focusableElements.length === 0) {
            e.preventDefault();
            return;
        }

        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstFocusable) {
            e.preventDefault();
            lastFocusable.focus();
        } else if (!e.shiftKey && document.activeElement === lastFocusable) {
            e.preventDefault();
            firstFocusable.focus();
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        // Validate
        const trimmedName = listName.trim();
        if (!trimmedName) {
            return;
        }

        setIsSubmitting(true);

        try {
            const success = await addList(trimmedName);
            if (success) {
                onClose();
            }
        } catch (error) {
            console.error("Failed to create list:", error);
        } finally {
            if (isMountedRef.current) {
                setIsSubmitting(false);
            }
        }
    };

    return (
        <dialog
            ref={dialogRef}
            className="modal-backdrop"
            aria-labelledby="create-list-title"
            onCancel={(e) => {
                e.preventDefault();
                onClose();
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
            onKeyDown={trapFocus}
        >
            <div className="modal-content">
                <div className="modal-header">
                    <h2 id="create-list-title">Creare Listă Nouă</h2>
                    <button
                        type="button"
                        className="close-btn"
                        onClick={onClose}
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

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <label htmlFor="list-name">Numele listei</label>
                        <input
                            ref={listNameInputRef}
                            id="list-name"
                            type="text"
                            value={listName}
                            onChange={(e) => setListName(e.target.value)}
                            placeholder="Dă un nume descriptiv pentru lista ta"
                            maxLength={100}
                        />
                        {/* <p className="helper-text">
                            Dă un nume descriptiv pentru lista ta
                        </p> */}
                    </div>

                    <div className="modal-footer">
                        <button
                            type="button"
                            className="cancel-btn"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Anulează
                        </button>
                        <button
                            type="submit"
                            className="submit-btn"
                            disabled={!listName.trim() || isSubmitting}
                        >
                            {isSubmitting ? (
                                <span className="loading-spinner" />
                            ) : (
                                "Crează Lista"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </dialog>
    );
};

export default CreateListModal;
