import { useState } from 'react';
import axios from 'axios';

export default function AuthPage() {
  // 1. STATE: Tracks if we are looking at 'login' or 'register'
  const [isLogin, setIsLogin] = useState(false);
  
  // 2. STATE: Form Data
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Logic for Register only
    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError("Passwords do not match. Please check again.");
      return;
    }

    try {
      // JSON contract
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin 
        ? { email: formData.email, password: formData.password }
        : { 
            firstName: formData.firstName, 
            lastName: formData.lastName, 
            email: formData.email, 
            password: formData.password 
          };

      const response = await axios.post(`http://localhost:8080${endpoint}`, payload);

      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        alert(`${isLogin ? 'Login' : 'Registration'} Successful!`);
      }
    } catch (err: any) {
      setError(isLogin ? "Invalid email or password." : "Registration failed.");
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <h1>Welcome to P2P Shopping</h1>
        <p>{isLogin ? 'Login to your account' : 'Create an account to manage your lists'}</p>
      </div>

      {/* THE TAB SWITCHER */}
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
        {/* Only show Name fields if NOT in login mode */}
        {!isLogin && (
          <>
            <label>Name</label>
            <div className="input-group">
              <input type="text" placeholder="First Name" required 
                onChange={e => setFormData({...formData, firstName: e.target.value})} />
              <input type="text" placeholder="Last Name" required 
                onChange={e => setFormData({...formData, lastName: e.target.value})} />
            </div>
          </>
        )}

        <label>Email</label>
        <input type="email" placeholder="your@email.com" required 
          onChange={e => setFormData({...formData, email: e.target.value})} />

        <label>Password</label>
        <input type="password" placeholder="••••••••" required 
          onChange={e => setFormData({...formData, password: e.target.value})} />

        {/* Only show Confirm Password if NOT in login mode */}
        {!isLogin && (
          <>
            <label>Confirm Password</label>
            <input type="password" placeholder="••••••••" required 
              onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
          </>
        )}

        {error && <p className="error-msg">{error}</p>}

        <button type="submit" className="submit-btn compact">
          {isLogin ? 'Login' : 'Create Account'}
        </button>
      </form>
    </div>
  );
}