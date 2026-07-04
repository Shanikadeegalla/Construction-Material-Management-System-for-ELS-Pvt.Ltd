import React, { useState, useEffect } from 'react';
import AdminDashboard from './pages/AdminDashboard';
import MainStoreDashboard from './pages/MainStoreDashboard';
import PMDashboard from './pages/PMDashboard';
import PurchaseOrderPage from './pages/PurchaseOrderPage';
import GRNPage from './pages/GRNPage';
import SiteStoreDashboard from './pages/SiteStoreDashboard';
import PurchaseRequestPage from './pages/PurchaseRequestPage';
import SupplierManagement from './pages/SupplierManagement';
import DirectorDashboard from './pages/DirectorDashboard';

function App() {
  const [view, setView] = useState('login');
  const [user, setUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerRole, setRegisterRole] = useState('StoreOfficer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_AUTH_URL = 'http://localhost:5000/api/auth';

  useEffect(() => {
    // Check dark mode preference
    const isDarkMode = localStorage.getItem('cmms_dark_mode') === 'true';
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    }

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        setView('dashboard');
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
        localStorage.setItem('user', JSON.stringify(data.data));
        localStorage.setItem('cmms_last_login', new Date().toISOString());
        setUser(data.data);
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
        setRegisterName(''); setRegisterEmail(''); setRegisterPassword(''); setRegisterRole('StoreOfficer');
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
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>Account Sign In</h2>
      <p style={styles.cardSub}>Welcome back! Please enter your details.</p>
      {error && <div style={styles.errorAlert}>{error}</div>}
      {success && <div style={styles.successAlert}>{success}</div>}
      <form onSubmit={handleLogin} style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Email Address</label>
          <input type="email" placeholder="enter your email" value={loginEmail}
            onChange={(e) => setLoginEmail(e.target.value)} style={styles.input} required />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Password</label>
          <input type="password" placeholder="••••••••" value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)} style={styles.input} required />
        </div>
        <button type="submit" disabled={loading} style={styles.button}>
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
          <input type="password" placeholder="•••••••• (min 6 chars)" value={registerPassword}
            onChange={(e) => setRegisterPassword(e.target.value)} style={styles.input} required />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Assign Workspace Role</label>
          <select value={registerRole} onChange={(e) => setRegisterRole(e.target.value)} style={styles.select}>
            <option value="Admin">Admin</option>
            <option value="Director">Director</option>
            <option value="ProjectManager">Project Manager</option>
            <option value="PurchaseOfficer">Purchase Officer</option>
            <option value="StoreOfficer">Store Officer</option>
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

  const renderDashboard = () => {
    if (!user) return null;
    if (user.role === 'Admin') {
      return <AdminDashboard user={user} onLogout={handleLogout} />;
    }
    if (user.role === 'ProjectManager') {
      return <PMDashboard user={user} onLogout={handleLogout} />;
    }
    if (user.role === 'PurchaseOfficer') {
      return <PurchaseOrderPage user={user} onLogout={handleLogout} />;
    }
    if (user.role === 'StoreOfficer') {
      const storeType = localStorage.getItem('storeType') || 'MainStore';
      if (storeType === 'SiteStore') {
        return <SiteStoreDashboard user={user} onLogout={handleLogout} />;
      }
      return <MainStoreDashboard user={user} onLogout={handleLogout} />;
    }
    if (user.role === 'Director') {
      return <DirectorDashboard user={user} onLogout={handleLogout} />;
    }

    return (
      <div style={{ padding: '40px', color: 'white', textAlign: 'center', background: '#030712', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        <h2>Access Denied</h2>
        <p style={{ color: '#9ca3af', marginTop: '10px', marginBottom: '20px' }}>Your role ({user.role}) is not authorized to access this workspace.</p>
        <button onClick={handleLogout} style={{ ...styles.button, maxWidth: '200px' }}>Logout</button>
      </div>
    );
  };

  return (
    <div style={styles.pageContainer}>
      <style>{globalStyles}</style>
      {!user && (
        <header style={styles.header}>
          <div style={styles.logoContainer}>
            <div style={styles.logoIcon}>E</div>
            <h1 style={styles.logoText}>ELS Construction CMMS</h1>
          </div>
          <div style={styles.navStatus}>
            <span style={styles.guestBadge}>🔒 Protected Session</span>
          </div>
        </header>
      )}
      <main style={!user ? styles.main : {}}>
        {view === 'login' && renderLogin()}
        {view === 'register' && renderRegister()}
        {user && renderDashboard()}
      </main>
      {!user && (
        <footer style={styles.footer}>
          <p>Construction Material Management System • ELS Construction (Pvt) Ltd</p>
        </footer>
      )}
    </div>
  );
}

const globalStyles = `* { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; } body { background-color: #030712; color: #f9fafb; }`;

const styles = {
  pageContainer: { minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#030712', backgroundImage: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #030712 60%)', color: '#f9fafb' },
  container: { minHeight: '100vh', backgroundColor: '#0f172a' },
  navbar: { background: '#1e1b4b', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  navTitle: { color: 'white', fontSize: '18px' },
  navLinks: { display: 'flex', alignItems: 'center', gap: '12px' },
  navBtn: { color: 'white', border: '1px solid #6366f1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  navUser: { color: '#9ca3af', fontSize: '14px' },
  content: { padding: '24px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 40px', borderBottom: '1px solid #1f2937', backgroundColor: 'rgba(3,7,18,0.7)', backdropFilter: 'blur(12px)' },
  logoContainer: { display: 'flex', alignItems: 'center', gap: '12px' },
  logoIcon: { width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', color: 'white' },
  logoText: { fontSize: '20px', fontWeight: '700', color: 'white' },
  navStatus: { display: 'flex', alignItems: 'center' },
  guestBadge: { padding: '6px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' },
  main: { flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' },
  card: { backgroundColor: 'rgba(17,24,39,0.75)', borderRadius: '24px', padding: '40px', width: '100%', maxWidth: '450px', border: '1px solid #374151', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)' },
  cardTitle: { fontSize: '24px', fontWeight: '700', marginBottom: '8px', textAlign: 'center', color: '#ffffff' },
  cardSub: { fontSize: '14px', color: '#9ca3af', marginBottom: '30px', textAlign: 'center' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af' },
  input: { backgroundColor: '#030712', border: '1px solid #4b5563', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', color: '#ffffff', outline: 'none' },
  select: { backgroundColor: '#030712', border: '1px solid #4b5563', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', color: '#ffffff', outline: 'none', cursor: 'pointer' },
  button: { background: 'linear-gradient(to right, #6366f1, #a855f7)', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginTop: '10px' },
  authSwitch: { marginTop: '24px', textAlign: 'center', fontSize: '14px', color: '#9ca3af' },
  switchLink: { color: '#6366f1', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' },
  errorAlert: { backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' },
  successAlert: { backgroundColor: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', color: '#a7f3d0', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', marginBottom: '20px', textAlign: 'center' },
  dashboardCard: { backgroundColor: 'rgba(17,24,39,0.75)', borderRadius: '24px', padding: '40px', width: '100%', border: '1px solid #374151', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' },
  dbProfile: { display: 'flex', alignItems: 'center', gap: '16px' },
  dbAvatar: { width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '24px', color: '#ffffff' },
  dbName: { fontSize: '22px', fontWeight: '700', color: '#ffffff' },
  dbEmail: { fontSize: '14px', color: '#9ca3af' },
  logoutBtn: { backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' },
  dbDivider: { height: '1px', backgroundColor: '#374151', margin: '30px 0' },
  roleTitle: { fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '12px' },
  roleBadgeContainer: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' },
  roleLabel: { fontSize: '15px', color: '#9ca3af' },
  roleBadge: { padding: '6px 14px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', backgroundColor: '#ff9800', color: '#ffffff' },
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