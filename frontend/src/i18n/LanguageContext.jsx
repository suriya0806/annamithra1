import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  dictionary,
  itemTranslations,
  unitTranslations,
  statusTranslations,
  roleTranslations,
  categoryTranslations
} from './translations';

const LANGUAGE_KEY = 'annamithra_lang';

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  t: (key, fallback) => key,
  translateItem: (name) => name,
  translateUnit: (unit) => unit,
  translateStatus: (status) => status,
  translateRole: (role) => role,
  translateCategory: (category) => category
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY);
      return saved === 'ta' ? 'ta' : 'en';
    } catch {
      return 'en';
    }
  });

  const setLanguage = (lang) => {
    const validLang = lang === 'ta' ? 'ta' : 'en';
    setLanguageState(validLang);
    try {
      localStorage.setItem(LANGUAGE_KEY, validLang);
    } catch (err) {
      console.warn('Failed to save language choice to localStorage', err);
    }
  };

  /**
   * Main translation function for UI phrases, labels, messages, buttons
   */
  const t = (key, fallback) => {
    if (!key) return '';
    if (language === 'en') {
      return key;
    }
    const trimmed = String(key).trim();
    if (dictionary[trimmed]) {
      return dictionary[trimmed];
    }
    return fallback !== undefined ? fallback : key;
  };

  /**
   * Translates known grocery/food items into Tamil when available,
   * otherwise preserves original saved item name.
   */
  const translateItem = (itemName) => {
    if (!itemName) return '';
    if (language === 'en') return itemName;

    const lower = String(itemName).toLowerCase().trim();
    if (itemTranslations[lower]) {
      return itemTranslations[lower];
    }

    // Try finding words in multi-word items (e.g. "Superior Toor Dal")
    for (const [enKey, taVal] of Object.entries(itemTranslations)) {
      if (lower === enKey) return taVal;
    }

    // Return original saved item name if no translation exists
    return itemName;
  };

  /**
   * Translates measurement units
   */
  const translateUnit = (unit) => {
    if (!unit) return '';
    if (language === 'en') return unit;

    const lower = String(unit).toLowerCase().trim();
    if (unitTranslations[lower]) {
      return unitTranslations[lower];
    }
    return unit;
  };

  /**
   * Translates order & inventory status badges
   */
  const translateStatus = (status) => {
    if (!status) return '';
    if (language === 'en') return status;

    if (statusTranslations[status]) {
      return statusTranslations[status];
    }
    const upper = String(status).toUpperCase().trim();
    if (statusTranslations[upper]) {
      return statusTranslations[upper];
    }
    return status;
  };

  /**
   * Translates user roles
   */
  const translateRole = (role) => {
    if (!role) return '';
    if (language === 'en') return role;

    return roleTranslations[role] || role;
  };

  /**
   * Translates reporting categories
   */
  const translateCategory = (category) => {
    if (!category) return '';
    if (language === 'en') return category;
    return categoryTranslations[category] || category;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        translateItem,
        translateUnit,
        translateStatus,
        translateRole,
        translateCategory
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
