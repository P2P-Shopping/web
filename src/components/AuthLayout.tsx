import type React from "react";
import { AuthTabs, BackButton, Logo } from "./index"; // Ajustează importul dacă nu ai un fișier index public

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle: string;
    activeTab: "login" | "register";
    maxWidthClass?: string;
}

export const AuthLayout = ({
    children,
    title,
    subtitle,
    activeTab,
    maxWidthClass = "max-w-[400px]",
}: AuthLayoutProps) => {
    return (
        <div className={`my-auto flex flex-col w-full ${maxWidthClass} bg-surface border border-border rounded-2xl p-8 shadow-xl animate-in fade-in zoom-in-95 duration-500`}>
            <BackButton />
            <div className="flex items-center justify-center gap-3 mb-8">
                <Logo className="h-12 w-auto" alt="uCart" />
            </div>

            <h1 className="text-2xl font-bold text-text-strong tracking-tight mb-1">
                {title}
            </h1>
            <p className="text-[15px] text-text-muted mb-8">
                {subtitle}
            </p>

            <AuthTabs activeTab={activeTab} />

            {children}
        </div>
    );
};