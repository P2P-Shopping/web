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
            title="Confirmă ștergerea"
            footer={
                <>
                    <button
                        type="button"
                        className="px-6 py-2.5 bg-bg-muted text-text-strong border border-border rounded-md text-sm font-semibold transition-all hover:bg-border"
                        onClick={onCancel}
                    >
                        Renunță
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center px-6 py-2.5 bg-danger text-white border-none rounded-md text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                        onClick={() => onConfirm(listId)}
                    >
                        Șterge
                    </button>
                </>
            }
        >
            <p className="m-0 text-text leading-relaxed">
                Ștergi lista{" "}
                <strong className="text-text-strong font-bold">
                    {listName}
                </strong>
                ? Această acțiune nu poate fi anulată.
            </p>
        </Modal>
    );
};

export default ConfirmDeleteModal;
