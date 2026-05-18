import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { finishShoppingRequest } from "../../services/api";

interface UseFinishShoppingParams {
    effectiveListId: string | undefined;
    setError: (error: string | null) => void;
}

export const useFinishShopping = ({
    effectiveListId,
    setError,
}: UseFinishShoppingParams) => {
    const navigate = useNavigate();
    const [isFinishing, setIsFinishing] = useState(false);
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [finishStoreName, setFinishStoreName] = useState("");
    const [receiptImage, setReceiptImage] = useState<File | null>(null);

    const isFinishDisabled =
        !finishStoreName.trim() ||
        isFinishing ||
        !effectiveListId ||
        effectiveListId === "default";

    const handleFinishShopping = async () => {
        if (!effectiveListId || effectiveListId === "default") return;
        setIsFinishing(true);
        try {
            await finishShoppingRequest({
                storeName: finishStoreName.trim(),
                receiptImage,
                listId: effectiveListId,
            });
            setShowFinishModal(false);
            setFinishStoreName("");
            setReceiptImage(null);
            navigate("/dashboard");
        } catch (_err) {
            const errorMessage =
                _err instanceof Error
                    ? _err.message
                    : "Failed to complete shopping.";
            console.error("Failed to complete shopping:", _err);
            setError(errorMessage);
        } finally {
            setIsFinishing(false);
        }
    };

    return {
        isFinishing,
        showFinishModal,
        setShowFinishModal,
        finishStoreName,
        setFinishStoreName,
        receiptImage,
        setReceiptImage,
        isFinishDisabled,
        handleFinishShopping,
    };
};
