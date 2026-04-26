import { useState, useEffect } from "react";

export type ReviewItem = {
  id: string;
  name: string;
  checked: boolean;
  brand?: string;
  quantity?: string;
};

type SmartReviewModalProps = {
  isOpen: boolean;
  items: ReviewItem[];
  onClose: () => void;
  onConfirm: (items: ReviewItem[]) => void;
};

const SmartReviewModal = ({ isOpen, items, onClose, onConfirm }: SmartReviewModalProps) => {
  const [editedItems, setEditedItems] = useState<ReviewItem[]>(items);

  useEffect(() => {
    if (isOpen) {
      setEditedItems(items);
    }
  }, [isOpen, items]);

  if (!isOpen) return null;

  const updateItem = (index: number, field: keyof ReviewItem, value: string) => {
    setEditedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-surface rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto border border-border">
        <h2 className="text-xl font-bold text-text-strong mb-2">Review AI results</h2>
        <p className="text-sm text-text-muted mb-6">
          Verify items and brands before saving to your list.
        </p>

        <div className="space-y-4">
          {editedItems.map((item, index) => (
            <div
              key={item.id}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-bg-muted rounded-xl border border-border"
            >
              <input
                className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent outline-none"
                value={item.name}
                onChange={(e) => updateItem(index, "name", e.target.value)}
                placeholder="Product Name"
              />
              <input
                className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent outline-none"
                value={item.brand || ""}
                onChange={(e) => updateItem(index, "brand", e.target.value)}
                placeholder="Brand"
              />
              <input
                className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent outline-none"
                value={item.quantity || ""}
                onChange={(e) => updateItem(index, "quantity", e.target.value)}
                placeholder="Quantity"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-text-strong bg-bg-muted rounded-xl hover:bg-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(editedItems)}
            className="px-5 py-2.5 text-sm font-bold text-white bg-text-strong rounded-xl hover:opacity-90 transition-opacity"
          >
            Confirm & Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartReviewModal;