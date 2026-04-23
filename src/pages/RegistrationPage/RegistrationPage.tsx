import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerRequest } from "../../services/authService";
import "../LoginPage/LoginPage.css";

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
            setError("Password must be 8+ chars with uppercase, lowercase, and a number.");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await registerRequest(formData);
            if (onAuthSuccess) onAuthSuccess(response);
            navigate("/login");
        } catch (err: any) {
            setError(err.response?.data?.message ?? "Registration failed. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="auth-card">
            <div className="auth-logo">
                <span className="auth-logo-icon">🛒</span>
                <span className="auth-logo-name">P2P Shopping</span>
            </div>

            <h1 className="auth-heading">Create account</h1>
            <p className="auth-subtitle">Join to start managing your shopping lists</p>

            <div className="auth-tabs">
                <button type="button" className="tab-btn" onClick={() => navigate("/login")}>
                    Login
                </button>
                <button type="button" className="tab-btn active">Register</button>
            </div>

            <form onSubmit={handleRegister}>
                <div className="auth-row">
                    <div className="form-group">
                        <label htmlFor="firstName">First Name</label>
                        <input
                            id="firstName"
                            type="text"
                            placeholder="First"
                            value={formData.firstName}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="lastName">Last Name</label>
                        <input
                            id="lastName"
                            type="text"
                            placeholder="Last"
                            value={formData.lastName}
                            onChange={handleChange}
                            required
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                    />
                </div>

                {error && <p className="error-msg">{error}</p>}

                <button type="submit" className="submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? "Creating account…" : "Create Account"}
                </button>
            </form>
        </div>
    );
};

export default RegistrationPage;
