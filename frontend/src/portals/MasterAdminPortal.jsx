import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Alert } from '../components/Alert';
import { PasswordInput } from '../components/PasswordInput';
import { useLanguage } from '../i18n/LanguageContext';

export function MasterAdminPortal({ activeTab }) {
  const { t } = useLanguage();
  const [organisations, setOrganisations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [alert, setAlert] = useState(null);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    adminName: '',
    adminEmail: '',
    password: '',
    contactPhone: '',
    address: ''
  });

  // Details Modal State
  const [selectedOrg, setSelectedOrg] = useState(null);

  // Status Change Confirmation
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);

  const fetchOrganisations = async () => {
    setLoading(true);
    try {
      const data = await api.getMasterOrganisations(search);
      setOrganisations(data || []);
    } catch (err) {
      setAlert({ type: 'error', message: err.message || t('Failed to load organisations') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganisations();
  }, [search]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setAlert(null);

    if (!createForm.name.trim()) {
      setAlert({ type: 'error', message: t('Organisation Name is required.') });
      return;
    }
    if (!createForm.code.trim()) {
      setAlert({ type: 'error', message: t('Organisation Code is required.') });
      return;
    }
    if (!createForm.adminName.trim()) {
      setAlert({ type: 'error', message: t('Organisation Admin Name is required.') });
      return;
    }
    if (!createForm.adminEmail.trim()) {
      setAlert({ type: 'error', message: t('Organisation Admin Email / User ID is required.') });
      return;
    }
    if (!createForm.password.trim()) {
      setAlert({ type: 'error', message: t('Initial Password is required.') });
      return;
    }

    setCreating(true);
    try {
      const res = await api.createOrganisation({
        name: createForm.name.trim(),
        code: createForm.code.trim().toUpperCase(),
        adminName: createForm.adminName.trim(),
        adminEmail: createForm.adminEmail.trim(),
        password: createForm.password,
        contactPhone: createForm.contactPhone.trim(),
        address: createForm.address.trim()
      });

      setAlert({
        type: 'success',
        message: `${t('Organisation')} "${res.name}" (${res.code}) ${t('created successfully. Admin account ready.')}`
      });
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        code: '',
        adminName: '',
        adminEmail: '',
        password: '',
        contactPhone: '',
        address: ''
      });
      fetchOrganisations();
    } catch (err) {
      setAlert({ type: 'error', message: err.message || t('Failed to create organisation') });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (org) => {
    const newStatus = org.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const actionLabel = newStatus === 'ACTIVE' ? t('Activate') : t('Deactivate');

    if (!window.confirm(`${actionLabel} ${t('Organisation')} "${org.name}"?`)) {
      return;
    }

    setStatusUpdatingId(org.id);
    try {
      await api.setOrganisationStatus(org.id, newStatus);
      setAlert({
        type: 'success',
        message: `${t('Organisation')} "${org.name}" ${newStatus === 'ACTIVE' ? t('activated successfully.') : t('deactivated successfully.')}`
      });
      fetchOrganisations();
    } catch (err) {
      setAlert({ type: 'error', message: err.message || t('Failed to update organisation status') });
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const filteredOrgs = organisations.filter(org => {
    if (statusFilter !== 'ALL' && org.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const totalBranches = organisations.reduce((sum, o) => sum + (o.branchCount || 0), 0);
  const totalUsers = organisations.reduce((sum, o) => sum + (o.userCount || 0), 0);
  const activeCount = organisations.filter(o => o.status === 'ACTIVE').length;
  const inactiveCount = organisations.filter(o => o.status === 'INACTIVE').length;

  return (
    <div className="portal-content master-portal">
      {/* Top Banner & Header */}
      <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🏛️</span> {t('Master Admin Portal')}
          </h2>
          <p className="muted" style={{ margin: '4px 0 0 0', fontSize: 13 }}>
            {t('Manage multi-organisation hierarchy, provision new organisations, and review summaries.')}
          </p>
        </div>
        <button
          type="button"
          className="primary"
          style={{ padding: '8px 18px', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => { setShowCreateModal(true); setAlert(null); }}
        >
          <span>➕</span> {t('Create Organisation')}
        </button>
      </div>

      <Alert
        type={alert?.type}
        message={alert?.message}
        onDismiss={() => setAlert(null)}
      />

      {/* Overview Stat Cards */}
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, margin: '16px 0 24px 0' }}>
        <div className="stat-card" style={{ background: '#fff', padding: '16px 20px', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', borderLeft: '4px solid #1b4332' }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>{t('Total Organisations')}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1b4332', marginTop: 4 }}>{organisations.length}</div>
        </div>
        <div className="stat-card" style={{ background: '#fff', padding: '16px 20px', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', borderLeft: '4px solid #2d6a4f' }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>{t('Active Organisations')}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#2d6a4f', marginTop: 4 }}>{activeCount}</div>
        </div>
        <div className="stat-card" style={{ background: '#fff', padding: '16px 20px', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', borderLeft: '4px solid #b02a37' }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>{t('Inactive Organisations')}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#b02a37', marginTop: 4 }}>{inactiveCount}</div>
        </div>
        <div className="stat-card" style={{ background: '#fff', padding: '16px 20px', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', borderLeft: '4px solid #d4af37' }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>{t('Branches')}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#856404', marginTop: 4 }}>{totalBranches}</div>
        </div>
        <div className="stat-card" style={{ background: '#fff', padding: '16px 20px', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.06)', borderLeft: '4px solid #0d6efd' }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>{t('Total Users')}</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#0d6efd', marginTop: 4 }}>{totalUsers}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', background: '#fff' }}>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <input
            type="text"
            placeholder={t('Search organisations...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', fontSize: 14 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#495057' }}>{t('Status')}:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '8px 12px', fontSize: 13 }}
          >
            <option value="ALL">{t('All')}</option>
            <option value="ACTIVE">{t('Active')}</option>
            <option value="INACTIVE">{t('Inactive')}</option>
          </select>
        </div>
        <button
          type="button"
          onClick={fetchOrganisations}
          disabled={loading}
          style={{ padding: '8px 14px', fontSize: 13 }}
        >
          {loading ? t('Refreshing...') : t('Refresh')}
        </button>
      </div>

      {/* Organisation Cards Grid */}
      {loading && organisations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#6c757d' }}>
          {t('Loading organisations...')}
        </div>
      ) : filteredOrgs.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: '#6c757d', background: '#fff' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{t('No organisations found.')}</div>
          <p className="muted" style={{ margin: '8px 0 0 0', fontSize: 13 }}>
            {t('Try searching with a different term or click "Create Organisation" to add one.')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
          {filteredOrgs.map((org) => {
            const isActive = org.status === 'ACTIVE';
            return (
              <div
                key={org.id}
                className="card"
                style={{
                  background: '#fff',
                  borderRadius: 10,
                  boxShadow: '0 3px 10px rgba(0,0,0,0.06)',
                  border: isActive ? '1px solid #d8f3dc' : '1px solid #f8d7da',
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
              >
                <div>
                  {/* Card Header: Title & Badges */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 18, color: '#1b4332', fontWeight: 700 }}>
                        {org.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <span style={{
                          background: '#e9ecef',
                          color: '#495057',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 0.5
                        }}>
                          {org.code}
                        </span>
                        <span style={{ fontSize: 11, color: '#6c757d' }}>ID: #{org.id}</span>
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: isActive ? '#d1e7dd' : '#f8d7da',
                      color: isActive ? '#0f5132' : '#842029',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: isActive ? '#198754' : '#dc3545'
                      }}></span>
                      {isActive ? t('Active') : t('Inactive')}
                    </span>
                  </div>

                  {/* Organisation Admin Details */}
                  <div style={{ background: '#f8f9fa', padding: '10px 14px', borderRadius: 6, marginBottom: 14, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="muted">{t('Organisation Admin')}:</span>
                      <span style={{ fontWeight: 600, color: '#212529' }}>{org.adminName || '—'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="muted">{t('Admin Email / User')}:</span>
                      <span style={{ fontWeight: 600, color: '#0d6efd' }}>{org.adminEmail || '—'}</span>
                    </div>
                    {org.contactPhone && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="muted">{t('Contact')}:</span>
                        <span>{org.contactPhone}</span>
                      </div>
                    )}
                  </div>

                  {/* Hierarchy Summary Metrics */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 8,
                    textAlign: 'center',
                    padding: '10px 6px',
                    borderTop: '1px solid #e9ecef',
                    borderBottom: '1px solid #e9ecef',
                    marginBottom: 16
                  }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#6c757d', fontWeight: 600 }}>{t('Branches')}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1b4332', marginTop: 2 }}>
                        {org.branchCount || 0}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#6c757d', fontWeight: 600 }}>{t('Users')}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#0d6efd', marginTop: 2 }}>
                        {org.userCount || 0}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#6c757d', fontWeight: 600 }}>{t('Items')}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#d4af37', marginTop: 2 }}>
                        {org.itemCount || 0}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#6c757d', fontWeight: 600 }}>{t('Orders')}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#6f42c1', marginTop: 2 }}>
                        {org.orderCount || 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setSelectedOrg(org)}
                    style={{ flex: 1, padding: '7px 12px', fontSize: 12, background: '#e9ecef', color: '#212529', border: '1px solid #ced4da' }}
                  >
                    🔍 {t('View Details')}
                  </button>
                  <button
                    type="button"
                    disabled={statusUpdatingId === org.id}
                    onClick={() => handleToggleStatus(org)}
                    style={{
                      flex: 1,
                      padding: '7px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      background: isActive ? '#fff1f2' : '#d1e7dd',
                      color: isActive ? '#b02a37' : '#0f5132',
                      border: isActive ? '1px solid #f8d7da' : '1px solid #badbcc'
                    }}
                  >
                    {statusUpdatingId === org.id
                      ? t('Updating...')
                      : isActive
                        ? `🚫 ${t('Deactivate')}`
                        : `✅ ${t('Activate')}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Organisation */}
      {showCreateModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: 580,
            maxHeight: '90vh',
            overflowY: 'auto',
            background: '#fff',
            borderRadius: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            padding: 24
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: '#1b4332', fontSize: 20 }}>
                🏢 {t('Create New Organisation')}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6c757d' }}
              >
                ✕
              </button>
            </div>

            <p className="muted" style={{ fontSize: 13, marginTop: -8, marginBottom: 16 }}>
              {t('Set up an independent organisation tenant with its designated Organisation Admin account.')}
            </p>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                  {t('Organisation Name')} *
                  <input
                    type="text"
                    required
                    placeholder="e.g. Annapoorna Group"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                  {t('Organisation Code')} *
                  <input
                    type="text"
                    required
                    placeholder="e.g. ANNAPOORNA"
                    value={createForm.code}
                    onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                  />
                  <small className="muted" style={{ fontSize: 10 }}>{t('Unique identifier (alphanumeric)')}</small>
                </label>
              </div>

              <div style={{ borderTop: '1px solid #e9ecef', paddingTop: 12, marginTop: 4 }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#2d6a4f' }}>
                  👤 {t('Organisation Admin Initial Account')}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    {t('Organisation Admin Name')} *
                    <input
                      type="text"
                      required
                      placeholder="e.g. R. Sundaram"
                      value={createForm.adminName}
                      onChange={(e) => setCreateForm({ ...createForm, adminName: e.target.value })}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    {t('Organisation Admin Email / User ID')} *
                    <input
                      type="text"
                      required
                      placeholder="e.g. admin@annapoorna"
                      value={createForm.adminEmail}
                      onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })}
                    />
                  </label>
                </div>
                <div style={{ marginTop: 10 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    {t('Initial Password')} *
                    <PasswordInput
                      required
                      placeholder={t('Enter initial admin password')}
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    />
                  </label>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e9ecef', paddingTop: 12 }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#495057' }}>
                  📞 {t('Contact Information (Optional)')}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 12 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    {t('Contact Phone')}
                    <input
                      type="text"
                      placeholder="e.g. 9840123456"
                      value={createForm.contactPhone}
                      onChange={(e) => setCreateForm({ ...createForm, contactPhone: e.target.value })}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 600 }}>
                    {t('Address')}
                    <input
                      type="text"
                      placeholder="e.g. Coimbatore, Tamil Nadu"
                      value={createForm.address}
                      onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                    />
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '8px 18px', background: '#f8f9fa', border: '1px solid #ced4da' }}
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={creating}
                  style={{ padding: '8px 22px', fontWeight: 600 }}
                >
                  {creating ? t('Creating Organisation...') : t('Create Organisation')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Organisation Details */}
      {selectedOrg && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: 520,
            background: '#fff',
            borderRadius: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            padding: 24
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 26 }}>🏢</span>
                <div>
                  <h3 style={{ margin: 0, color: '#1b4332', fontSize: 18 }}>
                    {selectedOrg.name}
                  </h3>
                  <span style={{
                    background: '#e9ecef',
                    color: '#495057',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700
                  }}>
                    {selectedOrg.code}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrg(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6c757d' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f3f5', paddingBottom: 6 }}>
                <span className="muted">{t('Organisation Status')}:</span>
                <span style={{
                  fontWeight: 700,
                  color: selectedOrg.status === 'ACTIVE' ? '#0f5132' : '#842029'
                }}>
                  {selectedOrg.status === 'ACTIVE' ? t('Active') : t('Inactive')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f3f5', paddingBottom: 6 }}>
                <span className="muted">{t('Organisation Admin Name')}:</span>
                <span style={{ fontWeight: 600 }}>{selectedOrg.adminName || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f3f5', paddingBottom: 6 }}>
                <span className="muted">{t('Organisation Admin Email / User ID')}:</span>
                <span style={{ fontWeight: 600, color: '#0d6efd' }}>{selectedOrg.adminEmail || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f3f5', paddingBottom: 6 }}>
                <span className="muted">{t('Contact Phone')}:</span>
                <span>{selectedOrg.contactPhone || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f3f5', paddingBottom: 6 }}>
                <span className="muted">{t('Address')}:</span>
                <span>{selectedOrg.address || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f3f5', paddingBottom: 6 }}>
                <span className="muted">{t('Created At')}:</span>
                <span>{selectedOrg.createdAt ? new Date(selectedOrg.createdAt).toLocaleDateString() : '—'}</span>
              </div>
            </div>

            <div style={{ background: '#f8f9fa', padding: 14, borderRadius: 8, marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: '#495057' }}>
                📊 {t('Hierarchy Summary Information')}
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, fontSize: 12 }}>
                <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #e9ecef' }}>
                  <span className="muted">{t('Branches')}:</span> <b>{selectedOrg.branchCount || 0}</b>
                </div>
                <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #e9ecef' }}>
                  <span className="muted">{t('Users')}:</span> <b>{selectedOrg.userCount || 0}</b>
                </div>
                <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #e9ecef' }}>
                  <span className="muted">{t('Catalogue Items')}:</span> <b>{selectedOrg.itemCount || 0}</b>
                </div>
                <div style={{ background: '#fff', padding: 8, borderRadius: 6, border: '1px solid #e9ecef' }}>
                  <span className="muted">{t('Purchase Orders')}:</span> <b>{selectedOrg.orderCount || 0}</b>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedOrg(null)}
                style={{ padding: '8px 20px', background: '#1b4332', color: '#fff' }}
              >
                {t('Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
