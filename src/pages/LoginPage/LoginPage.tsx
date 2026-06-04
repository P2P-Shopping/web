import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthLayout } from "../../components/AuthLayout";
import { GoogleLoginButton } from "../../components/GoogleLoginButton";
import { useStore } from "../../context/useStore";
import { loginRequest } from "../../services/authService";

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();
    const setAuth = useStore((state) => state.setAuth);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setError("");
        setIsSubmitting(true);
        try {
            const result = await loginRequest(email, password);
            if (
                !result ||
                typeof result.token !== "string" ||
                result.token.trim().length === 0
            ) {
                throw new Error("Invalid response from server. No token received.");
            }
            setAuth(result, result.token);
            toast.success("Welcome back!");
            navigate("/dashboard");
        } catch (err: unknown) {
            let message = "Login failed. Please try again.";
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
        <AuthLayout
            title="Welcome back"
            subtitle="Sign in to manage your shopping lists"
            activeTab="login"
            maxWidthClass="max-w-[400px]"
        >
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                    <label htmlFor="email" className="text-[13px] font-bold text-text-strong uppercase tracking-wider">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="w-full px-4 py-3 bg-bg-subtle border border-border rounded-xl text-base text-text-strong outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)] transition-all"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <label htmlFor="password" className="text-[13px] font-bold text-text-strong uppercase tracking-wider">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="w-full px-4 py-3 bg-bg-subtle border border-border rounded-xl text-base text-text-strong outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)] transition-all"
                    />
                </div>

                {error && (
                    <p role="alert" className="bg-danger-subtle text-danger border border-danger-border p-3 rounded-lg text-sm font-medium animate-in shake-in duration-300">
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 bg-accent text-text-on-accent border-none rounded-xl text-base font-bold shadow-[0_4px_12px_var(--color-accent-glow)] transition-all hover:bg-accent-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? "Signing In..." : "Sign In"}
                </button>
            </form>

            <GoogleLoginButton setError={setError} />
        </AuthLayout>
    );
};

export default LoginPage;