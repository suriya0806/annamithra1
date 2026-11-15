import { formatQuantityWithUnit, formatUnitSummary } from '../utils/quantityFormatter.js';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api';
import { useLanguage } from '../i18n/LanguageContext';
import { getTodayDateString, formatDateLabel } from '../utils/dateGrouping';
import {
  downloadSimpleInventoryPdf,
  printSimpleInventoryReport,
  downloadSimpleBranchRequestPdf,
  printSimpleBranchRequestReport,
  downloadSimpleDispatchPdf,
  printSimpleDispatchReport,
  downloadCategorySummaryPdf,
  printCategorySummaryReport,
  downloadCategoryDetailPdf,
  printCategoryDetailReport,
  printConsolidatedBranchReportDirect,
  downloadConsolidatedBranchReportPdf,
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
 * Pending, Delivered, Fully Received, Partially Received, Not Received
 */
function getMeaningfulRequestStatus(status) {
  if (!status) return 'Pending';
  const s = String(status).toUpperCase().trim();
  if (s === 'PENDING') return 'Pending';
  if (s === 'DISPATCHED') return 'Delivered';
  if (s === 'PARTIALLY_DISPATCHED') return 'Partially Delivered';
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

  // Fallback to dispatch/delivery status
  const st = item.status ? String(item.status).toUpperCase().trim() : '';
  if (st === 'ACKNOWLEDGED') {
    return (item.shortageQuantity && item.shortageQuantity > 0) ? 'Partially Received' : 'Fully Received';
  }
  if (st === 'DISPATCHED') return 'Delivered';
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
    case 'Delivered':
    case 'Dispatched':
      return {
        background: '#EFF6FF',
        color: '#1E40AF',
        border: '1px solid #BFDBFE'
      };
    case 'Partially Received':
    case 'Partially Delivered':
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

/**
 * Helper to format unit quantity maps (e.g. {"KG": 100, "L": 50} -> "100 KG, 50 L")
 */
function formatUnitQuantities(unitMap, emptyFallback = '0') {
  return formatUnitSummary(unitMap, false, emptyFallback);
}

export function ReportsView({ userRole }) {
  const { language, t, translateItem, translateUnit, translateStatus, translateCategory } = useLanguage();

  const renderDepartmentBadge = (dept) => {
    const d = (dept || '').trim();
    const isUnassigned = !d || d === 'Unassigned' || d === 'Not specified' || d === 'null' || d === 'undefined';
    if (isUnassigned) {
      return (
        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
          {t('Unassigned', 'ஒதுக்கப்படவில்லை')}
        </span>
      );
    }
    const label = (translateCategory ? translateCategory(d) : d) || d;
    return (
      <span style={{ background: '#F4EBD9', padding: '2px 8px', borderRadius: 4, fontSize: '12px', fontWeight: 600, color: 'var(--primary-dark-green)' }}>
        {label}
      </span>
    );
  };

  const renderDepartmentLabel = (dept) => {
    const d = (dept || '').trim();
    const isUnassigned = !d || d === 'Unassigned' || d === 'Not specified' || d === 'null' || d === 'undefined';
    if (isUnassigned) {
      return (
        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {t('Unassigned', 'ஒதுக்கப்படவில்லை')}
        </span>
      );
    }
    return (translateCategory ? translateCategory(d) : d) || d;
  };

  const renderAcknowledgementStatusBadge = (status) => {
    if (!status) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    const s = String(status).toUpperCase();
    if (s === 'ACKNOWLEDGED' || s === 'COMPLETED' || s === 'CONFIRMED' || s === 'RECEIVED') {
      return (
        <span className="badge badge-completed" style={{ fontSize: '11.5px', padding: '3px 8px' }}>
          ✓ {t('Acknowledged', 'பெறப்பட்டது')}
        </span>
      );
    } else if (s === 'PARTIALLY_DELIVERED' || s === 'PARTIAL') {
      return (
        <span className="badge badge-processing" style={{ fontSize: '11.5px', padding: '3px 8px', background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}>
          ⚡ {t('Partially Delivered', 'பகுதி விநியோகம்')}
        </span>
      );
    } else if (s === 'PENDING_DELIVERY' || s === 'PENDING') {
      return (
        <span className="badge" style={{ fontSize: '11.5px', padding: '3px 8px', background: '#F3F4F6', color: '#4B5563', border: '1px solid #E5E7EB' }}>
          ⏳ {t('Pending Delivery', 'விநியோகம் நிலுவை')}
        </span>
      );
    } else if (s === 'PENDING_ACKNOWLEDGEMENT' || s === 'DISPATCHED' || s === 'DELIVERED') {
      return (
        <span className="badge" style={{ fontSize: '11.5px', padding: '3px 8px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
          📬 {t('Pending Ack', 'ஒப்புதல் நிலுவை')}
        </span>
      );
    }
    return <span className="badge" style={{ fontSize: '11.5px', padding: '3px 8px' }}>{status}</span>;
  };

  const getSummaryQuantityAndUnit = (row) => {
    const qMap = row?.quantityByUnit || {};
    const unitKeys = Object.keys(qMap);
    if (unitKeys.length === 1) {
      const u = unitKeys[0];
      const q = qMap[u];
      return {
        qty: Number(q).toLocaleString(),
        unit: u
      };
    } else if (unitKeys.length > 1) {
      return {
        qty: row.totalQuantityFormatted || unitKeys.map(k => `${Number(qMap[k]).toLocaleString()} ${k}`).join(', '),
        unit: unitKeys.join(', ')
      };
    }
    return {
      qty: row?.totalQuantityFormatted || '0',
      unit: '—'
    };
  };

  // 1. Category Tabs: 'inventory', 'requests', 'dispatches'
  const [activeTab, setActiveTab] = useState('inventory');

  // 2. Standardized Date Filter: Exactly two modes ('today' | 'custom')
  const [dateMode, setDateMode] = useState('today');
  const [fromDateInput, setFromDateInput] = useState(getTodayDateString());
  const [toDateInput, setToDateInput] = useState(getTodayDateString());
  const [appliedFromDate, setAppliedFromDate] = useState(getTodayDateString());
  const [appliedToDate, setAppliedToDate] = useState(getTodayDateString());
  const [dateRangeError, setDateRangeError] = useState(null);

  // Filters: Branch, Department, and Category
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');

  // Reusable Report View Toggle: 'summary' = Branch-wise / Category Summary View (default), 'details' = Item Breakdown Details View
  const [viewMode, setViewMode] = useState('summary');
  const [consolidatedData, setConsolidatedData] = useState(null);

  // Branch Request View Toggle: false = Consolidated View, true = Department-wise View
  const [departmentBreakdown, setDepartmentBreakdown] = useState(false);

  // Category Detail view focus: null = Summary View, string = Category Name
  const [selectedCategoryView, setSelectedCategoryView] = useState(null);

  // Effective inclusive date range for report queries and calculations
  const today = getTodayDateString();
  const effectiveFromDate = dateMode === 'today' ? today : appliedFromDate;
  const effectiveToDate = dateMode === 'today' ? today : appliedToDate;

  // Branch, Department, and Category lists
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [itemCategories, setItemCategories] = useState([]);

  // Data states
  const [rawInventory, setRawInventory] = useState([]);
  const [rawRequests, setRawRequests] = useState([]);
  const [rawDispatches, setRawDispatches] = useState([]);
  const [rawCategoryReport, setRawCategoryReport] = useState({ summary: [], items: [] });
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [directPrinting, setDirectPrinting] = useState(false);
  const [error, setError] = useState(null);

  // Helper to format date as DD/MM/YYYY
  const formatDisplayDate = useCallback((dStr) => {
    if (!dStr) return '';
    const clean = String(dStr).slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return clean;
  }, []);

  // Handle applying Custom Range filter with strict validation
  const handleApplyCustomRange = useCallback(() => {
    if (!fromDateInput || !toDateInput) {
      setDateRangeError(language === 'ta'
        ? 'தொடக்க தேதி மற்றும் முடிவு தேதி இரண்டையும் தேர்ந்தெடுக்கவும்.'
        : 'Please select both From Date and To Date.');
      return;
    }
    if (fromDateInput > toDateInput) {
      setDateRangeError(language === 'ta'
        ? 'தொடக்க தேதி முடிவு தேதியை விட பிந்தையதாக இருக்கக்கூடாது.'
        : 'From Date cannot be later than To Date.');
      return;
    }
    setDateRangeError(null);
    setAppliedFromDate(fromDateInput);
    setAppliedToDate(toDateInput);
  }, [fromDateInput, toDateInput, language]);

  // Load branch list and department list once
  useEffect(() => {
    api.getBranches()
      .then(bList => {
        if (Array.isArray(bList)) setBranches(bList);
      })
      .catch(err => console.warn('Could not load branches for reports:', err));

    api.getDepartments()
      .then(dList => {
        if (Array.isArray(dList)) setDepartments(dList);
      })
      .catch(err => console.warn('Could not load departments for reports:', err));

    api.getCategories()
      .then(cList => {
        if (Array.isArray(cList)) setItemCategories(cList);
      })
      .catch(err => console.warn('Could not load categories for reports:', err));
  }, []);

  // Fetch report data from existing backend API with synchronized date boundaries
  const fetchReportData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'inventory') {
        const [data, consData] = await Promise.all([
          api.getCentralInventoryReport({
            fromDate: effectiveFromDate,
            toDate: effectiveToDate
          }).catch(() => []),
          api.getConsolidatedCentralInventoryReport({
            fromDate: effectiveFromDate,
            toDate: effectiveToDate
          }).catch(() => null)
        ]);
        if (Array.isArray(data)) setRawInventory(data);
        if (consData) setConsolidatedData(consData);
      } else if (activeTab === 'requests') {
        const branchParam = selectedBranch === 'ALL' ? '' : selectedBranch;
        const deptParam = selectedDepartment === 'ALL' ? '' : selectedDepartment;
        const viewParam = departmentBreakdown ? 'department' : 'consolidated';
        const [data, consData] = await Promise.all([
          api.getBranchRequestReport({
            fromDate: effectiveFromDate,
            toDate: effectiveToDate,
            branch: branchParam,
            department: deptParam,
            view: viewParam,
            departmentBreakdown: departmentBreakdown
          }).catch(() => []),
          api.getConsolidatedBranchRequestReport({
            fromDate: effectiveFromDate,
            toDate: effectiveToDate,
            branch: branchParam,
            department: deptParam,
            departmentBreakdown: departmentBreakdown
          }).catch(() => null)
        ]);
        if (Array.isArray(data)) setRawRequests(data);
        if (consData) setConsolidatedData(consData);
      } else if (activeTab === 'dispatches') {
        const branchParam = selectedBranch === 'ALL' ? '' : selectedBranch;
        const deptParam = selectedDepartment === 'ALL' ? '' : selectedDepartment;
        const [data, consData] = await Promise.all([
          api.getBranchDispatchReport({
            fromDate: effectiveFromDate,
            toDate: effectiveToDate,
            branch: branchParam,
            department: deptParam
          }).catch(() => []),
          api.getConsolidatedDispatchReport({
            fromDate: effectiveFromDate,
            toDate: effectiveToDate,
            branch: branchParam,
            department: deptParam
          }).catch(() => null)
        ]);
        if (Array.isArray(data)) setRawDispatches(data);
        if (consData) setConsolidatedData(consData);
      } else if (activeTab === 'categories') {
        const branchParam = selectedBranch === 'ALL' ? '' : selectedBranch;
        const deptParam = selectedDepartment === 'ALL' ? '' : selectedDepartment;
        const catParam = selectedCategoryFilter === 'ALL' ? '' : selectedCategoryFilter;
        const data = await api.getCategoryWiseReport({
          fromDate: effectiveFromDate,
          toDate: effectiveToDate,
          branch: branchParam,
          department: deptParam,
          category: catParam
        });
        if (data && typeof data === 'object') {
          setRawCategoryReport(data);
        }
      }
    } catch (err) {
      console.error('Error loading report data:', err);
      setError(err.message || 'Failed to load report records');
    } finally {
      setLoading(false);
    }
  }, [activeTab, effectiveFromDate, effectiveToDate, selectedBranch, selectedDepartment, selectedCategoryFilter, departmentBreakdown]);

  // Refetch when activeTab, date or branch changes
  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Unique department options for dropdown filter
  const departmentOptions = useMemo(() => {
    const set = new Set();
    (departments || []).forEach(d => {
      const name = typeof d === 'string' ? d : (d?.name || d?.departmentName);
      if (name && name.trim()) set.add(name.trim());
    });
    // Also include any saved department values from raw requests (excluding 'Not specified')
    (rawRequests || []).forEach(r => {
      const d = (r.department || '').trim();
      if (d && d !== 'Not specified') set.add(d);
    });
    // Also include any saved department values from raw dispatches (excluding 'Not specified')
    (rawDispatches || []).forEach(dp => {
      const d = (dp.department || '').trim();
      if (d && d !== 'Not specified') set.add(d);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [departments, rawRequests, rawDispatches]);

  // Unique item category options for Category filter dropdown
  const categoryFilterOptions = useMemo(() => {
    const set = new Set();
    (itemCategories || []).forEach(c => {
      const name = typeof c === 'string' ? c : c?.name;
      if (name && name.trim()) set.add(name.trim());
    });
    (rawCategoryReport.summary || []).forEach(s => {
      if (s.category && s.category.trim()) set.add(s.category.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [itemCategories, rawCategoryReport.summary]);

  // Filtered Category Summary Rows
  const categorySummaryData = useMemo(() => {
    if (activeTab !== 'categories') return [];
    let list = rawCategoryReport.summary || [];
    if (selectedCategoryFilter && selectedCategoryFilter !== 'ALL') {
      list = list.filter(c => c.category && c.category.toLowerCase() === selectedCategoryFilter.trim().toLowerCase());
    }
    return list;
  }, [activeTab, rawCategoryReport.summary, selectedCategoryFilter]);

  // Filtered Category Detail Items for selectedCategoryView
  const categoryDetailItems = useMemo(() => {
    if (activeTab !== 'categories' || !selectedCategoryView) return [];
    let items = rawCategoryReport.items || [];
    items = items.filter(it => it.category && it.category.toLowerCase() === selectedCategoryView.trim().toLowerCase());
    if (selectedBranch && selectedBranch !== 'ALL') {
      items = items.filter(it => it.branchName === selectedBranch);
    }
    if (selectedDepartment && selectedDepartment !== 'ALL') {
      items = items.filter(it => it.department && it.department.toLowerCase() === selectedDepartment.trim().toLowerCase());
    }
    items = items.filter(it => {
      const dStr = String(it.requestDate || it.dispatchDate || '').slice(0, 10);
      if (!dStr) return false;
      if (effectiveFromDate && dStr < effectiveFromDate) return false;
      if (effectiveToDate && dStr > effectiveToDate) return false;
      return true;
    });
    return items;
  }, [activeTab, rawCategoryReport.items, selectedCategoryView, selectedBranch, selectedDepartment, effectiveFromDate, effectiveToDate]);

  // Overall metrics for Category-Wise Report Cards
  const categoryOverallTotals = useMemo(() => {
    if (activeTab !== 'categories') return null;
    if (selectedCategoryView) {
      const distinctItems = new Set(categoryDetailItems.map(it => (it.itemName || '').trim().toLowerCase())).size;
      const reqByUnit = {};
      const dispByUnit = {};
      const pendByUnit = {};
      categoryDetailItems.forEach(it => {
        const u = it.unit || 'KG';
        reqByUnit[u] = (reqByUnit[u] || 0) + (Number(it.requestedQuantity) || 0);
        dispByUnit[u] = (dispByUnit[u] || 0) + (Number(it.dispatchedQuantity) || 0);
        pendByUnit[u] = (pendByUnit[u] || 0) + (Number(it.pendingQuantity) || 0);
      });
      return {
        totalCategories: 1,
        totalDistinctItems: distinctItems,
        requestedStr: formatUnitQuantities(reqByUnit),
        dispatchedStr: formatUnitQuantities(dispByUnit),
        pendingStr: formatUnitQuantities(pendByUnit)
      };
    } else {
      const activeSummary = categorySummaryData.filter(c => c.totalItems > 0);
      const totalCategories = activeSummary.length || categorySummaryData.length;
      let totalDistinctItems = 0;
      const reqByUnit = {};
      const dispByUnit = {};
      const pendByUnit = {};
      categorySummaryData.forEach(c => {
        totalDistinctItems += (c.totalItems || 0);
        Object.entries(c.requestedByUnit || {}).forEach(([u, val]) => {
          reqByUnit[u] = (reqByUnit[u] || 0) + (Number(val) || 0);
        });
        Object.entries(c.dispatchedByUnit || {}).forEach(([u, val]) => {
          dispByUnit[u] = (dispByUnit[u] || 0) + (Number(val) || 0);
        });
        Object.entries(c.pendingByUnit || {}).forEach(([u, val]) => {
          pendByUnit[u] = (pendByUnit[u] || 0) + (Number(val) || 0);
        });
      });
      return {
        totalCategories,
        totalDistinctItems,
        requestedStr: formatUnitQuantities(reqByUnit),
        dispatchedStr: formatUnitQuantities(dispByUnit),
        pendingStr: formatUnitQuantities(pendByUnit)
      };
    }
  }, [activeTab, selectedCategoryView, categorySummaryData, categoryDetailItems]);

  // Filter and group records
  // "Group duplicate items where appropriate, combining quantities only when the item and unit match."
  const records = useMemo(() => {
    if (activeTab === 'inventory') {
      let list = rawInventory;

      // Date filtering for inventory: inclusive between effectiveFromDate and effectiveToDate
      list = list.filter(item => {
        const updated = item.lastUpdated || (item.activity && item.activity[0]?.transactionDate) || item.createdAt;
        if (!updated) return false;
        const dStr = String(updated).slice(0, 10);
        if (effectiveFromDate && dStr < effectiveFromDate) return false;
        if (effectiveToDate && dStr > effectiveToDate) return false;
        return true;
      });

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

      // Branch filter (if raw records were returned)
      if (selectedBranch && selectedBranch !== 'ALL') {
        list = list.filter(r => (r.branchName || r.branch) === selectedBranch || !r.branchName);
      }

      // Department filter (if raw records were returned)
      if (selectedDepartment && selectedDepartment !== 'ALL') {
        list = list.filter(r => {
          const d = (r.department || r.category || '').trim();
          return !d || d.toLowerCase() === selectedDepartment.trim().toLowerCase();
        });
      }

      // Date filter (if raw records were returned)
      list = list.filter(r => {
        if (!r.date && !r.requestDate && !r.createdAt) return true;
        const dStr = String(r.date || r.requestDate || (r.createdAt ? String(r.createdAt).slice(0, 10) : '')).slice(0, 10);
        if (!dStr) return true;
        if (effectiveFromDate && dStr < effectiveFromDate) return false;
        if (effectiveToDate && dStr > effectiveToDate) return false;
        return true;
      });

      // Group records according to toggle:
      // OFF (Consolidated View): group by Item ID and Unit across all dates and departments
      // ON (Department-wise View): group by Department, Item ID, and Unit across all dates within department
      const groupMap = new Map();
      list.forEach(r => {
        const itemName = (r.itemName || r.item || '').trim();
        const itemId = r.itemId || itemName.toLowerCase();
        const unit = (r.unit || '').trim();
        const rawDept = (r.department || r.departmentName || r.category || '').trim();
        const department = rawDept && rawDept !== 'Not specified' && rawDept !== 'null' ? rawDept : 'Unassigned';
        const requestedQuantity = Number(r.requestedQuantity || r.requested) || 0;

        const key = departmentBreakdown
          ? `${department.toLowerCase()}___${String(itemId).toLowerCase()}___${unit.toLowerCase()}`
          : `${String(itemId).toLowerCase()}___${unit.toLowerCase()}`;

        if (!groupMap.has(key)) {
          groupMap.set(key, {
            id: r.id || `${itemId}_${unit}`,
            itemId: r.itemId,
            itemName,
            unit,
            department: departmentBreakdown ? department : null,
            requestedQuantity: requestedQuantity
          });
        } else {
          const existing = groupMap.get(key);
          existing.requestedQuantity = Math.round((existing.requestedQuantity + requestedQuantity) * 1000) / 1000;
        }
      });

      const result = Array.from(groupMap.values());
      if (departmentBreakdown) {
        return result.sort((a, b) => {
          const deptCmp = (a.department || '').localeCompare(b.department || '');
          if (deptCmp !== 0) return deptCmp;
          return a.itemName.localeCompare(b.itemName);
        });
      } else {
        return result.sort((a, b) => a.itemName.localeCompare(b.itemName));
      }
    }

    if (activeTab === 'dispatches') {
      let list = rawDispatches;

      // Branch filter
      if (selectedBranch && selectedBranch !== 'ALL') {
        list = list.filter(d => d.branchName === selectedBranch);
      }

      // Department filter
      if (selectedDepartment && selectedDepartment !== 'ALL') {
        list = list.filter(d => {
          const dept = (d.department || d.category || '').trim();
          return dept.toLowerCase() === selectedDepartment.trim().toLowerCase();
        });
      }

      // Date filter: inclusive between effectiveFromDate and effectiveToDate
      list = list.filter(d => {
        const dStr = String(d.dispatchDate || (d.dispatchDateTime ? String(d.dispatchDateTime).slice(0, 10) : '') || (d.createdAt ? String(d.createdAt).slice(0, 10) : '')).slice(0, 10);
        if (!dStr) return false;
        if (effectiveFromDate && dStr < effectiveFromDate) return false;
        if (effectiveToDate && dStr > effectiveToDate) return false;
        return true;
      });

      // Group duplicate items combining quantities only when item and unit match
      const groupMap = new Map();
      list.forEach(d => {
        const branchName = (d.branchName || '').trim();
        const rawDept = (d.department || d.departmentName || d.category || '').trim();
        const department = rawDept && rawDept !== 'Not specified' && rawDept !== 'null' ? rawDept : 'Unassigned';
        const itemName = (d.itemName || '').trim();
        const unit = (d.unit || '').trim();
        const dispatchDate = String(d.dispatchDate || (d.dispatchDateTime ? d.dispatchDateTime.slice(0, 10) : '')).slice(0, 10);
        const meaningfulStatus = getMeaningfulDispatchStatus(d);

        // Grouping key includes branch, department, item, unit, dispatchDate, and meaningfulStatus
        const key = `${branchName.toLowerCase()}___${department.toLowerCase()}___${itemName.toLowerCase()}___${unit.toLowerCase()}___${dispatchDate}___${meaningfulStatus.toLowerCase()}`;

        if (!groupMap.has(key)) {
          groupMap.set(key, {
            id: d.id,
            dispatchNumber: d.dispatchNumber,
            branchName,
            department,
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
  }, [activeTab, rawInventory, rawRequests, rawDispatches, effectiveFromDate, effectiveToDate, selectedBranch, selectedDepartment, departmentBreakdown]);

  // Unified display rows based on activeTab
  const displayRows = useMemo(() => {
    if (activeTab === 'categories') {
      return selectedCategoryView ? categoryDetailItems : categorySummaryData;
    }
    return records;
  }, [activeTab, selectedCategoryView, categoryDetailItems, categorySummaryData, records]);

  const hasNoData = useMemo(() => {
    if (activeTab === 'categories') {
      return selectedCategoryView ? categoryDetailItems.length === 0 : categorySummaryData.length === 0;
    }
    if (activeTab === 'requests') {
      return records.length === 0;
    }
    if (consolidatedData) {
      if (viewMode === 'summary') {
        return !consolidatedData.summaryRows || consolidatedData.summaryRows.length === 0;
      } else {
        return !consolidatedData.detailsGroups || consolidatedData.detailsGroups.length === 0;
      }
    }
    return records.length === 0;
  }, [activeTab, selectedCategoryView, categoryDetailItems.length, categorySummaryData.length, consolidatedData, viewMode, records.length]);

  // Simple Total / Count calculation above the table
  const totals = useMemo(() => {
    if (activeTab === 'categories') {
      return { countLabel: '', metricLabel: '' };
    }
    if (activeTab === 'requests') {
      const uniqueItemsCount = new Set(records.map(r => (r.itemId || r.itemName || '').toString().trim().toLowerCase())).size;
      const unitMap = {};
      records.forEach(r => {
        const u = (r.unit || '').trim();
        if (u) {
          unitMap[u] = (unitMap[u] || 0) + (Number(r.requestedQuantity) || 0);
        }
      });
      const formattedUnits = formatUnitSummary(unitMap, language === 'ta', '0');

      const countLabel = departmentBreakdown
        ? `${t('Total Rows', 'மொத்த வரிசைகள்')}: ${records.length} (${t('Unique Items', 'தனித்துவமான பொருட்கள்')}: ${uniqueItemsCount})`
        : `${t('Total Unique Items', 'மொத்த தனித்துவமான பொருட்கள்')}: ${records.length}`;

      const metricLabel = `${t('Total Quantity', 'மொத்த அளவு')}: ${formattedUnits}`;

      return { countLabel, metricLabel };
    }
    if (consolidatedData && (consolidatedData.summaryRows?.length > 0 || consolidatedData.detailsGroups?.length > 0)) {
      const groupTerm = activeTab === 'inventory' ? t('Total Categories', 'மொத்த வகைகள்') : t('Total Branches', 'மொத்த கிளைகள்');
      const countLabel = `${groupTerm}: ${consolidatedData.totalGroups} | ${t('Total Items', 'மொத்த பொருட்கள்')}: ${consolidatedData.totalItems}`;
      const measureTerm = (activeTab === 'dispatches' ? t('Total Delivered Quantity', 'மொத்த விநியோகிக்கப்பட்ட அளவு') : t('Total Stock', 'மொத்த இருப்பு'));
      const metricLabel = `${measureTerm}: ${consolidatedData.grandTotalQuantityFormatted}`;
      return { countLabel, metricLabel };
    }
    if (activeTab === 'inventory') {
      const totalStock = records.reduce((sum, r) => sum + (Number(r.currentStock) || 0), 0);
      return {
        countLabel: `${t('Total Items', 'மொத்த பொருட்கள்')}: ${records.length}`,
        metricLabel: `${t('Total Stock', 'மொத்த இருப்பு')}: ${totalStock.toLocaleString()} ${language === 'ta' ? 'அலகுகள்' : 'units'}`
      };
    }
    if (activeTab === 'dispatches') {
      const totalDispatched = records.reduce((sum, r) => sum + (Number(r.dispatchedQuantity) || 0), 0);
      return {
        countLabel: `${t('Total Deliveries', 'மொத்த விநியோகங்கள்')}: ${records.length}`,
        metricLabel: `${t('Total Delivered', 'மொத்த விநியோகம்')}: ${totalDispatched.toLocaleString()} ${language === 'ta' ? 'அலகுகள்' : 'units'}`
      };
    }
    return { countLabel: '', metricLabel: '' };
  }, [activeTab, consolidatedData, records, departmentBreakdown, language, t]);

  // Scope label for exports and UI display: Standardized to Today or Custom Range
  const dateScopeLabel = dateMode === 'today'
    ? (language === 'ta' ? `இன்று (${formatDisplayDate(today)})` : `Today (${formatDisplayDate(today)})`)
    : `${formatDisplayDate(appliedFromDate)} – ${formatDisplayDate(appliedToDate)}`;

  // Filename date suffix for PDF / CSV exports
  const dateFileSuffix = dateMode === 'today'
    ? `today_${today}`
    : `${appliedFromDate}_to_${appliedToDate}`;

  const branchScopeLabel = selectedBranch === 'ALL' ? t('All Branches', 'அனைத்து கிளைகள்') : selectedBranch;
  const deptScopeLabel = selectedDepartment === 'ALL' ? t('All Departments', 'அனைத்து துறைகள்') : (translateCategory ? translateCategory(selectedDepartment) : selectedDepartment);

  // Category scope label
  const categoryScopeLabel = selectedCategoryFilter === 'ALL' ? t('All Categories', 'அனைத்து வகைகள்') : (translateCategory ? translateCategory(selectedCategoryFilter) : selectedCategoryFilter);

  // Handle Download PDF
  const handleDownloadPdf = async () => {
    if (downloadingPdf) return;
    try {
      setDownloadingPdf(true);
      if (activeTab === 'inventory') {
        await downloadSimpleInventoryPdf({
          items: records,
          dateLabel: dateScopeLabel,
          filename: `Annamithra_Inventory_Report_${dateFileSuffix}.pdf`
        });
      } else if (activeTab === 'requests') {
        if (consolidatedData) {
          await downloadConsolidatedBranchReportPdf({
            reportType: 'requests',
            viewMode: viewMode,
            reportData: consolidatedData,
            dateRangeLabel: dateScopeLabel,
            branchFilter: branchScopeLabel,
            departmentBreakdown: departmentBreakdown,
            language,
            filename: `Annamithra_Branch_Request_${viewMode}_${dateFileSuffix}.pdf`
          });
        } else {
          const viewSuffix = departmentBreakdown ? 'Department_Wise' : 'Consolidated';
          await downloadSimpleBranchRequestPdf({
            items: records,
            branch: branchScopeLabel,
            department: deptScopeLabel,
            dateLabel: dateScopeLabel,
            filename: `Annamithra_Branch_Request_${viewSuffix}_${dateFileSuffix}.pdf`,
            departmentBreakdown: departmentBreakdown
          });
        }
      } else if (activeTab === 'dispatches') {
        await downloadSimpleDispatchPdf({
          items: records,
          branch: branchScopeLabel,
          department: deptScopeLabel,
          dateLabel: dateScopeLabel,
          filename: `Annamithra_Delivery_Report_${dateFileSuffix}.pdf`
        });
      } else if (activeTab === 'categories') {
        if (selectedCategoryView) {
          const safeCat = (selectedCategoryView || 'Category').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Category';
          await downloadCategoryDetailPdf({
            categoryName: selectedCategoryView,
            items: categoryDetailItems,
            branch: branchScopeLabel,
            department: deptScopeLabel,
            dateLabel: dateScopeLabel,
            filename: `Annamithra_${safeCat}_Item_Details_${dateFileSuffix}.pdf`
          });
        } else {
          await downloadCategorySummaryPdf({
            summary: categorySummaryData,
            branch: branchScopeLabel,
            department: deptScopeLabel,
            category: categoryScopeLabel,
            dateLabel: dateScopeLabel,
            filename: `Annamithra_Category_Summary_${dateFileSuffix}.pdf`
          });
        }
      }
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Handle Direct Print
  const handleDirectPrint = async () => {
    if (directPrinting) return;
    try {
      setDirectPrinting(true);
      if (activeTab === 'categories') {
        if (selectedCategoryView) {
          await printCategoryDetailReport({
            categoryName: selectedCategoryView,
            items: categoryDetailItems,
            branch: branchScopeLabel,
            department: deptScopeLabel,
            dateLabel: dateScopeLabel,
            language
          });
        } else {
          await printCategorySummaryReport({
            summary: categorySummaryData,
            branch: branchScopeLabel,
            department: deptScopeLabel,
            category: categoryScopeLabel,
            dateLabel: dateScopeLabel,
            language
          });
        }
      } else if (activeTab === 'requests') {
        if (consolidatedData) {
          await printConsolidatedBranchReportDirect({
            reportType: 'requests',
            viewMode: viewMode,
            reportData: consolidatedData,
            dateRangeLabel: dateScopeLabel,
            branchFilter: branchScopeLabel,
            departmentBreakdown: departmentBreakdown,
            language
          });
        } else {
          await printSimpleBranchRequestReport({
            items: records,
            branch: branchScopeLabel,
            department: deptScopeLabel,
            dateLabel: dateScopeLabel,
            departmentBreakdown: departmentBreakdown,
            language
          });
        }
      } else if (consolidatedData) {
        await printConsolidatedBranchReportDirect({
          reportType: activeTab,
          viewMode: viewMode,
          reportData: consolidatedData,
          dateRangeLabel: dateScopeLabel,
          branchFilter: branchScopeLabel,
          language
        });
      } else {
        if (activeTab === 'inventory') {
          await printSimpleInventoryReport({
            items: records,
            dateLabel: dateScopeLabel,
            language
          });
        } else if (activeTab === 'dispatches') {
          await printSimpleDispatchReport({
            items: records,
            branch: branchScopeLabel,
            department: deptScopeLabel,
            dateLabel: dateScopeLabel,
            language
          });
        }
      }
    } catch (err) {
      console.error('Direct print failed:', err);
      alert('Failed to print report. Please try again.');
    } finally {
      setDirectPrinting(false);
    }
  };

  // Handle Export CSV
  const handleExportCsv = () => {
    if (activeTab === 'categories') {
      if (selectedCategoryView) {
        exportReportCsv({
          reportType: 'category-details',
          items: categoryDetailItems,
          filename: `Annamithra_${selectedCategoryView.replace(/[^a-zA-Z0-9]/g, '_')}_item_details_${dateFileSuffix}.csv`
        });
      } else {
        exportReportCsv({
          reportType: 'category-summary',
          items: categorySummaryData,
          filename: `Annamithra_category_summary_${dateFileSuffix}.csv`
        });
      }
      return;
    }

    if (activeTab === 'requests') {
      const viewSuffix = departmentBreakdown ? '_department_wise' : '_consolidated';
      const filename = `Annamithra_Branch_Request${viewSuffix}_report_${dateFileSuffix}.csv`;
      exportReportCsv({
        reportType: 'requests',
        items: records,
        filename,
        departmentBreakdown: departmentBreakdown
      });
      return;
    }

    if (consolidatedData) {
      exportReportCsv({
        reportType: activeTab,
        viewMode: viewMode,
        consolidatedData: consolidatedData,
        filename: `Annamithra_${activeTab}_${viewMode}_report_${dateFileSuffix}.csv`
      });
      return;
    }

    const viewSuffix = (activeTab === 'requests')
      ? (departmentBreakdown ? '_department_wise' : '_consolidated')
      : '';
    const filename = `Annamithra_${activeTab}${viewSuffix}_report_${dateFileSuffix}.csv`;
    exportReportCsv({
      reportType: activeTab,
      items: records,
      filename,
      departmentBreakdown: departmentBreakdown
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
              : 'Clean, simple, and easy-to-understand operational reports for inventory, branch requests, and deliveries.'}
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
          <span>{t('Delivery Report', 'விநியோக அறிக்கை')}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'categories'}
          className={`btn ${activeTab === 'categories' ? 'primary' : 'secondary'}`}
          onClick={() => {
            setActiveTab('categories');
            setSelectedCategoryView(null);
          }}
          style={{
            minHeight: 40,
            padding: '8px 18px',
            borderRadius: 6,
            fontWeight: activeTab === 'categories' ? 700 : 500,
            fontSize: '13.5px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>🗂️</span>
          <span>{t('Category-Wise Report', 'வகை வாரியான அறிக்கை')}</span>
        </button>
      </div>

      {/* TOP SUMMARY METRIC CARDS FOR CATEGORY-WISE REPORT */}
      {activeTab === 'categories' && categoryOverallTotals && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 12,
            marginBottom: 16
          }}
        >
          {/* Card 1: Category Name or Total Categories */}
          <div
            className="card"
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: 'var(--cream-surface)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              {selectedCategoryView ? t('Selected Category', 'தேர்ந்தெடுக்கப்பட்ட வகை') : t('Total Categories', 'மொத்த வகைகள்')}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary-dark-green)', marginTop: 4 }}>
              {selectedCategoryView ? (translateCategory ? translateCategory(selectedCategoryView) : selectedCategoryView) : categoryOverallTotals.totalCategories}
            </div>
          </div>

          {/* Card 2: Total Items */}
          <div
            className="card"
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: 'var(--cream-surface)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              {t('Total Items', 'மொத்த பொருட்கள்')}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--dark-text)', marginTop: 4 }}>
              {categoryOverallTotals.totalDistinctItems}
            </div>
          </div>

          {/* Card 3: Total Requested */}
          <div
            className="card"
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: 'var(--cream-surface)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              {t('Total Requested', 'மொத்த கோரப்பட்ட அளவு')}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary-dark-green)', marginTop: 4, wordBreak: 'break-word' }}>
              {categoryOverallTotals.requestedStr || '0'}
            </div>
          </div>

          {/* Card 4: Total Dispatched */}
          <div
            className="card"
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: 'var(--cream-surface)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              {t('Total Delivered', 'மொத்த விநியோகம்')}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--secondary-green)', marginTop: 4, wordBreak: 'break-word' }}>
              {categoryOverallTotals.dispatchedStr || '0'}
            </div>
          </div>

          {/* Card 5: Total Pending */}
          <div
            className="card"
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: 'var(--cream-surface)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              {t('Total Pending', 'மொத்த நிலுவை அளவு')}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#C05621', marginTop: 4, wordBreak: 'break-word' }}>
              {categoryOverallTotals.pendingStr || '0'}
            </div>
          </div>
        </div>
      )}

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
          {/* FILTER 1: DATE FILTER (Standardized to Today and Custom Range) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 360px' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-dark-green)', whiteSpace: 'nowrap' }}>
                📅 {t('Date Filter', 'தேதி வடிகட்டி')}:
              </span>

              {/* Mode Toggle Buttons: [ Today ] [ Custom Range ] */}
              <div style={{ display: 'inline-flex', borderRadius: 6, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <button
                  type="button"
                  className={`btn small ${dateMode === 'today' ? 'primary' : 'secondary'}`}
                  onClick={() => {
                    if (dateMode !== 'today') {
                      setDateMode('today');
                      setDateRangeError(null);
                    }
                  }}
                  style={{
                    minHeight: 34,
                    padding: '6px 14px',
                    fontSize: '12.5px',
                    borderRadius: 0,
                    border: 'none',
                    fontWeight: dateMode === 'today' ? 700 : 500
                  }}
                >
                  {t('Today', 'இன்று')}
                </button>

                <button
                  type="button"
                  className={`btn small ${dateMode === 'custom' ? 'primary' : 'secondary'}`}
                  onClick={() => {
                    if (dateMode !== 'custom') {
                      setDateMode('custom');
                    }
                  }}
                  style={{
                    minHeight: 34,
                    padding: '6px 14px',
                    fontSize: '12.5px',
                    borderRadius: 0,
                    border: 'none',
                    fontWeight: dateMode === 'custom' ? 700 : 500
                  }}
                >
                  {t('Custom Range', 'தனிப்பயன் வரம்பு')}
                </button>
              </div>

              {/* Today Active Indicator */}
              {dateMode === 'today' && (
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    background: 'var(--pale-green, #EBF4F0)',
                    color: 'var(--secondary-green, #07543D)',
                    border: '1px solid var(--pale-green-border, #C8DFD4)',
                    padding: '4px 10px',
                    borderRadius: 12
                  }}
                >
                  ✓ {language === 'ta' ? `இன்று (${formatDisplayDate(today)})` : `Today (${formatDisplayDate(today)})`}
                </span>
              )}
            </div>

            {/* Custom Range: From Date, To Date, Apply Filter */}
            {dateMode === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {t('From Date', 'தொடக்க தேதி')}:
                  </label>
                  <input
                    type="date"
                    value={fromDateInput}
                    max={toDateInput || undefined}
                    onChange={(e) => {
                      setFromDateInput(e.target.value);
                      if (dateRangeError) setDateRangeError(null);
                    }}
                    style={{
                      padding: '5px 8px',
                      fontSize: '13px',
                      minHeight: 34,
                      borderRadius: 4,
                      border: dateRangeError ? '1.5px solid #B3261E' : '1px solid var(--border-color)',
                      background: 'var(--white-surface)'
                    }}
                  />
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {t('To Date', 'முடிவு தேதி')}:
                  </label>
                  <input
                    type="date"
                    value={toDateInput}
                    min={fromDateInput || undefined}
                    onChange={(e) => {
                      setToDateInput(e.target.value);
                      if (dateRangeError) setDateRangeError(null);
                    }}
                    style={{
                      padding: '5px 8px',
                      fontSize: '13px',
                      minHeight: 34,
                      borderRadius: 4,
                      border: dateRangeError ? '1.5px solid #B3261E' : '1px solid var(--border-color)',
                      background: 'var(--white-surface)'
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="btn primary small"
                  onClick={handleApplyCustomRange}
                  disabled={loading}
                  style={{
                    minHeight: 34,
                    padding: '6px 14px',
                    fontSize: '12.5px',
                    borderRadius: 4,
                    fontWeight: 700
                  }}
                >
                  {t('Apply Filter', 'வடிகட்டியைப் பயன்படுத்து')}
                </button>

                {appliedFromDate && appliedToDate && (
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary-dark-green)' }}>
                    ({formatDisplayDate(appliedFromDate)} – {formatDisplayDate(appliedToDate)})
                  </span>
                )}
              </div>
            )}

            {/* Validation error message */}
            {dateRangeError && (
              <div style={{ color: '#B3261E', fontSize: '12px', fontWeight: 600, marginTop: 2 }}>
                ⚠️ {dateRangeError}
              </div>
            )}
          </div>

          {/* FILTER 2: BRANCH FILTER */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, flex: '1 1 260px' }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-dark-green)', whiteSpace: 'nowrap' }}>
              🌿 {t('Branch', 'கிளை')}:
            </span>
            <select
              id="report-branch-filter-select"
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

          {/* FILTER 3: DEPARTMENT FILTER (Branch Request Report, Dispatch Report & Category-Wise Report) */}
          {(activeTab === 'requests' || activeTab === 'dispatches' || activeTab === 'categories') && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, flex: '1 1 240px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-dark-green)', whiteSpace: 'nowrap' }}>
                🏢 {t('Department', 'துறை')}:
              </span>
              <select
                id="report-department-filter-select"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                style={{
                  minHeight: 34,
                  padding: '5px 10px',
                  fontSize: '13px',
                  borderRadius: 4,
                  border: '1px solid var(--border-color)',
                  background: 'var(--white-surface)',
                  minWidth: 150,
                  flex: 1
                }}
              >
                <option value="ALL">{t('All Departments', 'அனைத்து துறைகள்')}</option>
                {departmentOptions.map(dept => (
                  <option key={dept} value={dept}>
                    {translateCategory ? translateCategory(dept) : dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* UNIVERSAL REPORT VIEW TOGGLE: Summary View (default) vs Details View */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, flex: '1 1 auto' }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-dark-green)', whiteSpace: 'nowrap' }}>
              👁️ {t('Report View', 'அறிக்கை பார்வை')}:
            </span>
            <div style={{ display: 'inline-flex', borderRadius: 6, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <button
                type="button"
                id="btn-report-view-summary"
                className={`btn small ${viewMode === 'summary' ? 'primary' : 'secondary'}`}
                onClick={() => setViewMode('summary')}
                style={{
                  minHeight: 34,
                  padding: '6px 14px',
                  fontSize: '12.5px',
                  borderRadius: 0,
                  border: 'none',
                  fontWeight: viewMode === 'summary' ? 700 : 500
                }}
              >
                📋 {t('Summary View', 'சுருக்க பார்வை')}
              </button>
              <button
                type="button"
                id="btn-report-view-details"
                className={`btn small ${viewMode === 'details' ? 'primary' : 'secondary'}`}
                onClick={() => setViewMode('details')}
                style={{
                  minHeight: 34,
                  padding: '6px 14px',
                  fontSize: '12.5px',
                  borderRadius: 0,
                  border: 'none',
                  fontWeight: viewMode === 'details' ? 700 : 500
                }}
              >
                📑 {t('Details View', 'விவரமான பார்வை')}
              </button>
            </div>
          </div>

          {/* TOGGLE: Consolidated View vs Department-wise View (Branch Request Report only) */}
          {activeTab === 'requests' && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, flex: '1 1 300px', marginTop: 2 }}>
              <div
                id="btn-toggle-department-breakdown"
                role="button"
                tabIndex={0}
                onClick={() => setDepartmentBreakdown(prev => !prev)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setDepartmentBreakdown(prev => !prev);
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 14px',
                  background: departmentBreakdown ? 'var(--pale-green, #EBF4F0)' : 'var(--white-surface, #ffffff)',
                  border: departmentBreakdown ? '1.5px solid var(--secondary-green, #07543D)' : '1px solid var(--border-color, #E5DDC9)',
                  borderRadius: 24,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: departmentBreakdown ? '0 1px 3px rgba(7, 84, 61, 0.15)' : 'none'
                }}
                title={t('Toggle between Consolidated View and Department-wise View', 'ஒருங்கிணைந்த மற்றும் துறை வாரியான பார்வைகளுக்கு இடையே மாறவும்')}
              >
                {/* Switch Graphic */}
                <div
                  style={{
                    width: 36,
                    height: 20,
                    borderRadius: 10,
                    background: departmentBreakdown ? 'var(--secondary-green, #07543D)' : '#CBD5E1',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                    flexShrink: 0
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#ffffff',
                      position: 'absolute',
                      top: 3,
                      left: departmentBreakdown ? 19 : 3,
                      transition: 'left 0.2s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.25)'
                    }}
                  />
                </div>

                <span style={{ fontSize: '13px', fontWeight: 700, color: departmentBreakdown ? 'var(--primary-dark-green, #17352B)' : 'var(--dark-text, #1F2937)' }}>
                  {t('Department-wise Breakdown', 'துறை வாரியான விவரம்')}
                </span>

                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: departmentBreakdown ? 'var(--secondary-green, #07543D)' : '#F3F4F6',
                    color: departmentBreakdown ? '#ffffff' : 'var(--text-muted, #6B7280)'
                  }}
                >
                  {departmentBreakdown ? t('ON', 'ஆன்') : t('OFF', 'ஆஃப்')}
                </span>
              </div>

              {/* View mode description badge */}
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {departmentBreakdown
                  ? (language === 'ta' ? '• துறை வாரியாக தொகுக்கப்பட்ட முடிவுகள்' : '• Department-wise separated results')
                  : (language === 'ta' ? '• அனைத்து துறைகளுக்கும் ஒருங்கிணைந்த முடிவுகள்' : '• Consolidated across all departments')}
              </span>
            </div>
          )}

          {/* FILTER 4: CATEGORY FILTER (Category-Wise Report only) */}
          {activeTab === 'categories' && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, flex: '1 1 240px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-dark-green)', whiteSpace: 'nowrap' }}>
                🗂️ {t('Category', 'வகை')}:
              </span>
              <select
                id="report-category-filter-select"
                value={selectedCategoryFilter}
                onChange={(e) => {
                  setSelectedCategoryFilter(e.target.value);
                  if (selectedCategoryView && e.target.value !== 'ALL' && e.target.value !== selectedCategoryView) {
                    setSelectedCategoryView(null);
                  }
                }}
                style={{
                  minHeight: 34,
                  padding: '5px 10px',
                  fontSize: '13px',
                  borderRadius: 4,
                  border: '1px solid var(--border-color)',
                  background: 'var(--white-surface)',
                  minWidth: 150,
                  flex: 1
                }}
              >
                <option value="ALL">{t('All Categories', 'அனைத்து வகைகள்')}</option>
                {categoryFilterOptions.map(cat => (
                  <option key={cat} value={cat}>
                    {translateCategory ? translateCategory(cat) : cat}
                  </option>
                ))}
              </select>
            </div>
          )}
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
        {/* Subtitle / Counts on the Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {activeTab === 'categories' ? (
            selectedCategoryView ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => setSelectedCategoryView(null)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    borderRadius: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span>←</span>
                  <span>{t('Back to Category Summary', 'வகை சுருக்கத்திற்கு திரும்புக')}</span>
                </button>
                <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--primary-dark-green)' }}>
                  📁 {translateCategory ? translateCategory(selectedCategoryView) : selectedCategoryView} – {t('Item Details', 'பொருள் விவரங்கள்')}
                </span>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>•</span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--secondary-green)' }}>
                  {categoryDetailItems.length} {t('Records', 'பதிவுகள்')}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  ({t('Showing', 'காண்பிக்கப்படுகிறது')}: <b style={{ color: 'var(--dark-text)' }}>{dateScopeLabel}</b>
                  {selectedBranch !== 'ALL' ? `, ${selectedBranch}` : ''}
                  {selectedDepartment !== 'ALL' ? `, ${selectedDepartment}` : ''})
                </span>
              </div>
            ) : (
              <>
                <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--primary-dark-green)' }}>
                  🗂️ {t('Category Summary', 'வகை சுருக்கம்')} ({categorySummaryData.length} {t('Categories', 'வகைகள்')})
                </span>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>•</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  ({t('Showing', 'காண்பிக்கப்படுகிறது')}: <b style={{ color: 'var(--dark-text)' }}>{dateScopeLabel}</b>
                  {selectedBranch !== 'ALL' ? `, ${selectedBranch}` : ''}
                  {selectedDepartment !== 'ALL' ? `, ${selectedDepartment}` : ''}
                  {selectedCategoryFilter !== 'ALL' ? `, ${selectedCategoryFilter}` : ''})
                </span>
              </>
            )
          ) : (
            <>
              <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--primary-dark-green)' }}>
                {totals.countLabel}
              </span>
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>•</span>
              <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--secondary-green)' }}>
                {totals.metricLabel}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                ({t('Showing', 'காண்பிக்கப்படுகிறது')}: <b style={{ color: 'var(--dark-text)' }}>{dateScopeLabel}</b>
                {activeTab !== 'inventory' && selectedBranch !== 'ALL' ? `, ${selectedBranch}` : ''}
                {(activeTab === 'requests' || activeTab === 'dispatches') && selectedDepartment !== 'ALL' ? `, ${selectedDepartment}` : ''})
              </span>
            </>
          )}
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
            disabled={loading || hasNoData}
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
            id="btn-direct-print-report"
            className="btn secondary small"
            onClick={handleDirectPrint}
            disabled={loading || hasNoData || directPrinting}
            style={{
              minHeight: 34,
              padding: '6px 14px',
              fontSize: '12.5px',
              borderRadius: 4,
              borderColor: 'var(--primary-dark-green)',
              color: 'var(--primary-dark-green)',
              background: '#F0FDF4',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5
            }}
          >
            <span>🖨️</span>
            <span>{directPrinting ? t('Printing...', 'அச்சிடுகிறது...') : t('Direct Print', 'நேரடி அச்சு')}</span>
          </button>

          <button
            type="button"
            id="btn-download-report-pdf"
            className="btn primary small"
            onClick={handleDownloadPdf}
            disabled={loading || hasNoData || downloadingPdf}
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
            <span>{downloadingPdf ? t('Generating...', 'தயாரிக்கிறது...') : t('Download PDF', 'PDF பதிவிறக்கு')}</span>
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
      ) : hasNoData ? (
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
              ? 'வேறு தேதியை அல்லது தனிப்பயன் வரம்பைத் தேர்ந்தெடுக்கவும்.'
              : 'Try selecting a different date or custom date range.'}
          </div>
          <div style={{ display: 'inline-flex', gap: 10 }}>
            {dateMode === 'custom' ? (
              <button
                type="button"
                className="btn primary small"
                onClick={() => {
                  setDateMode('today');
                  setDateRangeError(null);
                }}
              >
                📅 {t('View Today', 'இன்றைய பதிவுகளைக் காண்க')}
              </button>
            ) : (
              <button
                type="button"
                className="btn primary small"
                onClick={() => {
                  setDateMode('custom');
                }}
              >
                📅 {t('Select Custom Range', 'தனிப்பயன் வரம்பைத் தேர்ந்தெடுக்கவும்')}
              </button>
            )}
            {selectedBranch !== 'ALL' && (
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setSelectedBranch('ALL')}
              >
                🌿 {t('All Branches', 'அனைத்து கிளைகள்')}
              </button>
            )}
            {(activeTab === 'requests' || activeTab === 'dispatches' || activeTab === 'categories') && selectedDepartment !== 'ALL' && (
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setSelectedDepartment('ALL')}
              >
                🏢 {t('All Departments', 'அனைத்து துறைகள்')}
              </button>
            )}
            {activeTab === 'categories' && selectedCategoryFilter !== 'ALL' && (
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setSelectedCategoryFilter('ALL')}
              >
                🗂️ {t('All Categories', 'அனைத்து வகைகள்')}
              </button>
            )}
            {activeTab === 'categories' && selectedCategoryView && (
              <button
                type="button"
                className="btn secondary small"
                onClick={() => setSelectedCategoryView(null)}
              >
                ← {t('Back to Category Summary', 'வகை சுருக்கத்திற்கு திரும்புக')}
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
          {/* =========================================================
              VIEW 1: CONSOLIDATED SUMMARY VIEW (Branch-wise / Category-wise)
              ========================================================= */}
          {activeTab !== 'categories' && consolidatedData && viewMode === 'summary' && (
            <>
              {/* DESKTOP SUMMARY TABLE */}
              <div className="desktop-table-view">
                <div className="table-wrap" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
                  <table style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--table-header-bg)', borderBottom: '2px solid var(--border-color)' }}>
                        <th style={{ width: 50, textAlign: 'center', padding: '10px 8px' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '10px 16px' }}>
                          {activeTab === 'inventory' ? t('Category', 'வகை') : t('Branch Name', 'கிளை பெயர்')}
                        </th>
                        {activeTab === 'requests' ? (
                          <>
                            <th style={{ width: 220, textAlign: 'right', padding: '10px 16px' }}>
                              {t('Total Quantity', 'மொத்த அளவு')}
                            </th>
                            <th style={{ width: 140, textAlign: 'left', padding: '10px 16px' }}>
                              {t('Unit', 'அலகு')}
                            </th>
                          </>
                        ) : (
                          <>
                            <th style={{ width: 160, textAlign: 'center', padding: '10px 14px' }}>
                              {t('Total Items', 'மொத்த பொருட்கள்')}
                            </th>
                            <th style={{ width: 260, textAlign: 'right', padding: '10px 20px' }}>
                              {activeTab === 'dispatches' ? t('Total Delivered Quantity', 'மொத்த விநியோகிக்கப்பட்ட அளவு') : t('Available Stock', 'தற்போதைய இருப்பு')}
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(consolidatedData.summaryRows || []).map((row, idx) => {
                        const qu = getSummaryQuantityAndUnit(row);
                        return (
                          <tr
                            key={row.groupId || idx}
                            style={{
                              background: idx % 2 === 1 ? 'var(--cream-bg)' : 'var(--white-surface)',
                              borderBottom: '1px solid var(--border-color)',
                              transition: 'background 0.12s ease'
                            }}
                          >
                            <td style={{ textAlign: 'center', padding: '12px 8px', color: 'var(--text-subtle)', fontSize: '13px' }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary-dark-green)', fontSize: '14px' }}>
                              <span style={{ marginRight: 8 }}>{activeTab === 'inventory' ? '🗂️' : '🏢'}</span>
                              {row.groupName}
                            </td>
                            {activeTab === 'requests' ? (
                              <>
                                <td style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 800, fontSize: '14.5px', color: 'var(--primary-dark-green)' }}>
                                  {qu.qty}
                                </td>
                                <td style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, fontSize: '13px', color: 'var(--text-muted)' }}>
                                  {qu.unit}
                                </td>
                              </>
                            ) : (
                              <>
                                <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                                  <span style={{
                                    background: '#F0EAD6',
                                    padding: '3px 12px',
                                    borderRadius: 12,
                                    fontSize: '13px',
                                    fontWeight: 700,
                                    color: 'var(--dark-text)'
                                  }}>
                                    {row.totalItems}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right', padding: '12px 20px', fontWeight: 800, fontSize: '14.5px', color: 'var(--primary-dark-green)' }}>
                                  {row.totalQuantityFormatted}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      {activeTab === 'requests' ? (
                        <tr style={{ background: '#F4EBD9', borderTop: '2.5px solid var(--border-color)', fontWeight: 800 }}>
                          <td colSpan={2} style={{ padding: '12px 16px', color: 'var(--primary-dark-green)', fontSize: '14px' }}>
                            📊 {t('Grand Total', 'பெரும் மொத்தம்')} ({consolidatedData.totalGroups} {t('Branches', 'கிளைகள்')}):
                          </td>
                          <td style={{ textAlign: 'right', padding: '12px 16px', fontSize: '15px', color: 'var(--primary-dark-green)', fontWeight: 800 }}>
                            {consolidatedData.grandTotalQuantityFormatted}
                          </td>
                          <td style={{ textAlign: 'left', padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)' }}></td>
                        </tr>
                      ) : (
                        <tr style={{ background: '#F4EBD9', borderTop: '2.5px solid var(--border-color)', fontWeight: 800 }}>
                          <td colSpan={2} style={{ padding: '12px 16px', color: 'var(--primary-dark-green)', fontSize: '14px' }}>
                            📊 {t('Grand Total', 'பெரும் மொத்தம்')} ({consolidatedData.totalGroups} {activeTab === 'inventory' ? t('Categories', 'வகைகள்') : t('Branches', 'கிளைகள்')}):
                          </td>
                          <td style={{ textAlign: 'center', padding: '12px 14px', fontSize: '14px', color: 'var(--dark-text)' }}>
                            {consolidatedData.totalItems} {t('Items', 'பொருட்கள்')}
                          </td>
                          <td style={{ textAlign: 'right', padding: '12px 20px', fontSize: '15px', color: 'var(--primary-dark-green)' }}>
                            {consolidatedData.grandTotalQuantityFormatted}
                          </td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* MOBILE SUMMARY CARDS */}
              <div className="mobile-card-list-view" style={{ padding: '10px', gap: 10 }}>
                {(consolidatedData.summaryRows || []).map((row, idx) => {
                  const qu = getSummaryQuantityAndUnit(row);
                  return (
                    <div
                      key={row.groupId || idx}
                      className="mobile-item-card"
                      style={{
                        background: 'var(--white-surface)',
                        border: '1.5px solid var(--border-color)',
                        borderRadius: 8,
                        padding: '12px 14px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary-dark-green)' }}>
                          {activeTab === 'inventory' ? '🗂️' : '🏢'} {row.groupName}
                        </div>
                        <span style={{ background: '#F0EAD6', padding: '2px 8px', borderRadius: 10, fontSize: '11px', fontWeight: 700 }}>
                          #{idx + 1}
                        </span>
                      </div>
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        {activeTab === 'requests' ? (
                          <>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>{t('Unit', 'அலகு')}:</span>{' '}
                              <b>{qu.unit}</b>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                {t('Total Quantity', 'மொத்த அளவு')}:
                              </span><br />
                              <b style={{ color: 'var(--primary-dark-green)', fontSize: '15px' }}>{qu.qty}</b>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>{t('Total Items', 'மொத்த பொருட்கள்')}:</span>{' '}
                              <b>{row.totalItems}</b>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                {activeTab === 'dispatches' ? t('Total Delivered Quantity', 'மொத்த விநியோகிக்கப்பட்ட அளவு') : t('Available Stock', 'தற்போதைய இருப்பு')}:
                              </span><br />
                              <b style={{ color: 'var(--primary-dark-green)', fontSize: '14px' }}>{row.totalQuantityFormatted}</b>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* =========================================================
              VIEW 2: CONSOLIDATED DETAILS VIEW (Grouped by Branch / Category with Items)
              ========================================================= */}
          {activeTab !== 'categories' && consolidatedData && viewMode === 'details' && (
            <div style={{ padding: '14px 14px' }}>
              {(consolidatedData.detailsGroups || []).map((group, gIdx) => (
                <div
                  key={group.groupId || gIdx}
                  style={{
                    marginBottom: 20,
                    border: '1.5px solid var(--border-color)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: 'var(--white-surface)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}
                >
                  {/* Branch / Category Group Heading */}
                  <div style={{
                    background: 'var(--cream-bg, #F9F6F0)',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '2px solid var(--border-color)',
                    flexWrap: 'wrap',
                    gap: 10
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{activeTab === 'inventory' ? '🗂️' : '🏢'}</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary-dark-green)' }}>
                        {group.groupName}
                      </span>
                      <span style={{
                        background: 'var(--secondary-green)',
                        color: '#ffffff',
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: '11px',
                        fontWeight: 700
                      }}>
                        #{gIdx + 1}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '13px' }}>
                      <span style={{ background: '#E5DDC9', padding: '3px 10px', borderRadius: 4, fontWeight: 700, color: 'var(--dark-text)' }}>
                        {group.totalItems} {t('Items', 'பொருட்கள்')}
                      </span>
                      <span style={{ fontWeight: 800, color: 'var(--primary-dark-green)', fontSize: '14px' }}>
                        {t('Subtotal', 'துணை மொத்தம்')}: {group.subtotalQuantityFormatted}
                      </span>
                    </div>
                  </div>

                  {/* Desktop Item Table */}
                  <div className="desktop-table-view">
                    <table style={{ margin: 0, width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ width: 44, textAlign: 'center', padding: '9px 6px' }}>#</th>
                          {activeTab === 'requests' ? (
                            <>
                              <th style={{ width: 140, textAlign: 'left', padding: '9px 10px' }}>{t('Department Name', 'துறை பெயர்')}</th>
                              <th style={{ textAlign: 'left', padding: '9px 12px' }}>{t('Item Name', 'பொருள் பெயர்')}</th>
                              <th style={{ width: 110, textAlign: 'right', padding: '9px 10px' }}>{t('Requested Quantity', 'கோரப்பட்ட அளவு')}</th>
                              <th style={{ width: 110, textAlign: 'right', padding: '9px 10px' }}>{t('Delivered Quantity', 'விநியோகிக்கப்பட்ட அளவு')}</th>
                              <th style={{ width: 110, textAlign: 'right', padding: '9px 10px' }}>{t('Delivery Quantity', 'விநியோக அளவு')}</th>
                              <th style={{ width: 70, textAlign: 'left', padding: '9px 8px' }}>{t('Unit', 'அலகு')}</th>
                              <th style={{ width: 110, textAlign: 'center', padding: '9px 8px' }}>{t('Delivery Date', 'விநியோக தேதி')}</th>
                              <th style={{ width: 140, textAlign: 'center', padding: '9px 10px' }}>{t('Acknowledgement Status', 'ஒப்புதல் நிலை')}</th>
                            </>
                          ) : (
                            <>
                              <th style={{ textAlign: 'left', padding: '8px 14px' }}>{t('Item Name', 'பொருள் பெயர்')}</th>
                              <th style={{ width: 180, textAlign: 'right', padding: '8px 16px' }}>
                                {activeTab === 'dispatches' ? t('Delivered Quantity', 'விநியோகிக்கப்பட்ட அளவு') : t('Available Stock', 'தற்போதைய இருப்பு')}
                              </th>
                              <th style={{ width: 120, textAlign: 'left', padding: '8px 14px' }}>{t('Unit', 'அலகு')}</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {(group.items || []).map((it, i) => {
                          const reqQty = Number(it.requestedQuantity ?? it.totalQuantity ?? 0);
                          const delQty = Number(it.deliveredQuantity || 0);
                          const pendingDelQty = Number(it.deliveryQuantity !== undefined ? it.deliveryQuantity : Math.max(0, reqQty - delQty));
                          return (
                            <tr
                              key={it.itemId || i}
                              style={{
                                background: i % 2 === 1 ? 'var(--cream-bg)' : 'var(--white-surface)',
                                borderBottom: '1px solid var(--border-color)'
                              }}
                            >
                              <td style={{ textAlign: 'center', padding: '9px 6px', color: 'var(--text-subtle)', fontSize: '12.5px' }}>
                                {i + 1}
                              </td>
                              {activeTab === 'requests' ? (
                                <>
                                  <td style={{ padding: '9px 10px' }}>
                                    {renderDepartmentBadge(it.department)}
                                  </td>
                                  <td style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--primary-dark-green)', fontSize: '13.5px' }}>
                                    {translateItem(it.itemName)}
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 700, fontSize: '13.5px', color: 'var(--primary-dark-green)' }}>
                                    {reqQty.toLocaleString()}
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 600, fontSize: '13.5px', color: '#166534' }}>
                                    {delQty.toLocaleString()}
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '9px 10px', fontWeight: 700, fontSize: '13.5px', color: '#B45309' }}>
                                    {pendingDelQty.toLocaleString()}
                                  </td>
                                  <td style={{ padding: '9px 8px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
                                    {it.unit}
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '9px 8px', fontSize: '12.5px', color: 'var(--dark-text)' }}>
                                    {it.deliveryDate ? formatDisplayDate(it.deliveryDate) : '—'}
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '9px 10px' }}>
                                    {renderAcknowledgementStatusBadge(it.acknowledgementStatus)}
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td style={{ padding: '8px 14px', fontWeight: 600, color: 'var(--primary-dark-green)' }}>
                                    {translateItem(it.itemName)}
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '8px 16px', fontWeight: 700, fontSize: '14px', color: 'var(--primary-dark-green)' }}>
                                    {Number(it.totalQuantity).toLocaleString()}
                                  </td>
                                  <td style={{ padding: '8px 14px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
                                    {it.unit}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#F4EBD9', fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                          <td colSpan={activeTab === 'requests' ? 3 : 2} style={{ padding: '10px 14px', color: 'var(--primary-dark-green)', fontSize: '13.5px' }}>
                            📌 {activeTab === 'inventory' ? t('Category Subtotal', 'வகை துணை மொத்தம்') : t('Branch Subtotal', 'கிளை துணை மொத்தம்')} ({group.groupName}):
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--primary-dark-green)', fontSize: '14px', fontWeight: 800 }}>
                            {group.subtotalQuantityFormatted}
                          </td>
                          <td colSpan={activeTab === 'requests' ? 5 : 1} style={{ padding: '10px 14px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                            {group.totalItems} {t('Items', 'பொருட்கள்')}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Mobile Group Items */}
                  <div className="mobile-card-list-view" style={{ padding: 10, gap: 8 }}>
                    {(group.items || []).map((it, i) => {
                      const reqQty = Number(it.requestedQuantity ?? it.totalQuantity ?? 0);
                      const delQty = Number(it.deliveredQuantity || 0);
                      const pendingDelQty = Number(it.deliveryQuantity !== undefined ? it.deliveryQuantity : Math.max(0, reqQty - delQty));
                      return (
                        <div
                          key={it.itemId || i}
                          style={{
                            background: 'var(--white-surface)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 6,
                            padding: '10px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ marginBottom: 4 }}>
                                {renderDepartmentBadge(it.department)}
                              </div>
                              <div style={{ fontWeight: 700, color: 'var(--primary-dark-green)', fontSize: '14px' }}>
                                {translateItem(it.itemName)}
                              </div>
                            </div>
                            <div>
                              {renderAcknowledgementStatusBadge(it.acknowledgementStatus)}
                            </div>
                          </div>

                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 8,
                            padding: '6px 8px',
                            background: '#F9F6F0',
                            borderRadius: 4,
                            fontSize: '12px',
                            textAlign: 'center'
                          }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px' }}>{t('Requested', 'கோரப்பட்டது')}</span>
                              <b style={{ color: 'var(--primary-dark-green)', fontSize: '13px' }}>{reqQty} {it.unit}</b>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px' }}>{t('Delivered', 'விநியோகம்')}</span>
                              <b style={{ color: '#166534', fontSize: '13px' }}>{delQty} {it.unit}</b>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '10.5px' }}>{t('Delivery Qty', 'விநியோக அளவு')}</span>
                              <b style={{ color: '#B45309', fontSize: '13px' }}>{pendingDelQty} {it.unit}</b>
                            </div>
                          </div>

                          {it.deliveryDate && (
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                              <span>{t('Delivery Date', 'விநியோக தேதி')}:</span>
                              <b>{formatDisplayDate(it.deliveryDate)}</b>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Mobile Subtotal bar */}
                    <div style={{
                      background: '#F4EBD9',
                      padding: '8px 12px',
                      borderRadius: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontWeight: 700,
                      fontSize: '12.5px',
                      color: 'var(--primary-dark-green)'
                    }}>
                      <span>{activeTab === 'inventory' ? t('Category Subtotal', 'வகை துணை மொத்தம்') : t('Branch Subtotal', 'கிளை துணை மொத்தம்')}:</span>
                      <span>{group.subtotalQuantityFormatted}</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Grand Total Banner at Bottom of Details View */}
              <div style={{
                background: 'var(--primary-dark-green)',
                color: '#ffffff',
                padding: '14px 20px',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginTop: 8
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, fontWeight: 700 }}>
                  <span>📊</span>
                  <span>{t('Overall Grand Total', 'ஒட்டுமொத்த பெரும் மொத்தம்')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 14 }}>
                  <span>{activeTab === 'inventory' ? t('Total Categories', 'மொத்த வகைகள்') : t('Total Branches', 'மொத்த கிளைகள்')}: <strong>{consolidatedData.totalGroups}</strong></span>
                  <span>{t('Total Items', 'மொத்த பொருட்கள்')}: <strong>{consolidatedData.totalItems}</strong></span>
                  <span style={{ fontSize: 16, color: '#FDE047', fontWeight: 800 }}>
                    {consolidatedData.grandTotalQuantityFormatted}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              VIEW 3: CATEGORY-WISE / FALLBACK TABLE (When consolidatedData is not available)
              ========================================================= */}
          {(activeTab === 'categories' || !consolidatedData) && (
            <>
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
                        <th style={{ width: 160, textAlign: 'right', padding: '10px 16px' }}>
                          {t('Available Stock', 'தற்போதைய இருப்பு')}
                        </th>
                        <th style={{ width: 220, textAlign: 'left', padding: '10px 14px' }}>
                          {t('Last Updated', 'கடைசியாக புதுப்பிக்கப்பட்டது')}
                        </th>
                      </>
                    )}

                    {/* Report 2: Branch Request columns */}
                    {activeTab === 'requests' && (
                      <>
                        {departmentBreakdown && (
                          <th style={{ width: 180, textAlign: 'left', padding: '10px 14px' }}>
                            {t('Department', 'துறை')}
                          </th>
                        )}
                        <th style={{ textAlign: 'left', padding: '10px 14px' }}>
                          {t('Item Name', 'பொருள் பெயர்')}
                        </th>
                        <th style={{ width: 160, textAlign: 'right', padding: '10px 16px' }}>
                          {t('Total Quantity', 'மொத்த அளவு')}
                        </th>
                        <th style={{ width: 120, textAlign: 'left', padding: '10px 14px' }}>
                          {t('Unit', 'அலகு')}
                        </th>
                      </>
                    )}

                    {/* Report 3: Dispatch columns */}
                    {activeTab === 'dispatches' && (
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
                        <th style={{ width: 170, textAlign: 'right', padding: '10px 16px' }}>
                          {t('Delivered Quantity', 'விநியோகிக்கப்பட்ட அளவு')}
                        </th>
                        <th style={{ width: 130, textAlign: 'center', padding: '10px 10px' }}>
                          {t('Delivery Date', 'விநியோக தேதி')}
                        </th>
                        <th style={{ width: 170, textAlign: 'center', padding: '10px 14px' }}>
                          {t('Acknowledgement Status', 'ஒப்புதல் நிலை')}
                        </th>
                      </>
                    )}

                    {/* Report 4A: Category Summary columns */}
                    {activeTab === 'categories' && !selectedCategoryView && (
                      <>
                        <th style={{ textAlign: 'left', padding: '10px 14px' }}>
                          {t('Category', 'வகை')}
                        </th>
                        <th style={{ width: 110, textAlign: 'center', padding: '10px 10px' }}>
                          {t('Total Items', 'மொத்த பொருட்கள்')}
                        </th>
                        <th style={{ width: 200, textAlign: 'right', padding: '10px 16px' }}>
                          {t('Requested Quantity', 'கோரப்பட்ட அளவு')}
                        </th>
                        <th style={{ width: 200, textAlign: 'right', padding: '10px 16px' }}>
                          {t('Delivered Quantity', 'விநியோகிக்கப்பட்ட அளவு')}
                        </th>
                        <th style={{ width: 180, textAlign: 'right', padding: '10px 16px' }}>
                          {t('Pending Quantity', 'நிலுவை அளவு')}
                        </th>
                        <th style={{ width: 100, textAlign: 'center', padding: '10px 12px' }}>
                          {t('Action', 'செயல்')}
                        </th>
                      </>
                    )}

                    {/* Report 4B: Category Detail Item-level columns */}
                    {activeTab === 'categories' && selectedCategoryView && (
                      <>
                        <th style={{ textAlign: 'left', padding: '10px 14px' }}>
                          {t('Item Name', 'பொருள் பெயர்')}
                        </th>
                        <th style={{ width: 150, textAlign: 'left', padding: '10px 14px' }}>
                          {t('Branch Name', 'கிளை பெயர்')}
                        </th>
                        <th style={{ width: 130, textAlign: 'left', padding: '10px 14px' }}>
                          {t('Department', 'துறை')}
                        </th>
                        <th style={{ width: 140, textAlign: 'right', padding: '10px 14px' }}>
                          {t('Requested Quantity', 'கோரப்பட்ட அளவு')}
                        </th>
                        <th style={{ width: 140, textAlign: 'right', padding: '10px 14px' }}>
                          {t('Delivered Quantity', 'விநியோகிக்கப்பட்ட அளவு')}
                        </th>
                        <th style={{ width: 130, textAlign: 'right', padding: '10px 14px' }}>
                          {t('Pending Quantity', 'நிலுவை அளவு')}
                        </th>
                        <th style={{ width: 110, textAlign: 'center', padding: '10px 10px' }}>
                          {t('Request Date', 'கோரிக்கை தேதி')}
                        </th>
                        <th style={{ width: 110, textAlign: 'center', padding: '10px 10px' }}>
                          {t('Delivery Date', 'விநியோக தேதி')}
                        </th>
                        <th style={{ width: 130, textAlign: 'center', padding: '10px 12px' }}>
                          {t('Status', 'நிலை')}
                        </th>
                      </>
                    )}

                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row, idx) => (
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
                          <td style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 700, fontSize: '14px', color: row.currentStock < 0 ? '#B3261E' : 'var(--dark-text)' }}>
                            {formatQuantityWithUnit(row.currentStock, row.unit, language === 'ta')}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '13px' }}>
                            {row.formattedLastUpdated}
                          </td>
                        </>
                      )}

                      {/* 2. Branch Request Row */}
                      {activeTab === 'requests' && (
                        <>
                          {departmentBreakdown && (
                            <td style={{ padding: '10px 14px', color: 'var(--dark-text)', fontSize: '13px' }}>
                              {renderDepartmentBadge(row.department)}
                            </td>
                          )}
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--primary-dark-green)' }}>
                            {translateItem(row.itemName)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 700, fontSize: '14px', color: 'var(--primary-dark-green)' }}>
                            {Number(row.requestedQuantity).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
                            {row.unit}
                          </td>
                        </>
                      )}

                      {/* 3. Dispatch Row */}
                      {activeTab === 'dispatches' && (
                        <>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--primary-dark-green)' }}>
                            {row.branchName}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--dark-text)', fontSize: '13px' }}>
                            {renderDepartmentBadge(row.department)}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                            {translateItem(row.itemName)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 700, fontSize: '14px', color: 'var(--secondary-green)' }}>
                            {formatQuantityWithUnit(row.dispatchedQuantity, row.unit, language === 'ta')}
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

                      {/* 4A. Category Summary Row */}
                      {activeTab === 'categories' && !selectedCategoryView && (
                        <>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--primary-dark-green)', fontSize: '13.5px' }}>
                            {translateCategory ? translateCategory(row.category) : row.category}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 10px' }}>
                            <span style={{ background: '#F0EAD6', padding: '3px 9px', borderRadius: 4, fontSize: '12.5px', fontWeight: 700, color: 'var(--dark-text)' }}>
                              {row.totalItems}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 600, fontSize: '13px', color: 'var(--primary-dark-green)' }}>
                            {formatUnitQuantities(row.requestedByUnit)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 600, fontSize: '13px', color: 'var(--secondary-green)' }}>
                            {formatUnitQuantities(row.dispatchedByUnit)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 16px', fontWeight: 700, fontSize: '13px', color: '#C05621' }}>
                            {formatUnitQuantities(row.pendingByUnit)}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <button
                              type="button"
                              className="btn primary small"
                              onClick={() => setSelectedCategoryView(row.category)}
                              style={{
                                minHeight: 28,
                                padding: '3px 12px',
                                fontSize: '12px',
                                borderRadius: 4,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <span>👁️</span>
                              <span>{t('View', 'பார்')}</span>
                            </button>
                          </td>
                        </>
                      )}

                      {/* 4B. Category Detail Item Row */}
                      {activeTab === 'categories' && selectedCategoryView && (
                        <>
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--primary-dark-green)' }}>
                            {translateItem(row.itemName)}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                            {row.branchName}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--dark-text)', fontSize: '12.5px' }}>
                            {renderDepartmentBadge(row.department)}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: '13.5px', color: 'var(--primary-dark-green)' }}>
                            {formatQuantityWithUnit(row.requestedQuantity, row.unit, language === 'ta')}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: '13.5px', color: 'var(--secondary-green)' }}>
                            {formatQuantityWithUnit(row.dispatchedQuantity, row.unit, language === 'ta')}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: '13.5px', color: (Number(row.pendingQuantity) || 0) > 0 ? '#C05621' : 'var(--text-muted)' }}>
                            {formatQuantityWithUnit(row.pendingQuantity, row.unit, language === 'ta')}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 10px', color: 'var(--dark-text)', fontSize: '12.5px' }}>
                            {formatDisplayDateTime(row.requestDate, false)}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 10px', color: 'var(--dark-text)', fontSize: '12.5px' }}>
                            {row.dispatchDate ? formatDisplayDateTime(row.dispatchDate, false) : '-'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 12px' }}>
                            <span
                              style={{
                                ...getStatusBadgeStyle(row.dispatchStatus || 'Pending'),
                                padding: '3px 10px',
                                borderRadius: 12,
                                fontSize: '11.5px',
                                fontWeight: 700,
                                display: 'inline-block'
                              }}
                            >
                              {translateStatus ? translateStatus(row.dispatchStatus || 'Pending') : (row.dispatchStatus || 'Pending')}
                            </span>
                          </td>
                        </>
                      )}

                    </tr>
                  ))}
                </tbody>
                {activeTab === 'requests' && displayRows.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#F4EBD9', borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
                      <td colSpan={departmentBreakdown ? 3 : 2} style={{ padding: '10px 14px', color: 'var(--primary-dark-green)', fontSize: '13.5px' }}>
                        📊 {departmentBreakdown
                          ? `${t('Total Rows', 'மொத்த வரிசைகள்')}: ${displayRows.length}`
                          : `${t('Total Unique Items', 'மொத்த தனித்துவமான பொருட்கள்')}: ${displayRows.length}`}
                      </td>
                      <td style={{ textAlign: 'right', padding: '10px 16px', color: 'var(--primary-dark-green)', fontSize: '14.5px', fontWeight: 800 }}>
                        {totals.metricLabel ? totals.metricLabel.replace(`${t('Total Quantity', 'மொத்த அளவு')}: `, '') : ''}
                      </td>
                      <td style={{ padding: '10px 14px' }}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* 5. RESPONSIVE COMPACT RECORD CARDS (Shown on mobile devices) */}
          <div className="mobile-card-list-view" style={{ padding: '10px', gap: 10 }}>
            {displayRows.map((row, idx) => {
              if (activeTab === 'categories' && !selectedCategoryView) {
                return (
                  <div
                    key={row.category || idx}
                    className="mobile-item-card"
                    style={{
                      background: 'var(--white-surface)',
                      border: '1.5px solid var(--border-color)',
                      borderRadius: 8,
                      padding: '12px 14px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary-dark-green)' }}>
                        📁 {translateCategory ? translateCategory(row.category) : row.category}
                      </div>
                      <span style={{ background: '#F0EAD6', padding: '2px 8px', borderRadius: 10, fontSize: '11px', fontWeight: 700 }}>
                        #{idx + 1}
                      </span>
                    </div>
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-color)', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6, fontSize: '12px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>{t('Total Items', 'மொத்த பொருட்கள்')}:</span>{' '}
                        <b>{row.totalItems}</b>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('Requested', 'கோரப்பட்டது')}:</span>{' '}
                        <b style={{ color: 'var(--primary-dark-green)' }}>{formatUnitQuantities(row.requestedByUnit)}</b>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>{t('Delivered', 'விநியோகிக்கப்பட்டது')}:</span>{' '}
                        <b style={{ color: 'var(--secondary-green)' }}>{formatUnitQuantities(row.dispatchedByUnit)}</b>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{t('Pending', 'நிலுவை')}:</span>{' '}
                        <b style={{ color: '#C05621' }}>{formatUnitQuantities(row.pendingByUnit)}</b>
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        className="btn primary small"
                        onClick={() => setSelectedCategoryView(row.category)}
                        style={{ width: '100%', minHeight: 32, justifyContent: 'center', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <span>👁️</span>
                        <span>{t('View Items', 'பொருட்களைப் பார்')}</span>
                      </button>
                    </div>
                  </div>
                );
              }

              if (activeTab === 'categories' && selectedCategoryView) {
                return (
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary-dark-green)' }}>
                          {translateItem(row.itemName)}
                        </div>
                        {row.branchName && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>
                            🌿 {row.branchName}
                          </div>
                        )}
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                          {t('Department', 'துறை')}:{' '}
                          <b style={{ color: 'var(--primary-dark-green)' }}>
                            {renderDepartmentLabel(row.department)}
                          </b>
                        </div>
                      </div>
                      <span style={{ background: '#F0EAD6', padding: '2px 8px', borderRadius: 10, fontSize: '11px', fontWeight: 700 }}>
                        #{idx + 1}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-color)', fontSize: '12px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{t('Requested Quantity', 'கோரப்பட்டது')}:</span><br />
                        <b style={{ color: 'var(--primary-dark-green)' }}>{formatQuantityWithUnit(row.requestedQuantity, row.unit, language === 'ta')}</b>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{t('Delivered Quantity', 'விநியோகிக்கப்பட்ட அளவு')}:</span><br />
                        <b style={{ color: 'var(--secondary-green)' }}>{formatQuantityWithUnit(row.dispatchedQuantity, row.unit, language === 'ta')}</b>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{t('Pending Quantity', 'நிலுவை')}:</span><br />
                        <b style={{ color: (Number(row.pendingQuantity) || 0) > 0 ? '#C05621' : 'var(--text-muted)' }}>
                          {formatQuantityWithUnit(row.pendingQuantity, row.unit, language === 'ta')}
                        </b>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTop: '1px dotted var(--border-color)', fontSize: '11.5px' }}>
                      <div></div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        {formatDisplayDateTime(row.requestDate, false)}
                      </div>
                      <span
                        style={{
                          ...getStatusBadgeStyle(row.dispatchStatus || 'Pending'),
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: '11px',
                          fontWeight: 700
                        }}
                      >
                        {translateStatus ? translateStatus(row.dispatchStatus || 'Pending') : (row.dispatchStatus || 'Pending')}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
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
                    {row.branchName && activeTab !== 'requests' && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>
                        🌿 {row.branchName}
                      </div>
                    )}
                    {((activeTab === 'requests' && departmentBreakdown) || activeTab === 'dispatches') && (
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: 2 }}>
                        {t('Department', 'துறை')}:{' '}
                        <b style={{ color: 'var(--primary-dark-green)' }}>
                          {renderDepartmentLabel(row.department)}
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
                    gridTemplateColumns: '1fr',
                    gap: 8,
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px dashed var(--border-color)',
                    fontSize: '13px'
                  }}
                >
                  {/* Quantity / Stock with Combined Unit */}
                  {activeTab === 'inventory' && (
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>{t('Available Stock', 'தற்போதைய இருப்பு')}:</span>{' '}
                      <b style={{ color: row.currentStock < 0 ? '#B3261E' : 'var(--primary-dark-green)', fontSize: '15px' }}>
                        {formatQuantityWithUnit(row.currentStock, row.unit, language === 'ta')}
                      </b>
                    </div>
                  )}

                  {activeTab === 'requests' && (
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>{t('Total Quantity', 'மொத்த அளவு')}:</span>{' '}
                      <b style={{ color: 'var(--primary-dark-green)', fontSize: '15px' }}>
                        {formatQuantityWithUnit(row.requestedQuantity, row.unit, language === 'ta')}
                      </b>
                    </div>
                  )}

                  {activeTab === 'dispatches' && (
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>{t('Delivered Quantity', 'விநியோகிக்கப்பட்ட அளவு')}:</span>{' '}
                      <b style={{ color: 'var(--secondary-green)', fontSize: '15px' }}>
                        {formatQuantityWithUnit(row.dispatchedQuantity, row.unit, language === 'ta')}
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
              );
            })}
          </div>
          </>
          )}
        </div>
      )}
    </div>
  );
}
