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

const maskEmail = (email: string) => {
    return email.replace(/(^.)[^@]*(@.*$)/, "$1***$2");
};

interface UsernameResolutionContext {
    currentEmailClean: string | null;
    activeArray: string[];
    knownUnmaskedEmails: Set<string>;
}

const findActiveUnmaskedMatch = (
    clean: string,
    activeArray: string[],
    currentEmailClean: string | null,
): string | null => {
    for (const active of activeArray) {
        let activeClean = normalizeUsername(active);
        if (activeClean === "anonymous" && currentEmailClean) {
            activeClean = currentEmailClean;
        }
        if (clean === maskEmail(activeClean)) {
            return activeClean;
        }
    }
    return null;
};

const findKnownUnmaskedMatch = (
    clean: string,
    knownUnmaskedEmails: Set<string>,
): string | null => {
    for (const unmasked of knownUnmaskedEmails) {
        if (clean === maskEmail(unmasked)) {
            return unmasked;
        }
    }
    return null;
};

const resolveUniqueUsername = (
    u: string,
    context: UsernameResolutionContext,
): string => {
    const { currentEmailClean, activeArray, knownUnmaskedEmails } = context;
    let clean = normalizeUsername(u);

    if (clean === "anonymous" && currentEmailClean) {
        clean = currentEmailClean;
    }

    if (!clean.includes("***")) {
        return clean;
    }

    const activeMatch = findActiveUnmaskedMatch(
        clean,
        activeArray,
        currentEmailClean,
    );
    if (activeMatch) {
        return activeMatch;
    }

    const knownMatch = findKnownUnmaskedMatch(clean, knownUnmaskedEmails);
    if (knownMatch) {
        return knownMatch;
    }

    return clean;
};

interface BaseUserResolutionContext {
    activeUsernames: Set<string>;
    currentEmailClean: string | null;
    activeArray: string[];
    knownUnmaskedEmails: Set<string>;
    allUsers: string[];
}

const findActiveUserMatch = (
    clean: string,
    activeArray: string[],
    currentEmailClean: string | null,
): string | null => {
    for (const u of activeArray) {
        const uClean = normalizeUsername(u);
        if (uClean === clean) {
            return u;
        }
        if (uClean === "anonymous" && clean === currentEmailClean) {
            return u;
        }
    }
    return null;
};

const findAllUsersMatch = (
    clean: string,
    allUsers: string[],
): string | null => {
    for (const u of allUsers) {
        const uClean = normalizeUsername(u);
        if (uClean === clean || uClean === maskEmail(clean)) {
            return u;
        }
    }
    return null;
};

const resolveBaseUser = (
    clean: string,
    context: BaseUserResolutionContext,
): string => {
    const {
        activeUsernames,
        currentEmailClean,
        activeArray,
        knownUnmaskedEmails,
        allUsers,
    } = context;
    const isActive =
        activeUsernames.has(clean) ||
        (clean === currentEmailClean && activeUsernames.has("anonymous"));

    if (isActive) {
        return (
            findActiveUserMatch(clean, activeArray, currentEmailClean) ?? clean
        );
    }

    if (knownUnmaskedEmails.has(clean)) {
        return clean;
    }

    return findAllUsersMatch(clean, allUsers) ?? clean;
};

interface PresenceBarProps {
    variant?: "avatars" | "typing";
    allUsers?: string[];
}

const MAX_VISIBLE_AVATARS = 3;

const AvatarsPresenceBar: React.FC<{ allUsers: string[] }> = ({ allUsers }) => {
    const activeUsers = usePresenceStore((state) => state.activeUsers);
    const typingUsers = usePresenceStore((state) => state.typingUsers);
    const displayNames = usePresenceStore((state) => state.displayNames);
    const currentUserEmail = useStore((state) => state.user?.email ?? null);

    const activeArray = Array.from(activeUsers);
    const activeUsernames = new Set(activeArray.map(normalizeUsername));
    const typingUsernames = new Set(
        Object.keys(typingUsers).map(normalizeUsername),
    );

    const resolveDisplayName = (email: string): string => {
        const clean = normalizeUsername(email);
        if (displayNames[clean]) return displayNames[clean];
        if (displayNames[email]) return displayNames[email];
        return toDisplayName(email);
    };

    const currentEmailClean = currentUserEmail
        ? normalizeUsername(currentUserEmail)
        : null;

    const knownUnmaskedEmails = new Set<string>();
    if (currentEmailClean) {
        knownUnmaskedEmails.add(currentEmailClean);
    }
    for (const u of activeArray) {
        const cleanActive = normalizeUsername(u);
        if (cleanActive !== "anonymous") {
            knownUnmaskedEmails.add(cleanActive);
        }
    }
    for (const u of allUsers) {
        const cleanU = normalizeUsername(u);
        if (!cleanU.includes("***") && cleanU !== "anonymous") {
            knownUnmaskedEmails.add(cleanU);
        }
    }

    const allPotentialUsers = [...allUsers, ...activeArray];
    const uniqueCleanUsernames = Array.from(
        new Set(
            allPotentialUsers.map((u) =>
                resolveUniqueUsername(u, {
                    currentEmailClean,
                    activeArray,
                    knownUnmaskedEmails,
                }),
            ),
        ),
    );

    const baseUsers = uniqueCleanUsernames.map((clean) =>
        resolveBaseUser(clean, {
            activeUsernames,
            currentEmailClean,
            activeArray,
            knownUnmaskedEmails,
            allUsers,
        }),
    );

    if (baseUsers.length === 0) return null;

    const isActiveUser = (username: string) => {
        const clean = normalizeUsername(username);
        return (
            activeUsernames.has(clean) ||
            (clean === currentEmailClean && activeUsernames.has("anonymous"))
        );
    };

    const sortedUsers = [...baseUsers].sort((a, b) => {
        const aActive = isActiveUser(a) ? 0 : 1;
        const bActive = isActiveUser(b) ? 0 : 1;
        return aActive - bActive;
    });

    const visibleUsers = sortedUsers.slice(0, MAX_VISIBLE_AVATARS);
    const overflowCount = sortedUsers.length - visibleUsers.length;

    return (
        <div className="flex -space-x-2.5">
            {visibleUsers.map((username) => {
                const cleanUsername = normalizeUsername(username);
                const isActive = activeUsernames.has(cleanUsername);
                const isTyping = typingUsernames.has(cleanUsername);
                const avatarClassName = getAvatarClassName(isActive, isTyping);
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
                                backgroundColor: stringToColor(username),
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
            {overflowCount > 0 && (
                <div
                    className="w-10 h-10 rounded-full border-2 border-surface flex items-center justify-center text-xs font-bold text-white bg-bg-muted ring-1 ring-border/50"
                    title={`${overflowCount} more`}
                >
                    +{overflowCount}
                </div>
            )}
        </div>
    );
};

const TypingPresenceBar: React.FC = () => {
    const typingUsers = usePresenceStore((state) => state.typingUsers);
    const displayNames = usePresenceStore((state) => state.displayNames);

    const typingArray = Object.keys(typingUsers);
    if (typingArray.length === 0) return null;

    const resolveDisplayName = (email: string): string => {
        const clean = normalizeUsername(email);
        if (displayNames[clean]) return displayNames[clean];
        if (displayNames[email]) return displayNames[email];
        return toDisplayName(email);
    };

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
};

const PresenceBar: React.FC<PresenceBarProps> = ({
    variant = "avatars",
    allUsers = [],
}) => {
    if (variant === "avatars") {
        return <AvatarsPresenceBar allUsers={allUsers} />;
    }

    if (variant === "typing") {
        return <TypingPresenceBar />;
    }

    return null;
};

export default PresenceBar;
