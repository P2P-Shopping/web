import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: ReactNode;
    subtitle?: string;
    icon?: ReactNode;
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
    icon,
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
            className="fixed inset-0 m-auto hidden open:flex items-end sm:items-center justify-center bg-transparent backdrop:bg-overlay backdrop:backdrop-blur-xs border-none p-3 pb-3 sm:p-6 outline-none open:animate-in open:fade-in duration-200"
            onCancel={handleCancel}
            aria-labelledby={title ? modalTitleId : undefined}
            aria-describedby={subtitle ? modalSubtitleId : undefined}
        >
            <div
                className="relative z-10 bg-surface border border-border rounded-2xl sm:rounded-xl shadow-xl flex flex-col w-full animate-in zoom-in-95 sm:fade-in duration-200 max-h-[85vh] sm:max-h-[calc(100vh-3rem)]"
                style={{
                    maxWidth,
                }}
            >
                <div className="flex items-start justify-between p-4 pb-2 sm:p-6 sm:pb-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {icon && (
                            <span className="text-accent shrink-0">{icon}</span>
                        )}
                        <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0">
                            {title && (
                                <h2
                                    id={modalTitleId}
                                    className="text-lg sm:text-xl font-bold text-text-strong tracking-tight truncate"
                                >
                                    {title}
                                </h2>
                            )}
                            {subtitle && (
                                <p
                                    id={modalSubtitleId}
                                    className="text-xs sm:text-sm text-text-muted leading-relaxed truncate"
                                >
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 -mt-1 -mr-1 rounded-md text-text-muted transition-colors hover:bg-bg-muted hover:text-text-strong"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 sm:p-6 flex-1 overflow-y-auto min-h-0">
                    {children}
                </div>

                {footer && (
                    <div className="flex items-center justify-end gap-2 sm:gap-3 p-4 sm:p-6 bg-bg-subtle/50 rounded-b-2xl sm:rounded-b-xl border-t border-border/50 pb-[max(1rem,env(safe-area-inset-bottom))]">
                        {footer}
                    </div>
                )}
            </div>
        </dialog>
    );
}
