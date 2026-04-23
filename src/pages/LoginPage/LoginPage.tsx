import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginRequest } from "../../services/authService";

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        try {
            await loginRequest(email, password);
            navigate("/dashboard");
            // biome-ignore lint/suspicious/noExplicitAny: API error response format
        } catch (err: any) {
            setError(err.message ?? "Login failed. Please try again.");
        }
    };

    return (
        <div className="flex flex-col w-full max-w-[400px] bg-surface border border-border rounded-2xl p-8 shadow-xl animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-center gap-3 mb-8">
                <span className="text-3xl" aria-hidden="true">
                    🛒
                </span>
                <span className="text-2xl font-black text-text-strong tracking-tighter">
                    P2P Shopping
                </span>
            </div>

            <h1 className="text-2xl font-bold text-text-strong tracking-tight mb-1">
                Welcome back
            </h1>
            <p className="text-[15px] text-text-muted mb-8">
                Sign in to manage your shopping lists
            </p>

            <div className="flex p-1 bg-bg-muted rounded-lg mb-8">
                <button
                    type="button"
                    className="flex-1 py-2 text-sm font-bold bg-surface text-text-strong rounded-md shadow-sm transition-all"
                >
                    Login
                </button>
                <button
                    type="button"
                    className="flex-1 py-2 text-sm font-semibold text-text-muted hover:text-text-strong rounded-md transition-all"
                    onClick={() => navigate("/register")}
                >
                    Register
                </button>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                    <label
                        htmlFor="email"
                        className="text-[13px] font-bold text-text-strong uppercase tracking-wider"
                    >
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
                    <label
                        htmlFor="password"
                        className="text-[13px] font-bold text-text-strong uppercase tracking-wider"
                    >
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
                    <p
                        role="alert"
                        className="bg-danger-subtle text-danger border border-danger-border p-3 rounded-lg text-sm font-medium animate-in shake-in duration-300"
                    >
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    className="w-full py-3.5 bg-accent text-text-on-accent border-none rounded-xl text-base font-bold shadow-[0_4px_12px_var(--color-accent-glow)] transition-all hover:bg-accent-hover hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                >
                    Sign In
                </button>
            </form>
        </div>
    );
};

export default LoginPage;
