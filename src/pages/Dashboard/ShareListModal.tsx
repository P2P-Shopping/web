import { Send, UserPlus } from "lucide-react";
import { useState } from "react";
import { Modal } from "../../components";
import { useListsStore } from "../../store/useListsStore";

interface ShareListModalProps {
    listId: string;
    listName: string;
    onClose: () => void;
}

const ShareListModal = ({ listId, listName, onClose }: ShareListModalProps) => {
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const { shareList } = useListsStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = email.trim();
        if (!trimmedEmail) return;

        setIsSubmitting(true);
        setError("");
        try {
            const success = await shareList(listId, trimmedEmail);
            if (success) {
                onClose();
            } else {
                setError("Failed to share the list. User might not exist.");
            }
        } catch (error) {
            setError(
                error instanceof Error ? error.message : "An error occurred",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            icon={<UserPlus size={20} />}
            title="Share List"
            subtitle={`Invite others to "${listName}"`}
            initialFocusSelector="#share-email"
            footer={
                <div className="flex items-center justify-end gap-3 w-full">
                    <button
                        type="button"
                        className="px-4 py-2 text-sm font-medium text-text-strong border border-border rounded-md hover:bg-bg-muted"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="share-list-form"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent rounded-md hover:bg-accent-hover disabled:opacity-50"
                        disabled={!email.trim() || isSubmitting}
                    >
                        {isSubmitting ? (
                            "Sharing..."
                        ) : (
                            <>
                                <Send size={16} />
                                Share
                            </>
                        )}
                    </button>
                </div>
            }
        >
            <form
                id="share-list-form"
                onSubmit={handleSubmit}
                className="flex flex-col gap-4"
            >
                <p className="text-sm text-text-muted">
                    Enter the email address of the person you'd like to share
                    this list with.
                </p>
                <div className="flex flex-col gap-2">
                    <label
                        htmlFor="share-email"
                        className="text-sm font-medium text-text-strong"
                    >
                        Email
                    </label>
                    <input
                        id="share-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@example.com"
                        className={`w-full px-3 py-2 bg-bg-muted border rounded-md text-sm text-text-strong outline-none focus:border-accent ${
                            error ? "border-danger" : "border-border"
                        }`}
                        required
                    />
                    {error && <p className="text-xs text-danger">{error}</p>}
                </div>
            </form>
        </Modal>
    );
};

export default ShareListModal;
