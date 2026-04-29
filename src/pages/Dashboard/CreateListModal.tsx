import { ChevronDown } from "lucide-react";
import { type SubmitEvent, useId, useState } from "react";
import { Modal } from "../../components";
import { useListsStore } from "../../store/useListsStore";

interface CreateListModalProps {
    onClose: () => void;
}

type ListCategory = "NORMAL" | "RECIPE" | "FREQUENT";

const LIST_CATEGORY_OPTIONS: Array<{
    value: ListCategory;
    title: string;
    description: string;
}> = [
    {
        value: "NORMAL",
        title: "Normal list",
        description: "A standard shopping list.",
    },
    {
        value: "RECIPE",
        title: "Recipe list",
        description: "Built around ingredients for a recipe.",
    },
    {
        value: "FREQUENT",
        title: "Frequent list",
        description: "Items you buy again and again.",
    },
];

const CreateListModal = ({ onClose }: CreateListModalProps) => {
    const [listName, setListName] = useState("");
    const [listCategory, setListCategory] = useState<ListCategory>("NORMAL");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addList } = useListsStore();
    const categoryButtonId = useId();
    const categoryListId = useId();

    const handleClose = () => {
        if (isSubmitting) return;
        onClose();
    };

    const handleSubmit = async (e: SubmitEvent) => {
        e.preventDefault();
        const trimmedName = listName.trim();
        if (!trimmedName) return;

        setIsSubmitting(true);
        try {
            const newList = await addList(trimmedName, listCategory);
            if (newList) {
                onClose();
            }
        } catch (error) {
            console.error("Failed to create list:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={true}
            onClose={handleClose}
            title="Create New List"
            subtitle="Choose a list type and give it a name."
            initialFocusSelector="#list-name"
            maxWidth="760px"
            footer={
                <div className="grid grid-cols-2 gap-3 w-full">
                    <button
                        type="button"
                        className="px-6 py-2.5 bg-bg-muted text-text-strong border border-border rounded-md text-sm font-semibold transition-all hover:bg-border disabled:opacity-50"
                        onClick={handleClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="create-list-form"
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-text-strong text-bg border-none rounded-md text-sm font-bold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!listName.trim() || isSubmitting}
                        aria-busy={isSubmitting}
                        aria-label={
                            isSubmitting ? "Creating list..." : undefined
                        }
                    >
                        {isSubmitting ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            "Create List"
                        )}
                    </button>
                </div>
            }
        >
            <form
                id="create-list-form"
                onSubmit={handleSubmit}
                className="flex flex-col gap-4"
            >
                <div className="flex flex-col gap-2">
                    <label
                        htmlFor="list-name"
                        className="text-[13px] font-semibold text-text-strong"
                    >
                        List name
                    </label>
                    <input
                        id="list-name"
                        type="text"
                        value={listName}
                        onChange={(e) => setListName(e.target.value)}
                        placeholder="Give it a descriptive name"
                        maxLength={100}
                        className="w-full px-3.5 py-2.5 bg-bg-muted border-1.5 border-border rounded-md text-base text-text-strong transition-all focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)] outline-none"
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-[13px] font-semibold text-text-strong">
                        List type
                    </span>
                    <div className="relative">
                        <select
                            id={categoryListId}
                            value={listCategory}
                            onChange={(e) =>
                                setListCategory(e.target.value as ListCategory)
                            }
                            className="w-full appearance-none rounded-2xl border border-border bg-bg-muted px-4 py-3 text-[15px] font-semibold text-text-strong outline-none transition-all hover:border-border-strong focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)]"
                            aria-labelledby={categoryButtonId}
                        >
                            {LIST_CATEGORY_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.title} - {option.description}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-text-muted">
                            <ChevronDown size={18} />
                        </div>
                    </div>
                </div>
            </form>
        </Modal>
    );
};

export default CreateListModal;
