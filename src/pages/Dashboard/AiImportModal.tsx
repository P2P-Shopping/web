import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Modal } from "../../components";
import { useListsStore } from "../../store/useListsStore";

interface AiImportModalProps {
    onClose: () => void;
}

const AiImportModal = ({ onClose }: AiImportModalProps) => {
    const [rawText, setRawText] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const { addList, addItem } = useListsStore();

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = rawText.trim();
        if (!text) return;

        setIsProcessing(true);
        try {
            const timestamp = new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            });
            const listName = `AI Import - ${timestamp}`;
            const newList = await addList(listName);

            if (!newList) {
                throw new Error("Failed to create list for import");
            }

            const items = text
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line.length > 0);

            const results = await Promise.all(
                items.map((itemName) =>
                    addItem(newList.id, {
                        name: itemName,
                        checked: false,
                    }),
                ),
            );

            const failures = results.filter((success) => !success).length;
            if (failures > 0) {
                console.warn(`${failures} items failed to import.`);
            }

            onClose();
        } catch (error) {
            console.error("AI Import failed:", error);
            // Optionally set a local error state here if the Modal supported it
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="AI Import"
            subtitle="Paste your shopping list here. We'll automatically extract the items and create a new list for you."
            initialFocusSelector="#ai-input"
            footer={
                <div className="grid grid-cols-2 gap-3 w-full">
                    <button
                        type="button"
                        className="px-6 py-2.5 bg-bg-muted text-text-strong border border-border rounded-md text-sm font-semibold transition-all hover:bg-border"
                        onClick={onClose}
                        disabled={isProcessing}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="ai-import-form"
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-accent text-text-on-accent border-none rounded-md text-sm font-bold transition-all hover:bg-accent-hover active:scale-95 disabled:opacity-50"
                        disabled={!rawText.trim() || isProcessing}
                    >
                        {isProcessing ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Sparkles size={18} />
                        )}
                        {isProcessing ? "Processing..." : "Import List"}
                    </button>
                </div>
            }
        >
            <form
                id="ai-import-form"
                onSubmit={handleImport}
                className="flex flex-col gap-4"
            >
                <div className="flex flex-col gap-2">
                    <label
                        htmlFor="ai-input"
                        className="text-[13px] font-semibold text-text-strong"
                    >
                        Paste items (one per line)
                    </label>
                    <textarea
                        id="ai-input"
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        placeholder="Example:
Milk
Eggs
Bread
Bananas"
                        rows={10}
                        className="w-full px-4 py-3 bg-bg-muted border border-border rounded-xl text-base text-text-strong outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)] transition-all resize-none"
                    />
                </div>
                <p className="text-xs text-text-muted italic">
                    Note: For now, we extract one item per line. Advanced AI
                    extraction coming soon!
                </p>
            </form>
        </Modal>
    );
};

export default AiImportModal;
