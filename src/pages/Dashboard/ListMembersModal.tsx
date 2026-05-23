import { Crown, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Modal } from "../../components";
import { useStore } from "../../context/useStore";
import { useListsStore } from "../../store/useListsStore";
import type { CollaboratorInfo, ListRole } from "../../types";

interface ListMembersModalProps {
    listId: string;
    listName: string;
    collaborators: CollaboratorInfo[];
    currentUserRole?: ListRole;
    onClose: () => void;
    onLeaveSuccess?: () => void;
}

const roleOrder: Record<ListRole, number> = {
    ADMIN: 0,
    EDITOR: 1,
    GUEST: 2,
};

const ListMembersModal = ({
    listId,
    collaborators,
    currentUserRole,
    onClose,
    onLeaveSuccess,
}: ListMembersModalProps) => {
    const [email, setEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<ListRole>("EDITOR");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [removingUserId, setRemovingUserId] = useState<number | null>(null);
    const {
        shareList,
        removeCollaborator,
        leaveList,
        lists,
        changeCollaboratorRole,
    } = useListsStore();
    const currentUser = useStore((state) => state.user);

    const list = lists.find((l) => l.id === listId);
    const ownerId = list?.ownerId;
    const isAdmin = currentUserRole === "ADMIN";

    const sortedCollaborators = [...collaborators].sort((a, b) => {
        if (a.userId === ownerId) return -1;
        if (b.userId === ownerId) return 1;
        return roleOrder[a.role] - roleOrder[b.role];
    });

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = email.trim();
        if (!trimmedEmail) return;

        setIsSubmitting(true);
        setError("");
        try {
            const success = await shareList(listId, trimmedEmail, inviteRole);
            if (success) {
                toast.success(`Invite sent`);
                setEmail("");
                setInviteRole("EDITOR");
            } else {
                setError("User might not exist or is already a member.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemove = async (collaborator: CollaboratorInfo) => {
        setRemovingUserId(collaborator.userId);
        try {
            await removeCollaborator(listId, collaborator.userId);
            toast.success("Removed");
        } catch {
            toast.error("Failed to remove");
        } finally {
            setRemovingUserId(null);
        }
    };

    const handleRoleChange = async (userId: number, newRole: ListRole) => {
        const targetCollaborator = collaborators.find(
            (c) => c.userId === userId,
        );
        const isSelf = targetCollaborator?.email === currentUser?.email;

        if (isSelf && newRole !== "ADMIN") {
            const otherAdmins = collaborators.filter(
                (c) =>
                    c.role === "ADMIN" &&
                    c.userId !== ownerId &&
                    c.userId !== userId,
            );
            if (otherAdmins.length < 1) {
                toast.error("Can't demote yourself — you're the only admin.");
                return;
            }
        }

        try {
            await changeCollaboratorRole(listId, userId, newRole);
        } catch {
            toast.error("Failed to update role");
        }
    };

    const handleLeave = async () => {
        const success = await leaveList(listId);
        if (success) {
            onClose();
            onLeaveSuccess?.();
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Members" maxWidth="420px">
            <div className="flex flex-col gap-4">
                {isAdmin && (
                    <form
                        onSubmit={handleInvite}
                        className="flex flex-col gap-2"
                    >
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setError("");
                            }}
                            placeholder="Invite by email..."
                            className={`w-full px-3 py-2 bg-bg-muted border rounded-lg text-sm text-text-strong outline-none focus:border-accent transition-colors ${
                                error ? "border-danger" : "border-border"
                            }`}
                        />
                        <div className="flex gap-2">
                            <select
                                value={inviteRole}
                                onChange={(e) =>
                                    setInviteRole(e.target.value as ListRole)
                                }
                                className="flex-1 px-2 py-2 bg-bg-muted border border-border rounded-lg text-xs font-medium text-text-strong outline-none focus:border-accent transition-colors cursor-pointer"
                            >
                                <option value="EDITOR">Editor</option>
                                <option value="GUEST">Guest</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                            <button
                                type="submit"
                                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-xs font-bold shrink-0 disabled:opacity-40 transition-all"
                                disabled={!email.trim() || isSubmitting}
                            >
                                <UserPlus size={14} />
                                Invite
                            </button>
                        </div>
                    </form>
                )}
                {error && <p className="text-xs text-danger -mt-2">{error}</p>}

                <div className="flex flex-col gap-1">
                    {sortedCollaborators.map((collaborator) => {
                        const isSelf =
                            currentUser?.email === collaborator.email;
                        const isOwner = collaborator.userId === ownerId;
                        const canManage =
                            isAdmin &&
                            !isOwner &&
                            (!isSelf || collaborator.role === "ADMIN");

                        return (
                            <div
                                key={collaborator.userId}
                                className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-muted transition-colors"
                            >
                                <div className="w-7 h-7 rounded-full bg-bg-muted border border-border flex items-center justify-center text-[11px] font-bold text-text-muted shrink-0">
                                    {isOwner ? (
                                        <Crown
                                            size={12}
                                            className="text-accent"
                                        />
                                    ) : (
                                        (collaborator.name || "U")
                                            .charAt(0)
                                            .toUpperCase()
                                    )}
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-sm font-medium text-text-strong truncate">
                                        {collaborator.name || "Unknown"}
                                        {isSelf && (
                                            <span className="text-text-muted font-normal">
                                                {" "}
                                                (You)
                                            </span>
                                        )}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                    {canManage ? (
                                        <select
                                            value={collaborator.role}
                                            onChange={(e) =>
                                                handleRoleChange(
                                                    collaborator.userId,
                                                    e.target.value as ListRole,
                                                )
                                            }
                                            className="px-1.5 py-0.5 bg-bg-subtle border border-border rounded text-[10px] font-bold text-text-muted uppercase outline-none focus:border-accent transition-colors"
                                        >
                                            <option value="ADMIN">Admin</option>
                                            <option value="EDITOR">
                                                Editor
                                            </option>
                                            <option value="GUEST">Guest</option>
                                        </select>
                                    ) : (
                                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wide">
                                            {collaborator.role}
                                        </span>
                                    )}

                                    {isAdmin && !isSelf && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRemove(collaborator)
                                            }
                                            disabled={
                                                removingUserId ===
                                                collaborator.userId
                                            }
                                            className="p-1 rounded text-text-muted opacity-0 group-hover:opacity-100 hover:text-danger transition-all disabled:opacity-50"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {currentUserRole !== "ADMIN" && (
                    <button
                        type="button"
                        className="w-full py-2 text-xs font-medium text-danger border border-danger/20 rounded-lg hover:bg-danger-subtle transition-colors"
                        onClick={handleLeave}
                    >
                        Leave list
                    </button>
                )}
            </div>
        </Modal>
    );
};

export default ListMembersModal;
