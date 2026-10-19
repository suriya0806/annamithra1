import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Alert } from '../components/Alert';
import { downloadOrderPdf, parseOrderDateTime } from '../utils/pdfGenerator';
import DateFilterBar, { DateSectionHeader, EmptyDateMessage } from '../components/DateFilterBar';
import { useAddItemShortcut } from '../utils/useAddItemShortcut';
import { useLanguage } from '../i18n/LanguageContext';
import {
  getTodayDateString,
  toLocalDateString,
  formatDateLabel,
  formatDateTime,
  groupByDate
} from '../utils/dateGrouping';

export function AdminPortal({ activeTab }) {
  const { language, t, translateItem, translateUnit, translateStatus, translateRole } = useLanguage();
  const [branchesSubTab, setBranchesSubTab] = useState('create-branch');
  const [orderSubTab, setOrderSubTab] = useState('new-item');

  // Alerts
  const [alert, setAlert] = useState(null);
  const showAlert = (type, message) => setAlert({ type, message });

  // Data states
  const [branches, setBranches] = useState([]);
  const [branchMappings, setBranchMappings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [myOrg, setMyOrg] = useState(null);
  const [storeManager, setStoreManager] = useState(null);
  const [storeManagerForm, setStoreManagerForm] = useState({
    username: '',
    password: '',
    fullName: ''
  });
  const [savingStoreManager, setSavingStoreManager] = useState(false);

  const loadMyOrgAndStoreManager = async () => {
    try {
      const org = await api.getMyOrganisation();
      setMyOrg(org);
    } catch {}
    try {
      const sm = await api.getStoreManager();
      setStoreManager(sm);
      if (sm) {
        setStoreManagerForm(prev => ({
          ...prev,
          username: sm.username || '',
          fullName: sm.fullName || ''
        }));
      }
    } catch {}
  };

  useEffect(() => {
    loadMyOrgAndStoreManager();
  }, []);

  const handleSaveStoreManager = async (e) => {
    e.preventDefault();
    if (!storeManagerForm.username.trim()) {
      showAlert('error', t('Store Manager Username is required'));
      return;
    }
    if (!storeManager && !storeManagerForm.password.trim()) {
      showAlert('error', t('Initial Password is required'));
      return;
    }

    try {
      setSavingStoreManager(true);
      const res = await api.saveStoreManager({
        username: storeManagerForm.username.trim(),
        password: storeManagerForm.password ? storeManagerForm.password.trim() : undefined,
        fullName: storeManagerForm.fullName ? storeManagerForm.fullName.trim() : undefined
      });
      showAlert('success', `${t('Store Manager Account')} "${res.username}" ${t('saved successfully!')}`);
      setStoreManager(res);
      setStoreManagerForm(prev => ({ ...prev, password: '' }));
    } catch (err) {
      showAlert('error', err.message || t('Failed to save Store Manager account'));
    } finally {
      setSavingStoreManager(false);
    }
  };

  // Form states: Create Branch
  const [branchForm, setBranchForm] = useState({
    name: '',
    location: '',
    managerUsername: '',
    managerPassword: '',
    contact: ''
  });

  // Form states: New Items Order
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('KG');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemsList, setNewItemsList] = useState([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const adminItemInputRef = useRef(null);

  // Saved / Placed New Item Orders list
  const [placedNewItemOrders, setPlacedNewItemOrders] = useState([]);
  const [newItemOrderDate, setNewItemOrderDate] = useState(getTodayDateString());
  const [newItemIsAllDates, setNewItemIsAllDates] = useState(false);
  const [loadingNewItemOrders, setLoadingNewItemOrders] = useState(false);

  // Requested Items state (Orders submitted by Store Manager)
  const [requestedOrders, setRequestedOrders] = useState([]);
  const [requestedOrderDate, setRequestedOrderDate] = useState(getTodayDateString());
  const [requestedIsAllDates, setRequestedIsAllDates] = useState(false);
  const [selectedAdminOrder, setSelectedAdminOrder] = useState(null);

  // History state
  const [historyOrders, setHistoryOrders] = useState([]);
  const [historyDate, setHistoryDate] = useState(getTodayDateString());
  const [historyIsAllDates, setHistoryIsAllDates] = useState(false);
  const [historyFromDate, setHistoryFromDate] = useState('');
  const [historyToDate, setHistoryToDate] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  // 1. Load Branches & Mappings
  const loadBranchesAndMappings = async () => {
    try {
      const [bData, mData] = await Promise.all([
        api.getBranches(),
        api.getBranchManagers()
      ]);
      if (Array.isArray(bData)) setBranches(bData);
      if (Array.isArray(mData)) setBranchMappings(mData);
    } catch (err) {
      console.error('Error loading branches', err);
      showAlert('error', err.message || 'Failed to load branches');
    }
  };

  // 2. Load Placed New Item Orders
  const loadPlacedNewItemOrders = async (date = newItemOrderDate, isAll = newItemIsAllDates) => {
    try {
      setLoadingNewItemOrders(true);
      const queryDate = isAll ? '' : date;
      const data = await api.getOrgNewItemOrders(queryDate);
      if (Array.isArray(data)) setPlacedNewItemOrders(data);
    } catch (err) {
      console.error('Error loading placed new item orders', err);
    } finally {
      setLoadingNewItemOrders(false);
    }
  };

  // 3. Load Requested Orders (submitted by Store Manager)
  const loadRequestedOrders = async (date = requestedOrderDate, isAll = requestedIsAllDates) => {
    try {
      setLoading(true);
      const queryDate = isAll ? '' : date;
      const data = await api.getRequestedOrdersGrouped(queryDate);
      if (Array.isArray(data)) setRequestedOrders(data);
    } catch (err) {
      console.error('Error loading requested orders', err);
      showAlert('error', err.message || 'Failed to load purchase requests');
    } finally {
      setLoading(false);
    }
  };

  // 4. Load Purchase Order History
  const loadHistory = async () => {
    try {
      setLoading(true);
      const queryDate = (historyIsAllDates || historyFromDate || historyToDate) ? '' : historyDate;
      const data = await api.getPurchaseOrderHistory(queryDate, historySearch, historyFromDate, historyToDate);
      if (Array.isArray(data)) setHistoryOrders(data);
    } catch (err) {
      console.error('Error loading history', err);
      showAlert('error', err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  // Tab activation triggers
  useEffect(() => {
    if (activeTab === 'branches') {
      loadBranchesAndMappings();
    } else if (activeTab === 'order') {
      if (orderSubTab === 'new-item') {
        loadPlacedNewItemOrders(newItemOrderDate, newItemIsAllDates);
      } else if (orderSubTab === 'requested-item') {
        loadRequestedOrders(requestedOrderDate, requestedIsAllDates);
      }
    } else if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, orderSubTab, requestedOrderDate, requestedIsAllDates, newItemOrderDate, newItemIsAllDates, historyDate, historyIsAllDates, historyFromDate, historyToDate]);

  // Handle Create Branch
  const handleCreateBranch = async (e) => {
    e.preventDefault();
    if (!branchForm.name.trim() || !branchForm.location.trim()) {
      return showAlert('error', 'Branch Name and Location are required');
    }
    if (!branchForm.managerUsername.trim() || !branchForm.managerPassword.trim()) {
      return showAlert('error', 'Branch Manager User ID and Password are required');
    }

    try {
      setLoading(true);
      const created = await api.createBranch(branchForm);
      showAlert('success', `Branch "${created.name}" and Manager account "${branchForm.managerUsername}" created successfully!`);
      setBranchForm({
        name: '',
        location: '',
        managerUsername: '',
        managerPassword: '',
        contact: ''
      });
      await loadBranchesAndMappings();
    } catch (err) {
      showAlert('error', err.message || 'Failed to create branch');
    } finally {
      setLoading(false);
    }
  };

  // Add Item to New Item order list
  const handleAddNewItemToList = () => {
    if (!newItemName.trim()) {
      return showAlert('error', 'Please enter an Item Name');
    }
    const q = parseInt(newItemQty, 10);
    if (isNaN(q) || q <= 0) {
      return showAlert('error', 'Quantity to Order must be a positive number');
    }

    setNewItemsList(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        name: newItemName.trim(),
        unit: newItemUnit.trim().toUpperCase(),
        quantity: q
      }
    ]);
    setNewItemName('');
    setNewItemQty('');
    setAlert(null);
  };

  // Register shared F5 Add Item keyboard shortcut on New Item Order tab
  useAddItemShortcut({
    onAddItem: () => {
      if (activeTab === 'order' && orderSubTab === 'new-item') {
        if (!newItemName.trim() || !newItemQty) {
          adminItemInputRef.current?.focus();
        } else {
          handleAddNewItemToList();
          setTimeout(() => adminItemInputRef.current?.focus(), 60);
        }
      }
    },
    isEnabled: activeTab === 'order' && orderSubTab === 'new-item',
    isModalOpen: false
  });

  const handleRemoveNewItem = (id) => {
    setNewItemsList(prev => prev.filter(x => x.id !== id));
  };

  // Place Order for New Items
  const handlePlaceOrder = async () => {
    if (newItemsList.length === 0) {
      return showAlert('error', 'Please add at least one item before placing the order');
    }

    try {
      setSubmittingOrder(true);
      await api.createOrgNewItemsOrder(newItemsList.map(it => ({
        name: it.name,
        unit: it.unit,
        quantity: it.quantity
      })));
      showAlert('success', `Purchase order for ${newItemsList.length} item(s) placed successfully! Items are now listed in catalogue and marked Ordered.`);
      setNewItemsList([]);
      await loadPlacedNewItemOrders(newItemOrderDate, newItemIsAllDates);
    } catch (err) {
      showAlert('error', err.message || 'Failed to place order');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Mark Store Manager Purchase Order as Ordered by orderNumber
  const handleMarkOrderGroupAsOrdered = async (orderNumber) => {
    try {
      await api.markOrderByOrderNumberAsOrdered(orderNumber);
      showAlert('success', `✓ Order ${orderNumber} marked as Ordered. Central inventory remains unchanged until goods arrive.`);
      if (selectedAdminOrder && selectedAdminOrder.orderNumber === orderNumber) {
        setSelectedAdminOrder(prev => prev ? { ...prev, status: 'ORDERED' } : null);
      }
      await loadRequestedOrders(requestedOrderDate, requestedIsAllDates);
    } catch (err) {
      showAlert('error', err.message || 'Failed to update order status');
    }
  };

  // Download PDF for Organisation Admin Purchase Order
  const handleDownloadPdf = async (groupOrOrderNumber) => {
    try {
      setLoading(true);
      let order = groupOrOrderNumber;
      if (typeof groupOrOrderNumber === 'string') {
        order = await api.getOrderByOrderNumber(groupOrOrderNumber);
      } else if (!groupOrOrderNumber.lines || groupOrOrderNumber.lines.length === 0) {
        order = await api.getOrderByOrderNumber(groupOrOrderNumber.orderNumber);
      }
      downloadOrderPdf(order, { formatType: 'ORG_ADMIN', language });
    } catch (err) {
      showAlert('error', err.message || 'Failed to generate PDF for order');
    } finally {
      setLoading(false);
    }
  };

  // View full details of an order in modal
  const handleViewAdminOrder = async (group) => {
    try {
      setLoading(true);
      const full = await api.getOrderByOrderNumber(group.orderNumber);
      setSelectedAdminOrder(full);
    } catch {
      setSelectedAdminOrder(group);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      {myOrg && (
        <div className="org-header-banner" style={{ background: '#f8fdf9', border: '1px solid #b7e4c7', borderRadius: 8, padding: '12px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🏢</span>
            <div>
              <div style={{ fontWeight: 700, color: '#1b4332', fontSize: 16 }}>{myOrg.name}</div>
              <div style={{ fontSize: 12, color: '#2d6a4f', marginTop: 2 }}>
                <b>{t('Code')}:</b> <span style={{ background: '#e9ecef', color: '#1b4332', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>{myOrg.code}</span>
                <span style={{ margin: '0 8px', color: '#ced4da' }}>|</span>
                <b>{t('Admin')}:</b> {myOrg.adminName} ({myOrg.adminEmail})
              </div>
            </div>
          </div>
          <span style={{
            background: myOrg.status === 'ACTIVE' ? '#d1e7dd' : '#f8d7da',
            color: myOrg.status === 'ACTIVE' ? '#0f5132' : '#842029',
            padding: '4px 10px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase'
          }}>
            {myOrg.status === 'ACTIVE' ? t('Active') : t('Inactive')}
          </span>
        </div>
      )}

      <Alert
        type={alert?.type}
        message={alert?.message}
        onDismiss={() => setAlert(null)}
      />

      {/* =========================================================================
          BRANCHES TAB
          ========================================================================= */}
      {activeTab === 'branches' && (
        <section>
          <div className="subnav">
            <button
              type="button"
              className={`subnav-btn ${branchesSubTab === 'create-branch' ? 'active' : ''}`}
              onClick={() => setBranchesSubTab('create-branch')}
            >
              {t('Create Branch')}
            </button>
            <button
              type="button"
              className={`subnav-btn ${branchesSubTab === 'branch-manager' ? 'active' : ''}`}
              onClick={() => {
                setBranchesSubTab('branch-manager');
                loadBranchesAndMappings();
              }}
            >
              {t('Assign Branch Manager')}
            </button>
            <button
              type="button"
              className={`subnav-btn ${branchesSubTab === 'store-manager' ? 'active' : ''}`}
              onClick={() => {
                setBranchesSubTab('store-manager');
                loadMyOrgAndStoreManager();
              }}
            >
              {t('Store Manager Account')}
            </button>
            <button
              type="button"
              className={`subnav-btn ${branchesSubTab === 'my-org' ? 'active' : ''}`}
              onClick={() => {
                setBranchesSubTab('my-org');
                loadMyOrgAndStoreManager();
              }}
            >
              {t('Organisation Profile')}
            </button>
          </div>

          {branchesSubTab === 'create-branch' && (
            <div className="card narrow">
              <div className="card-header">
                <h3 className="card-title">{t('Create New Branch & Manager Account', 'புதிய கிளை & மேலாளர் கணக்கு உருவாக்கு')}</h3>
              </div>
              <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
                {t('Create a branch and automatically provision its dedicated Branch Manager credentials in Supabase PostgreSQL.', 'ஒரு கிளையை உருவாக்கி அதற்கான கிளை மேலாளர் கணக்கை தானாக உருவாக்கவும்.')}
              </p>
              <form onSubmit={handleCreateBranch}>
                <div className="form-grid">
                  <label>
                    {t('Branch Name')} *
                    <input
                      required
                      placeholder={language === 'ta' ? 'எ.கா. மதுரை தெற்கு கிளை' : 'e.g. Madurai South Branch'}
                      value={branchForm.name}
                      onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                    />
                  </label>

                  <label>
                    {t('Location')} *
                    <input
                      required
                      placeholder={language === 'ta' ? 'எ.கா. மதுரை' : 'e.g. Madurai'}
                      value={branchForm.location}
                      onChange={e => setBranchForm({ ...branchForm, location: e.target.value })}
                    />
                  </label>

                  <label>
                    {t('User ID / Username')} *
                    <input
                      required
                      placeholder="e.g. Branch2"
                      value={branchForm.managerUsername}
                      onChange={e => setBranchForm({ ...branchForm, managerUsername: e.target.value })}
                    />
                  </label>

                  <label>
                    {t('Password')} *
                    <input
                      required
                      type="password"
                      placeholder={t('Enter Password')}
                      value={branchForm.managerPassword}
                      onChange={e => setBranchForm({ ...branchForm, managerPassword: e.target.value })}
                    />
                  </label>

                  <label style={{ gridColumn: '1 / -1' }}>
                    {t('Contact Number')} ({t('Notes (Optional)')})
                    <input
                      placeholder="e.g. 9876543210"
                      value={branchForm.contact}
                      onChange={e => setBranchForm({ ...branchForm, contact: e.target.value })}
                    />
                  </label>
                </div>

                <div className="form-actions">
                  <button type="submit" className="primary" disabled={loading}>
                    {loading ? t('Loading...') : t('Create Branch')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {branchesSubTab === 'branch-manager' && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">{t('Branch-to-Manager Mapping', 'கிளை மற்றும் மேலாளர் பட்டியல்')}</h3>
                <span className="muted">{branchMappings.length} {t('Active Branches', 'செயலில் உள்ள கிளைகள்')}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t('Branch Name')}</th>
                      <th>{t('Location')}</th>
                      <th>{t('User ID / Username')}</th>
                      <th>{t('Contact Number')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchMappings.length > 0 ? (
                      branchMappings.map((m, idx) => (
                        <tr key={m.branchId || idx}>
                          <td>{idx + 1}</td>
                          <td><b>{m.branchName}</b></td>
                          <td>{m.location}</td>
                          <td>
                            <code style={{ background: '#f4ebd5', padding: '3px 8px', borderRadius: 4, color: 'var(--green)', fontWeight: 600 }}>
                              {m.managerUsername}
                            </code>
                          </td>
                          <td>{m.contact || '—'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="empty">{t('No records found.')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-TAB 3: STORE MANAGER ACCOUNT */}
          {branchesSubTab === 'store-manager' && (
            <div className="card narrow">
              <div className="card-header">
                <h3 className="card-title">🏪 {t('Store Manager Account')}</h3>
              </div>
              <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
                {storeManager
                  ? t('Manage central warehouse store manager account for your organisation.')
                  : t('Configure the central warehouse store manager credentials for your organisation.')}
              </p>

              {storeManager && (
                <div style={{ background: '#f8fdf9', border: '1px solid #b7e4c7', borderRadius: 6, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="muted">{t('Active Store Manager')}:</span>
                    <b>{storeManager.username}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="muted">{t('Full Name')}:</span>
                    <span>{storeManager.fullName || '—'}</span>
                  </div>
                  {storeManager.createdAt && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="muted">{t('Created')}:</span>
                      <span>{new Date(storeManager.createdAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSaveStoreManager}>
                <div className="form-group">
                  <label>{t('Store Manager Username')} *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. store@saravanas"
                    value={storeManagerForm.username}
                    onChange={(e) => setStoreManagerForm({ ...storeManagerForm, username: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginTop: 10 }}>
                  <label>{t('Store Manager Full Name')}</label>
                  <input
                    type="text"
                    placeholder="e.g. Central Warehouse Manager"
                    value={storeManagerForm.fullName}
                    onChange={(e) => setStoreManagerForm({ ...storeManagerForm, fullName: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginTop: 10 }}>
                  <label>
                    {storeManager ? t('Reset / Update Password (leave blank to keep current)') : `${t('Initial Password')} *`}
                  </label>
                  <input
                    type="password"
                    placeholder={storeManager ? t('Enter new password or leave blank') : t('Enter password')}
                    value={storeManagerForm.password}
                    onChange={(e) => setStoreManagerForm({ ...storeManagerForm, password: e.target.value })}
                  />
                </div>

                <div className="card-actions" style={{ marginTop: 18 }}>
                  <button type="submit" className="primary" disabled={savingStoreManager}>
                    {savingStoreManager ? t('Saving...') : t('Save Store Manager')}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SUB-TAB 4: ORGANISATION PROFILE */}
          {branchesSubTab === 'my-org' && (
            <div className="card narrow">
              <div className="card-header">
                <h3 className="card-title">🏢 {t('Organisation Profile')}</h3>
              </div>
              {myOrg ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f3f5', paddingBottom: 6 }}>
                    <span className="muted">{t('Organisation Name')}:</span>
                    <b style={{ color: '#1b4332' }}>{myOrg.name}</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f3f5', paddingBottom: 6 }}>
                    <span className="muted">{t('Organisation Code')}:</span>
                    <code style={{ background: '#e9ecef', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>{myOrg.code}</code>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f3f5', paddingBottom: 6 }}>
                    <span className="muted">{t('Organisation Status')}:</span>
                    <span style={{ fontWeight: 700, color: myOrg.status === 'ACTIVE' ? '#0f5132' : '#842029' }}>
                      {myOrg.status === 'ACTIVE' ? t('Active') : t('Inactive')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f3f5', paddingBottom: 6 }}>
                    <span className="muted">{t('Organisation Admin Name')}:</span>
                    <span>{myOrg.adminName || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f3f5', paddingBottom: 6 }}>
                    <span className="muted">{t('Admin Email / User ID')}:</span>
                    <span style={{ color: '#0d6efd' }}>{myOrg.adminEmail || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f3f5', paddingBottom: 6 }}>
                    <span className="muted">{t('Contact Phone')}:</span>
                    <span>{myOrg.contactPhone || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f3f5', paddingBottom: 6 }}>
                    <span className="muted">{t('Address')}:</span>
                    <span>{myOrg.address || '—'}</span>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#6c757d' }}>
                  {t('Loading organisation details...')}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* =========================================================================
          ORDER TAB
          ========================================================================= */}
      {activeTab === 'order' && (
        <section>
          <div className="subnav">
            <button
              type="button"
              className={`subnav-btn ${orderSubTab === 'new-item' ? 'active' : ''}`}
              onClick={() => {
                setOrderSubTab('new-item');
                loadPlacedNewItemOrders(newItemOrderDate, newItemIsAllDates);
              }}
            >
              {t('New Item')}
            </button>
            <button
              type="button"
              className={`subnav-btn ${orderSubTab === 'requested-item' ? 'active' : ''}`}
              onClick={() => {
                setOrderSubTab('requested-item');
                loadRequestedOrders(requestedOrderDate, requestedIsAllDates);
              }}
            >
              {t('Requested Item')}
            </button>
          </div>

          {/* SUB-TAB 1: NEW ITEM */}
          {orderSubTab === 'new-item' && (
            <div>
              <div className="card narrow">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div>
                    <h3 className="card-title">{t('Order New Catalogue Items', 'புதிய பொருட்கள் கொள்முதல் ஆர்டர்')}</h3>
                    <p className="muted" style={{ margin: '4px 0 0' }}>
                      {t('Order items that do not yet exist in the central catalogue. Multiple new items can be added to the list before placing the purchase order. Stock will only increase when physically received by the Store Manager.', 'மைய பட்டியலில் இல்லாத புதிய பொருட்களை சப்ளையர்களிடம் ஆர்டர் செய்யவும்.')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={handleAddNewItemToList}
                    style={{ whiteSpace: 'nowrap', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    title="Add Item to List (F5 shortcut)"
                  >
                    <span>➕</span> {t('Add Item')} <kbd style={{ fontSize: 10, opacity: 0.85, padding: '1px 5px', background: 'rgba(0,0,0,0.06)', borderRadius: 3 }}>F5</kbd>
                  </button>
                </div>

                <div className="form-grid cols-3" style={{ marginTop: 12 }}>
                  <label>
                    {t('Item Name')} *
                    <input
                      ref={adminItemInputRef}
                      placeholder={language === 'ta' ? 'எ.கா. பாஸ்மதி அரிசி' : 'e.g. Sona Masoori Rice'}
                      value={newItemName}
                      onChange={e => setNewItemName(e.target.value)}
                    />
                  </label>
                  <label>
                    {t('Unit')} *
                    <select value={newItemUnit} onChange={e => setNewItemUnit(e.target.value)}>
                      <option value="KG">{language === 'ta' ? 'கிலோ (KG)' : 'KG (Kilograms)'}</option>
                      <option value="L">{language === 'ta' ? 'லிட்டர் (L)' : 'L (Liters)'}</option>
                      <option value="Packet">{t('packet', 'பாக்கெட் (Packet)')}</option>
                      <option value="Box">{t('box', 'பெட்டி (Box)')}</option>
                      <option value="Bag">{t('bag', 'பை (Bag)')}</option>
                      <option value="Unit">{t('piece', 'எண்ணிக்கை (Unit)')}</option>
                    </select>
                  </label>
                  <label>
                    {t('Quantity to Order', 'ஆர்டர் அளவு')} *
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 50"
                      value={newItemQty}
                      onChange={e => setNewItemQty(e.target.value)}
                    />
                  </label>
                </div>

                <div className="form-actions">
                  <button type="button" className="secondary" onClick={handleAddNewItemToList}>
                    {t('+ Add Item to List', '+ பட்டியலில் பொருள் சேர்')}
                  </button>
                </div>
              </div>

              {/* Prepared New Items Table */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">{t('Items Prepared for Purchase Order', 'கொள்முதல் ஆர்டருக்கு தயார் செய்யப்பட்ட பொருட்கள்')}</h3>
                  <span className="muted">{newItemsList.length} {t('items')} {t('in List', 'பட்டியலில்')}</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('Item Name')}</th>
                        <th>{t('Unit')}</th>
                        <th>{t('Quantity to Order', 'ஆர்டர் அளவு')}</th>
                        <th>{t('Action')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newItemsList.length > 0 ? (
                        newItemsList.map(item => (
                          <tr key={item.id}>
                            <td><b>{translateItem(item.name)}</b></td>
                            <td>{translateUnit(item.unit)}</td>
                            <td><span style={{ fontWeight: 700, color: 'var(--green)' }}>{item.quantity}</span></td>
                            <td>
                              <button
                                type="button"
                                className="danger small"
                                onClick={() => handleRemoveNewItem(item.id)}
                              >
                                {t('Remove')}
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="empty">
                            {t('No items added yet. Use the form above to add items before placing order.', 'இதுவரை எந்தப் பொருட்களும் சேர்க்கப்படவில்லை. ஆர்டர் செய்வதற்கு முன் மேலுள்ள படிவத்தைப் பயன்படுத்தவும்.')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {newItemsList.length > 0 && (
                  <div className="form-actions" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="primary"
                      disabled={submittingOrder}
                      onClick={handlePlaceOrder}
                    >
                      {submittingOrder ? t('Order submission in progress. Please wait a moment.') : t('Place Order with Supplier', 'வழங்குநரிடம் ஆர்டர் சமர்ப்பிக்கவும்')}
                    </button>
                  </div>
                )}
              </div>

              {/* Placed New Item Orders History with Date Filter */}
              <div className="card" style={{ marginTop: 24 }}>
                <div className="card-header">
                  <div>
                    <h3 className="card-title">{t('Placed New Item Purchase Orders', 'வழங்கப்பட்ட புதிய பொருட்கள் கொள்முதல் ஆர்டர்கள்')}</h3>
                    <p className="muted" style={{ margin: '4px 0 0' }}>
                      {t('Orders placed directly with suppliers for new catalogue additions, organized by creation date.', 'சப்ளையர்களிடம் நேரடியாக வைக்கப்பட்ட புதிய பொருட்கள் ஆர்டர்கள்.')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => loadPlacedNewItemOrders(newItemOrderDate, newItemIsAllDates)}
                  >
                    {t('↻ Refresh')}
                  </button>
                </div>

                <DateFilterBar
                  label="Order Creation Date"
                  selectedDate={newItemOrderDate}
                  onDateChange={(d) => {
                    setNewItemOrderDate(d);
                    setNewItemIsAllDates(false);
                  }}
                  isAllDates={newItemIsAllDates}
                  onToggleAllDates={(all) => setNewItemIsAllDates(all)}
                  totalCount={placedNewItemOrders.length}
                />

                {(() => {
                  const filteredOrders = placedNewItemOrders.filter(po => {
                    if (newItemIsAllDates) return true;
                    const d = toLocalDateString(po.orderDate || po.createdAt);
                    return d === newItemOrderDate;
                  });

                  if (filteredOrders.length === 0) {
                    return (
                      <EmptyDateMessage
                        date={newItemIsAllDates ? null : newItemOrderDate}
                        message={newItemIsAllDates ? t('No records found.') : undefined}
                        onResetToday={() => {
                          setNewItemOrderDate(getTodayDateString());
                          setNewItemIsAllDates(false);
                        }}
                        onShowAll={() => setNewItemIsAllDates(true)}
                      />
                    );
                  }

                  if (newItemIsAllDates) {
                    const groups = groupByDate(filteredOrders, po => po.orderDate || po.createdAt, language);
                    return groups.map(grp => (
                      <div key={grp.date} style={{ marginBottom: 20 }}>
                        <DateSectionHeader label={grp.label} count={grp.items.length} date={grp.date} />
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>{t('Order Number')}</th>
                                <th>{t('Item Name')}</th>
                                <th>{t('Unit')}</th>
                                <th>{t('Ordered Quantity')}</th>
                                <th>{t('Status')}</th>
                                <th>{t('Creation Time')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grp.items.map(po => (
                                <tr key={po.id}>
                                  <td><code>{po.poNumber || `PO-${po.id}`}</code></td>
                                  <td><b>{translateItem(po.item)}</b></td>
                                  <td>{translateUnit(po.unit)}</td>
                                  <td><span style={{ fontWeight: 700, color: 'var(--green)' }}>{po.quantity}</span></td>
                                  <td>
                                    <span className="badge badge-ordered">{translateStatus(po.status)}</span>
                                  </td>
                                  <td>{formatDateTime(po.createdAt, language)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ));
                  }

                  // Single date view
                  return (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('Order Number')}</th>
                            <th>{t('Item Name')}</th>
                            <th>{t('Unit')}</th>
                            <th>{t('Ordered Quantity')}</th>
                            <th>{t('Status')}</th>
                            <th>{t('Creation Time')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOrders.map(po => (
                            <tr key={po.id}>
                              <td><code>{po.poNumber || `PO-${po.id}`}</code></td>
                              <td><b>{translateItem(po.item)}</b></td>
                              <td>{translateUnit(po.unit)}</td>
                              <td><span style={{ fontWeight: 700, color: 'var(--green)' }}>{po.quantity}</span></td>
                              <td>
                                <span className="badge badge-ordered">{translateStatus(po.status)}</span>
                              </td>
                              <td>{formatDateTime(po.createdAt, language)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* SUB-TAB 2: REQUESTED ITEM (Purchase orders submitted by Store Manager) */}
          {orderSubTab === 'requested-item' && (() => {
            const displayedOrders = requestedOrders.filter(group => {
              if (requestedIsAllDates) return true;
              const gDate = toLocalDateString(group.orderDate || group.createdAt);
              return gDate === requestedOrderDate;
            }).sort((a, b) => {
              const timeA = new Date(a.createdAt || 0).getTime();
              const timeB = new Date(b.createdAt || 0).getTime();
              return timeB - timeA;
            });

            return (
              <div>
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h3 className="card-title">{t('Store Manager Purchase Requests', 'கிடங்கு மேலாளரின் கொள்முதல் கோரிக்கைகள்')}</h3>
                      <p className="muted" style={{ margin: '4px 0 0' }}>
                        {t('Review submitted purchase orders organized by creation date. Click View Order to review and mark as ordered with suppliers.', 'சமர்ப்பிக்கப்பட்ட கொள்முதல் ஆர்டர்களை ஆய்வு செய்யவும். சப்ளையர்களிடம் வைக்க ஆர்டரைக் காண்க என்பதை கிளிக் செய்யவும்.')}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="secondary small"
                      onClick={() => loadRequestedOrders(requestedOrderDate, requestedIsAllDates)}
                    >
                      {t('↻ Refresh')}
                    </button>
                  </div>

                  {/* Standard Date Filter Bar */}
                  <DateFilterBar
                    label="PO Creation Date"
                    selectedDate={requestedOrderDate}
                    onDateChange={(d) => {
                      setRequestedOrderDate(d);
                      setRequestedIsAllDates(false);
                    }}
                    isAllDates={requestedIsAllDates}
                    onToggleAllDates={(all) => setRequestedIsAllDates(all)}
                    totalCount={displayedOrders.length}
                  />

                  {displayedOrders.length === 0 ? (
                    <EmptyDateMessage
                      date={requestedIsAllDates ? null : requestedOrderDate}
                      message={requestedIsAllDates ? t('No records found.') : undefined}
                      onResetToday={() => {
                        setRequestedOrderDate(getTodayDateString());
                        setRequestedIsAllDates(false);
                      }}
                      onShowAll={() => setRequestedIsAllDates(true)}
                    />
                  ) : requestedIsAllDates ? (
                    /* All Dates selected: Group into date sections, newest first */
                    (() => {
                      const groups = groupByDate(displayedOrders, g => g.orderDate || g.createdAt, language);
                      return groups.map(grp => (
                        <div key={grp.date} style={{ marginBottom: 24 }}>
                          <DateSectionHeader label={grp.label} count={grp.items.length} date={grp.date} />
                          <div className="table-wrap">
                            <table>
                              <thead>
                                <tr>
                                  <th>{t('Order Number')}</th>
                                  <th>{t('Status')}</th>
                                  <th style={{ textAlign: 'right' }}>{t('Action')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {grp.items.map(group => {
                                  const isPending = (group.status || 'PENDING') === 'PENDING';
                                  return (
                                    <tr key={group.orderNumber}>
                                      <td><b>{group.orderNumber}</b></td>
                                      <td>
                                        <span className={`badge ${
                                          isPending ? 'badge-pending' :
                                          group.status === 'ORDERED' ? 'badge-ordered' : 'badge-completed'
                                        }`}>
                                          {translateStatus(group.status || 'PENDING')}
                                        </span>
                                      </td>
                                      <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                                          <button
                                            type="button"
                                            className="primary small"
                                            onClick={() => handleViewAdminOrder(group)}
                                          >
                                            {t('View Order')}
                                          </button>
                                          <button
                                            type="button"
                                            className="secondary small"
                                            onClick={() => handleDownloadPdf(group)}
                                            title={`Download PDF for ${group.orderNumber}`}
                                          >
                                            {t('Download PDF')}
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ));
                    })()
                  ) : (
                    /* Specific Date selected: Show only records for this date */
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('Order Number')}</th>
                            <th>{t('Status')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Action')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedOrders.map(group => {
                            const isPending = (group.status || 'PENDING') === 'PENDING';
                            return (
                              <tr key={group.orderNumber}>
                                <td><b>{group.orderNumber}</b></td>
                                <td>
                                  <span className={`badge ${
                                    isPending ? 'badge-pending' :
                                    group.status === 'ORDERED' ? 'badge-ordered' : 'badge-completed'
                                  }`}>
                                    {translateStatus(group.status || 'PENDING')}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                                    <button
                                      type="button"
                                      className="primary small"
                                      onClick={() => handleViewAdminOrder(group)}
                                    >
                                      {t('View Order')}
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary small"
                                      onClick={() => handleDownloadPdf(group)}
                                      title={`Download PDF for ${group.orderNumber}`}
                                    >
                                      {t('Download PDF')}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* VIEW / REVIEW ORDER MODAL */}
                  {selectedAdminOrder && (() => {
                    const { dateStr, timeStr } = parseOrderDateTime(selectedAdminOrder.createdAt, selectedAdminOrder.orderDate, language);
                    return (
                      <div className="modal-overlay" onClick={() => setSelectedAdminOrder(null)}>
                        <div className="modal-content order-modal-dialog" onClick={e => e.stopPropagation()}>
                          <div className="order-modal-header">
                            <div>
                              <h3>{selectedAdminOrder.orderNumber}</h3>
                              <p className="order-modal-subtitle">
                                {t('Order Created')}: <b>{dateStr}</b>{timeStr !== '—' && <>{language === 'ta' ? ' நேரம் ' : ' at '}<b>{timeStr}</b></>}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="close-btn"
                              onClick={() => setSelectedAdminOrder(null)}
                              aria-label={t('Close')}
                            >
                              ✕
                            </button>
                          </div>

                          <div className="order-modal-body">
                            <table className="two-col-table">
                              <thead>
                                <tr>
                                  <th>{t('Item Name')}</th>
                                  <th style={{ textAlign: 'right' }}>{t('Quantity')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedAdminOrder.lines && selectedAdminOrder.lines.length > 0 ? (
                                  selectedAdminOrder.lines.map((line, idx) => {
                                    const rawName = line.itemName || line.item || '—';
                                    const name = translateItem(rawName);
                                    const rawUnit = line.unit ? translateUnit(line.unit) : '';
                                    const unitText = rawUnit ? ` ${rawUnit}` : '';
                                    const qty = line.quantity ?? line.orderQuantity ?? 0;
                                    return (
                                      <tr key={idx}>
                                        <td><b>{name}</b></td>
                                        <td style={{ textAlign: 'right' }}>
                                          <span style={{ fontWeight: 600 }}>
                                            {qty}{unitText}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })
                                ) : (
                                  <tr>
                                    <td colSpan="2" className="empty">{t('No item lines found in this order.')}</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          <div className="order-modal-footer">
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => handleDownloadPdf(selectedAdminOrder)}
                            >
                              {t('Download PDF')}
                            </button>
                            {(selectedAdminOrder.status || 'PENDING') === 'PENDING' ? (
                              <button
                                type="button"
                                className="primary"
                                onClick={() => handleMarkOrderGroupAsOrdered(selectedAdminOrder.orderNumber)}
                              >
                                {t('Mark as Ordered')}
                              </button>
                            ) : (
                              <span className="badge badge-ordered" style={{ alignSelf: 'center', marginRight: 'auto' }}>
                                {t('✓ Marked as Ordered')}
                              </span>
                            )}
                            <button
                              type="button"
                              className="primary"
                              onClick={() => setSelectedAdminOrder(null)}
                            >
                              {t('Close')}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* =========================================================================
          HISTORY TAB
          ========================================================================= */}
      {activeTab === 'history' && (() => {
        const sortedHistory = [...historyOrders].sort((a, b) => {
          const timeA = new Date(a.createdAt || a.orderDate || 0).getTime();
          const timeB = new Date(b.createdAt || b.orderDate || 0).getTime();
          return timeB - timeA;
        });

        const isGroupedView = historyIsAllDates || historyFromDate || historyToDate || !historyDate;

        return (
          <section className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">{t('Purchase Order History', 'கொள்முதல் ஆர்டர் வரலாறு')}</h3>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {t('Complete historical purchase orders organized by their original order creation dates.', 'உருவாக்கப்பட்ட தேதி வாரியாக ஒழுங்கமைக்கப்பட்ட முழுமையான கொள்முதல் ஆர்டர் வரலாறு.')}
                </p>
              </div>
              <button type="button" className="secondary small" onClick={loadHistory}>
                {t('↻ Refresh')}
              </button>
            </div>

            {/* Date filter with range support & search */}
            <DateFilterBar
              label="Order Date"
              selectedDate={historyDate}
              onDateChange={(d) => {
                setHistoryDate(d);
                setHistoryIsAllDates(false);
                setHistoryFromDate('');
                setHistoryToDate('');
              }}
              isAllDates={historyIsAllDates}
              onToggleAllDates={(all) => {
                setHistoryIsAllDates(all);
                if (all) {
                  setHistoryDate('');
                  setHistoryFromDate('');
                  setHistoryToDate('');
                } else {
                  setHistoryDate(getTodayDateString());
                }
              }}
              showRange={true}
              fromDate={historyFromDate}
              toDate={historyToDate}
              onFromDateChange={(fd) => {
                setHistoryFromDate(fd);
                setHistoryIsAllDates(false);
              }}
              onToDateChange={(td) => {
                setHistoryToDate(td);
                setHistoryIsAllDates(false);
              }}
              totalCount={sortedHistory.length}
              extraControls={
                <input
                  type="text"
                  className="search-input"
                  placeholder={language === 'ta' ? 'பொருள் மூலம் வடிகட்டு...' : 'Filter by item...'}
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadHistory()}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    minWidth: '160px'
                  }}
                />
              }
            />

            {sortedHistory.length === 0 ? (
              <EmptyDateMessage
                date={historyDate}
                message={loading ? t('Loading...') : t('No records found.')}
                onResetToday={() => {
                  setHistoryDate(getTodayDateString());
                  setHistoryIsAllDates(false);
                  setHistoryFromDate('');
                  setHistoryToDate('');
                  setHistorySearch('');
                }}
                onShowAll={() => {
                  setHistoryIsAllDates(true);
                  setHistoryFromDate('');
                  setHistoryToDate('');
                }}
              />
            ) : isGroupedView ? (
              /* Grouped by date, newest first */
              (() => {
                const groups = groupByDate(sortedHistory, po => po.orderDate || po.createdAt, language);
                return groups.map(grp => (
                  <div key={grp.date} style={{ marginBottom: 24 }}>
                    <DateSectionHeader label={grp.label} count={grp.items.length} date={grp.date} />
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('PO Creation Date')}</th>
                            <th>{t('Order Number')}</th>
                            <th>{t('Item Name')}</th>
                            <th>{t('Unit')}</th>
                            <th>{t('Ordered Quantity')}</th>
                            <th>{t('Received Quantity')}</th>
                            <th>{t('Status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grp.items.map(po => (
                            <tr key={po.id}>
                              <td>{formatDateLabel(po.orderDate || po.createdAt, language)}</td>
                              <td><code>{po.poNumber || `PO-${po.id}`}</code></td>
                              <td><b>{translateItem(po.item)}</b></td>
                              <td>{translateUnit(po.unit)}</td>
                              <td><span style={{ fontWeight: 700, color: 'var(--green)' }}>{po.quantity}</span></td>
                              <td><span style={{ fontWeight: 600 }}>{po.receivedQty || 0}</span></td>
                              <td>
                                <span className={`badge ${
                                  po.status === 'PENDING' ? 'badge-pending' :
                                  po.status === 'ORDERED' ? 'badge-ordered' :
                                  po.status === 'RECEIVED' ? 'badge-completed' : 'badge-partial'
                                }`}>
                                  {translateStatus(po.status)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ));
              })()
            ) : (
              /* Single Date view */
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('PO Creation Date')}</th>
                      <th>{t('Order Number')}</th>
                      <th>{t('Item Name')}</th>
                      <th>{t('Unit')}</th>
                      <th>{t('Ordered Quantity')}</th>
                      <th>{t('Received Quantity')}</th>
                      <th>{t('Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHistory.map(po => (
                      <tr key={po.id}>
                        <td>{formatDateLabel(po.orderDate || po.createdAt, language)}</td>
                        <td><code>{po.poNumber || `PO-${po.id}`}</code></td>
                        <td><b>{translateItem(po.item)}</b></td>
                        <td>{translateUnit(po.unit)}</td>
                        <td><span style={{ fontWeight: 700, color: 'var(--green)' }}>{po.quantity}</span></td>
                        <td><span style={{ fontWeight: 600 }}>{po.receivedQty || 0}</span></td>
                        <td>
                          <span className={`badge ${
                            po.status === 'PENDING' ? 'badge-pending' :
                            po.status === 'ORDERED' ? 'badge-ordered' :
                            po.status === 'RECEIVED' ? 'badge-completed' : 'badge-partial'
                          }`}>
                            {translateStatus(po.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })()}
    </div>
  );
}
