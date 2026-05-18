import { Crown, Mail, Shield, UserPlus, Users, X } from "lucide-react";
import { useState } from "react";
import { Modal } from "../../components";
import { useListsStore } from "../../store/useListsStore";
import type { CollaboratorInfo } from "../../types";

interface ListMembersModalProps {
    listId: string;
    listName: string;
    collaborators: CollaboratorInfo[];
    currentUserRole?: "ADMIN" | "EDITOR";
    onClose: () => void;
    onLeaveSuccess?: () => void;
}

const ListMembersModal = ({
    listId,
    listName,
    collaborators,
    currentUserRole,
    onClose,
    onLeaveSuccess,
}: ListMembersModalProps) => {
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [removingUserId, setRemovingUserId] = useState<number | null>(null);
    const { shareList, removeCollaborator, leaveList } = useListsStore();

    const isAdmin = currentUserRole === "ADMIN";
    const owner = collaborators.find((c) => c.role === "ADMIN");
    const editors = collaborators.filter((c) => c.role !== "ADMIN");

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = email.trim();
        if (!trimmedEmail) return;

        setIsSubmitting(true);
        setError("");
        try {
            const success = await shareList(listId, trimmedEmail);
            if (success) {
                setEmail("");
            } else {
                setError(
                    "Failed to send invitation. User might not exist or is already a collaborator.",
                );
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemove = async (collaborator: CollaboratorInfo) => {
        if (
            !globalThis.confirm(
                `Remove ${collaborator.name || collaborator.email} from this list?`,
            )
        ) {
            return;
        }
        setRemovingUserId(collaborator.userId);
        try {
            await removeCollaborator(listId, collaborator.userId);
        } finally {
            setRemovingUserId(null);
        }
    };

    const handleLeave = async () => {
        if (
            !globalThis.confirm("Leave this list? You will lose access to it.")
        ) {
            return;
        }
        const success = await leaveList(listId);
        if (success) {
            onClose();
            onLeaveSuccess?.();
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            icon={<Users size={20} />}
            title={isAdmin ? "Manage Members" : "List Members"}
            subtitle={listName}
            maxWidth="480px"
            footer={
                <div className="flex items-center justify-between w-full">
                    {!isAdmin && (
                        <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-medium text-danger border border-danger/30 rounded-md hover:bg-danger-subtle transition-colors"
                            onClick={handleLeave}
                        >
                            Leave list
                        </button>
                    )}
                    <button
                        type="button"
                        className="px-4 py-2 text-sm font-medium text-text-strong border border-border rounded-md hover:bg-bg-muted ml-auto"
                        onClick={onClose}
                    >
                        Done
                    </button>
                </div>
            }
        >
            <div className="flex flex-col gap-5">
                {isAdmin && (
                    <form
                        onSubmit={handleInvite}
                        className="flex flex-col gap-2"
                    >
                        <label
                            htmlFor="invite-email"
                            className="text-xs font-bold text-text-muted uppercase tracking-wider"
                        >
                            Invite new member
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Mail
                                    size={14}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                                />
                                <input
                                    id="invite-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setError("");
                                    }}
                                    placeholder="email@example.com"
                                    className={`w-full pl-9 pr-3 py-2 bg-bg-muted border rounded-lg text-sm text-text-strong outline-none focus:border-accent transition-colors ${
                                        error
                                            ? "border-danger"
                                            : "border-border"
                                    }`}
                                />
                            </div>
                            <button
                                type="submit"
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-all shrink-0"
                                disabled={!email.trim() || isSubmitting}
                            >
                                <UserPlus size={14} />
                                {isSubmitting ? "..." : "Invite"}
                            </button>
                        </div>
                        {error && (
                            <p className="text-xs text-danger">{error}</p>
                        )}
                    </form>
                )}

                <div className="flex flex-col gap-1.5">
                    {owner && (
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-accent-subtle/40 border border-accent-border/20">
                            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                                <Crown size={14} className="text-accent" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-semibold text-text-strong truncate">
                                    {owner.name || "Unknown"}
                                </span>
                                <span className="text-xs text-text-muted truncate">
                                    {owner.email}
                                </span>
                            </div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/10 text-accent shrink-0">
                                <Shield size={9} />
                                Owner
                            </span>
                        </div>
                    )}

                    {editors.length > 0 && (
                        <div className="flex flex-col gap-1 mt-1">
                            <span className="text-xs font-bold text-text-muted uppercase tracking-wider px-1">
                                Editors ({editors.length})
                            </span>
                            {editors.map((collaborator) => (
                                <div
                                    key={collaborator.userId}
                                    className="group flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-muted border border-border hover:border-border-strong transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-full bg-bg-subtle border border-border flex items-center justify-center text-xs font-bold text-text-muted shrink-0">
                                        {(collaborator.name || "U")
                                            .charAt(0)
                                            .toUpperCase()}
                                    </div>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-sm font-medium text-text-strong truncate">
                                            {collaborator.name || "Unknown"}
                                        </span>
                                        <span className="text-xs text-text-muted truncate">
                                            {collaborator.email}
                                        </span>
                                    </div>
                                    {isAdmin && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRemove(collaborator)
                                            }
                                            disabled={
                                                removingUserId ===
                                                collaborator.userId
                                            }
                                            className="p-1.5 rounded-md text-text-muted opacity-0 group-hover:opacity-100 hover:text-danger hover:bg-danger-subtle transition-all disabled:opacity-50"
                                            title={`Remove ${collaborator.name}`}
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {editors.length === 0 && (
                        <div className="flex flex-col items-center gap-2 py-6 text-text-muted">
                            <Users size={24} className="opacity-40" />
                            <p className="text-sm">
                                {isAdmin
                                    ? "No editors yet. Invite someone above."
                                    : "No other members on this list."}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ListMembersModal;
