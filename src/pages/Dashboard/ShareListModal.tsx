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
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const { shareList } = useListsStore();

    const submitButtonContent = (() => {
        if (isSubmitting) {
            return (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            );
        }

        if (status === "success") return "Shared!";

        return (
            <>
                <Send size={16} />
                Send Invite
            </>
        );
    })();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = email.trim();
        if (!trimmedEmail) return;

        setIsSubmitting(true);
        setStatus("idle");
        try {
            const success = await shareList(listId, trimmedEmail);
            if (success) {
                setStatus("success");
                setEmail("");
                setTimeout(() => {
                    onClose();
                }, 1500);
            } else {
                setStatus("error");
                setErrorMessage(
                    "Failed to share the list. User might not exist.",
                );
            }
        } catch (error) {
            setStatus("error");
            setErrorMessage(
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
            title="Share List"
            footer={
                <div className="grid grid-cols-2 gap-3 w-full">
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
                        form="share-list-form"
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-accent text-text-on-accent border-none rounded-md text-sm font-bold transition-all hover:bg-accent-hover active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_2px_10px_var(--color-accent-glow)]"
                        disabled={
                            !email.trim() ||
                            isSubmitting ||
                            status === "success"
                        }
                    >
                        {submitButtonContent}
                    </button>
                </div>
            }
        >
            <div className="flex flex-col gap-5">
                <div className="flex items-start gap-4 p-4 bg-bg-subtle border border-border rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center shrink-0">
                        <UserPlus className="text-accent" size={20} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-bold text-text-strong">
                            Share "{listName}"
                        </h3>
                        <p className="text-xs text-text-muted leading-relaxed">
                            Enter the email address of the person you'd like to
                            collaborate with. They'll be able to see and edit
                            items in real-time.
                        </p>
                    </div>
                </div>

                <form
                    id="share-list-form"
                    onSubmit={handleSubmit}
                    className="flex flex-col gap-4"
                >
                    <div className="flex flex-col gap-2">
                        <label
                            htmlFor="share-email"
                            className="text-[13px] font-semibold text-text-strong"
                        >
                            Collaborator Email
                        </label>
                        <input
                            id="share-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="collaborator@example.com"
                            className={`w-full px-3.5 py-2.5 bg-bg-muted border-1.5 rounded-md text-base text-text-strong transition-all outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)] ${
                                status === "error"
                                    ? "border-danger"
                                    : "border-border"
                            }`}
                            required
                        />
                        {status === "error" && (
                            <p className="text-xs font-medium text-danger">
                                {errorMessage}
                            </p>
                        )}
                        {status === "success" && (
                            <p className="text-xs font-medium text-success">
                                Invite sent successfully!
                            </p>
                        )}
                    </div>
                </form>
            </div>
        </Modal>
    );
};

export default ShareListModal;
