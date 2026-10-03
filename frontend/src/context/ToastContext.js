import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);

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

  const toast = useCallback({
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    loading: (msg) => addToast(msg, 'loading', 0),
    dismiss: removeToast
  }, [addToast, removeToast]);

  return (
    <ToastContext.Provider value={{ toast, toasts, removeToast }}>
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
              justify: 'space-between',
              gap: '12px',
              fontSize: '13px',
              fontWeight: '600',
              fontFamily: 'Inter, system-ui, sans-serif',
              animation: 'toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <span style={{ fontSize: '16px' }}>{style.icon}</span>
              <span style={{ wordBreak: 'break-word', lineHeight: '1.4' }}>{t.message}</span>
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
