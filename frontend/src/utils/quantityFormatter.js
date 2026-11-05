import { unitTranslations } from '../i18n/translations.js';

/**
 * Normalizes a unit string by removing redundant whitespace and deduplicating repeated tokens.
 * E.g., "KG KG" -> "KG", "  Nos  " -> "Nos".
 */
export function cleanUnitName(unit) {
  if (!unit) return '';
  const trimmed = String(unit).trim();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens[0].toLowerCase() === tokens[1].toLowerCase()) {
    return tokens[0];
  }
  return trimmed;
}

/**
 * Returns the translated unit name in Tamil if isTa is true, otherwise returns the clean English unit.
 */
export function getDisplayUnit(unit, isTa = false) {
  const clean = cleanUnitName(unit);
  if (!clean) return '';
  if (!isTa) return clean;
  const lower = clean.toLowerCase();
  return unitTranslations[lower] || clean;
}

/**
 * Formats a single numeric quantity and its unit into a combined string.
 * Examples:
 * - formatQuantityWithUnit(3, 'KG') -> "3 KG"
 * - formatQuantityWithUnit(1, 'L') -> "1 L"
 * - formatQuantityWithUnit(500, 'ML') -> "500 ML"
 * - formatQuantityWithUnit(2.5, 'KG') -> "2.5 KG"
 * - formatQuantityWithUnit(10, 'Nos') -> "10 Nos"
 * - formatQuantityWithUnit(0, 'KG') -> "0 KG"
 *
 * Rules:
 * - Preserves decimal quantities without excessive floating point drift.
 * - Deduplicates units to prevent "3 KG KG".
 * - Safely handles missing/null quantities.
 */
export function formatQuantityWithUnit(qty, unit, isTa = false, options = {}) {
  const { emptyFallback = '—' } = options;

  if (qty === null || qty === undefined || qty === '') {
    return emptyFallback;
  }

  // If qty is a string that might have commas or units, parse numeric part
  let numVal;
  if (typeof qty === 'number') {
    numVal = qty;
  } else {
    const parsed = parseFloat(String(qty).replace(/,/g, ''));
    numVal = isNaN(parsed) ? null : parsed;
  }

  if (numVal === null || isNaN(numVal)) {
    return emptyFallback;
  }

  const cleanUnit = cleanUnitName(unit);
  const displayUnit = getDisplayUnit(cleanUnit, isTa);

  // Preserve decimal precision (e.g. 2.5, 0.75, 3)
  const numStr = Number.isInteger(numVal)
    ? String(numVal)
    : String(Math.round(numVal * 1000) / 1000);

  if (!displayUnit) {
    return numStr;
  }

  // Combine quantity and unit
  let combined = `${numStr} ${displayUnit}`.trim();

  // Deduplicate repeated trailing words (e.g. "3 KG KG" -> "3 KG")
  combined = combined.replace(/([A-Za-z\u0B80-\u0BFF()]+)\s+\1\b/gi, '$1');

  return combined;
}

/**
 * Formats a map or summary of quantities grouped by unit.
 * E.g., { KG: 10, L: 5 } -> "10 KG, 5 L"
 * Prevents mixing different units in a combined total.
 */
export function formatUnitSummary(unitMap, isTa = false, emptyFallback = '0') {
  if (!unitMap || typeof unitMap !== 'object') return emptyFallback;
  const entries = Object.entries(unitMap).filter(([_, val]) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  });
  if (entries.length === 0) return emptyFallback;

  return entries
    .map(([u, val]) => formatQuantityWithUnit(val, u, isTa))
    .join(', ');
}
