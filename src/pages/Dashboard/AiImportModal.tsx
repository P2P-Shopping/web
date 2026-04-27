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
        setIsProcessing(true);
        
        // Simulare trimitere date (Dev 5 va intercepta JSON-ul rezultat)
        setTimeout(() => {
            console.log("Sending to AI:", { prompt, image });
            setIsProcessing(false);
            onClose();
        }, 2000);
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title="AI Shopping Assistant"
            subtitle="Describe a recipe or take a photo of your fridge. Our AI will help you generate a shopping list."
            footer={
                <div className="grid grid-cols-2 gap-3 w-full">
                    <button type="button" className="px-6 py-2.5 bg-bg-muted text-text-strong border border-border rounded-md text-sm font-semibold hover:bg-border" onClick={onClose} disabled={isProcessing}>
                        Cancel
                    </button>
                    <button type="submit" form="ai-assistant-form" className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-accent text-white border-none rounded-md text-sm font-bold hover:opacity-90 active:scale-95 disabled:opacity-50" disabled={(!prompt.trim() && !image) || isProcessing}>
                        {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                        {isProcessing ? "Analyzing..." : "Generate List"}
                    </button>
                </div>
            }
        >
            <form id="ai-assistant-form" onSubmit={handleImport} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <textarea
                        id="ai-input"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="What should I cook with the ingredients I have?"
                        rows={5}
                        className="w-full px-4 py-3 bg-bg-muted border border-border rounded-xl text-base text-text-strong outline-none focus:border-accent transition-all resize-none"
                    />
                </div>
                
                <div className="flex flex-col gap-2">
                    <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={(e) => setImage(e.target.files?.[0] || null)}
                    />
                    <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl transition-all ${image ? 'border-accent bg-accent-subtle text-accent' : 'border-border text-text-muted hover:border-accent'}`}
                    >
                        <ImageIcon size={20} />
                        {image ? `Image attached: ${image.name}` : "Attach image (Fridge or Ingredients)"}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default AiImportModal;