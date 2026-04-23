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
                        className="px-6 py-2.5 bg-bg-muted text-text-strong border border-border rounded-md text-sm font-semibold transition-all hover:bg-border disabled:opacity-50"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Anulează
                    </button>
                    <button
                        type="submit"
                        form="create-list-form"
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-text-strong text-bg border-none rounded-md text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!listName.trim() || isSubmitting}
                    >
                        {isSubmitting ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            "Crează Lista"
                        )}
                    </button>
                </>
            }
        >
            <form
                id="create-list-form"
                onSubmit={handleSubmit}
                className="flex flex-col gap-4"
            >
                <div className="flex flex-col gap-2">
                    <label
                        htmlFor="list-name"
                        className="text-[13px] font-semibold text-text-strong"
                    >
                        Numele listei
                    </label>
                    <input
                        id="list-name"
                        type="text"
                        value={listName}
                        onChange={(e) => setListName(e.target.value)}
                        placeholder="Dă un nume descriptiv"
                        maxLength={100}
                        className="w-full px-3.5 py-2.5 bg-bg-muted border-1.5 border-border rounded-md text-base text-text-strong transition-all focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)] outline-none"
                    />
                </div>
            </form>
        </Modal>
    );
};

export default CreateListModal;
