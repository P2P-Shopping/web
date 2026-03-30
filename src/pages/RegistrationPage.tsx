import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerRequest } from '../services/authService';

const RegistrationPage = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            alert("Parolele nu se potrivesc!");
            return;
        }
        try {
            await registerRequest(formData);
            alert("Cont creat cu succes!");
            navigate('/login');
        } catch (err: any) {
            alert("Eroare: " + err.message);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2>Welcome to P2P Shopping</h2>
                <p className="auth-subtitle">Create an account to manage your shopping lists</p>

                <div className="auth-tabs">
                    <button type="button" className="tab-btn" onClick={() => navigate('/login')}>Login</button>
                    <button type="button" className="tab-btn active">Register</button>
                </div>

                <form onSubmit={handleRegister}>
                    {/* Randul cu First Name si Last Name */}
                    <div className="auth-row">
                        <div className="form-group">
                            <label htmlFor="firstName">First Name</label>
                            <input id="firstName" type="text" placeholder="First Name" value={formData.firstName} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="lastName">Last Name</label>
                            <input id="lastName" type="text" placeholder="Last Name" value={formData.lastName} onChange={handleChange} required />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input id="email" type="email" placeholder="your@email.com" value={formData.email} onChange={handleChange} required />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input id="password" type="password" placeholder="********" value={formData.password} onChange={handleChange} required />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <input id="confirmPassword" type="password" placeholder="********" value={formData.confirmPassword} onChange={handleChange} required />
                    </div>

                    <button type="submit" className="submit-btn">Create Account</button>
                </form>
            </div>
        </div>
    );
};

export default RegistrationPage;