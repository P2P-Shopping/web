import type React from "react";
import { usePresenceStore } from "../../context/usePresenceStore";
import { useStore } from "../../context/useStore";
import { stringToColor } from "../../utils/colorUtils";

const normalizeUsername = (name: string): string => name.trim().toLowerCase();

const toDisplayName = (username: string): string => {
    const atIndex = username.indexOf("@");
    return atIndex > 0 ? username.substring(0, atIndex) : username;
};

const getAvatarTitle = (
    displayName: string,
    isActive: boolean,
    isTyping: boolean,
): string => {
    if (isTyping) return `${displayName} is typing...`;
    if (isActive) return `${displayName} (Active)`;
    return `${displayName} (Offline)`;
};

const getAvatarClassName = (isActive: boolean, isTyping: boolean): string => {
    const interactionClass = isTyping
        ? "ring-accent ring-offset-2 scale-110 z-10"
        : "hover:scale-105 hover:z-10";
    const presenceClass = isActive
        ? "ring-2 ring-success ring-offset-1"
        : "grayscale opacity-40 brightness-75";

    return `w-10 h-10 rounded-full border-2 border-surface flex items-center justify-center text-sm font-bold text-white shadow-md ring-1 ring-border/50 transition-all ${interactionClass} ${presenceClass}`;
};

interface PresenceBarProps {
    variant?: "avatars" | "typing";
    allUsers?: string[];
}

const PresenceBar: React.FC<PresenceBarProps> = ({
    variant = "avatars",
    allUsers = [],
}) => {
    const activeUsers = usePresenceStore((state) => state.activeUsers);
    const typingUsers = usePresenceStore((state) => state.typingUsers);
    const displayNames = usePresenceStore((state) => state.displayNames);
    const currentUserEmail = useStore((state) => state.user?.email ?? null);

    const activeArray = Array.from(activeUsers);
    const typingArray = Object.keys(typingUsers);
    const activeUsernames = new Set(activeArray.map(normalizeUsername));
    const typingUsernames = new Set(typingArray.map(normalizeUsername));

    const resolveDisplayName = (email: string): string => {
        const clean = normalizeUsername(email);
        if (displayNames[clean]) return displayNames[clean];
        if (displayNames[email]) return displayNames[email];
        return toDisplayName(email);
    };

    if (variant === "avatars") {
        const currentEmailClean = currentUserEmail
            ? normalizeUsername(currentUserEmail)
            : null;

        const maskEmail = (email: string) => {
            return email.replace(/(^.)[^@]*(@.*$)/, "$1***$2");
        };

        const allPotentialUsers = [...allUsers, ...activeArray];
        const uniqueCleanUsernames = Array.from(
            new Set(
                allPotentialUsers.map((u) => {
                    let clean = normalizeUsername(u);

                    if (clean === "anonymous" && currentEmailClean) {
                        clean = currentEmailClean;
                    }

                    if (clean.includes("***")) {
                        const unmaskedMatch = activeArray.find((active) => {
                            let activeClean = normalizeUsername(active);
                            if (
                                activeClean === "anonymous" &&
                                currentEmailClean
                            ) {
                                activeClean = currentEmailClean;
                            }
                            return clean === maskEmail(activeClean);
                        });

                        if (unmaskedMatch) {
                            const matchClean = normalizeUsername(unmaskedMatch);
                            return matchClean === "anonymous" &&
                                currentEmailClean
                                ? currentEmailClean
                                : matchClean;
                        }
                    }

                    return clean;
                }),
            ),
        );

        const baseUsers = uniqueCleanUsernames.map((clean) => {
            const isActive =
                activeUsernames.has(clean) ||
                (clean === currentEmailClean &&
                    activeUsernames.has("anonymous"));

            if (isActive) {
                return (
                    activeArray.find((u) => {
                        const uClean = normalizeUsername(u);
                        return (
                            uClean === clean ||
                            (uClean === "anonymous" &&
                                clean === currentEmailClean)
                        );
                    }) ?? clean
                );
            }

            return (
                allUsers.find((u) => {
                    const uClean = normalizeUsername(u);
                    return uClean === clean || uClean === maskEmail(clean);
                }) ?? clean
            );
        });

        if (baseUsers.length === 0) return null;

        return (
            <div className="flex items-center gap-4 animate-in fade-in duration-300">
                <div className="flex -space-x-3">
                    {baseUsers.map((username) => {
                        const cleanUsername = normalizeUsername(username);
                        const isActive = activeUsernames.has(cleanUsername);
                        const isTyping = typingUsernames.has(cleanUsername);
                        const avatarClassName = getAvatarClassName(
                            isActive,
                            isTyping,
                        );
                        const displayName = resolveDisplayName(username);
                        const avatarTitle = getAvatarTitle(
                            displayName,
                            isActive,
                            isTyping,
                        );
                        return (
                            <div key={username} className="relative group">
                                <div
                                    className={avatarClassName}
                                    style={{
                                        backgroundColor:
                                            stringToColor(username),
                                    }}
                                    title={avatarTitle}
                                >
                                    {displayName.charAt(0).toUpperCase()}
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
                <div className="flex flex-col">
                    <span className="text-xs font-black text-text-strong uppercase tracking-wider">
                        {activeArray.length} Active
                    </span>
                    <span className="text-[9px] font-bold text-text-muted uppercase tracking-tight">
                        {baseUsers.length} Total
                    </span>
                </div>
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
                <output
                    className="text-[12px] font-bold text-text-muted tracking-tight leading-none"
                    aria-live="polite"
                >
                    {typingArray.length === 1
                        ? `${resolveDisplayName(typingArray[0])} is typing...`
                        : "Several people are typing..."}
                </output>
            </div>
        );
    }

    return null;
};

export default PresenceBar;
