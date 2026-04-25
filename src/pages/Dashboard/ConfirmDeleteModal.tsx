import { Modal } from "../../components";

interface ConfirmDeleteModalProps {
    listId: string;
    listName: string;
    isDeleting: boolean;
    error: string | null;
    onCancel: () => void;
    onConfirm: (listId: string) => void;
}

const ConfirmDeleteModal = ({
    listId,
    listName,
    isDeleting,
    error,
    onCancel,
    onConfirm,
}: ConfirmDeleteModalProps) => {
    return (
        <Modal
            isOpen={true}
            onClose={onCancel}
            title="Confirm deletion"
            footer={
                <div className="grid grid-cols-2 gap-3 w-full">
                    <button
                        type="button"
                        className="px-6 py-2.5 bg-bg-muted text-text-strong border border-border rounded-md text-sm font-semibold transition-all hover:bg-border"
                        onClick={onCancel}
                        disabled={isDeleting}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center px-6 py-2.5 bg-danger text-white border-none rounded-md text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => onConfirm(listId)}
                        disabled={isDeleting}
                        aria-busy={isDeleting}
                    >
                        {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <p className="m-0 text-text leading-relaxed">
                    Are you sure you want to delete the list:{" "}
                    <strong
                        className="text-text-strong font-bold block my-2 line-clamp-3 wrap-break-word"
                        title={listName}
                    >
                        {listName}?
                    </strong>{" "}
                    This action cannot be undone.
                </p>

                {error && (
                    <div className="p-3 bg-danger-subtle border border-danger-border rounded-lg text-danger text-sm font-medium animate-in fade-in slide-in-from-top-1">
                        {error}
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ConfirmDeleteModal;
