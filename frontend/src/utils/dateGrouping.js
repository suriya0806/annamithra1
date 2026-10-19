// Reusable Date Utilities for Annamithra

/**
 * Returns current local date as 'YYYY-MM-DD'
 */
export function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes any date or ISO timestamp string into 'YYYY-MM-DD' in local timezone.
 */
export function toLocalDateString(input) {
  if (!input) return '';
  if (typeof input === 'string') {
    // If it's already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
      return input.trim();
    }
  }
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Human-readable date label with Today / Yesterday indicator
 */
export function formatDateLabel(dateString, lang = 'en') {
  if (!dateString) return lang === 'ta' ? 'தேதியிடப்படாதது' : 'Undated';
  const clean = toLocalDateString(dateString);
  if (!clean) return lang === 'ta' ? 'தேதியிடப்படாதது' : 'Undated';

  const today = getTodayDateString();
  const d = new Date(clean + 'T00:00:00');
  if (isNaN(d.getTime())) return clean;

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = toLocalDateString(yesterdayDate);

  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';
  const formatted = d.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  if (clean === today) {
    return lang === 'ta' ? `${formatted} (இன்று)` : `${formatted} (Today)`;
  }
  if (clean === yesterday) {
    return lang === 'ta' ? `${formatted} (நேற்று)` : `${formatted} (Yesterday)`;
  }
  return formatted;
}

/**
 * Formats a timestamp into human readable Date + Time
 */
export function formatDateTime(input, lang = 'en') {
  if (!input) return '—';
  const d = new Date(input);
  if (isNaN(d.getTime())) {
    // If it's just a YYYY-MM-DD string
    return formatDateLabel(input, lang);
  }
  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Groups an array of records by date, newest date first.
 * @param {Array} records - List of records to group
 * @param {Function|String} dateExtractor - Function returning YYYY-MM-DD or field name
 * @returns {Array<{date: string, label: string, items: Array}>}
 */
export function groupByDate(records, dateExtractor, lang = 'en') {
  if (!records || !Array.isArray(records) || records.length === 0) {
    return [];
  }

  const getRecDate = (item) => {
    if (typeof dateExtractor === 'function') {
      return toLocalDateString(dateExtractor(item));
    }
    if (typeof dateExtractor === 'string' && item[dateExtractor]) {
      return toLocalDateString(item[dateExtractor]);
    }
    // Fallback search
    const val = item.requestDate || item.orderDate || item.dispatchDate || item.transactionDate || item.createdAt || item.acknowledgedAt;
    return toLocalDateString(val);
  };

  const map = new Map();
  const undated = [];

  for (const item of records) {
    const dStr = getRecDate(item);
    if (!dStr) {
      undated.push(item);
    } else {
      if (!map.has(dStr)) {
        map.set(dStr, []);
      }
      map.get(dStr).push(item);
    }
  }

  // Sort distinct dates descending (newest first)
  const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

  const groups = sortedDates.map(date => ({
    date,
    label: formatDateLabel(date, lang),
    items: map.get(date)
  }));

  if (undated.length > 0) {
    groups.push({
      date: 'UNDATED',
      label: lang === 'ta' ? 'மற்ற / தேதியிடப்படாத பதிவுகள்' : 'Other / Undated Records',
      items: undated
    });
  }

  return groups;
}
