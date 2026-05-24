import type React from "react";
import { useNavigate } from "react-router-dom";

interface AuthTabsProps {
    activeTab: "login" | "register";
}

const AuthTabs: React.FC<AuthTabsProps> = ({ activeTab }) => {
    const navigate = useNavigate();

    return (
        <div className="flex p-1 bg-bg-muted rounded-lg mb-8 w-full">
            {activeTab === "login" ? (
                <div className="flex-1 py-2 text-sm font-bold bg-accent text-text-on-accent rounded-md shadow-md text-center select-none cursor-default">
                    Login
                </div>
            ) : (
                <button
                    type="button"
                    className="flex-1 py-2 text-sm font-semibold text-text-muted hover:text-text-strong rounded-md transition-all"
                    onClick={() => navigate("/login")}
                >
                    Login
                </button>
            )}
            {activeTab === "register" ? (
                <div className="flex-1 py-2 text-sm font-bold bg-accent text-text-on-accent rounded-md shadow-md text-center select-none cursor-default">
                    Register
                </div>
            ) : (
                <button
                    type="button"
                    className="flex-1 py-2 text-sm font-semibold text-text-muted hover:text-text-strong rounded-md transition-all"
                    onClick={() => navigate("/register")}
                >
                    Register
                </button>
            )}
        </div>
    );
};

export default AuthTabs;
