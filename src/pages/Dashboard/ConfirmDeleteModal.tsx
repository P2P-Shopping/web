import { Modal } from "../../components";

interface ConfirmDeleteModalProps {
    listId: string;
    listName: string;
    onCancel: () => void;
    onConfirm: (listId: string) => void;
}

const ConfirmDeleteModal = ({
    listId,
    listName,
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
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center px-6 py-2.5 bg-danger text-white border-none rounded-md text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                        onClick={() => onConfirm(listId)}
                    >
                        Delete
                    </button>
                </div>
            }
        >
            <p className="m-0 text-text leading-relaxed">
                Are you sure you want to delete the list:{" "}
                <strong
                    className="text-text-strong font-bold block my-2 line-clamp-3 break-words"
                    title={listName}
                >
                    {listName}?
                </strong>{" "}
                This action cannot be undone.
            </p>
        </Modal>
    );
};

export default ConfirmDeleteModal;
