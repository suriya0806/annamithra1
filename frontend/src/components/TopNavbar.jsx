import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { LanguageSelector } from './LanguageSelector';

export function TopNavbar({ user, activeTab, onSelectTab, onLogout }) {
  const { t, translateRole } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const getNavItems = () => {
    switch (user?.role) {
      case 'Master Admin':
        return [
          { id: 'organisations', label: t('Organisations'), icon: '🏢' }
        ];
      case 'Organisation Admin':
        return [
          { id: 'branches', label: t('Branches'), icon: '🌿' },
          { id: 'accounts', label: t('Account Management'), icon: '👥' },
          { id: 'add-items', label: t('Add Items'), icon: '🏷️' },
          { id: 'order', label: t('Order'), icon: '📋' },
          { id: 'reports', label: t('Reports'), icon: '📊' },
          { id: 'history', label: t('History'), icon: '📜' }
        ];
      case 'Store Manager':
        return [
          { id: 'branch-requests', label: t('Dispatch', 'Dispatch'), icon: '🚚' },
          { id: 'central-inventory', label: t('Central Inventory'), icon: '📦' },
          { id: 'add-items', label: t('Add Items'), icon: '🏷️' },
          { id: 'entry-items', label: t('Entry Items'), icon: '📥' },
          { id: 'order', label: t('Order'), icon: '📋' },
          { id: 'reports', label: t('Reports'), icon: '📊' }
        ];
      case 'Branch Manager':
        return [
          { id: 'order-items', label: t('Order Items'), icon: '📝' },
          { id: 'drafts', label: t('Drafts', 'Drafts'), icon: '📑' },
          { id: 'entry', label: t('Entry'), icon: '📦' },
          { id: 'history', label: t('History'), icon: '📜' }
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  const getInitials = (name) => {
    if (!name) return 'AM';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const handleNavClick = (tabId) => {
    onSelectTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="topbar">
        {/* Brand */}
        <div className="brand">
          <img
            src="/logo.jpg"
            alt="Annamithra Logo"
            className="navbar-logo-img"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="brand-text">
            <b>{t('ANNAMITHRA')}</b>
            <small className="brand-tagline">{t('FOOD & RESTAURANT MANAGEMENT')}</small>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="topbar-nav desktop-only" aria-label="Portal Navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              type="button"
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Desktop User Zone */}
        <div className="user-zone desktop-only">
          <div className="user-meta">
            <span className="user-name">{user?.fullName || user?.username}</span>
            <span className="user-role-badge">{translateRole(user?.role)}</span>
            {user?.organisationName && (
              <span className="org-badge">
                🏢 {user.organisationName}
              </span>
            )}
            {user?.branchName && (
              <span className="branch-badge">
                {t('Branch')}: {user.branchName}
              </span>
            )}
          </div>

          <div className="avatar" title={user?.username}>
            {getInitials(user?.role)}
          </div>

          <LanguageSelector />

          <button
            type="button"
            id="logout-btn"
            className="logout-btn"
            onClick={onLogout}
            title={t('Logout')}
          >
            {t('Logout')}
          </button>
        </div>

        {/* Mobile Action Controls */}
        <div className="mobile-header-actions mobile-only">
          <LanguageSelector compact />
          <button
            type="button"
            className="mobile-hamburger-btn"
            onClick={() => setMobileMenuOpen(prev => !prev)}
            aria-label={mobileMenuOpen ? t('Close navigation menu') : t('Open navigation menu')}
            aria-expanded={mobileMenuOpen}
          >
            <span className="hamburger-icon">{mobileMenuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer & Backdrop */}
      {mobileMenuOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}
        aria-label="Mobile Navigation Menu"
        aria-hidden={!mobileMenuOpen}
      >
        <div className="mobile-drawer-header">
          <div className="mobile-drawer-user">
            <div className="avatar mobile-avatar">
              {getInitials(user?.role)}
            </div>
            <div className="mobile-user-details">
              <strong className="mobile-user-name">{user?.fullName || user?.username}</strong>
              <span className="user-role-badge">{translateRole(user?.role)}</span>
              {user?.organisationName && (
                <span className="org-badge mobile-org-badge">
                  🏢 {user.organisationName}
                </span>
              )}
              {user?.branchName && (
                <span className="branch-badge mobile-branch-badge">
                  {t('Branch')}: {user.branchName}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            className="mobile-drawer-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label={t('Close menu')}
          >
            ✕
          </button>
        </div>

        <nav className="mobile-drawer-nav">
          <div className="mobile-nav-heading">{t('NAVIGATION')}</div>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
              >
                <span className="mobile-nav-icon">{item.icon}</span>
                <span className="mobile-nav-text">{item.label}</span>
                {isActive && <span className="mobile-nav-active-pill">{t('Active')}</span>}
              </button>
            );
          })}
        </nav>

        <div className="mobile-drawer-footer">
          <div className="mobile-drawer-lang-row">
            <span className="mobile-lang-label">🌐 {t('Language')}:</span>
            <LanguageSelector />
          </div>

          <button
            type="button"
            className="mobile-drawer-logout-btn"
            onClick={() => {
              setMobileMenuOpen(false);
              onLogout();
            }}
          >
            🚪 {t('Logout')}
          </button>
        </div>
      </aside>
    </>
  );
}
