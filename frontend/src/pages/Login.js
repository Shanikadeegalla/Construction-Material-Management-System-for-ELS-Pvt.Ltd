import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(formData);
      if (user.role === 'admin') navigate('/admin/dashboard');
      else if (user.role === 'pm') navigate('/pm/dashboard');
      else if (user.role === 'store') navigate('/store/dashboard');
      else if (user.role === 'sitestore') navigate('/sitestore/dashboard');
      else if (user.role === 'purchase') navigate('/purchase/dashboard');
    } catch (err) {
      setError('Invalid username or password!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: linear-gradient(135deg, #0d47a1 0%, #1a73e8 45%, #4f9bff 100%);
          box-sizing: border-box;
        }
        .login-card {
          display: flex;
          width: 100%;
          max-width: 860px;
          min-height: 480px;
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(13, 71, 161, 0.35);
          overflow: hidden;
        }
        .login-brand {
          flex: 1;
          background: linear-gradient(160deg, #1a73e8, #0d47a1);
          color: #fff;
          padding: 48px 40px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
        }
        .login-brand::before {
          content: '';
          position: absolute;
          top: -60px;
          right: -60px;
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: rgba(255,255,255,0.08);
        }
        .login-brand::after {
          content: '';
          position: absolute;
          bottom: -80px;
          left: -40px;
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: rgba(255,255,255,0.06);
        }
        .login-brand-logo {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          background: rgba(255,255,255,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          font-weight: 700;
          margin-bottom: 24px;
        }
        .login-brand h1 {
          font-size: 30px;
          margin: 0 0 12px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .login-brand p {
          font-size: 15px;
          line-height: 1.6;
          opacity: 0.9;
          margin: 0;
          max-width: 280px;
        }
        .login-form-panel {
          flex: 1;
          padding: 48px 44px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .login-form-panel h2 {
          font-size: 24px;
          color: #1a2233;
          margin: 0 0 6px;
        }
        .login-form-panel .subtitle {
          color: #8a94a6;
          font-size: 14px;
          margin: 0 0 28px;
        }
        .login-field {
          margin-bottom: 18px;
        }
        .login-field label {
          display: block;
          margin-bottom: 6px;
          color: #33394a;
          font-size: 13px;
          font-weight: 600;
        }
        .login-input-wrap {
          position: relative;
        }
        .login-input-wrap svg {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #a4acc0;
        }
        .login-input {
          width: 100%;
          padding: 12px 14px 12px 42px;
          border-radius: 10px;
          border: 1.5px solid #e3e6ee;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
          background: #f8f9fc;
          transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
        }
        .login-input:focus {
          border-color: #1a73e8;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.12);
        }
        .login-toggle-password {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #8a94a6;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 4px 6px;
        }
        .login-toggle-password:hover {
          color: #1a73e8;
        }
        .login-error {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #fdecea;
          color: #c62828;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 13px;
          margin-bottom: 16px;
        }
        .login-button {
          width: 100%;
          padding: 13px;
          background: #1a73e8;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 6px;
          transition: background 0.15s ease, transform 0.1s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .login-button:hover:not(:disabled) {
          background: #1560c7;
        }
        .login-button:active:not(:disabled) {
          transform: translateY(1px);
        }
        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .login-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: login-spin 0.7s linear infinite;
        }
        @keyframes login-spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 720px) {
          .login-card {
            flex-direction: column;
            max-width: 420px;
          }
          .login-brand {
            padding: 32px 32px 24px;
          }
          .login-brand p {
            max-width: none;
          }
          .login-form-panel {
            padding: 32px;
          }
        }
      `}</style>

      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-logo">C</div>
          <h1>CMMS</h1>
          <p>Construction Material Management System — track inventory, issuance and site stock from one place.</p>
        </div>

        <div className="login-form-panel">
          <h2>Welcome back</h2>
          <p className="subtitle">Sign in to continue to your dashboard</p>

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label>Username</label>
              <div className="login-input-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="login-input"
                  placeholder="Enter username"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label>Password</label>
              <div className="login-input-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="login-input"
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                  style={{ paddingRight: '56px' }}
                />
                <button
                  type="button"
                  className="login-toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <button type="submit" className="login-button" disabled={loading}>
              {loading && <span className="login-spinner" />}
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
