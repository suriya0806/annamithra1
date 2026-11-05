import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../api';
import { useLanguage } from '../i18n/LanguageContext';
import { getTodayDateString, formatDateLabel } from '../utils/dateGrouping';
import {
  downloadSimpleInventoryPdf,
  downloadSimpleBranchRequestPdf,
  downloadSimpleDispatchPdf,
  downloadCategorySummaryPdf,
  downloadCategoryDetailPdf,
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

/**
 * Helper to format unit quantity maps (e.g. {"KG": 100, "L": 50} -> "100 KG, 50 L")
 */
function formatUnitQuantities(unitMap, emptyFallback = '0') {
  if (!unitMap || typeof unitMap !== 'object') return emptyFallback;
  const entries = Object.entries(unitMap).filter(([_, val]) => Number(val) > 0);
  if (entries.length === 0) return emptyFallback;
  return entries.map(([u, val]) => `${Number(val || 0).toLocaleString()} ${u}`).join(', ');
}

export function ReportsView({ userRole }) {
  const { language, t, translateItem, translateUnit, translateStatus, translateCategory } = useLanguage();

  // 1. Category Tabs: 'inventory', 'requests', 'dispatches'
  const [activeTab, setActiveTab] = useState('inventory');

  // 2. Filters: Date, Branch, Department, and Category
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [isAllDates, setIsAllDates] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');

  // Category Detail view focus: null = Summary View, string = Category Name
  const [selectedCategoryView, setSelectedCategoryView] = useState(null);

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
  const [error, setError] = useState(null);

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
        const deptParam = selectedDepartment === 'ALL' ? '' : selectedDepartment;
        const data = await api.getBranchRequestReport({
          fromDate: queryDate,
          toDate: queryDate,
          branch: branchParam,
          department: deptParam
        });
        if (Array.isArray(data)) setRawRequests(data);
      } else if (activeTab === 'dispatches') {
        const queryDate = isAllDates ? '' : selectedDate;
        const branchParam = selectedBranch === 'ALL' ? '' : selectedBranch;
        const deptParam = selectedDepartment === 'ALL' ? '' : selectedDepartment;
        const data = await api.getBranchDispatchReport({
          date: queryDate,
          branch: branchParam,
          department: deptParam
        });
        if (Array.isArray(data)) setRawDispatches(data);

      } else if (activeTab === 'categories') {
        const queryDate = isAllDates ? '' : selectedDate;
        const branchParam = selectedBranch === 'ALL' ? '' : selectedBranch;
        const deptParam = selectedDepartment === 'ALL' ? '' : selectedDepartment;
        const catParam = selectedCategoryFilter === 'ALL' ? '' : selectedCategoryFilter;
        const data = await api.getCategoryWiseReport({
          date: queryDate,
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
  }, [activeTab, isAllDates, selectedDate, selectedBranch, selectedDepartment, selectedCategoryFilter]);

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
    if (!isAllDates && selectedDate) {
      items = items.filter(it => String(it.requestDate || '').slice(0, 10) === selectedDate);
    }
    return items;
  }, [activeTab, rawCategoryReport.items, selectedCategoryView, selectedBranch, selectedDepartment, isAllDates, selectedDate]);

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

      // Department filter
      if (selectedDepartment && selectedDepartment !== 'ALL') {
        list = list.filter(r => {
          const d = (r.department || r.category || '').trim();
          return d.toLowerCase() === selectedDepartment.trim().toLowerCase();
        });
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

      // Department filter
      if (selectedDepartment && selectedDepartment !== 'ALL') {
        list = list.filter(d => {
          const dept = (d.department || d.category || '').trim();
          return dept.toLowerCase() === selectedDepartment.trim().toLowerCase();
        });
      }

      // Date filter
      if (!isAllDates && selectedDate) {
        list = list.filter(d => String(d.dispatchDate || (d.dispatchDateTime ? d.dispatchDateTime.slice(0, 10) : '')).slice(0, 10) === selectedDate);
      }

      // Group duplicate items combining quantities only when item and unit match
      const groupMap = new Map();
      list.forEach(d => {
        const branchName = (d.branchName || '').trim();
        const department = (d.department || d.category || '').trim() || 'Not specified';
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
  }, [activeTab, rawInventory, rawRequests, rawDispatches, isAllDates, selectedDate, selectedBranch, selectedDepartment]);

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
    return records.length === 0;
  }, [activeTab, selectedCategoryView, categoryDetailItems.length, categorySummaryData.length, records.length]);

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
  const deptScopeLabel = selectedDepartment === 'ALL' ? t('All Departments', 'அனைத்து துறைகள்') : (translateCategory ? translateCategory(selectedDepartment) : selectedDepartment);

  // Category scope label
  const categoryScopeLabel = selectedCategoryFilter === 'ALL' ? t('All Categories', 'அனைத்து வகைகள்') : (translateCategory ? translateCategory(selectedCategoryFilter) : selectedCategoryFilter);

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
          department: deptScopeLabel,
          dateLabel: dateScopeLabel
        });
      } else if (activeTab === 'dispatches') {
        await downloadSimpleDispatchPdf({
          items: records,
          branch: branchScopeLabel,
          department: deptScopeLabel,
          dateLabel: dateScopeLabel
        });
      } else if (activeTab === 'categories') {
        if (selectedCategoryView) {
          await downloadCategoryDetailPdf({
            categoryName: selectedCategoryView,
            items: categoryDetailItems,
            branch: branchScopeLabel,
            department: deptScopeLabel,
            dateLabel: dateScopeLabel
          });
        } else {
          await downloadCategorySummaryPdf({
            summary: categorySummaryData,
            branch: branchScopeLabel,
            department: deptScopeLabel,
            category: categoryScopeLabel,
            dateLabel: dateScopeLabel
          });
        }
      }
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  // Handle Export CSV
  const handleExportCsv = () => {
    if (activeTab === 'categories') {
      if (selectedCategoryView) {
        exportReportCsv({
          reportType: 'category-details',
          items: categoryDetailItems,
          filename: `Annamithra_${selectedCategoryView.replace(/[^a-zA-Z0-9]/g, '_')}_item_details_${isAllDates ? 'all_dates' : selectedDate}.csv`
        });
      } else {
        exportReportCsv({
          reportType: 'category-summary',
          items: categorySummaryData,
          filename: `Annamithra_category_summary_${isAllDates ? 'all_dates' : selectedDate}.csv`
        });
      }
      return;
    }
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
              {t('Total Dispatched', 'மொத்த விநியோகம்')}
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
            className="btn primary small"
            onClick={handleDownloadPdf}
            disabled={loading || hasNoData}
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
                        <th style={{ width: 160, textAlign: 'left', padding: '10px 14px' }}>
                          {t('Branch Name', 'கிளை பெயர்')}
                        </th>
                        <th style={{ width: 140, textAlign: 'left', padding: '10px 14px' }}>
                          {t('Department', 'துறை')}
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
                          {t('Branch Requested Quantity', 'கிளை கோரிய அளவு')}
                        </th>
                        <th style={{ width: 200, textAlign: 'right', padding: '10px 16px' }}>
                          {t('Store Dispatched Quantity', 'கிடங்கு அனுப்பிய அளவு')}
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
                        <th style={{ width: 85, textAlign: 'center', padding: '10px 10px' }}>
                          {t('Unit', 'அலகு')}
                        </th>
                        <th style={{ width: 150, textAlign: 'left', padding: '10px 14px' }}>
                          {t('Branch Name', 'கிளை பெயர்')}
                        </th>
                        <th style={{ width: 130, textAlign: 'left', padding: '10px 14px' }}>
                          {t('Department', 'துறை')}
                        </th>
                        <th style={{ width: 120, textAlign: 'right', padding: '10px 14px' }}>
                          {t('Requested', 'கோரப்பட்டது')}
                        </th>
                        <th style={{ width: 120, textAlign: 'right', padding: '10px 14px' }}>
                          {t('Dispatched', 'அனுப்பப்பட்டது')}
                        </th>
                        <th style={{ width: 110, textAlign: 'right', padding: '10px 14px' }}>
                          {t('Pending', 'நிலுவை')}
                        </th>
                        <th style={{ width: 110, textAlign: 'center', padding: '10px 10px' }}>
                          {t('Request Date', 'கோரிக்கை தேதி')}
                        </th>
                        <th style={{ width: 110, textAlign: 'center', padding: '10px 10px' }}>
                          {t('Dispatch Date', 'அனுப்பப்பட்ட தேதி')}
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
                          <td style={{ textAlign: 'center', padding: '10px 10px' }}>
                            <span style={{ background: '#F0EAD6', padding: '2px 8px', borderRadius: 4, fontSize: '12px', fontWeight: 600 }}>
                              {translateUnit(row.unit)}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 500 }}>
                            {row.branchName}
                          </td>
                          <td style={{ padding: '10px 14px', color: 'var(--dark-text)', fontSize: '12.5px' }}>
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
                          <td style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: '13.5px', color: 'var(--primary-dark-green)' }}>
                            {(Number(row.requestedQuantity) || 0).toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: '13.5px', color: 'var(--secondary-green)' }}>
                            {(Number(row.dispatchedQuantity) || 0).toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 700, fontSize: '13.5px', color: (Number(row.pendingQuantity) || 0) > 0 ? '#C05621' : 'var(--text-muted)' }}>
                            {(Number(row.pendingQuantity) || 0).toLocaleString()}
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
                        <span style={{ color: 'var(--text-muted)' }}>{t('Dispatched', 'அனுப்பப்பட்டது')}:</span>{' '}
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
                          <b style={{ color: row.department === 'Not specified' ? 'var(--text-muted)' : 'var(--primary-dark-green)' }}>
                            {row.department === 'Not specified'
                              ? t('Not specified', 'குறிப்பிடப்படவில்லை')
                              : (translateCategory ? translateCategory(row.department) : row.department)}
                          </b>
                        </div>
                      </div>
                      <span style={{ background: '#F0EAD6', padding: '2px 8px', borderRadius: 10, fontSize: '11px', fontWeight: 700 }}>
                        #{idx + 1}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-color)', fontSize: '12px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{t('Unit', 'அலகு')}:</span><br />
                        <b>{translateUnit(row.unit)}</b>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{t('Requested', 'கோரப்பட்டது')}:</span><br />
                        <b style={{ color: 'var(--primary-dark-green)' }}>{(Number(row.requestedQuantity) || 0).toLocaleString()}</b>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{t('Dispatched', 'அனுப்பப்பட்டது')}:</span><br />
                        <b style={{ color: 'var(--secondary-green)' }}>{(Number(row.dispatchedQuantity) || 0).toLocaleString()}</b>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 6, borderTop: '1px dotted var(--border-color)', fontSize: '11.5px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>{t('Pending', 'நிலுவை')}:</span>{' '}
                        <b style={{ color: (Number(row.pendingQuantity) || 0) > 0 ? '#C05621' : 'var(--text-muted)' }}>
                          {(Number(row.pendingQuantity) || 0).toLocaleString()}
                        </b>
                      </div>
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
                    {row.branchName && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>
                        🌿 {row.branchName}
                      </div>
                    )}
                    {(activeTab === 'requests' || activeTab === 'dispatches') && (
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
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
