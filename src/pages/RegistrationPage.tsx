import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerRequest } from "../services/authService";

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
      setError("Passwords do not match. Please check again.");
      return;
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      setError(
        "Password must be at least 8 characters long, contain 1 uppercase, 1 lowercase letter, and 1 number."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await registerRequest(formData);

      if (onAuthSuccess) {
        onAuthSuccess(response);
      }

      navigate("/login");
    } catch (err) {
      setError((err as Error).message || "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <h2>Welcome to P2P Shopping</h2>
      <p className="auth-subtitle">Create an account to manage your shopping lists</p>

      <div className="auth-tabs">
        <button type="button" className="tab-btn" onClick={() => navigate("/login")}>
          Login
        </button>
        <button type="button" className="tab-btn active">
          Register
        </button>
      </div>

      <form onSubmit={handleRegister}>
        <div className="auth-row">
          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              id="firstName"
              type="text"
              placeholder="First Name"
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
              placeholder="Last Name"
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
          {isSubmitting ? "Submitting..." : "Create Account"}
        </button>
      </form>
    </div>
  );
};

export default RegistrationPage;
