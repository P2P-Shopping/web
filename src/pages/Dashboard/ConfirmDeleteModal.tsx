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
                        className="cancel-btn"
                        onClick={onCancel}
                    >
                        Renunță
                    </button>
                    <button
                        type="button"
                        className="submit-btn danger"
                        onClick={() => onConfirm(listId)}
                    >
                        Șterge
                    </button>
                </>
            }
        >
            <p style={{ margin: 0 }}>
                Ștergi lista <strong>{listName}</strong>? Această acțiune nu
                poate fi anulată.
            </p>
        </Modal>
    );
};

export default ConfirmDeleteModal;
