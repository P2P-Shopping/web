import { type ReactNode, useEffect, useRef } from "react";
import "./Modal.css";

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
                } catch (err) {
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
                } catch (err) {
                    // Ignore errors if already closed
                }
            }
            previousFocusRef.current?.focus();
        }

        return () => {
            if (dialog?.open) {
                try {
                    dialog.close();
                } catch (err) {
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
            className="modal-backdrop"
            onCancel={handleCancel}
            onClick={handleBackdropClick}
        >
            <div className="modal-content" style={{ maxWidth }}>
                {(title || onClose) && (
                    <div className="modal-header">
                        <div className="modal-title-group">
                            {title && <h2>{title}</h2>}
                            {subtitle && (
                                <p className="modal-subtitle">{subtitle}</p>
                            )}
                        </div>
                        <button
                            type="button"
                            className="modal-close-btn"
                            onClick={onClose}
                            aria-label="Close"
                        >
                            <svg
                                viewBox="0 0 24 24"
                                width="20"
                                height="20"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                            >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                )}

                <div className="modal-body">{children}</div>

                {footer && <div className="modal-footer">{footer}</div>}
            </div>
        </dialog>
    );
}
