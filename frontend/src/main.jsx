import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { api, getStoredAuth } from './api';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { LanguageSelector } from './components/LanguageSelector';
import { TopNavbar } from './components/TopNavbar';
import { Alert } from './components/Alert';
import { AdminPortal } from './portals/AdminPortal';
import { StorePortal } from './portals/StorePortal';
import { BranchPortal } from './portals/BranchPortal';
import { MasterAdminPortal } from './portals/MasterAdminPortal';

function AppContent() {
  const { t, translateRole } = useLanguage();
  const [auth, setAuth] = useState(() => getStoredAuth());
  const [role, setRole] = useState('Organisation Admin');
  const [username, setUsername] = useState('admin@saravanas');
  const [password, setPassword] = useState('1234');
  const [activeTab, setActiveTab] = useState(() => {
    const stored = getStoredAuth();
    if (stored?.user?.role === 'Store Manager') return 'branch-requests';
    if (stored?.user?.role === 'Master Admin') return 'organisations';
    if (stored?.user?.role === 'Branch Manager') return 'order-items';
    return 'branches';
  });
  const [alert, setAlert] = useState(null);
  const [dbConnected, setDbConnected] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Check health on startup
  useEffect(() => {
    api.checkHealth()
      .then(() => setDbConnected(true))
      .catch(() => setDbConnected(false));
  }, []);

  // When user changes role or logs in, set default tab
  useEffect(() => {
    if (auth.user?.role) {
      if (auth.user.role === 'Master Admin') setActiveTab('organisations');
      else if (auth.user.role === 'Organisation Admin') setActiveTab('branches');
      else if (auth.user.role === 'Store Manager') setActiveTab('branch-requests');
      else if (auth.user.role === 'Branch Manager') setActiveTab('order-items');
    }
  }, [auth.user?.role]);

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setAlert(null);
    setSubmitting(true);

    try {
      const loginData = await api.login(username.trim(), password, role);
      setAuth({ token: loginData.token, user: loginData });
      if (loginData.role === 'Store Manager') {
        setActiveTab('branch-requests');
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message || t('Login failed. Please check credentials.') });
    } finally {
      setSubmitting(false);
    }
  };

  // Quick fill development credentials
  const fillDevCreds = (u, p, r) => {
    setUsername(u);
    setPassword(p);
    setRole(r);
    setAlert(null);
  };

  // Handle Logout
  const handleLogout = () => {
    api.logout();
    setAuth({ token: null, user: null });
    setAlert(null);
  };

  // If not logged in, render login screen
  if (!auth.token || !auth.user) {
    return (
      <main className="login-wrap">
        <form className="login" onSubmit={handleLogin} style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: 16, right: 16 }}>
            <LanguageSelector compact />
          </div>

          <div className="login-logo-wrap">
            <img
              src="/logo.jpg"
              alt="Annamithra Logo"
              className="login-logo-img"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <h1>{t('ANNAMITHRA')}</h1>
          <p className="tagline">{t('FOOD & RESTAURANT MANAGEMENT')}</p>
          <div className="gold-divider"><span>♦</span></div>
          <h2>{t('Sign In')}</h2>

          <Alert
            type={alert?.type}
            message={alert?.message}
            onDismiss={() => setAlert(null)}
          />

          <label>
            {t('Role')}
            <select
              value={role}
              onChange={e => {
                const newRole = e.target.value;
                setRole(newRole);
                if (newRole === 'Master Admin') {
                  setUsername('master@admin');
                  setPassword('1234');
                } else if (newRole === 'Organisation Admin') {
                  setUsername('admin@saravanas');
                  setPassword('1234');
                } else if (newRole === 'Store Manager') {
                  setUsername('store@manager');
                  setPassword('1234');
                } else if (newRole === 'Branch Manager') {
                  setUsername('Branch1');
                  setPassword('1234');
                }
              }}
            >
              <option value="Master Admin">{translateRole('Master Admin')}</option>
              <option value="Organisation Admin">{translateRole('Organisation Admin')}</option>
              <option value="Store Manager">{translateRole('Store Manager')}</option>
              <option value="Branch Manager">{translateRole('Branch Manager')}</option>
            </select>
          </label>

          <label>
            {t('User ID / Username')}
            <input
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={t('Enter User ID')}
            />
          </label>

          <label>
            {t('Password')}
            <input
              required
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('Enter Password')}
            />
          </label>

          <button className="primary" type="submit" disabled={submitting} style={{ marginTop: 6 }}>
            {submitting ? t('Authenticating...') : `${t('Sign In')} (${translateRole(role)})`}
          </button>

          <div className="dev-creds-box">
            <div className="dev-creds-title">
              <span>{t('Quick Development Logins')}</span>
              <span className="muted" style={{ fontSize: 10 }}>{t('Click to fill')}</span>
            </div>
            <div className="dev-chip-list">
              <button
                type="button"
                className="dev-chip"
                onClick={() => fillDevCreds('master@admin', '1234', 'Master Admin')}
              >
                <span><b>{translateRole('Master Admin')}</b> <code>master@admin</code></span>
                <span>PW: <code>1234</code></span>
              </button>
              <button
                type="button"
                className="dev-chip"
                onClick={() => fillDevCreds('admin@saravanas', '1234', 'Organisation Admin')}
              >
                <span><b>{translateRole('Organisation Admin')}</b> <code>admin@saravanas</code></span>
                <span>PW: <code>1234</code></span>
              </button>
              <button
                type="button"
                className="dev-chip"
                onClick={() => fillDevCreds('store@manager', '1234', 'Store Manager')}
              >
                <span><b>{translateRole('Store Manager')}</b> <code>store@manager</code></span>
                <span>PW: <code>1234</code></span>
              </button>
              <button
                type="button"
                className="dev-chip"
                onClick={() => fillDevCreds('Branch1', '1234', 'Branch Manager')}
              >
                <span><b>{translateRole('Branch Manager')} 1</b> <code>Branch1</code></span>
                <span>PW: <code>1234</code></span>
              </button>
            </div>
          </div>

            {/* Supabase backend connection remains active in background */}
        </form>
      </main>
    );
  }

  // Render Portal according to authenticated user role
  return (
    <div className="shell">
      <TopNavbar
        user={auth.user}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onLogout={handleLogout}
      />

      <main>
        {auth.user.role === 'Master Admin' && (
          <MasterAdminPortal activeTab={activeTab} />
        )}
        {auth.user.role === 'Organisation Admin' && (
          <AdminPortal activeTab={activeTab} />
        )}
        {auth.user.role === 'Store Manager' && (
          <StorePortal activeTab={activeTab} />
        )}
        {auth.user.role === 'Branch Manager' && (
          <BranchPortal user={auth.user} activeTab={activeTab} onSelectTab={setActiveTab} />
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

createRoot(document.getElementById('root')).render(<App />);
