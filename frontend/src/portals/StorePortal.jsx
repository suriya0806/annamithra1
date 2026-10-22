import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api';
import { Alert } from '../components/Alert';
import {
  downloadOrderPdf,
  parseOrderDateTime,
  downloadBranchRequestReportPdf,
  downloadBranchRequestsPdf
} from '../utils/pdfGenerator';
import { BRANCH_ORDER_CATEGORIES } from './BranchPortal';
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

export function StorePortal({ activeTab }) {
  const { language, t, translateItem, translateUnit, translateStatus, translateRole, translateCategory } = useLanguage();
  const formatDisplayDate = (d) => formatDateLabel(d, language);
  const formatDisplayDateTime = (d) => formatDateTime(d, language);

  // Sub-tabs
  const [entrySubTab, setEntrySubTab] = useState('view'); // 'view' | 'entry'
  const [branchReqSubTab, setBranchReqSubTab] = useState('dispatch'); // 'dispatch'

  // Alerts
  const [alert, setAlert] = useState(null);
  const showAlert = (type, message) => setAlert({ type, message });

  // Common data
  const [branches, setBranches] = useState([]);
  const [catalogueItems, setCatalogueItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Central Inventory state
  const [inventory, setInventory] = useState([]);
  const [invTransactions, setInvTransactions] = useState([]);
  const [invTxDate, setInvTxDate] = useState(getTodayDateString());
  const [invTxIsAllDates, setInvTxIsAllDates] = useState(false);
  const [invTxFromDate, setInvTxFromDate] = useState('');
  const [invTxToDate, setInvTxToDate] = useState('');
  const [invTxItem, setInvTxItem] = useState('');
  const [loadingInvTx, setLoadingInvTx] = useState(false);

  // Entry Items state
  const [viewOrders, setViewOrders] = useState([]);
  const [viewDate, setViewDate] = useState(getTodayDateString());
  const [viewIsAllDates, setViewIsAllDates] = useState(false);
  const [viewSearch, setViewSearch] = useState('');
  const [entryOrders, setEntryOrders] = useState([]);
  const [entryDate, setEntryDate] = useState(getTodayDateString());
  const [entryIsAllDates, setEntryIsAllDates] = useState(false);
  const [entrySearch, setEntrySearch] = useState('');
  const [entryStatusFilter, setEntryStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'PARTIAL' | 'RECEIVED'
  const [workingOrderNumbers, setWorkingOrderNumbers] = useState(() => {
    try {
      const saved = localStorage.getItem('annamithra_working_order_numbers');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [receiveQtys, setReceiveQtys] = useState({}); // orderId -> qty
  const [receivingId, setReceivingId] = useState(null);

  // Direct Goods Receipt / Entry Form state (backward compatibility)
  const [entrySelectedItem, setEntrySelectedItem] = useState('');
  const [entrySelectedUnit, setEntrySelectedUnit] = useState('');
  const [entryReceivedQty, setEntryReceivedQty] = useState('');
  const [entryReceiptDate, setEntryReceiptDate] = useState(getTodayDateString());
  const [submittingDirectReceipt, setSubmittingDirectReceipt] = useState(false);

  // Add Item Modal state
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('KG');
  const [newItemCustomUnit, setNewItemCustomUnit] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [savingNewItem, setSavingNewItem] = useState(false);
  const [addItemError, setAddItemError] = useState('');
  const addItemInputRef = useRef(null);
  const modalUnitSelectRef = useRef(null);
  const modalCustomUnitRef = useRef(null);
  const modalQtyInputRef = useRef(null);

  // Auto-focus first input when Add Item modal opens
  useEffect(() => {
    if (showAddItemModal) {
      const timer = setTimeout(() => {
        addItemInputRef.current?.focus();
        addItemInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showAddItemModal]);

  // Branch Requests state
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedBranchReqDate, setSelectedBranchReqDate] = useState(getTodayDateString());
  const [selectedBranchReqIsAllDates, setSelectedBranchReqIsAllDates] = useState(false);
  const [selectedBranchReqCategory, setSelectedBranchReqCategory] = useState('');
  const [branchRequestsList, setBranchRequestsList] = useState([]);
  const [historyModalItem, setHistoryModalItem] = useState(null);
  
  // Dispatch state
  const [outstandingRequests, setOutstandingRequests] = useState([]);
  const [dispatchReqDate, setDispatchReqDate] = useState(getTodayDateString());
  const [dispatchQtys, setDispatchQtys] = useState({}); // groupKey -> qty
  const [additionalItemsByBranch, setAdditionalItemsByBranch] = useState({}); // branchName -> list of { id, itemName, unit, dispatchQty }
  const [dispatchingBranch, setDispatchingBranch] = useState(null); // branchName currently dispatching
  const [allBranchRequests, setAllBranchRequests] = useState([]); // Filtered by dispatchReqDate (full persisted records with createdAt)
  const [allTimeRawRequests, setAllTimeRawRequests] = useState([]); // All-time requests for fallback sorting
  const [downloadingBranchRequestsPdf, setDownloadingBranchRequestsPdf] = useState(false);
  const [downloadingBranchPdf, setDownloadingBranchPdf] = useState(null); // branchName currently generating PDF

  // Dispatch Additional Items "+ New Item" modal state
  const [showDispatchNewItemModal, setShowDispatchNewItemModal] = useState(false);
  const [dispatchNewItemTarget, setDispatchNewItemTarget] = useState(null); // { branchName, rowId }
  const [newItemFormName, setNewItemFormName] = useState('');
  const [newItemFormUnit, setNewItemFormUnit] = useState('KG');
  const [savingDispatchNewItem, setSavingDispatchNewItem] = useState(false);

  const formatDDMMYYYY = (isoDate) => {
    if (!isoDate) return '';
    const parts = String(isoDate).slice(0, 10).split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : isoDate;
  };
  const [storeDispatchHistory, setStoreDispatchHistory] = useState([]);
  const [dispatchHistoryDate, setDispatchHistoryDate] = useState(getTodayDateString());
  const [dispatchHistoryIsAllDates, setDispatchHistoryIsAllDates] = useState(false);

  // 3-Option Order tab state: Consolidated Branch Requirement | Make a Order | Previous Orders
  const [orderSubTab, setOrderSubTab] = useState('consolidated'); // 'consolidated' | 'make-order' | 'previous-orders'
  const [consolidatedItems, setConsolidatedItems] = useState([]);
  const [consolidatedReqDate, setConsolidatedReqDate] = useState(getTodayDateString());
  const [consolidatedIsAllDates, setConsolidatedIsAllDates] = useState(false);
  const [selectedReqItems, setSelectedReqItems] = useState(new Set());
  const [makeOrderLines, setMakeOrderLines] = useState([]);
  const [submittingStoreOrder, setSubmittingStoreOrder] = useState(false);
  const [previousOrders, setPreviousOrders] = useState([]);
  const [previousOrderDate, setPreviousOrderDate] = useState(getTodayDateString());
  const [previousOrderIsAllDates, setPreviousOrderIsAllDates] = useState(false);
  const [alreadyOrderedToday, setAlreadyOrderedToday] = useState([]);
  const [loadingAlreadyOrdered, setLoadingAlreadyOrdered] = useState(false);
  const [viewOrderModal, setViewOrderModal] = useState(null); // { orderNumber, lines }

  // Operational Reports states
  const [reportSubTab, setReportSubTab] = useState('all'); // 'all', 'orders', 'inventory-entries', 'dispatches', 'branch-requests'
  const [reportSummary, setReportSummary] = useState({
    totalPurchaseOrders: 0,
    totalItemsOrdered: 0,
    totalQuantityReceived: 0,
    totalQuantityDispatched: 0,
    totalPendingAcknowledgement: 0
  });

  // Section 1: Order Report state
  const [poFilterDate, setPoFilterDate] = useState(getTodayDateString());
  const [poIsAllDates, setPoIsAllDates] = useState(false);
  const [poReport, setPoReport] = useState([]);
  const [loadingPoReport, setLoadingPoReport] = useState(false);
  const [poAvailableDates, setPoAvailableDates] = useState([]);

  // Section 2: Inventory Entry Report state
  const [inventoryEntryDate, setInventoryEntryDate] = useState(getTodayDateString());
  const [inventoryEntryIsAllDates, setInventoryEntryIsAllDates] = useState(false);
  const [inventoryEntryReport, setInventoryEntryReport] = useState([]);
  const [loadingInventoryEntryReport, setLoadingInventoryEntryReport] = useState(false);
  const [inventoryEntryAvailableDates, setInventoryEntryAvailableDates] = useState([]);

  // Section 3: Branch-wise Dispatch Report state
  const [dispatchFilterDate, setDispatchFilterDate] = useState(getTodayDateString());
  const [dispatchIsAllDates, setDispatchIsAllDates] = useState(false);
  const [dispatchFilterBranch, setDispatchFilterBranch] = useState(''); // '' = All Branches
  const [dispatchFilterCategory, setDispatchFilterCategory] = useState(''); // '' = All Categories
  const [dispatchReport, setDispatchReport] = useState([]);
  const [loadingDispatchReport, setLoadingDispatchReport] = useState(false);
  const [dispatchAvailableDates, setDispatchAvailableDates] = useState([]);

  // Section 4: Branch Requests Report state
  const [branchReqFilterDate, setBranchReqFilterDate] = useState(getTodayDateString());
  const [branchReqIsAllDates, setBranchReqIsAllDates] = useState(false);
  const [branchReqFilterBranch, setBranchReqFilterBranch] = useState('');
  const [branchReqFilterCategory, setBranchReqFilterCategory] = useState('');
  const [loadingBranchReqReport, setLoadingBranchReqReport] = useState(false);
  const [branchReqAvailableDates, setBranchReqAvailableDates] = useState([]);

  // Backwards compatibility for existing modal activity
  const [centralInvReport, setCentralInvReport] = useState([]);
  const [branchReqReport, setBranchReqReport] = useState([]);
  const [selectedItemActivity, setSelectedItemActivity] = useState(null);
  const [loadingReports, setLoadingReports] = useState(false);

  // Initial lookup data
  const loadInitialData = async () => {
    try {
      const [bList, iList] = await Promise.all([
        api.getBranches(),
        api.getItems()
      ]);
      if (Array.isArray(bList) && bList.length > 0) {
        setBranches(bList);
        if (!selectedBranch) setSelectedBranch(bList[0].name);
      }
      if (Array.isArray(iList)) {
        setCatalogueItems(iList);
      }
      await loadOrderDraft();
      loadConsolidated();
      loadAlreadyOrderedToday();
    } catch (err) {
      console.error('Error loading initial data', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Central Inventory loader
  const loadInventory = async () => {
    try {
      setLoading(true);
      const data = await api.getCentralInventory();
      if (Array.isArray(data)) setInventory(data);
    } catch (err) {
      showAlert('error', err.message || 'Failed to load central inventory');
    } finally {
      setLoading(false);
    }
  };

  const loadInventoryTransactions = async (date = invTxDate, item = invTxItem, from = invTxFromDate, to = invTxToDate, isAll = invTxIsAllDates) => {
    try {
      setLoadingInvTx(true);
      const queryDate = (isAll || from || to) ? '' : date;
      const data = await api.getCentralInventoryTransactions(queryDate, item, from, to);
      if (Array.isArray(data)) setInvTransactions(data);
    } catch (err) {
      console.error('Error loading inventory transactions', err);
    } finally {
      setLoadingInvTx(false);
    }
  };

  // Entry Items loaders
  const loadViewOrders = async (date = viewDate, isAll = viewIsAllDates) => {
    try {
      setLoading(true);
      const queryDate = isAll ? '' : date;
      const data = await api.getStoreOrdersView(queryDate, viewSearch);
      if (Array.isArray(data)) setViewOrders(data);
    } catch (err) {
      showAlert('error', err.message || 'Failed to load purchase orders view');
    } finally {
      setLoading(false);
    }
  };

  const loadEntryOrders = async (date = entryDate, isAll = entryIsAllDates) => {
    try {
      setLoading(true);
      const queryDate = isAll ? '' : date;
      const data = await api.getOrdersForReceiving(queryDate);
      const list = Array.isArray(data) ? data : [];
      setEntryOrders(list);

      // Rehydrate or auto-populate workingOrderNumbers
      setWorkingOrderNumbers(prev => {
        if (prev && prev.length > 0) return prev;
        const saved = localStorage.getItem('annamithra_working_order_numbers');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          } catch {}
        }
        // Auto-select latest pending order numbers if none currently active
        const pendingNums = Array.from(new Set(
          list.filter(o => o.poNumber && (o.status === 'ORDERED' || o.status === 'PARTIALLY_RECEIVED'))
              .map(o => o.poNumber)
        ));
        if (pendingNums.length > 0) {
          try { localStorage.setItem('annamithra_working_order_numbers', JSON.stringify(pendingNums)); } catch {}
          return pendingNums;
        }
        return [];
      });
    } catch (err) {
      showAlert('error', err.message || 'Failed to load orders for goods entry');
    } finally {
      setLoading(false);
    }
  };

  // Branch Requests loader
  const loadBranchRequests = async (branchName, dateStr, isAll = selectedBranchReqIsAllDates, category = selectedBranchReqCategory) => {
    if (!branchName) return;
    try {
      setLoading(true);
      const queryDate = isAll ? '' : (dateStr !== undefined ? dateStr : selectedBranchReqDate);
      const data = await api.getBranchRequests(branchName, queryDate, undefined, undefined, category);
      if (Array.isArray(data)) setBranchRequestsList(data);
    } catch (err) {
      showAlert('error', err.message || 'Failed to load branch requests');
    } finally {
      setLoading(false);
    }
  };

  // Dispatch outstanding loader (loads for all branches if branchName is omitted/null)
  const loadOutstandingForDispatch = async (branchName = null, reqDate = dispatchReqDate) => {
    try {
      setLoading(true);
      const [data, invData, rawFiltered, rawAll] = await Promise.all([
        api.getOutstandingBranchRequests(branchName || undefined, reqDate || undefined),
        api.getCentralInventory(),
        api.getRawBranchRequests(branchName || undefined, reqDate || undefined),
        api.getRawBranchRequests(branchName || undefined, undefined)
      ]);
      if (Array.isArray(invData)) setInventory(invData);
      if (Array.isArray(rawFiltered)) setAllBranchRequests(rawFiltered);
      if (Array.isArray(rawAll)) setAllTimeRawRequests(rawAll);
      if (Array.isArray(data)) {
        setOutstandingRequests(data);
        // Pre-fill dispatch quantities for each consolidated item group with the unfulfilled requirement
        const initialQtys = {};
        const groupTotals = {};
        data.forEach(r => {
          const bMatch = branches.find(b => (b.name || '').trim().toLowerCase() === (r.branch || branchName || '').trim().toLowerCase());
          const bId = r.branchId || (bMatch ? bMatch.id : (r.branch || branchName || ''));
          const cMatch = catalogueItems.find(i => (i.name || '').trim().toLowerCase() === (r.item || '').trim().toLowerCase());
          const iId = cMatch ? cMatch.id : (r.item || '').trim().toLowerCase();
          const u = (r.unit || 'KG').trim().toUpperCase();
          const key = `${bId}_${iId}_${u}`.toLowerCase();

          if (!groupTotals[key]) {
            groupTotals[key] = { totalReq: 0, dispatched: 0, itemName: r.item || '', unit: u };
          }
          groupTotals[key].totalReq += (r.requested || 0);
          groupTotals[key].dispatched += (r.dispatched || 0);
        });

        Object.keys(groupTotals).forEach(key => {
          const group = groupTotals[key];
          const rem = Math.max(0, group.totalReq - group.dispatched);
          initialQtys[key] = rem > 0 ? String(rem) : '';
        });
        setDispatchQtys(initialQtys);
      }
      await loadStoreDispatchHistory(branchName);
    } catch (err) {
      showAlert('error', err.message || 'Failed to load outstanding requests');
    } finally {
      setLoading(false);
    }
  };

  // Dispatch history loader for store manager (loads for all branches if branchName is omitted/null)
  const loadStoreDispatchHistory = async (branchName = null, date = dispatchHistoryDate, isAll = dispatchHistoryIsAllDates) => {
    try {
      const qDate = isAll ? '' : date;
      const data = await api.getStoreDispatchHistory(branchName || undefined, qDate);
      if (Array.isArray(data)) setStoreDispatchHistory(data);
    } catch (err) {
      console.error('Error loading store dispatch history', err);
    }
  };

  // Consolidated requirements loader
  const loadConsolidated = async (date = consolidatedReqDate, isAll = consolidatedIsAllDates) => {
    try {
      setLoading(true);
      const queryDate = isAll ? '' : date;
      const data = await api.getConsolidatedRequirements(queryDate);
      if (Array.isArray(data)) {
        setConsolidatedItems(data);
      }
    } catch (err) {
      showAlert('error', err.message || 'Failed to load consolidated requirements');
    } finally {
      setLoading(false);
    }
  };

  // Previous orders loader
  const loadPreviousOrders = async (date = previousOrderDate, isAll = previousOrderIsAllDates) => {
    try {
      setLoading(true);
      const queryDate = isAll ? '' : date;
      const data = await api.getPreviousOrders(queryDate);
      if (Array.isArray(data)) {
        setPreviousOrders(data);
      }
    } catch (err) {
      showAlert('error', err.message || 'Failed to load previous orders');
    } finally {
      setLoading(false);
    }
  };

  // Already Ordered Today loader
  const loadAlreadyOrderedToday = async () => {
    try {
      setLoadingAlreadyOrdered(true);
      const data = await api.getAlreadyOrderedToday();
      if (Array.isArray(data)) {
        setAlreadyOrderedToday(data);
      }
    } catch (err) {
      console.error('Error loading already ordered today', err);
    } finally {
      setLoadingAlreadyOrdered(false);
    }
  };

  // Order draft loader (from backend Supabase PostgreSQL or local cache)
  const loadOrderDraft = async () => {
    try {
      let lines = null;
      try {
        const remote = await api.getOrderDraft();
        if (typeof remote === 'string') {
          lines = JSON.parse(remote);
        } else if (Array.isArray(remote)) {
          lines = remote;
        }
      } catch (e) {
        // Fallback to local
      }

      if (!lines || !Array.isArray(lines) || lines.length === 0) {
        const cached = localStorage.getItem('annamithra_order_draft');
        if (cached) {
          try { lines = JSON.parse(cached); } catch (e) {}
        }
      }

      if (Array.isArray(lines) && lines.length > 0) {
        setMakeOrderLines(lines);
      }
    } catch (err) {
      console.warn('Could not load order draft', err);
    }
  };

  // Save order draft to both server and localStorage
  const saveDraft = async (lines) => {
    try {
      localStorage.setItem('annamithra_order_draft', JSON.stringify(lines));
      await api.saveOrderDraft(lines);
    } catch (err) {
      console.warn('Failed to save draft to server', err);
    }
  };

  // Clear order draft from both server and localStorage
  const clearDraft = async () => {
    try {
      localStorage.removeItem('annamithra_order_draft');
      await api.clearOrderDraft();
    } catch (err) {
      console.warn('Failed to clear draft on server', err);
    }
  };

  // Operational Reports loaders
  const loadPoReport = async (date = poFilterDate, isAll = poIsAllDates) => {
    try {
      setLoadingPoReport(true);
      const pos = await api.getPurchaseOrderReport({
        date: isAll ? '' : date
      });
      if (Array.isArray(pos)) setPoReport(pos);
    } catch (err) {
      console.error('Failed to load PO report', err);
    } finally {
      setLoadingPoReport(false);
    }
  };

  const loadInventoryEntryReport = async (date = inventoryEntryDate, isAll = inventoryEntryIsAllDates) => {
    try {
      setLoadingInventoryEntryReport(true);
      const entries = await api.getInventoryEntryReport({
        date: isAll ? '' : date
      });
      if (Array.isArray(entries)) setInventoryEntryReport(entries);
    } catch (err) {
      console.error('Failed to load inventory entry report', err);
    } finally {
      setLoadingInventoryEntryReport(false);
    }
  };

  const loadDispatchReport = async (date = dispatchFilterDate, isAll = dispatchIsAllDates, branch = dispatchFilterBranch, category = dispatchFilterCategory) => {
    try {
      setLoadingDispatchReport(true);
      const disps = await api.getBranchDispatchReport({
        date: isAll ? '' : date,
        branch: branch === 'ALL' ? '' : branch,
        category: category === 'ALL' ? '' : category
      });
      if (Array.isArray(disps)) setDispatchReport(disps);
    } catch (err) {
      console.error('Failed to load dispatch report', err);
    } finally {
      setLoadingDispatchReport(false);
    }
  };

  const loadBranchReqReport = async (date = branchReqFilterDate, isAll = branchReqIsAllDates, branch = branchReqFilterBranch, category = branchReqFilterCategory) => {
    try {
      setLoadingBranchReqReport(true);
      const queryDate = isAll ? '' : date;
      const reqs = await api.getBranchRequestReport({
        fromDate: queryDate,
        toDate: queryDate,
        branch: branch === 'ALL' ? '' : branch,
        category: category === 'ALL' ? '' : category
      });
      if (Array.isArray(reqs)) setBranchReqReport(reqs);
    } catch (err) {
      console.error('Failed to load branch requests report', err);
    } finally {
      setLoadingBranchReqReport(false);
    }
  };

  const loadAllReportDates = async () => {
    try {
      const [allPos, allEntries, allDisps, allReqs] = await Promise.all([
        api.getPurchaseOrderReport({}),
        api.getInventoryEntryReport({}),
        api.getBranchDispatchReport({}),
        api.getBranchRequestReport({})
      ]);
      if (Array.isArray(allPos)) {
        const dates = [...new Set(allPos.map(p => p.createdAt ? p.createdAt.slice(0, 10) : p.orderDate).filter(Boolean))].sort().reverse();
        setPoAvailableDates(dates);
      }
      if (Array.isArray(allEntries)) {
        const dates = [...new Set(allEntries.map(e => e.receiptDate ? e.receiptDate.slice(0, 10) : '').filter(Boolean))].sort().reverse();
        setInventoryEntryAvailableDates(dates);
      }
      if (Array.isArray(allDisps)) {
        const dates = [...new Set(allDisps.map(d => d.dispatchDate || (d.dispatchDateTime ? d.dispatchDateTime.slice(0, 10) : '') || (d.createdAt ? d.createdAt.slice(0, 10) : '')).filter(Boolean))].sort().reverse();
        setDispatchAvailableDates(dates);
      }
      if (Array.isArray(allReqs)) {
        const dates = [...new Set(allReqs.map(r => r.date ? r.date.slice(0, 10) : '').filter(Boolean))].sort().reverse();
        setBranchReqAvailableDates(dates);
      }
    } catch (err) {
      console.warn('Failed to load historical report dates', err);
    }
  };

  const loadReports = async () => {
    try {
      setLoadingReports(true);
      const [sum] = await Promise.all([
        api.getReportSummary({}),
        loadPoReport(poFilterDate, poIsAllDates),
        loadInventoryEntryReport(inventoryEntryDate, inventoryEntryIsAllDates),
        loadDispatchReport(dispatchFilterDate, dispatchIsAllDates, dispatchFilterBranch, dispatchFilterCategory),
        loadBranchReqReport(branchReqFilterDate, branchReqIsAllDates, branchReqFilterBranch, branchReqFilterCategory),
        loadAllReportDates()
      ]);
      if (sum) setReportSummary(sum);
    } catch (err) {
      showAlert('error', err.message || 'Failed to load operational reports');
    } finally {
      setLoadingReports(false);
    }
  };

  // CSV Export utility
  const downloadCsv = (filename, data) => {
    if (!data || !data.length) {
      return showAlert('error', 'No records found matching filters to export.');
    }
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          let val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
          val = val.replace(/"/g, '""');
          if (val.search(/("|,|\n)/g) >= 0) {
            val = `"${val}"`;
          }
          return val;
        }).join(',')
      )
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showAlert('success', `✓ Exported ${filename}.csv with ${data.length} records.`);
  };

  const handleExportCentralInventory = () => {
    const data = centralInvReport.map(item => ({
      'Item Name': item.itemName,
      'Unit': item.unit,
      'Current Available Stock': item.currentStock,
      'Total Quantity Received': item.totalQuantityReceived,
      'Total Quantity Dispatched': item.totalQuantityDispatched
    }));
    downloadCsv('central_inventory_report', data);
  };

  const handleExportPurchaseOrders = () => {
    const data = poReport.map(po => ({
      'Order Number': po.orderNumber,
      'Order Date and Time': po.createdAt ? po.createdAt.replace('T', ' ').slice(0, 16) : (po.orderDate || ''),
      'Item Name': po.itemName,
      'Unit': po.unit,
      'Ordered Quantity': po.quantityOrdered,
      'Status': po.status
    }));
    downloadCsv('order_report', data);
  };

  const handleExportInventoryEntries = () => {
    const data = inventoryEntryReport.map(entry => ({
      'Receipt Date and Time': entry.receiptDate ? entry.receiptDate.replace('T', ' ').slice(0, 16) : '',
      'Order Number': entry.orderNumber || '',
      'Item Name': entry.itemName,
      'Unit': entry.unit,
      'Quantity Received': entry.quantityReceived,
      'Updated Stock Balance': entry.updatedStockBalance !== null ? entry.updatedStockBalance : '',
      'Received By': entry.receivedBy || ''
    }));
    downloadCsv('inventory_entry_report', data);
  };

  const handleExportBranchRequests = () => {
    const data = branchReqReport.map(r => ({
      'Request Date': r.date || '',
      'Branch Name': r.branchName || '',
      'Category': r.category || '',
      'Item Name': r.itemName || '',
      'Unit': r.unit || '',
      'Requested Quantity': r.requestedQuantity || 0,
      'Dispatched Quantity': r.dispatchedQuantity || 0,
      'Acknowledged Received Quantity': r.acknowledgedReceivedQuantity || 0,
      'Remaining Quantity': r.remainingQuantity || 0,
      'Request Status': r.status || ''
    }));
    downloadCsv('branch_requests_report', data);
  };

  const handleExportBranchRequestsPdf = () => {
    downloadBranchRequestReportPdf({
      branch: branchReqFilterBranch,
      dateStr: branchReqFilterDate,
      isAllDates: branchReqIsAllDates,
      category: branchReqFilterCategory,
      items: branchReqReport,
      language
    });
  };

  const handleExportDispatches = () => {
    const data = dispatchReport.map(d => ({
      'Dispatch Date and Time': d.dispatchDateTime ? d.dispatchDateTime.replace('T', ' ').slice(0, 16) : (d.dispatchDate || ''),
      'Branch Name': d.branchName,
      'Category': d.category || '',
      'Item Name': d.itemName,
      'Unit': d.unit,
      'Requested Quantity': d.requestedQuantity,
      'Dispatched Quantity': d.dispatchedQuantity,
      'Delivery/Acknowledgement Status': d.status
    }));
    downloadCsv('branch_dispatch_report', data);
  };

  // Tab switch effect
  useEffect(() => {
    if (activeTab === 'central-inventory') {
      loadInventory();
      loadInventoryTransactions(invTxDate, invTxItem, invTxFromDate, invTxToDate, invTxIsAllDates);
    } else if (activeTab === 'entry-items') {
      loadEntryOrders(entryDate, entryIsAllDates);
    } else if (activeTab === 'branch-requests') {
      loadOutstandingForDispatch(null, dispatchReqDate);
      loadStoreDispatchHistory(null, dispatchHistoryDate, dispatchHistoryIsAllDates);
    } else if (activeTab === 'order') {
      loadOrderDraft();
      if (orderSubTab === 'consolidated') {
        loadConsolidated(consolidatedReqDate, consolidatedIsAllDates);
      } else if (orderSubTab === 'previous-orders') {
        loadPreviousOrders(previousOrderDate, previousOrderIsAllDates);
      }
      if (inventory.length === 0) {
        loadInventory();
      }
    } else if (activeTab === 'reports' || activeTab === 'history') {
      loadReports();
    }
  }, [
    activeTab,
    entrySubTab,
    branchReqSubTab,
    orderSubTab,
    selectedBranch,
    selectedBranchReqDate,
    selectedBranchReqIsAllDates,
    selectedBranchReqCategory,
    dispatchReqDate,
    dispatchHistoryDate,
    dispatchHistoryIsAllDates,
    invTxDate,
    invTxIsAllDates,
    invTxFromDate,
    invTxToDate,
    viewDate,
    viewIsAllDates,
    entryDate,
    entryIsAllDates,
    consolidatedReqDate,
    consolidatedIsAllDates,
    previousOrderDate,
    previousOrderIsAllDates,
    poFilterDate,
    poIsAllDates,
    inventoryEntryDate,
    inventoryEntryIsAllDates,
    dispatchFilterDate,
    dispatchIsAllDates,
    dispatchFilterBranch,
    dispatchFilterCategory,
    branchReqFilterDate,
    branchReqIsAllDates,
    branchReqFilterBranch,
    branchReqFilterCategory
  ]);

  // Handle Receiving goods against PO
  const handleReceiveGoods = async (order) => {
    const rawQty = receiveQtys[order.id];
    const qty = parseInt(rawQty, 10);
    const remaining = (order.quantity || 0) - (order.receivedQty || 0);

    if (isNaN(qty) || qty <= 0) {
      return showAlert('error', 'Please enter a positive quantity received');
    }
    if (qty > remaining) {
      return showAlert('error', `Cannot receive ${qty} ${order.unit}. Maximum remaining to receive is ${remaining} ${order.unit}`);
    }

    try {
      setReceivingId(order.id);
      const updated = await api.receiveOrderGoods(order.id, qty);
      showAlert('success', `✓ Successfully received ${qty} ${order.unit} of ${order.item}! Central inventory updated (+${qty} ${order.unit}). Order status: ${updated.status || 'Updated'}.`);
      setReceiveQtys(prev => ({ ...prev, [order.id]: '' }));
      await Promise.all([
        loadEntryOrders(entryDate, entryIsAllDates),
        loadInventory()
      ]);
    } catch (err) {
      showAlert('error', err.message || 'Failed to record goods receipt');
    } finally {
      setReceivingId(null);
    }
  };

  const [confirmingOrder, setConfirmingOrder] = useState(null);

  const handleMoveToReceive = (orderNumber) => {
    if (!orderNumber) return;
    setWorkingOrderNumbers(prev => {
      if (prev.includes(orderNumber)) return prev;
      const next = [orderNumber, ...prev];
      try {
        localStorage.setItem('annamithra_working_order_numbers', JSON.stringify(next));
      } catch (err) {
        console.warn('Failed to save working order numbers', err);
      }
      return next;
    });
  };

  const handleRemoveFromWorkingList = (orderNumber) => {
    setWorkingOrderNumbers(prev => {
      const next = prev.filter(num => num !== orderNumber);
      try {
        localStorage.setItem('annamithra_working_order_numbers', JSON.stringify(next));
      } catch (err) {
        console.warn('Failed to update working order numbers', err);
      }
      return next;
    });
  };

  // Group all entry orders into purchase-order groups (one row per purchase order)
  const allGroupedOrders = useMemo(() => {
    const map = new Map();
    entryOrders.forEach(order => {
      const poNum = order.poNumber || `PO-${order.id}`;
      if (!map.has(poNum)) {
        map.set(poNum, {
          poNumber: poNum,
          orderDate: order.orderDate || (order.createdAt ? order.createdAt.slice(0, 10) : ''),
          orderDateTime: order.createdAt || order.orderDate,
          lines: []
        });
      }
      map.get(poNum).lines.push(order);
    });

    const groups = [];
    for (const group of map.values()) {
      group.lines.sort((a, b) => (a.id || 0) - (b.id || 0));
      group.totalItems = group.lines.length;
      const remainingLines = group.lines.filter(l => ((l.quantity || 0) - (l.receivedQty || 0)) > 0);
      group.remainingItemsCount = remainingLines.length;

      const anyReceived = group.lines.some(l => (l.receivedQty || 0) > 0);
      const allFullyReceived = group.remainingItemsCount === 0;

      if (allFullyReceived) {
        group.status = 'RECEIVED';
        group.statusLabel = 'Fully Received';
      } else if (anyReceived) {
        group.status = 'PARTIALLY_RECEIVED';
        group.statusLabel = 'Partially Received';
      } else {
        group.status = 'ORDERED';
        group.statusLabel = 'Pending Receipt';
      }

      groups.push(group);
    }

    // Sort newest first
    groups.sort((a, b) => {
      const dtA = a.orderDateTime || a.orderDate || '';
      const dtB = b.orderDateTime || b.orderDate || '';
      return dtB.localeCompare(dtA);
    });

    return groups;
  }, [entryOrders]);

  // Filter grouped orders for the left Receive Items list
  const filteredGroupedOrders = useMemo(() => {
    return allGroupedOrders.filter(group => {
      if (entrySearch && entrySearch.trim()) {
        const q = entrySearch.trim().toLowerCase();
        const poMatch = group.poNumber.toLowerCase().includes(q);
        const itemMatch = group.lines.some(l => (l.item || '').toLowerCase().includes(q));
        if (!poMatch && !itemMatch) return false;
      }

      if (entryStatusFilter === 'AWAITING' || entryStatusFilter === 'PENDING') {
        return group.remainingItemsCount > 0;
      }
      if (entryStatusFilter === 'PARTIAL') {
        return group.status === 'PARTIALLY_RECEIVED';
      }
      if (entryStatusFilter === 'RECEIVED') {
        return group.remainingItemsCount === 0;
      }

      return true;
    });
  }, [allGroupedOrders, entrySearch, entryStatusFilter]);

  // Working orders displayed on the right side
  const workingOrdersGrouped = useMemo(() => {
    const orderMap = new Map();
    workingOrderNumbers.forEach(num => {
      orderMap.set(num, []);
    });

    entryOrders.forEach(order => {
      const num = order.poNumber || `PO-${order.id}`;
      if (num && orderMap.has(num)) {
        orderMap.get(num).push(order);
      }
    });

    const result = [];
    for (const [orderNumber, lines] of orderMap.entries()) {
      if (lines.length > 0) {
        lines.sort((a, b) => (a.id || 0) - (b.id || 0));
        const sample = lines[0];
        const orderDate = sample.orderDate || (sample.createdAt ? sample.createdAt.slice(0, 10) : '');
        const orderDateTime = sample.createdAt || sample.orderDate;
        const remainingLines = lines.filter(l => ((l.quantity || 0) - (l.receivedQty || 0)) > 0);
        const remainingItemsCount = remainingLines.length;
        const allReceived = remainingItemsCount === 0;
        const anyReceived = lines.some(l => (l.receivedQty || 0) > 0);
        const status = allReceived ? 'RECEIVED' : (anyReceived ? 'PARTIALLY_RECEIVED' : 'ORDERED');

        result.push({
          orderNumber,
          orderDate,
          orderDateTime,
          status,
          lines,
          totalItems: lines.length,
          remainingItemsCount
        });
      }
    }
    return result;
  }, [entryOrders, workingOrderNumbers]);

  // Confirm receipt for all items entered in an order card
  const handleConfirmOrderReceipt = async (group) => {
    if (!group || confirmingOrder) return;

    const itemsToProcess = [];
    for (const line of group.lines) {
      const remaining = Math.max(0, (line.quantity || 0) - (line.receivedQty || 0));
      if (remaining <= 0) continue;

      const rawVal = receiveQtys[line.id];
      if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
        const qty = parseInt(rawVal, 10);
        if (isNaN(qty) || qty <= 0) {
          return showAlert('error', `Please enter a valid positive quantity for ${line.item}`);
        }
        if (qty > remaining) {
          return showAlert('error', `Cannot receive ${qty} ${line.unit} of ${line.item}. Maximum remaining to receive is ${remaining} ${line.unit}`);
        }
        itemsToProcess.push({ line, qty });
      }
    }

    if (itemsToProcess.length === 0) {
      return showAlert('error', `Please enter a quantity in "Receive Now" for at least one item in ${group.orderNumber} before confirming`);
    }

    try {
      setConfirmingOrder(group.orderNumber);
      const results = [];
      for (const item of itemsToProcess) {
        await api.receiveOrderGoods(item.line.id, item.qty);
        results.push({ item: item.line.item, qty: item.qty, unit: item.line.unit });
      }

      // Clear receive inputs for processed items
      setReceiveQtys(prev => {
        const next = { ...prev };
        itemsToProcess.forEach(i => {
          delete next[i.line.id];
        });
        return next;
      });

      const summaryText = results.map(r => `${r.qty} ${r.unit} of ${r.item}`).join(', ');
      showAlert('success', `✓ Successfully received ${summaryText} for ${group.orderNumber}! Central inventory updated.`);

      await Promise.all([
        loadEntryOrders(entryDate, entryIsAllDates),
        loadInventory()
      ]);
    } catch (err) {
      showAlert('error', err.message || `Failed to record receipts for ${group.orderNumber}`);
    } finally {
      setConfirmingOrder(null);
    }
  };

  // Add Item Modal handlers
  const handleOpenAddItemModal = () => {
    setNewItemName('');
    setNewItemUnit('KG');
    setNewItemCustomUnit('');
    setNewItemQuantity('');
    setAddItemError('');
    setShowAddItemModal(true);
  };

  const handleCloseAddItemModal = () => {
    if (savingNewItem) return;
    setShowAddItemModal(false);
    setAddItemError('');
  };

  const handleSaveNewItem = async (e) => {
    if (e) e.preventDefault();
    setAddItemError('');

    const trimmedName = (newItemName || '').trim();
    const effectiveUnit = newItemUnit === '__CUSTOM__' ? (newItemCustomUnit || '').trim() : (newItemUnit || '').trim();
    const rawQty = (newItemQuantity || '').toString().trim();
    const qty = Number(rawQty);

    if (!trimmedName) {
      setAddItemError(t('Item name is required.', 'Item name is required.'));
      addItemInputRef.current?.focus();
      return;
    }
    if (!effectiveUnit) {
      setAddItemError(t('Unit is required.', 'Unit is required (e.g. KG, L, Pieces).'));
      modalUnitSelectRef.current?.focus();
      return;
    }
    if (!rawQty || isNaN(qty) || qty <= 0) {
      setAddItemError(t('Quantity must be greater than zero.', 'Quantity must be greater than zero.'));
      modalQtyInputRef.current?.focus();
      return;
    }

    try {
      setSavingNewItem(true);
      const result = await api.addDirectStock({
        itemName: trimmedName,
        unit: effectiveUnit,
        quantity: Math.round(qty)
      });

      // Refresh Central Inventory, catalogue, and Entry Items page without page reload
      await Promise.all([
        loadInventory(),
        api.getItems().then(res => setCatalogueItems(res || [])),
        loadEntryOrders(entryDate, entryIsAllDates)
      ]);

      setShowAddItemModal(false);

      const dispItem = language === 'ta' ? translateItem(result.itemName) : result.itemName;
      const dispUnit = language === 'ta' ? translateUnit(result.unit) : result.unit;
      if (language === 'ta') {
        showAlert('success', `✓ "${dispItem}" (${dispUnit}) பொருளுக்கு ${result.quantityAdded} ${dispUnit} மைய சரக்கு இருப்பில் வெற்றிகரமாக சேர்க்கப்பட்டது! புதிய இருப்பு: ${result.newStock} ${dispUnit}.`);
      } else {
        showAlert('success', `✓ Successfully added ${result.quantityAdded} ${dispUnit} of "${dispItem}" to Central Inventory! New available stock: ${result.newStock} ${dispUnit}.`);
      }
    } catch (err) {
      setAddItemError(err.message || 'Failed to add item and stock to Central Inventory.');
    } finally {
      setSavingNewItem(false);
    }
  };

  const handleEntryItemChange = (itemName) => {
    setEntrySelectedItem(itemName);
    const found = catalogueItems.find(it => it.name === itemName);
    if (found) {
      setEntrySelectedUnit(found.unit);
    } else {
      setEntrySelectedUnit('');
    }
    setEntryReceivedQty('');
  };

  const handleDirectReceiptSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!entrySelectedItem) {
      return showAlert('error', 'Please select an item to record goods receipt');
    }
    const qty = parseInt(entryReceivedQty, 10);
    if (isNaN(qty) || qty <= 0) {
      return showAlert('error', 'Please enter a valid received quantity greater than 0');
    }

    try {
      setSubmittingDirectReceipt(true);
      const res = await api.receiveDirectGoods({
        itemName: entrySelectedItem,
        receivedQty: qty,
        receiptDate: entryReceiptDate || getTodayDateString()
      });

      if (res.receiptType === 'LINKED_PO') {
        showAlert('success', `✓ Successfully received ${res.receivedQty} ${res.unit} of ${res.itemName} against Purchase Order ${res.poNumber}! Central inventory is now ${res.currentStock} ${res.unit} (Order status: ${res.status}).`);
      } else {
        showAlert('success', `✓ Successfully entered ${res.receivedQty} ${res.unit} of ${res.itemName} into central inventory! New stock balance: ${res.currentStock} ${res.unit}.`);
      }

      setEntryReceivedQty('');
      // Refresh orders, catalogue, and central inventory
      const [refreshedOrders, refreshedItems] = await Promise.all([
        api.getOrdersForReceiving(entryDate),
        api.getItems()
      ]);
      setEntryOrders(Array.isArray(refreshedOrders) ? refreshedOrders : []);
      setCatalogueItems(Array.isArray(refreshedItems) ? refreshedItems : []);
      loadInventory();
    } catch (err) {
      showAlert('error', err.message || 'Failed to record goods receipt');
    } finally {
      setSubmittingDirectReceipt(false);
    }
  };

  // Additional Item row handlers for Dispatch (per branch)
  const handleAddAdditionalItem = (branchName, autoFocus = true) => {
    const targetBranch = branchName || branches[0]?.name;
    if (!targetBranch) return;
    const defaultItem = catalogueItems[0]?.name || 'Rice';
    const defaultUnit = catalogueItems[0]?.unit || 'KG';
    const newId = Date.now() + Math.random();
    setAdditionalItemsByBranch(prev => {
      const existing = prev[targetBranch] || [];
      return {
        ...prev,
        [targetBranch]: [
          ...existing,
          {
            id: newId,
            itemName: defaultItem,
            unit: defaultUnit,
            dispatchQty: ''
          }
        ]
      };
    });
    if (autoFocus) {
      setTimeout(() => {
        const selectElem = document.querySelector(`select[data-additional-id="${newId}"]`);
        if (selectElem) {
          selectElem.focus();
          selectElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);
    }
  };

  const handleUpdateAdditionalItem = (branchName, id, field, value) => {
    if (!branchName) return;
    setAdditionalItemsByBranch(prev => {
      const existing = prev[branchName] || [];
      const updated = existing.map(item => {
        if (item.id === id) {
          if (field === 'itemName') {
            const match = catalogueItems.find(x => x.name === value);
            return { ...item, itemName: value, unit: match?.unit || 'KG' };
          }
          return { ...item, [field]: value };
        }
        return item;
      });
      return { ...prev, [branchName]: updated };
    });
  };

  const handleRemoveAdditionalItem = (branchName, id) => {
    if (!branchName) return;
    setAdditionalItemsByBranch(prev => {
      const existing = prev[branchName] || [];
      return {
        ...prev,
        [branchName]: existing.filter(item => item.id !== id)
      };
    });
  };

  // Supported units for "+ New Item" modal
  const DISPATCH_SUPPORTED_UNITS = [
    'KG',
    'GRAMS',
    'LITRE',
    'ML',
    'PACKET',
    'PIECE',
    'BOX',
    'BOTTLE',
    'CAN',
    'TIN',
    'BAG',
    'BUNCH'
  ];

  // Open the "+ New Item" popup modal
  const handleOpenDispatchNewItemModal = (branchName, rowId) => {
    setDispatchNewItemTarget({ branchName, rowId });
    setNewItemFormName('');
    setNewItemFormUnit('KG');
    setShowDispatchNewItemModal(true);
  };

  // Close the "+ New Item" popup modal
  const handleCloseDispatchNewItemModal = () => {
    setShowDispatchNewItemModal(false);
    setDispatchNewItemTarget(null);
    setNewItemFormName('');
    setNewItemFormUnit('KG');
  };

  // Save the new item persistently to database and select in current dispatch row
  const handleSaveDispatchNewItem = async (e) => {
    if (e) e.preventDefault();
    const cleanedName = (newItemFormName || '').trim();
    const cleanedUnit = (newItemFormUnit || '').trim().toUpperCase();

    if (!cleanedName) {
      showAlert('error', language === 'ta' ? 'பொருளின் பெயரை உள்ளிடவும்.' : 'Please enter an item name.');
      return;
    }
    if (!cleanedUnit) {
      showAlert('error', language === 'ta' ? 'அளவீட்டு அலகைத் தேர்ந்தெடுக்கவும்.' : 'Please select a unit.');
      return;
    }

    // Check for accidental duplicate items with same name and unit, ignoring letter case and extra spaces
    const isDuplicate = catalogueItems.some(it =>
      (it.name || '').trim().toLowerCase() === cleanedName.toLowerCase() &&
      (it.unit || '').trim().toUpperCase() === cleanedUnit
    );
    if (isDuplicate) {
      showAlert('error', language === 'ta'
        ? `"${cleanedName}" (${cleanedUnit}) என்ற பொருள் ஏற்கனவே பட்டியலில் உள்ளது.`
        : `Item "${cleanedName}" (${cleanedUnit}) already exists in the catalogue.`);
      return;
    }

    try {
      setSavingDispatchNewItem(true);
      // Persist to database via existing API endpoint POST /api/items
      const createdItem = await api.createItem({
        name: cleanedName,
        unit: cleanedUnit
      });

      // Refresh catalogue list persistently from backend
      const refreshedList = await api.getItems();
      const updatedCatalogue = Array.isArray(refreshedList) ? refreshedList : [...catalogueItems, createdItem];
      setCatalogueItems(updatedCatalogue);

      // Automatically select the newly created item in the triggering dispatch row
      if (dispatchNewItemTarget) {
        const { branchName, rowId } = dispatchNewItemTarget;
        setAdditionalItemsByBranch(prev => {
          const existing = prev[branchName] || [];
          const updated = existing.map(item => {
            if (item.id === rowId) {
              return {
                ...item,
                itemName: createdItem.name || cleanedName,
                unit: createdItem.unit || cleanedUnit
              };
            }
            return item;
          });
          return { ...prev, [branchName]: updated };
        });
      }

      showAlert('success', language === 'ta'
        ? `✓ புதிய பொருள் "${cleanedName}" (${cleanedUnit}) வெற்றிகரமாக உருவாக்கப்பட்டு தேர்ந்தெடுக்கப்பட்டது!`
        : `✓ New item "${cleanedName}" (${cleanedUnit}) successfully created and selected!`);

      handleCloseDispatchNewItemModal();
    } catch (err) {
      console.error('Failed to create new item for dispatch', err);
      showAlert('error', err.message || (language === 'ta'
        ? 'புதிய பொருளை உருவாக்க முடியவில்லை'
        : 'Failed to create new item'));
    } finally {
      setSavingDispatchNewItem(false);
    }
  };

  // Consolidate duplicate branch request items for dispatch
  // Group by: Branch ID, Item ID, Unit
  const consolidatedDispatchItems = useMemo(() => {
    const groupMap = new Map();

    outstandingRequests.forEach(req => {
      const bMatch = branches.find(b => (b.name || '').trim().toLowerCase() === (req.branch || '').trim().toLowerCase());
      const branchId = req.branchId || (bMatch ? bMatch.id : (req.branch || ''));
      const branchName = req.branch || (bMatch ? bMatch.name : '');
      const cMatch = catalogueItems.find(i => (i.name || '').trim().toLowerCase() === (req.item || '').trim().toLowerCase());
      const itemId = cMatch ? cMatch.id : (req.itemId || (req.item || '').trim().toLowerCase());
      const unit = (req.unit || 'KG').trim().toUpperCase();
      const itemName = req.item ? req.item.trim() : '';

      const groupKey = `${branchId}_${itemId}_${unit}`.toLowerCase();

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          key: groupKey,
          branchId,
          branchName,
          itemId,
          itemName,
          unit,
          totalRequested: 0,
          alreadyDispatched: 0,
          remainingToDispatch: 0,
          requests: []
        });
      }

      const group = groupMap.get(groupKey);
      group.totalRequested += (req.requested || 0);
      group.alreadyDispatched += (req.dispatched || 0);
      group.requests.push(req);
    });

    return Array.from(groupMap.values()).map(group => {
      group.remainingToDispatch = Math.max(0, group.totalRequested - group.alreadyDispatched);
      // Sort requests chronologically / by ID for FIFO dispatch allocation
      group.requests.sort((a, b) => (a.id || 0) - (b.id || 0));
      return group;
    }).filter(group => group.remainingToDispatch > 0);
  }, [outstandingRequests, catalogueItems, branches]);

  // Sort authorized branches based on request submission order:
  // Oldest request first (ascending). Branches without requests appear after,
  // sorted by their earliest all-time request or stable ID fallback.
  const sortedBranches = useMemo(() => {
    if (!branches || branches.length === 0) return [];

    const getBranchReqs = (list, branch) => {
      const bName = (branch.name || '').trim().toLowerCase();
      const bId = branch.id;
      return (list || []).filter(r => {
        const rName = (r.branch || '').trim().toLowerCase();
        const rId = r.branchId;
        return (bId && rId && bId === rId) || (bName && rName && bName === rName);
      });
    };

    const getEarliestTimestamp = (reqs) => {
      if (!reqs || reqs.length === 0) return null;
      let earliest = null;
      for (const r of reqs) {
        if (!r.createdAt) continue;
        const time = new Date(r.createdAt).getTime();
        if (!isNaN(time)) {
          if (earliest === null || time < earliest) {
            earliest = time;
          }
        }
      }
      return earliest;
    };

    const annotated = branches.map(branch => {
      const filterReqs = getBranchReqs(allBranchRequests, branch);
      const hasMatchingRequests = filterReqs.length > 0;
      const earliestFilterTime = getEarliestTimestamp(filterReqs);

      const allTimeReqs = getBranchReqs(allTimeRawRequests, branch);
      const earliestAllTime = getEarliestTimestamp(allTimeReqs);

      return {
        branch,
        hasMatchingRequests,
        earliestFilterTime,
        earliestAllTime,
        filterReqsCount: filterReqs.length
      };
    });

    annotated.sort((a, b) => {
      // 1. Branches with matching requests appear first
      if (a.hasMatchingRequests && !b.hasMatchingRequests) return -1;
      if (!a.hasMatchingRequests && b.hasMatchingRequests) return 1;

      if (a.hasMatchingRequests && b.hasMatchingRequests) {
        // Compare earliest request creation timestamps (ascending: oldest first, newest later)
        if (a.earliestFilterTime !== null && b.earliestFilterTime !== null) {
          if (a.earliestFilterTime !== b.earliestFilterTime) {
            return a.earliestFilterTime - b.earliestFilterTime;
          }
        } else if (a.earliestFilterTime !== null) {
          return -1;
        } else if (b.earliestFilterTime !== null) {
          return 1;
        }
        // Stable secondary sort: branch ID
        const idA = a.branch.id || 0;
        const idB = b.branch.id || 0;
        if (idA !== idB) return idA - idB;
        return (a.branch.name || '').localeCompare(b.branch.name || '');
      }

      // Neither has matching requests for selected date/filter:
      // Sort using earliest available request timestamp across all dates, or stable ID fallback
      if (a.earliestAllTime !== null && b.earliestAllTime !== null) {
        if (a.earliestAllTime !== b.earliestAllTime) {
          return a.earliestAllTime - b.earliestAllTime;
        }
      } else if (a.earliestAllTime !== null) {
        return -1;
      } else if (b.earliestAllTime !== null) {
        return 1;
      }

      const idA = a.branch.id || 0;
      const idB = b.branch.id || 0;
      if (idA !== idB) return idA - idB;
      return (a.branch.name || '').localeCompare(b.branch.name || '');
    });

    return annotated.map(item => item.branch);
  }, [branches, allBranchRequests, allTimeRawRequests]);

  // Handler to download All Branches Requests PDF report
  const handleDownloadBranchRequestsPdf = async () => {
    try {
      setDownloadingBranchRequestsPdf(true);
      await downloadBranchRequestsPdf({
        sortedBranches,
        requests: allBranchRequests,
        dateFilter: dispatchReqDate,
        isAllDates: !dispatchReqDate,
        language
      });
      showAlert('success', language === 'ta'
        ? '✓ அனைத்து கிளைகளின் கோரிக்கைகள் அறிக்கை PDF வெற்றிகரமாக பதிவிறக்கப்பட்டது!'
        : '✓ All Branches Requests Report PDF downloaded successfully!');
    } catch (err) {
      console.error('Failed to generate all branches requests PDF', err);
      showAlert('error', err.message || (language === 'ta'
        ? 'அனைத்து கிளைகளின் கோரிக்கைகள் அறிக்கை PDF உருவாக்க முடியவில்லை'
        : 'Failed to generate All Branches Requests PDF'));
    } finally {
      setDownloadingBranchRequestsPdf(false);
    }
  };

  // Handler to download an Individual Branch Requests PDF report
  const handleDownloadSingleBranchPdf = async (branch) => {
    if (!branch) return;
    const branchName = branch.name || 'Branch';
    try {
      setDownloadingBranchPdf(branchName);
      await downloadBranchRequestsPdf({
        sortedBranches: [branch],
        requests: allBranchRequests,
        dateFilter: dispatchReqDate,
        isAllDates: !dispatchReqDate,
        language,
        singleBranch: branch
      });
      showAlert('success', language === 'ta'
        ? `✓ ${branchName} கிளையின் கோரிக்கை அறிக்கை PDF வெற்றிகரமாக பதிவிறக்கப்பட்டது!`
        : `✓ ${branchName} Requests Report PDF downloaded successfully!`);
    } catch (err) {
      console.error(`Failed to generate PDF for branch ${branchName}`, err);
      showAlert('error', err.message || (language === 'ta'
        ? `${branchName} கிளையின் கோரிக்கை அறிக்கை PDF உருவாக்க முடியவில்லை`
        : `Failed to generate PDF for ${branchName}`));
    } finally {
      setDownloadingBranchPdf(null);
    }
  };

  // Dispatch Items submit for a specific branch
  const handleDispatchItems = async (branchName) => {
    if (!branchName) {
      return showAlert('error', 'Please select a branch to dispatch');
    }
    if (dispatchingBranch) return;

    const itemsToDispatch = [];

    // Find consolidated items for this branch
    const bMatch = branches.find(b => (b.name || '').trim().toLowerCase() === branchName.trim().toLowerCase());
    const bId = bMatch ? bMatch.id : null;
    const branchItems = consolidatedDispatchItems.filter(item =>
      (item.branchName || '').trim().toLowerCase() === branchName.trim().toLowerCase() ||
      (bId && item.branchId === bId)
    );

    // 1. Validate and gather consolidated requested items
    for (const group of branchItems) {
      const curStr = dispatchQtys[group.key];

      if (curStr === undefined || curStr === null || String(curStr).trim() === '') {
        continue;
      }

      const qVal = parseInt(curStr, 10);
      if (isNaN(qVal) || qVal < 0) {
        return showAlert('error', `Please enter a valid non-negative dispatch quantity for ${group.itemName}`);
      }
      if (qVal === 0) continue;

      let needed = qVal;
      for (const req of group.requests) {
        if (needed <= 0) break;
        const reqRemaining = Math.max(0, (req.requested || 0) - (req.dispatched || 0));
        if (reqRemaining <= 0) continue;
        const toAlloc = Math.min(needed, reqRemaining);
        itemsToDispatch.push({
          requestId: req.id,
          itemName: req.item,
          unit: req.unit,
          dispatchQty: toAlloc,
          isAdditional: false
        });
        needed -= toAlloc;
      }

      // If entered dispatch quantity exceeds unfulfilled requirement, allocate surplus as additional dispatch
      if (needed > 0) {
        itemsToDispatch.push({
          requestId: null,
          itemName: group.itemName,
          unit: group.unit,
          dispatchQty: needed,
          isAdditional: true
        });
      }
    }

    // 2. Validate and gather additional non-requested items for this branch
    const branchAdditional = additionalItemsByBranch[branchName] || [];
    for (const add of branchAdditional) {
      if (!add.itemName) continue;
      const qVal = parseInt(add.dispatchQty, 10);
      if (isNaN(qVal) || qVal <= 0) {
        return showAlert('error', `Please enter a positive dispatch quantity for additional item ${add.itemName}`);
      }

      itemsToDispatch.push({
        requestId: null,
        itemName: add.itemName,
        unit: add.unit,
        dispatchQty: qVal,
        isAdditional: true
      });
    }

    if (itemsToDispatch.length === 0) {
      return showAlert('error', `Please enter at least one item with a positive dispatch quantity for ${branchName}`);
    }

    try {
      setDispatchingBranch(branchName);
      const dispatches = await api.dispatchItems(branchName, itemsToDispatch);
      showAlert('success', `✓ Successfully dispatched ${dispatches.length} item(s) to ${branchName}! Central inventory deducted. Marked as Pending Acknowledgement.`);
      setAdditionalItemsByBranch(prev => ({ ...prev, [branchName]: [] }));
      await Promise.all([
        loadInventory(),
        loadOutstandingForDispatch(null, dispatchReqDate),
        loadStoreDispatchHistory(null, dispatchHistoryDate, dispatchHistoryIsAllDates)
      ]);
    } catch (err) {
      showAlert('error', err.message || `Failed to dispatch items to ${branchName}`);
    } finally {
      setDispatchingBranch(null);
    }
  };

  // Central available stock lookup helper
  const getCentralStock = (itemName, unit) => {
    if (!itemName) return 0;
    const inv = inventory.find(i => {
      const nameMatch = (i.name || i.item || '').trim().toLowerCase() === itemName.trim().toLowerCase();
      if (!nameMatch) return false;
      if (unit && i.unit) {
        return i.unit.trim().toUpperCase() === unit.trim().toUpperCase();
      }
      return true;
    });
    return inv ? (inv.stock ?? inv.availableStock ?? 0) : 0;
  };

  // Register shared F5 Add Item keyboard shortcut on active item-entry pages
  useAddItemShortcut({
    onAddItem: () => {
      if (activeTab === 'branch-requests') {
        const target = branches[0]?.name;
        if (target) handleAddAdditionalItem(target, true);
      } else if (activeTab === 'entry-items') {
        handleOpenAddItemModal();
      } else if (activeTab === 'order' && orderSubTab === 'make-order') {
        handleAddLineItem(true);
      }
    },
    isEnabled: (
      (activeTab === 'branch-requests' && branches.length > 0) ||
      (activeTab === 'entry-items') ||
      (activeTab === 'order' && orderSubTab === 'make-order')
    ),
    isModalOpen: showAddItemModal || Boolean(historyModalItem)
  });

  // Outstanding requirements are calculated by the backend:
  // Outstanding Requirement = Total Branch Requirement - Quantity Already Allocated to Successfully Submitted Purchase Orders
  // Moving to Make a Order draft does NOT mark them as ordered and does NOT remove them from outstanding requirements
  // until the purchase order is successfully submitted to Organisation Admin.
  const displayedConsolidatedItems = consolidatedItems;

  // 1. Consolidated Branch Requirement selection handlers
  const handleToggleReqItem = (itemName) => {
    setSelectedReqItems(prev => {
      const next = new Set(prev);
      if (next.has(itemName)) next.delete(itemName);
      else next.add(itemName);
      return next;
    });
  };

  const handleSelectAllReqItems = () => {
    if (selectedReqItems.size === displayedConsolidatedItems.length && displayedConsolidatedItems.length > 0) {
      setSelectedReqItems(new Set());
    } else {
      setSelectedReqItems(new Set(displayedConsolidatedItems.map(i => i.itemName)));
    }
  };

  // Move selected rows into Make a Order without creating a PO yet (saved in draft)
  const handleMoveToOrder = async () => {
    const selected = displayedConsolidatedItems.filter(i => selectedReqItems.has(i.itemName));
    if (selected.length === 0) {
      return showAlert('error', 'Please select at least one requirement row to move to Make a Order');
    }

    const updated = [...makeOrderLines];
    selected.forEach(item => {
      const existingIdx = updated.findIndex(l => (l.itemName || '').toLowerCase() === item.itemName.toLowerCase() && !l.isCustomItem);
      const currentStock = item.availableStock ?? getCentralStock(item.itemName);
      const reqQty = item.outstandingRequirement ?? item.totalRequiredQuantity ?? 0;
      if (existingIdx >= 0) {
        // Update total requirement and stock, keep existing orderQty if already entered
        updated[existingIdx] = {
          ...updated[existingIdx],
          totalRequiredQuantity: reqQty,
          unit: item.unit,
          availableStock: currentStock,
          orderQuantity: updated[existingIdx].orderQuantity || (reqQty > 0 ? String(reqQty) : '0'),
          requestDate: consolidatedIsAllDates ? null : consolidatedReqDate
        };
      } else {
        updated.push({
          id: 'req_' + item.itemName + '_' + Date.now(),
          itemName: item.itemName,
          unit: item.unit,
          totalRequiredQuantity: reqQty,
          availableStock: currentStock,
          orderQuantity: reqQty > 0 ? String(reqQty) : '0',
          requestDate: consolidatedIsAllDates ? null : consolidatedReqDate,
          isManual: false,
          isCustomItem: false
        });
      }
    });

    setMakeOrderLines(updated);
    setSelectedReqItems(new Set());
    setOrderSubTab('make-order');
    await saveDraft(updated);
    showAlert('success', `✓ Transferred ${selected.length} item(s) to Make a Order draft.`);
  };

  // 2. Make a Order line items handlers
  const handleAddLineItem = (autoFocus = true) => {
    const defaultItem = catalogueItems[0]?.name || '';
    const defaultUnit = catalogueItems[0]?.unit || 'KG';
    const defaultStock = getCentralStock(defaultItem);
    const newId = 'manual_' + Date.now() + Math.random();

    const updated = [
      ...makeOrderLines,
      {
        id: newId,
        itemName: defaultItem,
        unit: defaultUnit,
        totalRequiredQuantity: 0,
        availableStock: defaultStock,
        orderQuantity: '',
        isManual: true,
        isCustomItem: false
      }
    ];
    setMakeOrderLines(updated);
    saveDraft(updated);
    if (autoFocus) {
      setTimeout(() => {
        const rowElem = document.querySelector(`[data-make-order-id="${newId}"]`);
        const inputElem = rowElem?.querySelector('input, select');
        if (inputElem) {
          inputElem.focus();
          inputElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 60);
    }
  };

  const handleUpdateMakeOrderLine = (id, field, value) => {
    setMakeOrderLines(prev => {
      const updated = prev.map(line => {
        if (line.id !== id) return line;

        if (field === 'itemName') {
          if (value === '__NEW_ITEM__') {
            return {
              ...line,
              isCustomItem: true,
              itemName: '',
              unit: 'KG',
              availableStock: 0,
              totalRequiredQuantity: 0
            };
          } else {
            const match = catalogueItems.find(it => it.name === value);
            const stock = getCentralStock(value);
            return {
              ...line,
              isCustomItem: false,
              itemName: value,
              unit: match?.unit || line.unit || 'KG',
              availableStock: stock
            };
          }
        }

        if (field === 'switchToCatalogue') {
          const first = catalogueItems[0]?.name || '';
          const match = catalogueItems[0];
          return {
            ...line,
            isCustomItem: false,
            itemName: first,
            unit: match?.unit || 'KG',
            availableStock: getCentralStock(first)
          };
        }

        return { ...line, [field]: value };
      });
      saveDraft(updated);
      return updated;
    });
  };

  const handleRemoveMakeOrderLine = (id) => {
    setMakeOrderLines(prev => {
      const updated = prev.filter(l => l.id !== id);
      saveDraft(updated);
      return updated;
    });
  };

  // Explicit Save Draft action
  const handleSaveDraft = async () => {
    await saveDraft(makeOrderLines);
    showAlert('success', `✓ Order draft with ${makeOrderLines.length} item(s) saved successfully.`);
  };

  // Explicit Discard/Clear Draft action
  const handleClearDraft = async () => {
    if (!window.confirm('Are you sure you want to discard the current draft? Moved items will return to Consolidated Branch Requirement.')) {
      return;
    }
    setMakeOrderLines([]);
    await clearDraft();
    showAlert('info', 'Order draft discarded. Items returned to Consolidated Branch Requirement.');
  };

  // Send to Organisation: validates lines, generates unique PO, saves header & lines, clears draft
  const handleSendToOrganisation = async () => {
    if (submittingStoreOrder) return;
    if (makeOrderLines.length === 0) {
      return showAlert('error', 'Cannot submit an empty order. Please move items from Consolidated Requirements or click Add Line Item.');
    }

    // 1. Validate every line
    const preparedItems = [];
    for (let i = 0; i < makeOrderLines.length; i++) {
      const line = makeOrderLines[i];
      const name = (line.itemName || '').trim();
      const unit = (line.unit || '').trim().toUpperCase();
      const qty = parseInt(line.orderQuantity, 10);

      if (!name) {
        return showAlert('error', `Line ${i + 1} is missing an Item Name. Please specify an item name.`);
      }
      if (!unit) {
        return showAlert('error', `Line ${i + 1} (${name}) is missing a unit.`);
      }
      if (isNaN(qty) || qty <= 0) {
        return showAlert('error', `Please enter a valid positive Order Quantity (> 0) for "${name}".`);
      }

      preparedItems.push({
        itemName: name,
        unit: unit,
        requiredQuantity: line.totalRequiredQuantity || 0,
        orderQuantity: qty,
        requestDate: line.requestDate || null
      });
    }

    try {
      setSubmittingStoreOrder(true);
      const created = await api.sendStoreOrder(preparedItems);
      const poNum = created && created.length > 0 && created[0].poNumber ? created[0].poNumber : 'ORDER';

      // Clear preparation list and draft only after backend confirms successful creation
      setMakeOrderLines([]);
      await clearDraft();

      showAlert('success', `✓ Purchase order ${poNum} successfully created with ${preparedItems.length} item(s) and sent to Organisation Admin! Draft cleared.`);

      // Refresh previous orders, consolidated requirements, and already ordered today
      await Promise.all([
        loadConsolidated(consolidatedReqDate, consolidatedIsAllDates),
        loadPreviousOrders(previousOrderDate, previousOrderIsAllDates),
        loadAlreadyOrderedToday()
      ]);
    } catch (err) {
      showAlert('error', err.message || 'Failed to submit purchase order to Organisation Admin');
    } finally {
      setSubmittingStoreOrder(false);
    }
  };

  // 3. Previous Orders handlers
  const handleViewOrder = async (orderNumber) => {
    try {
      setLoading(true);
      const data = await api.getOrderByOrderNumber(orderNumber);
      setViewOrderModal(data);
    } catch (err) {
      showAlert('error', err.message || `Failed to load details for ${orderNumber}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = (order) => {
    if (!order) return;
    try {
      downloadOrderPdf(order, { formatType: 'STORE_MANAGER', language });
    } catch (err) {
      showAlert('error', err.message || 'Failed to generate PDF');
    }
  };

  return (
    <div className="page">
      <Alert
        type={alert?.type}
        message={alert?.message}
        onDismiss={() => setAlert(null)}
      />

      {/* 1. CENTRAL INVENTORY TAB */}
      {activeTab === 'central-inventory' && (
        <>
          <section className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">{t('Central Inventory Available Stock', 'Central Inventory Available Stock')}</h3>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {t('Current running stock balances calculated from verified receipts and dispatches in Supabase PostgreSQL.', 'Current running stock balances calculated from verified receipts and dispatches in Supabase PostgreSQL.')}
                </p>
              </div>
              <button type="button" className="secondary small" onClick={loadInventory}>
                ↻ {t('Refresh Stock', 'Refresh Stock')}
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('Item Name', 'Item Name')}</th>
                    <th>{t('Unit', 'Unit')}</th>
                    <th>{t('Available Stock', 'Available Stock')}</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.length > 0 ? (
                    inventory.map(item => (
                      <tr key={item.id}>
                        <td><b>{translateItem(item.name)}</b></td>
                        <td>{translateUnit(item.unit)}</td>
                        <td>
                          <span style={{
                            fontWeight: 700,
                            fontSize: 14,
                            color: item.stock > 10 ? 'var(--green)' : item.stock > 0 ? '#8c671b' : 'var(--danger)'
                          }}>
                            {item.stock} {translateUnit(item.unit)}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="empty">
                        {loading ? t('Loading...', 'Loading inventory...') : t('No records found.', 'No inventory records found in central warehouse')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Date-wise Inventory Activity / History */}
          <section className="card" style={{ marginTop: 22 }}>
            <div className="card-header">
              <div>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{t('Stock Movement History', 'Date-wise Inventory Activity / History')}</span>
                  {invTxDate && (
                    <span style={{ fontSize: 13, color: 'var(--primary-dark-green)', fontWeight: 600 }}>
                      • 📅 {formatDisplayDate(invTxDate)}
                    </span>
                  )}
                </h3>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {t('Inspect physical receipts and branch dispatches recorded by transaction date and time.', 'Inspect physical receipts and branch dispatches recorded by transaction date and time.')}
                </p>
              </div>
              <button
                type="button"
                className="secondary small"
                onClick={() => loadInventoryTransactions(invTxDate, invTxItem)}
                disabled={loadingInvTx}
              >
                {loadingInvTx ? t('Loading...', 'Loading...') : '↻ ' + t('Refresh', 'Refresh Activity')}
              </button>
            </div>

            <DateFilterBar
              label={t('Date', 'Transaction Date')}
              selectedDate={invTxDate}
              onDateChange={(d) => {
                setInvTxDate(d);
                setInvTxIsAllDates(false);
                setInvTxFromDate('');
                setInvTxToDate('');
              }}
              isAllDates={invTxIsAllDates}
              onToggleAllDates={(all) => {
                setInvTxIsAllDates(all);
                if (all) {
                  setInvTxDate('');
                  setInvTxFromDate('');
                  setInvTxToDate('');
                } else {
                  setInvTxDate(getTodayDateString());
                }
              }}
              showRange={true}
              fromDate={invTxFromDate}
              toDate={invTxToDate}
              onFromDateChange={(fd) => {
                setInvTxFromDate(fd);
                setInvTxIsAllDates(false);
              }}
              onToDateChange={(td) => {
                setInvTxToDate(td);
                setInvTxIsAllDates(false);
              }}
              totalCount={invTransactions.length}
              extraControls={
                <input
                  type="text"
                  className="search-input"
                  placeholder={t('Search item...', 'Filter by item...')}
                  value={invTxItem}
                  onChange={e => setInvTxItem(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadInventoryTransactions(invTxDate, invTxItem, invTxFromDate, invTxToDate, invTxIsAllDates)}
                  style={{
                    padding: '6px 10px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    minWidth: '120px',
                    maxWidth: '100%'
                  }}
                />
              }
            />

            {(() => {
              if (invTransactions.length === 0) {
                return (
                  <EmptyDateMessage
                    date={invTxIsAllDates ? null : invTxDate}
                    message={loadingInvTx ? t('Loading...', 'Loading transactions...') : t('No records found.', 'No inventory transactions recorded on this date.')}
                    onResetToday={() => {
                      setInvTxDate(getTodayDateString());
                      setInvTxIsAllDates(false);
                      setInvTxFromDate('');
                      setInvTxToDate('');
                    }}
                    onShowAll={() => setInvTxIsAllDates(true)}
                  />
                );
              }

              const isGrouped = invTxIsAllDates || invTxFromDate || invTxToDate || !invTxDate;

              if (isGrouped) {
                const groups = groupByDate(invTransactions, tx => tx.transactionDate, language);
                return groups.map(grp => (
                  <div key={grp.date} style={{ marginBottom: 24 }}>
                    <DateSectionHeader label={grp.label} count={grp.items.length} date={grp.date} />
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('Order Date & Time', 'Transaction Date & Time')}</th>
                            <th>{t('Item Name', 'Item Name')}</th>
                            <th>{t('Unit', 'Unit')}</th>
                            <th>{t('Category', 'Type')}</th>
                            <th>{t('Quantity', 'Quantity Changed')}</th>
                            <th>{t('Available Stock', 'Balance After')}</th>
                            <th>{t('Role', 'Performed By')}</th>
                            <th>{t('Summary', 'Reference')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grp.items.map(tx => {
                            const isReceipt = tx.type === 'RECEIPT';
                            return (
                              <tr key={tx.id}>
                                <td>{formatDisplayDateTime(tx.transactionDate)}</td>
                                <td><b>{translateItem(tx.itemName)}</b></td>
                                <td>{translateUnit(tx.unit)}</td>
                                <td>
                                  <span className={`badge ${isReceipt ? 'badge-completed' : 'badge-ordered'}`}>
                                    {isReceipt ? '📥 ' + t('Received', 'Receipt') : '📤 ' + t('Dispatched', 'Dispatch')}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 700, color: isReceipt ? 'var(--green)' : 'var(--danger)' }}>
                                    {isReceipt ? `+${tx.quantity}` : `-${tx.quantity}`} {translateUnit(tx.unit)}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 600 }}>
                                    {tx.balanceAfter} {translateUnit(tx.unit)}
                                  </span>
                                </td>
                                <td>{translateRole(tx.performedBy || 'Store Manager')}</td>
                                <td className="muted" style={{ fontSize: 12 }}>
                                  {tx.referenceType ? `${tx.referenceType}${tx.referenceId ? ' #' + tx.referenceId : ''}` : '-'}
                                </td>
                              </tr>
                            );
                          })}
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
                        <th>{t('Order Date & Time', 'Transaction Date & Time')}</th>
                        <th>{t('Item Name', 'Item Name')}</th>
                        <th>{t('Unit', 'Unit')}</th>
                        <th>{t('Category', 'Type')}</th>
                        <th>{t('Quantity', 'Quantity Changed')}</th>
                        <th>{t('Available Stock', 'Balance After')}</th>
                        <th>{t('Role', 'Performed By')}</th>
                        <th>{t('Summary', 'Reference')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invTransactions.map(tx => {
                        const isReceipt = tx.type === 'RECEIPT';
                        return (
                          <tr key={tx.id}>
                            <td>{formatDisplayDateTime(tx.transactionDate)}</td>
                            <td><b>{translateItem(tx.itemName)}</b></td>
                            <td>{translateUnit(tx.unit)}</td>
                            <td>
                              <span className={`badge ${isReceipt ? 'badge-completed' : 'badge-ordered'}`}>
                                {isReceipt ? '📥 ' + t('Received', 'Receipt') : '📤 ' + t('Dispatched', 'Dispatch')}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontWeight: 700, color: isReceipt ? 'var(--green)' : 'var(--danger)' }}>
                                {isReceipt ? `+${tx.quantity}` : `-${tx.quantity}`} {translateUnit(tx.unit)}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>
                                {tx.balanceAfter} {translateUnit(tx.unit)}
                              </span>
                            </td>
                            <td>{translateRole(tx.performedBy || 'Store Manager')}</td>
                            <td className="muted" style={{ fontSize: 12 }}>
                              {tx.referenceType ? `${tx.referenceType}${tx.referenceId ? ' #' + tx.referenceId : ''}` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </section>
        </>
      )}

      {/* 2. ENTRY ITEMS TAB — COMPACT TWO COLUMN LAYOUT */}
      {activeTab === 'entry-items' && (
        <section>
          {/* 1. Compact Header: Title, Subtitle, Refresh Orders Button */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
            padding: '2px 0 4px',
            flexWrap: 'wrap',
            gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 18, color: 'var(--primary-dark-green)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📦</span> {t('Store Manager — Receive Items', 'Store Manager — Receive Items')}
              </h3>
              <span className="muted" style={{ fontSize: 13 }}>
                • {t('Receive Items', 'Order-wise goods receipt & central inventory acknowledgement')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="secondary small"
                onClick={() => loadEntryOrders(entryDate, entryIsAllDates)}
                disabled={loading}
                style={{ padding: '5px 12px', fontSize: 12, height: 32 }}
              >
                {loading ? t('Loading...', 'Refreshing...') : '↻ ' + t('Refresh Orders', 'Refresh Orders')}
              </button>
            </div>
          </div>

          {/* 2. Small Inline Order Date & Add New Item Bar directly above Receive Items section */}
          <div
            className="entry-items-inline-toolbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px 12px',
              marginBottom: 12,
              padding: '2px 0 4px'
            }}
          >
            {/* Inline Date Controls: Order Date: [date] [Today] [All Dates] Today: DD/MM/YYYY */}
            <div style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <label
                htmlFor="entry-order-date-input"
                style={{
                  fontWeight: 600,
                  color: 'var(--primary-dark-green)',
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  margin: 0,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>📅</span> {t('Order Date', 'Order Date')}:
              </label>

              <input
                id="entry-order-date-input"
                type="date"
                value={entryDate || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setEntryDate(val);
                  setEntryIsAllDates(false);
                  loadEntryOrders(val, false);
                }}
                style={{
                  width: 150,
                  height: 36,
                  padding: '4px 8px',
                  fontSize: 13,
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  background: '#fff',
                  color: 'var(--dark-text)'
                }}
              />

              <button
                type="button"
                className={!entryIsAllDates && entryDate === getTodayDateString() ? 'primary small' : 'secondary small'}
                onClick={() => {
                  const today = getTodayDateString();
                  setEntryDate(today);
                  setEntryIsAllDates(false);
                  loadEntryOrders(today, false);
                }}
                style={{
                  height: 34,
                  padding: '0 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
                title="View purchase orders created today"
              >
                {t('Today', 'Today')}
              </button>

              <button
                type="button"
                className={entryIsAllDates ? 'primary small' : 'secondary small'}
                onClick={() => {
                  setEntryIsAllDates(true);
                  loadEntryOrders(entryDate, true);
                }}
                style={{
                  height: 34,
                  padding: '0 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
                title="View all historical purchase orders"
              >
                {t('All Dates', 'All Dates')}
              </button>

              {/* Small text label instead of large filtered message */}
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  fontWeight: 500,
                  marginLeft: 4,
                  whiteSpace: 'nowrap'
                }}
              >
                {entryIsAllDates ? (
                  t('Displaying all historical dates (newest first)', 'Showing All Dates')
                ) : (
                  (() => {
                    const todayStr = getTodayDateString();
                    const formatDDMM = (dStr) => {
                      if (!dStr) return '';
                      const parts = String(dStr).slice(0, 10).split('-');
                      return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dStr;
                    };
                    return entryDate === todayStr
                      ? `${t('Today', 'Today')}: ${formatDDMM(todayStr)}`
                      : `${t('Date', 'Date')}: ${formatDDMM(entryDate)}`;
                  })()
                )}
              </span>
            </div>

            {/* Add New Item Button (same row, aligned to right) */}
            <div style={{ marginLeft: 'auto' }}>
              <button
                type="button"
                className="primary"
                onClick={handleOpenAddItemModal}
                style={{
                  height: 34,
                  padding: '0 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  borderRadius: 6
                }}
                title="Add new item to catalogue (Shortcut: F5)"
                id="btn-add-new-item-top"
              >
                <span>➕</span> {t('Add New Item', 'Add New Item')}
                <kbd
                  style={{
                    fontSize: 10,
                    background: 'rgba(255, 255, 255, 0.25)',
                    padding: '1px 5px',
                    borderRadius: 3,
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    marginLeft: 2
                  }}
                >
                  F5
                </kbd>
              </button>
            </div>
          </div>

          {/* 3. TWO-COLUMN GRID: Left ~46% Receive Items, Right ~54% Orders / Items to Receive */}
          <div className="store-entry-grid">
            {/* LEFT COLUMN: Receive Items (Grouped purchase orders awaiting receipt) */}
            <div className="card store-entry-left-card">

              {/* Receive Items Title Bar */}
              <div className="card-header" style={{ padding: '10px 14px 6px', alignItems: 'center' }}>
                <div>
                  <h4 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, margin: 0 }}>
                    <span>📋</span> {t('Receive Items', 'Receive Items')}
                  </h4>
                </div>
                <span className="badge badge-ordered" style={{ fontSize: 11 }}>
                  {filteredGroupedOrders.length} {t('Order', 'Order')}{filteredGroupedOrders.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Search & Status Filters */}
              <div style={{ padding: '6px 14px 10px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <input
                    type="text"
                    placeholder={t('Search by item or order...', 'Search Order # or item...')}
                    value={entrySearch}
                    onChange={e => setEntrySearch(e.target.value)}
                    style={{ fontSize: 12, padding: '5px 8px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[
                    { id: 'ALL', label: t('Any', 'All') },
                    { id: 'AWAITING', label: t('Pending', 'Awaiting') },
                    { id: 'PARTIAL', label: t('Partially Received', 'Partial') },
                    { id: 'RECEIVED', label: t('Received', 'Received') }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`small ${entryStatusFilter === tab.id ? 'primary' : 'secondary'}`}
                      onClick={() => setEntryStatusFilter(tab.id)}
                      style={{ padding: '3px 8px', fontSize: 11 }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grouped Purchase Orders Table */}
              <div className="table-wrap" style={{ maxHeight: 600, overflowY: 'auto' }}>
                <table className="compact-table">
                  <thead>
                    <tr>
                      <th>{t('Order Number', 'Order Number')}</th>
                      <th>{t('Order Date & Time', 'Order Date & Time')}</th>
                      <th style={{ textAlign: 'center' }}>{t('Total Items', 'Items')}</th>
                      <th style={{ textAlign: 'center' }}>{t('Status', 'Status')}</th>
                      <th style={{ textAlign: 'center' }}>{t('Action', 'Action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGroupedOrders.length > 0 ? (
                      filteredGroupedOrders.map(group => {
                        const isInWorkingArea = workingOrderNumbers.includes(group.poNumber);

                        return (
                          <tr
                            key={group.poNumber}
                            style={{
                              background: isInWorkingArea ? 'rgba(46, 125, 50, 0.04)' : undefined,
                              transition: 'background 0.2s ease'
                            }}
                          >
                            <td>
                              <span style={{ fontWeight: 700, color: 'var(--primary-dark-green)', fontFamily: 'monospace', fontSize: 13 }}>
                                {group.poNumber}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, whiteSpace: 'nowrap' }} className="muted">
                              {group.orderDateTime ? formatDisplayDateTime(group.orderDateTime) : formatDisplayDate(group.orderDate)}
                            </td>
                            <td style={{ textAlign: 'center', fontSize: 12, fontWeight: 600 }}>
                              {group.totalItems} {t('items', 'Items')}
                            </td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {group.remainingItemsCount > 0 ? (
                                <span
                                  className="badge"
                                  style={{
                                    background: '#fee2e2',
                                    color: '#b91c1c',
                                    border: '1px solid #fecaca',
                                    fontWeight: 700,
                                    fontSize: 11
                                  }}
                                >
                                  {group.remainingItemsCount} {t('items', 'Items')} {t('Pending', 'Remaining')}
                                </span>
                              ) : (
                                <span className="badge badge-completed" style={{ fontSize: 11 }}>
                                  ✓ {t('Completed', 'Fully Received')}
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                className={`small ${isInWorkingArea ? 'secondary' : 'primary'}`}
                                onClick={() => handleMoveToReceive(group.poNumber)}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  borderColor: isInWorkingArea ? 'var(--green)' : undefined,
                                  color: isInWorkingArea ? 'var(--green)' : undefined
                                }}
                                title={isInWorkingArea ? 'Already in right-side working area' : `Move ${group.poNumber} to right-side working area`}
                              >
                                {isInWorkingArea ? '✓ ' + t('Active', 'In Working Area') : t('Select Order', 'Move to Receive') + ' →'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" className="empty" style={{ padding: '24px 12px' }}>
                          {loading ? t('Loading...', 'Loading orders...') : t('No records found.', 'No purchase orders found matching filters')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RIGHT COLUMN: Orders / Items to Receive (One Card per Order) */}
            <div className="card store-entry-right-card">
              <div className="card-header" style={{ padding: '10px 14px', alignItems: 'center' }}>
                <div>
                  <h4 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, margin: 0 }}>
                    <span>📥</span> {t('Orders / Items to Receive', 'Orders / Items to Receive')}
                  </h4>
                  <p className="muted" style={{ margin: '2px 0 0', fontSize: 12 }}>
                    {t('Select an order from the left to receive', 'Enter received quantities and click Add to Inventory / Confirm Receipt.')}
                  </p>
                </div>
                {workingOrderNumbers.length > 0 && (
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => {
                      setWorkingOrderNumbers([]);
                      try { localStorage.removeItem('annamithra_working_order_numbers'); } catch {}
                    }}
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    title="Clear all working cards"
                  >
                    {t('Clear All', 'Clear All Cards')}
                  </button>
                )}
              </div>

              {/* List of working order cards */}
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {workingOrdersGrouped.length > 0 ? (
                  workingOrdersGrouped.map(group => {
                    const isAllDone = group.remainingItemsCount === 0;
                    const isConfirming = confirmingOrder === group.orderNumber;

                    return (
                      <div key={group.orderNumber} className="order-receipt-card" id={`receipt-card-${group.orderNumber}`}>
                        {/* Order Card Header: e.g. ORDER01 — 2 Items Remaining */}
                        <div className="order-receipt-card-header">
                          <div className="order-title">
                            <span style={{ fontFamily: 'monospace', fontSize: 15, color: 'var(--primary-dark-green)' }}>
                              🏷️ {group.orderNumber}
                            </span>
                            <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>
                              • {t('Ordered', 'Ordered')}: {group.orderDateTime ? formatDisplayDateTime(group.orderDateTime) : formatDisplayDate(group.orderDate)}
                            </span>
                            {isAllDone ? (
                              <span className="badge badge-completed" style={{ fontSize: 11, marginLeft: 4 }}>
                                ✓ {t('Completed', 'Fully Received')}
                              </span>
                            ) : (
                              <span
                                className="badge"
                                style={{
                                  background: '#fee2e2',
                                  color: '#b91c1c',
                                  border: '1px solid #fecaca',
                                  fontWeight: 700,
                                  fontSize: 11,
                                  marginLeft: 4
                                }}
                              >
                                {group.remainingItemsCount} {t('items', 'Items')} {t('Pending', 'Remaining')}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              className="close-btn"
                              onClick={() => handleRemoveFromWorkingList(group.orderNumber)}
                              title={`Close ${group.orderNumber} from working list`}
                              style={{ width: 24, height: 24, fontSize: 12 }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* Order Items Table */}
                        <div className="table-wrap" style={{ margin: 0 }}>
                          <table className="order-receipt-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th>{t('Item Name', 'Item Name')}</th>
                                <th>{t('Unit', 'Unit')}</th>
                                <th style={{ textAlign: 'right' }}>{t('Ordered Qty', 'Ordered Qty')}</th>
                                <th style={{ textAlign: 'right' }}>{t('Received Qty', 'Received Qty')}</th>
                                <th style={{ textAlign: 'right' }}>{t('Pending', 'Remaining Qty')}</th>
                                <th style={{ textAlign: 'center', width: 140 }}>{t('Receive Items', 'Receive Now')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.lines.map(line => {
                                const remaining = Math.max(0, (line.quantity || 0) - (line.receivedQty || 0));
                                const isLineFullyReceived = remaining === 0;
                                const currentInput = receiveQtys[line.id] !== undefined ? receiveQtys[line.id] : '';

                                return (
                                  <tr key={line.id} style={{ background: isLineFullyReceived ? 'rgba(46, 125, 50, 0.03)' : undefined }}>
                                    <td>
                                      <b>{translateItem(line.item)}</b>
                                    </td>
                                    <td>{translateUnit(line.unit)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                      {line.quantity}
                                    </td>
                                    <td style={{ textAlign: 'right', color: (line.receivedQty || 0) > 0 ? 'var(--green)' : 'inherit', fontWeight: 600 }}>
                                      {line.receivedQty || 0}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <span style={{
                                        fontWeight: 700,
                                        color: remaining > 0 ? '#b91c1c' : 'var(--green)'
                                      }}>
                                        {remaining}
                                      </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                      {isLineFullyReceived ? (
                                        <span className="badge badge-completed" style={{ fontSize: 10 }}>✓ {t('Received', 'Received')}</span>
                                      ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                          <input
                                            type="number"
                                            min="1"
                                            max={remaining}
                                            placeholder={`Max ${remaining}`}
                                            value={currentInput}
                                            onChange={e => {
                                              const v = e.target.value;
                                              setReceiveQtys(prev => ({ ...prev, [line.id]: v }));
                                            }}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleConfirmOrderReceipt(group);
                                              }
                                            }}
                                            disabled={isConfirming}
                                            style={{
                                              width: 75,
                                              padding: '4px 6px',
                                              fontSize: 13,
                                              textAlign: 'right'
                                            }}
                                          />
                                          <button
                                            type="button"
                                            className="secondary small"
                                            onClick={() => setReceiveQtys(prev => ({ ...prev, [line.id]: String(remaining) }))}
                                            disabled={isConfirming}
                                            style={{ padding: '2px 5px', fontSize: 10, lineHeight: 1.2 }}
                                            title="Fill remaining quantity"
                                          >
                                            {t('Any', 'All')}
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Order Card Footer with Add to Inventory / Confirm Receipt button */}
                        <div style={{
                          padding: '10px 14px',
                          background: 'var(--cream-surface)',
                          borderTop: '1px solid var(--border-color)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 10
                        }}>
                          <div style={{ fontSize: 12 }} className="muted">
                            {group.remainingItemsCount > 0 ? (
                              <span>{t('Enter actual physical quantities received above and click confirm.', 'Enter actual physical quantities received above and click confirm.')}</span>
                            ) : (
                              <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓ {t('Completed', 'All items in this order have been fully received into central inventory.')}</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {group.remainingItemsCount > 0 ? (
                              <button
                                type="button"
                                className="primary"
                                onClick={() => handleConfirmOrderReceipt(group)}
                                disabled={isConfirming}
                                style={{
                                  padding: '6px 14px',
                                  fontSize: 13,
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                              >
                                <span>📥</span> {isConfirming ? t('Loading...', 'Updating Inventory...') : t('Confirm Receipt', 'Add to Inventory / Confirm Receipt')}
                              </button>
                            ) : (
                              <span className="badge badge-completed" style={{ fontSize: 12 }}>
                                ✓ {t('Completed', 'Fully Received')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div
                    style={{
                      border: '2px dashed var(--border-color)',
                      borderRadius: 8,
                      padding: '36px 20px',
                      textAlign: 'center',
                      background: 'var(--cream-surface)'
                    }}
                  >
                    <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
                    <h4 style={{ margin: '0 0 6px', color: 'var(--primary-dark-green)' }}>
                      {t('Select an order from the left to receive', 'No Orders in Working Area')}
                    </h4>
                    <p className="muted" style={{ margin: '0 0 16px', fontSize: 13, maxWidth: 360, marginInline: 'auto' }}>
                      {t('Select an order from the left to receive', 'Select an order from the Receive Items list on the left and click Move to Receive to display all its items and confirm stock.')}
                    </p>
                    {filteredGroupedOrders.length > 0 && (
                      <button
                        type="button"
                        className="primary small"
                        onClick={() => {
                          const firstPending = filteredGroupedOrders.find(o => o.remainingItemsCount > 0);
                          if (firstPending) handleMoveToReceive(firstPending.poNumber);
                        }}
                      >
                        {t('Select Order', 'Move Latest Order')} ({filteredGroupedOrders[0]?.poNumber}) →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ADD NEW ITEM & STOCK DIRECTLY MODAL (Available throughout Entry Items page & via F5) */}
          {showAddItemModal && (
            <div className="modal-overlay" onClick={handleCloseAddItemModal}>
              <div
                className="modal-content"
                style={{ maxWidth: 460 }}
                onClick={e => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0, color: 'var(--primary-dark-green)' }}>
                    <span>➕</span> {t('Add New Item and Stock', 'Add New Item & Stock')}
                  </h3>
                  <button
                    type="button"
                    className="close-btn"
                    onClick={handleCloseAddItemModal}
                    disabled={savingNewItem}
                  >
                    ✕
                  </button>
                </div>

                <p className="muted" style={{ margin: '8px 0 16px', fontSize: 13 }}>
                  {t('Add a new or existing item and specify the stock quantity to add directly to Central Inventory.', 'Add a new or existing item and specify the stock quantity to add directly to Central Inventory.')}
                </p>

                {addItemError && (
                  <div className="alert-banner alert-error" style={{ marginBottom: 14 }}>
                    <span>⚠️</span>
                    <div style={{ flex: 1, fontSize: 13 }}>{addItemError}</div>
                  </div>
                )}

                <form onSubmit={handleSaveNewItem}>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>
                      {t('Item Name', 'Item Name')} *
                    </label>
                    <input
                      ref={addItemInputRef}
                      type="text"
                      placeholder={language === 'ta' ? 'எ.கா. புதிய அரிசி, சமையல் எண்ணெய்...' : 'e.g. Basmati Rice, Cooking Oil...'}
                      value={newItemName}
                      onChange={e => {
                        const val = e.target.value;
                        setNewItemName(val);
                        if (addItemError) setAddItemError('');
                        const found = catalogueItems.find(it => it.name && it.name.trim().toLowerCase() === val.trim().toLowerCase());
                        if (found && found.unit) {
                          setNewItemUnit(found.unit);
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const trimmed = (newItemName || '').trim();
                          if (!trimmed) {
                            setAddItemError(t('Item name is required.', 'Item name is required.'));
                            addItemInputRef.current?.focus();
                            return;
                          }
                          setAddItemError('');
                          modalUnitSelectRef.current?.focus();
                        }
                      }}
                      disabled={savingNewItem}
                      autoFocus
                    />
                    {(() => {
                      const existing = catalogueItems.find(it => it.name && it.name.trim().toLowerCase() === (newItemName || '').trim().toLowerCase());
                      if (existing) {
                        const curStock = inventory.find(iv => (iv.name || iv.item || '').trim().toLowerCase() === existing.name.trim().toLowerCase())?.stock ?? existing.stock ?? 0;
                        return (
                          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--primary-dark-green)', fontWeight: 600 }}>
                            ℹ️ {language === 'ta'
                              ? `ஏற்கனவே உள்ள பொருள் (தற்போதைய கையிருப்பு: ${curStock} ${translateUnit(existing.unit)}). உள்ளிட்ட அளவு இதனுடன் சேர்க்கப்படும்.`
                              : `Existing catalogue item (Current Stock: ${curStock} ${existing.unit}). Entered quantity will be added to this stock.`}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>
                      {t('Unit', 'Unit of Measurement')} *
                    </label>
                    <select
                      ref={modalUnitSelectRef}
                      value={newItemUnit}
                      onChange={e => {
                        setNewItemUnit(e.target.value);
                        if (addItemError) setAddItemError('');
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newItemUnit === '__CUSTOM__') {
                            modalCustomUnitRef.current?.focus();
                            return;
                          }
                          modalQtyInputRef.current?.focus();
                        }
                      }}
                      disabled={savingNewItem}
                    >
                      <option value="KG">KG ({translateUnit('kg')})</option>
                      <option value="L">L ({translateUnit('l')})</option>
                      <option value="Pieces">{translateUnit('pieces')}</option>
                      <option value="Packets">{translateUnit('packets')}</option>
                      <option value="Bags">{translateUnit('bags')}</option>
                      <option value="Bundles">{translateUnit('bunch')}</option>
                      <option value="Boxes">{translateUnit('boxes')}</option>
                      <option value="Grams">{translateUnit('grams')}</option>
                      <option value="ML">{translateUnit('ml')}</option>
                      <option value="__CUSTOM__">+ {t('Other / Custom Unit...', 'Other / Custom Unit...')}</option>
                    </select>

                    {newItemUnit === '__CUSTOM__' && (
                      <input
                        ref={modalCustomUnitRef}
                        type="text"
                        placeholder={t('Select Unit', 'Enter custom unit (e.g. Cans, Tins)')}
                        style={{ marginTop: 8 }}
                        value={newItemCustomUnit}
                        onChange={e => {
                          setNewItemCustomUnit(e.target.value);
                          if (addItemError) setAddItemError('');
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            modalQtyInputRef.current?.focus();
                          }
                        }}
                        disabled={savingNewItem}
                      />
                    )}
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>
                      {t('Quantity to Add to Inventory', 'Quantity to Add to Inventory')} *
                    </label>
                    <input
                      ref={modalQtyInputRef}
                      type="number"
                      min="1"
                      step="1"
                      placeholder={language === 'ta' ? 'அளவை உள்ளிடவும் (எ.கா. 25)' : 'Enter quantity (e.g. 25)'}
                      value={newItemQuantity}
                      onChange={e => {
                        setNewItemQuantity(e.target.value);
                        if (addItemError) setAddItemError('');
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveNewItem(e);
                        }
                      }}
                      disabled={savingNewItem}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={handleCloseAddItemModal}
                      disabled={savingNewItem}
                    >
                      {t('Cancel', 'Cancel')}
                    </button>
                    <button
                      type="submit"
                      className="primary"
                      disabled={savingNewItem}
                      id="btn-save-new-item"
                    >
                      {savingNewItem
                        ? t('Saving and Adding Stock...', 'Saving and Adding Stock...')
                        : t('Save and Add to Inventory', 'Save and Add to Inventory')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 3. BRANCH REQUESTS / DISPATCH TAB */}
      {activeTab === 'branch-requests' && (
        <section>
          {/* Subnav: Only Dispatch tab kept; Branches tab removed */}
          <div className="subnav">
            <button
              type="button"
              className="subnav-btn active"
            >
              {t('dispatch', 'Dispatch')}
            </button>
          </div>

          {/* GLOBAL REQUEST DATE FILTER BAR & REFRESH */}
          <div className="card" style={{ marginBottom: 16, padding: '10px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 10px' }}>
                <label
                  htmlFor="dispatch-req-date-input"
                  style={{
                    fontWeight: 600,
                    color: 'var(--primary-dark-green)',
                    fontSize: 13,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    margin: 0,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>📅</span> {t('requestDate:', 'Request Date:')}
                </label>

                <input
                  id="dispatch-req-date-input"
                  type="date"
                  value={dispatchReqDate || ''}
                  onChange={e => {
                    const val = e.target.value;
                    setDispatchReqDate(val);
                    loadOutstandingForDispatch(null, val);
                  }}
                  style={{
                    width: 150,
                    height: 34,
                    padding: '4px 8px',
                    fontSize: 13,
                    border: '1px solid var(--border-color)',
                    borderRadius: 6,
                    background: '#fff',
                    color: 'var(--dark-text)'
                  }}
                />

                <button
                  type="button"
                  className={dispatchReqDate === getTodayDateString() ? 'primary small' : 'secondary small'}
                  onClick={() => {
                    const today = getTodayDateString();
                    setDispatchReqDate(today);
                    loadOutstandingForDispatch(null, today);
                  }}
                  style={{
                    height: 32,
                    padding: '0 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                  title={language === 'ta' ? 'இன்று சமர்ப்பிக்கப்பட்ட கோரிக்கைகள்' : 'View requests submitted today'}
                >
                  {t('today', 'Today')}
                </button>

                <button
                  type="button"
                  className={!dispatchReqDate ? 'primary small' : 'secondary small'}
                  onClick={() => {
                    setDispatchReqDate('');
                    loadOutstandingForDispatch(null, '');
                  }}
                  style={{
                    height: 32,
                    padding: '0 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                  title={language === 'ta' ? 'அனைத்து தேதிகளின் நிலுவை கோரிக்கைகள்' : 'View outstanding requests across all dates'}
                >
                  {t('allDates', 'All Dates')}
                </button>

                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                    marginLeft: 4,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {!dispatchReqDate ? (
                    t('allDates', 'Showing All Dates')
                  ) : (
                    dispatchReqDate === getTodayDateString()
                      ? `${t('today', 'Today')}: ${formatDDMMYYYY(getTodayDateString())}`
                      : `${t('date', 'Date')}: ${formatDDMMYYYY(dispatchReqDate)}`
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  className="badge"
                  style={{
                    fontSize: 12,
                    background: 'var(--cream-surface)',
                    color: 'var(--primary-dark-green)',
                    borderColor: 'var(--gold)',
                    fontWeight: 600
                  }}
                >
                  🏢 {branches.length} {language === 'ta' ? 'அங்கீகரிக்கப்பட்ட கிளைகள்' : 'Authorized Branches'}
                </span>

                <button
                  type="button"
                  className="secondary small"
                  onClick={() => {
                    loadOutstandingForDispatch(null, dispatchReqDate);
                    loadStoreDispatchHistory(null, dispatchHistoryDate, dispatchHistoryIsAllDates);
                  }}
                  style={{ height: 32, padding: '0 10px', fontSize: 12 }}
                  title={language === 'ta' ? 'புதுப்பிக்கவும்' : 'Refresh All Branches'}
                >
                  ↻ {t('refresh', 'Refresh')}
                </button>

                <button
                  type="button"
                  className="primary small btn-download-branch-requests-pdf btn-download-all-branches-pdf"
                  id="btn-download-all-branches-pdf"
                  disabled={downloadingBranchRequestsPdf}
                  onClick={handleDownloadBranchRequestsPdf}
                  style={{
                    height: 32,
                    padding: '0 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    borderRadius: 6,
                    background: 'var(--primary-dark-green)',
                    color: '#ffffff',
                    border: '1px solid var(--primary-dark-green)',
                    cursor: downloadingBranchRequestsPdf ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(0, 59, 43, 0.15)'
                  }}
                  title={language === 'ta' ? 'அனைத்து கிளைகளின் கோரிக்கைகள் அறிக்கையை PDF ஆக பதிவிறக்கவும்' : 'Download All Branches Requests Report as PDF'}
                >
                  <span>📄</span>
                  {downloadingBranchRequestsPdf
                    ? (language === 'ta' ? 'தயாராகிறது...' : 'Generating PDF...')
                    : (language === 'ta' ? 'அனைத்து கிளைகளின் PDF பதிவிறக்கு' : 'Download All Branches PDF')}
                </button>
              </div>
            </div>
          </div>

          {/* ALL AUTHORIZED BRANCHES DISPLAYED VERTICALLY */}
          {branches.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: 'center' }}>
              <p className="muted">
                {language === 'ta'
                  ? 'அங்கீகரிக்கப்பட்ட கிளைகள் எதுவும் கிடைக்கவில்லை.'
                  : 'No authorized branches found.'}
              </p>
            </div>
          ) : (
            <div className="vertical-branches-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {sortedBranches.map(branch => {
                const bName = branch.name || '';
                const branchAllReqs = (allBranchRequests || []).filter(r =>
                  ((r.branch || '').trim().toLowerCase() === bName.trim().toLowerCase()) ||
                  (branch.id && r.branchId === branch.id)
                );
                // Sort branch all requests by createdAt ascending
                branchAllReqs.sort((a, b) => {
                  const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                  const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                  return tA - tB;
                });
                const branchEarliestTime = branchAllReqs.length > 0 && branchAllReqs[0].createdAt
                  ? parseOrderDateTime(branchAllReqs[0].createdAt, branchAllReqs[0].requestDate, language).timeStr
                  : null;
                const branchConsolidated = consolidatedDispatchItems.filter(item =>
                  (item.branchName || '').trim().toLowerCase() === bName.trim().toLowerCase() ||
                  (branch.id && item.branchId === branch.id)
                );
                const branchAdditional = additionalItemsByBranch[bName] || [];
                const branchHistory = storeDispatchHistory.filter(d =>
                  ((d.branchName || d.branch || '')).trim().toLowerCase() === bName.trim().toLowerCase() ||
                  (branch.id && d.branchId === branch.id)
                );
                const isDispatchingThisBranch = dispatchingBranch === bName;

                return (
                  <div
                    key={branch.id || bName}
                    className="card branch-dispatch-card"
                    id={`branch-dispatch-section-${(bName || '').toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                    style={{ margin: 0 }}
                  >
                    {/* BRANCH HEADER */}
                    <div className="card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <h3 className="card-title" style={{ margin: 0, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>🏪</span> {bName}
                        </h3>
                        {branch.location && (
                          <span className="muted" style={{ fontSize: 12 }}>
                            📍 {branch.location}
                          </span>
                        )}
                        <span
                          className={`badge ${branchConsolidated.length > 0 ? 'badge-ordered' : 'badge-completed'}`}
                          style={{ fontSize: 11 }}
                        >
                          {branchConsolidated.length > 0
                            ? `${branchConsolidated.length} ${language === 'ta' ? 'நிலுவை பொருட்கள்' : 'Pending Items'}`
                            : (language === 'ta' ? 'நிலுவை கோரிக்கைகள் இல்லை' : 'No Pending Requests')}
                        </span>
                        {branchEarliestTime && (
                          <span
                            className="badge"
                            style={{
                              fontSize: 11,
                              background: 'var(--cream-surface)',
                              color: 'var(--primary-dark-green)',
                              borderColor: 'var(--gold)',
                              fontWeight: 600
                            }}
                            title={language === 'ta' ? 'முதல் கோரிக்கை நேரம்' : 'Earliest request submission time'}
                          >
                            🕒 {language === 'ta' ? 'முதல் கோரிக்கை:' : 'First Request:'} {branchEarliestTime}
                          </span>
                        )}
                      </div>

                      {/* ACTIONS: DOWNLOAD INDIVIDUAL BRANCH PDF & ADD ADDITIONAL ITEM */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {/* DOWNLOAD INDIVIDUAL BRANCH PDF BUTTON */}
                        <button
                          type="button"
                          className="secondary small btn-download-branch-pdf"
                          id={`btn-download-pdf-${(bName || '').toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                          disabled={downloadingBranchPdf === bName}
                          onClick={() => handleDownloadSingleBranchPdf(branch)}
                          style={{
                            height: 32,
                            padding: '0 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: 6,
                            whiteSpace: 'nowrap',
                            background: 'var(--cream-surface)',
                            color: 'var(--primary-dark-green)',
                            border: '1px solid var(--gold)',
                            cursor: downloadingBranchPdf === bName ? 'not-allowed' : 'pointer',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
                          }}
                          title={language === 'ta' ? `${bName} கிளையின் கோரிக்கைகளை PDF ஆக பதிவிறக்கவும்` : `Download PDF for ${bName}`}
                        >
                          <span>📄</span>
                          {downloadingBranchPdf === bName
                            ? (language === 'ta' ? 'தயாராகிறது...' : 'Generating...')
                            : (language === 'ta' ? 'PDF பதிவிறக்கு' : 'Download PDF')}
                        </button>

                        {/* ADD ADDITIONAL NON-REQUESTED ITEM BUTTON */}
                        <button
                          type="button"
                          className="primary small"
                          id={`btn-add-item-${(bName || '').toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                          onClick={() => handleAddAdditionalItem(bName, true)}
                          style={{
                            height: 32,
                            padding: '0 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: 6,
                            whiteSpace: 'nowrap'
                          }}
                          title={language === 'ta' ? `${bName} கிளைக்கு கூடுதல் உருப்படியைச் சேர்` : `Add Additional Non-Requested Item to ${bName}`}
                        >
                          <span>➕</span> {t('addItem', 'Add Item')}
                        </button>
                      </div>
                    </div>

                    {/* BRANCH CARD BODY */}
                    <div className="card-body" style={{ padding: '14px 16px' }}>
                      {/* PENDING REQUESTS ITEMS (MAX 4 ROWS VISIBLE, VERTICAL SCROLL) */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <h4 style={{ margin: 0, fontSize: 13, color: 'var(--primary-dark-green)', fontWeight: 600 }}>
                            📦 {language === 'ta' ? `${bName} கிளை கோரிய பொருட்கள்` : `Requested Items for ${bName}`}
                          </h4>
                          <span className="muted" style={{ fontSize: 11 }}>
                            {branchConsolidated.length > 4
                              ? (language === 'ta' ? 'அனைத்து பொருட்களையும் காண உருட்டவும் (4 வரிசைகள் காட்டப்படுகின்றன)' : 'Scroll table to view all items (4 rows visible)')
                              : `${branchConsolidated.length} ${language === 'ta' ? 'பொருட்கள்' : 'items'}`}
                          </span>
                        </div>

                        {/* Vertically scrollable container for maximum 4 rows at a time */}
                        <div className="branch-items-scroll-wrap">
                          <table className="compact-table" style={{ margin: 0, width: '100%', minWidth: 680 }}>
                            <thead>
                              <tr>
                                <th>{t('itemName', 'Item Name')}</th>
                                <th>{t('unit', 'Unit')}</th>
                                <th style={{ textAlign: 'right' }}>{t('totalRequested', 'Total Requested')}</th>
                                <th style={{ textAlign: 'right' }}>{t('alreadyDispatched', 'Already Dispatched')}</th>
                                <th style={{ textAlign: 'right' }}>{t('centralStockAvailable', 'Central Stock Available')}</th>
                                <th style={{ textAlign: 'center', width: 140 }}>{t('dispatchQty', 'Dispatch Qty')}</th>
                                <th style={{ textAlign: 'right' }}>{t('remainingToDispatch', 'Remaining to Dispatch')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {branchConsolidated.length > 0 ? (
                                branchConsolidated.map(item => {
                                  const centralStock = getCentralStock(item.itemName, item.unit);
                                  const unfulfilled = Math.max(0, item.totalRequested - item.alreadyDispatched);
                                  const curDispatchStr = dispatchQtys[item.key] !== undefined
                                    ? dispatchQtys[item.key]
                                    : String(unfulfilled);
                                  const curDispatch = curDispatchStr === '' ? 0 : parseInt(curDispatchStr, 10);
                                  const remainingToDispatch = Math.max(0, item.totalRequested - item.alreadyDispatched - (isNaN(curDispatch) ? 0 : curDispatch));
                                  const exceedsStock = !isNaN(curDispatch) && curDispatch > centralStock;

                                  return (
                                    <tr key={item.key} style={{ background: exceedsStock ? 'rgba(245, 158, 11, 0.05)' : undefined }}>
                                      <td>
                                        <b>{translateItem(item.itemName)}</b>
                                        {item.requests.length > 1 && (
                                          <span
                                            className="badge"
                                            style={{
                                              marginLeft: 8,
                                              fontSize: 10,
                                              background: 'var(--cream-surface)',
                                              color: 'var(--primary-dark-green)',
                                              borderColor: 'var(--gold)'
                                            }}
                                          >
                                            {item.requests.length} {language === 'ta' ? 'கோரிக்கைகள்' : 'reqs'}
                                          </span>
                                        )}
                                      </td>
                                      <td>{translateUnit(item.unit)}</td>
                                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.totalRequested}</td>
                                      <td style={{ textAlign: 'right', color: item.alreadyDispatched > 0 ? '#8c671b' : 'inherit' }}>
                                        {item.alreadyDispatched}
                                      </td>
                                      <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                          <span
                                            style={{
                                              fontWeight: 700,
                                              fontSize: 13,
                                              color: centralStock <= 0 ? '#b91c1c' : (centralStock <= 5 ? '#b45309' : 'var(--primary-dark-green)')
                                            }}
                                          >
                                            {centralStock} {translateUnit(item.unit)}
                                          </span>
                                          {centralStock <= 0 ? (
                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '1px 6px', borderRadius: 4, border: '1px solid #fca5a5' }}>
                                              ⚠️ {t('Zero Stock', 'Zero Stock')}
                                            </span>
                                          ) : centralStock <= 5 ? (
                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: 4, border: '1px solid #fcd34d' }}>
                                              ⚠️ {t('Low Stock', 'Low Stock')}
                                            </span>
                                          ) : null}
                                        </div>
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                          <input
                                            type="number"
                                            min="0"
                                            style={{
                                              width: 80,
                                              height: 32,
                                              textAlign: 'right',
                                              padding: '4px 6px',
                                              fontSize: 13,
                                              border: exceedsStock ? '1.5px solid #d97706' : '1px solid var(--border-color)',
                                              borderRadius: 6
                                            }}
                                            value={curDispatchStr}
                                            onChange={e => setDispatchQtys(prev => ({ ...prev, [item.key]: e.target.value }))}
                                            placeholder="0"
                                          />
                                          <button
                                            type="button"
                                            className="secondary small"
                                            onClick={() => setDispatchQtys(prev => ({ ...prev, [item.key]: String(unfulfilled) }))}
                                            style={{ height: 32, padding: '0 6px', fontSize: 11 }}
                                            title={`Fill requested amount (${unfulfilled})`}
                                          >
                                            {t('max', 'Max')}
                                          </button>
                                        </div>
                                        {exceedsStock && (
                                          <div style={{ color: '#b45309', fontSize: 10, marginTop: 2, fontWeight: 600 }}>
                                            ⚠️ {t('exceedsStock', 'Exceeds stock')} ({centralStock})
                                          </div>
                                        )}
                                      </td>
                                      <td style={{ textAlign: 'right' }}>
                                        <span
                                          style={{
                                            fontWeight: 700,
                                            fontSize: 13,
                                            color: remainingToDispatch > 0 ? '#b78103' : 'var(--green)'
                                          }}
                                        >
                                          {remainingToDispatch} {translateUnit(item.unit)}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td colSpan="7" className="empty" style={{ padding: '24px 12px' }}>
                                    {language === 'ta'
                                      ? `${bName} கிளைக்கு நிலுவையில் உள்ள கோரிக்கைகள் இல்லை. கீழே கூடுதல் பொருட்களை அனுப்பலாம்.`
                                      : `No unfulfilled requests for ${bName}${dispatchReqDate ? ` on ${formatDisplayDate(dispatchReqDate)}` : ''}. You can dispatch additional items below.`}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* ADDITIONAL NON-REQUESTED ITEMS SECTION FOR THIS BRANCH */}
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <h4 style={{ margin: 0, color: 'var(--primary-dark-green)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>➕</span> {t('additionalNonRequestedItems', 'Additional Non-Requested Items')}
                            {branchAdditional.length > 0 && (
                              <span className="badge badge-ordered" style={{ fontSize: 10 }}>
                                {branchAdditional.length} {t('added', 'Added')}
                              </span>
                            )}
                          </h4>
                        </div>

                        {branchAdditional.length === 0 ? (
                          <p className="muted" style={{ margin: '4px 0 10px', fontSize: 12 }}>
                            {language === 'ta'
                              ? `${bName} கிளைக்கு கூடுதல் பொருட்கள் எதுவும் சேர்க்கப்படவில்லை. சேர்க்க மேலே உள்ள "+ பொருள் சேர்" ஐ கிளிக் செய்யவும்.`
                              : `No additional non-requested items added for ${bName}. Click "+ Add Item" above to add items.`}
                          </p>
                        ) : (
                          <div className="table-wrap" style={{ margin: '6px 0 12px', overflowX: 'auto' }}>
                            <table className="compact-table" style={{ margin: 0, minWidth: 680 }}>
                              <thead>
                                <tr>
                                  <th>{t('itemName', 'Item Name')}</th>
                                  <th>{t('unit', 'Unit')}</th>
                                  <th>{t('itemType', 'Item Type')}</th>
                                  <th style={{ textAlign: 'right' }}>{t('centralStockAvailable', 'Central Stock Available')}</th>
                                  <th style={{ textAlign: 'center', width: 140 }}>{t('dispatchQty', 'Dispatch Qty')}</th>
                                  <th style={{ textAlign: 'center' }}>{t('action', 'Action')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {branchAdditional.map(item => {
                                  const addStock = getCentralStock(item.itemName, item.unit);
                                  const addQty = parseInt(item.dispatchQty, 10);
                                  const exceedsAddStock = !isNaN(addQty) && addQty > addStock;

                                  return (
                                    <tr key={item.id} style={{ background: exceedsAddStock ? 'rgba(220, 38, 38, 0.04)' : undefined }}>
                                      <td>
                                        <select
                                          data-additional-id={item.id}
                                          value={item.itemName || ''}
                                          onChange={e => {
                                            const val = e.target.value;
                                            if (val === '__NEW_ITEM__') {
                                              handleOpenDispatchNewItemModal(bName, item.id);
                                            } else {
                                              handleUpdateAdditionalItem(bName, item.id, 'itemName', val);
                                            }
                                          }}
                                          style={{ height: 32, padding: '4px 8px', fontSize: 13 }}
                                          id={`select-item-${(bName || '').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${item.id}`}
                                        >
                                          <option value="__NEW_ITEM__" style={{ fontWeight: 700, color: 'var(--primary-dark-green)' }}>
                                            {language === 'ta' ? '➕ + புதிய பொருள் (+ New Item)' : '➕ + New Item'}
                                          </option>
                                          <option disabled style={{ fontSize: 4 }}>──────────</option>
                                          {catalogueItems.map(it => (
                                            <option key={it.id || it.name} value={it.name}>
                                              {translateItem(it.name)} ({translateUnit(it.unit)})
                                            </option>
                                          ))}
                                        </select>
                                      </td>
                                      <td>{translateUnit(item.unit)}</td>
                                      <td>
                                        <span
                                          className="badge"
                                          style={{
                                            fontSize: 10,
                                            background: 'rgba(217, 119, 6, 0.1)',
                                            color: '#b45309',
                                            border: '1px solid rgba(217, 119, 6, 0.3)',
                                            fontWeight: 600
                                          }}
                                        >
                                          {t('additionalItem', 'Additional Item')}
                                        </span>
                                      </td>
                                      <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                          <span
                                            style={{
                                              fontWeight: 700,
                                              fontSize: 13,
                                              color: addStock <= 0 ? '#b91c1c' : (addStock <= 5 ? '#b45309' : 'var(--primary-dark-green)')
                                            }}
                                          >
                                            {addStock} {translateUnit(item.unit)}
                                          </span>
                                          {addStock <= 0 ? (
                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '1px 6px', borderRadius: 4, border: '1px solid #fca5a5' }}>
                                              ⚠️ {t('Zero Stock', 'Zero Stock')}
                                            </span>
                                          ) : addStock <= 5 ? (
                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: 4, border: '1px solid #fcd34d' }}>
                                              ⚠️ {t('Low Stock', 'Low Stock')}
                                            </span>
                                          ) : null}
                                        </div>
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        <input
                                          type="number"
                                          min="1"
                                          placeholder="Qty"
                                          style={{
                                            width: 80,
                                            height: 32,
                                            textAlign: 'right',
                                            padding: '4px 6px',
                                            fontSize: 13,
                                            border: exceedsAddStock ? '1.5px solid #d97706' : '1px solid var(--border-color)',
                                            borderRadius: 6
                                          }}
                                          value={item.dispatchQty}
                                          onChange={e => handleUpdateAdditionalItem(bName, item.id, 'dispatchQty', e.target.value)}
                                        />
                                        {exceedsAddStock && (
                                          <div style={{ color: '#b45309', fontSize: 10, marginTop: 2, fontWeight: 600 }}>
                                            ⚠️ {t('exceedsStock', 'Exceeds stock')} ({addStock})
                                          </div>
                                        )}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        <button
                                          type="button"
                                          className="danger small"
                                          onClick={() => handleRemoveAdditionalItem(bName, item.id)}
                                          style={{ height: 28, padding: '0 8px', fontSize: 11 }}
                                        >
                                          ✕ {t('remove', 'Remove')}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* DISPATCH ACTION BUTTON SPECIFIC TO THIS BRANCH */}
                      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                        <button
                          type="button"
                          className="primary"
                          disabled={isDispatchingThisBranch}
                          onClick={() => handleDispatchItems(bName)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '9px 20px',
                            fontWeight: 600,
                            fontSize: 13,
                            borderRadius: 6
                          }}
                        >
                          <span>🚚</span>
                          {isDispatchingThisBranch
                            ? (language === 'ta' ? `${bName} கிளைக்கு விநியோகிக்கிறது...` : `Dispatching to ${bName}...`)
                            : (language === 'ta' ? `${bName} கிளைக்கு விநியோகி` : `Dispatch Items → ${bName}`)}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* NEW ITEM MODAL FOR DISPATCH ADDITIONAL ITEMS */}
          {showDispatchNewItemModal && (
            <div
              className="modal-overlay"
              onClick={handleCloseDispatchNewItemModal}
              style={{ zIndex: 1200 }}
              id="modal-dispatch-new-item"
            >
              <div
                className="modal-content"
                style={{ maxWidth: 440, padding: '24px 28px', borderRadius: 8, boxShadow: '0 8px 30px rgba(0, 0, 0, 0.25)' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="modal-header" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, color: 'var(--primary-dark-green)', fontSize: 18, fontWeight: 700 }}>
                    <span>➕</span> {language === 'ta' ? 'புதிய பொருள் சேர்க்க' : 'Add New Item'}
                  </h3>
                  <button
                    type="button"
                    className="close-btn"
                    onClick={handleCloseDispatchNewItemModal}
                    disabled={savingDispatchNewItem}
                    id="btn-close-new-item-modal"
                    style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: '#5A6962' }}
                  >
                    ✕
                  </button>
                </div>

                <p className="muted" style={{ margin: '0 0 18px', fontSize: 13, lineHeight: 1.5, color: '#5A6962' }}>
                  {language === 'ta'
                    ? 'விநியோகத்திற்காக ஒரு புதிய பொருளை பட்டியலில் சேர்க்கவும். இது தரவுத்தளத்தில் நிரந்தரமாக சேமிக்கப்படும்.'
                    : 'Create a new catalogue item for dispatch. It will be persistently saved to the database.'}
                </p>

                <form onSubmit={handleSaveDispatchNewItem}>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label
                      htmlFor="input-new-item-name"
                      style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--primary-dark-green)', marginBottom: 6 }}
                    >
                      {language === 'ta' ? 'பொருளின் பெயர் *' : 'Item Name *'}
                    </label>
                    <input
                      id="input-new-item-name"
                      type="text"
                      required
                      autoFocus
                      placeholder={language === 'ta' ? 'எ.கா: பன்னீர் / Fresh Paneer' : 'e.g. Fresh Paneer, Mushroom'}
                      value={newItemFormName}
                      onChange={e => setNewItemFormName(e.target.value)}
                      disabled={savingDispatchNewItem}
                      style={{ width: '100%', height: 38, padding: '6px 12px', fontSize: 14, borderRadius: 6, border: '1px solid var(--border-color)' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 22 }}>
                    <label
                      htmlFor="select-new-item-unit"
                      style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--primary-dark-green)', marginBottom: 6 }}
                    >
                      {language === 'ta' ? 'அளவீட்டு அலகு (Unit) *' : 'Unit *'}
                    </label>
                    <select
                      id="select-new-item-unit"
                      required
                      value={newItemFormUnit}
                      onChange={e => setNewItemFormUnit(e.target.value)}
                      disabled={savingDispatchNewItem}
                      style={{ width: '100%', height: 38, padding: '6px 12px', fontSize: 14, borderRadius: 6, border: '1px solid var(--border-color)' }}
                    >
                      {DISPATCH_SUPPORTED_UNITS.map(u => (
                        <option key={u} value={u}>
                          {u} {translateUnit(u) !== u ? `— ${translateUnit(u)}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={handleCloseDispatchNewItemModal}
                      disabled={savingDispatchNewItem}
                      id="btn-cancel-new-item"
                      style={{ height: 36, padding: '0 16px', borderRadius: 6, fontSize: 13 }}
                    >
                      {language === 'ta' ? 'ரத்துசெய்' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      className="primary"
                      disabled={savingDispatchNewItem}
                      id="btn-save-new-item"
                      style={{ height: 36, padding: '0 18px', fontWeight: 700, borderRadius: 6, fontSize: 13, background: 'var(--primary-dark-green)', color: '#ffffff' }}
                    >
                      {savingDispatchNewItem
                        ? (language === 'ta' ? 'சேமிக்கிறது...' : 'Saving...')
                        : (language === 'ta' ? 'பொருளை சேமிக்கவும்' : 'Save Item')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 4. ORDER TAB */}
      {activeTab === 'order' && (
        <section>
          {/* Exactly Three Options Subnav */}
          <div className="subnav">
            <button
              type="button"
              className={`subnav-btn ${orderSubTab === 'consolidated' ? 'active' : ''}`}
              onClick={() => {
                setOrderSubTab('consolidated');
                loadConsolidated(consolidatedReqDate, consolidatedIsAllDates);
                loadAlreadyOrderedToday();
              }}
            >
              {t('Consolidated Branch Requirement', 'Consolidated Branch Requirement')}
            </button>
            <button
              type="button"
              className={`subnav-btn ${orderSubTab === 'make-order' ? 'active' : ''}`}
              onClick={() => setOrderSubTab('make-order')}
            >
              {t('Make a Order', 'Make a Order')} {makeOrderLines.length > 0 ? `(${makeOrderLines.length})` : ''}
            </button>
            <button
              type="button"
              className={`subnav-btn ${orderSubTab === 'previous-orders' ? 'active' : ''}`}
              onClick={() => {
                setOrderSubTab('previous-orders');
                loadPreviousOrders();
              }}
            >
              {t('Previous Orders', 'Previous Orders')}
            </button>
          </div>

          {/* OPTION 1: Consolidated Branch Requirement */}
          {orderSubTab === 'consolidated' && (
            <>
              <div className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">{t('Consolidated Branch Requirement', 'Consolidated Branch Requirement')}</h3>
                    <p className="muted" style={{ margin: '4px 0 0' }}>
                      {language === 'ta'
                        ? 'கோரிக்கை தேதி வாரியாக வடிகட்டப்பட்டு, இரட்டிப்பாகாமல் திரட்டப்பட்ட நிலுவையிலுள்ள கிளைத் தேவைகள்.'
                        : 'Outstanding branch requirements filtered by request date and aggregated by item without double-counting.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => {
                      loadConsolidated(consolidatedReqDate, consolidatedIsAllDates);
                      loadAlreadyOrderedToday();
                    }}
                  >
                    ↻ {t('refresh', 'Refresh')}
                  </button>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <DateFilterBar
                    label={t('filterByRequestDate:', 'Filter by Request Date:')}
                    selectedDate={consolidatedReqDate}
                    isAllDates={consolidatedIsAllDates}
                    onDateChange={d => {
                      setConsolidatedReqDate(d);
                      setConsolidatedIsAllDates(false);
                      loadConsolidated(d, false);
                    }}
                    onToggleAllDates={all => {
                      setConsolidatedIsAllDates(all);
                      loadConsolidated(consolidatedReqDate, all);
                    }}
                  />
                </div>

                <DateSectionHeader
                  date={consolidatedIsAllDates ? t('allDates', 'All Dates') : consolidatedReqDate}
                  count={displayedConsolidatedItems.length}
                  unit={t('consolidated requirements', 'consolidated requirements')}
                />

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 44, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={displayedConsolidatedItems.length > 0 && selectedReqItems.size === displayedConsolidatedItems.length}
                            onChange={handleSelectAllReqItems}
                            aria-label="Select all requirement rows"
                          />
                        </th>
                        <th>{t('itemName', 'Item Name')}</th>
                        <th>{t('unit', 'Unit')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Total Requirement Quantity', 'Total Requirement Quantity')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedConsolidatedItems.length > 0 ? (
                        displayedConsolidatedItems.map(item => {
                          const isSelected = selectedReqItems.has(item.itemName);
                          const reqQty = item.outstandingRequirement ?? item.totalRequiredQuantity;
                          return (
                            <tr
                              key={item.itemName}
                              style={{ background: isSelected ? 'var(--pale-green)' : 'transparent', cursor: 'pointer' }}
                              onClick={() => handleToggleReqItem(item.itemName)}
                            >
                              <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleReqItem(item.itemName)}
                                  aria-label={`Select ${item.itemName}`}
                                />
                              </td>
                              <td><b>{translateItem(item.itemName)}</b></td>
                              <td>{translateUnit(item.unit)}</td>
                              <td style={{ textAlign: 'right' }}>
                                <span style={{ fontWeight: 700, color: 'var(--primary-dark-green)' }}>
                                  {reqQty}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="4" className="empty">
                            {loading
                              ? t('loading', 'Calculating requirements...')
                              : (consolidatedReqDate && !consolidatedIsAllDates
                                  ? (language === 'ta' ? 'இந்த தேதிக்கான நிலுவை கிளை தேவைகள் எதுவும் கிடைக்கவில்லை.' : 'No outstanding branch requirements found for this date.')
                                  : (language === 'ta' ? 'நிலுவை கிளை தேவைகள் எதுவும் கிடைக்கவில்லை.' : 'No outstanding branch requirements found.'))}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="form-actions" style={{ marginTop: 20 }}>
                  <button
                    type="button"
                    className="primary"
                    disabled={selectedReqItems.size === 0}
                    onClick={handleMoveToOrder}
                  >
                    {t('Move to Order', 'Move to Order')} {selectedReqItems.size > 0 ? `(${selectedReqItems.size} ${language === 'ta' ? 'தேர்ந்தெடுக்கப்பட்டது' : 'Selected'})` : ''}
                  </button>
                </div>
              </div>

              {/* Already Ordered Today Section */}
              <div className="card" style={{ marginTop: 24 }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 className="card-title">{t('Already Ordered Today', 'Already Ordered Today')}</h3>
                    <p className="muted" style={{ margin: '4px 0 0' }}>
                      {language === 'ta'
                        ? `${formatDisplayDate(getTodayDateString())} அன்று நிறுவன நிர்வாகிக்கு சமர்ப்பிக்கப்பட்ட கொள்முதல் ஆர்டர்கள்.`
                        : `Purchase orders successfully submitted to Organisation Admin on ${formatDisplayDate(getTodayDateString())}.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={loadAlreadyOrderedToday}
                    disabled={loadingAlreadyOrdered}
                  >
                    {loadingAlreadyOrdered ? t('loading', 'Refreshing...') : `↻ ${language === 'ta' ? 'இன்றைய ஆர்டர்களைப் புதுப்பி' : "Refresh Today's Orders"}`}
                  </button>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('Order Number', 'Order Number')}</th>
                        <th>{t('itemName', 'Item Name')}</th>
                        <th>{t('unit', 'Unit')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Ordered Quantity', 'Ordered Quantity')}</th>
                        <th>{t('Order Date & Time', 'Order Date & Time')}</th>
                        <th style={{ textAlign: 'center' }}>{t('status', 'Status')}</th>
                        <th style={{ textAlign: 'center' }}>{t('View Order', 'View Order')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alreadyOrderedToday.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="empty" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {language === 'ta' ? 'இன்று எந்த ஆர்டர்களும் சமர்ப்பிக்கப்படவில்லை.' : 'No orders have been submitted today.'}
                          </td>
                        </tr>
                      ) : (
                        alreadyOrderedToday.map(order => {
                          const lines = (order.lines && order.lines.length > 0) ? order.lines : [
                            { item: '—', unit: '—', quantity: 0 }
                          ];
                          const orderDateTimeStr = formatDisplayDateTime(order.createdAt || order.orderDate);
                          const badgeClass =
                            order.status === 'ORDERED' ? 'badge-ordered' :
                            order.status === 'RECEIVED' ? 'badge-completed' :
                            order.status === 'PARTIALLY_RECEIVED' ? 'badge-partial' :
                            'badge-pending';

                          return lines.map((line, idx) => (
                            <tr
                              key={`${order.orderNumber}-${line.id || idx}`}
                              style={{
                                borderTop: idx === 0 ? '1px solid var(--border-color)' : 'none',
                                background: idx % 2 === 0 ? 'rgba(0,0,0,0.01)' : 'transparent'
                              }}
                            >
                              {idx === 0 && (
                                <td
                                  rowSpan={lines.length}
                                  style={{
                                    verticalAlign: 'top',
                                    fontWeight: 700,
                                    color: 'var(--primary-dark-green)',
                                    borderRight: '1px solid var(--border-color)'
                                  }}
                                >
                                  {order.orderNumber}
                                </td>
                              )}
                              <td><b>{translateItem(line.item || line.itemName)}</b></td>
                              <td>{translateUnit(line.unit)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                {line.quantity ?? line.orderQuantity ?? 0}
                              </td>
                              {idx === 0 && (
                                <td
                                  rowSpan={lines.length}
                                  style={{
                                    verticalAlign: 'top',
                                    borderLeft: '1px solid var(--border-color)'
                                  }}
                                >
                                  {orderDateTimeStr}
                                </td>
                              )}
                              {idx === 0 && (
                                <td
                                  rowSpan={lines.length}
                                  style={{
                                    verticalAlign: 'top',
                                    textAlign: 'center'
                                  }}
                                >
                                  <span className={`badge ${badgeClass}`}>
                                    {translateStatus(order.status)}
                                  </span>
                                </td>
                              )}
                              {idx === 0 && (
                                <td
                                  rowSpan={lines.length}
                                  style={{
                                    verticalAlign: 'top',
                                    textAlign: 'center'
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="primary small"
                                    onClick={() => handleViewOrder(order.orderNumber)}
                                  >
                                    {t('View Order', 'View Order')}
                                  </button>
                                </td>
                              )}
                            </tr>
                          ));
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* OPTION 2: Make a Order */}
          {orderSubTab === 'make-order' && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 className="card-title">{t('Make a Order', 'Make a Order')}</h3>
                    {makeOrderLines.length > 0 && (
                      <span className="badge badge-ordered" style={{ fontSize: 11, background: 'var(--cream-surface)', color: 'var(--primary-dark-green)', borderColor: 'var(--gold)' }}>
                        ● {t('Draft Saved', 'Draft Saved')} ({makeOrderLines.length} {makeOrderLines.length === 1 ? t('item', 'item') : t('items', 'items')})
                      </span>
                    )}
                  </div>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {language === 'ta'
                      ? 'தேவைக்கு ஏற்ப ஆர்டர் அளவுகளை சரிசெய்யவும். இங்கு மாற்றப்பட்ட பொருட்கள் வரைவில் சேமிக்கப்பட்டு, ஒருங்கிணைந்த கிளைத் தேவைகளில் இருந்து மறைக்கப்படும்.'
                      : 'Adjust order quantities independently of requirement. Items moved here are saved in draft and hidden from Consolidated Branch Requirement.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {makeOrderLines.length > 0 && (
                    <button
                      type="button"
                      className="secondary small"
                      onClick={handleSaveDraft}
                    >
                      {t('Save Draft', 'Save Draft')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => handleAddLineItem(true)}
                    title={language === 'ta' ? 'பொருள் வரிசை சேர் (F5 குறுக்குவழி)' : 'Add Line Item (F5 shortcut)'}
                  >
                    {t('+ Add Line Item', '+ Add Line Item')} <kbd style={{ fontSize: 10, opacity: 0.85, padding: '1px 5px', background: 'rgba(0,0,0,0.06)', borderRadius: 3 }}>F5</kbd>
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('itemName', 'Item Name')}</th>
                      <th>{t('unit', 'Unit')}</th>
                      <th style={{ textAlign: 'right' }}>{t('Total Requirement Quantity', 'Total Requirement Quantity')}</th>
                      <th style={{ textAlign: 'right' }}>{t('Central Available Stock', 'Central Available Stock')}</th>
                      <th>{t('Order Quantity', 'Order Quantity')}</th>
                      <th style={{ textAlign: 'center' }}>{t('action', 'Action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {makeOrderLines.length > 0 ? (
                      makeOrderLines.map((line) => {
                        return (
                          <tr key={line.id} data-make-order-id={line.id}>
                            <td style={{ minWidth: 200 }}>
                              {line.isManual ? (
                                line.isCustomItem ? (
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <input
                                      type="text"
                                      placeholder={language === 'ta' ? 'புதிய பொருளின் பெயரை உள்ளிடவும்' : 'Enter new item name'}
                                      value={line.itemName}
                                      onChange={e => handleUpdateMakeOrderLine(line.id, 'itemName', e.target.value)}
                                      style={{ width: '100%' }}
                                    />
                                    <button
                                      type="button"
                                      className="secondary small"
                                      title={language === 'ta' ? 'பட்டியலில் உள்ள பொருட்களுக்கு மாறவும்' : 'Switch to existing catalogue items'}
                                      onClick={() => handleUpdateMakeOrderLine(line.id, 'switchToCatalogue')}
                                    >
                                      {t('Catalogue', 'Catalogue')}
                                    </button>
                                  </div>
                                ) : (
                                  <select
                                    value={line.itemName}
                                    onChange={e => handleUpdateMakeOrderLine(line.id, 'itemName', e.target.value)}
                                  >
                                    <option value="">{t('Select Item', '-- Select Item --')}</option>
                                    {catalogueItems.map(it => (
                                      <option key={it.id} value={it.name}>
                                        {translateItem(it.name)} ({translateUnit(it.unit)})
                                      </option>
                                    ))}
                                    <option value="__NEW_ITEM__">{language === 'ta' ? '+ புதிய பொருளை உள்ளிடவும்...' : '+ Enter New Item...'}</option>
                                  </select>
                                )
                              ) : (
                                <b>{translateItem(line.itemName)}</b>
                              )}
                            </td>
                            <td style={{ width: 100 }}>
                              {line.isCustomItem ? (
                                <input
                                  type="text"
                                  placeholder={t('unit', 'Unit')}
                                  value={line.unit}
                                  onChange={e => handleUpdateMakeOrderLine(line.id, 'unit', e.target.value)}
                                  style={{ width: 70 }}
                                />
                              ) : (
                                translateUnit(line.unit)
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span style={{ fontWeight: 600, color: line.totalRequiredQuantity > 0 ? 'var(--gold-accessible)' : '#666' }}>
                                {line.totalRequiredQuantity || 0}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span style={{ fontWeight: 600, color: (line.availableStock || 0) > 0 ? 'var(--primary-dark-green)' : 'var(--danger)' }}>
                                {line.availableStock || 0}
                              </span>
                            </td>
                            <td>
                              <input
                                type="number"
                                min="1"
                                placeholder={t('Order Quantity', 'Order Qty')}
                                style={{ width: 110 }}
                                value={line.orderQuantity}
                                onChange={e => handleUpdateMakeOrderLine(line.id, 'orderQuantity', e.target.value)}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="danger small"
                                onClick={() => handleRemoveMakeOrderLine(line.id)}
                              >
                                {t('Remove Line', 'Remove Line')}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="6" className="empty">
                          {language === 'ta'
                            ? 'இந்த ஆர்டரில் இதுவரை பொருட்கள் இல்லை. ஒருங்கிணைந்த கிளை தேவைகளில் இருந்து பொருட்களைத் தேர்ந்தெடுத்து "ஆர்டருக்கு நகர்த்து" என்பதைக் கிளிக் செய்யவும் அல்லது மேலே உள்ள "+ பொருள் வரிசை சேர்" என்பதைக் கிளிக் செய்யவும்.'
                            : 'No items in this order yet. Select items from Consolidated Branch Requirement and click Move to Order, or click + Add Line Item above.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="form-actions" style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  className="primary"
                  disabled={submittingStoreOrder || makeOrderLines.length === 0}
                  onClick={handleSendToOrganisation}
                >
                  {submittingStoreOrder ? t('Sending Order to Organisation...', 'Sending Order to Organisation...') : t('Send to Organisation', 'Send to Organisation')}
                </button>
                {makeOrderLines.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="secondary"
                      onClick={handleSaveDraft}
                    >
                      {t('Save Draft', 'Save Draft')}
                    </button>
                    <button
                      type="button"
                      className="danger small"
                      style={{ marginLeft: 'auto' }}
                      onClick={handleClearDraft}
                    >
                      {t('Clear Draft', 'Clear Draft')}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* OPTION 3: Previous Orders */}
          {orderSubTab === 'previous-orders' && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">{t('Previous Orders', 'Previous Orders')}</h3>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {language === 'ta'
                      ? 'முன்பு சமர்ப்பிக்கப்பட்ட கொள்முதல் ஆர்டர்கள் உருவாக்கப்பட்ட தேதி வாரியாக தொகுக்கப்பட்டு, புதியவை முதலில் காட்டப்படுகின்றன.'
                      : 'List of previously submitted purchase orders grouped by creation date, newest first.'}
                  </p>
                </div>
                <button type="button" className="secondary small" onClick={() => loadPreviousOrders(previousOrderDate, previousOrderIsAllDates)}>
                  ↻ {t('refresh', 'Refresh')}
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <DateFilterBar
                  label={t('Filter by Order Creation Date:', 'Filter by Order Creation Date:')}
                  selectedDate={previousOrderDate}
                  isAllDates={previousOrderIsAllDates}
                  onDateChange={d => {
                    setPreviousOrderDate(d);
                    setPreviousOrderIsAllDates(false);
                    loadPreviousOrders(d, false);
                  }}
                  onToggleAllDates={all => {
                    setPreviousOrderIsAllDates(all);
                    loadPreviousOrders(previousOrderDate, all);
                  }}
                />
              </div>

              {previousOrders.length === 0 ? (
                <EmptyDateMessage
                  message={
                    loading
                      ? t('loading', 'Loading previous orders...')
                      : previousOrderIsAllDates
                      ? (language === 'ta' ? 'கொள்முதல் ஆர்டர்கள் எதுவும் சமர்ப்பிக்கப்படவில்லை.' : 'No purchase orders submitted yet.')
                      : (language === 'ta' ? `${formatDisplayDate(previousOrderDate)} அன்று முந்தைய ஆர்டர்கள் எதுவும் இல்லை.` : `No previous orders found for ${formatDisplayDate(previousOrderDate)}.`)
                  }
                />
              ) : previousOrderIsAllDates ? (
                groupByDate(previousOrders, o => o.orderDate || o.createdAt, language).map(group => (
                  <div key={group.date} style={{ marginBottom: 24 }}>
                    <DateSectionHeader date={group.date} count={group.items.length} unit={t('orders', 'orders')} />
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('Order Number', 'Order Number')}</th>
                            <th>{t('Order Date & Time', 'Order Date & Time')}</th>
                            <th>{t('Total Items', 'Total Items')}</th>
                            <th>{t('status', 'Status')}</th>
                            <th style={{ textAlign: 'right' }}>{t('action', 'Action')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items.map(order => {
                            const itemsCount = order.lines ? order.lines.length : (order.totalItems || 1);
                            return (
                              <tr key={order.orderNumber}>
                                <td><b>{order.orderNumber}</b></td>
                                <td>{formatDisplayDateTime(order.orderDate || order.createdAt)}</td>
                                <td>{itemsCount} {itemsCount === 1 ? t('item', 'item') : t('items', 'items')}</td>
                                <td>
                                  <span className={`badge ${
                                    order.status === 'ORDERED' ? 'badge-ordered' :
                                    order.status === 'RECEIVED' ? 'badge-completed' :
                                    order.status === 'PARTIALLY_RECEIVED' ? 'badge-partial' : 'badge-pending'
                                  }`}>
                                    {translateStatus(order.status)}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    className="primary small"
                                    onClick={() => handleViewOrder(order.orderNumber)}
                                  >
                                    {t('View Order', 'View Order')}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <div>
                  <DateSectionHeader date={previousOrderDate} count={previousOrders.length} unit={t('orders', 'orders')} />
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{t('Order Number', 'Order Number')}</th>
                          <th>{t('Order Date & Time', 'Order Date & Time')}</th>
                          <th>{t('Total Items', 'Total Items')}</th>
                          <th>{t('status', 'Status')}</th>
                          <th style={{ textAlign: 'right' }}>{t('action', 'Action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previousOrders.map(order => {
                          const itemsCount = order.lines ? order.lines.length : (order.totalItems || 1);
                          return (
                            <tr key={order.orderNumber}>
                              <td><b>{order.orderNumber}</b></td>
                              <td>{formatDisplayDateTime(order.orderDate || order.createdAt)}</td>
                              <td>{itemsCount} {itemsCount === 1 ? t('item', 'item') : t('items', 'items')}</td>
                              <td>
                                <span className={`badge ${
                                  order.status === 'ORDERED' ? 'badge-ordered' :
                                  order.status === 'RECEIVED' ? 'badge-completed' :
                                  order.status === 'PARTIALLY_RECEIVED' ? 'badge-partial' : 'badge-pending'
                                }`}>
                                  {translateStatus(order.status)}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="primary small"
                                  onClick={() => handleViewOrder(order.orderNumber)}
                                >
                                  {t('View Order', 'View Order')}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </section>
      )}

      {/* 5. REPORTS TAB (Operational Reports) */}
      {(activeTab === 'reports' || activeTab === 'history') && (
        <section>
          {/* Section E: Purchase and Dispatch Summary KPI Cards */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ marginBottom: 12 }}>
              <div>
                <h3 className="card-title">{t('Purchase & Dispatch Summary', 'Purchase & Dispatch Summary')}</h3>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {language === 'ta'
                    ? 'மைய சரக்கு இருப்பு, கொள்முதல் ஆர்டர்கள் மற்றும் கிளை விநியோகங்களின் நேரடி செயல்பாட்டு மொத்த அளவுகள்.'
                    : 'Live operational aggregate totals from central inventory, purchase orders, and branch dispatches.'}
                </p>
              </div>
              <button
                type="button"
                className="secondary small"
                onClick={loadReports}
                disabled={loadingReports}
              >
                {loadingReports ? t('loading', 'Refreshing...') : `↻ ${language === 'ta' ? 'அறிக்கைகளைப் புதுப்பி' : 'Refresh Reports'}`}
              </button>
            </div>

            <div className="kpi-grid">
              <div className="kpi-card">
                <span className="kpi-label">{t('Total Purchase Orders', 'Total Purchase Orders')}</span>
                <span className="kpi-value">{reportSummary.totalPurchaseOrders || 0}</span>
                <span className="kpi-desc">{t('Distinct PO numbers created', 'Distinct PO numbers created')}</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">{t('Total Items Ordered', 'Total Items Ordered')}</span>
                <span className="kpi-value">{reportSummary.totalItemsOrdered || 0}</span>
                <span className="kpi-desc">{t('Cumulative items ordered from Org Admin', 'Cumulative items ordered from Org Admin')}</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">{t('Total Quantity Received', 'Total Quantity Received')}</span>
                <span className="kpi-value" style={{ color: 'var(--green)' }}>
                  {reportSummary.totalQuantityReceived || 0}
                </span>
                <span className="kpi-desc">{t('Received into central inventory', 'Received into central inventory')}</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">{t('Total Quantity Dispatched', 'Total Quantity Dispatched')}</span>
                <span className="kpi-value">{reportSummary.totalQuantityDispatched || 0}</span>
                <span className="kpi-desc">{t('Dispatched across all branches', 'Dispatched across all branches')}</span>
              </div>
              <div className="kpi-card" style={{ borderTopColor: (reportSummary.totalPendingAcknowledgement || 0) > 0 ? '#d48806' : 'var(--green)' }}>
                <span className="kpi-label">{t('Pending Acknowledgements', 'Pending Acknowledgements')}</span>
                <span className="kpi-value" style={{ color: (reportSummary.totalPendingAcknowledgement || 0) > 0 ? '#b78103' : 'var(--green)' }}>
                  {reportSummary.totalPendingAcknowledgement || 0}
                </span>
                <span className="kpi-desc">{t('Dispatched units awaiting branch confirmation', 'Dispatched units awaiting branch confirmation')}</span>
              </div>
            </div>
          </div>

          {/* Subnav for Switching / Filtering View */}
          <div className="subnav" style={{ marginBottom: 20 }}>
            <button
              type="button"
              className={`subnav-btn ${reportSubTab === 'all' ? 'active' : ''}`}
              onClick={() => setReportSubTab('all')}
            >
              {t('All Reports', 'All Reports')}
            </button>
            <button
              type="button"
              className={`subnav-btn ${reportSubTab === 'orders' ? 'active' : ''}`}
              onClick={() => setReportSubTab('orders')}
            >
              {t('1. Order Report', '1. Order Report')} ({poReport.length})
            </button>
            <button
              type="button"
              className={`subnav-btn ${reportSubTab === 'inventory-entries' ? 'active' : ''}`}
              onClick={() => setReportSubTab('inventory-entries')}
            >
              {t('2. Inventory Entry Report', '2. Inventory Entry Report')} ({inventoryEntryReport.length})
            </button>
            <button
              type="button"
              className={`subnav-btn ${reportSubTab === 'dispatches' ? 'active' : ''}`}
              onClick={() => setReportSubTab('dispatches')}
            >
              {t('3. Branch-wise Dispatch Report', '3. Branch-wise Dispatch Report')} ({dispatchReport.length})
            </button>
            <button
              type="button"
              className={`subnav-btn ${reportSubTab === 'branch-requests' ? 'active' : ''}`}
              onClick={() => setReportSubTab('branch-requests')}
            >
              {t('4. Branch Requests Report', '4. Branch Requests Report')} ({branchReqReport.length})
            </button>
          </div>

          {/* SECTION 1: Order Report */}
          {(reportSubTab === 'all' || reportSubTab === 'orders') && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header" style={{ marginBottom: 12 }}>
                <div>
                  <h3 className="card-title">{t('1. Order Report', '1. Order Report')}</h3>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {language === 'ta'
                      ? 'கிடங்கு மேலாளரால் உருவாக்கப்பட்டு நிறுவன நிர்வாகிக்கு அனுப்பப்பட்ட கொள்முதல் ஆர்டர்கள்.'
                      : 'Purchase orders created by Store Manager and submitted to Organisation Admin.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={handleExportPurchaseOrders}
                  >
                    {t('⬇ Export CSV', '⬇ Export CSV')}
                  </button>
                </div>
              </div>

              {/* Independent Date Filter */}
              <DateFilterBar
                label="Order Date Filter"
                selectedDate={poFilterDate}
                onDateChange={(newDate) => {
                  setPoFilterDate(newDate);
                  setPoIsAllDates(false);
                  loadPoReport(newDate, false);
                }}
                isAllDates={poIsAllDates}
                onToggleAllDates={(all) => {
                  setPoIsAllDates(all);
                  loadPoReport(poFilterDate, all);
                }}
                availableDates={poAvailableDates}
                totalCount={poReport.length}
              />

              {poReport.length === 0 ? (
                <div style={{ padding: '16px 0' }}>
                  <EmptyDateMessage
                    date={poIsAllDates ? null : poFilterDate}
                    message={loadingPoReport
                      ? t('loading', 'Loading purchase order report...')
                      : (language === 'ta'
                          ? 'தேர்ந்தெடுக்கப்பட்ட தேதிக்கு எந்த ஆர்டர் பதிவுகளும் இல்லை.'
                          : 'No purchase orders found for selected date.')}
                    onResetToday={() => {
                      setPoIsAllDates(false);
                      setPoFilterDate(getTodayDateString());
                      loadPoReport(getTodayDateString(), false);
                    }}
                    onShowAll={() => {
                      setPoIsAllDates(true);
                      loadPoReport(poFilterDate, true);
                    }}
                  />
                </div>
              ) : (
                (() => {
                  const renderOrderGroupCard = (order) => (
                    <div
                      key={order.orderNumber}
                      className="order-group-card"
                      style={{
                        background: '#fff',
                        border: '1px solid var(--border-color, #E5DDC9)',
                        borderRadius: '8px',
                        marginBottom: '16px',
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 16px',
                          background: 'linear-gradient(90deg, #F8F4EA 0%, #FAF7F0 100%)',
                          borderBottom: '1px solid var(--border-color, #E5DDC9)',
                          flexWrap: 'wrap',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            type="button"
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: 'var(--primary-dark-green)',
                              fontWeight: 700,
                              fontSize: '15px',
                              cursor: 'pointer',
                              textDecoration: 'underline'
                            }}
                            onClick={() => handleViewOrder(order.orderNumber)}
                            title={t('View Order Details', 'View Order Details')}
                          >
                            📋 {order.orderNumber}
                          </button>
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            🕒 {formatDisplayDateTime(order.createdAt || order.orderDate)}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className={`badge ${
                            (order.status || '').toUpperCase() === 'RECEIVED' ? 'badge-completed' :
                            (order.status || '').toUpperCase() === 'PARTIALLY_RECEIVED' ? 'badge-partial' :
                            (order.status || '').toUpperCase() === 'ORDERED' ? 'badge-ordered' : 'badge-pending'
                          }`}>
                            {translateStatus(order.status)}
                          </span>
                          <button
                            type="button"
                            className="secondary small"
                            onClick={() => handleViewOrder(order.orderNumber)}
                          >
                            {t('View Order Details', 'View Order Details')}
                          </button>
                        </div>
                      </div>

                      <div className="table-wrap" style={{ margin: 0, border: 'none' }}>
                        <table>
                          <thead>
                            <tr>
                              <th>{t('Order Number', 'Order Number')}</th>
                              <th>{t('Order Date and Time', 'Order Date and Time')}</th>
                              <th>{t('Item Name', 'Item Name')}</th>
                              <th style={{ textAlign: 'right' }}>{t('Ordered Quantity', 'Ordered Quantity')}</th>
                              <th style={{ textAlign: 'center' }}>{t('Status', 'Status')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {order.items.map(it => (
                              <tr key={it.id}>
                                <td>
                                  <button
                                    type="button"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: 0,
                                      color: 'var(--primary-dark-green)',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      textDecoration: 'underline'
                                    }}
                                    onClick={() => handleViewOrder(order.orderNumber)}
                                  >
                                    {order.orderNumber}
                                  </button>
                                </td>
                                <td>{formatDisplayDateTime(it.createdAt || it.orderDate)}</td>
                                <td><b>{translateItem(it.itemName)}</b></td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                  {it.quantityOrdered} {translateUnit(it.unit)}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className={`badge ${
                                    (it.status || order.status || '').toUpperCase() === 'RECEIVED' ? 'badge-completed' :
                                    (it.status || order.status || '').toUpperCase() === 'PARTIALLY_RECEIVED' ? 'badge-partial' :
                                    (it.status || order.status || '').toUpperCase() === 'ORDERED' ? 'badge-ordered' : 'badge-pending'
                                  }`}>
                                    {translateStatus(it.status || order.status)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );

                  const groupPoItemsByOrder = (items) => {
                    const map = new Map();
                    for (const item of items) {
                      const key = item.orderNumber || `PO-${item.id}`;
                      if (!map.has(key)) {
                        map.set(key, {
                          orderNumber: key,
                          orderDate: item.orderDate,
                          createdAt: item.createdAt,
                          status: item.status,
                          items: []
                        });
                      }
                      map.get(key).items.push(item);
                    }
                    return Array.from(map.values());
                  };

                  if (poIsAllDates) {
                    return groupByDate(poReport, p => p.createdAt || p.orderDate, language).map(dateGroup => (
                      <div key={dateGroup.date} style={{ marginBottom: 20 }}>
                        <DateSectionHeader date={dateGroup.date} count={groupPoItemsByOrder(dateGroup.items).length} unit={t('orders', 'orders')} />
                        {groupPoItemsByOrder(dateGroup.items).map(renderOrderGroupCard)}
                      </div>
                    ));
                  }

                  return groupPoItemsByOrder(poReport).map(renderOrderGroupCard);
                })()
              )}
            </div>
          )}

          {/* SECTION 2: Inventory Entry Report */}
          {(reportSubTab === 'all' || reportSubTab === 'inventory-entries') && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header" style={{ marginBottom: 12 }}>
                <div>
                  <h3 className="card-title">{t('2. Inventory Entry Report', '2. Inventory Entry Report')}</h3>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {language === 'ta'
                      ? 'மைய சரக்கு இருப்பில் உண்மையாக பெறப்பட்ட பொருட்களின் விபரம்.'
                      : 'Physical goods actually received and recorded into central inventory.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={handleExportInventoryEntries}
                  >
                    {t('⬇ Export CSV', '⬇ Export CSV')}
                  </button>
                </div>
              </div>

              {/* Independent Date Filter */}
              <DateFilterBar
                label="Receipt Date Filter"
                selectedDate={inventoryEntryDate}
                onDateChange={(newDate) => {
                  setInventoryEntryDate(newDate);
                  setInventoryEntryIsAllDates(false);
                  loadInventoryEntryReport(newDate, false);
                }}
                isAllDates={inventoryEntryIsAllDates}
                onToggleAllDates={(all) => {
                  setInventoryEntryIsAllDates(all);
                  loadInventoryEntryReport(inventoryEntryDate, all);
                }}
                availableDates={inventoryEntryAvailableDates}
                totalCount={inventoryEntryReport.length}
              />

              {inventoryEntryReport.length === 0 ? (
                <div style={{ padding: '16px 0' }}>
                  <EmptyDateMessage
                    date={inventoryEntryIsAllDates ? null : inventoryEntryDate}
                    message={loadingInventoryEntryReport
                      ? t('loading', 'Loading inventory entry report...')
                      : (language === 'ta'
                          ? 'தேர்ந்தெடுக்கப்பட்ட தேதிக்கு எந்த சரக்கு வரவு பதிவுகளும் இல்லை.'
                          : 'No inventory entry records found for selected date.')}
                    onResetToday={() => {
                      setInventoryEntryIsAllDates(false);
                      setInventoryEntryDate(getTodayDateString());
                      loadInventoryEntryReport(getTodayDateString(), false);
                    }}
                    onShowAll={() => {
                      setInventoryEntryIsAllDates(true);
                      loadInventoryEntryReport(inventoryEntryDate, true);
                    }}
                  />
                </div>
              ) : (
                (() => {
                  const renderEntryTable = (entries) => (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('Receipt Date and Time', 'Receipt Date and Time')}</th>
                            <th>{t('Order Number', 'Order Number')}</th>
                            <th>{t('Item Name', 'Item Name')}</th>
                            <th>{t('Unit', 'Unit')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Quantity Received', 'Quantity Received')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Updated Stock Balance', 'Updated Stock Balance')}</th>
                            <th style={{ textAlign: 'center' }}>{t('Received By', 'Received By')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map(entry => (
                            <tr key={entry.id}>
                              <td>{formatDisplayDateTime(entry.receiptDate)}</td>
                              <td>
                                {entry.orderNumber && entry.orderNumber.startsWith('PO-') ? (
                                  <button
                                    type="button"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: 0,
                                      color: 'var(--primary-dark-green)',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      textDecoration: 'underline'
                                    }}
                                    onClick={() => handleViewOrder(entry.orderNumber)}
                                    title={t('View Order Details', 'View Order Details')}
                                  >
                                    {entry.orderNumber}
                                  </button>
                                ) : (
                                  <span style={{ fontWeight: 500, color: '#666' }}>{entry.orderNumber || '—'}</span>
                                )}
                              </td>
                              <td><b>{translateItem(entry.itemName)}</b></td>
                              <td>{translateUnit(entry.unit)}</td>
                              <td style={{ textAlign: 'right' }}>
                                <span style={{ fontWeight: 700, color: 'var(--green)' }}>
                                  +{entry.quantityReceived} {translateUnit(entry.unit)}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                {entry.updatedStockBalance !== null && entry.updatedStockBalance !== undefined ? (
                                  <span style={{ fontWeight: 600, color: 'var(--primary-dark-green)' }}>
                                    {entry.updatedStockBalance} {translateUnit(entry.unit)}
                                  </span>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center', fontSize: '13px', color: '#555' }}>
                                {entry.receivedBy || 'Store Manager'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );

                  if (inventoryEntryIsAllDates) {
                    return groupByDate(inventoryEntryReport, e => e.receiptDate, language).map(dateGroup => (
                      <div key={dateGroup.date} style={{ marginBottom: 20 }}>
                        <DateSectionHeader date={dateGroup.date} count={dateGroup.items.length} unit={t('entries', 'entries')} />
                        {renderEntryTable(dateGroup.items)}
                      </div>
                    ));
                  }

                  return renderEntryTable(inventoryEntryReport);
                })()
              )}
            </div>
          )}

          {/* SECTION 3: Branch-wise Dispatch Report */}
          {(reportSubTab === 'all' || reportSubTab === 'dispatches') && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header" style={{ marginBottom: 12 }}>
                <div>
                  <h3 className="card-title">{t('3. Branch-wise Dispatch Report', '3. Branch-wise Dispatch Report')}</h3>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {language === 'ta'
                      ? 'கிளைகளுக்கு அனுப்பப்பட்ட பொருட்கள், கோரப்பட்ட மற்றும் விநியோகிக்கப்பட்ட அளவுகள் மற்றும் கிளை ஒப்புதல் நிலை.'
                      : 'Dispatches to branches, requested vs actual dispatched quantities, and delivery/acknowledgement status.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={handleExportDispatches}
                  >
                    {t('⬇ Export CSV', '⬇ Export CSV')}
                  </button>
                </div>
              </div>

              {/* Independent Date Filter + Branch & Category Selector */}
              <DateFilterBar
                label="Dispatch Date Filter"
                selectedDate={dispatchFilterDate}
                onDateChange={(newDate) => {
                  setDispatchFilterDate(newDate);
                  setDispatchIsAllDates(false);
                  loadDispatchReport(newDate, false, dispatchFilterBranch, dispatchFilterCategory);
                }}
                isAllDates={dispatchIsAllDates}
                onToggleAllDates={(all) => {
                  setDispatchIsAllDates(all);
                  loadDispatchReport(dispatchFilterDate, all, dispatchFilterBranch, dispatchFilterCategory);
                }}
                availableDates={dispatchAvailableDates}
                totalCount={dispatchReport.length}
                extraControls={
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary-dark-green)' }}>
                        🏢 {t('Branch:', 'Branch:')}
                      </label>
                      <select
                        value={dispatchFilterBranch}
                        onChange={(e) => {
                          const b = e.target.value;
                          setDispatchFilterBranch(b);
                          loadDispatchReport(dispatchFilterDate, dispatchIsAllDates, b, dispatchFilterCategory);
                        }}
                        style={{
                          padding: '6px 10px',
                          border: '1px solid var(--border-color, #E5DDC9)',
                          borderRadius: '6px',
                          background: '#fff',
                          fontSize: '13px',
                          color: 'var(--dark-text)',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">{t('All Branches', 'All Branches')}</option>
                        {branches.map(b => (
                          <option key={b.id || b.name} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary-dark-green)' }}>
                        🏷️ {t('Category:', 'Category:')}
                      </label>
                      <select
                        value={dispatchFilterCategory}
                        onChange={(e) => {
                          const cat = e.target.value;
                          setDispatchFilterCategory(cat);
                          loadDispatchReport(dispatchFilterDate, dispatchIsAllDates, dispatchFilterBranch, cat);
                        }}
                        style={{
                          padding: '6px 10px',
                          border: '1px solid var(--border-color, #E5DDC9)',
                          borderRadius: '6px',
                          background: '#fff',
                          fontSize: '13px',
                          color: 'var(--dark-text)',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">{t('All Categories', 'All Categories')}</option>
                        {BRANCH_ORDER_CATEGORIES.map(c => (
                          <option key={c} value={c}>{translateCategory(c)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                }
              />

              {dispatchReport.length === 0 ? (
                <div style={{ padding: '16px 0' }}>
                  <EmptyDateMessage
                    date={dispatchIsAllDates ? null : dispatchFilterDate}
                    message={loadingDispatchReport
                      ? t('loading', 'Loading dispatch report...')
                      : (language === 'ta'
                          ? 'தேர்ந்தெடுக்கப்பட்ட தேதி மற்றும் கிளைக்கு எந்த விநியோக பதிவுகளும் இல்லை.'
                          : 'No dispatch records found for selected date and branch.')}
                    onResetToday={() => {
                      setDispatchIsAllDates(false);
                      setDispatchFilterDate(getTodayDateString());
                      loadDispatchReport(getTodayDateString(), false, dispatchFilterBranch, dispatchFilterCategory);
                    }}
                    onShowAll={() => {
                      setDispatchIsAllDates(true);
                      loadDispatchReport(dispatchFilterDate, true, dispatchFilterBranch, dispatchFilterCategory);
                    }}
                  />
                </div>
              ) : (
                (() => {
                  const renderDispatchTable = (items) => (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('Dispatch Date and Time', 'Dispatch Date and Time')}</th>
                            <th>{t('Branch Name', 'Branch Name')}</th>
                            <th>{t('Category', 'Category')}</th>
                            <th>{t('Item Name', 'Item Name')}</th>
                            <th>{t('Unit', 'Unit')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Requested Quantity', 'Requested Quantity')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Dispatched Quantity', 'Dispatched Quantity')}</th>
                            <th style={{ textAlign: 'center' }}>{t('Delivery/Acknowledgement Status', 'Delivery/Acknowledgement Status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(d => {
                            const isAck = (d.status || '').toUpperCase() === 'ACKNOWLEDGED';
                            return (
                              <tr key={d.id}>
                                <td>{formatDisplayDateTime(d.dispatchDateTime || d.createdAt || d.dispatchDate)}</td>
                                <td><b>{d.branchName}</b></td>
                                <td>
                                  {d.category ? (
                                    <span className="category-badge">{translateCategory(d.category)}</span>
                                  ) : (
                                    <span className="muted">—</span>
                                  )}
                                </td>
                                <td>{translateItem(d.itemName)}</td>
                                <td>{translateUnit(d.unit)}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <span style={{ fontWeight: 500 }}>{d.requestedQuantity}</span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--primary-dark-green)' }}>
                                    {d.dispatchedQuantity}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className={`badge ${isAck ? 'badge-completed' : 'badge-pending'}`}>
                                    {isAck
                                      ? `✓ ${t('Acknowledged', 'Acknowledged')}${d.acknowledgedAt ? ` (${formatDisplayDateTime(d.acknowledgedAt)})` : ''}`
                                      : `⏳ ${t('Pending Acknowledgement', 'Pending Acknowledgement')}`}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );

                  if (dispatchIsAllDates) {
                    return groupByDate(dispatchReport, d => d.dispatchDate || d.dispatchDateTime || d.createdAt, language).map(dateGroup => (
                      <div key={dateGroup.date} style={{ marginBottom: 20 }}>
                        <DateSectionHeader date={dateGroup.date} count={dateGroup.items.length} unit={t('dispatches', 'dispatches')} />
                        {renderDispatchTable(dateGroup.items)}
                      </div>
                    ));
                  }

                  return renderDispatchTable(dispatchReport);
                })()
              )}
            </div>
          )}

          {/* SECTION 4: Branch Requests Report */}
          {(reportSubTab === 'all' || reportSubTab === 'branch-requests') && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header" style={{ marginBottom: 12 }}>
                <div>
                  <h3 className="card-title">{t('4. Branch Requests Report', '4. Branch Requests Report')}</h3>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {language === 'ta'
                      ? 'கிளை மேலாளர்களின் உருப்படி கோரிக்கைகள், வகை வாரியான விவரங்கள் மற்றும் விநியோக நிலை.'
                      : 'Item requests submitted by branch managers, classified by category with fulfillment and delivery status.'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={handleExportBranchRequests}
                  >
                    {t('⬇ Export CSV', '⬇ Export CSV')}
                  </button>
                  <button
                    type="button"
                    className="primary small"
                    onClick={handleExportBranchRequestsPdf}
                  >
                    {t('📄 Export PDF', '📄 Export PDF')}
                  </button>
                </div>
              </div>

              {/* Independent Date Filter + Branch & Category Selector */}
              <DateFilterBar
                label="Branch Requests Date Filter"
                selectedDate={branchReqFilterDate}
                onDateChange={(newDate) => {
                  setBranchReqFilterDate(newDate);
                  setBranchReqIsAllDates(false);
                  loadBranchReqReport(newDate, false, branchReqFilterBranch, branchReqFilterCategory);
                }}
                isAllDates={branchReqIsAllDates}
                onToggleAllDates={(all) => {
                  setBranchReqIsAllDates(all);
                  loadBranchReqReport(branchReqFilterDate, all, branchReqFilterBranch, branchReqFilterCategory);
                }}
                availableDates={branchReqAvailableDates}
                totalCount={branchReqReport.length}
                extraControls={
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary-dark-green)' }}>
                        🏢 {t('Branch:', 'Branch:')}
                      </label>
                      <select
                        value={branchReqFilterBranch}
                        onChange={(e) => {
                          const b = e.target.value;
                          setBranchReqFilterBranch(b);
                          loadBranchReqReport(branchReqFilterDate, branchReqIsAllDates, b, branchReqFilterCategory);
                        }}
                        style={{
                          padding: '6px 10px',
                          border: '1px solid var(--border-color, #E5DDC9)',
                          borderRadius: '6px',
                          background: '#fff',
                          fontSize: '13px',
                          color: 'var(--dark-text)',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">{t('All Branches', 'All Branches')}</option>
                        {branches.map(b => (
                          <option key={b.id || b.name} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary-dark-green)' }}>
                        🏷️ {t('Category:', 'Category:')}
                      </label>
                      <select
                        value={branchReqFilterCategory}
                        onChange={(e) => {
                          const cat = e.target.value;
                          setBranchReqFilterCategory(cat);
                          loadBranchReqReport(branchReqFilterDate, branchReqIsAllDates, branchReqFilterBranch, cat);
                        }}
                        style={{
                          padding: '6px 10px',
                          border: '1px solid var(--border-color, #E5DDC9)',
                          borderRadius: '6px',
                          background: '#fff',
                          fontSize: '13px',
                          color: 'var(--dark-text)',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="">{t('All Categories', 'All Categories')}</option>
                        {BRANCH_ORDER_CATEGORIES.map(c => (
                          <option key={c} value={c}>{translateCategory(c)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                }
              />

              {/* Category-wise Summary Breakdown Chips */}
              {branchReqReport.length > 0 && (() => {
                const catMap = {};
                branchReqReport.forEach(r => {
                  const cat = r.category || 'Uncategorized';
                  if (!catMap[cat]) catMap[cat] = { count: 0, requestedQty: 0 };
                  catMap[cat].count += 1;
                  catMap[cat].requestedQty += Number(r.requestedQuantity || 0);
                });
                const catEntries = Object.entries(catMap);
                return (
                  <div style={{ margin: '14px 0 18px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-dark-green)', marginBottom: 8 }}>
                      📊 {t('Category-wise Summary Breakdown:', 'Category-wise Summary Breakdown:')}
                    </div>
                    <div className="category-summary-grid">
                      {catEntries.map(([cat, data]) => (
                        <div key={cat} className="category-summary-chip">
                          <span className="category-badge">{cat === 'Uncategorized' ? t('Uncategorized', 'Uncategorized') : translateCategory(cat)}</span>
                          <span style={{ fontSize: 13, color: 'var(--dark-text)' }}>
                            <b>{data.count}</b> {t('items', 'items')} • <b>{data.requestedQty.toFixed(1).replace(/\.0$/, '')}</b> {t('total requested', 'total requested')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {branchReqReport.length === 0 ? (
                <div style={{ padding: '16px 0' }}>
                  <EmptyDateMessage
                    date={branchReqIsAllDates ? null : branchReqFilterDate}
                    message={loadingBranchReqReport
                      ? t('loading', 'Loading branch requests report...')
                      : (language === 'ta'
                          ? 'தேர்ந்தெடுக்கப்பட்ட தேதி மற்றும் வடிகட்டிகளுக்கு எந்த கிளை கோரிக்கைகளும் இல்லை.'
                          : 'No branch request records found for selected filters.')}
                    onResetToday={() => {
                      setBranchReqIsAllDates(false);
                      setBranchReqFilterDate(getTodayDateString());
                      loadBranchReqReport(getTodayDateString(), false, branchReqFilterBranch, branchReqFilterCategory);
                    }}
                    onShowAll={() => {
                      setBranchReqIsAllDates(true);
                      loadBranchReqReport(branchReqFilterDate, true, branchReqFilterBranch, branchReqFilterCategory);
                    }}
                  />
                </div>
              ) : (
                (() => {
                  const renderReqTable = (items) => (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('Request Date', 'Request Date')}</th>
                            <th>{t('Branch Name', 'Branch Name')}</th>
                            <th>{t('Category', 'Category')}</th>
                            <th>{t('Item Name', 'Item Name')}</th>
                            <th>{t('Unit', 'Unit')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Requested Quantity', 'Requested Quantity')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Dispatched Quantity', 'Dispatched Quantity')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Confirmed Received Quantity', 'Confirmed Received Quantity')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Remaining Quantity', 'Remaining Quantity')}</th>
                            <th style={{ textAlign: 'center' }}>{t('Status', 'Status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(r => {
                            const isCompleted = (r.status || '').toUpperCase() === 'COMPLETED';
                            const isPartial = (r.status || '').toUpperCase() === 'PARTIALLY_DELIVERED';
                            return (
                              <tr key={r.id || `${r.branchName}_${r.itemName}_${r.date}`}>
                                <td>{formatDisplayDate(r.date)}</td>
                                <td><b>{r.branchName}</b></td>
                                <td>
                                  {r.category ? (
                                    <span className="category-badge">{translateCategory(r.category)}</span>
                                  ) : (
                                    <span className="muted">—</span>
                                  )}
                                </td>
                                <td><b>{translateItem(r.itemName)}</b></td>
                                <td>{translateUnit(r.unit)}</td>
                                <td style={{ textAlign: 'right' }}>
                                  <span style={{ fontWeight: 600 }}>{r.requestedQuantity}</span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--primary-dark-green)' }}>
                                    {r.dispatchedQuantity || 0}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--green)' }}>
                                    {r.acknowledgedReceivedQuantity || 0}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <span style={{ fontWeight: 600, color: (r.remainingQuantity > 0 ? '#b91c1c' : '#555') }}>
                                    {r.remainingQuantity || 0}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className={`badge ${isCompleted ? 'badge-completed' : (isPartial ? 'badge-ordered' : 'badge-pending')}`}>
                                    {translateStatus(r.status || 'PENDING')}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );

                  if (branchReqIsAllDates) {
                    return groupByDate(branchReqReport, r => r.date, language).map(dateGroup => (
                      <div key={dateGroup.date} style={{ marginBottom: 20 }}>
                        <DateSectionHeader date={dateGroup.date} count={dateGroup.items.length} unit={t('requests', 'requests')} />
                        {renderReqTable(dateGroup.items)}
                      </div>
                    ));
                  }

                  return renderReqTable(branchReqReport);
                })()
              )}
            </div>
          )}
        </section>
      )}

      {/* Date-wise Inventory Activity Modal */}
      {selectedItemActivity && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedItemActivity(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-content"
            style={{ maxWidth: 740 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ margin: 0, color: 'var(--primary-dark-green)' }}>
                  {t('Inventory Activity Ledger —', 'Inventory Activity Ledger —')} {translateItem(selectedItemActivity.itemName)}
                </h3>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                  {t('Unit:', 'Unit:')} <b>{translateUnit(selectedItemActivity.unit)}</b> &nbsp;|&nbsp;
                  {t('Current Stock:', 'Current Stock:')} <b>{selectedItemActivity.currentStock} {translateUnit(selectedItemActivity.unit)}</b> &nbsp;|&nbsp;
                  {t('Total Received:', 'Total Received:')} <b style={{ color: 'var(--green)' }}>+{selectedItemActivity.totalQuantityReceived}</b> &nbsp;|&nbsp;
                  {t('Total Dispatched:', 'Total Dispatched:')} <b style={{ color: 'var(--primary-dark-green)' }}>-{selectedItemActivity.totalQuantityDispatched}</b>
                </p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setSelectedItemActivity(null)}
                aria-label="Close activity popup"
              >
                ✕
              </button>
            </div>

            <div className="table-wrap" style={{ marginTop: 10, maxHeight: 380, overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('Date & Time', 'Date & Time')}</th>
                    <th>{t('Transaction Type', 'Transaction Type')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Quantity', 'Quantity')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Balance After', 'Balance After')}</th>
                    <th>{t('Reference / By', 'Reference / By')}</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedItemActivity.activity && selectedItemActivity.activity.length > 0 ? (
                    selectedItemActivity.activity.map(tx => {
                      const isReceipt = (tx.type || '').toUpperCase() === 'RECEIPT';
                      const isDeficit = (tx.type || '').toUpperCase() === 'DISPATCH_DEFICIT_ADJUSTMENT';
                      return (
                        <tr key={tx.id}>
                          <td>
                            {tx.transactionDate
                              ? formatDisplayDateTime(tx.transactionDate)
                              : '—'}
                          </td>
                          <td>
                            {isReceipt ? (
                              <span className="badge badge-completed">{t('↓ Goods Receipt', '↓ Goods Receipt')}</span>
                            ) : isDeficit ? (
                              <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
                                ⚠️ {t('Stock Deficit', 'Stock Deficit')}
                              </span>
                            ) : (
                              <span className="badge badge-ordered">{t('↑ Branch Dispatch', '↑ Branch Dispatch')}</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 700, color: isReceipt ? 'var(--green)' : (isDeficit ? '#b91c1c' : 'var(--primary-dark-green)') }}>
                              {isReceipt ? '+' : '-'}{tx.quantity} {translateUnit(selectedItemActivity.unit)}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 700, color: tx.balanceAfter < 0 ? '#b91c1c' : 'inherit' }}>
                              {tx.balanceAfter} {translateUnit(selectedItemActivity.unit)}
                            </span>
                          </td>
                          <td>
                            <span className="muted" style={{ fontSize: 12 }}>
                              {tx.referenceType || 'TX'} {tx.performedBy ? `(${tx.performedBy})` : ''}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="empty">{t('No inventory transactions logged yet.', 'No inventory transactions logged yet.')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              {selectedItemActivity.activity && selectedItemActivity.activity.length > 0 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    const data = selectedItemActivity.activity.map(tx => ({
                      'Date & Time': tx.transactionDate ? tx.transactionDate.replace('T', ' ').slice(0, 16) : '',
                      'Type': tx.type,
                      'Quantity': tx.quantity,
                      'Unit': selectedItemActivity.unit,
                      'Balance After': tx.balanceAfter,
                      'Reference': tx.referenceType || '',
                      'Performed By': tx.performedBy || ''
                    }));
                    downloadCsv(`inventory_activity_${selectedItemActivity.itemName.toLowerCase()}`, data);
                  }}
                >
                  {t('⬇ Export Activity CSV', '⬇ Export Activity CSV')}
                </button>
              )}
              <button
                type="button"
                className="primary"
                onClick={() => setSelectedItemActivity(null)}
              >
                {t('Close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW ORDER POPUP MODAL (Available across Order and Reports tabs) */}
      {viewOrderModal && (() => {
        const { dateStr, timeStr } = parseOrderDateTime(viewOrderModal.createdAt, viewOrderModal.orderDate);
        return (
          <div className="modal-overlay" onClick={() => setViewOrderModal(null)}>
            <div className="modal-content order-modal-dialog" onClick={e => e.stopPropagation()}>
              <div className="order-modal-header">
                <div>
                  <h3>{viewOrderModal.orderNumber}</h3>
                  <p className="order-modal-subtitle">
                    {t('Order Created:', 'Order Created:')} <b>{formatDisplayDate(dateStr)}</b>{timeStr !== '—' && <> {t('at', 'at')} <b>{timeStr}</b></>}
                  </p>
                </div>
                <button
                  type="button"
                  className="close-btn"
                  onClick={() => setViewOrderModal(null)}
                  aria-label="Close popup"
                >
                  ✕
                </button>
              </div>

              <div className="order-modal-body">
                <table className="three-col-order-table">
                  <thead>
                    <tr>
                      <th>{t('Item Name', 'Item Name')}</th>
                      <th style={{ textAlign: 'center' }}>{t('Unit', 'Unit')}</th>
                      <th style={{ textAlign: 'right' }}>{t('Ordered Quantity', 'Ordered Quantity')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewOrderModal.lines && viewOrderModal.lines.length > 0 ? (
                      viewOrderModal.lines.map((line, idx) => {
                        const name = line.itemName || line.item || '—';
                        const unit = line.unit || '—';
                        const qty = line.quantity ?? line.orderQuantity ?? 0;
                        return (
                          <tr key={idx}>
                            <td><b>{translateItem(name)}</b></td>
                            <td style={{ textAlign: 'center' }}>{translateUnit(unit)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <span style={{ fontWeight: 600 }}>{qty}</span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="3" className="empty">{t('No item lines found in this order.', 'No item lines found in this order.')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="order-modal-footer">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleDownloadPdf(viewOrderModal)}
                >
                  {t('Download PDF', 'Download PDF')}
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => setViewOrderModal(null)}
                >
                  {t('Close', 'Close')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* REQUEST HISTORY MODAL */}
      {historyModalItem && (
        <div className="modal-overlay" onClick={() => setHistoryModalItem(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: 680, width: '92%' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0 }}>{t('Request History —', 'Request History —')} {translateItem(historyModalItem.item)}</h3>
                  {historyModalItem.category && (
                    <span className="category-badge">{translateCategory(historyModalItem.category)}</span>
                  )}
                </div>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                  {t('Branch:', 'Branch:')} <b>{selectedBranch}</b> • {t('Date:', 'Date:')} <b>{formatDisplayDate(historyModalItem.formattedDate || historyModalItem.requestDate)}</b>
                </p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setHistoryModalItem(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 14, fontSize: 13 }}>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                {t('Showing individual request entries combined into the', 'Showing individual request entries combined into the')} <b>{historyModalItem.totalRequestedQuantity} {translateUnit(historyModalItem.unit)}</b> {t('summary row:', 'summary row:')}
              </p>
            </div>

            <div className="table-wrap" style={{ margin: '0 0 16px' }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('Request Date', 'Request Date')}</th>
                    <th>{t('Request Time', 'Request Time')}</th>
                    <th>{t('Category', 'Category')}</th>
                    <th>{t('Item Name', 'Item Name')}</th>
                    <th>{t('Unit', 'Unit')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Requested Quantity', 'Requested Quantity')}</th>
                  </tr>
                </thead>
                <tbody>
                  {historyModalItem.history && historyModalItem.history.length > 0 ? (
                    historyModalItem.history.map((h, idx) => (
                      <tr key={h.id || idx}>
                        <td>{formatDisplayDate(h.formattedDate || h.requestDate)}</td>
                        <td>
                          {h.requestTime === 'Time Unavailable' ? (
                            <span className="muted" style={{ fontStyle: 'italic', fontSize: 12 }}>{t('Time Unavailable', 'Time Unavailable')}</span>
                          ) : (
                            <b>{h.requestTime}</b>
                          )}
                        </td>
                        <td>
                          {h.category ? (
                            <span className="category-badge">{translateCategory(h.category)}</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td><b>{translateItem(h.item)}</b></td>
                        <td>{translateUnit(h.unit)}</td>
                        <td style={{ textAlign: 'right' }}><b>{h.requested}</b></td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="empty">{t('No individual request entries found.', 'No individual request entries found.')}</td>
                    </tr>
                  )}
                </tbody>
                {historyModalItem.history && historyModalItem.history.length > 1 && (
                  <tfoot>
                    <tr style={{ background: 'var(--cream-surface)', fontWeight: 700 }}>
                      <td colSpan="5">{t('Total Combined Requested Quantity', 'Total Combined Requested Quantity')}</td>
                      <td style={{ textAlign: 'right', color: 'var(--green)' }}>
                        {historyModalItem.totalRequestedQuantity} {translateUnit(historyModalItem.unit)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                <span>{t('Delivery Status', 'Delivery Status')}: </span>
                <span className={`badge ${
                  historyModalItem.deliveryStatus === 'COMPLETED' ? 'badge-completed' :
                  historyModalItem.deliveryStatus === 'PARTIALLY_DELIVERED' ? 'badge-ordered' :
                  'badge-pending'
                }`}>
                  {translateStatus(historyModalItem.deliveryStatusLabel || historyModalItem.deliveryStatus)}
                </span>
                <span style={{ marginLeft: 12 }}>
                  {t('Dispatched:', 'Dispatched:')} <b>{historyModalItem.alreadyDispatchedQuantity}</b> | {t('Confirmed Received:', 'Confirmed Received:')} <b>{historyModalItem.confirmedReceivedQuantity}</b>
                </span>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => setHistoryModalItem(null)}
              >
                {t('Close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
