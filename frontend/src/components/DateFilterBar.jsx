import React, { useState } from 'react';
import { getTodayDateString, formatDateLabel, toLocalDateString } from '../utils/dateGrouping';
import { useLanguage } from '../i18n/LanguageContext';

/**
 * Helper to format date as DD/MM/YYYY
 */
function formatDDMMYYYY(dStr) {
  if (!dStr) return '';
  const clean = toLocalDateString(dStr);
  if (!clean) return '';
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
}

/**
 * Standardized Date Filter Bar across Annamithra reports and portals.
 * Strictly supports exactly two date filter modes:
 * 1. Today
 * 2. Custom Range (From Date – To Date) with Apply Filter button
 * "All Dates" and single-date-only filters are removed.
 */
export default function DateFilterBar({
  label,
  selectedDate,
  onDateChange,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onApplyRange,
  totalCount,
  extraControls
}) {
  const { language, t } = useLanguage();
  const today = getTodayDateString();
  const displayLabel = label ? t(label) : t('Date Filter');

  // Internal mode: 'today' | 'custom'
  const isInitiallyCustom = Boolean((fromDate && fromDate !== today) || (toDate && toDate !== today));
  const [mode, setMode] = useState(isInitiallyCustom ? 'custom' : 'today');

  // Local state for Custom Range inputs
  const [localFrom, setLocalFrom] = useState(fromDate || selectedDate || today);
  const [localTo, setLocalTo] = useState(toDate || selectedDate || today);
  const [appliedRange, setAppliedRange] = useState({
    from: fromDate || (mode === 'today' ? today : localFrom),
    to: toDate || (mode === 'today' ? today : localTo)
  });
  const [rangeError, setRangeError] = useState(null);

  const handleSelectToday = () => {
    setMode('today');
    setRangeError(null);
    setLocalFrom(today);
    setLocalTo(today);
    setAppliedRange({ from: today, to: today });
    if (onFromDateChange) onFromDateChange(today);
    if (onToDateChange) onToDateChange(today);
    if (onDateChange) onDateChange(today);
    if (onApplyRange) onApplyRange(today, today);
  };

  const handleSelectCustomMode = () => {
    setMode('custom');
  };

  const handleApplyFilter = () => {
    if (!localFrom || !localTo) {
      setRangeError(language === 'ta'
        ? 'தொடக்க தேதி மற்றும் முடிவு தேதி இரண்டையும் தேர்ந்தெடுக்கவும்.'
        : 'Please select both From Date and To Date.');
      return;
    }
    if (localFrom > localTo) {
      setRangeError(language === 'ta'
        ? 'தொடக்க தேதி முடிவு தேதியை விட பிந்தையதாக இருக்கக்கூடாது.'
        : 'From Date cannot be later than To Date.');
      return;
    }
    setRangeError(null);
    setAppliedRange({ from: localFrom, to: localTo });
    if (onFromDateChange) onFromDateChange(localFrom);
    if (onToDateChange) onToDateChange(localTo);
    if (onDateChange) onDateChange(localFrom);
    if (onApplyRange) onApplyRange(localFrom, localTo);
  };

  return (
    <div className="date-filter-bar" style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '10px 14px',
      background: 'var(--cream-surface, #F8F3E5)',
      border: '1px solid var(--border-color, #E5DDC9)',
      borderRadius: '8px',
      marginBottom: '16px'
    }}>
      {/* Left side: Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontWeight: '700',
            color: 'var(--primary-dark-green, #003B2B)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px'
          }}>
            📅 {displayLabel}:
          </span>

          {/* Mode Switcher: Exactly [ Today ] [ Custom Range ] */}
          <div style={{
            display: 'inline-flex',
            borderRadius: '6px',
            border: '1px solid var(--border-color, #E5DDC9)',
            overflow: 'hidden'
          }}>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'today' ? 'primary' : ''}`}
              onClick={handleSelectToday}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                borderRadius: 0,
                border: 'none',
                fontWeight: mode === 'today' ? 700 : 500
              }}
            >
              {t('Today', 'இன்று')}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'custom' ? 'primary' : ''}`}
              onClick={handleSelectCustomMode}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                borderRadius: 0,
                border: 'none',
                fontWeight: mode === 'custom' ? 700 : 500
              }}
            >
              {t('Custom Range', 'தனிப்பயன் வரம்பு')}
            </button>
          </div>

          {/* Today Indicator */}
          {mode === 'today' && (
            <span style={{
              fontSize: '12px',
              fontWeight: '600',
              background: 'var(--pale-green, #EBF4F0)',
              color: 'var(--secondary-green, #07543D)',
              border: '1px solid var(--pale-green-border, #C8DFD4)',
              padding: '4px 10px',
              borderRadius: '12px'
            }}>
              ✓ {language === 'ta' ? `இன்று (${formatDDMMYYYY(today)})` : `Today (${formatDDMMYYYY(today)})`}
            </span>
          )}

          {extraControls}
        </div>

        {/* Custom Range: From Date, To Date & Apply Filter */}
        {mode === 'custom' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>
              {t('From Date', 'தொடக்க தேதி')}:
            </label>
            <input
              type="date"
              value={localFrom || ''}
              max={localTo || undefined}
              onChange={(e) => {
                setLocalFrom(e.target.value);
                if (rangeError) setRangeError(null);
              }}
              className="date-input"
              style={{
                padding: '5px 8px',
                border: rangeError ? '1.5px solid #B3261E' : '1px solid var(--border-color, #E5DDC9)',
                borderRadius: '6px',
                background: '#fff',
                fontSize: '13px',
                color: 'var(--dark-text)'
              }}
            />
            <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>
              {t('To Date', 'முடிவு தேதி')}:
            </label>
            <input
              type="date"
              value={localTo || ''}
              min={localFrom || undefined}
              onChange={(e) => {
                setLocalTo(e.target.value);
                if (rangeError) setRangeError(null);
              }}
              className="date-input"
              style={{
                padding: '5px 8px',
                border: rangeError ? '1.5px solid #B3261E' : '1px solid var(--border-color, #E5DDC9)',
                borderRadius: '6px',
                background: '#fff',
                fontSize: '13px',
                color: 'var(--dark-text)'
              }}
            />
            <button
              type="button"
              className="btn btn-sm primary"
              onClick={handleApplyFilter}
              style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700 }}
            >
              {t('Apply Filter', 'வடிகட்டியைப் பயன்படுத்து')}
            </button>

            {appliedRange.from && appliedRange.to && (
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--primary-dark-green)' }}>
                ({formatDDMMYYYY(appliedRange.from)} – {formatDDMMYYYY(appliedRange.to)})
              </span>
            )}
          </div>
        )}

        {/* Validation Error */}
        {rangeError && (
          <div style={{ color: '#B3261E', fontSize: '12px', fontWeight: '600', marginTop: '2px' }}>
            ⚠️ {rangeError}
          </div>
        )}
      </div>

      {/* Right side: Status indicator / record counter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          fontSize: '12px',
          color: 'var(--text-muted, #4A6B5F)',
          fontWeight: '500'
        }}>
          {mode === 'today'
            ? `${t('Filtered')}: ${formatDDMMYYYY(today)}`
            : `${t('Date Range')}: ${formatDDMMYYYY(appliedRange.from)} – ${formatDDMMYYYY(appliedRange.to)}`}
        </span>
        {typeof totalCount === 'number' && (
          <span style={{
            fontSize: '11px',
            fontWeight: '600',
            background: 'var(--pale-green, #EBF4F0)',
            color: 'var(--secondary-green, #07543D)',
            border: '1px solid var(--pale-green-border, #C8DFD4)',
            padding: '3px 8px',
            borderRadius: '12px'
          }}>
            {totalCount} {totalCount === 1 ? t('record') : t('records')}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Reusable Date Section Header component for grouping
 */
export function DateSectionHeader({ label, count, date }) {
  const { t } = useLanguage();
  return (
    <div className="date-section-header" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 14px',
      margin: '20px 0 10px 0',
      background: 'linear-gradient(90deg, #F5EFE0 0%, #FAF7F0 100%)',
      borderLeft: '4px solid var(--gold, #D4A63B)',
      borderTop: '1px solid var(--border-color, #E5DDC9)',
      borderRight: '1px solid var(--border-color, #E5DDC9)',
      borderBottom: '1px solid var(--border-color, #E5DDC9)',
      borderRadius: '4px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '15px' }}>📅</span>
        <h4 style={{
          margin: 0,
          fontSize: '14px',
          fontWeight: '700',
          color: 'var(--primary-dark-green, #003B2B)'
        }}>
          {label || date || t('Date')}
        </h4>
      </div>
      {typeof count === 'number' && (
        <span style={{
          fontSize: '11px',
          fontWeight: '600',
          background: 'var(--white-surface, #fff)',
          color: 'var(--text-muted, #4A6B5F)',
          border: '1px solid var(--border-color, #E5DDC9)',
          padding: '2px 8px',
          borderRadius: '10px'
        }}>
          {count} {count === 1 ? t('item') : t('items')}
        </span>
      )}
    </div>
  );
}

/**
 * Empty date message component
 */
export function EmptyDateMessage({ date, message, onResetToday, onSelectCustomRange }) {
  const { language, t } = useLanguage();
  const dateText = date ? formatDateLabel(date, language) : (language === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட தேதி' : 'the selected date');
  return (
    <div style={{
      textAlign: 'center',
      padding: '36px 20px',
      background: 'var(--white-surface, #fff)',
      border: '1px dashed var(--border-color, #E5DDC9)',
      borderRadius: '8px',
      margin: '16px 0',
      color: 'var(--text-muted, #4A6B5F)'
    }}>
      <div style={{ fontSize: '28px', marginBottom: '8px' }}>📅</div>
      <p style={{ margin: '0 0 12px 0', fontWeight: '500', fontSize: '14px' }}>
        {message || (language === 'ta' ? `${dateText}-க்கு எந்தப் பதிவுகளும் இல்லை.` : `No records found for ${dateText}.`)}
      </p>
      <div style={{ display: 'inline-flex', gap: '10px' }}>
        {onResetToday && (
          <button type="button" className="btn btn-sm primary" onClick={onResetToday}>
            {t('Today', 'இன்று')}
          </button>
        )}
        {onSelectCustomRange && (
          <button type="button" className="btn btn-sm" onClick={onSelectCustomRange}>
            {t('Custom Range', 'தனிப்பயன் வரம்பு')}
          </button>
        )}
      </div>
    </div>
  );
}
