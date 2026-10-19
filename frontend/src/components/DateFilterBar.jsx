import React from 'react';
import { getTodayDateString, formatDateLabel } from '../utils/dateGrouping';
import { useLanguage } from '../i18n/LanguageContext';

/**
 * Standard Date Filter Bar across Annamithra portals.
 * Supports:
 * - Specific single date selection (defaults to Today)
 * - "Today" quick button
 * - "All Dates" toggle (triggers date-grouped section rendering)
 * - Optional Date Range mode (from / to) for reports and history
 */
export default function DateFilterBar({
  label,
  selectedDate,
  onDateChange,
  isAllDates = false,
  onToggleAllDates,
  availableDates = [],
  showRange = false,
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  totalCount,
  extraControls
}) {
  const { language, t } = useLanguage();
  const today = getTodayDateString();
  const displayLabel = label ? t(label) : t('Date Filter');

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
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
        <span style={{
          fontWeight: '600',
          color: 'var(--primary-dark-green, #003B2B)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px'
        }}>
          📅 {displayLabel}:
        </span>

        {showRange ? (
          /* Range filter mode */
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('From:')}</label>
            <input
              type="date"
              value={fromDate || ''}
              onChange={(e) => onFromDateChange && onFromDateChange(e.target.value)}
              className="date-input"
              style={{
                padding: '6px 10px',
                border: '1px solid var(--border-color, #E5DDC9)',
                borderRadius: '6px',
                background: '#fff',
                fontSize: '13px',
                color: 'var(--dark-text)'
              }}
            />
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('To:')}</label>
            <input
              type="date"
              value={toDate || ''}
              onChange={(e) => onToDateChange && onToDateChange(e.target.value)}
              className="date-input"
              style={{
                padding: '6px 10px',
                border: '1px solid var(--border-color, #E5DDC9)',
                borderRadius: '6px',
                background: '#fff',
                fontSize: '13px',
                color: 'var(--dark-text)'
              }}
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                if (onFromDateChange) onFromDateChange(today);
                if (onToDateChange) onToDateChange(today);
              }}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              {t('Today')}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                if (onFromDateChange) onFromDateChange('');
                if (onToDateChange) onToDateChange('');
              }}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              {t('Clear Range')}
            </button>
          </div>
        ) : (
          /* Single Date / All Dates mode */
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="date"
              value={isAllDates ? '' : (selectedDate || '')}
              disabled={isAllDates}
              onChange={(e) => {
                if (onToggleAllDates && isAllDates) onToggleAllDates(false);
                if (onDateChange) onDateChange(e.target.value);
              }}
              className="date-input"
              style={{
                padding: '6px 10px',
                border: '1px solid var(--border-color, #E5DDC9)',
                borderRadius: '6px',
                background: isAllDates ? '#f0ede6' : '#fff',
                fontSize: '13px',
                color: 'var(--dark-text)',
                cursor: isAllDates ? 'not-allowed' : 'text'
              }}
            />

            <button
              type="button"
              className={`btn btn-sm ${!isAllDates && selectedDate === today ? 'primary' : ''}`}
              onClick={() => {
                if (onToggleAllDates) onToggleAllDates(false);
                if (onDateChange) onDateChange(today);
              }}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              {t('Today')}
            </button>

            {onToggleAllDates && (
              <button
                type="button"
                className={`btn btn-sm ${isAllDates ? 'primary' : ''}`}
                onClick={() => onToggleAllDates(!isAllDates)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  borderColor: isAllDates ? 'var(--primary-dark-green)' : 'var(--border-color)'
                }}
              >
                {isAllDates ? t('✓ All Dates (Grouped)') : t('All Dates')}
              </button>
            )}

            {availableDates && availableDates.length > 0 && (
              <select
                value={isAllDates ? 'ALL' : (selectedDate || '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'ALL') {
                    if (onToggleAllDates) onToggleAllDates(true);
                  } else {
                    if (onToggleAllDates && isAllDates) onToggleAllDates(false);
                    if (onDateChange) onDateChange(val);
                  }
                }}
                className="date-select"
                style={{
                  padding: '6px 10px',
                  border: '1px solid var(--border-color, #E5DDC9)',
                  borderRadius: '6px',
                  background: '#fff',
                  fontSize: '13px',
                  color: 'var(--dark-text)',
                  cursor: 'pointer'
                }}
                title={t('Select Previous Date')}
              >
                <option value="" disabled>{t('Quick Dates')}</option>
                <option value="ALL">{t('All Dates')}</option>
                {availableDates.map(d => (
                  <option key={d} value={d}>
                    {d === today ? `📅 ${t('Today')} (${d})` : `📅 ${formatDateLabel(d, language)}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {extraControls}
      </div>

      {/* Right side: Status indicator / record counter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{
          fontSize: '12px',
          color: 'var(--text-muted, #4A6B5F)',
          fontWeight: '500'
        }}>
          {isAllDates
            ? t('Displaying all historical dates (newest first)')
            : selectedDate
              ? `${t('Filtered')}: ${formatDateLabel(selectedDate, language)}`
              : (fromDate || toDate)
                ? `${t('Date Range')}: ${fromDate || t('Any')} ${t('To')} ${toDate || t('Any')}`
                : t('All Dates')}
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
export function EmptyDateMessage({ date, message, onResetToday, onShowAll }) {
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
          <button type="button" className="btn btn-sm" onClick={onResetToday}>
            {t('View Today')}
          </button>
        )}
        {onShowAll && (
          <button type="button" className="btn btn-sm primary" onClick={onShowAll}>
            {t('View All Historical Dates')}
          </button>
        )}
      </div>
    </div>
  );
}
