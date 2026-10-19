import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

export function LanguageSelector({ compact = false }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`lang-switcher-wrap ${compact ? 'compact' : ''}`} title="Select Language / மொழியைத் தேர்ந்தெடுக்கவும்">
      <button
        type="button"
        id="lang-btn-ta"
        className={`lang-option-btn ${language === 'ta' ? 'active' : ''}`}
        onClick={() => setLanguage('ta')}
        aria-label="தமிழ்"
        title="தமிழ் மொழிக்கு மாற்றவும்"
      >
        தமிழ்
      </button>
      <span className="lang-option-divider">|</span>
      <button
        type="button"
        id="lang-btn-en"
        className={`lang-option-btn ${language === 'en' ? 'active' : ''}`}
        onClick={() => setLanguage('en')}
        aria-label="English"
        title="Switch to English"
      >
        English
      </button>
    </div>
  );
}
