import { Check, Mail, X } from "lucide-react";
import { toast } from "sonner";
import { useListsStore } from "../../store/useListsStore";
import type { PendingInvitation } from "../../types";

interface PendingInviteCardProps {
    invitation: PendingInvitation;
}

const PendingInviteCard: React.FC<PendingInviteCardProps> = ({
    invitation,
}) => {
    const { acceptInvitation, declineInvitation } = useListsStore();

    const handleAccept = async () => {
        const success = await acceptInvitation(invitation.id);
        if (success) {
            toast.success(`Joined "${invitation.listTitle}"`);
        }
    };

    const handleDecline = async () => {
        const success = await declineInvitation(invitation.id);
        if (success) {
            toast.success(`Invitation for "${invitation.listTitle}" declined`);
        }
    };

    return (
        <div className="relative backdrop-blur-xl bg-surface/80 border border-border rounded-xl p-5 shadow-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
            <div className="relative flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/10">
                        <Mail size={20} className="text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-strong truncate">
                            {invitation.inviterName}
                        </p>
                        <p className="text-xs text-text-muted">
                            invited you to collaborate
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-bg-muted rounded-lg">
                    <span className="text-xs text-text-muted">List:</span>
                    <span className="text-sm font-medium text-text-strong truncate">
                        {invitation.listTitle}
                    </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <button
                        type="button"
                        onClick={handleAccept}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-accent rounded-lg transition-all duration-200 hover:bg-accent-hover hover:-translate-y-px active:translate-y-0 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
                    >
                        <Check size={16} />
                        Accept
                    </button>
                    <button
                        type="button"
                        onClick={handleDecline}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-text-strong border border-border rounded-lg transition-all duration-200 hover:bg-bg-muted hover:-translate-y-px active:translate-y-0 focus-visible:outline-2 focus-visible:outline-border focus-visible:outline-offset-2"
                    >
                        <X size={16} />
                        Decline
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PendingInviteCard;
