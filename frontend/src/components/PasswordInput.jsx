import React, { useState } from 'react';

export function PasswordInput({
  value,
  onChange,
  placeholder = 'Enter password',
  required = false,
  disabled = false,
  id,
  name,
  className = '',
  style = {},
  inputStyle = {},
  autoComplete = 'current-password',
  minLength,
  ariaLabel = 'Password',
  ...rest
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div
      className={`password-input-wrapper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        boxSizing: 'border-box',
        ...style
      }}
    >
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        id={id}
        name={name}
        autoComplete={autoComplete}
        minLength={minLength}
        aria-label={ariaLabel}
        style={{
          width: '100%',
          paddingRight: '42px',
          boxSizing: 'border-box',
          ...inputStyle
        }}
        {...rest}
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setShowPassword(prev => !prev)}
        tabIndex="-1"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        title={showPassword ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          padding: '6px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: showPassword ? 'var(--primary-dark-green, #1b4332)' : '#6c757d',
          borderRadius: '4px',
          lineHeight: 1,
          zIndex: 2,
          transition: 'color 0.15s ease'
        }}
      >
        {showPassword ? (
          /* Eye Open / Showing icon */
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
        ) : (
          /* Eye Off / Hidden icon */
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        )}
      </button>
    </div>
  );
}
