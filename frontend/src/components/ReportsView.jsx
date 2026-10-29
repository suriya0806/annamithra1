import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api';
import { useLanguage } from '../i18n/LanguageContext';
import { getTodayDateString, formatDateLabel } from '../utils/dateGrouping';
import {
  downloadSimpleInventoryPdf,
  downloadSimpleBranchRequestPdf,
  downloadSimpleDispatchPdf,
  exportReportCsv
} from '../utils/pdfGenerator';

/**
 * Format date or date-time string consistently:
 * e.g., '2026-10-22T04:20:29' -> '22 Oct 2026, 04:20 AM'
 * e.g., '2026-10-27' -> '27 Oct 2026'
 */
function formatDisplayDateTime(val, includeTime = false) {
  if (!val) return '—';
  let d;
  const str = String(val).trim();
  if (str.includes('T') || str.includes(' ') && str.includes(':')) {
    d = new Date(str.replace(' ', 'T'));
  } else {
    const parts = str.split('-');
    if (parts.length === 3) {
      d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      d = new Date(str);
    }
  }

  if (isNaN(d.getTime())) return str;

  const dateStr = d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const hasTime = str.includes('T') || (str.includes(':') && str.length > 10);
  if (includeTime && hasTime) {
    const timeStr = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${dateStr}, ${timeStr}`;
  }

  return dateStr;
}

/**
 * Maps raw backend statuses to meaningful, easy-to-understand labels:
 * Pending, Dispatched, Fully Received, Partially Received, Not Received
 */
function getMeaningfulRequestStatus(status) {
  if (!status) return 'Pending';
  const s = String(status).toUpperCase().trim();
  if (s === 'PENDING') return 'Pending';
  if (s === 'DISPATCHED') return 'Dispatched';
  if (s === 'PARTIALLY_DISPATCHED') return 'Partially Dispatched';
  if (s === 'PARTIALLY_RECEIVED') return 'Partially Received';
  if (s === 'FULLY_RECEIVED' || s === 'RECEIVED' || s === 'COMPLETED') return 'Fully Received';
  if (s === 'CANCELLED' || s === 'REJECTED') return 'Cancelled';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function getMeaningfulDispatchStatus(item) {
  // Check explicit acknowledgement status first
  const ack = item.acknowledgementStatus ? String(item.acknowledgementStatus).toUpperCase().trim() : '';
  if (ack === 'FULLY_RECEIVED') return 'Fully Received';
  if (ack === 'PARTIALLY_RECEIVED') return 'Partially Received';
  if (ack === 'NOT_RECEIVED') return 'Not Received';

  // Fallback to dispatch status
  const st = item.status ? String(item.status).toUpperCase().trim() : '';
  if (st === 'ACKNOWLEDGED') {
    return (item.shortageQuantity && item.shortageQuantity > 0) ? 'Partially Received' : 'Fully Received';
  }
  if (st === 'DISPATCHED') return 'Dispatched';
  if (st === 'PENDING') return 'Pending';

  return 'Pending';
}

/**
 * Returns CSS styling object for meaningful status badges matching the green, gold, cream theme.
 */
function getStatusBadgeStyle(status) {
  switch (status) {
    case 'Fully Received':
      return {
        background: '#EAF5EE',
        color: '#07543D',
        border: '1px solid #C4E5D0'
      };
    case 'Dispatched':
      return {
        background: '#EFF6FF',
        color: '#1E40AF',
        border: '1px solid #BFDBFE'
      };
    case 'Partially Received':
    case 'Partially Dispatched':
      return {
        background: '#FEF9C3',
        color: '#854D0E',
        border: '1px solid #FDE047'
      };
    case 'Pending':
      return {
        background: '#FFFBEB',
        color: '#B45309',
        border: '1px solid #FDE68A'
      };
    case 'Not Received':
    case 'Cancelled':
      return {
        background: '#FDEEED',
        color: '#B3261E',
        border: '1px solid #F9C9C6'
      };
    default:
      return {
        background: '#F8F3E5',
        color: '#17352B',
        border: '1px solid #E5DDC9'
      };
  }
}

export function ReportsView({ userRole }) {
  const { language, t, translateItem, translateUnit, translateStatus, translateCategory } = useLanguage();

  // 1. Category Tabs: 'inventory', 'requests', 'dispatches'
  const [activeTab, setActiveTab] = useState('inventory');

  // 2. Only two filters: Date and Branch
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [isAllDates, setIsAllDates] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('ALL');

  // Branch list
  const [branches, setBranches] = useState([]);

  // Data states
  const [rawInventory, setRawInventory] = useState([]);
  const [rawRequests, setRawRequests] = useState([]);
  const [rawDispatches, setRawDispatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load branch list once
  useEffect(() => {
    api.getBranches()
      .then(bList => {
        if (Array.isArray(bList)) setBranches(bList);
      })
      .catch(err => console.warn('Could not load branches for reports:', err));
  }, []);

  // Fetch report data from existing backend API
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'inventory') {
        const data = await api.getCentralInventoryReport();
        if (Array.isArray(data)) setRawInventory(data);
      } else if (activeTab === 'requests') {
        const queryDate = isAllDates ? '' : selectedDate;
        const branchParam = selectedBranch === 'ALL' ? '' : selectedBranch;
        const data = await api.getBranchRequestReport({
          fromDate: queryDate,
          toDate: queryDate,
          branch: branchParam
        });
        if (Array.isArray(data)) setRawRequests(data);
      } else if (activeTab === 'dispatches') {
        const queryDate = isAllDates ? '' : selectedDate;
        const branchParam = selectedBranch === 'ALL' ? '' : selectedBranch;
        const data = await api.getBranchDispatchReport({
          date: queryDate,
          branch: branchParam
        });
        if (Array.isArray(data)) setRawDispatches(data);

      }
    } catch (err) {
      console.error('Error loading report data:', err);
      setError(err.message || 'Failed to load report records');
    } finally {
      setLoading(false);
    }
  }, [activeTab, isAllDates, selectedDate, selectedBranch]);

  // Refetch when activeTab, date or branch changes
  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Filter and group records
  // "Group duplicate items where appropriate, combining quantities only when the item and unit match."
  const records = useMemo(() => {
    if (activeTab === 'inventory') {
      let list = rawInventory;

      // Date filtering for inventory: if a specific date is selected (e.g. today), filter by last updated date
      if (!isAllDates && selectedDate) {
        list = list.filter(item => {
          const updated = item.lastUpdated || (item.activity && item.activity[0]?.transactionDate) || item.createdAt;
          if (!updated) return false;
          return String(updated).slice(0, 10) === selectedDate;
        });
      }

      // Group duplicate items combining quantities only when item and unit match
      const groupMap = new Map();
      list.forEach(item => {
        const name = (item.itemName || item.name || '').trim();
        const unit = (item.unit || '').trim();
        const key = `${name.toLowerCase()}___${unit.toLowerCase()}`;
        const lastUpdated = item.lastUpdated || (item.activity && item.activity[0]?.transactionDate) || item.createdAt;

        if (!groupMap.has(key)) {
          groupMap.set(key, {
            id: item.itemId || item.id,
            itemName: name,
            unit: unit,
            currentStock: Number(item.currentStock) || 0,
            lastUpdated: lastUpdated,
            formattedLastUpdated: formatDisplayDateTime(lastUpdated, true)
          });
        } else {
          const existing = groupMap.get(key);
          existing.currentStock += (Number(item.currentStock) || 0);
          // Keep newest lastUpdated
          if (lastUpdated && (!existing.lastUpdated || new Date(lastUpdated) > new Date(existing.lastUpdated))) {
            existing.lastUpdated = lastUpdated;
            existing.formattedLastUpdated = formatDisplayDateTime(lastUpdated, true);
          }
        }
      });

      return Array.from(groupMap.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));
    }

    if (activeTab === 'requests') {
      let list = rawRequests;

      // Branch filter
      if (selectedBranch && selectedBranch !== 'ALL') {
        list = list.filter(r => (r.branchName || r.branch) === selectedBranch);
      }

      // Date filter
      if (!isAllDates && selectedDate) {
        list = list.filter(r => String(r.date || r.requestDate || '').slice(0, 10) === selectedDate);
      }

      // Group duplicate items combining quantities only when item and unit match
      const groupMap = new Map();
      list.forEach(r => {
        const branchName = (r.branchName || r.branch || '').trim();
        const itemName = (r.itemName || r.item || '').trim();
        const unit = (r.unit || '').trim();
        const department = (r.department || r.category || '').trim() || 'Not specified';
        const dateStr = String(r.date || r.requestDate || '').slice(0, 10);
        const meaningfulStatus = getMeaningfulRequestStatus(r.status);

        // Grouping key includes branch, department, item, unit, date, and status
        const key = `${branchName.toLowerCase()}___${department.toLowerCase()}___${itemName.toLowerCase()}___${unit.toLowerCase()}___${dateStr}___${meaningfulStatus.toLowerCase()}`;

        if (!groupMap.has(key)) {
          groupMap.set(key, {
            id: r.id,
            branchName,
            department,
            itemName,
            unit,
            requestedQuantity: Number(r.requestedQuantity || r.requested) || 0,
            date: dateStr,
            formattedDate: formatDisplayDateTime(dateStr, false),
            status: r.status,
            meaningfulStatus
          });
        } else {
          const existing = groupMap.get(key);
          existing.requestedQuantity += (Number(r.requestedQuantity || r.requested) || 0);
        }
      });

      return Array.from(groupMap.values()).sort((a, b) => {
        // Sort by date desc, then branch, then item
        if (b.date !== a.date) return (b.date || '').localeCompare(a.date || '');
        if (a.branchName !== b.branchName) return a.branchName.localeCompare(b.branchName);
        return a.itemName.localeCompare(b.itemName);
      });
    }

    if (activeTab === 'dispatches') {
      let list = rawDispatches;

      // Branch filter
      if (selectedBranch && selectedBranch !== 'ALL') {
        list = list.filter(d => d.branchName === selectedBranch);
      }

      // Date filter
      if (!isAllDates && selectedDate) {
        list = list.filter(d => String(d.dispatchDate || (d.dispatchDateTime ? d.dispatchDateTime.slice(0, 10) : '')).slice(0, 10) === selectedDate);
      }

      // Group duplicate items combining quantities only when item and unit match
      const groupMap = new Map();
      list.forEach(d => {
        const branchName = (d.branchName || '').trim();
        const itemName = (d.itemName || '').trim();
        const unit = (d.unit || '').trim();
        const dispatchDate = String(d.dispatchDate || (d.dispatchDateTime ? d.dispatchDateTime.slice(0, 10) : '')).slice(0, 10);
        const meaningfulStatus = getMeaningfulDispatchStatus(d);

        // Grouping key includes branch, item, unit, dispatchDate, and meaningfulStatus
        const key = `${branchName.toLowerCase()}___${itemName.toLowerCase()}___${unit.toLowerCase()}___${dispatchDate}___${meaningfulStatus.toLowerCase()}`;

        if (!groupMap.has(key)) {
          groupMap.set(key, {
            id: d.id,
            dispatchNumber: d.dispatchNumber,
            branchName,
            itemName,
            unit,
            dispatchedQuantity: Number(d.dispatchedQuantity || d.quantity) || 0,
            dispatchDate,
            formattedDate: formatDisplayDateTime(dispatchDate, false),
            status: d.status,
            acknowledgementStatus: d.acknowledgementStatus,
            meaningfulStatus
          });
        } else {
          const existing = groupMap.get(key);
          existing.dispatchedQuantity += (Number(d.dispatchedQuantity || d.quantity) || 0);
        }
      });

      return Array.from(groupMap.values()).sort((a, b) => {
        if (b.dispatchDate !== a.dispatchDate) return (b.dispatchDate || '').localeCompare(a.dispatchDate || '');
        if (a.branchName !== b.branchName) return a.branchName.localeCompare(b.branchName);
        return a.itemName.localeCompare(b.itemName);
      });
    }

    return [];
  }, [activeTab, rawInventory, rawRequests, rawDispatches, isAllDates, selectedDate, selectedBranch]);

  // Simple Total / Count calculation above the table
  const totals = useMemo(() => {
    if (activeTab === 'inventory') {
      const totalStock = records.reduce((sum, r) => sum + (Number(r.currentStock) || 0), 0);
      return {
        countLabel: `${t('Total Items', 'மொத்த பொருட்கள்')}: ${records.length}`,
        metricLabel: `${t('Total Stock', 'மொத்த இருப்பு')}: ${totalStock.toLocaleString()} ${language === 'ta' ? 'அலகுகள்' : 'units'}`
      };
    }
    if (activeTab === 'requests') {
      const totalRequested = records.reduce((sum, r) => sum + (Number(r.requestedQuantity) || 0), 0);
      return {
        countLabel: `${t('Total Requests', 'மொத்த கோரிக்கைகள்')}: ${records.length}`,
        metricLabel: `${t('Total Requested', 'மொத்த கோரப்பட்ட அளவு')}: ${totalRequested.toLocaleString()} ${language === 'ta' ? 'அலகுகள்' : 'units'}`
      };
    }
    if (activeTab === 'dispatches') {
      const totalDispatched = records.reduce((sum, r) => sum + (Number(r.dispatchedQuantity) || 0), 0);
      return {
        countLabel: `${t('Total Dispatches', 'மொத்த விநியோகங்கள்')}: ${records.length}`,
        metricLabel: `${t('Total Dispatched', 'மொத்த விநியோகம்')}: ${totalDispatched.toLocaleString()} ${language === 'ta' ? 'அலகுகள்' : 'units'}`
      };
    }
    return { countLabel: '', metricLabel: '' };
  }, [activeTab, records, language, t]);

  // Scope label for exports and UI display
  const dateScopeLabel = isAllDates ? t('All Dates', 'அனைத்து தேதிகள்') : (formatDateLabel(selectedDate, language) || selectedDate);
  const branchScopeLabel = selectedBranch === 'ALL' ? t('All Branches', 'அனைத்து கிளைகள்') : selectedBranch;

  // Handle Download PDF
  const handleDownloadPdf = async () => {
    try {
      if (activeTab === 'inventory') {
        await downloadSimpleInventoryPdf({
          items: records,
          dateLabel: dateScopeLabel
        });
      } else if (activeTab === 'requests') {
        await downloadSimpleBranchRequestPdf({
          items: records,
          branch: branchScopeLabel,
          dateLabel: dateScopeLabel
        });
      } else if (activeTab === 'dispatches') {
        await downloadSimpleDispatchPdf({
          items: records,
          branch: branchScopeLabel,
          dateLabel: dateScopeLabel
        });

      }
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  // Handle Export CSV
  const handleExportCsv = () => {
    const filename = `Annamithra_${activeTab}_report_${isAllDates ? 'all_dates' : selectedDate}.csv`;
    exportReportCsv({
      reportType: activeTab,
      items: records,
      filename
    });
  };

  return (
    <div className="page" style={{ padding: '16px 20px 40px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Page Title & Clean Subtitle */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--primary-dark-green)', fontSize: '22px', fontWeight: 800 }}>
            📊 {t('Reports', 'அறிக்கைகள்')}
          </h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
            {language === 'ta'
              ? 'சரக்கு இருப்பு, கிளைக் கோரிக்கைகள் மற்றும் விநியோகங்களின் தெளிவான சுருக்கமான அறிக்கைகள்.'
              : 'Clean, simple, and easy-to-understand operational reports for inventory, branch requests, and dispatches.'}
          </p>
        </div>
      </div>

      {/* 1. SIMPLE REPORT CATEGORIES TABS */}
      <div
        className="reports-tab-bar"
        role="tablist"
        aria-label="Report Categories"
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
          borderBottom: '2px solid var(--border-color)',
          paddingBottom: 10
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'inventory'}
          className={`btn ${activeTab === 'inventory' ? 'primary' : 'secondary'}`}
          onClick={() => setActiveTab('inventory')}
          style={{
            minHeight: 40,
            padding: '8px 18px',
            borderRadius: 6,
            fontWeight: activeTab === 'inventory' ? 700 : 500,
            fontSize: '13.5px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>📦</span>
          <span>{t('Inventory Report', 'சரக்கு இருப்பு அறிக்கை')}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'requests'}
          className={`btn ${activeTab === 'requests' ? 'primary' : 'secondary'}`}
          onClick={() => setActiveTab('requests')}
          style={{
            minHeight: 40,
            padding: '8px 18px',
            borderRadius: 6,
            fontWeight: activeTab === 'requests' ? 700 : 500,
            fontSize: '13.5px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>📋</span>
          <span>{t('Branch Request Report', 'கிளை கோரிக்கை அறிக்கை')}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'dispatches'}
          className={`btn ${activeTab === 'dispatches' ? 'primary' : 'secondary'}`}
          onClick={() => setActiveTab('dispatches')}
          style={{
            minHeight: 40,
            padding: '8px 18px',
            borderRadius: 6,
            fontWeight: activeTab === 'dispatches' ? 700 : 500,
            fontSize: '13.5px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>🚚</span>
          <span>{t('Dispatch Report', 'விநியோக அறிக்கை')}</span>
        </button>
      </div>

      {/* 2. ONLY TWO FILTERS: DATE AND BRANCH */}
      <div
        className="card"
        style={{
          background: 'var(--cream-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          padding: '14px 16px',
          marginBottom: 16
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14
          }}
        >
          {/* FILTER 1: DATE FILTER (Today, All Dates, or specific date picker) */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, flex: '1 1 340px' }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-dark-green)', whiteSpace: 'nowrap' }}>
              📅 {t('Date', 'தேதி')}:
            </span>

            {/* Today Button */}
            <button
              type="button"
              className={`btn small ${!isAllDates && selectedDate === getTodayDateString() ? 'primary' : 'secondary'}`}
              onClick={() => {
                setSelectedDate(getTodayDateString());
                setIsAllDates(false);
              }}
              style={{ minHeight: 34, padding: '5px 12px', fontSize: '12.5px', borderRadius: 4 }}
            >
              {t('Today', 'இன்று')}
            </button>

            {/* All Dates Button */}
            <button
              type="button"
              className={`btn small ${isAllDates ? 'primary' : 'secondary'}`}
              onClick={() => {
                setIsAllDates(true);
              }}
              style={{ minHeight: 34, padding: '5px 12px', fontSize: '12.5px', borderRadius: 4 }}
            >
              {t('All Dates', 'அனைத்து தேதிகள்')}
            </button>

            {/* Specific Date Picker Input */}
            <input
              type="date"
              value={isAllDates ? '' : selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                  setIsAllDates(false);
                }
              }}
              title={t('Select Date', 'தேதியைத் தேர்ந்தெடுக்கவும்')}
              style={{
                padding: '5px 8px',
                fontSize: '13px',
                minHeight: 34,
                borderRadius: 4,
                border: '1px solid var(--border-color)',
                background: isAllDates ? '#F8F9FA' : 'var(--white-surface)',
                maxWidth: 150
              }}
            />
          </div>

          {/* FILTER 2: BRANCH FILTER */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, flex: '1 1 260px' }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-dark-green)', whiteSpace: 'nowrap' }}>
              🌿 {t('Branch', 'கிளை')}:
            </span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{
                minHeight: 34,
                padding: '5px 10px',
                fontSize: '13px',
                borderRadius: 4,
                border: '1px solid var(--border-color)',
                background: 'var(--white-surface)',
                minWidth: 160,
                flex: 1
              }}
            >
              <option value="ALL">{t('All Branches', 'அனைத்து கிளைகள்')}</option>
              {branches.map(b => (
                <option key={b.id || b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
            {activeTab === 'inventory' && selectedBranch !== 'ALL' && (
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                  background: '#F0EAD6',
                  padding: '2px 8px',
                  borderRadius: 4
                }}
              >
                {language === 'ta' ? 'மைய கிடங்கு கையிருப்பு' : 'Central Warehouse Stock'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. SIMPLE TOTAL / COUNT & EXPORT BUTTONS BAR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '10px 14px',
          background: 'var(--cream-bg)',
          border: '1px solid var(--border-color)',
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          borderBottom: 'none'
        }}
      >
        {/* Simple Total Count on the Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--primary-dark-green)' }}>
            {totals.countLabel}
          </span>
          <span style={{ color: 'var(--gold)', fontWeight: 700 }}>•</span>
          <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--secondary-green)' }}>
            {totals.metricLabel}
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            ({t('Showing', 'காண்பிக்கப்படுகிறது')}: <b style={{ color: 'var(--dark-text)' }}>{dateScopeLabel}</b>
            {activeTab !== 'inventory' && selectedBranch !== 'ALL' ? `, ${selectedBranch}` : ''})
          </span>
        </div>

        {/* Action Buttons on the Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn secondary small"
            onClick={fetchReportData}
            disabled={loading}
            title={t('Refresh', 'புதுப்பி')}
            style={{
              minHeight: 34,
              padding: '6px 12px',
              fontSize: '12.5px',
              borderRadius: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <span>↻</span>
            <span>{loading ? t('Loading...', 'ஏற்றுகிறது...') : t('Refresh', 'புதுப்பி')}</span>
          </button>

          <button
            type="button"
            className="btn secondary small"
            onClick={handleExportCsv}
            disabled={loading || records.length === 0}
            style={{
              minHeight: 34,
              padding: '6px 14px',
              fontSize: '12.5px',
              borderRadius: 4,
              borderColor: 'var(--border-color)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5
            }}
          >
            <span>⬇</span>
            <span>{t('Export CSV', 'CSV ஏற்றுமதி செய்')}</span>
          </button>

          <button
            type="button"
            className="btn primary small"
            onClick={handleDownloadPdf}
            disabled={loading || records.length === 0}
            style={{
              minHeight: 34,
              padding: '6px 14px',
              fontSize: '12.5px',
              borderRadius: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5
            }}
          >
            <span>📄</span>
            <span>{t('Download PDF', 'PDF பதிவிறக்கு')}</span>
          </button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div style={{ padding: '12px', background: '#FDEEED', color: '#B3261E', border: '1px solid #F9C9C6', marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {/* 4. DATA TABLE / MOBILE CARDS VIEW */}
      {loading ? (
        <div
          style={{
            padding: '48px 16px',
            textAlign: 'center',
            background: 'var(--white-surface)',
            border: '1px solid var(--border-color)',
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: 8 }}>⏳</div>
          <div style={{ fontWeight: 600, color: 'var(--primary-dark-green)' }}>
            {language === 'ta' ? 'அறிக்கை பதிவுகள் ஏற்றப்படுகின்றன...' : 'Loading report records...'}
          </div>
        </div>
      ) : records.length === 0 ? (
        /* SIMPLE "NO RECORDS FOUND" MESSAGE */
        <div
          style={{
            padding: '44px 20px',
            textAlign: 'center',
            background: 'var(--white-surface)',
            border: '1px solid var(--border-color)',
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: 10 }}>📭</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary-dark-green)', marginBottom: 6 }}>
            {t('No records found matching the selected filters.', 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டிகளுக்கு பதிவுகள் எதுவும் இல்லை.')}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: 16 }}>
            {language === 'ta'
              ? 'வேறு தேதியைத் தேர்ந்தெடுக்கவும் அல்லது அனைத்து தேதிகளையும் பார்வையிட கீழே உள்ள பொத்தானைக் கிளிக் செய்யவும்.'
              : 'Try selecting a different date or click below to view records across all dates.'}
          </div>
          <div style={{ display: 'inline-flex', gap: 10 }}>
            <button
              type="button"
              className="btn secondary small"
              onClick={() => {
                setSelectedDate(getTodayDateString());
                setIsAllDates(false);
              }}
            >
              📅 {t('Today', 'இன்று')}
            </button>
            <button
              type="button"
              className="btn primary small"
              onClick={() => {
                setIsAllDates(true);
              }}
            >
              🗓️ {t('All Dates', 'அனைத்து தேதிகள்')}
            </button>
            {selectedBranch !== 'ALL' && (
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setSelectedBranch('ALL')}
              >
                🌿 {t('All Branches', 'அனைத்து கிளைகள்')}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--white-surface)',
            border: '1px solid var(--border-color)',
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
            overflow: 'hidden'
          }}
        >
          {/* DESKTOP TABLE VIEW (Visible on tablet/desktop) */}
          <div className="desktop-table-view">
            <div className="table-wrap" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
              <table style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--table-header-bg)', borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ width: 44, textAlign: 'center', padding: '10px 8px' }}>#</th>

                    {/* Report 1: Inventory columns */}
                    {activeTab === 'inventory' && (
                      <>
                        <th style={{ textAlign: 'left', padding: '10px 14px' }}>
                          {t('Item Name', 'பொருள் பெயர்')}
                        </th>
                        <th style={{ width: 100, textAlign: 'center', padding: '10px 10px' }}>
                          {t('Unit', 'அலகு')}
                        </th>
                        <th style={{ width: 140, textAlign: 'right', padding: '10px 16px' }}>
                          {t('Current Stock', 'தற்போதைய இருப்பு')}
                        </th>
                        <th style={{ width: 220, textAlign: 'left', padding: '10px 14px' }}>
                          {t('Last Updated', 'கடைசியாக புதுப்பிக்கப்பட்டது')}
                        </th>
                      </>
                    )}

                    {/* Report 2: Branch Request columns */}
                    {activeTab === 'requests' && (
                      <>
                        <th style={{ width: 160, textAlign: 'left', padding: '10px 14px' }}>
                          {t('Branch Name', 'கிளை பெயர்')}
                        </th>
                        <th style={{ width: 140, textAlign: 'left', padding: '10px 14px' }}>
                          {t('Department', 'துறை')}
                        </th>
                        <th style={{ textAlign: 'left', padding: '10px 14px' }}>
                          {t('Item Name', 'பொருள் பெயர்')}
                        </th>
                        <th style={{ width: 90, textAlign: 'center', padding: '10px 10px' }}>
                          {t('Unit', 'அலகு')}
                        </th>
                        <th style={{ width: 140, textAlign: 'right', padding: '10px 16px' }}>
                          {t('Requested Quantity', 'கோரப்பட்ட அளவு')}
                        </th>
                        <th style={{ width: 120, textAlign: 'center', padding: '10px 10px' }}>
                          {t('Request Date', 'கோரிக்கை தேதி')}
                        </th>
                        <th style={{ width: 150, textAlign: 'center', padding: '10px 14px' }}>
                          {t('Status', 'நிலை')}
                        </th>
                      </>
                    )}

                    {/* Report 3: Dispatch columns */}
                    {activeTab === 'dispatches' && (
                      <>
                        <th style={{ width: 180, textAlign: 'left', padding: '10px 14px' }}>
                          {t('Branch Name', 'கிளை பெயர்')}
                        </th>
                        <th style={{ textAlign: 'left', padding: '10px 14px' }}>
                          {t('Item Name', 'பொருள் பெயர்')}
                        </th>
                        <th style={{ width: 100, textAlign: 'center', padding: '10px 10px' }}>
                          {t('Unit', 'அலகு')}
                        </th>
                        <th style={{ width: 150, textAlign: 'right', padding: '10px 16px' }}>
                          {t('Dispatched Quantity', 'அனுப்பப்பட்ட அளவு')}
                        </th>
                        <th style={{ width: 130, textAlign: 'center', padding: '10px 10px' }}>
                          {t('Dispatch Date', 'அனுப்பப்பட்ட தேதி')}
                        </th>
                        <th style={{ width: 170, textAlign: 'center', padding: '10px 14px' }}>
                          {t('Acknowledgement Status', 'ஒப்புதல் நிலை')}
                        </th>
                      </>
                    )}

                  </tr>
                </thead>
                <tbody>
                  {records.map((row, idx) => (
                    <tr
                      key={row.id || idx}
                      style={{
                        background: idx % 2 === 1 ? 'var(--cream-bg)' : 'var(--white-surface)',
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background 0.12s ease'
                      }}
                    >
                      <td style={{ textAlign: 'center', padding: '10px 8px', color: 'var(--text-subtle)', fontSize: '12px' }}>
                        {idx + 1}
                      </td>

                      {/* 1. Inventory Row */}
                      {activeTab === 'inventory' && (
                        <>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--primary-dark-green)' }}>
                            {translateItem(row.itemName)}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 10px' }}>
                            <span style={{ background: '#F0EAD6', padding: '2px 8px', borderRadius: 4, fontSize: '12px', fontWeight: 600 }}>
                              {translateUnit(row.unit)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 700, fontSize: '14px', color: row.currentStock < 0 ? '#B3261E' : 'var(--dark-text)' }}>
                            {row.currentStock.toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '13px' }}>
                            {row.formattedLastUpdated}
                          </td>
                        </>
                      )}

                      {/* 2. Branch Request Row */}
                      {activeTab === 'requests' && (
                        <>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--primary-dark-green)' }}>
                            {row.branchName}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--dark-text)', fontSize: '13px' }}>
                            {row.department === 'Not specified' ? (
                              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                {t('Not specified', 'குறிப்பிடப்படவில்லை')}
                              </span>
                            ) : (
                              <span style={{ background: '#F4EBD9', padding: '2px 8px', borderRadius: 4, fontSize: '12px', fontWeight: 600, color: 'var(--primary-dark-green)' }}>
                                {translateCategory ? translateCategory(row.department) : row.department}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                            {translateItem(row.itemName)}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 10px' }}>
                            <span style={{ background: '#F0EAD6', padding: '2px 8px', borderRadius: 4, fontSize: '12px', fontWeight: 600 }}>
                              {translateUnit(row.unit)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 700, fontSize: '14px', color: 'var(--primary-dark-green)' }}>
                            {row.requestedQuantity.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 10px', color: 'var(--dark-text)', fontSize: '13px' }}>
                            {row.formattedDate}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 14px' }}>
                            <span
                              style={{
                                ...getStatusBadgeStyle(row.meaningfulStatus),
                                padding: '3px 10px',
                                borderRadius: 12,
                                fontSize: '12px',
                                fontWeight: 700,
                                display: 'inline-block'
                              }}
                            >
                              {translateStatus ? translateStatus(row.meaningfulStatus) : row.meaningfulStatus}
                            </span>
                          </td>
                        </>
                      )}

                      {/* 3. Dispatch Row */}
                      {activeTab === 'dispatches' && (
                        <>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--primary-dark-green)' }}>
                            {row.branchName}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                            {translateItem(row.itemName)}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 10px' }}>
                            <span style={{ background: '#F0EAD6', padding: '2px 8px', borderRadius: 4, fontSize: '12px', fontWeight: 600 }}>
                              {translateUnit(row.unit)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 700, fontSize: '14px', color: 'var(--secondary-green)' }}>
                            {row.dispatchedQuantity.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 10px', color: 'var(--dark-text)', fontSize: '13px' }}>
                            {row.formattedDate}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 14px' }}>
                            <span
                              style={{
                                ...getStatusBadgeStyle(row.meaningfulStatus),
                                padding: '3px 10px',
                                borderRadius: 12,
                                fontSize: '12px',
                                fontWeight: 700,
                                display: 'inline-block'
                              }}
                            >
                              {translateStatus ? translateStatus(row.meaningfulStatus) : row.meaningfulStatus}
                            </span>
                          </td>
                        </>
                      )}

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. RESPONSIVE COMPACT RECORD CARDS (Shown on mobile devices) */}
          <div className="mobile-card-list-view" style={{ padding: '10px', gap: 10 }}>
            {records.map((row, idx) => (
              <div
                key={row.id || idx}
                className="mobile-item-card"
                style={{
                  background: 'var(--white-surface)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 8,
                  padding: '12px 14px'
                }}
              >
                {/* Header: Item Name and Index */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary-dark-green)', lineHeight: 1.25 }}>
                      {translateItem(row.itemName)}
                    </div>
                    {row.branchName && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>
                        🌿 {row.branchName}
                      </div>
                    )}
                    {activeTab === 'requests' && (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                        {t('Department', 'துறை')}:{' '}
                        <b style={{ color: row.department === 'Not specified' ? 'var(--text-muted)' : 'var(--primary-dark-green)' }}>
                          {row.department === 'Not specified'
                            ? t('Not specified', 'குறிப்பிடப்படவில்லை')
                            : (translateCategory ? translateCategory(row.department) : row.department)}
                        </b>
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      background: '#F0EAD6',
                      color: 'var(--dark-text)',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 10
                    }}
                  >
                    #{idx + 1}
                  </span>
                </div>

                {/* Body Metrics Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 8,
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px dashed var(--border-color)',
                    fontSize: '12.5px'
                  }}
                >
                  {/* Unit */}
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{t('Unit', 'அலகு')}:</span>{' '}
                    <b style={{ color: 'var(--dark-text)' }}>{translateUnit(row.unit)}</b>
                  </div>

                  {/* Quantity / Stock */}
                  {activeTab === 'inventory' && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{t('Current Stock', 'தற்போதைய இருப்பு')}:</span>{' '}
                      <b style={{ color: row.currentStock < 0 ? '#B3261E' : 'var(--primary-dark-green)', fontSize: '14px' }}>
                        {row.currentStock.toLocaleString()}
                      </b>
                    </div>
                  )}

                  {activeTab === 'requests' && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{t('Requested Quantity', 'கோரப்பட்ட அளவு')}:</span>{' '}
                      <b style={{ color: 'var(--primary-dark-green)', fontSize: '14px' }}>
                        {row.requestedQuantity.toLocaleString()}
                      </b>
                    </div>
                  )}

                  {activeTab === 'dispatches' && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{t('Dispatched Quantity', 'அனுப்பப்பட்ட அளவு')}:</span>{' '}
                      <b style={{ color: 'var(--secondary-green)', fontSize: '14px' }}>
                        {row.dispatchedQuantity.toLocaleString()}
                      </b>
                    </div>
                  )}

                  {/* Date */}
                  <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        {activeTab === 'inventory' ? t('Last Updated', 'கடைசியாக புதுப்பிக்கப்பட்டது') : t('Date', 'தேதி')}:
                      </span>{' '}
                      <span style={{ color: 'var(--dark-text)', fontSize: '12px' }}>
                        {activeTab === 'inventory'
                          ? row.formattedLastUpdated
                          : row.formattedDate}
                      </span>
                    </div>

                    {/* Status Badge */}
                    {row.meaningfulStatus && (
                      <span
                        style={{
                          ...getStatusBadgeStyle(row.meaningfulStatus),
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: '11px',
                          fontWeight: 700
                        }}
                      >
                        {translateStatus ? translateStatus(row.meaningfulStatus) : row.meaningfulStatus}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
