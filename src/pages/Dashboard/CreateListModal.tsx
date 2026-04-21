// ============================================
// CREATE LIST MODAL - Create new shopping list
// ============================================

import { useState, type FormEvent } from "react";
import { useListsStore } from "../../store/useListsStore";
import "./CreateListModal.css";

interface CreateListModalProps {
    onClose: () => void;
}

const CreateListModal = ({ onClose }: CreateListModalProps) => {
    const [listName, setListName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addList } = useListsStore();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        
        // Validate
        const trimmedName = listName.trim();
        if (!trimmedName) {
            return;
        }

        setIsSubmitting(true);

        try {
            await addList(trimmedName);
            onClose();
        } catch (error) {
            console.error("Failed to create list:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="modal-backdrop" onClick={handleBackdropClick}>
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Creare Listă Nouă</h2>
                    <button className="close-btn" onClick={onClose}>
                        <svg
                            viewBox="0 0 24 24"
                            width="24"
                            height="24"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <label htmlFor="list-name">
                            Numele listei
                        </label>
                        <input
                            id="list-name"
                            type="text"
                            value={listName}
                            onChange={(e) => setListName(e.target.value)}
                            placeholder="Ex: Cumpărături săptămâna asta"
                            autoFocus
                            maxLength={100}
                        />
                        <p className="helper-text">
                            Dă un nume descriptiv pentru lista ta
                        </p>
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
        </div>
    );
};

export default CreateListModal;