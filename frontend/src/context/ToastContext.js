import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  playNotificationSound,
  requestDesktopNotificationPermission,
  triggerDesktopWebNotification
} from '../utils/notificationAlert';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    // Automatically request desktop notification permissions on application load
    requestDesktopNotificationPermission();
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000, options = {}) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    const { title = 'ELS CMMS Alert', sound = false, desktop = false } = options;
    
    setToasts(prev => [...prev, { id, message, type, title }]);

    // Play subtle audio chime if requested or for system alert/notify types
    if (sound || options.playChime) {
      playNotificationSound();
    }

    // Trigger Native Desktop Web Notification if requested or tab is in background
    if (desktop || options.desktopNotif) {
      triggerDesktopWebNotification({
        title,
        body: message
      });
    }

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const notifyAlert = useCallback(({ title = 'New Notification', message = '', type = 'info', duration = 6000 }) => {
    // Desktop focused notification: sound + native desktop notification + animated floating toast
    playNotificationSound();
    triggerDesktopWebNotification({ title, body: message });
    return addToast(message, type, duration, { title });
  }, [addToast]);

  const toast = useCallback({
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    loading: (msg) => addToast(msg, 'loading', 0),
    notify: (message, title = 'ELS CMMS Notification', type = 'info', dur = 6000) => notifyAlert({ title, message, type, duration: dur }),
    playChime: playNotificationSound,
    requestPermission: requestDesktopNotificationPermission,
    dismiss: removeToast
  }, [addToast, removeToast, notifyAlert]);

  return (
    <ToastContext.Provider value={{ toast, toasts, removeToast, notifyAlert }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if component is rendered outside ToastProvider
    return {
      success: (msg) => alert(`[SUCCESS] ${msg}`),
      error: (msg) => alert(`[ERROR] ${msg}`),
      info: (msg) => alert(`[INFO] ${msg}`),
      warning: (msg) => alert(`[WARNING] ${msg}`),
      loading: () => 'fallback-id',
      notify: (msg, title) => {
        playNotificationSound();
        triggerDesktopWebNotification({ title, body: msg });
      },
      playChime: playNotificationSound,
      requestPermission: requestDesktopNotificationPermission,
      dismiss: () => {}
    };
  }
  return context.toast;
};

const ToastContainer = ({ toasts, onDismiss }) => {
  if (!toasts || toasts.length === 0) return null;

  const typeStyles = {
    success: { bg: '#10b981', color: 'white', icon: '✅' },
    error: { bg: '#ef4444', color: 'white', icon: '❌' },
    warning: { bg: '#f59e0b', color: 'white', icon: '⚠️' },
    info: { bg: '#2563eb', color: 'white', icon: 'ℹ️' },
    loading: { bg: '#0d1b4b', color: 'white', icon: '⏳' }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '420px',
        width: 'calc(100vw - 40px)',
        pointerEvents: 'none'
      }}
    >
      {toasts.map(t => {
        const style = typeStyles[t.type] || typeStyles.info;
        return (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto',
              background: style.bg,
              color: style.color,
              padding: '12px 16px',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: '13px',
              fontWeight: '600',
              fontFamily: 'Inter, system-ui, sans-serif',
              animation: 'toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <span style={{ fontSize: '16px' }}>{style.icon}</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {t.title && t.title !== 'ELS CMMS Alert' && (
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9, fontWeight: 700 }}>{t.title}</span>
                )}
                <span style={{ wordBreak: 'break-word', lineHeight: '1.4' }}>{t.message}</span>
              </div>
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                opacity: 0.8,
                cursor: 'pointer',
                fontSize: '14px',
                padding: '2px 4px',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
};
