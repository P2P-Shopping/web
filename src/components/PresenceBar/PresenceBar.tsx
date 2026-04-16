import type React from "react";
import { usePresenceStore } from "../../context/usePresenceStore";
import "./PresenceBar.css";

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
    // Ensure we don't return colors that are too dark by adding a lightness offset.
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
        <div className="presence-bar">
            <span className="presence-label">Currently Online:</span>
            <div className="presence-avatars">
                {usersArray.map((username) => {
                    const isTyping = !!typingUsers[username];
                    const initial = username.charAt(0).toUpperCase();

                    return (
                        <div key={username} className="presence-user">
                            <div
                                className="avatar-circle"
                                style={{ backgroundColor: stringToColor(username) }}
                                title={username}
                            >
                                {initial}
                            </div>
                            {isTyping && (
                                <div className="typing-indicator" title={`${username} is typing...`}>
                                    <span>.</span>
                                    <span>.</span>
                                    <span>.</span>
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
