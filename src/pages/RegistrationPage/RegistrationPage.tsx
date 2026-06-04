import { useGoogleLogin } from "@react-oauth/google";
import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthTabs, BackButton, Logo } from "../../components";
import { useStore } from "../../context/useStore";
import { googleLoginRequest, registerRequest } from "../../services/authService";

const RegistrationPage = () => {
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
    const setAuth = useStore((state) => state.setAuth);

    const loginWithGoogle = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                const result = await googleLoginRequest(tokenResponse.access_token);
                setAuth(result, result.token as string);
                toast.success("Welcome!");
                navigate("/dashboard");
            } catch {
                setError("Google login failed. Please try again.");
            }
        },
        onError: () => setError("Google login failed. Please try again."),
        scope: "email profile",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
        setError("");
    };

    const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        if (isSubmitting) return;

        if (formData.firstName.length < 2 || formData.firstName.length > 50) {
            setError("First name must be between 2 and 50 characters.");
            return;
        }
        if (formData.lastName.length < 2 || formData.lastName.length > 50) {
            setError("Last name must be between 2 and 50 characters.");
            return;
        }

        const nameRegex = /^[a-zA-Z\s-]+$/;
        if (!nameRegex.test(formData.firstName)) {
            setError(
                "First name can only contain letters, spaces, or hyphens.",
            );
            return;
        }
        if (!nameRegex.test(formData.lastName)) {
            setError("Last name can only contain letters, spaces, or hyphens.");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError("Please enter a valid email address.");
            return;
        }

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
            await registerRequest(formData);
            toast.success("Account created successfully! Please log in.");
            navigate("/login");
        } catch (err: unknown) {
            let message = "Registration failed. Please try again.";
            if (err instanceof Error) {
                message = err.message;
            } else if (typeof err === "string" && err.trim().length > 0) {
                message = err;
            }
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="my-auto flex flex-col w-full max-w-[440px] bg-surface border border-border rounded-2xl p-8 shadow-xl animate-in fade-in zoom-in-95 duration-500">
            <BackButton />
            <div className="flex items-center justify-center gap-3 mb-8">
                <Logo className="h-12 w-auto" alt="uCart" />
            </div>

            <h1 className="text-2xl font-bold text-text-strong tracking-tight mb-1">
                Create account
            </h1>
            <p className="text-[15px] text-text-muted mb-8">
                Join to start managing your shopping lists
            </p>

            <AuthTabs activeTab="register" />

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
                    <p
                        role="alert"
                        className="bg-danger-subtle text-danger border border-danger-border p-3 rounded-lg text-sm font-medium"
                    >
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

            <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-text-muted font-medium">or</span>
                <div className="flex-1 h-px bg-border" />
            </div>

            <button
                type="button"
                onClick={() => loginWithGoogle()}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-surface border border-border rounded-xl text-sm font-semibold text-text-strong transition-all hover:bg-bg-muted hover:border-accent-border active:scale-[0.98]"
            >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
                Continue with Google
            </button>
        </div>
    );
};

export default RegistrationPage;
