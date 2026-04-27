import { Loader2, Sparkles, Image as ImageIcon } from "lucide-react";
import { useState, useRef } from "react";
import { Modal } from "../../components";

interface AiImportModalProps {
    onClose: () => void;
}

const AiImportModal = ({ onClose }: AiImportModalProps) => {
    const [prompt, setPrompt] = useState("");
    const [image, setImage] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() && !image) return;

        setIsProcessing(true);
        
        // TODO(task4): wire up real multimodal AI endpoint (prompt + image upload)
        // Simulation for Task 4 UI flow
        setTimeout(() => {
            setIsProcessing(false);
            onClose();
        }, 2000);
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="AI Shopping Assistant"
            subtitle="Describe a recipe or take a photo of your ingredients. Our AI will help you generate a shopping list."
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
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-accent text-white border-none rounded-md text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
                        disabled={(!prompt.trim() && !image) || isProcessing}
                    >
                        {isProcessing ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Sparkles size={18} />
                        )}
                        {isProcessing ? "Analyzing..." : "Generate List"}
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
                        className="text-[13px] font-bold text-text-strong uppercase tracking-tight"
                    >
                        Describe what you need
                    </label>
                    <textarea
                        id="ai-input"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Example: I want to make pancakes for 4 people..."
                        rows={5}
                        className="w-full px-4 py-3 bg-bg-muted border border-border rounded-xl text-base text-text-strong outline-none focus:border-accent transition-all resize-none"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-bold text-text-strong uppercase tracking-tight">
                        Visual Context (Optional)
                    </label>
                    <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        ref={fileInputRef}
                        className="hidden" 
                        onChange={(e) => setImage(e.target.files?.[0] || null)}
                    />
                    <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-2xl transition-all ${
                            image 
                            ? "border-accent bg-accent-subtle text-accent" 
                            : "border-border text-text-muted hover:border-accent hover:bg-bg-muted"
                        }`}
                    >
                        <div className="p-3 bg-surface rounded-full shadow-sm">
                            <ImageIcon size={24} />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-bold">
                                {image ? image.name : "PHOTO OF FRIDGE / RECIPE"}
                            </span>
                            <span className="text-[10px] uppercase opacity-60 font-bold">
                                Click to use camera
                            </span>
                        </div>
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AiImportModal;