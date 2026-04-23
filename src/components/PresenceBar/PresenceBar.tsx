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

/**
 * Component that renders the active users currently viewing a shopping list,
 * alongside dynamic "typing..." indicators.
 */
const PresenceBar: React.FC = () => {
    const activeUsers = usePresenceStore((state) => state.activeUsers);
    const typingUsers = usePresenceStore((state) => state.typingUsers);

    const usersArray = Array.from(activeUsers);

    if (usersArray.length === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-3 px-4 py-2 bg-surface/50 border border-border rounded-full backdrop-blur-sm shadow-sm w-fit animate-in slide-in-from-bottom-2 duration-300">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Online:
            </span>
            <div className="flex -space-x-2">
                {usersArray.map((username) => {
                    const isTyping = !!typingUsers[username];
                    const initial = username.charAt(0).toUpperCase();

                    return (
                        <div key={username} className="relative group">
                            <div
                                className="w-8 h-8 rounded-full border-2 border-surface flex items-center justify-center text-xs font-bold text-white transition-transform hover:scale-110 hover:z-10 shadow-sm"
                                style={{
                                    backgroundColor: stringToColor(username),
                                }}
                                title={username}
                            >
                                {initial}
                            </div>
                            {isTyping && (
                                <div
                                    className="absolute -bottom-1 -right-1 flex gap-0.5 px-1.5 py-0.5 bg-bg-muted border border-border rounded-full text-[10px] text-accent font-bold shadow-sm animate-bounce"
                                    title={`${username} is typing...`}
                                >
                                    <span className="sr-only" role="status">
                                        {username} is typing...
                                    </span>
                                    <span
                                        className="animate-[pulse_1s_infinite]"
                                        aria-hidden="true"
                                    >
                                        .
                                    </span>
                                    <span
                                        className="animate-[pulse_1s_infinite_200ms]"
                                        aria-hidden="true"
                                    >
                                        .
                                    </span>
                                    <span
                                        className="animate-[pulse_1s_infinite_400ms]"
                                        aria-hidden="true"
                                    >
                                        .
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PresenceBar;
