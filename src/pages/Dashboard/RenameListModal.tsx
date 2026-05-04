import { Edit } from "lucide-react";
import { type SubmitEvent, useState } from "react";
import { Modal } from "../../components";
import { useListsStore } from "../../store/useListsStore";

interface RenameListModalProps {
    listId: string;
    currentName: string;
    onClose: () => void;
}

const RenameListModal = ({
    listId,
    currentName,
    onClose,
}: RenameListModalProps) => {
    const [newName, setNewName] = useState(currentName);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const { renameList } = useListsStore();

    const handleSubmit = async (e: SubmitEvent) => {
        e.preventDefault();
        const trimmedName = newName.trim();
        if (!trimmedName || trimmedName === currentName) {
            onClose();
            return;
        }

        setIsSubmitting(true);
        setError("");
        try {
            const success = await renameList(listId, trimmedName);
            if (success) {
                onClose();
            } else {
                setError("Failed to rename the list. Please try again.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            icon={<Edit size={20} />}
            title="Rename List"
            subtitle={`Change the name from "${currentName}"`}
            initialFocusSelector="#rename-input"
            footer={
                <div className="flex items-center justify-end gap-3 w-full">
                    <button
                        type="button"
                        className="px-6 py-2.5 bg-bg-muted text-text-strong border border-border rounded-md text-sm font-semibold transition-all hover:bg-border disabled:opacity-50"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="rename-list-form"
                        className="px-6 py-2.5 bg-text-strong text-bg border-none rounded-md text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={
                            !newName.trim() ||
                            newName.trim() === currentName ||
                            isSubmitting
                        }
                        aria-busy={isSubmitting}
                    >
                        {isSubmitting ? "Renaming..." : "Rename"}
                    </button>
                </div>
            }
        >
            <form id="rename-list-form" onSubmit={handleSubmit}>
                <div className="flex flex-col gap-2">
                    <label
                        htmlFor="rename-input"
                        className="text-[13px] font-semibold text-text-strong"
                    >
                        New name
                    </label>
                    <input
                        id="rename-input"
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Enter new list name"
                        maxLength={100}
                        className="w-full px-3.5 py-2.5 bg-bg-muted border-1.5 border-border rounded-md text-base text-text-strong transition-all focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)] outline-none"
                        autoFocus
                    />
                </div>

                {error && (
                    <div className="mt-3 p-3 bg-danger-subtle text-danger text-sm rounded-md border border-danger-border">
                        {error}
                    </div>
                )}
            </form>
        </Modal>
    );
};

export default RenameListModal;
