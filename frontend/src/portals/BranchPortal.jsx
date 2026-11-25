import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Alert } from '../components/Alert';
import DateFilterBar, { DateSectionHeader, EmptyDateMessage } from '../components/DateFilterBar';
import { useAddItemShortcut } from '../utils/useAddItemShortcut';
import { useLanguage } from '../i18n/LanguageContext';
import {
  downloadBranchOrderListPdf,
  printBranchOrderListDirect,
  downloadBranchRecentRequestsPdf,
  printBranchRecentRequestsDirect
} from '../utils/pdfGenerator';
import {
  getTodayDateString,
  toLocalDateString,
  formatDateLabel,
  formatDateTime,
  groupByDate
} from '../utils/dateGrouping';

export const BRANCH_ORDER_CATEGORIES = [
  'General',
  'Vegetables',
  'Groceries',
  'Tea/Coffee',
  'Vada Stall',
  'Sweet/Savouries',
  'Dosa Kal',
  'Chinese',
  'Idly',
  'Front Office',
  'Parcel',
  'Dishwasher'
];

export function BranchPortal({ user, activeTab, onSelectTab }) {
  const { language, t, translateItem, translateUnit, translateStatus, translateRole, translateCategory } = useLanguage();

  const formatDisplayDateTime = (dt) => {
    if (!dt) return '-';
    return formatDateTime(dt, language);
  };

  // Alerts
  const [alert, setAlert] = useState(null);
  const showAlert = (type, message) => setAlert({ type, message });

  // Common data
  const [catalogueItems, setCatalogueItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. Order Items states (Department-first workflow)
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);
  const deptSelectRef = useRef(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const categorySelectRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemUnit, setItemUnit] = useState('');
  const [requestedQty, setRequestedQty] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const [orderItemsList, setOrderItemsList] = useState([]);
  const [submittingBranchOrder, setSubmittingBranchOrder] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmOrderError, setConfirmOrderError] = useState('');

  // Add New Item Modal states
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('KG');
  const [newItemCustomUnit, setNewItemCustomUnit] = useState('');
  const [newItemError, setNewItemError] = useState('');
  const [savingNewItem, setSavingNewItem] = useState(false);

  // Refs for keyboard focus and outside click handling
  const itemInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const dropdownRef = useRef(null);
  const sendOrderBtnRef = useRef(null);
  const confirmBtnRef = useRef(null);
  const cancelConfirmBtnRef = useRef(null);
  const modalItemInputRef = useRef(null);
  const modalUnitSelectRef = useRef(null);
  const modalCustomUnitRef = useRef(null);

  const [myRequests, setMyRequests] = useState([]);
  const [requestFilterDate, setRequestFilterDate] = useState(getTodayDateString());
  const [requestFromDate, setRequestFromDate] = useState(getTodayDateString());
  const [requestToDate, setRequestToDate] = useState(getTodayDateString());
  const [requestIsAllDates, setRequestIsAllDates] = useState(false);

  // 2. Entry states (Deliveries & Physical Acknowledgement)
  const [deliveries, setDeliveries] = useState([]);
  const [deliveryDate, setDeliveryDate] = useState(getTodayDateString());
  const [deliveryIsAllDates, setDeliveryIsAllDates] = useState(false);

  // Acknowledgement with Shortage Modal states
  const [showAckModal, setShowAckModal] = useState(false);
  const [ackModalItem, setAckModalItem] = useState(null);
  const [actualReceivedQty, setActualReceivedQty] = useState('');
  const [ackRemarks, setAckRemarks] = useState('');
  const [ackError, setAckError] = useState('');
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);
  const ackQtyInputRef = useRef(null);

  // Return modal state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnModalItem, setReturnModalItem] = useState(null);
  const [returnQty, setReturnQty] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnError, setReturnError] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const returnQtyInputRef = useRef(null);

  // 3. History states (Confirmed received history)
  const [receivedHistory, setReceivedHistory] = useState([]);
  const [historyDate, setHistoryDate] = useState(getTodayDateString());
  const [historyIsAllDates, setHistoryIsAllDates] = useState(false);
  const [historyFromDate, setHistoryFromDate] = useState('');
  const [historyToDate, setHistoryToDate] = useState('');
  const [historySearch, setHistorySearch] = useState('');

  const [downloadingOrderPdf, setDownloadingOrderPdf] = useState(false);
  const [downloadingRecentPdf, setDownloadingRecentPdf] = useState(false);
  const [directPrintingOrder, setDirectPrintingOrder] = useState(false);
  const [directPrintingRecent, setDirectPrintingRecent] = useState(false);

  // Download Order List PDF (Section A ONLY)
  const handleDownloadOrderListPdf = async () => {
    if (orderItemsList.length === 0) {
      showAlert('error', language === 'ta'
        ? 'பதிவிறக்க ஆர்டர் பட்டியலில் பொருட்கள் எதுவும் இல்லை.'
        : 'No items in order list to generate PDF.');
      return;
    }

    try {
      setDownloadingOrderPdf(true);
      const todayStr = getTodayDateString();

      await downloadBranchOrderListPdf({
        organisationName: user?.organisationName || 'Saravana Bhavan',
        branchName: user?.branchName || 'Branch 1',
        branchManager: user?.fullName ? `${user.fullName} (${user.username})` : (user?.username || 'Branch Manager'),
        date: todayStr,
        items: orderItemsList,
        isDraft: false,
        language
      });

      showAlert('success', language === 'ta'
        ? '✓ கிளை ஆர்டர் பட்டியல் PDF வெற்றிகரமாக பதிவிறக்கப்பட்டது!'
        : '✓ Branch Order PDF downloaded successfully!');
    } catch (err) {
      console.error('Error generating Order PDF', err);
      showAlert('error', err.message || (language === 'ta' ? 'PDF உருவாக்குவதில் பிழை' : 'Failed to generate Order PDF'));
    } finally {
      setDownloadingOrderPdf(false);
    }
  };

  // Direct Print Order List (Section A ONLY)
  const handleDirectPrintOrderList = async () => {
    if (orderItemsList.length === 0) {
      showAlert('error', language === 'ta'
        ? 'அச்சிட ஆர்டர் பட்டியலில் பொருட்கள் எதுவும் இல்லை.'
        : 'No items in order list to print.');
      return;
    }

    try {
      setDirectPrintingOrder(true);
      const todayStr = getTodayDateString();

      await printBranchOrderListDirect({
        organisationName: user?.organisationName || 'Saravana Bhavan',
        branchName: user?.branchName || 'Branch 1',
        branchManager: user?.fullName ? `${user.fullName} (${user.username})` : (user?.username || 'Branch Manager'),
        date: todayStr,
        items: orderItemsList,
        isDraft: false,
        language
      });
    } catch (err) {
      console.error('Error directly printing Order list', err);
      showAlert('error', err.message || (language === 'ta' ? 'அச்சிடுவதில் பிழை' : 'Failed to print Order list'));
    } finally {
      setDirectPrintingOrder(false);
    }
  };

  // Download Recent Requests PDF (Section B ONLY)
  const handleDownloadRecentRequestsPdf = async () => {
    try {
      setDownloadingRecentPdf(true);

      // Fetch fresh matching branch requests using the currently selected date filter (Today or Custom Range)
      let branchRequests = [];
      try {
        const fetched = await api.getMyBranchRequests(null, requestFromDate, requestToDate);
        if (Array.isArray(fetched)) {
          branchRequests = fetched;
        }
      } catch (err) {
        console.warn('Could not re-fetch branch requests for PDF, using state', err);
        branchRequests = myRequests;
      }

      // Filter matching current branch and current date filter
      const bName = (user?.branchName || '').trim().toLowerCase();
      const bId = user?.branchId;

      const filteredRecent = (branchRequests || []).filter(r => {
        // Enforce branch isolation (do not include records from other branches)
        const reqBranch = (r.branch || '').trim().toLowerCase();
        if (bName && reqBranch && reqBranch !== bName) {
          if (!bId || !r.branchId || r.branchId !== bId) return false;
        }

        // Apply date filter: Today or Custom Range
        const d = toLocalDateString(r.requestDate || r.createdAt);
        if (!d) return false;
        if (requestFromDate && d < requestFromDate) return false;
        if (requestToDate && d > requestToDate) return false;
        return true;
      }).sort((a, b) => {
        const tA = new Date(a.createdAt || a.requestDate || 0).getTime();
        const tB = new Date(b.createdAt || b.requestDate || 0).getTime();
        return tB - tA;
      });

      if (filteredRecent.length === 0) {
        showAlert('error', language === 'ta'
          ? 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டிக்கு சமீபத்திய கோரிக்கைகள் எதுவும் இல்லை.'
          : 'No recent requests available for the selected date filter.');
        return;
      }

      const todayStr = getTodayDateString();
      let dateFilterLabel = '';
      if (requestFromDate === todayStr && requestToDate === todayStr) {
        dateFilterLabel = language === 'ta' ? `இன்று (${todayStr})` : `Today (${todayStr})`;
      } else {
        dateFilterLabel = `${requestFromDate} to ${requestToDate}`;
      }

      await downloadBranchRecentRequestsPdf({
        organisationName: user?.organisationName || 'Saravana Bhavan',
        branchName: user?.branchName || 'Branch 1',
        branchManager: user?.fullName ? `${user.fullName} (${user.username})` : (user?.username || 'Branch Manager'),
        date: todayStr,
        recentRequests: filteredRecent,
        dateFilterLabel,
        language
      });

      showAlert('success', language === 'ta'
        ? '✓ சமீபத்திய கோரிக்கைகள் PDF வெற்றிகரமாக பதிவிறக்கப்பட்டது!'
        : '✓ Recent Requests PDF downloaded successfully!');
    } catch (err) {
      console.error('Error generating Recent Requests PDF', err);
      showAlert('error', err.message || (language === 'ta' ? 'PDF உருவாக்குவதில் பிழை' : 'Failed to generate Recent Requests PDF'));
    } finally {
      setDownloadingRecentPdf(false);
    }
  };

  // Direct Print Recent Requests (Section B ONLY)
  const handleDirectPrintRecentRequests = async () => {
    try {
      setDirectPrintingRecent(true);

      let branchRequests = [];
      try {
        const fetched = await api.getMyBranchRequests(null, requestFromDate, requestToDate);
        if (Array.isArray(fetched)) {
          branchRequests = fetched;
        }
      } catch (err) {
        console.warn('Could not re-fetch branch requests for Print, using state', err);
        branchRequests = myRequests;
      }

      const bName = (user?.branchName || '').trim().toLowerCase();
      const bId = user?.branchId;

      const filteredRecent = (branchRequests || []).filter(r => {
        const reqBranch = (r.branch || '').trim().toLowerCase();
        if (bName && reqBranch && reqBranch !== bName) {
          if (!bId || !r.branchId || r.branchId !== bId) return false;
        }

        const d = toLocalDateString(r.requestDate || r.createdAt);
        if (!d) return false;
        if (requestFromDate && d < requestFromDate) return false;
        if (requestToDate && d > requestToDate) return false;
        return true;
      }).sort((a, b) => {
        const tA = new Date(a.createdAt || a.requestDate || 0).getTime();
        const tB = new Date(b.createdAt || b.requestDate || 0).getTime();
        return tB - tA;
      });

      if (filteredRecent.length === 0) {
        showAlert('error', language === 'ta'
          ? 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டிக்கு சமீபத்திய கோரிக்கைகள் எதுவும் இல்லை.'
          : 'No recent requests available for the selected date filter.');
        return;
      }

      const todayStr = getTodayDateString();
      let dateFilterLabel = '';
      if (requestFromDate === todayStr && requestToDate === todayStr) {
        dateFilterLabel = language === 'ta' ? `இன்று (${todayStr})` : `Today (${todayStr})`;
      } else {
        dateFilterLabel = `${requestFromDate} to ${requestToDate}`;
      }

      await printBranchRecentRequestsDirect({
        organisationName: user?.organisationName || 'Saravana Bhavan',
        branchName: user?.branchName || 'Branch 1',
        branchManager: user?.fullName ? `${user.fullName} (${user.username})` : (user?.username || 'Branch Manager'),
        date: todayStr,
        recentRequests: filteredRecent,
        dateFilterLabel,
        language
      });
    } catch (err) {
      console.error('Error directly printing Recent Requests', err);
      showAlert('error', err.message || (language === 'ta' ? 'அச்சிடுவதில் பிழை' : 'Failed to print Recent Requests'));
    } finally {
      setDirectPrintingRecent(false);
    }
  };

  // Load departments from database/configuration
  const loadDepartments = async () => {
    try {
      setDepartmentsLoading(true);
      const data = await api.getDepartments();
      if (Array.isArray(data) && data.length > 0) {
        setAvailableDepartments(data);
      } else {
        setAvailableDepartments(BRANCH_ORDER_CATEGORIES.map(name => ({ id: name, name })));
      }
    } catch (err) {
      console.error('Failed to load departments', err);
      setAvailableDepartments(BRANCH_ORDER_CATEGORIES.map(name => ({ id: name, name })));
    } finally {
      setDepartmentsLoading(false);
    }
  };

  // Department change applies to the item currently being added
  const handleDepartmentSelectChange = (newDept) => {
    setSelectedDepartment(newDept);
    if (newDept) {
      setTimeout(() => {
        itemInputRef.current?.focus();
      }, 50);
    }
  };

  // Update department of an individual item already in the order list
  const handleUpdateOrderItemDepartment = (id, newDept) => {
    if (!newDept) return;
    const selectedDeptObj = availableDepartments.find(d => {
      const name = typeof d === 'string' ? d : d.name;
      return name && name.toLowerCase() === newDept.toLowerCase();
    });
    const resolvedDeptId = (selectedDeptObj && typeof selectedDeptObj === 'object' && selectedDeptObj.id && !isNaN(Number(selectedDeptObj.id)))
      ? Number(selectedDeptObj.id)
      : null;

    setOrderItemsList(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          departmentId: resolvedDeptId,
          departmentName: newDept,
          department: newDept,
          category: newDept
        };
      }
      return item;
    }));
  };

  // Load items catalogue
  const loadCatalogue = async () => {
    try {
      const items = await api.getItems();
      if (Array.isArray(items)) {
        setCatalogueItems(items);
        if (activeTab === 'order-items' && !showConfirmModal && !showNewItemModal) {
          setTimeout(() => {
            const activeEl = document.activeElement;
            if (!activeEl || activeEl === document.body) {
              itemInputRef.current?.focus();
            }
          }, 50);
        }
      }
    } catch (err) {
      console.error('Error loading catalogue', err);
    }
  };

  // Load branch's own requests
  const loadMyRequests = async (fromDate = requestFromDate, toDate = requestToDate) => {
    try {
      const reqs = await api.getMyBranchRequests(null, fromDate, toDate);
      if (Array.isArray(reqs)) setMyRequests(reqs);
    } catch (err) {
      console.error('Error loading branch requests', err);
    }
  };

  // Load branch's deliveries (Entry)
  const loadDeliveries = async (date = deliveryDate, isAll = deliveryIsAllDates) => {
    try {
      setLoading(true);
      const queryDate = isAll ? '' : date;
      const data = await api.getMyBranchDeliveries(queryDate);
      if (Array.isArray(data)) setDeliveries(data);
    } catch (err) {
      showAlert('error', err.message || 'Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  };

  // Load branch's received history (grouped by acknowledgement date)
  const loadReceivedHistory = async () => {
    try {
      setLoading(true);
      const queryDate = (historyIsAllDates || historyFromDate || historyToDate) ? '' : historyDate;
      const data = await api.getMyBranchReceivedHistory(queryDate, historySearch, historyFromDate, historyToDate);
      if (Array.isArray(data)) setReceivedHistory(data);
    } catch (err) {
      showAlert('error', err.message || 'Failed to load received history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogue();
    loadDepartments();
  }, []);

  useEffect(() => {
    if (activeTab === 'order-items') {
      loadCatalogue();
      loadDepartments();
      loadMyRequests(requestFromDate, requestToDate);
    } else if (activeTab === 'entry') {
      loadDeliveries(deliveryDate, deliveryIsAllDates);
    } else if (activeTab === 'history') {
      loadReceivedHistory();
    }
  }, [activeTab, requestFromDate, requestToDate, deliveryDate, deliveryIsAllDates, historyDate, historyIsAllDates, historyFromDate, historyToDate]);

  // 1. Auto-focus Department (if not selected) or Item Name whenever Order Items tab is opened or active
  useEffect(() => {
    if (activeTab === 'order-items') {
      const focusInitialInput = () => {
        if (!showConfirmModal && !showNewItemModal) {
          const activeEl = document.activeElement;
          // Do not steal focus if user is already focused on an input inside the page
          if (activeEl !== itemInputRef.current && activeEl !== qtyInputRef.current && activeEl !== deptSelectRef.current) {
            if (!selectedDepartment) {
              deptSelectRef.current?.focus();
            } else {
              itemInputRef.current?.focus();
            }
          }
        }
      };

      const raf = requestAnimationFrame(focusInitialInput);
      const timer = setTimeout(focusInitialInput, 50);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
  }, [activeTab, selectedDepartment]);

  // Focus confirmation modal when opened
  useEffect(() => {
    if (showConfirmModal) {
      const timer = setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showConfirmModal]);

  // Focus new item modal when opened
  useEffect(() => {
    if (showNewItemModal) {
      const timer = setTimeout(() => {
        modalItemInputRef.current?.focus();
        modalItemInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [showNewItemModal]);

  // Shared reusable keyboard shortcut: F5 opens Add New Item modal ONLY when on Branch Manager Order Items tab
  useAddItemShortcut({
    onAddItem: () => {
      handleOpenNewItemModal(searchQuery);
    },
    isEnabled: activeTab === 'order-items',
    isModalOpen: showNewItemModal
  });

  // Handle outside clicks to close autocomplete dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter catalogue suggestions based on user input
  const queryTrimmed = searchQuery.trim().toLowerCase();
  const filteredSuggestions = queryTrimmed
    ? catalogueItems.filter(it => it.name && it.name.toLowerCase().includes(queryTrimmed))
    : catalogueItems.slice(0, 8);

  // Select suggestion from dropdown
  const handleSelectSuggestion = (item) => {
    setSelectedItem(item);
    setSearchQuery(item.name);
    setItemUnit(item.unit || 'KG');
    setShowSuggestions(false);
    setHighlightedIndex(0);
    // Smoothly focus requested quantity input so user can enter quantity immediately
    setTimeout(() => {
      qtyInputRef.current?.focus();
    }, 40);
  };

  // Open modal to add genuinely new catalogue item
  const handleOpenNewItemModal = (initialName = '') => {
    const prefill = typeof initialName === 'string' && initialName.trim() ? initialName.trim() : searchQuery.trim();
    setNewItemName(prefill);
    setNewItemUnit('KG');
    setNewItemCustomUnit('');
    setNewItemError('');
    setShowNewItemModal(true);
    setShowSuggestions(false);
  };

  const handleCloseNewItemModal = () => {
    if (savingNewItem) return;
    setShowNewItemModal(false);
    setNewItemError('');
    // Return focus automatically to the Item Name input
    setTimeout(() => {
      itemInputRef.current?.focus();
    }, 40);
  };

  // Save new item to catalogue through Spring Boot backend
  const handleSaveNewItem = async (e) => {
    if (e) e.preventDefault();
    if (savingNewItem) return;
    setNewItemError('');

    const trimmedName = (newItemName || '').trim();
    const effectiveUnit = (newItemUnit === '__CUSTOM__' ? newItemCustomUnit : newItemUnit).trim();

    if (!trimmedName) {
      setNewItemError('Item name is required.');
      modalItemInputRef.current?.focus();
      return;
    }
    if (!effectiveUnit) {
      setNewItemError('Unit is required (e.g. KG, L, Pieces).');
      if (newItemUnit === '__CUSTOM__') {
        modalCustomUnitRef.current?.focus();
      } else {
        modalUnitSelectRef.current?.focus();
      }
      return;
    }

    // Client-side duplicate check (ignoring case and unnecessary whitespace)
    const duplicate = catalogueItems.find(
      it => it.name && it.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setNewItemError(`Item "${trimmedName}" already exists in the catalogue with unit "${duplicate.unit}".`);
      modalItemInputRef.current?.focus();
      return;
    }

    try {
      setSavingNewItem(true);
      const created = await api.createItem({
        name: trimmedName,
        unit: effectiveUnit.toUpperCase()
      });

      showAlert('success', `✓ New catalogue item "${created.name}" created successfully and selected.`);

      // Reload catalogue
      const items = await api.getItems();
      if (Array.isArray(items)) setCatalogueItems(items);

      // Immediately select newly created item in order form
      setSelectedItem(created);
      setSearchQuery(created.name);
      setItemUnit(created.unit || effectiveUnit.toUpperCase());
      setShowNewItemModal(false);

      // Smoothly focus requested quantity input
      setTimeout(() => {
        qtyInputRef.current?.focus();
      }, 40);
    } catch (err) {
      setNewItemError(err.message || 'Failed to save item to catalogue.');
    } finally {
      setSavingNewItem(false);
    }
  };

  // Keyboard navigation inside Item Name input
  const handleItemInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      if (!showSuggestions) {
        setShowSuggestions(true);
        return;
      }
      e.preventDefault();
      const maxIdx = filteredSuggestions.length - 1;
      setHighlightedIndex(prev => (prev < maxIdx ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      if (!showSuggestions) {
        setShowSuggestions(true);
        return;
      }
      e.preventDefault();
      const maxIdx = filteredSuggestions.length - 1;
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : maxIdx));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && filteredSuggestions.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
        handleSelectSuggestion(filteredSuggestions[highlightedIndex]);
      } else if (filteredSuggestions.length === 0 && searchQuery.trim()) {
        handleOpenNewItemModal(searchQuery);
      } else if (selectedItem || searchQuery.trim()) {
        qtyInputRef.current?.focus();
      }
    } else if (e.key === 'Tab') {
      if (showSuggestions && filteredSuggestions.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(filteredSuggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Add Item to Order List (requires selectedDepartment first)
  const handleAddItemToOrderList = () => {
    if (!selectedDepartment) {
      showAlert('error', language === 'ta' ? 'தயவுசெய்து முதலில் ஆர்டர் செய்யும் துறையைத் தேர்ந்தெடுக்கவும்.' : 'Please select an Ordering Department above before adding items.');
      deptSelectRef.current?.focus();
      return;
    }

    const finalName = searchQuery.trim();
    if (!finalName) {
      showAlert('error', 'Please enter or select an Item Name');
      itemInputRef.current?.focus();
      return;
    }

    const q = parseFloat(requestedQty);
    if (isNaN(q) || q <= 0) {
      showAlert('error', 'Requested Quantity must be a positive number greater than 0');
      qtyInputRef.current?.focus();
      return;
    }

    // Determine unit
    let finalUnit = (itemUnit || '').trim().toUpperCase();
    const matched = catalogueItems.find(it => it.name && it.name.toLowerCase() === finalName.toLowerCase());
    if (!finalUnit) {
      if (matched && matched.unit) {
        finalUnit = matched.unit.toUpperCase();
      } else {
        finalUnit = 'KG';
      }
    }

    const selectedDeptObj = availableDepartments.find(d => {
      const name = typeof d === 'string' ? d : d.name;
      return name && name.toLowerCase() === selectedDepartment.toLowerCase();
    });
    const resolvedDeptId = (selectedDeptObj && typeof selectedDeptObj === 'object' && selectedDeptObj.id && !isNaN(Number(selectedDeptObj.id)))
      ? Number(selectedDeptObj.id)
      : null;
    const resolvedDeptName = (selectedDeptObj && typeof selectedDeptObj === 'object' && selectedDeptObj.name)
      ? selectedDeptObj.name
      : selectedDepartment;
    const resolvedItemId = selectedItem?.id || (matched && matched.id ? matched.id : null);

    // Prevent duplicate item lines for the SAME item in the SAME department
    const existingIndex = orderItemsList.findIndex(
      x => x.itemName.trim().toLowerCase() === finalName.toLowerCase() &&
           (x.department || x.departmentName || x.category || '').trim().toLowerCase() === selectedDepartment.trim().toLowerCase()
    );
    if (existingIndex >= 0) {
      const existing = orderItemsList[existingIndex];
      const updatedQty = Math.round((Number(existing.requestedQuantity) + q) * 1000) / 1000;
      showAlert('warning', `"${finalName}" for department "${resolvedDeptName}" is already in your request list. Updated its quantity to ${updatedQty}. You can edit it directly in the table.`);
      setOrderItemsList(prev => prev.map((item, idx) => {
        if (idx === existingIndex) {
          return {
            ...item,
            requestedQuantity: updatedQty,
            departmentId: resolvedDeptId,
            departmentName: resolvedDeptName,
            department: resolvedDeptName,
            category: resolvedDeptName
          };
        }
        return item;
      }));

      // Clear entry fields and return focus automatically to Item Name input
      setSearchQuery('');
      setSelectedItem(null);
      setItemUnit('');
      setRequestedQty('');
      setShowSuggestions(false);
      setTimeout(() => itemInputRef.current?.focus(), 40);
      return;
    }

    // Add new row to orderItemsList with individual department details
    setOrderItemsList(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        itemId: resolvedItemId,
        itemName: finalName,
        departmentId: resolvedDeptId,
        departmentName: resolvedDeptName,
        department: resolvedDeptName,
        category: resolvedDeptName,
        unit: finalUnit,
        requestedQuantity: q,
        isNewItem: !selectedItem && !matched
      }
    ]);

    showAlert('success', `✓ Added ${q} ${finalUnit} of "${finalName}" (${translateCategory(resolvedDeptName)}) to request list.`);

    // Clear entry fields and return focus automatically to Item Name input ready for next item
    setSearchQuery('');
    setSelectedItem(null);
    setItemUnit('');
    setRequestedQty('');
    setShowSuggestions(false);
    setTimeout(() => {
      itemInputRef.current?.focus();
    }, 40);
  };

  const handleRemoveOrderItem = (id) => {
    setOrderItemsList(prev => prev.filter(x => x.id !== id));
  };

  const handleUpdateOrderItemQty = (id, newQty) => {
    const val = parseFloat(newQty);
    setOrderItemsList(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, requestedQuantity: isNaN(val) ? 0 : val };
      }
      return item;
    }));
  };

  // Open Confirm Order modal
  const handleOpenConfirmModal = () => {
    if (orderItemsList.length === 0) {
      showAlert('error', 'Please add at least one item to your request before sending.');
      return;
    }

    setConfirmOrderError('');

    for (const it of orderItemsList) {
      const q = parseFloat(it.requestedQuantity);
      if (isNaN(q) || q <= 0) {
        showAlert('error', `Requested quantity for "${it.itemName}" must be a positive number greater than 0.`);
        return;
      }
      if (!it.itemName || !it.itemName.trim()) {
        showAlert('error', 'Item name cannot be blank.');
        return;
      }
      if (!it.unit || !it.unit.trim()) {
        showAlert('error', `Unit cannot be blank for "${it.itemName}".`);
        return;
      }
      const itemDept = (it.department || it.departmentName || it.category || '').trim();
      if (!itemDept) {
        showAlert('error', `Department is missing for "${it.itemName}". Please select a department.`);
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const handleCancelConfirmModal = () => {
    if (submittingBranchOrder) return;
    setShowConfirmModal(false);
    setConfirmOrderError('');
    // Return focus to Send Order button or previous control
    setTimeout(() => {
      sendOrderBtnRef.current?.focus();
    }, 40);
  };

  // Submit Multi-Item Request via Confirm Order modal
  const handleConfirmSendOrder = async () => {
    if (submittingBranchOrder) return;
    if (orderItemsList.length === 0) {
      setShowConfirmModal(false);
      return;
    }

    setConfirmOrderError('');

    try {
      setSubmittingBranchOrder(true);
      const defaultDept = selectedDepartment || orderItemsList[0]?.department || orderItemsList[0]?.category || 'General';
      const payloadItems = orderItemsList.map(it => {
        const itemDept = (it.department || it.departmentName || it.category || defaultDept).trim();
        const selectedDeptObj = availableDepartments.find(d => {
          const name = typeof d === 'string' ? d : d.name;
          return name && name.toLowerCase() === itemDept.toLowerCase();
        });
        const resolvedDeptId = it.departmentId || ((selectedDeptObj && typeof selectedDeptObj === 'object' && selectedDeptObj.id && !isNaN(Number(selectedDeptObj.id))) ? Number(selectedDeptObj.id) : null);
        return {
          itemId: it.itemId || null,
          itemName: it.itemName.trim(),
          departmentId: resolvedDeptId,
          departmentName: itemDept,
          department: itemDept,
          category: itemDept,
          unit: (it.unit || 'KG').trim().toUpperCase(),
          requestedQuantity: parseFloat(it.requestedQuantity),
          isNewItem: Boolean(it.isNewItem)
        };
      });

      await api.submitBranchRequest(payloadItems, defaultDept);

      showAlert('success', `✓ Your request with ${orderItemsList.length} distinct item line(s) was sent to the Store Manager successfully!`);
      setOrderItemsList([]);
      setShowConfirmModal(false);
      await loadMyRequests();
      // Return focus automatically to the Item Name input for entering the next order
      setTimeout(() => {
        itemInputRef.current?.focus();
      }, 50);
    } catch (err) {
      console.error('Failed to submit branch request', err);
      // Keep modal open and display the actual backend validation message in the UI
      setConfirmOrderError(err.message || 'Failed to submit request.');
      showAlert('error', err.message || 'Failed to submit request.');
    } finally {
      setSubmittingBranchOrder(false);
    }
  };

  // Acknowledgement with Shortage Modal Handlers
  const handleOpenAckModal = (item) => {
    setAckModalItem(item);
    setActualReceivedQty(String(item.quantity)); // Pre-fill with dispatched qty
    setAckRemarks('');
    setAckError('');
    setShowAckModal(true);
    setTimeout(() => {
      ackQtyInputRef.current?.focus();
      ackQtyInputRef.current?.select();
    }, 40);
  };

  const handleCloseAckModal = () => {
    if (isSubmittingAck) return;
    setShowAckModal(false);
    setAckModalItem(null);
    setActualReceivedQty('');
    setAckRemarks('');
    setAckError('');
  };

  const handleConfirmAck = async (e) => {
    if (e) e.preventDefault();
    if (!ackModalItem || isSubmittingAck) return;

    if (actualReceivedQty === '' || actualReceivedQty === null || actualReceivedQty === undefined) {
      setAckError(language === 'ta' ? 'தயவுசெய்து பெறப்பட்ட அளவை உள்ளிடவும்.' : 'Please enter actual received quantity.');
      ackQtyInputRef.current?.focus();
      return;
    }

    const rQty = parseFloat(actualReceivedQty);
    if (isNaN(rQty)) {
      setAckError(language === 'ta' ? 'செல்லுபடியாகும் எண்ணை உள்ளிடவும்.' : 'Please enter a valid number.');
      ackQtyInputRef.current?.focus();
      return;
    }
    if (rQty < 0) {
      setAckError(language === 'ta' ? 'பெறப்பட்ட அளவு எதிர்மறையாக (negative) இருக்க முடியாது.' : 'Actual received quantity cannot be negative.');
      ackQtyInputRef.current?.focus();
      return;
    }
    if (rQty > ackModalItem.quantity) {
      setAckError(language === 'ta'
        ? `பெறப்பட்ட அளவு (${rQty} ${translateUnit(ackModalItem.unit)}) அனுப்பப்பட்ட அளவை (${ackModalItem.quantity} ${translateUnit(ackModalItem.unit)}) விட அதிகமாக இருக்க முடியாது.`
        : `Actual received quantity (${rQty} ${ackModalItem.unit}) cannot exceed dispatched quantity (${ackModalItem.quantity} ${ackModalItem.unit}).`);
      ackQtyInputRef.current?.focus();
      return;
    }

    const shortage = ackModalItem.quantity - rQty;

    try {
      setIsSubmittingAck(true);
      setAckError('');
      await api.acknowledgeDelivery(ackModalItem.id, rQty, ackRemarks ? ackRemarks.trim() : '');

      let msg = '';
      if (shortage === 0) {
        msg = language === 'ta'
          ? `✓ ${translateItem(ackModalItem.itemName)}: ${rQty} ${translateUnit(ackModalItem.unit)} முழுமையாக பெறப்பட்டது என உறுதிசெய்யப்பட்டது.`
          : `✓ Successfully confirmed full receipt of ${rQty} ${translateUnit(ackModalItem.unit)} of "${ackModalItem.itemName}".`;
      } else if (rQty > 0) {
        msg = language === 'ta'
          ? `✓ ${translateItem(ackModalItem.itemName)}: பெறப்பட்டது: ${rQty} ${translateUnit(ackModalItem.unit)}, பற்றாக்குறை: ${shortage} ${translateUnit(ackModalItem.unit)}.`
          : `✓ Confirmed partial receipt: ${rQty} ${translateUnit(ackModalItem.unit)} received, shortage: ${shortage} ${translateUnit(ackModalItem.unit)}.`;
      } else {
        msg = language === 'ta'
          ? `✓ ${translateItem(ackModalItem.itemName)}: வரவு இல்லை (0 ${translateUnit(ackModalItem.unit)}). முழு பற்றாக்குறை: ${shortage} ${translateUnit(ackModalItem.unit)} பதிவு செய்யப்பட்டது.`
          : `✓ Recorded zero receipt: 0 ${translateUnit(ackModalItem.unit)} received, full shortage: ${shortage} ${translateUnit(ackModalItem.unit)}.`;
      }

      showAlert('success', msg);
      handleCloseAckModal();
      await loadDeliveries(deliveryDate, deliveryIsAllDates);
      if (activeTab === 'history') {
        await loadReceivedHistory();
      }
    } catch (err) {
      console.error('Failed to acknowledge delivery', err);
      setAckError(err.message || (language === 'ta' ? 'வரவை உறுதிசெய்வதில் பிழை' : 'Failed to confirm receipt'));
    } finally {
      setIsSubmittingAck(false);
    }
  };

  // Return Modal Handlers
  const handleOpenReturnModal = (item) => {
    setReturnModalItem(item);
    setReturnQty('');
    setReturnReason('');
    setReturnError('');
    setShowReturnModal(true);
    setTimeout(() => {
      returnQtyInputRef.current?.focus();
    }, 60);
  };

  const handleCloseReturnModal = () => {
    if (isSubmittingReturn) return;
    setShowReturnModal(false);
    setReturnModalItem(null);
    setReturnQty('');
    setReturnReason('');
    setReturnError('');
  };

  const handleConfirmReturn = async (e) => {
    if (e) e.preventDefault();
    if (!returnModalItem) return;
    if (isSubmittingReturn) return; // Prevent repeated double submission

    const qty = parseFloat(returnQty);
    const alreadyReturned = returnModalItem.returnedQuantity || 0;
    const available = returnModalItem.quantity - alreadyReturned;

    if (isNaN(qty) || qty <= 0) {
      setReturnError('Return quantity must be greater than zero.');
      returnQtyInputRef.current?.focus();
      return;
    }

    if (qty > available) {
      setReturnError(`Return quantity (${qty}) cannot exceed remaining returnable quantity (${available} ${returnModalItem.unit}). Total returned cannot exceed dispatched quantity (${returnModalItem.quantity} ${returnModalItem.unit}).`);
      returnQtyInputRef.current?.focus();
      return;
    }

    try {
      setIsSubmittingReturn(true);
      setReturnError('');
      await api.returnDelivery(returnModalItem.id, qty, returnReason ? returnReason.trim() : '');
      showAlert('success', `✓ Successfully returned ${qty} ${returnModalItem.unit} of ${returnModalItem.itemName} to central warehouse.`);
      handleCloseReturnModal();
      await loadDeliveries(deliveryDate, deliveryIsAllDates);
      if (activeTab === 'history') {
        await loadReceivedHistory();
      }
    } catch (err) {
      setReturnError(err.message || 'Failed to process return. Please try again.');
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  return (
    <div className="page">
      <Alert
        type={alert?.type}
        message={alert?.message}
        onDismiss={() => setAlert(null)}
      />

      {/* =========================================================================
          1. ORDER ITEMS TAB
          ========================================================================= */}
      {activeTab === 'order-items' && (
        <section>
          {/* Side-by-Side: Add Items Form (Left ~40%) and Items Being Requested (Right ~60%) */}
          <div className="branch-order-grid">
            {/* Left column — Add Items Form */}
            <div className="card branch-order-form-card">
              <div className="card-header branch-card-header">
                <div>
                  <h3 className="card-title">{t('Branch Order Form: Request Items', 'கிளை ஆர்டர் படிவம்: பொருட்கள் கோரிக்கை')}</h3>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {t('Branch')}: <b>{user?.branchName}</b>. {t('Fast keyboard item entry, suggestion autocomplete, and new item creation.', 'வேகமான விசைப்பலகை உள்ளீடு மற்றும் புதிய பொருள் உருவாக்கம்.')}
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary small"
                  id="btn-add-new-catalogue-item"
                  disabled={!selectedDepartment}
                  style={{
                    whiteSpace: 'nowrap',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: !selectedDepartment ? 0.6 : 1,
                    cursor: !selectedDepartment ? 'not-allowed' : 'pointer'
                  }}
                  onClick={() => {
                    if (!selectedDepartment) {
                      showAlert('error', language === 'ta' ? 'முதலில் ஆர்டர் செய்யும் துறையைத் தேர்ந்தெடுக்கவும்.' : 'Please select an Ordering Department above before adding a new item.');
                      deptSelectRef.current?.focus();
                      return;
                    }
                    handleOpenNewItemModal(searchQuery);
                  }}
                  title={!selectedDepartment ? 'Select department above first' : 'Add a new item to catalogue (F5 shortcut)'}
                >
                  <span>➕</span> {t('Add New Item')} <kbd style={{ fontSize: 10, opacity: 0.85, padding: '1px 5px', background: 'rgba(0,0,0,0.06)', borderRadius: 3 }}>F5</kbd>
                </button>
              </div>

              <div className="branch-form-fields">
                {/* 1. Department Selection Dropdown (Immediately ABOVE Item Name) */}
                <div className="branch-department-field" style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label
                      htmlFor="branch-order-department-select"
                      style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary-dark-green)', margin: 0 }}
                    >
                      {t('Department', 'துறை (Department)')} *
                    </label>
                    {selectedDepartment && (
                      <span style={{
                        fontSize: 11,
                        background: '#bbf7d0',
                        color: '#14532d',
                        padding: '1px 6px',
                        borderRadius: 10,
                        fontWeight: 700
                      }}>
                        ✓ {t('Selected', 'தேர்ந்தெடுக்கப்பட்டது')}
                      </span>
                    )}
                  </div>

                  {departmentsLoading ? (
                    <div style={{ fontSize: 13, color: '#6b7280', padding: '6px 0' }}>
                      ⏳ {t('Loading departments...', 'துறைகள் ஏற்றப்படுகின்றன...')}
                    </div>
                  ) : availableDepartments.length === 0 ? (
                    <div style={{
                      padding: '8px 12px',
                      background: '#fee2e2',
                      border: '1px solid #fca5a5',
                      borderRadius: 6,
                      color: '#991b1b',
                      fontSize: 12.5,
                      fontWeight: 600
                    }}>
                      ⚠️ {t('No departments available. Please configure departments in the database.', 'கிடைக்கக்கூடிய துறைகள் இல்லை. தரவுத்தளத்தில் துறைகளை உள்ளமைக்கவும்.')}
                    </div>
                  ) : (
                    <select
                      id="branch-order-department-select"
                      ref={deptSelectRef}
                      value={selectedDepartment}
                      onChange={e => handleDepartmentSelectChange(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        height: 40,
                        padding: '6px 12px',
                        fontSize: 14,
                        borderRadius: 6,
                        border: selectedDepartment ? '1.5px solid #22c55e' : '1.5px solid #f59e0b',
                        backgroundColor: '#ffffff',
                        color: selectedDepartment ? '#15803d' : '#666',
                        fontWeight: selectedDepartment ? 600 : 400
                      }}
                    >
                      <option value="">{language === 'ta' ? '-- துறையைத் தேர்ந்தெடுக்கவும் (Select Department) --' : '-- Select Department --'}</option>
                      {availableDepartments.map(dept => {
                        const deptName = typeof dept === 'string' ? dept : dept.name;
                        return (
                          <option key={deptName} value={deptName}>
                            🏢 {translateCategory(deptName)}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                {/* Searchable Autocomplete Item Name Input */}
                <div className="autocomplete-container" ref={dropdownRef}>
                  <label htmlFor="branch-item-search-input">
                    {t('Item Name')} *
                    <div className="autocomplete-input-wrap">
                      <input
                        id="branch-item-search-input"
                        ref={itemInputRef}
                        type="text"
                        disabled={!selectedDepartment}
                        autoComplete="off"
                        placeholder={!selectedDepartment
                          ? (language === 'ta' ? 'முதலில் மேலே உள்ள துறையைத் தேர்ந்தெடுக்கவும்...' : 'Select an Ordering Department above first...')
                          : (language === 'ta' ? 'பொருளின் பெயரை உள்ளிடவும் (எ.கா. தயிர்)...' : 'Type item name (e.g. Cu for Curd)...')}
                        value={searchQuery}
                        onChange={e => {
                          setSearchQuery(e.target.value);
                          setSelectedItem(null);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => {
                          if (!selectedDepartment) {
                            deptSelectRef.current?.focus();
                            return;
                          }
                          setShowSuggestions(true);
                        }}
                        onKeyDown={handleItemInputKeyDown}
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          className="autocomplete-clear-btn"
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedItem(null);
                            setItemUnit('');
                            itemInputRef.current?.focus();
                          }}
                          title={t('Clear')}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </label>

                  {/* Autocomplete Dropdown */}
                  {showSuggestions && (
                    <ul className="autocomplete-dropdown" role="listbox">
                      {filteredSuggestions.length > 0 ? (
                        filteredSuggestions.map((it, idx) => (
                          <li
                            key={it.id || it.name}
                            id={`suggestion-item-${idx}`}
                            className={`autocomplete-item ${idx === highlightedIndex ? 'highlighted' : ''}`}
                            onMouseDown={(e) => {
                              e.preventDefault(); // prevent blur before click
                              handleSelectSuggestion(it);
                            }}
                            onMouseEnter={() => setHighlightedIndex(idx)}
                          >
                            <span className="autocomplete-item-name">{translateItem(it.name)}</span>
                            <span className="autocomplete-unit-badge">{translateUnit(it.unit)}</span>
                          </li>
                        ))
                      ) : (
                        <li className="autocomplete-empty">
                          {language === 'ta' ? `"${searchQuery}" என்ற பெயரில் பொருட்கள் இல்லை` : `No catalogue items matching "${searchQuery}"`}
                        </li>
                      )}

                      <li className="autocomplete-action-row">
                        <button
                          type="button"
                          className="autocomplete-action-btn"
                          id="btn-dropdown-add-new-item"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleOpenNewItemModal(searchQuery);
                          }}
                        >
                          + {language === 'ta' ? `"${translateItem(searchQuery.trim()) || 'புதிய பொருள்'}" பட்டியலுக்கு சேர்க்க (F5)` : `Add "${searchQuery.trim() || 'New Item'}" to Catalogue (F5)`}
                        </button>
                      </li>
                    </ul>
                  )}
                </div>

                <div className="branch-form-row">
                  <label>
                    {t('Unit')} *
                    <input
                      readOnly
                      value={itemUnit ? `${translateUnit(itemUnit)} (${language === 'ta' ? 'தானாக நிரப்பப்பட்டது' : 'auto-filled'})` : `(${language === 'ta' ? 'பட்டியலிலிருந்து தானாக நிரப்பப்படும்' : 'Auto-filled from catalogue'})`}
                      style={{
                        background: '#f8f9fa',
                        color: itemUnit ? 'var(--green)' : 'var(--muted)',
                        fontWeight: itemUnit ? 600 : 400
                      }}
                      placeholder={language === 'ta' ? 'பட்டியலிலிருந்து தானாக நிரப்பப்படும்' : 'Auto-filled from catalogue'}
                    />
                  </label>

                  <label htmlFor="branch-item-qty-input">
                    {t('Requested Quantity')} *
                    <input
                      id="branch-item-qty-input"
                      ref={qtyInputRef}
                      type="number"
                      min="0.001"
                      step="any"
                      disabled={!selectedDepartment}
                      placeholder={!selectedDepartment ? (language === 'ta' ? 'முதலில் துறையைத் தேர்ந்தெடுக்கவும்' : 'Select department first') : t('Enter Quantity')}
                      value={requestedQty}
                      onChange={e => setRequestedQty(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddItemToOrderList();
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="form-actions" style={{ marginTop: 18 }}>
                <button
                  type="button"
                  className="secondary"
                  id="btn-add-item-to-order-list"
                  disabled={!selectedDepartment}
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    opacity: !selectedDepartment ? 0.6 : 1,
                    cursor: !selectedDepartment ? 'not-allowed' : 'pointer'
                  }}
                  onClick={handleAddItemToOrderList}
                >
                  {t('+ Add Item to Order List (Enter)', '+ கோரிக்கை பட்டியலில் சேர் (Enter)')}
                </button>
              </div>
            </div>

            {/* Right column — Items Being Requested */}
            <div className="card branch-order-list-card">
              <div className="card-header branch-card-header">
                <div>
                  <h3 className="card-title">{t('Items Being Requested', 'கோரப்படும் பொருட்கள்')} ({orderItemsList.length})</h3>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {t('Review and edit quantities before sending your request to the Store Manager.', 'கிடங்கு மேலாளருக்கு கோரிக்கையை அனுப்பும் முன் அளவுகளை சரிபார்க்கவும்.')}
                  </p>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="secondary small"
                    id="btn-direct-print-order"
                    disabled={orderItemsList.length === 0 || directPrintingOrder}
                    onClick={handleDirectPrintOrderList}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 34,
                      padding: '0 12px',
                      fontWeight: 600,
                      fontSize: 12.5,
                      borderRadius: 6,
                      background: '#F0FDF4',
                      color: 'var(--primary-dark-green)',
                      borderColor: 'var(--primary-dark-green)'
                    }}
                    title={language === 'ta' ? 'கிளை ஆர்டர் பட்டியலை நேரடியாக அச்சிடு' : 'Direct Print Order'}
                  >
                    <span>🖨️</span>
                    {directPrintingOrder
                      ? (language === 'ta' ? 'அச்சிடுகிறது...' : 'Printing...')
                      : (language === 'ta' ? 'நேரடி அச்சு' : 'Direct Print')}
                  </button>

                  <button
                    type="button"
                    className="secondary small"
                    id="btn-download-order-pdf"
                    disabled={orderItemsList.length === 0 || downloadingOrderPdf}
                    onClick={handleDownloadOrderListPdf}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 34,
                      padding: '0 12px',
                      fontWeight: 600,
                      fontSize: 12.5,
                      borderRadius: 6
                    }}
                    title={language === 'ta' ? 'கிளை ஆர்டர் பட்டியலை PDF ஆக பதிவிறக்கவும்' : 'Download Order PDF'}
                  >
                    <span>📄</span>
                    {downloadingOrderPdf
                      ? (language === 'ta' ? 'தயாராகிறது...' : 'Generating...')
                      : (language === 'ta' ? 'ஆர்டர் PDF பதிவிறக்கு' : 'Download Order PDF')}
                  </button>
                </div>
              </div>

              {/* Desktop Table View (> 768px) */}
              <div className="table-wrap desktop-table-view">
                <table className="branch-request-table">
                  <thead>
                    <tr>
                      <th>{t('Item Name')}</th>
                      <th>{t('Department')}</th>
                      <th style={{ textAlign: 'center', width: 160 }}>{t('Requested Quantity')}</th>
                      <th style={{ textAlign: 'center', width: 90 }}>{t('Action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItemsList.length > 0 ? (
                      orderItemsList.map(item => (
                        <tr key={item.id}>
                          <td>
                            <b>{translateItem(item.itemName)}</b>
                            {item.isNewItem && (
                              <span style={{ fontSize: 10, color: '#b45309', marginLeft: 6, fontWeight: 700 }}>
                                [{language === 'ta' ? 'புதியது' : 'New'}]
                              </span>
                            )}
                          </td>
                          <td>
                            <select
                              value={item.department || item.departmentName || item.category || ''}
                              onChange={e => handleUpdateOrderItemDepartment(item.id, e.target.value)}
                              aria-label={`Department for ${item.itemName}`}
                              style={{
                                height: 32,
                                padding: '2px 8px',
                                fontSize: 12.5,
                                borderRadius: 5,
                                border: '1px solid #99c2b4',
                                backgroundColor: '#f0fdf4',
                                color: '#166534',
                                fontWeight: 600,
                                cursor: 'pointer',
                                maxWidth: 170
                              }}
                            >
                              {availableDepartments.map(dept => {
                                const deptName = typeof dept === 'string' ? dept : dept.name;
                                return (
                                  <option key={deptName} value={deptName}>
                                    {translateCategory(deptName)}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                className="qty-input"
                                value={item.requestedQuantity}
                                onChange={e => handleUpdateOrderItemQty(item.id, e.target.value)}
                                style={{ width: 85 }}
                              />
                              <span className="autocomplete-unit-badge">{translateUnit(item.unit)}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="danger small"
                              onClick={() => handleRemoveOrderItem(item.id)}
                            >
                              {t('Remove')}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="empty">
                          {t('No items added to current request list. Add items using the form on the left.', 'தற்போதைய கோரிக்கை பட்டியலில் பொருட்கள் எதுவும் சேர்க்கப்படவில்லை. இடதுபுறப் படிவத்தைப் பயன்படுத்தி சேர்க்கவும்.')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View (<= 768px) */}
              <div className="mobile-card-list-view">
                {orderItemsList.length > 0 ? (
                  orderItemsList.map(item => (
                    <div key={item.id} className="mobile-item-card">
                      <div className="mobile-item-header">
                        <div className="mobile-item-name-group">
                          <span className="mobile-item-title">
                            {translateItem(item.itemName)}
                            {item.isNewItem && (
                              <span style={{ fontSize: 10, color: '#b45309', marginLeft: 6, fontWeight: 700 }}>
                                [{language === 'ta' ? 'புதியது' : 'New'}]
                              </span>
                            )}
                          </span>
                          <div className="mobile-item-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <select
                              value={item.department || item.departmentName || item.category || ''}
                              onChange={e => handleUpdateOrderItemDepartment(item.id, e.target.value)}
                              aria-label={`Department for ${item.itemName}`}
                              style={{
                                height: 28,
                                padding: '2px 6px',
                                fontSize: 11.5,
                                borderRadius: 4,
                                border: '1px solid #99c2b4',
                                backgroundColor: '#f0fdf4',
                                color: '#166534',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              {availableDepartments.map(dept => {
                                const deptName = typeof dept === 'string' ? dept : dept.name;
                                return (
                                  <option key={deptName} value={deptName}>
                                    {translateCategory(deptName)}
                                  </option>
                                );
                              })}
                            </select>
                            <span className="autocomplete-unit-badge">
                              {t('Unit')}: {translateUnit(item.unit)}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="danger small"
                          onClick={() => handleRemoveOrderItem(item.id)}
                          aria-label={t('Remove')}
                          style={{ minHeight: 34, padding: '4px 8px', flexShrink: 0 }}
                        >
                          🗑️ {t('Remove')}
                        </button>
                      </div>

                      <div className="mobile-item-qty-row">
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary-dark-green)' }}>
                          {t('Requested Quantity')}:
                        </span>
                        <div className="mobile-qty-stepper">
                          <button
                            type="button"
                            className="mobile-stepper-btn"
                            disabled={Number(item.requestedQuantity) <= 1}
                            onClick={() => handleUpdateOrderItemQty(item.id, Math.max(1, Number(item.requestedQuantity || 1) - 1))}
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="0.001"
                      step="any"
                            className="mobile-stepper-input"
                            value={item.requestedQuantity}
                            onChange={e => handleUpdateOrderItemQty(item.id, e.target.value)}
                            aria-label={`${item.itemName} quantity`}
                          />
                          <button
                            type="button"
                            className="mobile-stepper-btn"
                            onClick={() => handleUpdateOrderItemQty(item.id, Number(item.requestedQuantity || 0) + 1)}
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="mobile-empty-card">
                    {t('No items added to current request list. Add items using the form above.', 'தற்போதைய கோரிக்கை பட்டியலில் பொருட்கள் எதுவும் சேர்க்கப்படவில்லை. மேலே உள்ள படிவத்தைப் பயன்படுத்தி சேர்க்கவும்.')}
                  </div>
                )}
              </div>

              <div className="form-actions branch-order-actions" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="primary"
                  id="send-order-btn"
                  ref={sendOrderBtnRef}
                  disabled={orderItemsList.length === 0}
                  onClick={handleOpenConfirmModal}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 38,
                    padding: '0 18px',
                    fontWeight: 700,
                    borderRadius: 6
                  }}
                >
                  <span>📤</span> {t('Send Order', 'கோரிக்கையை அனுப்பு')} ({orderItemsList.length} {t('items')})
                </button>
              </div>
            </div>
          </div>



          {/* Confirm Order Modal Popup */}
          {showConfirmModal && (
            <div className="modal-overlay" onClick={handleCancelConfirmModal}>
              <div
                className="modal-content"
                style={{ maxWidth: 580 }}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancelConfirmModal();
                  }
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-order-title"
              >
                <div className="modal-header">
                  <h3 id="confirm-order-title">{t('Confirm Order', 'கோரிக்கையை உறுதிசெய்')}</h3>
                  <button
                    type="button"
                    className="close-btn"
                    onClick={handleCancelConfirmModal}
                    disabled={submittingBranchOrder}
                    aria-label={t('Close')}
                  >
                    ✕
                  </button>
                </div>

                {confirmOrderError && (
                  <div style={{
                    background: '#fdf2f2',
                    border: '1px solid #f8b4b4',
                    color: '#9b1c1c',
                    padding: '10px 14px',
                    borderRadius: 8,
                    fontSize: 13,
                    marginTop: 12,
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <span>{confirmOrderError}</span>
                  </div>
                )}

                <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--muted)' }}>
                  {language === 'ta' ? `கிடங்கு மேலாளருக்கு அனுப்பும் முன் ${user?.branchName} கிளையின் கோரிக்கை சுருக்கத்தை சரிபார்க்கவும்:` : `Please review your order summary for branch ${user?.branchName} before sending to the Store Manager:`}
                </p>

                <div className="confirm-summary-box">
                  <span>{t('Total Items')}: <b className="confirm-summary-stat">{orderItemsList.length}</b></span>
                  <span>{t('Total Quantity')}: <b className="confirm-summary-stat">{orderItemsList.reduce((acc, it) => acc + (it.requestedQuantity || 0), 0)}</b></span>
                </div>

                <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto', margin: '14px 0' }}>
                  <table className="branch-request-table">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }}>#</th>
                        <th>{t('Item Name')}</th>
                        <th>{t('Department')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Requested Quantity')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItemsList.map((item, idx) => (
                        <tr key={item.id}>
                          <td style={{ color: 'var(--muted)' }}>{idx + 1}</td>
                          <td>
                            <b>{translateItem(item.itemName)}</b>
                            {item.isNewItem && (
                              <span style={{ fontSize: 10, color: '#b45309', marginLeft: 6, fontWeight: 700 }}>
                                [{language === 'ta' ? 'புதியது' : 'New'}]
                              </span>
                            )}
                          </td>
                          <td>
                            <span style={{ background: '#e2ece9', color: '#003B2B', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                              {translateCategory(item.department || item.departmentName || item.category || 'General')}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>
                            {item.requestedQuantity} {translateUnit(item.unit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="form-actions" style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button
                    type="button"
                    className="secondary"
                    id="cancel-send-order-btn"
                    ref={cancelConfirmBtnRef}
                    onClick={handleCancelConfirmModal}
                    disabled={submittingBranchOrder}
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="button"
                    className="primary"
                    id="confirm-send-order-btn"
                    ref={confirmBtnRef}
                    onClick={handleConfirmSendOrder}
                    disabled={submittingBranchOrder}
                  >
                    {submittingBranchOrder ? t('Loading...') : t('Confirm Send', 'உறுதிசெய்து அனுப்பு')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Add New Catalogue Item Modal Popup */}
          {showNewItemModal && (
            <div className="modal-overlay" onClick={handleCloseNewItemModal}>
              <div
                className="modal-content"
                style={{ maxWidth: 460 }}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCloseNewItemModal();
                  }
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-item-modal-title"
              >
                <div className="modal-header">
                  <h3 id="add-item-modal-title">{t('Add New Item to Catalogue', 'புதிய பொருளை பட்டியலில் சேர்க்க')}</h3>
                  <button
                    type="button"
                    className="close-btn"
                    onClick={handleCloseNewItemModal}
                    disabled={savingNewItem}
                    aria-label={t('Close')}
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveNewItem}>
                  {newItemError && (
                    <div style={{ background: '#fdf2f2', border: '1px solid #f8b4b4', color: '#9b1c1c', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                      {newItemError}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <label>
                      {t('Item Name')} *
                      <input
                        id="modal-new-item-name"
                        ref={modalItemInputRef}
                        type="text"
                        placeholder={language === 'ta' ? 'எ.கா. காஷ்மீரி குங்குமப்பூ' : 'e.g. Kashmiri Saffron'}
                        value={newItemName}
                        onChange={e => {
                          setNewItemName(e.target.value);
                          if (newItemError) setNewItemError('');
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const trimmed = (newItemName || '').trim();
                            if (!trimmed) {
                              setNewItemError(language === 'ta' ? 'பொருளின் பெயர் தேவை.' : 'Item name is required.');
                              modalItemInputRef.current?.focus();
                              return;
                            }
                            setNewItemError('');
                            modalUnitSelectRef.current?.focus();
                          }
                        }}
                        disabled={savingNewItem}
                      />
                    </label>

                    <label>
                      {t('Unit')} *
                      <select
                        id="modal-new-item-unit"
                        ref={modalUnitSelectRef}
                        value={newItemUnit}
                        onChange={e => {
                          setNewItemUnit(e.target.value);
                          if (newItemError) setNewItemError('');
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newItemUnit === '__CUSTOM__') {
                              modalCustomUnitRef.current?.focus();
                              return;
                            }
                            handleSaveNewItem(e);
                          }
                        }}
                        disabled={savingNewItem}
                      >
                        <option value="KG">{language === 'ta' ? 'கிலோ (KG)' : 'KG (Kilograms)'}</option>
                        <option value="L">{language === 'ta' ? 'லிட்டர் (L)' : 'L (Liters)'}</option>
                        <option value="Packet">{t('packet', 'பாக்கெட் (Packet)')}</option>
                        <option value="Box">{t('box', 'பெட்டி (Box)')}</option>
                        <option value="Bag">{t('bag', 'பை (Bag)')}</option>
                        <option value="Grams">{language === 'ta' ? 'கிராம் (G)' : 'Grams'}</option>
                        <option value="Pieces">{language === 'ta' ? 'எண்ணிக்கை (Pcs)' : 'Pieces'}</option>
                        <option value="Unit">{t('piece', 'எண்ணிக்கை (Unit)')}</option>
                        <option value="__CUSTOM__">{language === 'ta' ? 'மற்றவை / தனிப்பயன் அலகு...' : 'Other / Custom Unit...'}</option>
                      </select>
                    </label>

                    {newItemUnit === '__CUSTOM__' && (
                      <label>
                        {t('Custom Unit Name', 'தனிப்பயன் அலகு பெயர்')} *
                        <input
                          id="modal-new-item-custom-unit"
                          ref={modalCustomUnitRef}
                          type="text"
                          placeholder={language === 'ta' ? 'எ.கா. கட்டு, தட்டு' : 'e.g. Bundle, Tray'}
                          value={newItemCustomUnit}
                          onChange={e => {
                            setNewItemCustomUnit(e.target.value);
                            if (newItemError) setNewItemError('');
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveNewItem(e);
                            }
                          }}
                          disabled={savingNewItem}
                        />
                      </label>
                    )}
                  </div>

                  <div className="form-actions" style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                      type="button"
                      className="secondary"
                      id="cancel-add-new-item-btn"
                      onClick={handleCloseNewItemModal}
                      disabled={savingNewItem}
                    >
                      {t('Cancel')}
                    </button>
                    <button
                      type="submit"
                      className="primary"
                      id="save-new-item-btn"
                      disabled={savingNewItem}
                    >
                      {savingNewItem ? t('Loading...') : t('Save to Catalogue')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Today's / Recent Submitted Requests with Date-wise Organization */}
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-header">
              <div>
                <h3 className="card-title">Recent Requests Submitted for {user?.branchName}</h3>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  Requests recorded and organized by their original request creation dates and timestamps.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="secondary small"
                  id="btn-direct-print-recent-requests"
                  onClick={handleDirectPrintRecentRequests}
                  disabled={myRequests.length === 0 || directPrintingRecent}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 34,
                    padding: '0 12px',
                    fontWeight: 600,
                    fontSize: 12.5,
                    borderRadius: 6,
                    background: '#F0FDF4',
                    color: 'var(--primary-dark-green)',
                    borderColor: 'var(--primary-dark-green)'
                  }}
                  title={language === 'ta' ? 'சமீபத்திய கோரிக்கைகளை நேரடியாக அச்சிடு' : 'Direct Print Recent Requests'}
                >
                  <span>🖨️</span>
                  {directPrintingRecent
                    ? (language === 'ta' ? 'அச்சிடுகிறது...' : 'Printing...')
                    : (language === 'ta' ? 'நேரடி அச்சு' : 'Direct Print')}
                </button>

                <button
                  type="button"
                  className="secondary small"
                  id="btn-download-recent-requests-pdf"
                  onClick={handleDownloadRecentRequestsPdf}
                  disabled={myRequests.length === 0 || downloadingRecentPdf}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 34,
                    padding: '0 12px',
                    fontWeight: 600,
                    fontSize: 12.5,
                    borderRadius: 6
                  }}
                  title={language === 'ta' ? 'சமீபத்திய கோரிக்கைகளை PDF ஆக பதிவிறக்கவும்' : 'Download Recent Requests PDF'}
                >
                  <span>📄</span>
                  {downloadingRecentPdf
                    ? (language === 'ta' ? 'தயாராகிறது...' : 'Generating...')
                    : (language === 'ta' ? 'சமீபத்திய கோரிக்கைகள் PDF' : 'Download Recent Requests PDF')}
                </button>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => loadMyRequests()}
                >
                  ↻ Refresh
                </button>
              </div>
            </div>

            <DateFilterBar
              label="Request Date"
              selectedDate={requestFilterDate}
              onDateChange={(d) => {
                setRequestFilterDate(d);
                setRequestFromDate(d);
                setRequestToDate(d);
                loadMyRequests(d, d);
              }}
              fromDate={requestFromDate}
              toDate={requestToDate}
              onFromDateChange={setRequestFromDate}
              onToDateChange={setRequestToDate}
              onApplyRange={(from, to) => {
                setRequestFromDate(from);
                setRequestToDate(to);
                loadMyRequests(from, to);
              }}
              totalCount={myRequests.length}
            />

            {(() => {
              const displayed = myRequests.filter(r => {
                const d = toLocalDateString(r.requestDate || r.createdAt);
                if (!d) return false;
                if (requestFromDate && d < requestFromDate) return false;
                if (requestToDate && d > requestToDate) return false;
                return true;
              }).sort((a, b) => {
                const tA = new Date(a.createdAt || a.requestDate || 0).getTime();
                const tB = new Date(b.createdAt || b.requestDate || 0).getTime();
                return tB - tA;
              });

              if (displayed.length === 0) {
                return (
                  <EmptyDateMessage
                    date={requestFromDate === requestToDate ? requestFromDate : `${requestFromDate} – ${requestToDate}`}
                    message={`No recent requests found for ${user?.branchName}.`}
                    onResetToday={() => {
                      const today = getTodayDateString();
                      setRequestFilterDate(today);
                      setRequestFromDate(today);
                      setRequestToDate(today);
                    }}
                  />
                );
              }

              if (requestFromDate !== requestToDate) {
                const groups = groupByDate(displayed, r => r.requestDate || r.createdAt, language);
                return groups.map(grp => (
                  <div key={grp.date} style={{ marginBottom: 24 }}>
                    <DateSectionHeader label={grp.label} count={grp.items.length} date={grp.date} />
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('Request Date & Time', 'Request Date & Time')}</th>
                            <th>{t('Item Name', 'Item Name')}</th>
                            <th>{t('Department', 'துறை')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Requested Quantity', 'Requested Quantity')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Delivered Quantity', 'Delivered Quantity')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Confirmed Received Quantity', 'Confirmed Received Quantity')}</th>
                            <th>{t('Status', 'Status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grp.items.map(r => (
                            <tr key={r.id}>
                              <td>{formatDateTime(r.createdAt || r.requestDate, language)}</td>
                              <td><b>{translateItem(r.item)}</b></td>
                              <td>
                                <span style={{ background: '#e2ece9', color: '#003B2B', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                                  {translateCategory(r.department || r.category || 'General')}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#003B2B' }}>
                                {r.requested ? `${r.requested} ${translateUnit(r.unit)}` : '—'}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <span style={{ fontWeight: 600, color: '#8c671b' }}>
                                  {r.dispatched ? `${r.dispatched} ${translateUnit(r.unit)}` : `0 ${translateUnit(r.unit)}`}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <span style={{ fontWeight: 600, color: 'var(--green)' }}>
                                  {r.received ? `${r.received} ${translateUnit(r.unit)}` : `0 ${translateUnit(r.unit)}`}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${
                                  r.status === 'COMPLETED' ? 'badge-completed' :
                                  r.status === 'PARTIALLY_RECEIVED' ? 'badge-partial' :
                                  r.status === 'DISPATCHED' ? 'badge-ordered' : 'badge-pending'
                                }`}>
                                  {translateStatus(r.status)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ));
              }

              // Single date table
              return (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{t('Request Date & Time', 'Request Date & Time')}</th>
                        <th>{t('Item Name', 'Item Name')}</th>
                        <th>{t('Department', 'துறை')}</th>
                        <th>{t('Unit', 'Unit')}</th>
                        <th>{t('Requested Quantity', 'Requested Quantity')}</th>
                        <th>{t('Delivered Quantity', 'Delivered Quantity')}</th>
                        <th>{t('Confirmed Received Quantity', 'Confirmed Received Quantity')}</th>
                        <th>{t('Status', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map(r => (
                        <tr key={r.id}>
                          <td>{formatDateTime(r.createdAt || r.requestDate, language)}</td>
                          <td><b>{translateItem(r.item)}</b></td>
                          <td>
                            <span style={{ background: '#e2ece9', color: '#003B2B', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                              {translateCategory(r.department || r.category || 'General')}
                            </span>
                          </td>
                          <td>{translateUnit(r.unit)}</td>
                          <td>{r.requested}</td>
                          <td><span style={{ fontWeight: 600, color: '#8c671b' }}>{r.dispatched || 0}</span></td>
                          <td><span style={{ fontWeight: 600, color: 'var(--green)' }}>{r.received || 0}</span></td>
                          <td>
                            <span className={`badge ${
                              r.status === 'COMPLETED' ? 'badge-completed' :
                              r.status === 'PARTIALLY_RECEIVED' ? 'badge-partial' :
                              r.status === 'DISPATCHED' ? 'badge-ordered' : 'badge-pending'
                            }`}>
                              {translateStatus(r.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* =========================================================================
          2. ENTRY TAB (Deliveries & Physical Acknowledgement)
          ========================================================================= */}
      {activeTab === 'entry' && (
        <section className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">{t('Deliveries Sent to', 'Deliveries Sent to')} {user?.branchName}</h3>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                {t('Grouped by original delivery date...', 'Grouped by original delivery date. Please click Acknowledge Received only after physically receiving and verifying the delivery at your branch.')}
              </p>
            </div>
            <button
              type="button"
              className="secondary small"
              onClick={() => loadDeliveries(deliveryDate, deliveryIsAllDates)}
            >
              ↻ {t('Refresh', 'Refresh')}
            </button>
          </div>

          {/* Date Picker next to controls, defaults to today with All Dates option */}
          <DateFilterBar
            label={t('Original Delivery Date', 'Original Delivery Date')}
            selectedDate={deliveryDate}
            onDateChange={(d) => {
              setDeliveryDate(d);
              setDeliveryIsAllDates(false);
            }}
            isAllDates={deliveryIsAllDates}
            onToggleAllDates={(all) => setDeliveryIsAllDates(all)}
            totalCount={deliveries.length}
          />

          {(() => {
            const displayed = deliveries.filter(d => {
              if (deliveryIsAllDates) return true;
              const dispatchDay = toLocalDateString(d.dispatchDate || d.createdAt);
              return dispatchDay === deliveryDate;
            }).sort((a, b) => {
              const tA = new Date(a.createdAt || a.dispatchDate || 0).getTime();
              const tB = new Date(b.createdAt || b.dispatchDate || 0).getTime();
              return tB - tA;
            });

            if (displayed.length === 0) {
              return (
                <EmptyDateMessage
                  date={deliveryIsAllDates ? null : deliveryDate}
                  message={deliveryIsAllDates ? `${t('No records found.', 'No deliveries registered for')} ${user?.branchName}.` : undefined}
                  onResetToday={() => {
                    setDeliveryDate(getTodayDateString());
                    setDeliveryIsAllDates(false);
                  }}
                  onShowAll={() => setDeliveryIsAllDates(true)}
                />
              );
            }

            if (deliveryIsAllDates) {
              const groups = groupByDate(displayed, d => d.dispatchDate || d.createdAt, language);
              return groups.map(grp => (
                <div key={grp.date} style={{ marginBottom: 24 }}>
                  <DateSectionHeader label={grp.label} count={grp.items.length} date={grp.date} />
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '155px' }}>{t('Delivery Date & Time', 'Delivery Date & Time')}</th>
                          <th>{t('Item Name', 'Item Name')}</th>
                          <th style={{ width: '135px', textAlign: 'center' }}>{t('Delivered Quantity', 'Delivered Quantity')}</th>
                          <th style={{ width: '145px', textAlign: 'center' }}>{t('Actual Received Quantity', 'Actual Received Quantity')}</th>
                          <th style={{ width: '125px', textAlign: 'center' }}>{t('Shortage Quantity', 'Shortage Quantity')}</th>
                          <th style={{ width: '170px', textAlign: 'center' }}>{t('Acknowledgement Status', 'Acknowledgement Status')}</th>
                          <th style={{ width: '155px', textAlign: 'center' }}>{t('Action', 'Action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grp.items.map(d => {
                          const isAck = (d.status || '').toUpperCase() === 'ACKNOWLEDGED';
                          const ackStatus = (d.acknowledgementStatus || '').toUpperCase();
                          const shortage = d.shortageQuantity || 0;
                          const received = d.acknowledgedQuantity !== undefined && d.acknowledgedQuantity !== null ? d.acknowledgedQuantity : (isAck ? d.quantity : null);
                          const isProc = isSubmittingAck && ackModalItem?.id === d.id;
                          const alreadyReturned = d.returnedQuantity || 0;
                          const isFullyReturned = alreadyReturned >= d.quantity;

                          const rowBgStyle = !isAck ? {
                            borderLeft: '4px solid transparent',
                            transition: 'background-color 0.25s ease'
                          } : (ackStatus === 'NOT_RECEIVED' || (received === 0 && shortage > 0)) ? {
                            backgroundColor: '#fef2f2',
                            borderLeft: '4px solid #ef4444',
                            transition: 'background-color 0.25s ease'
                          } : (ackStatus === 'PARTIALLY_RECEIVED' || shortage > 0) ? {
                            backgroundColor: '#fffdf0',
                            borderLeft: '4px solid #f59e0b',
                            transition: 'background-color 0.25s ease'
                          } : {
                            backgroundColor: '#edf7ee',
                            borderLeft: '4px solid #2e7d32',
                            transition: 'background-color 0.25s ease'
                          };

                          return (
                            <tr key={d.id} style={rowBgStyle}>
                              <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(d.createdAt || d.dispatchDate, language)}</td>
                              <td>
                                <b>{translateItem(d.itemName)}</b>
                                {d.isAdditional && (
                                  <span style={{ marginLeft: 6, fontSize: 11, background: '#f4ebd5', color: '#8c671b', padding: '2px 5px', borderRadius: 4 }}>
                                    {t('Additional Item', 'Additional Item')}
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span style={{ fontWeight: 700, color: 'var(--green)', fontSize: '14px' }}>
                                  {d.quantity} {translateUnit(d.unit)}
                                </span>
                                {alreadyReturned > 0 && (
                                  <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                                    {t('Returned', 'Returned')}: {alreadyReturned} {translateUnit(d.unit)}
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {isAck ? (
                                  received === 0 && (ackStatus === 'NOT_RECEIVED' || shortage > 0) ? (
                                    <span style={{ fontWeight: 700, color: '#dc2626', fontSize: '14px' }}>0</span>
                                  ) : (
                                    <span style={{ fontWeight: 700, color: '#166534', fontSize: '14px' }}>{received}</span>
                                  )
                                ) : (
                                  <span className="muted" style={{ fontSize: '13px' }}>-</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {isAck ? (
                                  shortage > 0 ? (
                                    <span style={{
                                      fontWeight: 700,
                                      color: '#b91c1c',
                                      backgroundColor: '#fef2f2',
                                      border: '1px solid #fca5a5',
                                      padding: '2px 7px',
                                      borderRadius: 4,
                                      fontSize: '12px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3
                                    }}>
                                      ⚠️ {shortage}
                                    </span>
                                  ) : (
                                    <span style={{ fontWeight: 600, color: '#166534', fontSize: '13px' }}>0</span>
                                  )
                                ) : (
                                  <span className="muted" style={{ fontSize: '13px' }}>-</span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                {isAck ? (
                                  (ackStatus === 'NOT_RECEIVED' || (received === 0 && shortage > 0)) ? (
                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        color: '#991b1b',
                                        fontWeight: 700,
                                        fontSize: '11.5px',
                                        background: '#fee2e2',
                                        border: '1px solid #f87171',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        ✕ {t('Not Received', 'Not Received')}
                                      </span>
                                      {d.acknowledgedAt && (
                                        <span className="muted" style={{ fontSize: '10.5px' }}>
                                          {formatDateTime(d.acknowledgedAt, language)}
                                        </span>
                                      )}
                                      {d.acknowledgementRemarks && (
                                        <span style={{ fontSize: '10.5px', color: '#6b7280', fontStyle: 'italic', maxWidth: '150px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.acknowledgementRemarks}>
                                          💬 "{d.acknowledgementRemarks}"
                                        </span>
                                      )}
                                    </div>
                                  ) : (ackStatus === 'PARTIALLY_RECEIVED' || shortage > 0) ? (
                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        color: '#92400e',
                                        fontWeight: 700,
                                        fontSize: '11.5px',
                                        background: '#fef3c7',
                                        border: '1px solid #fcd34d',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        ⚡ {t('Partially Received', 'Partially Received')}
                                      </span>
                                      {d.acknowledgedAt && (
                                        <span className="muted" style={{ fontSize: '10.5px' }}>
                                          {formatDateTime(d.acknowledgedAt, language)}
                                        </span>
                                      )}
                                      {d.acknowledgementRemarks && (
                                        <span style={{ fontSize: '10.5px', color: '#6b7280', fontStyle: 'italic', maxWidth: '150px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.acknowledgementRemarks}>
                                          💬 "{d.acknowledgementRemarks}"
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        color: '#166534',
                                        fontWeight: 700,
                                        fontSize: '11.5px',
                                        background: '#dcfce7',
                                        border: '1px solid #86efac',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        ✓ {t('Fully Received', 'Fully Received')}
                                      </span>
                                      {d.acknowledgedAt && (
                                        <span className="muted" style={{ fontSize: '10.5px' }}>
                                          {formatDateTime(d.acknowledgedAt, language)}
                                        </span>
                                      )}
                                      {d.acknowledgementRemarks && (
                                        <span style={{ fontSize: '10.5px', color: '#6b7280', fontStyle: 'italic', maxWidth: '150px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.acknowledgementRemarks}>
                                          💬 "{d.acknowledgementRemarks}"
                                        </span>
                                      )}
                                    </div>
                                  )
                                ) : (
                                  <span className="badge badge-pending" style={{ fontSize: '11.5px' }}>
                                    {t('Pending', 'Pending')}
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                  {!isAck && (
                                    <button
                                      type="button"
                                      className="primary small"
                                      disabled={isProc}
                                      onClick={() => handleOpenAckModal(d)}
                                      style={{ width: '100%', maxWidth: '150px' }}
                                    >
                                      {isProc ? t('Confirming...', 'Confirming...') : t('Acknowledge Received', 'Acknowledge Received')}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="secondary small"
                                    disabled={isFullyReturned}
                                    onClick={() => handleOpenReturnModal(d)}
                                    title={isFullyReturned ? t('Fully Returned', 'Delivered quantity has been fully returned') : t('Return', 'Return item to central inventory')}
                                    style={{
                                      width: '100%',
                                      maxWidth: '150px',
                                      opacity: isFullyReturned ? 0.45 : 1,
                                      cursor: isFullyReturned ? 'not-allowed' : 'pointer'
                                    }}
                                  >
                                    {t('Return', 'Return')}
                                  </button>
                                  {isFullyReturned ? (
                                    <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 600 }}>
                                      {t('Fully Returned', 'Fully Returned')}
                                    </span>
                                  ) : alreadyReturned > 0 ? (
                                    <span style={{ fontSize: '11px', color: '#b45309' }}>
                                      {alreadyReturned} {translateUnit(d.unit)} {t('returned', 'returned')}
                                    </span>
                                  ) : null}
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
            }

            // Single date view
            return (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '155px' }}>{t('Delivery Date & Time', 'Delivery Date & Time')}</th>
                      <th>{t('Item Name', 'Item Name')}</th>
                      <th style={{ width: '75px', textAlign: 'center' }}>{t('Unit', 'Unit')}</th>
                      <th style={{ width: '105px', textAlign: 'center' }}>{t('Delivered Quantity', 'Delivered Quantity')}</th>
                      <th style={{ width: '115px', textAlign: 'center' }}>{t('Actual Received Quantity', 'Actual Received Quantity')}</th>
                      <th style={{ width: '105px', textAlign: 'center' }}>{t('Shortage Quantity', 'Shortage Quantity')}</th>
                      <th style={{ width: '170px', textAlign: 'center' }}>{t('Acknowledgement Status', 'Acknowledgement Status')}</th>
                      <th style={{ width: '155px', textAlign: 'center' }}>{t('Action', 'Action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(d => {
                      const isAck = (d.status || '').toUpperCase() === 'ACKNOWLEDGED';
                      const ackStatus = (d.acknowledgementStatus || '').toUpperCase();
                      const shortage = d.shortageQuantity || 0;
                      const received = d.acknowledgedQuantity !== undefined && d.acknowledgedQuantity !== null ? d.acknowledgedQuantity : (isAck ? d.quantity : null);
                      const isProc = isSubmittingAck && ackModalItem?.id === d.id;
                      const alreadyReturned = d.returnedQuantity || 0;
                      const isFullyReturned = alreadyReturned >= d.quantity;

                      const rowBgStyle = !isAck ? {
                        borderLeft: '4px solid transparent',
                        transition: 'background-color 0.25s ease'
                      } : (ackStatus === 'NOT_RECEIVED' || (received === 0 && shortage > 0)) ? {
                        backgroundColor: '#fef2f2',
                        borderLeft: '4px solid #ef4444',
                        transition: 'background-color 0.25s ease'
                      } : (ackStatus === 'PARTIALLY_RECEIVED' || shortage > 0) ? {
                        backgroundColor: '#fffdf0',
                        borderLeft: '4px solid #f59e0b',
                        transition: 'background-color 0.25s ease'
                      } : {
                        backgroundColor: '#edf7ee',
                        borderLeft: '4px solid #2e7d32',
                        transition: 'background-color 0.25s ease'
                      };

                      return (
                        <tr key={d.id} style={rowBgStyle}>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(d.createdAt || d.dispatchDate, language)}</td>
                          <td>
                            <b>{translateItem(d.itemName)}</b>
                            {d.isAdditional && (
                              <span style={{ marginLeft: 6, fontSize: 11, background: '#f4ebd5', color: '#8c671b', padding: '2px 5px', borderRadius: 4 }}>
                                {t('Additional Item', 'Additional Item')}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>{translateUnit(d.unit)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, color: 'var(--green)', fontSize: '14px' }}>
                              {d.quantity}
                            </span>
                            {alreadyReturned > 0 && (
                              <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                                {t('Returned', 'Returned')}: {alreadyReturned} {translateUnit(d.unit)}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isAck ? (
                              received === 0 && (ackStatus === 'NOT_RECEIVED' || shortage > 0) ? (
                                <span style={{ fontWeight: 700, color: '#dc2626', fontSize: '14px' }}>0</span>
                              ) : (
                                <span style={{ fontWeight: 700, color: '#166534', fontSize: '14px' }}>{received}</span>
                              )
                            ) : (
                              <span className="muted" style={{ fontSize: '13px' }}>-</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isAck ? (
                              shortage > 0 ? (
                                <span style={{
                                  fontWeight: 700,
                                  color: '#b91c1c',
                                  backgroundColor: '#fef2f2',
                                  border: '1px solid #fca5a5',
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  fontSize: '12px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3
                                }}>
                                  ⚠️ {shortage}
                                </span>
                              ) : (
                                <span style={{ fontWeight: 600, color: '#166534', fontSize: '13px' }}>0</span>
                              )
                            ) : (
                              <span className="muted" style={{ fontSize: '13px' }}>-</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isAck ? (
                              (ackStatus === 'NOT_RECEIVED' || (received === 0 && shortage > 0)) ? (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: '#991b1b',
                                    fontWeight: 700,
                                    fontSize: '11.5px',
                                    background: '#fee2e2',
                                    border: '1px solid #f87171',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    ✕ {t('Not Received', 'Not Received')}
                                  </span>
                                  {d.acknowledgedAt && (
                                    <span className="muted" style={{ fontSize: '10.5px' }}>
                                      {formatDateTime(d.acknowledgedAt, language)}
                                    </span>
                                  )}
                                  {d.acknowledgementRemarks && (
                                    <span style={{ fontSize: '10.5px', color: '#6b7280', fontStyle: 'italic', maxWidth: '150px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.acknowledgementRemarks}>
                                      💬 "{d.acknowledgementRemarks}"
                                    </span>
                                  )}
                                </div>
                              ) : (ackStatus === 'PARTIALLY_RECEIVED' || shortage > 0) ? (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: '#92400e',
                                    fontWeight: 700,
                                    fontSize: '11.5px',
                                    background: '#fef3c7',
                                    border: '1px solid #fcd34d',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    ⚡ {t('Partially Received', 'Partially Received')}
                                  </span>
                                  {d.acknowledgedAt && (
                                    <span className="muted" style={{ fontSize: '10.5px' }}>
                                      {formatDateTime(d.acknowledgedAt, language)}
                                    </span>
                                  )}
                                  {d.acknowledgementRemarks && (
                                    <span style={{ fontSize: '10.5px', color: '#6b7280', fontStyle: 'italic', maxWidth: '150px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.acknowledgementRemarks}>
                                      💬 "{d.acknowledgementRemarks}"
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: '#166534',
                                    fontWeight: 700,
                                    fontSize: '11.5px',
                                    background: '#dcfce7',
                                    border: '1px solid #86efac',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    ✓ {t('Fully Received', 'Fully Received')}
                                  </span>
                                  {d.acknowledgedAt && (
                                    <span className="muted" style={{ fontSize: '10.5px' }}>
                                      {formatDateTime(d.acknowledgedAt, language)}
                                    </span>
                                  )}
                                  {d.acknowledgementRemarks && (
                                    <span style={{ fontSize: '10.5px', color: '#6b7280', fontStyle: 'italic', maxWidth: '150px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.acknowledgementRemarks}>
                                      💬 "{d.acknowledgementRemarks}"
                                    </span>
                                  )}
                                </div>
                              )
                            ) : (
                              <span className="badge badge-pending" style={{ fontSize: '11.5px' }}>
                                {t('Pending', 'Pending')}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                              {!isAck && (
                                <button
                                  type="button"
                                  className="primary small"
                                  disabled={isProc}
                                  onClick={() => handleOpenAckModal(d)}
                                  style={{ width: '100%', maxWidth: '150px' }}
                                >
                                  {isProc ? t('Confirming...', 'Confirming...') : t('Acknowledge Received', 'Acknowledge Received')}
                                </button>
                              )}
                              <button
                                type="button"
                                className="secondary small"
                                disabled={isFullyReturned}
                                onClick={() => handleOpenReturnModal(d)}
                                title={isFullyReturned ? t('Fully Returned', 'Delivered quantity has been fully returned') : t('Return', 'Return item to central inventory')}
                                style={{
                                  width: '100%',
                                  maxWidth: '150px',
                                  opacity: isFullyReturned ? 0.45 : 1,
                                  cursor: isFullyReturned ? 'not-allowed' : 'pointer'
                                }}
                              >
                                {t('Return', 'Return')}
                              </button>
                              {isFullyReturned ? (
                                <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 600 }}>
                                  {t('Fully Returned', 'Fully Returned')}
                                </span>
                              ) : alreadyReturned > 0 ? (
                                <span style={{ fontSize: '11px', color: '#b45309' }}>
                                  {alreadyReturned} {translateUnit(d.unit)} {t('returned', 'returned')}
                                </span>
                              ) : null}
                            </div>
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
      )}

      {/* =========================================================================
          3. HISTORY TAB (Deliveries Actually Received - Grouped by Ack Date)
          ========================================================================= */}
      {activeTab === 'history' && (() => {
        const sortedHistory = [...receivedHistory].sort((a, b) => {
          const tA = new Date(a.acknowledgedAt || a.createdAt || 0).getTime();
          const tB = new Date(b.acknowledgedAt || b.createdAt || 0).getTime();
          return tB - tA;
        });

        const isGroupedView = historyIsAllDates || historyFromDate || historyToDate || !historyDate;

        return (
          <section className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">{t('Received Deliveries History for', 'Received Deliveries History for')} {user?.branchName}</h3>
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  {t('Deliveries physically received and confirmed by this branch...', 'Deliveries physically received and confirmed by this branch, organized by actual acknowledgement date.')}
                </p>
              </div>
              <button type="button" className="secondary small" onClick={loadReceivedHistory}>
                ↻ {t('Refresh', 'Refresh')}
              </button>
            </div>

            {/* Date filter with range support & item search */}
            <DateFilterBar
              label={t('Acknowledgement Date', 'Acknowledgement Date')}
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
                  placeholder={t('Search item name...', 'Search item name...')}
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadReceivedHistory()}
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

            {sortedHistory.length === 0 ? (
              <EmptyDateMessage
                date={historyDate}
                message={loading ? t('Loading...', 'Loading received delivery history...') : (historyDate ? `${t('No records found for the selected date.', 'No confirmed delivery records found for this date at')} ${user?.branchName}.` : t('No records found.', 'No confirmed delivery records found matching filters.'))}
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
              /* Group by actual acknowledgement date, newest first */
              (() => {
                const groups = groupByDate(sortedHistory, d => d.acknowledgedAt, language);
                return groups.map(grp => (
                  <div key={grp.date} style={{ marginBottom: 24 }}>
                    <DateSectionHeader label={grp.label} count={grp.items.length} date={grp.date} />
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{t('Acknowledgement Date & Time', 'Acknowledgement Date & Time')}</th>
                            <th>{t('Original Delivery Date & Time', 'Original Delivery Date & Time')}</th>
                            <th>{t('Item Name', 'Item Name')}</th>
                            <th style={{ width: '75px', textAlign: 'center' }}>{t('Unit', 'Unit')}</th>
                            <th style={{ width: '95px', textAlign: 'center' }}>{t('Delivered Quantity', 'Delivered Quantity')}</th>
                            <th style={{ width: '105px', textAlign: 'center' }}>{t('Received Quantity', 'Received Quantity')}</th>
                            <th style={{ width: '105px', textAlign: 'center' }}>{t('Shortage Quantity', 'Shortage Quantity')}</th>
                            <th style={{ textAlign: 'center' }}>{t('Status', 'Status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grp.items.map(d => {
                            const ackStatus = (d.acknowledgementStatus || '').toUpperCase();
                            const shortage = d.shortageQuantity || 0;
                            const received = d.acknowledgedQuantity !== undefined && d.acknowledgedQuantity !== null ? d.acknowledgedQuantity : d.quantity;
                            const alreadyReturned = d.returnedQuantity || 0;

                            return (
                              <tr key={d.id}>
                                <td><b>{formatDateTime(d.acknowledgedAt, language)}</b></td>
                                <td>{formatDateTime(d.createdAt || d.dispatchDate, language)}</td>
                                <td><b>{translateItem(d.itemName)}</b></td>
                                <td style={{ textAlign: 'center' }}>{translateUnit(d.unit)}</td>
                                <td style={{ textAlign: 'center', fontWeight: 600 }}>{d.quantity}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span style={{ fontWeight: 700, color: (received === 0 && shortage > 0) ? '#dc2626' : '#166534', fontSize: '14px' }}>
                                    {received}
                                  </span>
                                  {alreadyReturned > 0 && (
                                    <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                                      {t('Returned', 'Returned')}: {alreadyReturned} {translateUnit(d.unit)}
                                    </div>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {shortage > 0 ? (
                                    <span style={{
                                      fontWeight: 700,
                                      color: '#b91c1c',
                                      backgroundColor: '#fef2f2',
                                      border: '1px solid #fca5a5',
                                      padding: '2px 7px',
                                      borderRadius: 4,
                                      fontSize: '12px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3
                                    }}>
                                      ⚠️ {shortage}
                                    </span>
                                  ) : (
                                    <span style={{ fontWeight: 600, color: '#166534', fontSize: '13px' }}>0</span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {(ackStatus === 'NOT_RECEIVED' || (received === 0 && shortage > 0)) ? (
                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        color: '#991b1b',
                                        fontWeight: 700,
                                        fontSize: '11.5px',
                                        background: '#fee2e2',
                                        border: '1px solid #f87171',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        ✕ {t('Not Received', 'Not Received')}
                                      </span>
                                      {d.acknowledgementRemarks && (
                                        <span style={{ fontSize: '10.5px', color: '#6b7280', fontStyle: 'italic' }}>
                                          💬 "{d.acknowledgementRemarks}"
                                        </span>
                                      )}
                                    </div>
                                  ) : (ackStatus === 'PARTIALLY_RECEIVED' || shortage > 0) ? (
                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        color: '#92400e',
                                        fontWeight: 700,
                                        fontSize: '11.5px',
                                        background: '#fef3c7',
                                        border: '1px solid #fcd34d',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        ⚡ {t('Partially Received', 'Partially Received')}
                                      </span>
                                      {d.acknowledgementRemarks && (
                                        <span style={{ fontSize: '10.5px', color: '#6b7280', fontStyle: 'italic' }}>
                                          💬 "{d.acknowledgementRemarks}"
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        color: '#166534',
                                        fontWeight: 700,
                                        fontSize: '11.5px',
                                        background: '#dcfce7',
                                        border: '1px solid #86efac',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        ✓ {t('Fully Received', 'Fully Received')}
                                      </span>
                                      {d.acknowledgementRemarks && (
                                        <span style={{ fontSize: '10.5px', color: '#6b7280', fontStyle: 'italic' }}>
                                          💬 "{d.acknowledgementRemarks}"
                                        </span>
                                      )}
                                    </div>
                                  )}
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
              /* Single Date view */
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('Acknowledgement Date & Time', 'Acknowledgement Date & Time')}</th>
                      <th>{t('Original Delivery Date & Time', 'Original Delivery Date & Time')}</th>
                      <th>{t('Item Name', 'Item Name')}</th>
                      <th style={{ width: '75px', textAlign: 'center' }}>{t('Unit', 'Unit')}</th>
                      <th style={{ width: '95px', textAlign: 'center' }}>{t('Delivered Quantity', 'Delivered Quantity')}</th>
                      <th style={{ width: '105px', textAlign: 'center' }}>{t('Received Quantity', 'Received Quantity')}</th>
                      <th style={{ width: '105px', textAlign: 'center' }}>{t('Shortage Quantity', 'Shortage Quantity')}</th>
                      <th style={{ textAlign: 'center' }}>{t('Status', 'Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHistory.map(d => {
                      const ackStatus = (d.acknowledgementStatus || '').toUpperCase();
                      const shortage = d.shortageQuantity || 0;
                      const received = d.acknowledgedQuantity !== undefined && d.acknowledgedQuantity !== null ? d.acknowledgedQuantity : d.quantity;
                      const alreadyReturned = d.returnedQuantity || 0;

                      return (
                        <tr key={d.id}>
                          <td><b>{formatDateTime(d.acknowledgedAt, language)}</b></td>
                          <td>{formatDateTime(d.createdAt || d.dispatchDate, language)}</td>
                          <td><b>{translateItem(d.itemName)}</b></td>
                          <td style={{ textAlign: 'center' }}>{translateUnit(d.unit)}</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{d.quantity}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, color: (received === 0 && shortage > 0) ? '#dc2626' : '#166534', fontSize: '14px' }}>
                              {received}
                            </span>
                            {alreadyReturned > 0 && (
                              <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                                {t('Returned', 'Returned')}: {alreadyReturned} {translateUnit(d.unit)}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {shortage > 0 ? (
                              <span style={{
                                fontWeight: 700,
                                color: '#b91c1c',
                                backgroundColor: '#fef2f2',
                                border: '1px solid #fca5a5',
                                padding: '2px 7px',
                                borderRadius: 4,
                                fontSize: '12px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3
                              }}>
                                ⚠️ {shortage}
                              </span>
                            ) : (
                              <span style={{ fontWeight: 600, color: '#166534', fontSize: '13px' }}>0</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {(ackStatus === 'NOT_RECEIVED' || (received === 0 && shortage > 0)) ? (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  color: '#991b1b',
                                  fontWeight: 700,
                                  fontSize: '11.5px',
                                  background: '#fee2e2',
                                  border: '1px solid #f87171',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  whiteSpace: 'nowrap'
                                }}>
                                  ✕ {t('Not Received', 'Not Received')}
                                </span>
                                {d.acknowledgementRemarks && (
                                  <span style={{ fontSize: '10.5px', color: '#6b7280', fontStyle: 'italic' }}>
                                    💬 "{d.acknowledgementRemarks}"
                                  </span>
                                )}
                              </div>
                            ) : (ackStatus === 'PARTIALLY_RECEIVED' || shortage > 0) ? (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  color: '#92400e',
                                  fontWeight: 700,
                                  fontSize: '11.5px',
                                  background: '#fef3c7',
                                  border: '1px solid #fcd34d',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  whiteSpace: 'nowrap'
                                }}>
                                  ⚡ {t('Partially Received', 'Partially Received')}
                                </span>
                                {d.acknowledgementRemarks && (
                                  <span style={{ fontSize: '10.5px', color: '#6b7280', fontStyle: 'italic' }}>
                                    💬 "{d.acknowledgementRemarks}"
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  color: '#166534',
                                  fontWeight: 700,
                                  fontSize: '11.5px',
                                  background: '#dcfce7',
                                  border: '1px solid #86efac',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  whiteSpace: 'nowrap'
                                }}>
                                  ✓ {t('Fully Received', 'Fully Received')}
                                </span>
                                {d.acknowledgementRemarks && (
                                  <span style={{ fontSize: '10.5px', color: '#6b7280', fontStyle: 'italic' }}>
                                    💬 "{d.acknowledgementRemarks}"
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })()}

      {/* Return Items Confirmation Modal */}
      {showReturnModal && returnModalItem && (
        <div className="modal-overlay" onClick={handleCloseReturnModal}>
          <div
            className="modal-content"
            style={{ maxWidth: 480 }}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === 'Escape' && !isSubmittingReturn) {
                e.preventDefault();
                handleCloseReturnModal();
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="return-modal-title"
          >
            <div className="modal-header">
              <div>
                <h3 id="return-modal-title" style={{ margin: 0, color: 'var(--green)' }}>
                  {t('Return Delivered Item', 'Return Delivered Item')}
                </h3>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
                  {t('Branch', 'Branch')}: <b>{user?.branchName}</b> • {t('Return to Central Store', 'Return to Central Store')}
                </p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={handleCloseReturnModal}
                disabled={isSubmittingReturn}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmReturn}>
              {returnError && (
                <div style={{
                  background: '#fdf2f2',
                  border: '1px solid #f8b4b4',
                  color: '#9b1c1c',
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  marginBottom: 14
                }}>
                  {returnError}
                </div>
              )}

              {/* Item Summary Box */}
              <div style={{
                background: 'var(--cream, #fdfbf7)',
                border: '1px solid rgba(140, 103, 27, 0.25)',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: '#555' }}>{t('Item Name', 'Item Name')}:</span>
                  <b style={{ fontSize: 15, color: 'var(--green)' }}>{translateItem(returnModalItem.itemName)}</b>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#666' }}>{t('Delivered', 'Delivered')}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--green)' }}>
                      {returnModalItem.quantity} {translateUnit(returnModalItem.unit)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#666' }}>{t('Already Returned', 'Already Returned')}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#8c671b' }}>
                      {returnModalItem.returnedQuantity || 0} {translateUnit(returnModalItem.unit)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#666' }}>{t('Available to Return', 'Available to Return')}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1e3a8a' }}>
                      {returnModalItem.quantity - (returnModalItem.returnedQuantity || 0)} {translateUnit(returnModalItem.unit)}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label>
                  {t('Quantity Being Returned Now', 'Quantity Being Returned Now')} *
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <input
                      ref={returnQtyInputRef}
                      type="number"
                      min="0.001"
                      step="any"
                      max={returnModalItem.quantity - (returnModalItem.returnedQuantity || 0)}
                      placeholder={t('Enter quantity', 'Enter quantity')}
                      value={returnQty}
                      onChange={e => {
                        setReturnQty(e.target.value);
                        if (returnError) setReturnError('');
                      }}
                      disabled={isSubmittingReturn}
                      required
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontWeight: 600, color: '#555', minWidth: 40 }}>
                      {translateUnit(returnModalItem.unit)}
                    </span>
                  </div>
                  <span className="muted" style={{ fontSize: 11, marginTop: 3, display: 'block' }}>
                    {t('Must be between', 'Must be between')} 1 {t('and', 'and')} {returnModalItem.quantity - (returnModalItem.returnedQuantity || 0)} {translateUnit(returnModalItem.unit)}
                  </span>
                </label>

                <label>
                  {t('Reason for Return (Optional)', 'Reason for Return (Optional)')}
                  <input
                    type="text"
                    placeholder={t('e.g. Excess stock, damaged packing, quality issue...', 'e.g. Excess stock, damaged packing, quality issue...')}
                    value={returnReason}
                    onChange={e => setReturnReason(e.target.value)}
                    disabled={isSubmittingReturn}
                    style={{ marginTop: 4 }}
                  />
                </label>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleCloseReturnModal}
                  disabled={isSubmittingReturn}
                >
                  {t('Cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={isSubmittingReturn || !returnQty || parseFloat(returnQty) <= 0}
                  style={{ fontWeight: 600 }}
                >
                  {isSubmittingReturn ? t('Processing Return...', 'Processing Return...') : t('Confirm Return', 'Confirm Return')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Acknowledge Delivery Receipt & Shortage Modal */}
      {showAckModal && ackModalItem && (() => {
        const dispatched = ackModalItem.quantity || 0;
        const parsedVal = actualReceivedQty === '' ? NaN : parseFloat(actualReceivedQty);
        const isValidNum = !isNaN(parsedVal);
        const receivedNum = isValidNum ? parsedVal : 0;
        const computedShortage = isValidNum ? dispatched - parsedVal : dispatched;
        const isNegative = isValidNum && parsedVal < 0;
        const isExcess = isValidNum && parsedVal > dispatched;
        const isFullReceipt = isValidNum && parsedVal === dispatched;
        const isPartialReceipt = isValidNum && parsedVal > 0 && parsedVal < dispatched;
        const isZeroReceipt = isValidNum && parsedVal === 0;

        return (
          <div className="modal-overlay" onClick={handleCloseAckModal} style={{ zIndex: 1250 }}>
            <div
              className="modal-content"
              style={{ maxWidth: 520, borderRadius: 10, padding: '22px 24px' }}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                if (e.key === 'Escape' && !isSubmittingAck) {
                  e.preventDefault();
                  handleCloseAckModal();
                }
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="ack-modal-title"
            >
              <div className="modal-header" style={{ marginBottom: 14 }}>
                <div>
                  <h3 id="ack-modal-title" style={{ margin: 0, color: 'var(--primary-dark-green)', fontSize: 18, fontWeight: 700 }}>
                    {t('Acknowledge Delivery Receipt', 'Acknowledge Delivery Receipt')}
                  </h3>
                  <p className="muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
                    {t('Branch', 'Branch')}: <b>{user?.branchName}</b> • {t('Physical Goods Verification', 'Physical Goods Verification')}
                  </p>
                </div>
                <button
                  type="button"
                  className="close-btn"
                  onClick={handleCloseAckModal}
                  disabled={isSubmittingAck}
                  aria-label="Close"
                  style={{ fontSize: 18, width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleConfirmAck}>
                {ackError && (
                  <div style={{
                    background: '#fdf2f2',
                    border: '1px solid #f8b4b4',
                    color: '#9b1c1c',
                    padding: '10px 14px',
                    borderRadius: 8,
                    fontSize: 13,
                    marginBottom: 14
                  }}>
                    {ackError}
                  </div>
                )}

                {/* Dispatch Details Card */}
                <div style={{
                  background: 'var(--cream, #fdfbf7)',
                  border: '1px solid rgba(140, 103, 27, 0.25)',
                  borderRadius: 8,
                  padding: '14px 16px',
                  marginBottom: 16
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: '#555' }}>{t('Item Name', 'Item Name')}:</span>
                    <b style={{ fontSize: 16, color: 'var(--primary-dark-green)' }}>
                      {translateItem(ackModalItem.itemName)}
                      {ackModalItem.isAdditional && (
                        <span style={{ marginLeft: 6, fontSize: 11, background: '#f4ebd5', color: '#8c671b', padding: '2px 5px', borderRadius: 4 }}>
                          {t('Additional Item', 'Additional Item')}
                        </span>
                      )}
                    </b>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, fontSize: 13, color: '#555' }}>
                    <span>{t('Original Delivery Date & Time', 'Original Delivery Date & Time')}:</span>
                    <b style={{ color: '#2d3748' }}>
                      {formatDateTime(ackModalItem.createdAt || ackModalItem.dispatchDate, language)}
                    </b>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 12,
                    textAlign: 'center',
                    paddingTop: 10,
                    borderTop: '1px solid rgba(0,0,0,0.08)'
                  }}>
                    <div>
                      <div style={{ fontSize: 11.5, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {t('Delivered Quantity', 'Delivered Quantity')}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--primary-dark-green)', marginTop: 2 }}>
                        {dispatched} <span style={{ fontSize: 13, fontWeight: 600 }}>{translateUnit(ackModalItem.unit)}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11.5, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {t('Unit', 'Unit')}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 18, color: '#8c671b', marginTop: 2 }}>
                        {translateUnit(ackModalItem.unit)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Fields: Actual Received Qty & Shortage */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label htmlFor="ack-actual-received-input" style={{ display: 'block', fontWeight: 600, fontSize: 13.5, color: '#1f2937', marginBottom: 6 }}>
                      {t('Actual Received Quantity', 'Actual Received Quantity')} *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        id="ack-actual-received-input"
                        ref={ackQtyInputRef}
                        type="number"
                        min="0"
                        max={dispatched}
                        step="any"
                        placeholder={t('Enter received quantity', 'Enter received quantity')}
                        value={actualReceivedQty}
                        onChange={e => {
                          setActualReceivedQty(e.target.value);
                          if (ackError) setAckError('');
                        }}
                        disabled={isSubmittingAck}
                        required
                        style={{
                          flex: 1,
                          height: 42,
                          fontSize: 16,
                          fontWeight: 700,
                          padding: '0 12px',
                          borderRadius: 6,
                          border: (isNegative || isExcess) ? '2px solid #ef4444' : '1.5px solid var(--border-color)',
                          color: (isNegative || isExcess) ? '#b91c1c' : '#111827'
                        }}
                      />
                      <span style={{ fontWeight: 700, color: '#4b5563', fontSize: 14, minWidth: 50 }}>
                        {translateUnit(ackModalItem.unit)}
                      </span>
                    </div>
                    <span className="muted" style={{ fontSize: 11.5, marginTop: 4, display: 'block' }}>
                      {language === 'ta'
                        ? `செல்லுபடியாகும் அளவு: 0 முதல் ${dispatched} ${translateUnit(ackModalItem.unit)} வரை`
                        : `Allowed range: 0 to ${dispatched} ${translateUnit(ackModalItem.unit)}`}
                    </span>
                  </div>

                  {/* Automatic Shortage Calculation Card */}
                  <div>
                    <div style={{ display: 'block', fontWeight: 600, fontSize: 13.5, color: '#1f2937', marginBottom: 6 }}>
                      {t('Shortage Quantity', 'Shortage Quantity')}
                      <span style={{ fontWeight: 400, fontSize: 12, color: '#6b7280', marginLeft: 6 }}>
                        ({t('Shortage Quantity = Delivered Quantity - Actual Received Quantity', 'Shortage = Delivered - Received')})
                      </span>
                    </div>

                    {isExcess ? (
                      <div style={{
                        padding: '12px 14px',
                        borderRadius: 6,
                        background: '#fef2f2',
                        border: '1.5px solid #f87171',
                        color: '#991b1b',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}>
                        <span>⚠️</span>
                        <span>
                          {language === 'ta'
                            ? `பெறப்பட்ட அளவு (${parsedVal}) விநியோகிக்கப்பட்ட அளவை (${dispatched}) விட அதிகமாக இருக்க முடியாது.`
                            : `Actual received quantity (${parsedVal}) cannot exceed delivered quantity (${dispatched}).`}
                        </span>
                      </div>
                    ) : isNegative ? (
                      <div style={{
                        padding: '12px 14px',
                        borderRadius: 6,
                        background: '#fef2f2',
                        border: '1.5px solid #f87171',
                        color: '#991b1b',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}>
                        <span>⚠️</span>
                        <span>
                          {language === 'ta'
                            ? 'பெறப்பட்ட அளவு எதிர்மறையாக (negative) இருக்க முடியாது.'
                            : 'Actual received quantity cannot be negative.'}
                        </span>
                      </div>
                    ) : isFullReceipt ? (
                      <div style={{
                        padding: '12px 14px',
                        borderRadius: 6,
                        background: '#f0fdf4',
                        border: '1.5px solid #86efac',
                        color: '#166534',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 16 }}>✓</span>
                          <span style={{ fontWeight: 600, fontSize: 13.5 }}>
                            {t('Full Receipt (No shortage)', 'Full Receipt (No shortage)')}
                          </span>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>
                          0 {translateUnit(ackModalItem.unit)}
                        </div>
                      </div>
                    ) : isPartialReceipt ? (
                      <div style={{
                        padding: '12px 14px',
                        borderRadius: 6,
                        background: '#fffbeb',
                        border: '1.5px solid #fcd34d',
                        color: '#92400e',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 16 }}>⚠️</span>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 13.5 }}>
                              {t('Partial Receipt Shortage', 'Partial Receipt Shortage')}
                            </span>
                            <div style={{ fontSize: 11.5, opacity: 0.9 }}>
                              {dispatched} - {receivedNum} = {computedShortage} {translateUnit(ackModalItem.unit)}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 17, color: '#b91c1c' }}>
                          {computedShortage} {translateUnit(ackModalItem.unit)}
                        </div>
                      </div>
                    ) : isZeroReceipt ? (
                      <div style={{
                        padding: '12px 14px',
                        borderRadius: 6,
                        background: '#fef2f2',
                        border: '1.5px solid #fca5a5',
                        color: '#991b1b',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 16 }}>✕</span>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 13.5 }}>
                              {t('Zero Receipt — Entire Delivered Quantity Missing', 'Zero Receipt — Entire Delivered Quantity Missing')}
                            </span>
                            <div style={{ fontSize: 11.5, opacity: 0.9 }}>
                              0 received • Full shortage recorded
                            </div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 17, color: '#b91c1c' }}>
                          {computedShortage} {translateUnit(ackModalItem.unit)}
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        padding: '12px 14px',
                        borderRadius: 6,
                        background: '#f9fafb',
                        border: '1.5px solid #e5e7eb',
                        color: '#6b7280',
                        fontSize: 13
                      }}>
                        {t('Enter actual received quantity above to calculate shortage.', 'Enter actual received quantity above to calculate shortage.')}
                      </div>
                    )}
                  </div>

                  {/* Optional Remarks input */}
                  <div>
                    <label htmlFor="ack-remarks-input" style={{ display: 'block', fontWeight: 600, fontSize: 13.5, color: '#1f2937', marginBottom: 6 }}>
                      {t('Optional Remarks', 'Optional Remarks')}
                    </label>
                    <input
                      id="ack-remarks-input"
                      type="text"
                      placeholder={language === 'ta' ? 'எ.கா. 2 கிலோ சேதமடைந்துள்ளது, பை கிழிந்துள்ளது...' : 'e.g. 2 kg missing, damaged package, carton torn...'}
                      value={ackRemarks}
                      onChange={e => setAckRemarks(e.target.value)}
                      disabled={isSubmittingAck}
                      maxLength={300}
                      style={{
                        width: '100%',
                        height: 40,
                        fontSize: 13.5,
                        padding: '0 12px',
                        borderRadius: 6,
                        border: '1.5px solid var(--border-color)'
                      }}
                    />
                  </div>
                </div>

                <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
                  <button
                    type="button"
                    className="secondary"
                    id="btn-cancel-ack-modal"
                    onClick={handleCloseAckModal}
                    disabled={isSubmittingAck}
                    style={{ minWidth: 90 }}
                  >
                    {t('Cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    className="primary"
                    id="btn-confirm-ack-modal"
                    disabled={
                      isSubmittingAck ||
                      actualReceivedQty === '' ||
                      !isValidNum ||
                      isNegative ||
                      isExcess
                    }
                    style={{ fontWeight: 700, minWidth: 140 }}
                  >
                    {isSubmittingAck ? t('Confirming Receipt...', 'Confirming Receipt...') : t('Confirm Receipt', 'Confirm Receipt')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
