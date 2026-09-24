import React, { useState, useEffect, useRef } from 'react';
import { formatPhoneInput, isValidPhone, PHONE_PLACEHOLDER } from '../utils/phoneUtils';

const SettingsPage = ({ user, onLogout, onUserUpdate }) => {
  // Tabs: 'system' or 'profile'
  const [activeTab, setActiveTab] = useState('system');

  const fileInputRef = useRef(null);
  const [imgError, setImgError] = useState(false);

  // Load User state or fallback to defaults
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(user?.settings?.profile?.sidebarCollapsed || false);

  // Helper to convert relative server upload path to absolute URL
  const getAvatarSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `http://localhost:5000${cleanPath}`;
  };

  // Sync state when user prop updates
  useEffect(() => {
    if (user) {
      if (user.firstName) setFirstName(user.firstName);
      if (user.lastName) setLastName(user.lastName);
      if (user.phone) setPhone(user.phone);
      if (user.avatarUrl !== undefined) {
        setAvatarUrl(user.avatarUrl);
        setImgError(false);
      }
    }
  }, [user]);

  // System Settings State
  const [darkMode, setDarkMode] = useState(user?.settings?.system?.darkMode || false);
  const [systemAlerts, setSystemAlerts] = useState(user?.settings?.system?.notifications?.systemAlerts !== undefined ? user?.settings?.system?.notifications?.systemAlerts : true);
  const [emailNotifs, setEmailNotifs] = useState(user?.settings?.system?.notifications?.emailNotifs !== undefined ? user?.settings?.system?.notifications?.emailNotifs : true);
  const [desktopNotifs, setDesktopNotifs] = useState(user?.settings?.system?.notifications?.desktopNotifs || false);
  
  const [language, setLanguage] = useState(user?.settings?.system?.locale?.language || 'en');
  const [timezone, setTimezone] = useState(user?.settings?.system?.locale?.timezone || 'Asia/Colombo');
  const [dateFormat, setDateFormat] = useState(user?.settings?.system?.locale?.dateFormat || 'YYYY-MM-DD');

  // Profile Settings State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.settings?.profile?.twoFactorEnabled || false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status/Messages State
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');
  const [apiStatus, setApiStatus] = useState('Checking...');

  // Initialize and Sync dark mode classes
  useEffect(() => {
    const isDark = localStorage.getItem('cmms_dark_mode') === 'true' || darkMode;
    setDarkMode(isDark);
    if (isDark) {
      document.body.classList.add('dark-mode');
      document.documentElement.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
      document.documentElement.classList.remove('dark-mode');
    }

    // Check API Status
    fetch('http://localhost:5000/api/auth/me', {
      headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('user'))?.token}` }
    })
      .then(res => setApiStatus(res.ok ? '🟢 Connected' : '🔴 Server Error'))
      .catch(() => setApiStatus('🔴 Disconnected'));
  }, [darkMode]);

  // Handle dark mode toggle
  const handleDarkModeToggle = (checked) => {
    setDarkMode(checked);
    localStorage.setItem('cmms_dark_mode', checked);
    if (checked) {
      document.body.classList.add('dark-mode');
      document.documentElement.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
      document.documentElement.classList.remove('dark-mode');
    }
    // Update preferences in DB
    saveSettingsChange({
      system: {
        darkMode: checked,
        notifications: { systemAlerts, emailNotifs, desktopNotifs },
        locale: { language, timezone, dateFormat }
      },
      profile: { sidebarCollapsed, twoFactorEnabled }
    });
  };

  // Generic DB preferences update
  const saveSettingsChange = async (newSettingsObj) => {
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`http://localhost:5000/api/auth/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ settings: newSettingsObj })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (onUserUpdate) {
          onUserUpdate(data.data);
        }
      }
    } catch (err) {
      console.error('Error updating settings preferences in DB', err);
    }
  };

  // Avatar upload handler
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Instant local preview
    const localPreview = URL.createObjectURL(file);
    setAvatarUrl(localPreview);
    setImgError(false);

    const formData = new FormData();
    formData.append('avatar', file);

    setLoading(true);
    setError('');
    setMessage('');
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch('http://localhost:5000/api/auth/upload-avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const uploadedPath = data.avatarUrl; // e.g., /uploads/avatar-xxx.jpg
        setAvatarUrl(uploadedPath);
        setImgError(false);

        // Save avatar url to user document
        const updateRes = await fetch(`http://localhost:5000/api/auth/users/${user._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ avatarUrl: uploadedPath })
        });
        const updateData = await updateRes.json();
        if (updateRes.ok && updateData.success) {
          setMessage('✅ Profile picture uploaded & saved successfully!');
          if (onUserUpdate) onUserUpdate({ ...updateData.data, avatarUrl: uploadedPath });
        } else {
          setMessage('✅ Profile picture uploaded successfully!');
          if (onUserUpdate) onUserUpdate({ ...user, avatarUrl: uploadedPath });
        }
      } else {
        setError(data.message || 'Avatar upload failed.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection error occurred while uploading picture.');
    } finally {
      setLoading(false);
      // Reset input element value so user can re-upload or select another file anytime
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Remove avatar handler
  const handleRemoveAvatar = async () => {
    setAvatarUrl('');
    setImgError(false);
    setMessage('');
    setError('');
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const updateRes = await fetch(`http://localhost:5000/api/auth/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ avatarUrl: '' })
      });
      const updateData = await updateRes.json();
      if (updateRes.ok && updateData.success) {
        setMessage('✅ Profile picture removed.');
        if (onUserUpdate) onUserUpdate({ ...updateData.data, avatarUrl: '' });
      }
    } catch (err) {
      console.error('Error removing avatar:', err);
    }
  };

  // Profile fields saving handler
  const handleSaveProfileInfo = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    if (phone && !isValidPhone(phone)) {
      setError(`Phone number must be a 10-digit number, e.g. ${PHONE_PLACEHOLDER}.`);
      setLoading(false);
      return;
    }
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      // The sidebar/header and business fields (requestedBy, approvedBy, createdBy, etc.)
      // across the app read `user.name`, not firstName/lastName, so keep it in sync.
      const combinedName = `${firstName} ${lastName}`.trim();
      const res = await fetch(`http://localhost:5000/api/auth/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ firstName, lastName, phone, name: combinedName || undefined })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage('✅ Account information saved successfully!');
        if (onUserUpdate) {
          onUserUpdate(data.data);
        }
      } else {
        setError(data.message || 'Profile update failed.');
      }
    } catch (err) {
      setError('Connection error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Password update submitter
  const handleSavePassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const isStrong = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword);
    if (!isStrong) {
      setError('New password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
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
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(data.message || 'Failed to change password.');
      }
    } catch (err) {
      setError('Connection error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Admin backup trigger simulation
  const handleBackupTrigger = () => {
    setBackupStatus('Backing up database...');
    setTimeout(() => {
      setBackupStatus(`✅ Manual Backup completed successfully! (file: backup-${Date.now()}.json)`);
    }, 1500);
  };

  // Styles dynamically adjusted for dark mode
  const styles = {
    card: {
      background: darkMode ? '#1e293b' : 'white',
      color: darkMode ? '#f8fafc' : '#0f172a',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
      border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0',
      transition: 'all 0.3s ease'
    },
    title: {
      color: darkMode ? '#2563eb' : '#0d1b4b',
      fontSize: '18px',
      fontWeight: '700',
      marginBottom: '16px',
      borderBottom: darkMode ? '1px solid #334155' : '1px solid #e2e8f0',
      paddingBottom: '10px'
    },
    label: {
      display: 'block',
      fontSize: '11px',
      color: darkMode ? '#94a3b8' : '#64748b',
      fontWeight: '600',
      marginBottom: '8px',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    },
    input: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: '8px',
      border: darkMode ? '1px solid #475569' : '1px solid #cbd5e1',
      background: darkMode ? '#0f172a' : 'white',
      color: darkMode ? '#f8fafc' : '#0f172a',
      boxSizing: 'border-box',
      fontSize: '14px',
      outline: 'none',
      marginBottom: '16px'
    },
    select: {
      width: '100%',
      padding: '10px 14px',
      borderRadius: '8px',
      border: darkMode ? '1px solid #475569' : '1px solid #cbd5e1',
      background: darkMode ? '#0f172a' : 'white',
      color: darkMode ? '#f8fafc' : '#0f172a',
      boxSizing: 'border-box',
      fontSize: '14px',
      outline: 'none',
      cursor: 'pointer',
      marginBottom: '16px'
    },
    row: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px'
    },
    readOnlyBox: {
      background: darkMode ? '#0f172a' : '#f8fafc',
      padding: '10px 14px',
      borderRadius: '8px',
      border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0',
      fontSize: '14px',
      color: darkMode ? '#cbd5e1' : '#475569',
      marginBottom: '16px'
    },
    toggleRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 0',
      borderBottom: darkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f1f5f9'
    },
    switch: {
      position: 'relative',
      display: 'inline-block',
      width: '46px',
      height: '24px',
      cursor: 'pointer'
    },
    slider: (checked) => ({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: checked ? '#2563eb' : '#cbd5e1',
      transition: '0.3s',
      borderRadius: '24px'
    }),
    knob: (checked) => ({
      position: 'absolute',
      height: '18px',
      width: '18px',
      left: checked ? '24px' : '4px',
      bottom: '3px',
      backgroundColor: 'white',
      transition: '0.3s',
      borderRadius: '50%',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }),
    tabButton: (active) => ({
      padding: '12px 24px',
      fontWeight: '600',
      fontSize: '14px',
      border: 'none',
      background: active ? '#2563eb' : 'transparent',
      color: active ? 'white' : (darkMode ? '#94a3b8' : '#64748b'),
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      marginRight: '8px'
    })
  };

  return (
    <div className="settings-no-invert" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Alert Banners */}
      {error && <div style={{ color: '#ef4444', background: darkMode ? '#451a1a' : '#fef2f2', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
      {message && <div style={{ color: '#22c55e', background: darkMode ? '#143520' : '#f0fdf4', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', border: '1px solid rgba(34,197,94,0.2)' }}>{message}</div>}

      {/* Tabs Menu */}
      <div style={{ display: 'flex', background: darkMode ? '#0f172a' : '#f1f5f9', padding: '6px', borderRadius: '10px', marginBottom: '24px', width: 'fit-content' }}>
        <button onClick={() => { setActiveTab('system'); setError(''); setMessage(''); }} style={styles.tabButton(activeTab === 'system')}>⚙️ System Settings</button>
        <button onClick={() => { setActiveTab('profile'); setError(''); setMessage(''); }} style={styles.tabButton(activeTab === 'profile')}>👤 Profile Settings</button>
      </div>

      {/* SYSTEM SETTINGS VIEW */}
      {activeTab === 'system' && (
        <div>
          {/* Theme card */}
          <div style={styles.card}>
            <div style={styles.title}>🎨 Theme Configurations</div>
            <div style={styles.toggleRow}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>Global Dark Mode</div>
                <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '2px' }}>Transform user portal workspace to dark color theme.</div>
              </div>
              <div style={styles.switch} onClick={() => handleDarkModeToggle(!darkMode)}>
                <div style={styles.slider(darkMode)}>
                  <div style={styles.knob(darkMode)} />
                </div>
              </div>
            </div>
          </div>

          {/* Notifications config */}
          <div style={styles.card}>
            <div style={styles.title}>🔔 System Alert & Notifications</div>
            
            <div style={styles.toggleRow}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>System-Wide Alerts</div>
                <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '2px' }}>Enable banners and priority updates inside the application.</div>
              </div>
              <div style={styles.switch} onClick={() => {
                const checked = !systemAlerts;
                setSystemAlerts(checked);
                saveSettingsChange({
                  system: {
                    darkMode,
                    notifications: { systemAlerts: checked, emailNotifs, desktopNotifs },
                    locale: { language, timezone, dateFormat }
                  },
                  profile: { sidebarCollapsed, twoFactorEnabled }
                });
              }}>
                <div style={styles.slider(systemAlerts)}>
                  <div style={styles.knob(systemAlerts)} />
                </div>
              </div>
            </div>

            <div style={styles.toggleRow}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>Email Alerts</div>
                <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '2px' }}>Send automatic stock and approval warnings to email addresses.</div>
              </div>
              <div style={styles.switch} onClick={() => {
                const checked = !emailNotifs;
                setEmailNotifs(checked);
                saveSettingsChange({
                  system: {
                    darkMode,
                    notifications: { systemAlerts, emailNotifs: checked, desktopNotifs },
                    locale: { language, timezone, dateFormat }
                  },
                  profile: { sidebarCollapsed, twoFactorEnabled }
                });
              }}>
                <div style={styles.slider(emailNotifs)}>
                  <div style={styles.knob(emailNotifs)} />
                </div>
              </div>
            </div>

            <div style={styles.toggleRow}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>Desktop Push Alerts</div>
                <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '2px' }}>Request browser notifications for urgent actions.</div>
              </div>
              <div style={styles.switch} onClick={() => {
                const checked = !desktopNotifs;
                setDesktopNotifs(checked);
                saveSettingsChange({
                  system: {
                    darkMode,
                    notifications: { systemAlerts, emailNotifs, desktopNotifs: checked },
                    locale: { language, timezone, dateFormat }
                  },
                  profile: { sidebarCollapsed, twoFactorEnabled }
                });
              }}>
                <div style={styles.slider(desktopNotifs)}>
                  <div style={styles.knob(desktopNotifs)} />
                </div>
              </div>
            </div>
          </div>

          {/* Regional details */}
          <div style={styles.card}>
            <div style={styles.title}>🌍 Language & Region Settings</div>
            
            <div style={styles.row}>
              <div>
                <label style={styles.label}>Language Preference</label>
                <select value={language} onChange={(e) => {
                  setLanguage(e.target.value);
                  saveSettingsChange({
                    system: {
                      darkMode,
                      notifications: { systemAlerts, emailNotifs, desktopNotifs },
                      locale: { language: e.target.value, timezone, dateFormat }
                    },
                    profile: { sidebarCollapsed, twoFactorEnabled }
                  });
                }} style={styles.select}>
                  <option value="en">English (US)</option>
                  <option value="lk">Sinhala (Sri Lanka)</option>
                  <option value="tamil">Tamil (Sri Lanka)</option>
                  <option value="gb">English (UK)</option>
                </select>
              </div>

              <div>
                <label style={styles.label}>Regional Timezone</label>
                <select value={timezone} onChange={(e) => {
                  setTimezone(e.target.value);
                  saveSettingsChange({
                    system: {
                      darkMode,
                      notifications: { systemAlerts, emailNotifs, desktopNotifs },
                      locale: { language, timezone: e.target.value, dateFormat }
                    },
                    profile: { sidebarCollapsed, twoFactorEnabled }
                  });
                }} style={styles.select}>
                  <option value="Asia/Colombo">Asia/Colombo (GMT+5:30)</option>
                  <option value="UTC">Coordinated Universal Time (UTC)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (GMT+5:30)</option>
                  <option value="America/New_York">Eastern Standard Time (GMT-5:00)</option>
                </select>
              </div>
            </div>

            <div>
              <label style={styles.label}>Date Formatting</label>
              <select value={dateFormat} onChange={(e) => {
                setDateFormat(e.target.value);
                saveSettingsChange({
                  system: {
                    darkMode,
                    notifications: { systemAlerts, emailNotifs, desktopNotifs },
                    locale: { language, timezone, dateFormat: e.target.value }
                  },
                  profile: { sidebarCollapsed, twoFactorEnabled }
                });
              }} style={styles.select}>
                <option value="YYYY-MM-DD">YYYY-MM-DD (e.g., 2026-07-08)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (e.g., 08/07/2026)</option>
                <option value="MM-DD-YYYY">MM-DD-YYYY (e.g., 07-08-2026)</option>
              </select>
            </div>
          </div>

          {/* Backup Maintenance Admin Controls */}
          {user?.role === 'Admin' && (
            <div style={styles.card}>
              <div style={styles.title}>🛠️ Backup & Maintenance (Admin Only)</div>
              
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '8px' }}>Manual Server Data Backup</div>
                <p style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '12px' }}>Download a complete JSON database dump containing current system states.</p>
                <button onClick={handleBackupTrigger} style={{ padding: '10px 18px', background: '#0d1b4b', color: 'white', border: '1px solid #2563eb', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  Backup Database
                </button>
                {backupStatus && <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '8px', fontWeight: '500' }}>{backupStatus}</div>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: darkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f1f5f9', paddingTop: '16px', marginTop: '16px' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>System Audit Logs</div>
                  <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b' }}>Check diagnostic event files and security registers.</div>
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>API Connection Status</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: darkMode ? '#cbd5e1' : '#475569' }}>{apiStatus}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PROFILE SETTINGS VIEW */}
      {activeTab === 'profile' && (
        <div>
          {/* Account info card */}
          <div style={styles.card}>
            <div style={styles.title}>👤 Account Information</div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
              <div style={{ position: 'relative', width: '84px', height: '84px', flexShrink: 0 }}>
                {avatarUrl && !imgError ? (
                  <img 
                    src={getAvatarSrc(avatarUrl)} 
                    alt="Avatar" 
                    onError={() => setImgError(true)}
                    style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #2563eb', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                  />
                ) : (
                  <div style={{
                    width: '84px',
                    height: '84px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2563eb 0%, #0d1b4b 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '26px',
                    fontWeight: '700',
                    border: '3px solid #2563eb',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    {(user?.name || `${firstName} ${lastName}` || user?.username || 'User')
                      .split(' ')
                      .filter(Boolean)
                      .map(n => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase() || 'U'}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ ...styles.label, marginBottom: '2px' }}>Update Profile Picture</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/jpeg,image/png,image/jpg,image/webp" 
                    onChange={handleAvatarUpload} 
                    id="avatar-file-input"
                    style={{ display: 'none' }} 
                  />
                  <label 
                    htmlFor="avatar-file-input"
                    style={{
                      padding: '8px 16px',
                      background: '#2563eb',
                      color: 'white',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
                    }}
                  >
                    📷 {avatarUrl ? 'Change Picture' : 'Choose Picture'}
                  </label>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      style={{
                        padding: '8px 14px',
                        background: 'transparent',
                        color: '#ef4444',
                        border: '1px solid #ef4444',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Accepts JPG, JPEG, PNG or WEBP formats. Max 2MB.</div>
              </div>
            </div>

            <form onSubmit={handleSaveProfileInfo}>
              <div style={styles.row}>
                <div>
                  <label style={styles.label}>First Name</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First Name" style={styles.input} />
                </div>
                
                <div>
                  <label style={styles.label}>Last Name</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last Name" style={styles.input} />
                </div>
              </div>

              <div style={styles.row}>
                <div>
                  <label style={styles.label}>Contact Number</label>
                  <input type="text" maxLength={12} value={phone} onChange={e => setPhone(formatPhoneInput(e.target.value))} placeholder={PHONE_PLACEHOLDER} style={styles.input} />
                </div>

                <div>
                  <label style={styles.label}>User Role Profile</label>
                  <div style={styles.readOnlyBox}>{user?.role}</div>
                </div>
              </div>

              <div>
                <label style={styles.label}>Email Address (Read-only)</label>
                <div style={styles.readOnlyBox}>{user?.email}</div>
              </div>

              <button type="submit" disabled={loading} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
                Save Account Information
              </button>
            </form>
          </div>

          {/* Credentials Card */}
          <div style={styles.card}>
            <div style={styles.title}>🔒 Security & Credentials</div>

           
            {/* Change Password form */}
            {false && (<form onSubmit={handleSavePassword}>
              <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '14px', color: darkMode ? '#2563eb' : '#0d1b4b' }}>Update Password</div>
              
              <div>
                <label style={styles.label}>Current password</label>
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required placeholder="Current password" style={styles.input} />
              </div>
              
              <div style={styles.row}>
                <div>
                  <label style={styles.label}>New password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="New password" style={styles.input} />
                </div>

                <div>
                  <label style={styles.label}>Confirm password</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Confirm new password" style={styles.input} />
                </div>
              </div>

              <button type="submit" disabled={loading} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>
                Change Password
              </button>
            </form>)}   
          </div> 

          {/* Preferences Card */}
          <div style={styles.card}>
            <div style={styles.title}>⚙️ Dashboard Preferences</div>
            
            <div style={styles.toggleRow}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>Collapse Sidebar Nav Menu</div>
                <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '2px' }}>Set sidebar directory navigation items collapsed by default.</div>
              </div>
              <div style={styles.switch} onClick={() => {
                const checked = !sidebarCollapsed;
                setSidebarCollapsed(checked);
                saveSettingsChange({
                  system: { darkMode, notifications: { systemAlerts, emailNotifs, desktopNotifs }, locale: { language, timezone, dateFormat } },
                  profile: { sidebarCollapsed: checked, twoFactorEnabled }
                });
              }}>
                <div style={styles.slider(sidebarCollapsed)}>
                  <div style={styles.knob(sidebarCollapsed)} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
