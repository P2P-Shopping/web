import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthLayout } from "../../components/AuthLayout";
import { GoogleLoginButton } from "../../components/GoogleLoginButton";
import { registerRequest } from "../../services/authService";

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
        <AuthLayout
            title="Create account"
            subtitle="Join to start managing your shopping lists"
            activeTab="register"
            maxWidthClass="max-w-[440px]"
        >
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

            <GoogleLoginButton setError={setError} />
        </AuthLayout>
    );
};

export default RegistrationPage;
