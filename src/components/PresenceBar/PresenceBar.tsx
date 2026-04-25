import type React from "react";
import { usePresenceStore } from "../../context/usePresenceStore";

/**
 * Deterministically generates a hex color from a username string to stylize avatars.
 * @param name The user's name
 * @returns A valid css hex color string
 */
const stringToColor = (name: string): string => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (name.codePointAt(i) || 0) + ((hash << 5) - hash);
    }
    let color = "#";
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xff;
        color += `00${value.toString(16)}`.slice(-2);
    }
    return color;
};

interface PresenceBarProps {
    variant?: "avatars" | "typing";
}

/**
 * Component that renders the active users currently viewing a shopping list,
 * or dynamic "typing..." indicators.
 */
const PresenceBar: React.FC<PresenceBarProps> = ({ variant = "avatars" }) => {
    const activeUsers = usePresenceStore((state) => state.activeUsers);
    const typingUsers = usePresenceStore((state) => state.typingUsers);

    const usersArray = Array.from(activeUsers);
    const typingArray = Object.keys(typingUsers);

    if (variant === "avatars") {
        if (usersArray.length === 0) return null;

        return (
            <div className="flex items-center gap-4 animate-in fade-in duration-300">
                <div className="flex -space-x-3">
                    {usersArray.map((username) => {
                        const isTyping = !!typingUsers[username];
                        return (
                            <div key={username} className="relative group">
                                <div
                                    className={`w-10 h-10 rounded-full border-2 border-surface flex items-center justify-center text-sm font-bold text-white shadow-md ring-1 ring-border/50 transition-all ${
                                        isTyping
                                            ? "ring-accent ring-offset-2 scale-110 z-10"
                                            : "hover:scale-105 hover:z-10"
                                    }`}
                                    style={{
                                        backgroundColor:
                                            stringToColor(username),
                                    }}
                                    title={
                                        isTyping
                                            ? `${username} is typing...`
                                            : username
                                    }
                                >
                                    {username.charAt(0).toUpperCase()}
                                </div>
                                {isTyping && (
                                    <div className="absolute -bottom-1 -right-1 flex gap-0.5 px-1.5 py-1 bg-accent text-white rounded-full text-[8px] shadow-lg animate-bounce border border-surface">
                                        <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                                        <span className="w-1 h-1 bg-white rounded-full animate-pulse [animation-delay:0.2s]" />
                                        <span className="w-1 h-1 bg-white rounded-full animate-pulse [animation-delay:0.4s]" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="w-px h-6 bg-border/60" aria-hidden="true" />
                <span className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider bg-bg-muted px-2 py-1 rounded-md">
                    {usersArray.length}{" "}
                    {usersArray.length === 1 ? "User" : "Users"}
                </span>
            </div>
        );
    }

    if (variant === "typing") {
        if (typingArray.length === 0) return null;

        return (
            <div className="flex items-center gap-1.5 px-1 py-0.5 animate-in slide-in-from-bottom-1 fade-in duration-200 h-5">
                <div className="flex gap-0.5 items-center" aria-hidden="true">
                    <span className="w-1 h-1 bg-accent rounded-full animate-bounce [animation-duration:0.8s]" />
                    <span className="w-1 h-1 bg-accent rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.15s]" />
                    <span className="w-1 h-1 bg-accent rounded-full animate-bounce [animation-duration:0.8s] [animation-delay:0.3s]" />
                </div>
                <span
                    className="text-[12px] font-bold text-text-muted tracking-tight leading-none"
                    role="status"
                    aria-live="polite"
                >
                    {typingArray.length === 1
                        ? `${typingArray[0]} is typing...`
                        : "Several people are typing..."}
                </span>
            </div>
        );
    }

    return null;
};

export default PresenceBar;
