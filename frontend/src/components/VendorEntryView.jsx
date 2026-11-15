import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../api';
import { useLanguage } from '../i18n/LanguageContext';
import { formatQuantityWithUnit } from '../utils/quantityFormatter';
import { getTodayDateString, toLocalDateString, formatDateTime } from '../utils/dateGrouping';
import {
  downloadVendorInventoryEntryPdf,
  printVendorInventoryEntryDirect,
  printVendorEntryReportDirect,
  downloadVendorEntryReportPdf
} from '../utils/pdfGenerator';

const STANDARD_UNITS = [
  'KG',
  'LITRE',
  'L',
  'PACKET',
  'PIECE',
  'PIECES',
  'BOX',
  'TIN',
  'BAG',
  'BUNDLE',
  'GRAM',
  'ML'
];

const PAYMENT_MODES = [
  { id: 'CASH', labelEn: 'Cash', labelTa: 'ரொக்கம்', icon: '💵' },
  { id: 'UPI', labelEn: 'UPI', labelTa: 'யுபிஐ', icon: '📱' },
  { id: 'BANK_TRANSFER', labelEn: 'Bank Transfer', labelTa: 'வங்கி பரிமாற்றம்', icon: '🏦' },
  { id: 'CREDIT', labelEn: 'Credit', labelTa: 'கடன்', icon: '📝' }
];

export function VendorEntryView({
  showAlert,
  catalogueItems: propCatalogueItems,
  newlyCreatedItem,
  onClearNewlyCreatedItem,
  onNavigateToAddItems,
  onCatalogueUpdated,
  onInventoryUpdated
}) {
  const { language, t, translateItem, translateUnit, translateCategory } = useLanguage();
  const isTa = language === 'ta';

  // Sub-tabs: 'entry' (New Vendor Entry) | 'history' (Entry History)
  const [subTab, setSubTab] = useState('entry');

  // Loading states
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [directPrintingEntry, setDirectPrintingEntry] = useState(false);

  // Catalogue, Categories & Vendors data
  const [catalogueItems, setCatalogueItems] = useState(propCatalogueItems || []);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);

  // Sync propCatalogueItems if provided by parent
  useEffect(() => {
    if (Array.isArray(propCatalogueItems) && propCatalogueItems.length > 0) {
      setCatalogueItems(propCatalogueItems);
    }
  }, [propCatalogueItems]);

  // Form State: Vendor
  const [vendorInput, setVendorInput] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorSuggestions, setVendorSuggestions] = useState([]);
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);
  const [focusedVendorIndex, setFocusedVendorIndex] = useState(-1);
  const vendorInputRef = useRef(null);
  const vendorDropdownRef = useRef(null);

  // Form State: Entry Date & Payment Mode
  const [entryDate, setEntryDate] = useState(getTodayDateString());
  const [paymentMode, setPaymentMode] = useState('CASH');

  // Form State: Received By & Brought By (empty by default, no auto-fill)
  const [receivedByInput, setReceivedByInput] = useState('');
  const [broughtByInput, setBroughtByInput] = useState('');
  const receivedByInputRef = useRef(null);
  const broughtByInputRef = useRef(null);

  // Form State: Item to Add
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  const [focusedItemIndex, setFocusedItemIndex] = useState(-1);
  const itemInputRef = useRef(null);
  const itemDropdownRef = useRef(null);

  // Form State: Quantity, Unit, Unit Rate
  const [quantityInput, setQuantityInput] = useState('');
  const [unitInput, setUnitInput] = useState('KG');
  const [customUnitInput, setCustomUnitInput] = useState('');
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  const [unitRateInput, setUnitRateInput] = useState('');
  const qtyInputRef = useRef(null);
  const rateInputRef = useRef(null);

  // Edit Line State (if user is editing an item currently in the right-side list)
  const [editingIndex, setEditingIndex] = useState(-1);

  // Temporary list of items being added (Right Panel)
  const [itemsList, setItemsList] = useState([]);

  // Automatically calculate Total Rate = Quantity * Unit Rate
  const calculatedTotalRate = useMemo(() => {
    const q = parseFloat(quantityInput);
    const r = parseFloat(unitRateInput);
    if (!isNaN(q) && q > 0 && !isNaN(r) && r >= 0) {
      return Math.round(q * r * 100) / 100;
    }
    return 0;
  }, [quantityInput, unitRateInput]);

  // Grand Total: Sum of Total Rates of all items in the list
  const grandTotal = useMemo(() => {
    return itemsList.reduce((sum, item) => sum + (item.totalRate || 0), 0);
  }, [itemsList]);

  // Entry History State & Date Filter (Following Reports page standardized date filter)
  const [historyViewMode, setHistoryViewMode] = useState('summary'); // 'summary' (default) | 'details'
  const [vendorReportData, setVendorReportData] = useState({
    summaryRows: [],
    detailsGroups: [],
    totalVendors: 0,
    grandTotalAmount: 0,
    grandTotalQuantityFormatted: '0'
  });
  const [directPrintingReport, setDirectPrintingReport] = useState(false);
  const [downloadingReportPdf, setDownloadingReportPdf] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedEntryDetails, setSelectedEntryDetails] = useState(null);
  const [historyDateMode, setHistoryDateMode] = useState('today');
  const [historyFromDateInput, setHistoryFromDateInput] = useState(getTodayDateString());
  const [historyToDateInput, setHistoryToDateInput] = useState(getTodayDateString());
  const [appliedHistoryFromDate, setAppliedHistoryFromDate] = useState(getTodayDateString());
  const [appliedHistoryToDate, setAppliedHistoryToDate] = useState(getTodayDateString());
  const [historyDateRangeError, setHistoryDateRangeError] = useState(null);

  // Draft session caching to preserve form values when switching to Add Items and back
  const DRAFT_KEY = 'annamithra_vendor_entry_draft';

  const saveDraftToSession = (extra = {}) => {
    try {
      const draft = {
        vendorInput,
        selectedVendor,
        entryDate,
        paymentMode,
        receivedByInput,
        broughtByInput,
        itemsList,
        quantityInput,
        unitInput,
        customUnitInput,
        isCustomUnit,
        unitRateInput,
        ...extra
      };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      console.error('Failed to save draft to sessionStorage', e);
    }
  };

  const restoreDraftFromSession = () => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (!saved) return null;
      const draft = JSON.parse(saved);
      if (draft.vendorInput !== undefined) setVendorInput(draft.vendorInput);
      if (draft.selectedVendor !== undefined) setSelectedVendor(draft.selectedVendor);
      if (draft.entryDate !== undefined) setEntryDate(draft.entryDate);
      if (draft.paymentMode !== undefined) setPaymentMode(draft.paymentMode);
      if (draft.receivedByInput !== undefined) setReceivedByInput(draft.receivedByInput);
      if (draft.broughtByInput !== undefined) setBroughtByInput(draft.broughtByInput);
      if (Array.isArray(draft.itemsList) && draft.itemsList.length > 0) setItemsList(draft.itemsList);
      if (draft.quantityInput !== undefined) setQuantityInput(draft.quantityInput);
      if (draft.unitInput !== undefined) setUnitInput(draft.unitInput);
      if (draft.customUnitInput !== undefined) setCustomUnitInput(draft.customUnitInput);
      if (draft.isCustomUnit !== undefined) setIsCustomUnit(draft.isCustomUnit);
      if (draft.unitRateInput !== undefined) setUnitRateInput(draft.unitRateInput);
      return draft;
    } catch (e) {
      console.error('Failed to restore draft from sessionStorage', e);
      return null;
    }
  };

  const clearDraftFromSession = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch (e) {
      console.error('Failed to clear draft from sessionStorage', e);
    }
  };

  // -------------------------------------------------------------
  // INITIAL DATA LOAD
  // -------------------------------------------------------------
  const loadData = async () => {
    try {
      setLoadingInitial(true);
      const [items, vList, catList] = await Promise.all([
        api.getItems(),
        api.getVendors().catch(() => []),
        api.getCategories(false).catch(() => [])
      ]);
      if (Array.isArray(items)) setCatalogueItems(items);
      if (Array.isArray(vList)) setVendors(vList);
      if (Array.isArray(catList)) setCategories(catList);
    } catch (err) {
      console.error('Failed to load catalogue / vendors', err);
      if (showAlert) showAlert('error', err.message || t('Failed to load catalogue items'));
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    loadData();
    restoreDraftFromSession();
  }, []);

  // When returning from Add Items Catalogue with a newly created item
  useEffect(() => {
    if (newlyCreatedItem) {
      // 1. Restore draft form values (vendor, payment mode, staging items list, etc.)
      restoreDraftFromSession();

      // 2. Refresh catalogue items from API
      api.getItems().then((freshItems) => {
        if (Array.isArray(freshItems)) {
          setCatalogueItems(freshItems);
          if (onCatalogueUpdated) onCatalogueUpdated(freshItems);
        }

        // 3. Automatically select the newly created item
        const itemToSelect = (Array.isArray(freshItems) ? freshItems.find(it => it.id === newlyCreatedItem.id) : null) || newlyCreatedItem;
        handleSelectItem(itemToSelect);

        // 4. Move focus to Quantity field so user can immediately type quantity
        setTimeout(() => {
          qtyInputRef.current?.focus();
        }, 120);

        if (showAlert) {
          showAlert('success', isTa
            ? `✓ "${itemToSelect.name}" பொருள் பட்டியலில் சேர்க்கப்பட்டு தேர்ந்தெடுக்கப்பட்டது. அளவையும் விலையையும் உள்ளிடவும்.`
            : `✓ "${itemToSelect.name}" added to catalogue and selected. Enter quantity and unit rate.`);
        }
      }).catch(err => {
        console.error('Failed to reload catalogue items after creation', err);
        handleSelectItem(newlyCreatedItem);
        setTimeout(() => {
          qtyInputRef.current?.focus();
        }, 120);
      });

      // 5. Clear newlyCreatedItem in parent to avoid duplicate selection
      if (onClearNewlyCreatedItem) {
        onClearNewlyCreatedItem();
      }
    }
  }, [newlyCreatedItem]);

  // Close autocomplete dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (vendorDropdownRef.current && !vendorDropdownRef.current.contains(e.target)) {
        setShowVendorSuggestions(false);
      }
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(e.target)) {
        setShowItemSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // -------------------------------------------------------------
  // VENDOR SEARCH & AUTOCOMPLETE (Keyboard + Mouse)
  // -------------------------------------------------------------
  const handleVendorInputChange = (val) => {
    setVendorInput(val);
    setSelectedVendor(null);
    setFocusedVendorIndex(-1);
    if (!val.trim()) {
      setVendorSuggestions([]);
      setShowVendorSuggestions(false);
      return;
    }
    const q = val.trim().toLowerCase();
    const matches = vendors.filter(v => v.name && v.name.toLowerCase().includes(q));
    setVendorSuggestions(matches);
    setShowVendorSuggestions(true);
  };

  const handleSelectVendor = (v) => {
    if (!v) return;
    setSelectedVendor(v);
    setVendorInput(v.name);
    setShowVendorSuggestions(false);
    setFocusedVendorIndex(-1);
    // After selection, automatically move focus to Received By input
    setTimeout(() => {
      receivedByInputRef.current?.focus();
    }, 50);
  };

  const handleVendorKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!showVendorSuggestions && vendorSuggestions.length > 0) {
        setShowVendorSuggestions(true);
        setFocusedVendorIndex(0);
        return;
      }
      if (vendorSuggestions.length > 0) {
        setFocusedVendorIndex(prev => (prev + 1) % vendorSuggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (vendorSuggestions.length > 0) {
        setFocusedVendorIndex(prev => (prev <= 0 ? vendorSuggestions.length - 1 : prev - 1));
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowVendorSuggestions(false);
      setFocusedVendorIndex(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (showVendorSuggestions && focusedVendorIndex >= 0 && focusedVendorIndex < vendorSuggestions.length) {
        handleSelectVendor(vendorSuggestions[focusedVendorIndex]);
      } else if (showVendorSuggestions && vendorSuggestions.length > 0) {
        handleSelectVendor(vendorSuggestions[0]);
      } else {
        // Dropdown closed or manual vendor name entered
        setShowVendorSuggestions(false);
        setFocusedVendorIndex(-1);
        setTimeout(() => {
          receivedByInputRef.current?.focus();
        }, 50);
      }
    }
  };

  // -------------------------------------------------------------
  // ITEM SEARCH & AUTOCOMPLETE (Keyboard + Automatic Navigation)
  // -------------------------------------------------------------
  const handleItemSearchChange = (val) => {
    setItemSearchQuery(val);
    setSelectedItem(null);
    setFocusedItemIndex(-1);
    if (!val.trim()) {
      setItemSuggestions([]);
      setShowItemSuggestions(false);
      return;
    }
    const q = val.trim().toLowerCase();
    const matches = catalogueItems.filter(it => it.name && it.name.toLowerCase().includes(q));
    setItemSuggestions(matches.slice(0, 15));
    setShowItemSuggestions(true);
  };

  const handleSelectItem = (it) => {
    if (!it) return;
    setSelectedItem(it);
    setItemSearchQuery(it.name);
    setShowItemSuggestions(false);
    setFocusedItemIndex(-1);

    // Default unit from selected item
    if (it.unit) {
      const u = it.unit.toUpperCase().trim();
      if (STANDARD_UNITS.includes(u)) {
        setUnitInput(u);
        setIsCustomUnit(false);
      } else {
        setUnitInput('__CUSTOM__');
        setCustomUnitInput(it.unit);
        setIsCustomUnit(true);
      }
    }
    // Automatically move focus to Quantity input
    setTimeout(() => {
      qtyInputRef.current?.focus();
    }, 50);
  };

  const handleItemKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!showItemSuggestions && itemSuggestions.length > 0) {
        setShowItemSuggestions(true);
        setFocusedItemIndex(0);
        return;
      }
      if (itemSuggestions.length > 0) {
        setFocusedItemIndex(prev => (prev + 1) % itemSuggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (itemSuggestions.length > 0) {
        setFocusedItemIndex(prev => (prev <= 0 ? itemSuggestions.length - 1 : prev - 1));
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowItemSuggestions(false);
      setFocusedItemIndex(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault(); // Prevent accidental form submit
      const trimmedQuery = (itemSearchQuery || '').trim();
      if (!trimmedQuery) return;

      // 1. If user highlighted a suggestion via arrow keys
      if (showItemSuggestions && focusedItemIndex >= 0 && focusedItemIndex < itemSuggestions.length) {
        handleSelectItem(itemSuggestions[focusedItemIndex]);
        return;
      }

      // 2. Exact match in existing catalogue items (case-insensitive)
      const exactMatch = catalogueItems.find(it =>
        it.name && it.name.trim().toLowerCase() === trimmedQuery.toLowerCase()
      );
      if (exactMatch) {
        handleSelectItem(exactMatch);
        return;
      }

      // 3. First item in filtered suggestions if visible
      if (showItemSuggestions && itemSuggestions.length > 0) {
        handleSelectItem(itemSuggestions[0]);
        return;
      }

      // 4. Case-insensitive substring match fallback across catalogue items
      const subMatch = catalogueItems.find(it =>
        it.name && it.name.trim().toLowerCase().includes(trimmedQuery.toLowerCase())
      );
      if (subMatch) {
        handleSelectItem(subMatch);
        return;
      }

      // 5. NO MATCHING ITEM EXISTS -> Automatically navigate to Add Items Catalogue
      setShowItemSuggestions(false);
      setFocusedItemIndex(-1);
      saveDraftToSession();

      if (onNavigateToAddItems) {
        onNavigateToAddItems(trimmedQuery);
      } else if (showAlert) {
        showAlert('error', isTa
          ? `"${trimmedQuery}" பொருள் பட்டியலில் இல்லை.`
          : `Item "${trimmedQuery}" not found in catalogue.`);
      }
    }
  };

  // -------------------------------------------------------------
  // ADD / UPDATE ITEM IN TEMPORARY LIST
  // -------------------------------------------------------------
  const handleAddOrUpdateItem = (e) => {
    if (e) e.preventDefault();

    // 1. Validate Item Selection
    let itemToUse = selectedItem;
    if (!itemToUse && itemSearchQuery.trim()) {
      const exact = catalogueItems.find(it => it.name && it.name.trim().toLowerCase() === itemSearchQuery.trim().toLowerCase());
      if (exact) {
        itemToUse = exact;
      }
    }

    if (!itemToUse) {
      if (showAlert) showAlert('error', t('Please select an existing item from the catalogue.', 'பட்டியலில் உள்ள பொருளைத் தேர்ந்தெடுக்கவும்.'));
      itemInputRef.current?.focus();
      return;
    }

    // 2. Validate Quantity
    const parsedQty = parseFloat(quantityInput);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      if (showAlert) showAlert('error', t('Quantity must be greater than zero.', 'அளவு பூஜ்ஜியத்தை விட அதிகமாக இருக்க வேண்டும்.'));
      qtyInputRef.current?.focus();
      return;
    }

    // 3. Validate Unit Rate
    const parsedRate = parseFloat(unitRateInput);
    if (isNaN(parsedRate) || parsedRate < 0) {
      if (showAlert) showAlert('error', t('Unit rate must be a valid non-negative number.', 'அலகு விலை செல்லுபடியாகும் எண்ணாக இருக்க வேண்டும்.'));
      rateInputRef.current?.focus();
      return;
    }

    // 4. Calculate Total Rate
    const itemTotalRate = Math.round(parsedQty * parsedRate * 100) / 100;

    // 5. Resolve Unit
    let finalUnit = isCustomUnit ? (customUnitInput || '').trim() : unitInput;
    if (!finalUnit) finalUnit = itemToUse.unit || 'KG';

    const newItemLine = {
      tempId: editingIndex >= 0 ? itemsList[editingIndex].tempId : Date.now() + Math.random(),
      itemId: itemToUse.id,
      itemName: itemToUse.name,
      category: itemToUse.category || 'General',
      quantity: parsedQty,
      unit: finalUnit,
      unitRate: parsedRate,
      totalRate: itemTotalRate
    };

    if (editingIndex >= 0) {
      // Update existing line
      const updated = [...itemsList];
      updated[editingIndex] = newItemLine;
      setItemsList(updated);
      setEditingIndex(-1);
      if (showAlert) showAlert('success', isTa ? 'பொருள் மாற்றப்பட்டது.' : 'Item updated in entry list.');
    } else {
      // Check duplicate in current list
      const existingLineIndex = itemsList.findIndex(l => l.itemId === itemToUse.id);
      if (existingLineIndex >= 0) {
        const updated = [...itemsList];
        const newMergedQty = Math.round((updated[existingLineIndex].quantity + parsedQty) * 1000) / 1000;
        const newTotalRate = Math.round(newMergedQty * parsedRate * 100) / 100;
        updated[existingLineIndex] = {
          ...updated[existingLineIndex],
          quantity: newMergedQty,
          unitRate: parsedRate,
          totalRate: newTotalRate
        };
        setItemsList(updated);
        if (showAlert) showAlert('info', isTa
          ? `"${itemToUse.name}" ஏற்கனவே பட்டியலில் உள்ளது. அளவு ${newMergedQty} ஆக புதுப்பிக்கப்பட்டது.`
          : `"${itemToUse.name}" was already in list. Quantity updated to ${newMergedQty}.`);
      } else {
        setItemsList([...itemsList, newItemLine]);
      }
    }

    // Reset item inputs
    setItemSearchQuery('');
    setSelectedItem(null);
    setQuantityInput('');
    setUnitRateInput('');
    setIsCustomUnit(false);
    setCustomUnitInput('');
    itemInputRef.current?.focus();
  };

  const handleEditItem = (index) => {
    const line = itemsList[index];
    if (!line) return;
    setEditingIndex(index);
    setItemSearchQuery(line.itemName);
    const catItem = catalogueItems.find(it => it.id === line.itemId) || { id: line.itemId, name: line.itemName, unit: line.unit };
    setSelectedItem(catItem);
    setQuantityInput(String(line.quantity));
    setUnitRateInput(line.unitRate !== undefined ? String(line.unitRate) : '');

    const u = (line.unit || '').toUpperCase().trim();
    if (STANDARD_UNITS.includes(u)) {
      setUnitInput(u);
      setIsCustomUnit(false);
    } else {
      setUnitInput('__CUSTOM__');
      setCustomUnitInput(line.unit);
      setIsCustomUnit(true);
    }
    qtyInputRef.current?.focus();
  };

  const handleRemoveItem = (index) => {
    const updated = itemsList.filter((_, i) => i !== index);
    setItemsList(updated);
    if (editingIndex === index) {
      setEditingIndex(-1);
      setItemSearchQuery('');
      setSelectedItem(null);
      setQuantityInput('');
      setUnitRateInput('');
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(-1);
    setItemSearchQuery('');
    setSelectedItem(null);
    setQuantityInput('');
    setUnitRateInput('');
    setIsCustomUnit(false);
    setCustomUnitInput('');
  };

  // -------------------------------------------------------------
  // PRINT / DOWNLOAD PDF (ITEMS BEING ADDED)
  // -------------------------------------------------------------
  const handlePrintPdf = async () => {
    if (itemsList.length === 0) {
      if (showAlert) showAlert('error', t('No items to print. Please add at least one item.', 'அச்சிட எந்தப் பொருட்களும் இல்லை. குறைந்தது ஒரு பொருளைச் சேர்க்கவும்.'));
      return;
    }

    try {
      setGeneratingPdf(true);
      await downloadVendorInventoryEntryPdf({
        vendorName: vendorInput.trim() || 'Direct Vendor Receipt',
        entryDate: entryDate || getTodayDateString(),
        paymentMode,
        receivedBy: receivedByInput.trim(),
        broughtBy: broughtByInput.trim(),
        items: itemsList,
        grandTotal,
        language
      });

      if (showAlert) {
        showAlert('success', isTa
          ? '✓ வரவு ரசீது PDF வெற்றிகரமாக பதிவிறக்கப்பட்டது!'
          : '✓ Vendor entry receipt PDF downloaded successfully!');
      }
    } catch (err) {
      console.error('Failed to generate vendor entry PDF', err);
      if (showAlert) showAlert('error', err.message || t('Failed to generate PDF'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  // DIRECT PRINT (ITEMS BEING ADDED)
  const handleDirectPrintEntry = async () => {
    if (itemsList.length === 0) {
      if (showAlert) showAlert('error', t('No items to print. Please add at least one item.', 'அச்சிட எந்தப் பொருட்களும் இல்லை. குறைந்தது ஒரு பொருளைச் சேர்க்கவும்.'));
      return;
    }

    try {
      setDirectPrintingEntry(true);
      await printVendorInventoryEntryDirect({
        vendorName: vendorInput.trim() || 'Direct Vendor Receipt',
        entryDate: entryDate || getTodayDateString(),
        paymentMode,
        receivedBy: receivedByInput.trim(),
        broughtBy: broughtByInput.trim(),
        items: itemsList,
        grandTotal,
        language
      });
    } catch (err) {
      console.error('Failed to directly print vendor entry', err);
      if (showAlert) showAlert('error', err.message || t('Failed to print receipt.'));
    } finally {
      setDirectPrintingEntry(false);
    }
  };

  // -------------------------------------------------------------
  // SAVE COMPLETE VENDOR INVENTORY ENTRY
  // -------------------------------------------------------------
  const handleSaveInventoryEntry = async () => {
    const cleanVendorName = vendorInput.trim();
    if (!cleanVendorName) {
      if (showAlert) showAlert('error', t('Vendor name is required.', 'விற்பனையாளர் பெயரை உள்ளிடவும்.'));
      vendorInputRef.current?.focus();
      return;
    }

    if (itemsList.length === 0) {
      if (showAlert) showAlert('error', t('Please add at least one item before saving.', 'சேமிக்க குறைந்தது ஒரு பொருளை சேர்க்கவும்.'));
      itemInputRef.current?.focus();
      return;
    }

    const clientSubmissionId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    const payload = {
      vendorId: selectedVendor?.id || null,
      vendorName: cleanVendorName,
      entryDate: entryDate || getTodayDateString(),
      paymentMode: paymentMode || 'CASH',
      receivedBy: receivedByInput.trim() || null,
      broughtBy: broughtByInput.trim() || null,
      clientSubmissionId,
      items: itemsList.map(it => ({
        itemId: it.itemId,
        itemName: it.itemName,
        unit: it.unit,
        quantity: it.quantity,
        unitRate: it.unitRate || 0.0,
        totalRate: it.totalRate || 0.0
      }))
    };

    try {
      setSavingEntry(true);
      const res = await api.saveVendorEntry(payload);

      if (showAlert) {
        showAlert('success', isTa
          ? `✓ விற்பனையாளர் வரவு (${res.entryNumber || 'VND'}) வெற்றிகரமாக சேமிக்கப்பட்டது! மொத்தம்: ₹${(res.grandTotal || grandTotal).toFixed(2)}.`
          : `✓ Vendor inventory entry (${res.entryNumber || 'VND'}) saved successfully! Grand Total: ₹${(res.grandTotal || grandTotal).toFixed(2)}.`);
      }

      // Reset form
      setItemsList([]);
      setVendorInput('');
      setSelectedVendor(null);
      setReceivedByInput('');
      setBroughtByInput('');
      setItemSearchQuery('');
      setSelectedItem(null);
      setQuantityInput('');
      setUnitRateInput('');
      setEditingIndex(-1);
      clearDraftFromSession();

      if (onInventoryUpdated) {
        onInventoryUpdated();
      }

      api.getVendors().then(vList => {
        if (Array.isArray(vList)) setVendors(vList);
      }).catch(() => {});

    } catch (err) {
      console.error('Failed to save vendor entry', err);
      if (showAlert) showAlert('error', err.message || t('Failed to save vendor inventory entry.'));
    } finally {
      setSavingEntry(false);
    }
  };

  // -------------------------------------------------------------
  // ENTRY HISTORY: DATE FILTER, SUMMARY & LOADER
  // -------------------------------------------------------------
  const today = getTodayDateString();

  const formatDisplayDate = (dStr) => {
    if (!dStr) return '';
    const clean = String(dStr).slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return clean;
  };

  const loadHistory = async (fromDateOverride, toDateOverride, searchOverride) => {
    try {
      setLoadingHistory(true);
      const fDate = fromDateOverride !== undefined ? fromDateOverride : (historyDateMode === 'today' ? today : appliedHistoryFromDate);
      const tDate = toDateOverride !== undefined ? toDateOverride : (historyDateMode === 'today' ? today : appliedHistoryToDate);
      const sTerm = searchOverride !== undefined ? searchOverride : historySearch;

      const [entriesData, reportData] = await Promise.all([
        api.getVendorEntries(fDate, tDate, sTerm.trim() || null).catch(() => []),
        api.getVendorEntryReport(fDate, tDate, sTerm.trim() || null).catch(() => null)
      ]);

      if (Array.isArray(entriesData)) {
        // Sort entries by entry date and time, newest first
        const sorted = [...entriesData].sort((a, b) => {
          const dtA = a.entryDateTime ? new Date(a.entryDateTime).getTime() : (a.entryDate ? new Date(a.entryDate).getTime() : 0);
          const dtB = b.entryDateTime ? new Date(b.entryDateTime).getTime() : (b.entryDate ? new Date(b.entryDate).getTime() : 0);
          if (dtB !== dtA) return dtB - dtA;
          return (b.id || 0) - (a.id || 0);
        });
        setHistoryEntries(sorted);
      }

      if (reportData && typeof reportData === 'object') {
        setVendorReportData(reportData);
      } else {
        setVendorReportData({
          summaryRows: [],
          detailsGroups: [],
          totalVendors: 0,
          grandTotalAmount: 0,
          grandTotalQuantityFormatted: '0'
        });
      }
    } catch (err) {
      console.error('Failed to load vendor entry history', err);
      if (showAlert) showAlert('error', err.message || t('Failed to load vendor entry history'));
    } finally {
      setLoadingHistory(false);
    }
  };

  const effectiveHistoryFromDate = historyDateMode === 'today' ? today : appliedHistoryFromDate;
  const effectiveHistoryToDate = historyDateMode === 'today' ? today : appliedHistoryToDate;

  const getEffectiveDateRangeLabel = () => {
    if (historyDateMode === 'today') {
      return isTa ? `இன்று (${formatDisplayDate(today)})` : `Today (${formatDisplayDate(today)})`;
    }
    return `${formatDisplayDate(effectiveHistoryFromDate)} – ${formatDisplayDate(effectiveHistoryToDate)}`;
  };

  const isReportDataAvailable =
    (Array.isArray(vendorReportData?.summaryRows) && vendorReportData.summaryRows.length > 0) ||
    (Array.isArray(vendorReportData?.detailsGroups) && vendorReportData.detailsGroups.length > 0) ||
    (Array.isArray(historyEntries) && historyEntries.length > 0);

  const handleDirectPrintReport = async () => {
    try {
      if (!isReportDataAvailable) {
        if (showAlert) showAlert('error', t('No vendor records found to print for the selected period.', 'தேர்ந்தெடுக்கப்பட்ட காலத்திற்கு அச்சிட பதிவுகள் எதுவும் இல்லை.'));
        return;
      }
      setDirectPrintingReport(true);
      const dateRangeLabel = getEffectiveDateRangeLabel();

      await printVendorEntryReportDirect({
        viewMode: historyViewMode,
        reportData: vendorReportData,
        dateRangeLabel,
        language
      });
    } catch (err) {
      console.error('Failed to direct print vendor entry report', err);
      if (showAlert) showAlert('error', t('Failed to print receipt. Please check printer settings.'));
    } finally {
      setDirectPrintingReport(false);
    }
  };

  const handleDownloadPdfReport = async () => {
    try {
      if (!isReportDataAvailable) {
        if (showAlert) showAlert('error', t('No vendor records found to download PDF for the selected period.', 'தேர்ந்தெடுக்கப்பட்ட காலத்திற்கு PDF பதிவிறக்க பதிவுகள் எதுவும் இல்லை.'));
        return;
      }
      setDownloadingReportPdf(true);
      const dateRangeLabel = getEffectiveDateRangeLabel();

      await downloadVendorEntryReportPdf({
        viewMode: historyViewMode,
        reportData: vendorReportData,
        dateRangeLabel,
        language
      });
    } catch (err) {
      console.error('Failed to download vendor entry report PDF', err);
      if (showAlert) showAlert('error', t('Failed to generate PDF. Please try again.'));
    } finally {
      setDownloadingReportPdf(false);
    }
  };

  const handleSelectTodayMode = () => {
    if (historyDateMode !== 'today') {
      setHistoryDateMode('today');
      setHistoryDateRangeError(null);
      setAppliedHistoryFromDate(today);
      setAppliedHistoryToDate(today);
      loadHistory(today, today, historySearch);
    }
  };

  const handleSelectCustomMode = () => {
    if (historyDateMode !== 'custom') {
      setHistoryDateMode('custom');
      setHistoryDateRangeError(null);
      const f = appliedHistoryFromDate || historyFromDateInput || today;
      const t = appliedHistoryToDate || historyToDateInput || today;
      setHistoryFromDateInput(f);
      setHistoryToDateInput(t);
    }
  };

  const handleApplyHistoryCustomRange = () => {
    if (!historyFromDateInput || !historyToDateInput) {
      setHistoryDateRangeError(isTa
        ? 'தொடக்க தேதி மற்றும் முடிவு தேதி இரண்டையும் தேர்ந்தெடுக்கவும்.'
        : 'Please select both From Date and To Date.');
      return;
    }
    if (historyFromDateInput > historyToDateInput) {
      setHistoryDateRangeError(isTa
        ? 'தொடக்க தேதி முடிவு தேதியை விட பிந்தையதாக இருக்கக்கூடாது.'
        : 'From Date cannot be later than To Date.');
      return;
    }
    setHistoryDateRangeError(null);
    setAppliedHistoryFromDate(historyFromDateInput);
    setAppliedHistoryToDate(historyToDateInput);
    loadHistory(historyFromDateInput, historyToDateInput, historySearch);
  };

  // Client-side search filtering across current loaded entries
  const filteredHistoryEntries = useMemo(() => {
    if (!historySearch.trim()) return historyEntries;
    const q = historySearch.trim().toLowerCase();
    return historyEntries.filter(e =>
      (e.vendorName && e.vendorName.toLowerCase().includes(q)) ||
      (e.entryNumber && e.entryNumber.toLowerCase().includes(q)) ||
      (e.paymentMode && e.paymentMode.toLowerCase().includes(q)) ||
      (e.receivedBy && e.receivedBy.toLowerCase().includes(q)) ||
      (e.broughtBy && e.broughtBy.toLowerCase().includes(q))
    );
  }, [historyEntries, historySearch]);

  // Summary Metrics calculated ONLY from the filtered entries
  const historySummary = useMemo(() => {
    const list = filteredHistoryEntries;
    const totalEntries = list.length;
    const totalItems = list.reduce((sum, e) => sum + (Number(e.totalItems) || 0), 0);
    const totalQuantity = list.reduce((sum, e) => sum + (Number(e.totalQuantity) || 0), 0);
    const grandTotal = list.reduce((sum, e) => sum + (Number(e.grandTotal) || 0), 0);

    return {
      totalEntries,
      totalItems,
      totalQuantity: Math.round(totalQuantity * 1000) / 1000,
      grandTotal: Math.round(grandTotal * 100) / 100
    };
  }, [filteredHistoryEntries]);

  useEffect(() => {
    if (subTab === 'history') {
      loadHistory();
    }
    // Only re-run when switching subTab, avoid infinite loop on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab]);

  const totalItemCount = itemsList.length;
  const totalQuantitySum = itemsList.reduce((sum, line) => sum + (line.quantity || 0), 0);

  return (
    <div className="vendor-entry-container">
      {/* 1. Header Toolbar with Subnav Toggle */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        padding: '4px 0 8px',
        flexWrap: 'wrap',
        gap: 12,
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 18, color: 'var(--primary-dark-green)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🏢</span> {t('Vendor Inventory Entry', 'விற்பனையாளர் இருப்பு வரவு')}
          </h3>
          <span className="muted" style={{ fontSize: 13 }}>
            • {t('Add physical goods received from vendors directly to Central Inventory', 'விற்பனையாளர்களிடமிருந்து பெறப்பட்ட பொருட்களை மைய இருப்பில் நேரடியாகச் சேர்க்கவும்')}
          </span>
        </div>

        {/* Subnav Pill Buttons */}
        <div className="subnav" style={{ margin: 0, padding: 0 }}>
          <button
            type="button"
            className={`subnav-btn ${subTab === 'entry' ? 'active' : ''}`}
            onClick={() => setSubTab('entry')}
            style={{ fontSize: 12, padding: '5px 14px' }}
          >
            <span>➕</span> {t('New Vendor Entry', 'புதிய விற்பனையாளர் வரவு')}
          </button>
          <button
            type="button"
            className={`subnav-btn ${subTab === 'history' ? 'active' : ''}`}
            onClick={() => {
              setSubTab('history');
              loadHistory();
            }}
            style={{ fontSize: 12, padding: '5px 14px' }}
          >
            <span>📑</span> {t('Entry History', 'வரவு வரலாறு')}
          </button>
        </div>
      </div>

      {/* =========================================================
          VIEW A: NEW VENDOR ENTRY (Two-Column Side-by-Side Grid)
          ========================================================= */}
      {subTab === 'entry' && (
        <div className="branch-order-grid">
          {/* LEFT PANEL: Vendor & Item Details Form */}
          <div className="card branch-order-form-card">
            <div className="card-header branch-card-header" style={{ padding: '10px 14px 6px' }}>
              <div>
                <h4 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, margin: 0 }}>
                  <span>📝</span> {t('Vendor & Item Details', 'விற்பனையாளர் & பொருள் விவரங்கள்')}
                </h4>
                <p className="muted" style={{ margin: '3px 0 0', fontSize: 12 }}>
                  {t('Enter vendor and select catalogue items with quantities and unit rates', 'விற்பனையாளரை உள்ளிட்டு பொருட்கள், அளவுகள் மற்றும் விலையைச் சேர்க்கவும்')}
                </p>
              </div>
            </div>

            <div style={{ padding: '12px 14px' }}>
              {/* 1. Vendor Selection / Entry */}
              <div style={{ marginBottom: 14, position: 'relative' }} ref={vendorDropdownRef}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 5 }}>
                  <span>{t('Vendor Name', 'விற்பனையாளர் பெயர்')} *</span>
                  {selectedVendor && (
                    <span className="badge badge-completed" style={{ fontSize: 10 }}>
                      ✓ {t('Existing Vendor', 'ஏற்கனவே உள்ள விற்பனையாளர்')}
                    </span>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    ref={vendorInputRef}
                    type="text"
                    placeholder={isTa ? 'விற்பனையாளர் பெயரை உள்ளிடவும் (எ.கா. ABC Suppliers)...' : 'Enter vendor name (e.g. ABC Suppliers)...'}
                    value={vendorInput}
                    onChange={e => handleVendorInputChange(e.target.value)}
                    onKeyDown={handleVendorKeyDown}
                    onFocus={() => {
                      if (vendorInput.trim()) {
                        handleVendorInputChange(vendorInput);
                      }
                    }}
                    style={{ fontSize: 13, padding: '7px 10px', width: '100%' }}
                    autoComplete="off"
                  />
                  {vendorInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setVendorInput('');
                        setSelectedVendor(null);
                        setVendorSuggestions([]);
                        setShowVendorSuggestions(false);
                        setFocusedVendorIndex(-1);
                      }}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#999',
                        cursor: 'pointer',
                        padding: 4,
                        fontSize: 12
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {showVendorSuggestions && vendorSuggestions.length > 0 && (
                  <div
                    className="autocomplete-dropdown"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      background: '#fff',
                      border: '1px solid var(--border-color)',
                      borderRadius: 6,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                      maxHeight: 200,
                      overflowY: 'auto'
                    }}
                  >
                    {vendorSuggestions.map((v, idx) => (
                      <div
                        key={v.id}
                        onClick={() => handleSelectVendor(v)}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: 13,
                          borderBottom: '1px solid #f0f0f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: idx === focusedVendorIndex ? '#e8f5e9' : '#fff',
                          outline: idx === focusedVendorIndex ? '1px solid var(--primary-dark-green)' : 'none'
                        }}
                        onMouseEnter={() => setFocusedVendorIndex(idx)}
                      >
                        <span style={{ fontWeight: idx === focusedVendorIndex ? 700 : 600 }}>{v.name}</span>
                        {v.contactPhone && <span className="muted" style={{ fontSize: 11 }}>📞 {v.contactPhone}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Entry Date & Mode of Payment Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>
                    📅 {t('Entry Date', 'வரவு தேதி')}
                  </label>
                  <input
                    type="date"
                    value={entryDate || ''}
                    onChange={e => setEntryDate(e.target.value)}
                    style={{ fontSize: 12, padding: '5px 8px', width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>
                    💳 {t('Mode of Payment', 'பணம் செலுத்தும் முறை')} *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                    style={{ fontSize: 12, padding: '5px 8px', width: '100%', height: 32 }}
                  >
                    {PAYMENT_MODES.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.icon} {isTa ? m.labelTa : m.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Received By & Brought By Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>
                    👤 {t('Received By', 'பெற்றவர்')}
                  </label>
                  <input
                    ref={receivedByInputRef}
                    type="text"
                    placeholder={isTa ? 'பெற்றவர் பெயரை உள்ளிடவும்...' : 'Enter receiver name...'}
                    value={receivedByInput}
                    onChange={e => setReceivedByInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        broughtByInputRef.current?.focus();
                      }
                    }}
                    style={{ fontSize: 12, padding: '5px 8px', width: '100%' }}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--green)', marginBottom: 4 }}>
                    🚚 {t('Brought By', 'கொண்டு வந்தவர்')}
                  </label>
                  <input
                    ref={broughtByInputRef}
                    type="text"
                    placeholder={isTa ? 'கொண்டு வந்தவர் பெயரை உள்ளிடவும்...' : 'Enter delivery person name...'}
                    value={broughtByInput}
                    onChange={e => setBroughtByInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        itemInputRef.current?.focus();
                      }
                    }}
                    style={{ fontSize: 12, padding: '5px 8px', width: '100%' }}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px dashed var(--border-color)', margin: '14px 0 12px' }} />

              {/* 3. Item Selection Form */}
              <form onSubmit={handleAddOrUpdateItem}>
                <div style={{ marginBottom: 12, position: 'relative' }} ref={itemDropdownRef}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                    <span>{t('Select Item from Catalogue', 'பொருளைத் தேர்ந்தெடுக்கவும்')} *</span>
                    {selectedItem && (
                      <span className="muted" style={{ fontSize: 11, fontWeight: 500 }}>
                        {t('Current Stock', 'தற்போதைய இருப்பு')}: <b>{selectedItem.stock || 0} {translateUnit(selectedItem.unit)}</b>
                      </span>
                    )}
                  </label>
                  <input
                    ref={itemInputRef}
                    type="text"
                    placeholder={isTa ? 'பொருளின் பெயரை உள்ளிடவும்... (தேர்வு செய்ய அல்லது சேர்க்க Enter)' : 'Type item name to search... (press Enter to select or add)'}
                    value={itemSearchQuery}
                    onChange={e => handleItemSearchChange(e.target.value)}
                    onKeyDown={handleItemKeyDown}
                    onFocus={() => {
                      if (itemSearchQuery.trim()) {
                        handleItemSearchChange(itemSearchQuery);
                      }
                    }}
                    style={{ fontSize: 13, padding: '7px 10px', width: '100%' }}
                    autoComplete="off"
                  />

                  {/* Item Autocomplete Dropdown */}
                  {showItemSuggestions && (
                    <div
                      className="autocomplete-dropdown"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        background: '#fff',
                        border: '1px solid var(--border-color)',
                        borderRadius: 6,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                        maxHeight: 250,
                        overflowY: 'auto'
                      }}
                    >
                      {itemSuggestions.length > 0 ? (
                        itemSuggestions.map((it, idx) => (
                          <div
                            key={it.id}
                            onClick={() => handleSelectItem(it)}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              fontSize: 13,
                              borderBottom: '1px solid #f0f0f0',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: idx === focusedItemIndex ? '#e8f5e9' : '#fff',
                              outline: idx === focusedItemIndex ? '1px solid var(--primary-dark-green)' : 'none'
                            }}
                            onMouseEnter={() => setFocusedItemIndex(idx)}
                          >
                            <div>
                              <span style={{ fontWeight: idx === focusedItemIndex ? 700 : 600 }}>{translateItem(it.name)}</span>
                              {it.category && (
                                <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>({it.category})</span>
                              )}
                            </div>
                            <span className="badge" style={{ fontSize: 11 }}>
                              {translateUnit(it.unit)}
                            </span>
                          </div>
                        ))
                      ) : (
                        itemSearchQuery.trim() && (
                          <div style={{ padding: '14px 12px', textAlign: 'center', background: '#fff' }}>
                            <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
                              {isTa
                                ? `"${itemSearchQuery}" பட்டியலில் கிடைக்கவில்லை.`
                                : `No matching items found for "${itemSearchQuery}".`}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--primary-dark-green)', fontWeight: 600 }}>
                              {isTa
                                ? `பொருட்கள் முதன்மைப் பட்டியலில் சேர்க்க Enter அழுத்தவும் ⏎`
                                : `Press Enter ⏎ to add to catalogue`}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* 4. Quantity and Unit Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
                      {t('Quantity', 'அளவு')} *
                    </label>
                    <input
                      ref={qtyInputRef}
                      type="number"
                      step="any"
                      min="0.001"
                      placeholder={isTa ? 'எ.கா. 25 அல்லது 1.5' : 'e.g. 25 or 1.5'}
                      value={quantityInput}
                      onChange={e => setQuantityInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          rateInputRef.current?.focus();
                        }
                      }}
                      style={{ fontSize: 13, padding: '7px 10px', width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
                      {t('Unit', 'அலகு')} *
                    </label>
                    <select
                      value={isCustomUnit ? '__CUSTOM__' : unitInput}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '__CUSTOM__') {
                          setIsCustomUnit(true);
                        } else {
                          setIsCustomUnit(false);
                          setUnitInput(val);
                        }
                      }}
                      style={{ fontSize: 13, padding: '7px 10px', width: '100%', height: 38 }}
                    >
                      {STANDARD_UNITS.map(u => (
                        <option key={u} value={u}>
                          {u} ({translateUnit(u)})
                        </option>
                      ))}
                      <option value="__CUSTOM__">+ {t('Custom Unit...', 'விருப்ப அலகு...')}</option>
                    </select>

                    {isCustomUnit && (
                      <input
                        type="text"
                        placeholder={t('Enter unit', 'அலகு உள்ளிடவும்')}
                        value={customUnitInput}
                        onChange={e => setCustomUnitInput(e.target.value)}
                        style={{ marginTop: 6, fontSize: 12, padding: '4px 8px', width: '100%' }}
                      />
                    )}
                  </div>
                </div>

                {/* 5. Unit Rate & Total Rate Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
                      {t('Unit Rate', 'அலகு விலை')} (₹) *
                    </label>
                    <input
                      ref={rateInputRef}
                      type="number"
                      step="any"
                      min="0"
                      placeholder={isTa ? 'எ.கா. 45.00' : 'e.g. 45.00'}
                      value={unitRateInput}
                      onChange={e => setUnitRateInput(e.target.value)}
                      style={{ fontSize: 13, padding: '7px 10px', width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
                      {t('Total Rate', 'மொத்த விலை')} (₹)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={calculatedTotalRate > 0 ? `₹ ${calculatedTotalRate.toFixed(2)}` : '₹ 0.00'}
                      style={{
                        fontSize: 13,
                        padding: '7px 10px',
                        width: '100%',
                        fontWeight: 700,
                        color: 'var(--primary-dark-green)',
                        background: 'var(--cream-surface)',
                        border: '1px solid var(--border-color)',
                        cursor: 'default'
                      }}
                    />
                  </div>
                </div>

                {/* Action Buttons: Add Item or Update */}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    type="submit"
                    className="primary"
                    style={{ flex: 1, padding: '8px 16px', fontSize: 13, fontWeight: 700 }}
                  >
                    <span>{editingIndex >= 0 ? '✓' : '➕'}</span>{' '}
                    {editingIndex >= 0
                      ? t('Update Item', 'பொருளைப் புதுப்பி')
                      : t('Add Item', 'பொருள் சேர்')}
                  </button>
                  {editingIndex >= 0 && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={handleCancelEdit}
                      style={{ padding: '8px 14px', fontSize: 12 }}
                    >
                      {t('Cancel', 'ரத்து')}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* RIGHT PANEL: Items Being Added (~58% on desktop) */}
          <div className="card branch-order-list-card">
            <div className="card-header branch-card-header" style={{ padding: '10px 14px', alignItems: 'center' }}>
              <div>
                <h4 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, margin: 0 }}>
                  <span>📦</span> {t('Items Being Added', 'சேர்க்கப்படும் பொருட்கள்')}
                </h4>
                <p className="muted" style={{ margin: '3px 0 0', fontSize: 12 }}>
                  {vendorInput.trim() ? (
                    <span>
                      {t('Vendor', 'விற்பனையாளர்')}: <b style={{ color: 'var(--primary-dark-green)' }}>{vendorInput.trim()}</b>
                      {' '}• {t('Payment Mode', 'பணம்')}: <b style={{ color: 'var(--gold)' }}>{paymentMode}</b>
                    </span>
                  ) : (
                    <span>{t('Review items and confirm inventory receipt', 'பொருட்களைச் சரிபார்த்து வரவை உறுதிப்படுத்தவும்')}</span>
                  )}
                </p>
              </div>
              <span className="badge badge-ordered" style={{ fontSize: 12, fontWeight: 700 }}>
                {totalItemCount} {t('Items', 'பொருட்கள்')}
              </span>
            </div>

            {/* Table of items added */}
            <div className="table-wrap" style={{ margin: 0, minHeight: 260, maxHeight: 420, overflowY: 'auto' }}>
              {itemsList.length > 0 ? (
                <table className="compact-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 35, textAlign: 'center' }}>#</th>
                      <th>{t('Item Name', 'பொருள் பெயர்')}</th>
                      <th>{t('Unit', 'அலகு')}</th>
                      <th style={{ textAlign: 'right' }}>{t('Quantity', 'அளவு')}</th>
                      <th style={{ textAlign: 'right' }}>{t('Unit Rate', 'அலகு விலை')} (₹)</th>
                      <th style={{ textAlign: 'right' }}>{t('Total Rate', 'மொத்த விலை')} (₹)</th>
                      <th style={{ textAlign: 'center', width: 110 }}>{t('Action', 'செயல்')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsList.map((line, idx) => (
                      <tr key={line.tempId} style={{ background: editingIndex === idx ? 'rgba(46, 125, 50, 0.08)' : undefined }}>
                        <td style={{ textAlign: 'center', color: '#888', fontSize: 12 }}>{idx + 1}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--dark-text)' }}>
                            {translateItem(line.itemName)}
                          </span>
                        </td>
                        <td>
                          <span className="badge" style={{ fontSize: 11 }}>
                            {translateUnit(line.unit)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatQuantityWithUnit(line.quantity, line.unit, isTa)}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--dark-text)', fontSize: 12 }}>
                          ₹ {(line.unitRate || 0).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary-dark-green)', fontSize: 13 }}>
                          ₹ {(line.totalRate || 0).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="secondary small"
                            onClick={() => handleEditItem(idx)}
                            style={{ padding: '3px 8px', fontSize: 11, marginRight: 6 }}
                            title="Edit this item line"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="secondary small"
                            onClick={() => handleRemoveItem(idx)}
                            style={{ padding: '3px 8px', fontSize: 11, color: '#b91c1c' }}
                            title="Remove this item line"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{
                  padding: '48px 20px',
                  textAlign: 'center',
                  background: 'var(--cream-surface)',
                  borderRadius: 6
                }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📥</div>
                  <h5 style={{ margin: '0 0 6px', color: 'var(--primary-dark-green)', fontSize: 15 }}>
                    {t('No items added yet', 'இன்னும் எந்தப் பொருட்களும் சேர்க்கப்படவில்லை')}
                  </h5>
                  <p className="muted" style={{ fontSize: 12, margin: 0, maxWidth: 320, marginInline: 'auto' }}>
                    {t('Enter vendor name and pick catalogue items on the left to build the entry list.', 'விற்பனையாளர் பெயரை உள்ளிட்டு இடதுபுறத்தில் உள்ள பொருட்களைத் தேர்ந்தெடுக்கவும்.')}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Section: Grand Total + Print & Save Action Buttons */}
            <div style={{
              padding: '14px 18px',
              background: 'var(--cream-surface)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              {/* Grand Total Row */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                paddingBottom: 10,
                borderBottom: '1px dashed var(--border-color)'
              }}>
                <div style={{ fontSize: 13 }} className="muted">
                  {t('Total Items', 'மொத்த பொருட்கள்')}: <b style={{ color: 'var(--dark-text)' }}>{totalItemCount}</b>
                  {' '}• {t('Total Quantity', 'மொத்த அளவு')}: <b style={{ color: 'var(--dark-text)' }}>{Math.round(totalQuantitySum * 1000) / 1000}</b>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary-dark-green)' }}>
                  {t('Grand Total', 'மொத்தத் தொகை')}: <span style={{ color: 'var(--gold)', fontSize: 19, marginLeft: 6 }}>₹ {grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Action Buttons Row: Print / Download PDF button, followed by Save Inventory Entry button */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap'
              }}>
                {itemsList.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="secondary"
                      id="btn-direct-print-vendor-entry"
                      onClick={handleDirectPrintEntry}
                      disabled={directPrintingEntry}
                      style={{
                        padding: '9px 18px',
                        fontSize: 13,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        borderColor: 'var(--primary-dark-green)',
                        color: 'var(--primary-dark-green)',
                        background: '#F0FDF4',
                        borderRadius: 6,
                        cursor: directPrintingEntry ? 'wait' : 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                      }}
                      title={t('Direct Print items currently added', 'தற்போது சேர்க்கப்பட்ட பொருட்களை நேரடியாக அச்சிடு')}
                    >
                      <span>{directPrintingEntry ? '⏳' : '🖨️'}</span>
                      {directPrintingEntry
                        ? t('Printing...', 'அச்சிடுகிறது...')
                        : t('Direct Print', 'நேரடி அச்சு')}
                    </button>

                    <button
                      type="button"
                      className="secondary"
                      id="btn-print-vendor-entry-pdf"
                      onClick={handlePrintPdf}
                      disabled={generatingPdf}
                      style={{
                        padding: '9px 18px',
                        fontSize: 13,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        borderColor: 'var(--primary-dark-green)',
                        color: 'var(--primary-dark-green)',
                        background: '#ffffff',
                        borderRadius: 6,
                        cursor: generatingPdf ? 'wait' : 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                      }}
                      title={t('Download PDF of items currently added', 'தற்போது சேர்க்கப்பட்ட பொருட்களின் PDF-ஐ பதிவிறக்கு')}
                    >
                      <span>{generatingPdf ? '⏳' : '📄'}</span>
                      {generatingPdf
                        ? t('Generating PDF...', 'PDF உருவாக்கப்படுகிறது...')
                        : t('Download PDF', 'PDF பதிவிறக்கு')}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  className="primary"
                  id="btn-save-vendor-inventory-entry"
                  onClick={handleSaveInventoryEntry}
                  disabled={savingEntry || itemsList.length === 0 || !vendorInput.trim()}
                  style={{
                    padding: '9px 22px',
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    borderRadius: 6
                  }}
                >
                  <span>💾</span>
                  {savingEntry
                    ? t('Saving Inventory Entry...', 'இருப்பு வரவு சேமிக்கப்படுகிறது...')
                    : t('Save Inventory Entry', 'இருப்பு வரவை சேமிக்கவும்')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          VIEW B: ENTRY HISTORY (SUMMARY & DETAILS REPORT VIEWS)
          ========================================================= */}
      {subTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 1. Filter & Controls Card (Matching Reports Page design) */}
          <div
            className="card"
            style={{
              padding: '14px 16px',
              background: 'var(--cream-surface, #FDFBF7)',
              border: '1px solid var(--border-color, #E5DDC9)',
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 15, color: 'var(--primary-dark-green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📑</span> {t('Vendor Inventory Entry History', 'விற்பனையாளர் இருப்பு வரவு வரலாறு')}
              </h4>

              {/* Action Controls: Search, Direct Print, Refresh */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder={isTa ? 'விற்பனையாளர் / பொருள் தேடுக...' : 'Search vendor or item...'}
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      loadHistory(undefined, undefined, e.target.value);
                    }
                  }}
                  style={{ fontSize: 12, padding: '5px 8px', width: 200 }}
                />

                <button
                  type="button"
                  id="btn-direct-print-history-report"
                  className="btn secondary small"
                  onClick={handleDirectPrintReport}
                  disabled={directPrintingReport}
                  style={{
                    fontSize: 12,
                    padding: '5px 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: directPrintingReport ? 'wait' : 'pointer',
                    fontWeight: 600,
                    color: 'var(--primary-dark-green)',
                    borderColor: 'var(--primary-dark-green)',
                    background: '#F0FDF4'
                  }}
                  title={t('Direct Print', 'நேரடி அச்சு')}
                >
                  <span>🖨️</span>
                  <span>{directPrintingReport ? t('Printing...', 'அச்சிடுகிறது...') : t('Direct Print', 'நேரடி அச்சு')}</span>
                </button>

                <button
                  type="button"
                  id="btn-download-history-report-pdf"
                  className="btn secondary small"
                  onClick={handleDownloadPdfReport}
                  disabled={downloadingReportPdf}
                  style={{
                    fontSize: 12,
                    padding: '5px 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: downloadingReportPdf ? 'wait' : 'pointer',
                    fontWeight: 600,
                    color: '#B45309',
                    borderColor: '#B45309',
                    background: '#FFFBEB'
                  }}
                  title={t('Download PDF', 'PDF பதிவிறக்கு')}
                >
                  <span>📄</span>
                  <span>{downloadingReportPdf ? t('Generating PDF...', 'தயாராகிறது...') : t('Download PDF', 'PDF பதிவிறக்கு')}</span>
                </button>

                <button
                  type="button"
                  className="secondary small"
                  onClick={() => loadHistory()}
                  disabled={loadingHistory}
                  style={{ fontSize: 12, padding: '5px 12px' }}
                >
                  {loadingHistory ? '↻...' : '↻ ' + t('Refresh', 'புதுப்பி')}
                </button>
              </div>
            </div>

            {/* CONTROLS ROW: REPORT VIEW TOGGLE & DATE FILTER */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10, borderTop: '1px solid var(--border-color, #E5DDC9)' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                {/* 1. Report View Toggle: Summary View vs Details View */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-dark-green)', whiteSpace: 'nowrap' }}>
                    📊 {t('Report View', 'அறிக்கை பார்வை')}:
                  </span>
                  <div style={{
                    display: 'inline-flex',
                    borderRadius: 4,
                    overflow: 'hidden',
                    border: '1px solid var(--border-color, #E5DDC9)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    <button
                      type="button"
                      className={`btn small ${historyViewMode === 'summary' ? 'primary' : 'secondary'}`}
                      onClick={() => setHistoryViewMode('summary')}
                      style={{
                        minHeight: 32,
                        padding: '5px 14px',
                        fontSize: '12.5px',
                        borderRadius: 0,
                        border: 'none',
                        fontWeight: historyViewMode === 'summary' ? 700 : 500
                      }}
                    >
                      📋 {t('Summary View', 'சுருக்கப் பார்வை')}
                    </button>
                    <button
                      type="button"
                      className={`btn small ${historyViewMode === 'details' ? 'primary' : 'secondary'}`}
                      onClick={() => setHistoryViewMode('details')}
                      style={{
                        minHeight: 32,
                        padding: '5px 14px',
                        fontSize: '12.5px',
                        borderRadius: 0,
                        border: 'none',
                        fontWeight: historyViewMode === 'details' ? 700 : 500
                      }}
                    >
                      📑 {t('Details View', 'விரிவான பார்வை')}
                    </button>
                  </div>
                </div>

                {/* 2. Date Filter Toggle: Today / Custom Range */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary-dark-green)', whiteSpace: 'nowrap' }}>
                    📅 {t('Date Filter', 'தேதி வடிகட்டி')}:
                  </span>

                  <div style={{
                    display: 'inline-flex',
                    borderRadius: 4,
                    overflow: 'hidden',
                    border: '1px solid var(--border-color, #E5DDC9)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    <button
                      type="button"
                      className={`btn small ${historyDateMode === 'today' ? 'primary' : 'secondary'}`}
                      onClick={handleSelectTodayMode}
                      style={{
                        minHeight: 32,
                        padding: '5px 14px',
                        fontSize: '12.5px',
                        borderRadius: 0,
                        border: 'none',
                        fontWeight: historyDateMode === 'today' ? 700 : 500
                      }}
                    >
                      {t('Today', 'இன்று')}
                    </button>

                    <button
                      type="button"
                      className={`btn small ${historyDateMode === 'custom' ? 'primary' : 'secondary'}`}
                      onClick={handleSelectCustomMode}
                      style={{
                        minHeight: 32,
                        padding: '5px 14px',
                        fontSize: '12.5px',
                        borderRadius: 0,
                        border: 'none',
                        fontWeight: historyDateMode === 'custom' ? 700 : 500
                      }}
                    >
                      {t('Custom Range', 'தனிப்பயன் வரம்பு')}
                    </button>
                  </div>

                  {/* Today Active Indicator */}
                  {historyDateMode === 'today' && (
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
                      ✓ {isTa ? `இன்று (${formatDisplayDate(today)})` : `Today (${formatDisplayDate(today)})`}
                    </span>
                  )}
                </div>
              </div>

              {/* Custom Range: From Date, To Date, Apply Filter */}
              {historyDateMode === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      {t('From Date', 'தொடக்க தேதி')}:
                    </label>
                    <input
                      type="date"
                      value={historyFromDateInput}
                      max={historyToDateInput || undefined}
                      onChange={(e) => {
                        setHistoryFromDateInput(e.target.value);
                        if (historyDateRangeError) setHistoryDateRangeError(null);
                      }}
                      style={{
                        padding: '5px 8px',
                        fontSize: '13px',
                        minHeight: 32,
                        borderRadius: 4,
                        border: historyDateRangeError ? '1.5px solid #B3261E' : '1px solid var(--border-color)',
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
                      value={historyToDateInput}
                      min={historyFromDateInput || undefined}
                      onChange={(e) => {
                        setHistoryToDateInput(e.target.value);
                        if (historyDateRangeError) setHistoryDateRangeError(null);
                      }}
                      style={{
                        padding: '5px 8px',
                        fontSize: '13px',
                        minHeight: 32,
                        borderRadius: 4,
                        border: historyDateRangeError ? '1.5px solid #B3261E' : '1px solid var(--border-color)',
                        background: 'var(--white-surface)'
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    className="btn primary small"
                    onClick={handleApplyHistoryCustomRange}
                    disabled={loadingHistory}
                    style={{
                      minHeight: 32,
                      padding: '5px 14px',
                      fontSize: '12.5px',
                      borderRadius: 4,
                      fontWeight: 700
                    }}
                  >
                    {t('Apply Filter', 'வடிகட்டியைப் பயன்படுத்து')}
                  </button>

                  {appliedHistoryFromDate && appliedHistoryToDate && (
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary-dark-green)' }}>
                      ({formatDisplayDate(appliedHistoryFromDate)} – {formatDisplayDate(appliedHistoryToDate)})
                    </span>
                  )}
                </div>
              )}

              {/* Validation error message */}
              {historyDateRangeError && (
                <div style={{ color: '#B3261E', fontSize: '12px', fontWeight: 600, marginTop: 2 }}>
                  ⚠️ {historyDateRangeError}
                </div>
              )}
            </div>
          </div>

          {/* 2. REPORT CONTENT: SUMMARY VIEW OR DETAILS VIEW */}
          {historyViewMode === 'summary' ? (
            /* =========================================================
               VIEW 1: SUMMARY VIEW (One row per vendor)
               ========================================================= */
            <div className="card" style={{ padding: '14px 18px' }}>
              <div className="table-wrap">
                <table className="compact-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                      <th style={{ textAlign: 'left' }}>{t('Vendor Name', 'விற்பனையாளர்')}</th>
                      <th style={{ textAlign: 'right' }}>{t('Total Quantity', 'மொத்த அளவு')}</th>
                      <th style={{ textAlign: 'right' }}>{t('Total Rate', 'மொத்த விலை')} (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorReportData.summaryRows && vendorReportData.summaryRows.length > 0 ? (
                      vendorReportData.summaryRows.map((row, idx) => (
                        <tr key={row.vendorId || row.vendorName || idx}>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 700, color: 'var(--primary-dark-green)', fontSize: 13.5 }}>
                            🏢 {row.vendorName}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13 }}>
                            {row.totalQuantityFormatted || '0'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#B45309' }}>
                            ₹ {Number(row.totalRate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="empty" style={{ padding: '32px 14px', textAlign: 'center' }}>
                          {loadingHistory
                            ? t('Loading report...', 'அறிக்கை ஏற்றப்படுகிறது...')
                            : t('No vendor records found for selected period.', 'தேர்ந்தெடுக்கப்பட்ட காலத்திற்கு பதிவுகள் எதுவும் இல்லை.')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {vendorReportData.summaryRows && vendorReportData.summaryRows.length > 0 && (
                    <tfoot>
                      <tr style={{ background: 'var(--cream-surface, #FDFBF7)', fontWeight: 800, borderTop: '2px solid var(--border-color, #E5DDC9)' }}>
                        <td colSpan="2" style={{ padding: '10px 14px', color: 'var(--primary-dark-green)', fontSize: 13.5 }}>
                          {t('Grand Total', 'மொத்தத் தொகை')} ({vendorReportData.totalVendors || vendorReportData.summaryRows.length} {t('Vendors', 'விற்பனையாளர்கள்')}):
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontSize: 13.5 }}>
                          {vendorReportData.grandTotalQuantityFormatted || '0'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#B45309', fontSize: 14 }}>
                          ₹ {Number(vendorReportData.grandTotalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          ) : (
            /* =========================================================
               VIEW 2: DETAILS VIEW (Grouped under Vendor heading)
               ========================================================= */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {vendorReportData.detailsGroups && vendorReportData.detailsGroups.length > 0 ? (
                vendorReportData.detailsGroups.map((group, gIdx) => (
                  <div
                    key={group.vendorId || group.vendorName || gIdx}
                    className="card"
                    style={{
                      padding: '14px 18px',
                      background: 'var(--white-surface, #ffffff)',
                      border: '1px solid var(--border-color, #E5DDC9)',
                      borderRadius: 8
                    }}
                  >
                    {/* Vendor Heading */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingBottom: 8,
                      marginBottom: 10,
                      borderBottom: '2px solid var(--primary-dark-green)'
                    }}>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--primary-dark-green)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>🏢</span> {group.vendorName}
                      </h4>
                      <span className="badge badge-neutral" style={{ fontSize: 11, fontWeight: 600 }}>
                        {group.entryCount} {group.entryCount === 1 ? t('Entry', 'வரவு') : t('Entries', 'வரவுகள்')}
                      </span>
                    </div>

                    {/* Items Table for Vendor */}
                    <div className="table-wrap">
                      <table className="compact-table" style={{ width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '36px', textAlign: 'center' }}>#</th>
                            <th style={{ textAlign: 'left' }}>{t('Item Name', 'பொருள் பெயர்')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Quantity', 'அளவு')}</th>
                            <th style={{ textAlign: 'center' }}>{t('Unit', 'அலகு')}</th>
                            <th style={{ textAlign: 'right' }}>{t('Unit Rate', 'அலகு விலை')} (₹)</th>
                            <th style={{ textAlign: 'right' }}>{t('Total Rate', 'மொத்த விலை')} (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.items && group.items.length > 0 ? (
                            group.items.map((it, itIdx) => (
                              <tr key={it.itemId || it.itemName || itIdx}>
                                <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{itIdx + 1}</td>
                                <td style={{ fontWeight: 600 }}>
                                  {isTa ? translateItem(it.itemName) : it.itemName}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                  {it.quantity}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className="badge" style={{ fontSize: 11 }}>
                                    {isTa ? translateUnit(it.unit) : it.unit}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  ₹ {Number(it.unitRate || 0).toFixed(2)}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#B45309' }}>
                                  ₹ {Number(it.totalRate || 0).toFixed(2)}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="6" style={{ textAlign: 'center', padding: '14px', fontStyle: 'italic' }}>
                                {t('No items', 'பொருட்கள் இல்லை')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Vendor Subtotal */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: 10,
                      padding: '8px 14px',
                      background: 'var(--cream-surface, #FDFBF7)',
                      border: '1px dashed var(--border-color, #E5DDC9)',
                      borderRadius: 6,
                      fontSize: 13
                    }}>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                          {t('Vendor Subtotal', 'விற்பனையாளர் உபமொத்தம்')}:
                        </span>{' '}
                        <strong style={{ color: 'var(--primary-dark-green)', marginLeft: 4 }}>
                          {t('Total Quantity', 'மொத்த அளவு')}: {group.subtotalQuantityFormatted || '0'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                          {t('Total Amount', 'மொத்தத் தொகை')}:
                        </span>{' '}
                        <strong style={{ color: '#B45309', fontSize: 14, marginLeft: 4 }}>
                          ₹ {Number(group.subtotalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="card" style={{ padding: '32px 14px', textAlign: 'center' }}>
                  <p className="empty">
                    {loadingHistory
                      ? t('Loading report...', 'அறிக்கை ஏற்றப்படுகிறது...')
                      : t('No vendor records found for selected period.', 'தேர்ந்தெடுக்கப்பட்ட காலத்திற்கு பதிவுகள் எதுவும் இல்லை.')}
                  </p>
                </div>
              )}

              {/* Grand Total Summary Banner for Details View */}
              {vendorReportData.detailsGroups && vendorReportData.detailsGroups.length > 0 && (
                <div
                  className="card"
                  style={{
                    padding: '12px 18px',
                    background: 'var(--cream-surface, #FDFBF7)',
                    border: '2px solid var(--border-color, #E5DDC9)',
                    borderRadius: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary-dark-green)' }}>
                    🏢 {t('Grand Total', 'மொத்தத் தொகை')} ({vendorReportData.totalVendors || vendorReportData.detailsGroups.length} {t('Vendors', 'விற்பனையாளர்கள்')}):
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {t('Overall Quantity', 'ஒட்டுமொத்த அளவு')}: <span style={{ color: 'var(--primary-dark-green)' }}>{vendorReportData.grandTotalQuantityFormatted || '0'}</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#B45309' }}>
                      {t('Grand Total', 'மொத்தத் தொகை')}: ₹ {Number(vendorReportData.grandTotalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL: ENTRY DETAILS
          ------------------------------------------------------------- */}
      {selectedEntryDetails && (
        <div className="modal-overlay" onClick={() => setSelectedEntryDetails(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: 680 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h4 style={{ margin: 0, color: 'var(--primary-dark-green)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📦</span> {t('Entry Details', 'வரவு விவரங்கள்')}: {selectedEntryDetails.entryNumber || `VND-${selectedEntryDetails.id}`}
              </h4>
              <button
                type="button"
                className="close-btn"
                onClick={() => setSelectedEntryDetails(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ margin: '10px 0 16px', fontSize: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><b>{t('Vendor', 'விற்பனையாளர்')}:</b> {selectedEntryDetails.vendorName}</div>
              <div><b>{t('Date', 'தேதி')}:</b> {selectedEntryDetails.entryDateTime ? formatDateTime(selectedEntryDetails.entryDateTime) : selectedEntryDetails.entryDate}</div>
              <div><b>{t('Mode of Payment', 'பணம் செலுத்தும் முறை')}:</b> <span className="badge">{selectedEntryDetails.paymentMode || 'CASH'}</span></div>
              <div><b>{t('Received By', 'பெற்றவர்')}:</b> {selectedEntryDetails.receivedBy || selectedEntryDetails.createdBy || '—'}</div>
              <div><b>{t('Brought By', 'கொண்டு வந்தவர்')}:</b> {selectedEntryDetails.broughtBy || '—'}</div>
              <div style={{ gridColumn: 'span 2', fontSize: 14, fontWeight: 700, color: 'var(--primary-dark-green)', paddingTop: 4 }}>
                {t('Grand Total', 'மொத்தத் தொகை')}: <span style={{ color: 'var(--gold)' }}>₹ {(selectedEntryDetails.grandTotal || 0).toFixed(2)}</span>
              </div>
            </div>

            <div className="table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="compact-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>{t('Item Name', 'பொருள் பெயர்')}</th>
                    <th>{t('Unit', 'அலகு')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Quantity', 'அளவு')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Unit Rate', 'அலகு விலை')} (₹)</th>
                    <th style={{ textAlign: 'right' }}>{t('Total Rate', 'மொத்த விலை')} (₹)</th>
                    <th style={{ textAlign: 'right' }}>{t('Stock Before', 'முந்தைய')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Stock After', 'புதிய')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedEntryDetails.items || []).map(line => (
                    <tr key={line.id}>
                      <td style={{ fontWeight: 600 }}>{translateItem(line.itemName)}</td>
                      <td>{translateUnit(line.unit)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {line.quantity}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        ₹ {(line.unitRate || 0).toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary-dark-green)' }}>
                        ₹ {(line.totalRate || 0).toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right' }} className="muted">
                        {line.stockBefore}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}>
                        {line.stockAfter}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                id="btn-direct-print-history-entry"
                className="secondary"
                onClick={() => printVendorInventoryEntryDirect({
                  vendorName: selectedEntryDetails.vendorName,
                  entryDate: selectedEntryDetails.entryDate,
                  paymentMode: selectedEntryDetails.paymentMode,
                  receivedBy: selectedEntryDetails.receivedBy,
                  broughtBy: selectedEntryDetails.broughtBy,
                  items: selectedEntryDetails.items,
                  grandTotal: selectedEntryDetails.grandTotal,
                  language
                })}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  padding: '6px 14px',
                  background: '#F0FDF4',
                  borderColor: 'var(--primary-dark-green)',
                  color: 'var(--primary-dark-green)'
                }}
              >
                <span>🖨️</span> {t('Direct Print', 'நேரடி அச்சு')}
              </button>
              <button
                type="button"
                id="btn-download-history-entry-pdf"
                className="secondary"
                onClick={() => downloadVendorInventoryEntryPdf({
                  vendorName: selectedEntryDetails.vendorName,
                  entryDate: selectedEntryDetails.entryDate,
                  paymentMode: selectedEntryDetails.paymentMode,
                  receivedBy: selectedEntryDetails.receivedBy,
                  broughtBy: selectedEntryDetails.broughtBy,
                  items: selectedEntryDetails.items,
                  grandTotal: selectedEntryDetails.grandTotal,
                  language
                })}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 14px' }}
              >
                <span>📄</span> {t('Download PDF', 'PDF பதிவிறக்கு')}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setSelectedEntryDetails(null)}
              >
                {t('Close', 'மூடு')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
