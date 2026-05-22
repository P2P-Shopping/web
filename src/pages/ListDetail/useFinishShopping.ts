import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../context/useStore";
import {
    fetchActiveShoppingSessionRequest,
    finishShoppingRequest,
} from "../../services/api";

interface UseFinishShoppingParams {
    effectiveListId: string | undefined;
    setError: (error: string | null) => void;
}

export const useFinishShopping = ({
    effectiveListId,
    setError,
}: UseFinishShoppingParams) => {
    const navigate = useNavigate();
    const activeShoppingSession = useStore(
        (state) => state.activeShoppingSession,
    );
    const setActiveShoppingSession = useStore(
        (state) => state.setActiveShoppingSession,
    );
    const [isFinishing, setIsFinishing] = useState(false);
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [receiptImage, setReceiptImage] = useState<File | null>(null);

    const isFinishDisabled =
        isFinishing ||
        !effectiveListId ||
        effectiveListId === "default" ||
        !activeShoppingSession ||
        activeShoppingSession.listId !== effectiveListId;

    const syncActiveSession = useCallback(async () => {
        if (!effectiveListId || effectiveListId === "default") {
            setActiveShoppingSession(null);
            return;
        }
        try {
            const session =
                await fetchActiveShoppingSessionRequest(effectiveListId);
            setActiveShoppingSession(session);
        } catch {
            setActiveShoppingSession(null);
        }
    }, [effectiveListId, setActiveShoppingSession]);

    const handleFinishShopping = async () => {
        if (!effectiveListId || effectiveListId === "default") return;
        setIsFinishing(true);
        try {
            await finishShoppingRequest({
                receiptImage,
                listId: effectiveListId,
            });
            setShowFinishModal(false);
            setReceiptImage(null);
            setActiveShoppingSession(null);
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
        receiptImage,
        setReceiptImage,
        isFinishDisabled,
        handleFinishShopping,
        activeShoppingSession,
        syncActiveSession,
    };
};
