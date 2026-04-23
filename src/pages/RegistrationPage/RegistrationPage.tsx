import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerRequest } from "../../services/authService";

interface RegistrationPageProps {
    onAuthSuccess?: (authResult: unknown) => void;
}

const RegistrationPage = ({ onAuthSuccess }: RegistrationPageProps) => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
        setError("");
    };

    const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        if (isSubmitting) return;

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(formData.password)) {
            setError(
                "Password must be 8+ chars with uppercase, lowercase, and a number.",
            );
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await registerRequest(formData);
            if (onAuthSuccess) onAuthSuccess(response);
            navigate("/login");
        } catch (err: any) {
            setError(
                err.response?.data?.message ??
                    "Registration failed. Please try again.",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col w-full max-w-[440px] bg-surface border border-border rounded-2xl p-8 shadow-xl animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-center gap-3 mb-8">
                <span className="text-3xl" aria-hidden="true">
                    🛒
                </span>
                <span className="text-2xl font-black text-text-strong tracking-tighter">
                    P2P Shopping
                </span>
            </div>

            <h1 className="text-2xl font-bold text-text-strong tracking-tight mb-1">
                Create account
            </h1>
            <p className="text-[15px] text-text-muted mb-8">
                Join to start managing your shopping lists
            </p>

            <div className="flex p-1 bg-bg-muted rounded-lg mb-8">
                <button
                    type="button"
                    className="flex-1 py-2 text-sm font-semibold text-text-muted hover:text-text-strong rounded-md transition-all"
                    onClick={() => navigate("/login")}
                >
                    Login
                </button>
                <button
                    type="button"
                    className="flex-1 py-2 text-sm font-bold bg-surface text-text-strong rounded-md shadow-sm transition-all"
                >
                    Register
                </button>
            </div>

            <form onSubmit={handleRegister} className="flex flex-col gap-4">
                <div className="flex gap-4">
                    <div className="flex flex-col gap-1.5 flex-1">
                        <label
                            htmlFor="firstName"
                            className="text-[12px] font-bold text-text-strong uppercase tracking-wider"
                        >
                            First Name
                        </label>
                        <input
                            id="firstName"
                            type="text"
                            placeholder="First"
                            value={formData.firstName}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2.5 bg-bg-subtle border border-border rounded-xl text-base text-text-strong outline-none focus:border-accent transition-all"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                        <label
                            htmlFor="lastName"
                            className="text-[12px] font-bold text-text-strong uppercase tracking-wider"
                        >
                            Last Name
                        </label>
                        <input
                            id="lastName"
                            type="text"
                            placeholder="Last"
                            value={formData.lastName}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2.5 bg-bg-subtle border border-border rounded-xl text-base text-text-strong outline-none focus:border-accent transition-all"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="email"
                        className="text-[12px] font-bold text-text-strong uppercase tracking-wider"
                    >
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 bg-bg-subtle border border-border rounded-xl text-base text-text-strong outline-none focus:border-accent transition-all"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="password"
                        className="text-[12px] font-bold text-text-strong uppercase tracking-wider"
                    >
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 bg-bg-subtle border border-border rounded-xl text-base text-text-strong outline-none focus:border-accent transition-all"
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="confirmPassword"
                        className="text-[12px] font-bold text-text-strong uppercase tracking-wider"
                    >
                        Confirm Password
                    </label>
                    <input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 bg-bg-subtle border border-border rounded-xl text-base text-text-strong outline-none focus:border-accent transition-all"
                    />
                </div>

                {error && (
                    <p className="bg-danger-subtle text-danger border border-danger-border p-3 rounded-lg text-sm font-medium">
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    className="w-full py-3.5 mt-2 bg-accent text-text-on-accent border-none rounded-xl text-base font-bold shadow-[0_4px_12px_var(--color-accent-glow)] transition-all hover:bg-accent-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Creating account…" : "Create Account"}
                </button>
            </form>
        </div>
    );
};

export default RegistrationPage;
