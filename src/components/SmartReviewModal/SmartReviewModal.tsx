import { useState, useEffect, useRef } from "react";
import { Modal } from "../"; 

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
  const prevIsOpen = useRef(false);

  // Only reset the state when the modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      setEditedItems(items);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen]);

  const updateItem = (index: number, field: keyof ReviewItem, value: string) => {
    setEditedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review AI results"
      subtitle="Verify items and brands before saving to your list."
      initialFocusSelector="input"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-text-strong bg-bg-muted rounded-xl hover:bg-border transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(editedItems)}
            className="px-5 py-2.5 text-sm font-bold text-white bg-text-strong rounded-xl hover:opacity-90 transition-opacity"
          >
            Confirm & Save
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {editedItems.map((item, index) => (
          <div
            key={item.id}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-bg-muted rounded-xl border border-border"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor={`item-${index}-name`} className="sr-only">Product Name</label>
              <input
                id={`item-${index}-name`}
                className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent outline-none"
                value={item.name}
                onChange={(e) => updateItem(index, "name", e.target.value)}
                placeholder="Product Name"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`item-${index}-brand`} className="sr-only">Brand</label>
              <input
                id={`item-${index}-brand`}
                className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent outline-none"
                value={item.brand || ""}
                onChange={(e) => updateItem(index, "brand", e.target.value)}
                placeholder="Brand"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`item-${index}-quantity`} className="sr-only">Quantity</label>
              <input
                id={`item-${index}-quantity`}
                className="px-3 py-2 bg-surface border border-border rounded-lg text-sm focus:border-accent outline-none"
                value={item.quantity || ""}
                onChange={(e) => updateItem(index, "quantity", e.target.value)}
                placeholder="Quantity"
              />
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default SmartReviewModal;