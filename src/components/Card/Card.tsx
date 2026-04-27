import type React from "react";

interface CardProps {
    title?: string;
    children: React.ReactNode;
}

export default function Card({ title, children }: CardProps) {
    return (
        <div className="bg-surface border border-border rounded-xl p-6 shadow-sm flex flex-col gap-4">
            {title && (
                <h2 className="text-lg font-bold text-text-strong tracking-tight">
                    {title}
                </h2>
            )}

            <div className="flex flex-col gap-2">{children}</div>
        </div>
    );
}
