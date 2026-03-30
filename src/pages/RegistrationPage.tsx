import { useState } from 'react';
import axios from 'axios';

interface AuthPageProps {
  onAuthSuccess?: (authResult: any) => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isSubmitting) {
      return;
    }

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError("Passwords do not match. Please check again.");
      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            password: formData.password
          };

      const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081').replace(/\/+$/, '');

      const response = await axios.post(`${baseUrl}${endpoint}`, payload, {
        withCredentials: true
      });

      if (onAuthSuccess) {
        onAuthSuccess(response.data);
      }
    } catch (err: any) {
      setError(isLogin ? "Invalid email or password." : "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <h1>Welcome to P2P Shopping</h1>
        <p>{isLogin ? 'Login to your account' : 'Create an account'}</p>
      </div>

      <div className="tab-container">
        <button 
          type="button" 
          className={`tab-btn ${isLogin ? 'active' : ''}`}
          onClick={() => { setIsLogin(true); setError(''); }}
        >
          Login
        </button>
        <button 
          type="button" 
          className={`tab-btn ${!isLogin ? 'active' : ''}`}
          onClick={() => { setIsLogin(false); setError(''); }}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <div className="input-group">
            <div>
              <label htmlFor="firstName">First Name</label>
              <input 
                id="firstName" 
                type="text" 
                placeholder="First Name" 
                required 
                onChange={e => setFormData({...formData, firstName: e.target.value})} 
              />
            </div>
            <div>
              <label htmlFor="lastName">Last Name</label>
              <input 
                id="lastName" 
                type="text" 
                placeholder="Last Name" 
                required 
                onChange={e => setFormData({...formData, lastName: e.target.value})} 
              />
            </div>
          </div>
        )}

        <label htmlFor="email">Email</label>
        <input 
          id="email" 
          type="email" 
          placeholder="your@email.com" 
          required 
          onChange={e => setFormData({...formData, email: e.target.value})} 
        />

        <label htmlFor="password">Password</label>
        <input 
          id="password" 
          type="password" 
          placeholder="••••••••" 
          required 
          onChange={e => setFormData({...formData, password: e.target.value})} 
        />

        {!isLogin && (
          <>
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input 
              id="confirmPassword" 
              type="password" 
              placeholder="••••••••" 
              required 
              onChange={e => setFormData({...formData, confirmPassword: e.target.value})} 
            />
          </>
        )}

        {error && <p className="error-msg">{error}</p>}

        <button type="submit" className="submit-btn compact" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting...' : (isLogin ? 'Login' : 'Create Account')}
        </button>
      </form>
    </div>
  );
}