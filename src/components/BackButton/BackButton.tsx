import { ArrowLeft } from "lucide-react";
import type React from "react";
import { useNavigate } from "react-router-dom";

interface BackButtonProps {
    to?: string;
    label?: string;
}

const BackButton: React.FC<BackButtonProps> = ({
    to = "/",
    label = "Back",
}) => {
    const navigate = useNavigate();

    return (
        <button
            type="button"
            onClick={() => navigate(to)}
            className="self-start -ml-1 mb-4 p-1.5 text-text-muted hover:text-text-strong hover:bg-bg-subtle rounded-lg transition-all flex items-center gap-1.5 text-sm font-medium"
            aria-label={`Go back to ${to === "/" ? "home" : to}`}
            title="Go back"
        >
            <ArrowLeft size={18} />
            <span>{label}</span>
        </button>
    );
};

export default BackButton;
