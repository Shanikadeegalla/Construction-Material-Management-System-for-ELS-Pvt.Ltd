import React, { useState, useEffect, useRef } from 'react';
import { formatPhoneInput, isValidPhone, PHONE_PLACEHOLDER } from '../utils/phoneUtils';
import { API_BASE } from '../config';

const SettingsPage = ({ user, onLogout, onUserUpdate }) => {
  const fileInputRef = useRef(null);
  const [imgError, setImgError] = useState(false);

  // Load User state or fallback to defaults
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');

  // Helper to convert relative server upload path to absolute URL
  const getAvatarSrc = (url) => {
    if (!url) return null;
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${API_BASE}${cleanPath}`;
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

  const [darkMode, setDarkMode] = useState(
    localStorage.getItem('cmms_dark_mode') === 'true' || user?.settings?.system?.darkMode || false
  );

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status message, shown inside the card it belongs to: { section, type: 'error' | 'success', text }
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);

  const applyDarkModeClass = (isDark) => {
    if (isDark) {
      document.body.classList.add('dark-mode');
      document.documentElement.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
      document.documentElement.classList.remove('dark-mode');
    }
  };

  // Handle dark mode toggle
  const handleDarkModeToggle = async (checked) => {
    setDarkMode(checked);
    localStorage.setItem('cmms_dark_mode', checked);
    applyDarkModeClass(checked);
    // Update preference in DB
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`${API_BASE}/api/auth/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ settings: { system: { darkMode: checked } } })
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
    setNotice(null);
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`${API_BASE}/api/auth/upload-avatar`, {
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
        const updateRes = await fetch(`${API_BASE}/api/auth/users/${user._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ avatarUrl: uploadedPath })
        });
        const updateData = await updateRes.json();
        if (updateRes.ok && updateData.success) {
          setNotice({ section: 'account', type: 'success', text: '✅ Profile picture uploaded & saved successfully!' });
          if (onUserUpdate) onUserUpdate({ ...updateData.data, avatarUrl: uploadedPath });
        } else {
          setNotice({ section: 'account', type: 'success', text: '✅ Profile picture uploaded successfully!' });
          if (onUserUpdate) onUserUpdate({ ...user, avatarUrl: uploadedPath });
        }
      } else {
        setNotice({ section: 'account', type: 'error', text: data.message || 'Avatar upload failed.' });
      }
    } catch (err) {
      console.error(err);
      setNotice({ section: 'account', type: 'error', text: 'Connection error occurred while uploading picture.' });
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
    setNotice(null);
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const updateRes = await fetch(`${API_BASE}/api/auth/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ avatarUrl: '' })
      });
      const updateData = await updateRes.json();
      if (updateRes.ok && updateData.success) {
        setNotice({ section: 'account', type: 'success', text: '✅ Profile picture removed.' });
        if (onUserUpdate) onUserUpdate({ ...updateData.data, avatarUrl: '' });
      }
    } catch (err) {
      console.error('Error removing avatar:', err);
    }
  };

  // Profile fields saving handler
  const handleSaveProfileInfo = async (e) => {
    e.preventDefault();
    setNotice(null);
    if (phone && !isValidPhone(phone)) {
      setNotice({ section: 'account', type: 'error', text: `Phone number must be a 10-digit number, e.g. ${PHONE_PLACEHOLDER}.` });
      return;
    }
    setLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      // The sidebar/header and business fields (requestedBy, approvedBy, createdBy, etc.)
      // across the app read `user.name`, not firstName/lastName, so keep it in sync.
      const combinedName = `${firstName} ${lastName}`.trim();
      const res = await fetch(`${API_BASE}/api/auth/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ firstName, lastName, phone, name: combinedName || undefined })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotice({ section: 'account', type: 'success', text: '✅ Account information saved successfully!' });
        if (onUserUpdate) {
          onUserUpdate(data.data);
        }
      } else {
        setNotice({ section: 'account', type: 'error', text: data.message || 'Profile update failed.' });
      }
    } catch (err) {
      setNotice({ section: 'account', type: 'error', text: 'Connection error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  // Password update submitter
  const handleSavePassword = async (e) => {
    e.preventDefault();
    setNotice(null);
    const isStrong = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword) && /[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword);
    if (!isStrong) {
      setNotice({ section: 'security', type: 'error', text: 'New password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotice({ section: 'security', type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem('user'))?.token;
      const res = await fetch(`${API_BASE}/api/auth/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setNotice({ section: 'security', type: 'success', text: '✅ Password changed successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setNotice({ section: 'security', type: 'error', text: data.message || 'Failed to change password.' });
      }
    } catch (err) {
      setNotice({ section: 'security', type: 'error', text: 'Connection error occurred.' });
    } finally {
      setLoading(false);
    }
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
      padding: '14px 0'
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
    primaryButton: {
      background: '#2563eb',
      color: 'white',
      border: 'none',
      padding: '10px 20px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontWeight: '600',
      fontSize: '14px'
    }
  };

  const renderNotice = (section) => {
    if (!notice || notice.section !== section) return null;
    const isError = notice.type === 'error';
    return (
      <div style={{
        color: isError ? '#ef4444' : '#22c55e',
        background: isError ? (darkMode ? '#451a1a' : '#fef2f2') : (darkMode ? '#143520' : '#f0fdf4'),
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '20px',
        fontSize: '14px',
        border: isError ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(34,197,94,0.2)'
      }}>
        {notice.text}
      </div>
    );
  };

  return (
    <div className="settings-no-invert" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Account info card */}
      <div style={styles.card}>
        <div style={styles.title}>👤 Account Information</div>
        {renderNotice('account')}

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

          <button type="submit" disabled={loading} style={styles.primaryButton}>
            Save Account Information
          </button>
        </form>
      </div>

      {/* Change Password card */}
      <div style={styles.card}>
        <div style={styles.title}>🔒 Change Password</div>
        {renderNotice('security')}

        <form onSubmit={handleSavePassword}>
          <div>
            <label style={styles.label}>Current password</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required placeholder="Current password" autoComplete="current-password" style={styles.input} />
          </div>

          <div style={styles.row}>
            <div>
              <label style={styles.label}>New password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="New password" autoComplete="new-password" style={styles.input} />
            </div>

            <div>
              <label style={styles.label}>Confirm password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Confirm new password" autoComplete="new-password" style={styles.input} />
            </div>
          </div>

          <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '16px' }}>
            At least 8 characters, with uppercase, lowercase, a number, and a special character.
          </div>

          <button type="submit" disabled={loading} style={styles.primaryButton}>
            Change Password
          </button>
        </form>
      </div>

      {/* Appearance card */}
      <div style={styles.card}>
        <div style={styles.title}>🎨 Appearance</div>
        <div style={styles.toggleRow}>
          <div>
            <div style={{ fontWeight: '600', fontSize: '14px' }}>Dark Mode</div>
            <div style={{ fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '2px' }}>Switch the workspace to a dark color theme.</div>
          </div>
          <div style={styles.switch} onClick={() => handleDarkModeToggle(!darkMode)}>
            <div style={styles.slider(darkMode)}>
              <div style={styles.knob(darkMode)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
