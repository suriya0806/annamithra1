import React from 'react';
import { sanitizeErrorMessage } from '../api';

export function Alert({ type = 'info', message, onDismiss }) {
  if (!message) return null;

  const displayMessage = type === 'error' ? sanitizeErrorMessage(message) : message;

  return (
    <div className={`notice ${type}`}>
      <span>{displayMessage}</span>
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
