import React from 'react';

/**
 * Reusable Button component that handles loading state, spinner, double-click prevention.
 */
const LoadingButton = ({
  loading = false,
  loadingText = 'Processing...',
  children,
  onClick,
  disabled = false,
  style = {},
  className = '',
  type = 'button',
  variant = 'primary', // 'primary' | 'success' | 'danger' | 'warning' | 'secondary'
  ...props
}) => {
  const variantStyles = {
    primary: { background: '#0d1b4b', color: 'white' },
    success: { background: '#2e7d32', color: 'white' },
    danger: { background: '#c62828', color: 'white' },
    warning: { background: '#d97706', color: 'white' },
    secondary: { background: '#64748b', color: 'white' }
  };

  const currentVariantStyle = variantStyles[variant] || variantStyles.primary;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '8px 16px',
        borderRadius: '6px',
        border: 'none',
        fontSize: '13px',
        fontWeight: '600',
        cursor: (disabled || loading) ? 'not-allowed' : 'pointer',
        opacity: (disabled || loading) ? 0.7 : 1,
        transition: 'all 0.2s',
        ...currentVariantStyle,
        ...style
      }}
      {...props}
    >
      {loading ? (
        <>
          <span
            style={{
              width: '12px',
              height: '12px',
              border: '2px solid rgba(255,255,255,0.4)',
              borderTopColor: 'white',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'btnSpin 0.6s linear infinite'
            }}
          />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default LoadingButton;
