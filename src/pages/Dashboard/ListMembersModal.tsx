import { Crown, Mail, Shield, UserPlus, Users, X } from "lucide-react";
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

const ListMembersModal = ({
    listId,
    listName,
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

    // Separate original owner and other roles
    const owner = collaborators.find((c) => c.userId === ownerId);
    const otherAdmins = collaborators.filter(
        (c) => c.role === "ADMIN" && c.userId !== ownerId,
    );
    const editors = collaborators.filter(
        (c) => c.role === "EDITOR" && c.userId !== ownerId,
    );
    const guests = collaborators.filter(
        (c) => c.role === "GUEST" && c.userId !== ownerId,
    );

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedEmail = email.trim();
        if (!trimmedEmail) return;

        setIsSubmitting(true);
        setError("");
        try {
            const success = await shareList(listId, trimmedEmail, inviteRole);
            if (success) {
                toast.success(`Invite (${inviteRole}) sent to ${trimmedEmail}`);
                setEmail("");
                setInviteRole("EDITOR");
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
            toast.success(
                `${collaborator.name || "Member"} removed successfully`,
            );
        } catch (_err) {
            toast.error("Failed to remove member");
        } finally {
            setRemovingUserId(null);
        }
    };

    const handleRoleChange = async (userId: number, newRole: ListRole) => {
        const targetCollaborator = collaborators.find(
            (c) => c.userId === userId,
        );
        const isSelf =
            targetCollaborator &&
            currentUser &&
            targetCollaborator.email === currentUser.email;

        if (isSelf && newRole !== "ADMIN") {
            if (otherAdmins.length <= 1) {
                toast.error(
                    "You cannot change your own role because you are the only admin collaborator on this list.",
                );
                return;
            }
        }

        try {
            await changeCollaboratorRole(listId, userId, newRole);
            toast.success("Role updated successfully");
        } catch (_err) {
            toast.error("Failed to update role");
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

    const renderCollaboratorRow = (collaborator: CollaboratorInfo) => {
        const isSelf = currentUser && currentUser.email === collaborator.email;
        const canManage =
            isAdmin &&
            collaborator.userId !== ownerId &&
            (!isSelf || collaborator.role === "ADMIN");

        return (
            <div
                key={collaborator.userId}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg-muted border border-border hover:border-border-strong transition-all"
            >
                <div className="w-8 h-8 rounded-full bg-bg-subtle border border-border flex items-center justify-center text-xs font-bold text-text-muted shrink-0">
                    {(collaborator.name || "U").charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium text-text-strong truncate">
                        {collaborator.name || "Unknown"} {isSelf && "(You)"}
                    </span>
                    <span className="text-xs text-text-muted truncate">
                        {collaborator.email}
                    </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {canManage ? (
                        <select
                            value={collaborator.role}
                            onChange={(e) =>
                                handleRoleChange(
                                    collaborator.userId,
                                    e.target.value as ListRole,
                                )
                            }
                            className="px-2 py-1 bg-bg-subtle border border-border rounded-md text-xs font-medium text-text outline-none focus:border-accent transition-colors"
                        >
                            <option value="ADMIN">Admin</option>
                            <option value="EDITOR">Editor</option>
                            <option value="GUEST">Guest</option>
                        </select>
                    ) : (
                        <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                collaborator.role === "ADMIN"
                                    ? "bg-accent/10 text-accent"
                                    : collaborator.role === "EDITOR"
                                      ? "bg-primary/10 text-primary"
                                      : "bg-text-muted/10 text-text-muted"
                            }`}
                        >
                            {collaborator.role}
                        </span>
                    )}

                    {isAdmin && !isSelf && (
                        <button
                            type="button"
                            onClick={() => handleRemove(collaborator)}
                            disabled={removingUserId === collaborator.userId}
                            className="p-1.5 rounded-md text-text-muted opacity-0 group-hover:opacity-100 hover:text-danger hover:bg-danger-subtle transition-all disabled:opacity-50"
                            title={`Remove ${collaborator.name}`}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>
        );
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
                    {currentUserRole !== "ADMIN" && ownerId && (
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

                            <select
                                value={inviteRole}
                                onChange={(e) =>
                                    setInviteRole(e.target.value as ListRole)
                                }
                                className="px-2.5 py-2 bg-bg-muted border border-border rounded-lg text-sm text-text-strong outline-none focus:border-accent transition-colors cursor-pointer shrink-0"
                            >
                                <option value="EDITOR">Editor</option>
                                <option value="GUEST">Guest</option>
                                <option value="ADMIN">Admin</option>
                            </select>

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

                <div className="flex flex-col gap-3">
                    {/* Owner section */}
                    {owner && (
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-text-muted uppercase tracking-wider px-1">
                                Creator / Owner
                            </span>
                            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-accent-subtle/40 border border-accent-border/20">
                                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                                    <Crown size={14} className="text-accent" />
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-sm font-semibold text-text-strong truncate">
                                        {owner.name || "Unknown"}{" "}
                                        {currentUser &&
                                            currentUser.email === owner.email &&
                                            "(You)"}
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
                        </div>
                    )}

                    {/* Co-Admins section */}
                    {otherAdmins.length > 0 && (
                        <div className="flex flex-col gap-1.5 mt-1">
                            <span className="text-xs font-bold text-text-muted uppercase tracking-wider px-1">
                                Admins ({otherAdmins.length})
                            </span>
                            {otherAdmins.map(renderCollaboratorRow)}
                        </div>
                    )}

                    {/* Editors section */}
                    {editors.length > 0 && (
                        <div className="flex flex-col gap-1.5 mt-1">
                            <span className="text-xs font-bold text-text-muted uppercase tracking-wider px-1">
                                Editors ({editors.length})
                            </span>
                            {editors.map(renderCollaboratorRow)}
                        </div>
                    )}

                    {/* Guests section */}
                    {guests.length > 0 && (
                        <div className="flex flex-col gap-1.5 mt-1">
                            <span className="text-xs font-bold text-text-muted uppercase tracking-wider px-1">
                                Guests ({guests.length})
                            </span>
                            {guests.map(renderCollaboratorRow)}
                        </div>
                    )}

                    {/* Empty states */}
                    {collaborators.length <= 1 && (
                        <div className="flex flex-col items-center gap-2 py-6 text-text-muted">
                            <Users size={24} className="opacity-40" />
                            <p className="text-sm">
                                {isAdmin
                                    ? "No other members yet. Invite someone above."
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
