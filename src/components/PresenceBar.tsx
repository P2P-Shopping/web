import React from "react";
import { usePresenceStore } from "../context/usePresenceStore";
import "./PresenceBar.css";

/**
 * Renders the active users and their typing indicators based on the current presence state.
 */
const PresenceBar: React.FC = () => {
  const activeUsers = usePresenceStore((state) => state.activeUsers);
  const typingUsers = usePresenceStore((state) => state.typingUsers);

  /**
   * Generates a deterministic background color from a string.
   * @param {string} str - The string to hash.
   * @returns {string} The deterministic hex color code.
   */
  const stringToColor = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = "#";
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xff;
      color += ("00" + value.toString(16)).substr(-2);
    }
    return color;
  };

  if (activeUsers.size === 0) return null;

  return (
    <div className="presence-bar">
      {Array.from(activeUsers).map((username) => (
        <div key={username} className="avatar-wrapper">
          <div
            className="avatar-circle"
            style={{ backgroundColor: stringToColor(username) }}
          >
            {username.charAt(0).toUpperCase()}
          </div>
          {typingUsers[username] && (
            <div className="typing-indicator">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default PresenceBar;
