import React, { useState, useEffect } from 'react';

const SettingsPage = ({ user, onLogout }) => {
  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  // Appearance State
  const [darkMode, setDarkMode] = useState(false);
  const [themeColor, setThemeColor] = useState('#ff9800');

  // Notifications State
  const [notifs, setNotifs] = useState({
    lowStock: true,
    prApproval: true,
    poStatus: true
  });

  // Session State
  const [sessionStart] = useState(new Date().toLocaleString());
  const [lastLogin, setLastLogin] = useState('N/A');

  // Load preferences from localStorage on mount
  useEffect(() => {
    // Dark mode
    const storedDarkMode = localStorage.getItem('cmms_dark_mode') === 'true';
    setDarkMode(storedDarkMode);

    // Notifications
    const storedNotifs = localStorage.getItem('cmms_notifications');
    if (storedNotifs) {
      try {
        setNotifs(JSON.parse(storedNotifs));
      } catch (e) {
        // ignore
      }
    }

    // Last login fallback
    const storedLastLogin = localStorage.getItem('cmms_last_login');
    if (storedLastLogin) {
      setLastLogin(new Date(storedLastLogin).toLocaleString());
    } else {
      setLastLogin(new Date().toLocaleString());
    }
  }, []);

  // Handle dark mode toggle
  const handleDarkModeToggle = (checked) => {
    setDarkMode(checked);
    localStorage.setItem('cmms_dark_mode', checked);
    if (checked) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  };

  // Handle notification toggle
  const handleNotifToggle = (key) => {
    const updated = { ...notifs, [key]: !notifs[key] };
    setNotifs(updated);
    localStorage.setItem('cmms_notifications', JSON.stringify(updated));
  };

  // Handle password save
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`http://localhost:5000/api/auth/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMessage('✅ Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordError(data.message || 'Failed to update password.');
      }
    } catch (err) {
      setPasswordError('Error connecting to the server.');
    } finally {
      setLoading(false);
    }
  };

  // Styles dynamically adjusted for dark mode
  const styles = {
    card: {
      background: darkMode ? '#16213e' : 'white',
      color: darkMode ? '#ffffff' : '#333333',
      borderRadius: '8px',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
      transition: 'all 0.3s ease'
    },
    title: {
      color: darkMode ? '#ff9800' : '#0d1b4b',
      fontSize: '18px',
      fontWeight: '600',
      marginBottom: '16px',
      borderBottom: darkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8f0',
      paddingBottom: '8px'
    },
    label: {
      display: 'block',
      fontSize: '12px',
      color: darkMode ? '#94a3b8' : '#64748b',
      fontWeight: '600',
      marginBottom: '6px',
      textTransform: 'uppercase'
    },
    input: {
      width: '100%',
      padding: '10px',
      borderRadius: '6px',
      border: darkMode ? '1px solid #2e3b5e' : '1px solid #cbd5e1',
      background: darkMode ? '#1a1a2e' : 'white',
      color: darkMode ? 'white' : '#333',
      boxSizing: 'border-box',
      fontSize: '14px',
      marginBottom: '16px'
    },
    row: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px'
    },
    readOnlyBox: {
      background: darkMode ? '#0f172a' : '#f8fafc',
      padding: '10px 12px',
      borderRadius: '6px',
      border: darkMode ? '1px solid #1e293b' : '1px solid #e2e8f0',
      fontSize: '14px',
      color: darkMode ? '#cbd5e1' : '#475569',
      marginBottom: '16px'
    },
    toggleRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 0',
      borderBottom: darkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f1f5f9'
    },
    switch: {
      position: 'relative',
      display: 'inline-block',
      width: '46px',
      height: '24px'
    },
    slider: (checked) => ({
      position: 'absolute',
      cursor: 'pointer',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: checked ? '#ff9800' : '#ccc',
      transition: '0.3s',
      borderRadius: '24px'
    }),
    knob: (checked) => ({
      position: 'absolute',
      content: '',
      height: '18px',
      width: '18px',
      left: checked ? '24px' : '4px',
      bottom: '3px',
      backgroundColor: 'white',
      transition: '0.3s',
      borderRadius: '50%'
    })
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* 1. Profile Settings */}
      <div style={styles.card}>
        <div style={styles.title}>👤 Profile Settings</div>
        <div style={styles.row}>
          <div>
            <label style={styles.label}>Full Name</label>
            <div style={styles.readOnlyBox}>{user?.name}</div>
          </div>
          <div>
            <label style={styles.label}>Email Address</label>
            <div style={styles.readOnlyBox}>{user?.email}</div>
          </div>
        </div>
        <div>
          <label style={styles.label}>Workspace Role</label>
          <div style={{ ...styles.readOnlyBox, display: 'inline-block', minWidth: '150px' }}>{user?.role}</div>
        </div>

        {/* Change Password */}
        <form onSubmit={handlePasswordSubmit} style={{ marginTop: '20px', borderTop: darkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f1f5f9', paddingTop: '20px' }}>
          <h4 style={{ margin: '0 0 16px', color: darkMode ? '#ff9800' : '#0d1b4b', fontSize: '15px' }}>Change Account Password</h4>
          {passwordError && <div style={{ color: '#ef4444', background: '#fef2f2', padding: '8px 12px', borderRadius: '4px', marginBottom: '12px', fontSize: '13px' }}>{passwordError}</div>}
          {passwordMessage && <div style={{ color: '#22c55e', background: '#f0fdf4', padding: '8px 12px', borderRadius: '4px', marginBottom: '12px', fontSize: '13px' }}>{passwordMessage}</div>}

          <div>
            <label style={styles.label}>Current Password</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required style={styles.input} />
          </div>
          <div style={styles.row}>
            <div>
              <label style={styles.label}>New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={styles.input} />
            </div>
            <div>
              <label style={styles.label}>Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required style={styles.input} />
            </div>
          </div>
          <button type="submit" disabled={loading} style={{ background: '#ff9800', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
            {loading ? 'Updating Password...' : 'Save New Password'}
          </button>
        </form>
      </div>

      {/* 2. Appearance Settings */}
      <div style={styles.card}>
        <div style={styles.title}>🎨 Appearance Settings</div>
        <div style={styles.toggleRow}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Dark Theme Interface</div>
            <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '2px' }}>Enable dark background controls and cards.</div>
          </div>
          <div style={styles.switch} onClick={() => handleDarkModeToggle(!darkMode)}>
            <div style={styles.slider(darkMode)}>
              <div style={styles.knob(darkMode)} />
            </div>
          </div>
        </div>

        <div style={styles.toggleRow}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Theme Highlight Color</div>
            <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '2px' }}>Default dashboard highlight color.</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#ff9800', border: '2px solid white', boxShadow: '0 0 0 2px #ff9800', cursor: 'pointer' }} />
          </div>
        </div>
      </div>

      {/* 3. Notification Preferences */}
      <div style={styles.card}>
        <div style={styles.title}>🔔 Notification Preferences</div>
        
        <div style={styles.toggleRow}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Low Stock Alerts</div>
            <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '2px' }}>Receive dropdown alerts when inventory dips below minimum stock thresholds.</div>
          </div>
          <div style={styles.switch} onClick={() => handleNotifToggle('lowStock')}>
            <div style={styles.slider(notifs.lowStock)}>
              <div style={styles.knob(notifs.lowStock)} />
            </div>
          </div>
        </div>

        <div style={styles.toggleRow}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>PR Approval Notifications</div>
            <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '2px' }}>Get warnings when a purchase request is approved or rejected by Project Managers.</div>
          </div>
          <div style={styles.switch} onClick={() => handleNotifToggle('prApproval')}>
            <div style={styles.slider(notifs.prApproval)}>
              <div style={styles.knob(notifs.prApproval)} />
            </div>
          </div>
        </div>

        <div style={styles.toggleRow}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>PO Status Updates</div>
            <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '2px' }}>Monitor status changes on sent, pending, or delivered procurement orders.</div>
          </div>
          <div style={styles.switch} onClick={() => handleNotifToggle('poStatus')}>
            <div style={styles.slider(notifs.poStatus)}>
              <div style={styles.knob(notifs.poStatus)} />
            </div>
          </div>
        </div>
      </div>

      {/* 4. System Info */}
      <div style={styles.card}>
        <div style={styles.title}>⚙️ System Information</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
          <div>
            <div style={{ color: darkMode ? '#94a3b8' : '#64748b', fontWeight: '500' }}>System Version</div>
            <div style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '4px' }}>1.0.0</div>
          </div>
          <div>
            <div style={{ color: darkMode ? '#94a3b8' : '#64748b', fontWeight: '500' }}>Last Login Session</div>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>{lastLogin}</div>
          </div>
          <div>
            <div style={{ color: darkMode ? '#94a3b8' : '#64748b', fontWeight: '500' }}>Current Access Role</div>
            <div style={{ fontSize: '14px', marginTop: '4px', fontWeight: '600' }}>{user?.role}</div>
          </div>
          <div>
            <div style={{ color: darkMode ? '#94a3b8' : '#64748b', fontWeight: '500' }}>Current Session Started</div>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>{sessionStart}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
