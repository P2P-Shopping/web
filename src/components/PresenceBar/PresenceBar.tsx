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
            <div className="flex items-center gap-2 animate-in fade-in duration-300">
                <div className="flex -space-x-2">
                    {usersArray.map((username) => (
                        <div
                            key={username}
                            className="w-8 h-8 rounded-full border-2 border-surface flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-1 ring-border/50"
                            style={{ backgroundColor: stringToColor(username) }}
                            title={username}
                        >
                            {username.charAt(0).toUpperCase()}
                        </div>
                    ))}
                </div>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">
                    {usersArray.length}{" "}
                    {usersArray.length === 1 ? "online" : "online"}
                </span>
            </div>
        );
    }

    if (variant === "typing") {
        if (typingArray.length === 0) return null;

        return (
            <div className="flex items-center gap-2 px-3 py-1 bg-accent-subtle/50 border border-accent-border/30 rounded-full w-fit animate-in slide-in-from-bottom-2 fade-in duration-300">
                <div className="flex gap-1">
                    <span className="w-1 h-1 bg-accent rounded-full animate-bounce" />
                    <span className="w-1 h-1 bg-accent rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1 h-1 bg-accent rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
                <span className="text-[11px] font-semibold text-accent italic">
                    {typingArray.length === 1
                        ? `${typingArray[0]} is typing...`
                        : "Multiple people typing..."}
                </span>
            </div>
        );
    }

    return null;
};

export default PresenceBar;
