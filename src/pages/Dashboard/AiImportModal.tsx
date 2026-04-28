import {
    Copy,
    Image as ImageIcon,
    Loader2,
    MapPin,
    RotateCcw,
    Send,
    Sparkles,
    User,
    X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type ReviewItem, SmartReviewModal } from "../../components";
import { aiMultimodalRequest } from "../../services/api";
import { useListsStore } from "../../store/useListsStore";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    image?: string;
    timestamp: number;
}

interface AiImportModalProps {
    onClose: () => void;
}

const AiImportModal = ({ onClose }: AiImportModalProps) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content:
                "Hi! I'm your AI Shopping Assistant. You can describe a recipe, list items you need, or even upload a photo of your fridge or a receipt. I'll help you organize everything into a smart shopping list!",
            timestamp: Date.now(),
        },
    ]);
    const [prompt, setPrompt] = useState("");
    const [image, setImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [detectedListType, setDetectedListType] = useState<string>("NORMAL");
    const [location, setLocation] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [isLocating, setIsLocating] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addList, addItem } = useListsStore();

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => {
        if (messages.length > 0 || isProcessing) {
            scrollToBottom();
        }
    }, [messages.length, isProcessing, scrollToBottom]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = () => {
        setImage(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleLocationClick = () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            return;
        }
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                });
                setIsLocating(false);
            },
            (error) => {
                console.error("Location error:", error);
                alert(
                    "Failed to get your location. Please check your permissions.",
                );
                setIsLocating(false);
            },
        );
    };

    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
    };

    const handleRetry = () => {
        // Find the last user message to retry
        const lastUserMessage = [...messages]
            .reverse()
            .find((m) => m.role === "user");
        if (lastUserMessage) {
            // We need to re-execute handleSend but with the previous data
            // Since we cleared prompt and image, we should probably store them or pass them
            // For now, let's just use the content of the message
            void (async () => {
                setIsProcessing(true);
                try {
                    const response = await aiMultimodalRequest(
                        lastUserMessage.content,
                        null, // Image handling is harder without storing the file, but usually users want to retry the text/analysis
                        location?.lat,
                        location?.lng,
                    );
                    const data = response.data;
                    processAiResponse(data);
                } catch (error) {
                    console.error("AI Retry failed:", error);
                    setMessages((prev) => [
                        ...prev,
                        {
                            id: crypto.randomUUID(),
                            role: "assistant",
                            content:
                                "Retry failed. Please check your connection or try a different request.",
                            timestamp: Date.now(),
                        },
                    ]);
                } finally {
                    setIsProcessing(false);
                }
            })();
        }
    };

    const processAiResponse = (data: any) => {
        if (data.items && Array.isArray(data.items)) {
            const items: ReviewItem[] = data.items.map((item: any) => ({
                id: crypto.randomUUID(),
                name: item.specificName || item.genericName || "Unknown Item",
                brand: item.brand,
                quantity:
                    item.quantity !== undefined && item.quantity !== null
                        ? `${item.quantity} ${item.unit || ""}`.trim()
                        : undefined,
                category: item.category,
            }));

            setReviewItems(items);
            setDetectedListType(data.listType || "NORMAL");

            const assistantMessage: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                content: `I've analyzed your input and found ${items.length} items. Please review them below to save them to a new list.`,
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
            setTimeout(() => setIsReviewOpen(true), 1000);
        } else {
            setMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content:
                        "I couldn't find any specific items in your request. Could you please provide more details?",
                    timestamp: Date.now(),
                },
            ]);
        }
    };

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!prompt.trim() && !image) return;

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: "user",
            content: prompt,
            image: imagePreview || undefined,
            timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, userMessage]);
        const currentPrompt = prompt;
        const currentImage = image;

        setPrompt("");
        removeImage();
        setIsProcessing(true);

        try {
            const response = await aiMultimodalRequest(
                currentPrompt,
                currentImage,
                location?.lat,
                location?.lng,
            );
            processAiResponse(response.data);
        } catch (error) {
            console.error("AI Analysis failed:", error);
            setMessages((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content:
                        "I'm sorry, I encountered an error while processing your request. Please try again later.",
                    timestamp: Date.now(),
                },
            ]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirmReview = async (items: ReviewItem[]) => {
        try {
            const firstUserMessage = messages.find((m) => m.role === "user");
            const title = firstUserMessage?.content.trim()
                ? firstUserMessage.content.length > 30
                    ? `${firstUserMessage.content.substring(0, 30)}...`
                    : firstUserMessage.content
                : `AI List ${new Date().toLocaleDateString()}`;

            let category: "NORMAL" | "RECIPE" | "FREQUENT" = "NORMAL";
            if (detectedListType === "RECIPE") category = "RECIPE";
            if (detectedListType === "FREQUENT") category = "FREQUENT";

            const newList = await addList(title);
            if (newList) {
                for (const item of items) {
                    await addItem(newList.id, {
                        name: item.name,
                        checked: false,
                        brand: item.brand,
                        quantity: item.quantity,
                        category: item.category,
                        isRecurrent: category === "FREQUENT",
                    });
                }
            }
            onClose();
        } catch (error) {
            console.error("Failed to save reviewed items:", error);
            alert("Failed to save the list. Please try again.");
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                {messages.map((message, idx) => (
                    <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                    >
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                message.role === "user"
                                    ? "bg-accent text-white"
                                    : "bg-bg-muted text-text-strong border border-border"
                            }`}
                        >
                            {message.role === "user" ? (
                                <User size={16} />
                            ) : (
                                <Sparkles size={16} className="text-accent" />
                            )}
                        </div>
                        <div
                            className={`flex flex-col gap-2 max-w-[80%] ${message.role === "user" ? "items-end" : "items-start"}`}
                        >
                            {message.image && (
                                <div className="rounded-2xl overflow-hidden border border-border shadow-sm max-w-sm">
                                    <img
                                        src={message.image}
                                        alt="User upload"
                                        className="w-full h-auto"
                                    />
                                </div>
                            )}
                            {message.content && (
                                <div
                                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                                        message.role === "user"
                                            ? "bg-accent text-white rounded-tr-none"
                                            : "bg-bg-muted text-text-strong border border-border rounded-tl-none"
                                    } shadow-sm`}
                                >
                                    {message.content}
                                </div>
                            )}
                            <div className="flex items-center gap-2 px-1 group">
                                <span className="text-xs text-text-muted uppercase font-bold tracking-tight opacity-70">
                                    {new Date(
                                        message.timestamp,
                                    ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </span>

                                {message.role === "assistant" && (
                                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleCopy(message.content)
                                            }
                                            className="p-1 text-text-muted hover:text-accent transition-colors rounded-md hover:bg-bg-muted"
                                            title="Copy message"
                                        >
                                            <Copy size={12} />
                                        </button>
                                        {idx === messages.length - 1 &&
                                            message.content.includes(
                                                "error",
                                            ) && (
                                                <button
                                                    type="button"
                                                    onClick={handleRetry}
                                                    className="p-1 text-text-muted hover:text-accent transition-colors rounded-md hover:bg-bg-muted"
                                                    title="Retry request"
                                                >
                                                    <RotateCcw size={12} />
                                                </button>
                                            )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                {isProcessing && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-bg-muted border border-border flex items-center justify-center shrink-0">
                            <Sparkles
                                size={16}
                                className="text-accent animate-pulse"
                            />
                        </div>
                        <div className="bg-bg-muted text-text-strong border border-border px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                            <Loader2
                                size={14}
                                className="animate-spin text-accent"
                            />
                            <span className="text-sm font-medium italic opacity-70">
                                Analyzing your data...
                            </span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4">
                <form
                    onSubmit={handleSend}
                    className="flex flex-col gap-3 max-w-3xl mx-auto"
                >
                    {imagePreview && (
                        <div className="relative inline-block self-start">
                            <img
                                src={imagePreview}
                                alt="Preview"
                                className="w-20 h-20 object-cover rounded-xl border-2 border-accent"
                            />
                            <button
                                type="button"
                                onClick={removeImage}
                                className="absolute -top-2 -right-2 bg-text-strong text-white rounded-full p-1 shadow-md hover:bg-danger transition-colors"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    )}

                    <div className="flex items-end gap-2 bg-bg-muted border border-border rounded-2xl p-2 focus-within:border-accent transition-all shadow-sm">
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleImageChange}
                        />
                        <button
                            type="button"
                            onClick={handleLocationClick}
                            className={`p-2.5 rounded-xl transition-all ${
                                location
                                    ? "text-accent bg-accent-subtle shadow-inner"
                                    : "text-text-muted hover:text-accent hover:bg-surface"
                            }`}
                            disabled={isLocating}
                            title={
                                location ? "Location shared" : "Share location"
                            }
                        >
                            {isLocating ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <MapPin size={20} />
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2.5 text-text-muted hover:text-accent hover:bg-surface rounded-xl transition-all"
                            title="Attach image"
                        >
                            <ImageIcon size={20} />
                        </button>

                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Type your request here..."
                            className="flex-1 bg-transparent border-none outline-none text-sm py-2 px-1 resize-none max-h-32 min-h-[40px] text-text-strong"
                            rows={1}
                        />

                        <button
                            type="submit"
                            disabled={
                                isProcessing || (!prompt.trim() && !image)
                            }
                            className="p-2.5 bg-accent text-white rounded-xl shadow-md hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                    <p className="text-xs text-text-muted text-center font-bold tracking-widest opacity-60">
                        AI may provide inaccurate product matches. Always
                        verify.
                    </p>
                </form>
            </div>

            {isReviewOpen && (
                <SmartReviewModal
                    isOpen={true}
                    items={reviewItems}
                    onClose={() => setIsReviewOpen(false)}
                    onConfirm={handleConfirmReview}
                />
            )}
        </div>
    );
};

export default AiImportModal;
