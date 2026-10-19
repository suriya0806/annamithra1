import React from 'react';

export function Alert({ type = 'info', message, onDismiss }) {
  if (!message) return null;

  return (
    <div className={`notice ${type}`}>
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          className="secondary small"
          onClick={onDismiss}
          style={{ padding: '2px 8px', minHeight: 'auto', border: 0, background: 'transparent', cursor: 'pointer' }}
          title="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}
