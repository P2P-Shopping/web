import { type ReactNode, useEffect, useRef } from "react";

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
}: ModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (isOpen) {
            previousFocusRef.current = document.activeElement as HTMLElement;
            if (dialog && !dialog.open) {
                try {
                    dialog.showModal();
                } catch (_err) {
                    // Ignore errors if already open
                }
            }

            if (initialFocusSelector) {
                const elementToFocus = dialog?.querySelector(
                    initialFocusSelector,
                ) as HTMLElement;
                elementToFocus?.focus();
            }
        } else {
            if (dialog?.open) {
                try {
                    dialog.close();
                } catch (_err) {
                    // Ignore errors if already closed
                }
            }
            previousFocusRef.current?.focus();
        }

        return () => {
            if (dialog?.open) {
                try {
                    dialog.close();
                } catch (_err) {
                    // ignore
                }
            }
        };
    }, [isOpen, initialFocusSelector]);

    const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleCancel = (e: React.SyntheticEvent<HTMLDialogElement>) => {
        e.preventDefault();
        onClose();
    };

    return (
        <dialog
            ref={dialogRef}
            className="fixed inset-0 m-auto flex items-center justify-center bg-transparent backdrop:bg-overlay backdrop:backdrop-blur-[4px] border-none p-0 outline-none open:animate-in open:fade-in duration-200"
            onCancel={handleCancel}
            onClick={handleBackdropClick}
            onKeyDown={(e) => {
                if (e.key === "Escape") {
                    onClose();
                }
            }}
        >
            <div
                className="bg-surface border border-border rounded-xl shadow-xl flex flex-col w-full mx-4 animate-in zoom-in-95 fade-in duration-200"
                style={{ maxWidth }}
            >
                {(title || onClose) && (
                    <div className="flex items-start justify-between p-6 pb-2">
                        <div className="flex flex-col gap-1">
                            {title && (
                                <h2 className="text-xl font-bold text-text-strong tracking-tight">
                                    {title}
                                </h2>
                            )}
                            {subtitle && (
                                <p className="text-sm text-text-muted leading-relaxed">
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
                            <svg
                                viewBox="0 0 24 24"
                                width="20"
                                height="20"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                fill="none"
                                role="img"
                                aria-labelledby="close-modal-title"
                            >
                                <title id="close-modal-title">Închide</title>
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                <div className="p-6 flex-1 overflow-y-auto min-h-0">
                    {children}
                </div>

                {footer && (
                    <div className="flex items-center justify-end gap-3 p-6 pt-2 bg-bg-subtle/50 rounded-b-xl border-t border-border/50">
                        {footer}
                    </div>
                )}
            </div>
        </dialog>
    );
}
