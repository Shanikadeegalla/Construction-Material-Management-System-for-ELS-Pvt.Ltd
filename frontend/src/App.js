import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import AdminDashboard from './pages/AdminDashboard';
import PMDashboard from './pages/PMDashboard';
import PurchaseOrderPage from './pages/PurchaseOrderPage';
import MainStoreDashboard from './pages/MainStoreDashboard';
import DirectorDashboard from './pages/DirectorDashboard';
import SiteStoreDashboard from './pages/SiteStoreDashboard';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentCancel from './pages/PaymentCancel';

function App() {
  const [view, setView] = useState('login');
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerRole, setRegisterRole] = useState('MainStoreOfficer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_AUTH_URL = 'http://localhost:5000/api/auth';

  useEffect(() => {
    // Check dark mode preference
    const isDarkMode = localStorage.getItem('cmms_dark_mode') === 'true';
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
      document.documentElement.classList.add('dark-mode');
    }

    const path = window.location.pathname;
    if (path.startsWith('/payments/success')) {
      setView('payment-success');
    } else if (path.startsWith('/payments/cancel')) {
      setView('payment-cancel');
    }

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        if (!path.startsWith('/payments/')) {
          setView('dashboard');
        }
      } catch (err) {
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!loginEmail || !loginPassword) { setError('Please provide email and password.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_AUTH_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (data.success) {
        const userData = data.data;
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('cmms_last_login', new Date().toISOString());
        
        // Sync dark mode preference from user settings database
        const isDark = userData.settings?.system?.darkMode === true;
        localStorage.setItem('cmms_dark_mode', isDark);
        if (isDark) {
          document.body.classList.add('dark-mode');
          document.documentElement.classList.add('dark-mode');
        } else {
          document.body.classList.remove('dark-mode');
          document.documentElement.classList.remove('dark-mode');
        }
        
        setUser(userData);
        setView('dashboard');
        setLoginEmail(''); setLoginPassword('');
      } else {
        setError(data.message || 'Invalid email or password.');
      }
    } catch (err) {
      setError('Connection refused. Please ensure the backend server is running.');
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!registerName || !registerEmail || !registerPassword || !registerRole) {
      setError('Please fill out all fields.'); return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_AUTH_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: registerName, email: registerEmail, password: registerPassword, role: registerRole }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Registration successful! Please login below.');
        setView('login');
        setRegisterName(''); setRegisterEmail(''); setRegisterPassword(''); setRegisterRole('MainStoreOfficer');
      } else {
        setError(data.message || 'Registration failed.');
      }
    } catch (err) {
      setError('Connection refused. Please ensure the backend server is running.');
    } finally { setLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setView('login');
  };

  const renderLogin = () => (
    <div className="els-login-card" style={styles.loginCard}>
      <style>{loginStyles}</style>

      {/* Brand Logo & Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
        <img
          src="/els-logo.png"
          alt="ELS Logo"
          style={{ width: '76px', height: '76px', objectFit: 'cover', borderRadius: '50%', marginBottom: '14px' }}
        />
        <h2 style={{ fontSize: '21px', fontWeight: '800', color: '#0d1b4b', margin: '0 0 4px', textAlign: 'center' }}>ELS Construction (Pvt) Ltd</h2>
      </div>

      <h3 style={{ ...styles.cardTitle, fontSize: '18px', marginTop: '12px', marginBottom: '6px' }}>Account Sign In</h3>
      <p style={styles.cardSub}>Welcome! Please enter your details.</p>
      {error && <div style={styles.errorAlert}>{error}</div>}
      {success && <div style={styles.successAlert}>{success}</div>}
      <form onSubmit={handleLogin} style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Email Address</label>
          <div className="els-input-wrap">
            <Mail size={16} className="els-input-icon" />
            <input type="email" placeholder="enter your email" value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)} className="els-input" style={styles.loginInput} required />
          </div>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Password</label>
          <div className="els-input-wrap">
            <Lock size={16} className="els-input-icon" />
            <input type={showLoginPassword ? 'text' : 'password'} placeholder="••••••••" value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)} className="els-input" style={{ ...styles.loginInput, paddingRight: '44px' }} required />
            {loginPassword && (
              <span onClick={() => setShowLoginPassword(!showLoginPassword)}
                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#64748b', display: 'flex' }}>
                {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </span>
            )}
          </div>
        </div>
        <button type="submit" disabled={loading} className="els-login-btn">
          {loading && <span className="els-login-spinner" />}
          {loading ? 'Authenticating...' : 'Sign In'}
        </button>
      </form>

    </div>
  );

  const renderRegister = () => (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>Create Account</h2>
      <p style={styles.cardSub}>Join us! Choose a specific workspace role.</p>
      {error && <div style={styles.errorAlert}>{error}</div>}
      <form onSubmit={handleRegister} style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Full Name</label>
          <input type="text" placeholder="John Doe" value={registerName}
            onChange={(e) => setRegisterName(e.target.value)} style={styles.input} required />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Email Address</label>
          <input type="email" placeholder="john@example.com" value={registerEmail}
            onChange={(e) => setRegisterEmail(e.target.value)} style={styles.input} required />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Password</label>
          <input type="password" placeholder="8+ chars, upper, lower, number, symbol" value={registerPassword}
            onChange={(e) => setRegisterPassword(e.target.value)} style={styles.input} required />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Assign Workspace Role</label>
          <select value={registerRole} onChange={(e) => setRegisterRole(e.target.value)} style={styles.select}>
            <option value="Admin">Admin</option>
            <option value="Director">Director</option>
            <option value="ProjectManager">Project Manager</option>
            <option value="PurchaseManager">Purchase Manager</option>
            <option value="MainStoreOfficer">Main Store Officer</option>
            <option value="SiteStoreOfficer">Site Store Officer</option>
          </select>
        </div>
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Registering...' : 'Sign Up'}
        </button>
      </form>
      <div style={styles.authSwitch}>
        Already have an account?{' '}
        <span onClick={() => { setView('login'); setError(''); setSuccess(''); }} style={styles.switchLink}>Sign In</span>
      </div>
    </div>
  );

  const handleUserUpdate = (updatedUser) => {
    const mergedUser = { ...user, ...updatedUser };
    localStorage.setItem('user', JSON.stringify(mergedUser));
    setUser(mergedUser);
  };

  const renderDashboard = () => {
    if (!user) return null;
    if (user.role === 'Admin') {
      return <AdminDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />;
    }
    if (user.role === 'Director') {
      return <DirectorDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />;
    }
    if (user.role === 'ProjectManager') {
      return <PMDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />;
    }
    if (user.role === 'PurchaseManager') {
      return <PurchaseOrderPage user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />;
    }
    if (user.role === 'MainStoreOfficer') {
      return <MainStoreDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />;
    }
    if (user.role === 'SiteStoreOfficer' || user.role === 'StoreOfficer') {
      return <SiteStoreDashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />;
    }

    return (
      <div style={{ padding: '40px', color: 'white', textAlign: 'center', background: '#030712', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <h2>Access Denied</h2>
        <p style={{ color: '#9ca3af', marginTop: '10px', marginBottom: '20px' }}>Your role ({user.role}) is not authorized to access this workspace.</p>
        <button onClick={handleLogout} style={{ ...styles.button, maxWidth: '200px' }}>Logout</button>
      </div>
    );
  };

  const getPageContainerStyle = () => {
    if (!user) {
      // Sign-in page background restored to original theme
      return {
        ...styles.pageContainer,
        backgroundColor: '#030712',
        backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #030712 60%)'
      };
    } else {
      // Workspace pages are Slate/Blue themed
      return {
        ...styles.pageContainer,
        backgroundColor: '#020617',
        backgroundImage: 'radial-gradient(circle at 50% 0%, #0f172a 0%, #020617 60%)'
      };
    }
  };

  return (
    <div style={getPageContainerStyle()}>
      <style>{globalStyles}</style>
      <main style={!user && !view.startsWith('payment-') ? styles.main : {}}>
        {view === 'login' && renderLogin()}
        {view === 'register' && renderRegister()}
        {view === 'payment-success' && (
          <PaymentSuccess onReturnToPOs={() => {
            window.history.pushState({}, '', '/');
            setView(user ? 'dashboard' : 'login');
          }} />
        )}
        {view === 'payment-cancel' && (
          <PaymentCancel onReturnToPOs={() => {
            window.history.pushState({}, '', '/');
            setView(user ? 'dashboard' : 'login');
          }} />
        )}
        {user && renderDashboard()}
      </main>
      {!user && !view.startsWith('payment-') && (
        <footer style={styles.footer}>
          <p>Construction Material Management System • ELS Construction (Pvt) Ltd</p>
        </footer>
      )}
    </div>
  );
}

const globalStyles = `* { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; } body { background-color: #030712; color: #f9fafb; }`;

const loginStyles = `
  .els-login-card {
    position: relative;
    animation: els-card-in 0.5s ease;
  }
  @keyframes els-card-in {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .els-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }
  .els-input-icon {
    position: absolute;
    left: 14px;
    color: #94a3b8;
    pointer-events: none;
  }
  .els-input {
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
  }
  .els-input:focus {
    border-color: #fb923c !important;
    background-color: #ffffff !important;
    box-shadow: 0 0 0 4px rgba(251, 146, 60, 0.15);
  }
  .els-login-btn {
    width: 100%;
    border: none;
    border-radius: 12px;
    padding: 14px;
    margin-top: 10px;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #ffffff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: linear-gradient(120deg, #ff7a18 0%, #ff5f6d 45%, #a239ea 100%);
    background-size: 200% 200%;
    background-position: 0% 50%;
    box-shadow: 0 10px 25px -8px rgba(162, 57, 234, 0.55);
    transition: background-position 0.4s ease, box-shadow 0.2s ease, transform 0.1s ease;
  }
  .els-login-btn:hover:not(:disabled) {
    background-position: 100% 50%;
    box-shadow: 0 14px 30px -8px rgba(255, 95, 109, 0.6);
  }
  .els-login-btn:active:not(:disabled) {
    transform: translateY(1px);
  }
  .els-login-btn:disabled {
    opacity: 0.75;
    cursor: not-allowed;
  }
  .els-login-spinner {
    width: 15px;
    height: 15px;
    border: 2px solid rgba(255,255,255,0.45);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: els-spin 0.7s linear infinite;
  }
  @keyframes els-spin {
    to { transform: rotate(360deg); }
  }
`;

const styles = {
  pageContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#030712', backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #030712 60%)', color: '#f9fafb' },
  container: { minHeight: '100vh', backgroundColor: '#0f172a' },
  navbar: { background: '#1e1b4b', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  navTitle: { color: 'white', fontSize: '18px' },
  navLinks: { display: 'flex', alignItems: 'center', gap: '12px' },
  navBtn: { color: 'white', border: '1px solid #2563eb', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  navUser: { color: '#9ca3af', fontSize: '14px' },
  content: { padding: '24px' },
  main: { flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' },
  card: { backgroundColor: '#ffffff', borderRadius: '12px', padding: '40px', width: '100%', maxWidth: '450px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)' },
  loginCard: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    borderRadius: '20px',
    padding: '44px 40px',
    width: '100%',
    maxWidth: '440px',
    border: '1px solid rgba(255,255,255,0.6)',
    boxShadow: '0 25px 60px -15px rgba(13, 27, 75, 0.35), 0 0 0 1px rgba(255,255,255,0.4) inset',
  },
  loginInput: { backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px 12px 42px', fontSize: '14px', color: '#0f172a', outline: 'none', width: '100%', boxSizing: 'border-box' },
  cardTitle: { fontSize: '24px', fontWeight: '700', marginBottom: '8px', textAlign: 'center', color: '#1e293b' },
  cardSub: { fontSize: '14px', color: '#64748b', marginBottom: '30px', textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' },
  input: { backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', color: '#0f172a', outline: 'none' },
  select: { backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', color: '#0f172a', outline: 'none', cursor: 'pointer' },
  button: { background: 'linear-gradient(to right, #ff9800, #f57c00)', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginTop: '10px' },
  authSwitch: { marginTop: '24px', textAlign: 'center', fontSize: '14px', color: '#64748b' },
  switchLink: { color: '#ff9800', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' },
  errorAlert: { backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' },
  successAlert: { backgroundColor: '#d1fae5', border: '1px solid #6ee7b7', color: '#065f46', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' },
  dashboardCard: { backgroundColor: 'rgba(17,24,39,0.75)', borderRadius: '24px', padding: '40px', width: '100%', border: '1px solid #374151', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' },
  dbProfile: { display: 'flex', alignItems: 'center', gap: '16px' },
  dbAvatar: { width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '24px', color: '#ffffff' },
  dbName: { fontSize: '22px', fontWeight: '700', color: '#ffffff' },
  dbEmail: { fontSize: '14px', color: '#9ca3af' },
  logoutBtn: { backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' },
  dbDivider: { height: '1px', backgroundColor: '#374151', margin: '30px 0' },
  roleTitle: { fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '12px' },
  roleBadgeContainer: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' },
  roleLabel: { fontSize: '15px', color: '#9ca3af' },
  roleBadge: { padding: '6px 14px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', backgroundColor: '#2563eb', color: '#ffffff' },
  footer: { textAlign: 'center', padding: '24px', borderTop: '1px solid #1f2937', fontSize: '12px', color: '#4b5563', backgroundColor: 'rgba(3,7,18,0.7)' },
  dashboardLayout: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#f5f6fa',
  },
  sidebar: {
    width: '260px',
    backgroundColor: '#0d1b4b',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    borderRight: '1px solid #1f2937',
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '30px',
  },
  sidebarTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'white',
  },
  sidebarUserSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 0',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    marginBottom: '24px',
  },
  sidebarUserInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarUserName: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'white',
  },
  sidebarUserRole: {
    fontSize: '12px',
    color: '#ff9800',
    fontWeight: '600',
  },
  sidebarNav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: '1',
  },
  sidebarBtn: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '12px 16px',
    backgroundColor: 'transparent',
    color: '#cbd5e1',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  sidebarBtnActive: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '12px 16px',
    backgroundColor: '#ff9800',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 4px 12px rgba(255,152,0,0.2)',
  },
  sidebarLogoutBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: 'rgba(239,68,68,0.1)',
    color: '#fca5a5',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    marginTop: 'auto',
  },
  contentArea: {
    flex: '1',
    backgroundColor: '#f5f6fa',
    padding: '30px',
    overflowY: 'auto',
    maxHeight: '100vh',
  },
};

export default App;