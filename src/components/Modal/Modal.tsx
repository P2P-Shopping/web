import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    children: ReactNode;
    footer?: ReactNode;
    maxWidth?: string;
    /** Selector for the element that should be focused when modal opens */
    initialFocusSelector?: string;
}

export default function Modal({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    footer,
    maxWidth = "440px",
    initialFocusSelector,
}: Readonly<ModalProps>) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const wasPreviouslyOpenRef = useRef(isOpen);
    const modalTitleId = useId();
    const modalSubtitleId = useId();

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const handleClick = (e: MouseEvent) => {
            if (e.target === dialog) {
                onClose();
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        dialog.addEventListener("click", handleClick);
        dialog.addEventListener("keydown", handleKeyDown);

        return () => {
            dialog.removeEventListener("click", handleClick);
            dialog.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (isOpen) {
            previousFocusRef.current = document.activeElement as HTMLElement;
            if (dialog && !dialog.open) {
                dialog.showModal();
            }

            if (initialFocusSelector) {
                const elementToFocus = dialog?.querySelector(
                    initialFocusSelector,
                ) as HTMLElement;
                elementToFocus?.focus();
            }
        } else if (wasPreviouslyOpenRef.current) {
            if (dialog?.open) {
                dialog.close();
            }
            if (
                previousFocusRef.current &&
                document.contains(previousFocusRef.current)
            ) {
                previousFocusRef.current.focus();
            } else {
                document.body.focus();
            }
        }

        wasPreviouslyOpenRef.current = isOpen;

        return () => {
            if (dialog?.open && !isOpen) {
                dialog.close();
            }
        };
    }, [isOpen, initialFocusSelector]);

    const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
        e.preventDefault();
        onClose();
    };

    return (
        <dialog
            ref={dialogRef}
            className="fixed inset-0 m-auto hidden open:flex items-center justify-center bg-transparent backdrop:bg-overlay backdrop:backdrop-blur-xs border-none p-0 outline-none open:animate-in open:fade-in duration-200"
            onCancel={handleCancel}
            aria-labelledby={title ? modalTitleId : undefined}
            aria-describedby={subtitle ? modalSubtitleId : undefined}
        >
            <div
                className="relative z-10 bg-surface border border-border rounded-xl shadow-xl flex flex-col w-full mx-4 animate-in zoom-in-95 fade-in duration-200"
                style={{
                    width: `min(${maxWidth}, calc(100vw - 2rem))`,
                    maxWidth,
                }}
            >
                <div className="flex items-start justify-between p-6 pb-2">
                    <div className="flex flex-col gap-1">
                        {title && (
                            <h2
                                id={modalTitleId}
                                className="text-xl font-bold text-text-strong tracking-tight"
                            >
                                {title}
                            </h2>
                        )}
                        {subtitle && (
                            <p
                                id={modalSubtitleId}
                                className="text-sm text-text-muted leading-relaxed"
                            >
                                {subtitle}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        className="flex items-center justify-center w-9 h-9 -mt-1 -mr-1 rounded-md text-text-muted transition-colors hover:bg-bg-muted hover:text-text-strong"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex-1 overflow-y-auto min-h-0">
                    {children}
                </div>

                {footer && (
                    <div className="flex items-center justify-end gap-3 p-6 bg-bg-subtle/50 rounded-b-xl border-t border-border/50">
                        {footer}
                    </div>
                )}
            </div>
        </dialog>
    );
}
