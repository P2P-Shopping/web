import type React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginRequest } from "../../services/authService";
import "./LoginPage.css";

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
        } catch (err: any) {
            setError(err.message ?? "Login failed. Please try again.");
        }
    };

    return (
        <div className="auth-card">
            <div className="auth-logo">
                <span className="auth-logo-icon">🛒</span>
                <span className="auth-logo-name">P2P Shopping</span>
            </div>

            <h1 className="auth-heading">Welcome back</h1>
            <p className="auth-subtitle">Sign in to manage your shopping lists</p>

            <div className="auth-tabs">
                <button type="button" className="tab-btn active">Login</button>
                <button type="button" className="tab-btn" onClick={() => navigate("/register")}>
                    Register
                </button>
            </div>

            <form onSubmit={handleLogin}>
                <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                {error && <p className="error-msg">{error}</p>}

                <button type="submit" className="submit-btn">Sign In</button>
            </form>
        </div>
    );
};

export default LoginPage;
