import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginRequest } from '../services/authService';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await loginRequest(email, password);
            navigate('/dashboard');
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div className="auth-card-container">
            <div className="auth-card">
                <button className="close-x">×</button>
                <h2>Welcome to P2P Shopping</h2>
                <p className="auth-subtitle">Login or create an account to manage your shopping lists</p>

                <div className="auth-tabs">
                    <button className="tab active">Login</button>
                    <button className="tab" onClick={() => navigate('/register')}>Register</button>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input id="password" type="password" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    <button type="submit" className="login-button">Login</button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;