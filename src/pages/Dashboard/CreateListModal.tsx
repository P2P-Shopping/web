import { type FormEvent, useState } from "react";
import { Modal } from "../../components";
import { useListsStore } from "../../store/useListsStore";

interface CreateListModalProps {
    onClose: () => void;
}

const CreateListModal = ({ onClose }: CreateListModalProps) => {
    const [listName, setListName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addList } = useListsStore();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const trimmedName = listName.trim();
        if (!trimmedName) return;

        setIsSubmitting(true);
        try {
            const success = await addList(trimmedName);
            if (success) {
                onClose();
            }
        } catch (error) {
            console.error("Failed to create list:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="Creare Listă Nouă"
            initialFocusSelector="#list-name"
            footer={
                <>
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
                        form="create-list-form"
                        className="submit-btn"
                        disabled={!listName.trim() || isSubmitting}
                    >
                        {isSubmitting ? (
                            <span className="loading-spinner" />
                        ) : (
                            "Crează Lista"
                        )}
                    </button>
                </>
            }
        >
            <form id="create-list-form" onSubmit={handleSubmit}>
                <div className="modal-form-body">
                    <label htmlFor="list-name" className="modal-label">
                        Numele listei
                    </label>
                    <input
                        id="list-name"
                        type="text"
                        value={listName}
                        onChange={(e) => setListName(e.target.value)}
                        placeholder="Dă un nume descriptiv"
                        maxLength={100}
                    />
                </div>
            </form>
        </Modal>
    );
};

export default CreateListModal;
