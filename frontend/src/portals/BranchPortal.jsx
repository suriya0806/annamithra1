import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Alert } from '../components/Alert';
import DateFilterBar, { DateSectionHeader, EmptyDateMessage } from '../components/DateFilterBar';
import { useAddItemShortcut } from '../utils/useAddItemShortcut';
import { useLanguage } from '../i18n/LanguageContext';
import { downloadBranchOrderListPdf } from '../utils/pdfGenerator';
import {
  getTodayDateString,
  toLocalDateString,
  formatDateLabel,
  formatDateTime,
  groupByDate
} from '../utils/dateGrouping';

export const BRANCH_ORDER_CATEGORIES = [
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

  // 1. Order Items states
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
  const [activeDraftSourceId, setActiveDraftSourceId] = useState(null);

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

  // 4. Drafts state & actions
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [downloadingOrderPdf, setDownloadingOrderPdf] = useState(false);
  const [downloadingDraftPdfId, setDownloadingDraftPdfId] = useState(null);

  // Review / Edit Draft Modal state
  const [viewingDraft, setViewingDraft] = useState(null);
  const [editDraftName, setEditDraftName] = useState('');
  const [editDraftItems, setEditDraftItems] = useState([]);
  const [savingEditDraft, setSavingEditDraft] = useState(false);

  // Delete Draft Confirmation Modal state
  const [deleteConfirmDraft, setDeleteConfirmDraft] = useState(null);
  const [deletingDraft, setDeletingDraft] = useState(false);

  // Move Draft to Order Confirmation Modal state
  const [confirmMoveDraft, setConfirmMoveDraft] = useState(null);
  const [movingDraft, setMovingDraft] = useState(false);

  // Save as Draft Modal / Prompt state
  const [showSaveDraftModal, setShowSaveDraftModal] = useState(false);
  const [newDraftNameInput, setNewDraftNameInput] = useState('');

  // Load branch's saved order drafts
  const loadSavedDrafts = async () => {
    try {
      setLoadingDrafts(true);
      const data = await api.getBranchDrafts(user?.branchName);
      if (Array.isArray(data)) {
        setSavedDrafts(data);
      }
    } catch (err) {
      console.error('Failed to load branch drafts', err);
    } finally {
      setLoadingDrafts(false);
    }
  };

  // Open Save as Draft modal
  const handleOpenSaveDraftModal = () => {
    if (orderItemsList.length === 0) {
      showAlert('error', language === 'ta' ? 'வரைவாக சேமிக்க குறைந்தது ஒரு பொருளையாவது சேர்க்கவும்.' : 'Please add at least one item to your request before saving as draft.');
      return;
    }
    const defaultName = `Draft #${savedDrafts.length + 1} (${getTodayDateString()})`;
    setNewDraftNameInput(defaultName);
    setShowSaveDraftModal(true);
  };

  // Save current order list as draft to database
  const handleSaveCurrentAsDraft = async (e) => {
    if (e) e.preventDefault();
    if (orderItemsList.length === 0) {
      showAlert('error', language === 'ta' ? 'கோரிக்கை பட்டியலில் பொருட்கள் இல்லை.' : 'No items in order list to save as draft.');
      return;
    }

    try {
      setSavingDraft(true);
      const name = (newDraftNameInput || '').trim() || `Draft #${savedDrafts.length + 1} (${getTodayDateString()})`;
      const saved = await api.saveBranchDraft(name, orderItemsList.map(it => ({
        itemName: it.itemName,
        unit: it.unit,
        category: it.category,
        requestedQuantity: it.requestedQuantity,
        isNewItem: it.isNewItem
      })));

      showAlert('success', language === 'ta'
        ? `✓ வரைவு "${saved.draftName || name}" வெற்றிகரமாக சேமிக்கப்பட்டது! வரைவுகள் பக்கத்தில் எந்த நேரமும் அணுகலாம்.`
        : `✓ Draft "${saved.draftName || name}" saved successfully! You can review or edit it from the Drafts tab.`);

      setShowSaveDraftModal(false);
      await loadSavedDrafts();
    } catch (err) {
      console.error('Failed to save draft', err);
      showAlert('error', err.message || (language === 'ta' ? 'வரைவை சேமிக்க முடியவில்லை' : 'Failed to save draft'));
    } finally {
      setSavingDraft(false);
    }
  };

  // Download Order List PDF
  const handleDownloadOrderListPdf = async () => {
    if (orderItemsList.length === 0) {
      showAlert('error', language === 'ta' ? 'பதிவிறக்க பட்டியலில் பொருட்கள் எதுவும் இல்லை.' : 'No items in order list to generate PDF.');
      return;
    }

    try {
      setDownloadingOrderPdf(true);
      await downloadBranchOrderListPdf({
        organisationName: user?.organisationName || 'Saravana Bhavan',
        branchName: user?.branchName || 'Branch 1',
        date: getTodayDateString(),
        items: orderItemsList,
        isDraft: false,
        language
      });
      showAlert('success', language === 'ta' ? '✓ ஆர்டர் பட்டியல் PDF வெற்றிகரமாக பதிவிறக்கப்பட்டது!' : '✓ Order list PDF downloaded successfully!');
    } catch (err) {
      console.error('Error generating Order List PDF', err);
      showAlert('error', err.message || (language === 'ta' ? 'PDF உருவாக்குவதில் பிழை' : 'Failed to generate PDF'));
    } finally {
      setDownloadingOrderPdf(false);
    }
  };

  // Download Draft PDF
  const handleDownloadDraftPdf = async (draft) => {
    if (!draft || !draft.items || draft.items.length === 0) {
      showAlert('error', language === 'ta' ? 'இந்த வரைவில் பொருட்கள் இல்லை.' : 'No items in this draft to generate PDF.');
      return;
    }
    try {
      setDownloadingDraftPdfId(draft.id);
      await downloadBranchOrderListPdf({
        organisationName: user?.organisationName || 'Saravana Bhavan',
        branchName: draft.branchName || user?.branchName || 'Branch 1',
        date: (draft.createdAt || '').slice(0, 10) || getTodayDateString(),
        items: draft.items,
        isDraft: true,
        draftName: draft.draftName,
        language
      });
      showAlert('success', language === 'ta' ? `✓ வரைவு "${draft.draftName}" PDF பதிவிறக்கப்பட்டது!` : `✓ Draft "${draft.draftName}" PDF downloaded successfully!`);
    } catch (err) {
      console.error('Error generating Draft PDF', err);
      showAlert('error', err.message || 'Failed to generate Draft PDF');
    } finally {
      setDownloadingDraftPdfId(null);
    }
  };

  // Open Draft Review / Edit modal
  const handleOpenDraftReview = (draft) => {
    setViewingDraft(draft);
    setEditDraftName(draft.draftName || '');
    setEditDraftItems(Array.isArray(draft.items) ? JSON.parse(JSON.stringify(draft.items)) : []);
  };

  const handleCloseDraftReview = () => {
    setViewingDraft(null);
    setEditDraftName('');
    setEditDraftItems([]);
  };

  const handleUpdateEditDraftItemQty = (index, qty) => {
    const val = parseInt(qty, 10);
    setEditDraftItems(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, requestedQuantity: isNaN(val) ? 0 : val };
      }
      return item;
    }));
  };

  const handleRemoveEditDraftItem = (index) => {
    setEditDraftItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveEditDraftChanges = async () => {
    if (!viewingDraft) return;
    if (editDraftItems.length === 0) {
      showAlert('error', language === 'ta' ? 'வரைவில் குறைந்தது ஒரு பொருளையாவது வைத்திருக்க வேண்டும்.' : 'Draft must contain at least one item.');
      return;
    }
    for (const it of editDraftItems) {
      if (!it.requestedQuantity || it.requestedQuantity <= 0) {
        showAlert('error', `Requested quantity for "${it.itemName}" must be greater than 0.`);
        return;
      }
    }

    try {
      setSavingEditDraft(true);
      const updated = await api.updateBranchDraft(viewingDraft.id, editDraftName, editDraftItems);
      showAlert('success', language === 'ta' ? '✓ வரைவு மாற்றங்கள் வெற்றிகரமாக சேமிக்கப்பட்டன!' : '✓ Draft changes saved successfully!');
      setViewingDraft(updated);
      await loadSavedDrafts();
    } catch (err) {
      console.error('Failed to update draft', err);
      showAlert('error', err.message || 'Failed to update draft');
    } finally {
      setSavingEditDraft(false);
    }
  };

  // Prompt confirmation to convert draft into active order
  const handlePromptMoveDraftToOrder = (draftToMove) => {
    const draft = draftToMove || viewingDraft;
    if (!draft || !draft.items || draft.items.length === 0) {
      showAlert('error', language === 'ta' ? 'நகர்த்துவதற்கு இந்த வரைவில் பொருட்கள் இல்லை.' : 'No items in this draft to move.');
      return;
    }
    setConfirmMoveDraft(draft);
  };

  // Execute Move Draft to Order: calls backend to create actual BranchRequest records in DB!
  const handleExecuteMoveDraftToOrder = async () => {
    if (!confirmMoveDraft) return;
    const draft = confirmMoveDraft;
    if (!draft || !draft.items || draft.items.length === 0) {
      showAlert('error', language === 'ta' ? 'இந்த வரைவில் பொருட்கள் எதுவும் இல்லை.' : 'No items in this draft to order.');
      setConfirmMoveDraft(null);
      return;
    }

    try {
      setMovingDraft(true);

      // 1. Submit draft as actual order through backend (creates BranchRequest records & marks MOVED_TO_ORDER)
      await api.markBranchDraftMoved(draft.id);

      // 2. Reload saved drafts to update status badge
      await loadSavedDrafts();

      // 3. Reload branch requests so new order appears in History and Today's requests
      await loadMyRequests('', true);

      if (viewingDraft && viewingDraft.id === draft.id) {
        handleCloseDraftReview();
      }

      setConfirmMoveDraft(null);

      showAlert('success', language === 'ta'
        ? `✓ வரைவு "${draft.draftName}"-ல் இருந்து ${draft.items.length} பொருட்கள் வெற்றிகரமாக ஆர்டர் செய்யப்பட்டு சேமிப்பக மேலாளருக்கு அனுப்பப்பட்டன!`
        : `✓ Order successfully placed with ${draft.items.length} item(s) from draft "${draft.draftName}"! Sent to Store Manager.`);

      // 4. Switch to History tab so user immediately sees their placed order
      if (typeof onSelectTab === 'function') {
        onSelectTab('history');
      }
    } catch (err) {
      console.error('Failed to move draft to order', err);
      showAlert('error', err.message || 'Failed to move draft to order');
    } finally {
      setMovingDraft(false);
    }
  };

  // Load draft items into active Order Items form (for adding more items or editing before sending)
  const handleLoadDraftIntoOrderForm = (draftToLoad) => {
    const draft = draftToLoad || viewingDraft;
    if (!draft || !draft.items || draft.items.length === 0) {
      showAlert('error', language === 'ta' ? 'படிவத்தில் ஏற்ற வரைவில் பொருட்கள் இல்லை.' : 'No items in this draft to load.');
      return;
    }

    // Track original draft source so it can be preserved and only marked as moved after successful order submission
    setActiveDraftSourceId(draft.id);

    setOrderItemsList(prev => {
      const nextList = [...prev];
      draft.items.forEach(draftItem => {
        let itemCat = (draftItem.category || '').trim();
        const matched = BRANCH_ORDER_CATEGORIES.find(c => c.toLowerCase() === itemCat.toLowerCase());
        const validCategory = matched || 'Groceries';

        const matchIdx = nextList.findIndex(
          x => x.itemName.trim().toLowerCase() === draftItem.itemName.trim().toLowerCase() &&
               (x.category || '').trim().toLowerCase() === validCategory.toLowerCase()
        );
        if (matchIdx >= 0) {
          nextList[matchIdx] = {
            ...nextList[matchIdx],
            requestedQuantity: parseInt(draftItem.requestedQuantity, 10) || nextList[matchIdx].requestedQuantity,
            unit: (draftItem.unit || nextList[matchIdx].unit || 'KG').trim().toUpperCase(),
            category: validCategory
          };
        } else {
          nextList.push({
            id: Date.now() + Math.random(),
            itemName: draftItem.itemName.trim(),
            unit: (draftItem.unit || 'KG').trim().toUpperCase(),
            requestedQuantity: parseInt(draftItem.requestedQuantity, 10) || 1,
            category: validCategory,
            isNewItem: draftItem.isNewItem || false
          });
        }
      });
      return nextList;
    });

    if (viewingDraft && viewingDraft.id === draft.id) {
      handleCloseDraftReview();
    }

    showAlert('success', language === 'ta'
      ? `✓ வரைவு "${draft.draftName}"-ல் இருந்து ${draft.items.length} பொருட்கள் ஆர்டர் படிவத்தில் ஏற்றப்பட்டன! கூடுதல் பொருட்களை சேர்த்து ஆர்டரை அனுப்பவும்.`
      : `✓ Loaded ${draft.items.length} item(s) from draft "${draft.draftName}" into your order form. Review them and click Send Order.`);

    if (typeof onSelectTab === 'function') {
      onSelectTab('order-items');
    }
  };

  // Delete draft
  const handleDeleteDraft = async () => {
    if (!deleteConfirmDraft) return;
    try {
      setDeletingDraft(true);
      await api.deleteBranchDraft(deleteConfirmDraft.id);
      showAlert('success', language === 'ta' ? '✓ வரைவு வெற்றிகரமாக நீக்கப்பட்டது!' : `✓ Draft "${deleteConfirmDraft.draftName}" deleted successfully!`);
      if (viewingDraft && viewingDraft.id === deleteConfirmDraft.id) {
        handleCloseDraftReview();
      }
      setDeleteConfirmDraft(null);
      await loadSavedDrafts();
    } catch (err) {
      console.error('Failed to delete draft', err);
      showAlert('error', err.message || 'Failed to delete draft');
    } finally {
      setDeletingDraft(false);
    }
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
  const loadMyRequests = async (date = requestFilterDate, isAll = requestIsAllDates) => {
    try {
      const queryDate = isAll ? '' : date;
      const reqs = await api.getMyBranchRequests(queryDate);
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
  }, []);

  useEffect(() => {
    if (activeTab === 'order-items') {
      loadCatalogue();
      loadMyRequests(requestFilterDate, requestIsAllDates);
      loadSavedDrafts();
    } else if (activeTab === 'drafts') {
      loadSavedDrafts();
    } else if (activeTab === 'entry') {
      loadDeliveries(deliveryDate, deliveryIsAllDates);
    } else if (activeTab === 'history') {
      loadReceivedHistory();
    }
  }, [activeTab, requestFilterDate, requestIsAllDates, deliveryDate, deliveryIsAllDates, historyDate, historyIsAllDates, historyFromDate, historyToDate]);

  // 1. Auto-focus Item Name whenever Order Items tab is opened or active
  useEffect(() => {
    if (activeTab === 'order-items') {
      const focusItemInput = () => {
        if (!showConfirmModal && !showNewItemModal) {
          const activeEl = document.activeElement;
          // Do not steal focus if user is already focused on an input inside the page
          if (activeEl !== itemInputRef.current && activeEl !== qtyInputRef.current) {
            itemInputRef.current?.focus();
          }
        }
      };

      const raf = requestAnimationFrame(focusItemInput);
      const timer = setTimeout(focusItemInput, 50);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
  }, [activeTab]);

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

  // Add Item to Order List
  const handleAddItemToOrderList = () => {
    if (!selectedCategory) {
      showAlert('error', language === 'ta' ? 'தயவுசெய்து வகையைத் தேர்ந்தெடுக்கவும் (Category).' : 'Please select a Category before adding an item.');
      categorySelectRef.current?.focus();
      return;
    }

    const finalName = searchQuery.trim();
    if (!finalName) {
      showAlert('error', 'Please enter or select an Item Name');
      itemInputRef.current?.focus();
      return;
    }

    const q = parseInt(requestedQty, 10);
    if (isNaN(q) || q <= 0) {
      showAlert('error', 'Requested Quantity must be a positive number greater than 0');
      qtyInputRef.current?.focus();
      return;
    }

    // Determine unit
    let finalUnit = (itemUnit || '').trim().toUpperCase();
    if (!finalUnit) {
      const matched = catalogueItems.find(it => it.name && it.name.toLowerCase() === finalName.toLowerCase());
      if (matched && matched.unit) {
        finalUnit = matched.unit.toUpperCase();
      } else {
        finalUnit = 'KG';
      }
    }

    // Prevent duplicate item lines in the same unsent request list (same name and category)
    const existingIndex = orderItemsList.findIndex(
      x => x.itemName.trim().toLowerCase() === finalName.toLowerCase() &&
           (!x.category || x.category.toLowerCase() === selectedCategory.toLowerCase())
    );
    if (existingIndex >= 0) {
      const existing = orderItemsList[existingIndex];
      const updatedQty = existing.requestedQuantity + q;
      showAlert('warning', `"${finalName}" is already in your request list. Updated its quantity to ${updatedQty}. You can edit it directly in the table.`);
      setOrderItemsList(prev => prev.map((item, idx) => {
        if (idx === existingIndex) {
          return { ...item, requestedQuantity: updatedQty, category: selectedCategory || item.category };
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

    // Add new row to unsent items
    setOrderItemsList(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        itemName: finalName,
        category: selectedCategory,
        unit: finalUnit,
        requestedQuantity: q,
        isNewItem: !selectedItem && !catalogueItems.some(it => it.name.toLowerCase() === finalName.toLowerCase())
      }
    ]);

    showAlert('success', `✓ Added ${q} ${finalUnit} of "${finalName}" (${translateCategory(selectedCategory)}) to request list.`);

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
    const val = parseInt(newQty, 10);
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
      const q = parseInt(it.requestedQuantity, 10);
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
      if (!it.category || !it.category.trim()) {
        showAlert('error', `Category is missing for "${it.itemName}". Please select a category.`);
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
      const payloadItems = orderItemsList.map(it => {
        let cat = (it.category || '').trim();
        const matched = BRANCH_ORDER_CATEGORIES.find(c => c.toLowerCase() === cat.toLowerCase());
        const validCategory = matched || (selectedCategory && BRANCH_ORDER_CATEGORIES.includes(selectedCategory) ? selectedCategory : 'Groceries');

        return {
          itemName: it.itemName.trim(),
          unit: (it.unit || 'KG').trim().toUpperCase(),
          category: validCategory,
          requestedQuantity: parseInt(it.requestedQuantity, 10) || 1,
          isNewItem: Boolean(it.isNewItem)
        };
      });

      await api.submitBranchRequest(payloadItems);

      // If this order was loaded from a draft, mark the draft as moved in DB only after successful submission!
      if (activeDraftSourceId) {
        try {
          await api.markBranchDraftMoved(activeDraftSourceId, false);
          await loadSavedDrafts();
        } catch (draftErr) {
          console.warn('Could not update draft status after order submission', draftErr);
        }
        setActiveDraftSourceId(null);
      }

      showAlert('success', `✓ Your request with ${orderItemsList.length} distinct item line(s) was sent to the Store Manager successfully!`);
      setOrderItemsList([]);
      setShowConfirmModal(false);
      await loadMyRequests(requestFilterDate, requestIsAllDates);
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

    const rQty = parseInt(actualReceivedQty, 10);
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

    const qty = parseInt(returnQty, 10);
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
              <div className="card-header" style={{ alignItems: 'flex-start' }}>
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
                  style={{ whiteSpace: 'nowrap', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => handleOpenNewItemModal(searchQuery)}
                  title="Add a new item to catalogue (F5 shortcut)"
                >
                  <span>➕</span> {t('Add New Item')} <kbd style={{ fontSize: 10, opacity: 0.85, padding: '1px 5px', background: 'rgba(0,0,0,0.06)', borderRadius: 3 }}>F5</kbd>
                </button>
              </div>

              <div className="branch-form-fields">
                {/* Category Selection Dropdown */}
                <div className="branch-category-field" style={{ marginBottom: 14 }}>
                  <label htmlFor="branch-item-category-select" style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--primary-dark-green)', marginBottom: 6 }}>
                    {t('Category', 'Category')} *
                  </label>
                  <select
                    id="branch-item-category-select"
                    ref={categorySelectRef}
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      height: 40,
                      padding: '6px 12px',
                      fontSize: 14,
                      borderRadius: 6,
                      border: '1.5px solid var(--border-color)',
                      backgroundColor: '#ffffff',
                      color: selectedCategory ? 'var(--primary-dark-green)' : '#666',
                      fontWeight: selectedCategory ? 600 : 400
                    }}
                  >
                    <option value="">{language === 'ta' ? '-- வகையைத் தேர்ந்தெடுக்கவும் (Select Category) --' : '-- Select Category --'}</option>
                    {BRANCH_ORDER_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {translateCategory(cat)}
                      </option>
                    ))}
                  </select>
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
                        autoComplete="off"
                        placeholder={language === 'ta' ? 'பொருளின் பெயரை உள்ளிடவும் (எ.கா. தயிர்)...' : 'Type item name (e.g. Cu for Curd)...'}
                        value={searchQuery}
                        onChange={e => {
                          setSearchQuery(e.target.value);
                          setSelectedItem(null);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
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
                      min="1"
                      placeholder={t('Enter Quantity')}
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
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleAddItemToOrderList}
                >
                  {t('+ Add Item to Order List (Enter)', '+ கோரிக்கை பட்டியலில் சேர் (Enter)')}
                </button>
              </div>
            </div>

            {/* Right column — Items Being Requested */}
            <div className="card branch-order-list-card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 className="card-title">{t('Items Being Requested', 'கோரப்படும் பொருட்கள்')} ({orderItemsList.length})</h3>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {t('Review and edit quantities before sending your request to the Store Manager.', 'கிடங்கு மேலாளருக்கு கோரிக்கையை அனுப்பும் முன் அளவுகளை சரிபார்க்கவும்.')}
                  </p>
                </div>
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
                    height: 32,
                    padding: '0 12px',
                    fontWeight: 600,
                    fontSize: 12.5,
                    borderRadius: 6
                  }}
                  title={language === 'ta' ? 'தற்போதைய ஆர்டர் பட்டியலை PDF ஆக பதிவிறக்கவும்' : 'Download current order list as PDF'}
                >
                  <span>📄</span>
                  {downloadingOrderPdf
                    ? (language === 'ta' ? 'தயாராகிறது...' : 'Generating...')
                    : (language === 'ta' ? 'PDF அச்சிடு / பதிவிறக்கு' : 'Print / Download PDF')}
                </button>
              </div>

              <div className="table-wrap">
                <table className="branch-request-table">
                  <thead>
                    <tr>
                      <th>{t('Item Name')}</th>
                      <th>{t('Category')}</th>
                      <th>{t('Unit')}</th>
                      <th style={{ textAlign: 'center', width: 140 }}>{t('Requested Quantity')}</th>
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
                            <span style={{
                              background: '#e2ece9',
                              color: '#003B2B',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 600,
                              display: 'inline-block'
                            }}>
                              {translateCategory(item.category || 'General')}
                            </span>
                          </td>
                          <td><span className="autocomplete-unit-badge">{translateUnit(item.unit)}</span></td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="number"
                              min="1"
                              className="qty-input"
                              value={item.requestedQuantity}
                              onChange={e => handleUpdateOrderItemQty(item.id, e.target.value)}
                            />
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

              <div className="form-actions" style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="secondary"
                  id="btn-save-as-draft"
                  disabled={orderItemsList.length === 0 || savingDraft}
                  onClick={handleOpenSaveDraftModal}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 38,
                    padding: '0 16px',
                    fontWeight: 600,
                    borderRadius: 6
                  }}
                  title={language === 'ta' ? 'தற்போதைய பொருட்களை வரைவாக சேமிக்கவும் (ஆர்டர் அனுப்பப்படாது)' : 'Save current items as draft (will not send order)'}
                >
                  <span>💾</span>
                  {savingDraft
                    ? (language === 'ta' ? 'சேமிக்கிறது...' : 'Saving...')
                    : (language === 'ta' ? 'வரைவாக சேமி' : 'Save as Draft')}
                </button>

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
                        <th>{t('Category')}</th>
                        <th>{t('Unit')}</th>
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
                              {translateCategory(item.category || 'Groceries')}
                            </span>
                          </td>
                          <td><span className="autocomplete-unit-badge">{translateUnit(item.unit)}</span></td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>
                            {item.requestedQuantity}
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
              <button
                type="button"
                className="secondary small"
                onClick={() => loadMyRequests(requestFilterDate, requestIsAllDates)}
              >
                ↻ Refresh
              </button>
            </div>

            <DateFilterBar
              label="Request Date"
              selectedDate={requestFilterDate}
              onDateChange={(d) => {
                setRequestFilterDate(d);
                setRequestIsAllDates(false);
              }}
              isAllDates={requestIsAllDates}
              onToggleAllDates={(all) => setRequestIsAllDates(all)}
              totalCount={myRequests.length}
            />

            {(() => {
              const displayed = myRequests.filter(r => {
                if (requestIsAllDates) return true;
                const d = toLocalDateString(r.requestDate || r.createdAt);
                return d === requestFilterDate;
              }).sort((a, b) => {
                const tA = new Date(a.createdAt || a.requestDate || 0).getTime();
                const tB = new Date(b.createdAt || b.requestDate || 0).getTime();
                return tB - tA;
              });

              if (displayed.length === 0) {
                return (
                  <EmptyDateMessage
                    date={requestIsAllDates ? null : requestFilterDate}
                    message={requestIsAllDates ? `No recent requests found for ${user?.branchName}.` : undefined}
                    onResetToday={() => {
                      setRequestFilterDate(getTodayDateString());
                      setRequestIsAllDates(false);
                    }}
                    onShowAll={() => setRequestIsAllDates(true)}
                  />
                );
              }

              if (requestIsAllDates) {
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
                            <th>{t('Unit', 'Unit')}</th>
                            <th>{t('Requested Quantity', 'Requested Quantity')}</th>
                            <th>{t('Dispatched Quantity', 'Dispatched Quantity')}</th>
                            <th>{t('Confirmed Received Quantity', 'Confirmed Received Quantity')}</th>
                            <th>{t('Status', 'Status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grp.items.map(r => (
                            <tr key={r.id}>
                              <td>{formatDateTime(r.createdAt || r.requestDate, language)}</td>
                              <td><b>{translateItem(r.item)}</b></td>
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
                        <th>{t('Unit', 'Unit')}</th>
                        <th>{t('Requested Quantity', 'Requested Quantity')}</th>
                        <th>{t('Dispatched Quantity', 'Dispatched Quantity')}</th>
                        <th>{t('Confirmed Received Quantity', 'Confirmed Received Quantity')}</th>
                        <th>{t('Status', 'Status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.map(r => (
                        <tr key={r.id}>
                          <td>{formatDateTime(r.createdAt || r.requestDate, language)}</td>
                          <td><b>{translateItem(r.item)}</b></td>
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
          DRAFTS TAB (Saved Branch Order Drafts)
          ========================================================================= */}
      {activeTab === 'drafts' && (
        <section className="card branch-drafts-section" id="section-branch-drafts">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📑</span> {language === 'ta' ? 'சேமிக்கப்பட்ட வரைவுகள்' : 'Saved Drafts'} ({savedDrafts.length})
              </h3>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                {t('Branch')}: <b>{user?.branchName}</b>. {language === 'ta'
                  ? 'சேமிக்கப்பட்ட வரைவுகளை மதிப்பாய்வு செய்யவும், திருத்தவும் மற்றும் ஆர்டர் பட்டியலுக்கு மாற்றவும்.'
                  : 'Review, edit, download PDF, or transfer saved drafts to your Order List for submission.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="secondary small"
                id="btn-refresh-drafts"
                onClick={loadSavedDrafts}
                disabled={loadingDrafts}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32 }}
              >
                <span>↻</span> {loadingDrafts ? (language === 'ta' ? 'ஏற்றுகிறது...' : 'Loading...') : t('Refresh', 'Refresh')}
              </button>
              {orderItemsList.length > 0 && (
                <button
                  type="button"
                  className="primary small"
                  id="btn-save-current-to-draft"
                  onClick={handleOpenSaveDraftModal}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32 }}
                >
                  <span>💾</span> {language === 'ta' ? 'தற்போதைய பட்டியலை சேமி' : 'Save Current Order List'} ({orderItemsList.length})
                </button>
              )}
            </div>
          </div>

          <div style={{ padding: '16px' }}>
            {loadingDrafts ? (
              <p className="muted" style={{ padding: 24, textAlign: 'center' }}>
                {language === 'ta' ? 'வரைவுகள் ஏற்றப்படுகின்றன...' : 'Loading saved drafts...'}
              </p>
            ) : savedDrafts.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '48px 20px',
                background: '#FAF6EC',
                borderRadius: 8,
                border: '1.5px dashed #D4A63B'
              }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📑</div>
                <h4 style={{ margin: '0 0 6px', color: 'var(--primary-dark-green)', fontSize: 16 }}>
                  {language === 'ta' ? `${user?.branchName} கிளைக்கு சேமிக்கப்பட்ட வரைவுகள் எதுவும் இல்லை` : `No saved drafts for ${user?.branchName}`}
                </h4>
                <p className="muted" style={{ margin: '0 0 16px', maxWidth: 440, marginLeft: 'auto', marginRight: 'auto', fontSize: 13 }}>
                  {language === 'ta'
                    ? 'பொருட்கள் ஆர்டர் (Order Items) பக்கத்தில் பொருட்களை சேர்த்து "வரைவாக சேமி" பொத்தானை கிளிக் செய்து வரைவை உருவாக்கலாம்.'
                    : 'Add items on the Order Items page and click "Save as Draft" to keep them saved for later review.'}
                </p>
                <button
                  type="button"
                  className="primary"
                  onClick={() => typeof onSelectTab === 'function' && onSelectTab('order-items')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <span>📝</span> {language === 'ta' ? 'பொருட்கள் ஆர்டர் பக்கத்திற்கு செல்லவும்' : 'Go to Order Items'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                {savedDrafts.map(draft => {
                  const isMoved = draft.status === 'MOVED_TO_ORDER';
                  const dateStr = formatDisplayDateTime(draft.updatedAt || draft.createdAt);
                  return (
                    <div
                      key={draft.id}
                      className="card"
                      id={`draft-card-${draft.id}`}
                      style={{
                        margin: 0,
                        border: isMoved ? '1px solid #c7d2fe' : '1.5px solid #D4A63B',
                        background: isMoved ? '#f8fafc' : '#ffffff',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div className="card-header" style={{ padding: '12px 14px', borderBottom: '1px solid #F5EFE0', background: isMoved ? '#f1f5f9' : '#FCFAF3' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 16 }}>📑</span>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--primary-dark-green)' }}>
                              {draft.draftName || `Draft #${draft.id}`}
                            </h4>
                          </div>
                          <span className="muted" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                            {t('Branch')}: <b>{draft.branchName}</b>
                          </span>
                        </div>
                        <span
                          className="badge"
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            background: isMoved ? '#e0e7ff' : '#FEF3C7',
                            color: isMoved ? '#3730a3' : '#b45309',
                            border: isMoved ? '1px solid #c7d2fe' : '1px solid #FCD34D'
                          }}
                        >
                          {isMoved ? (language === 'ta' ? '✓ ஆர்டருக்கு மாற்றப்பட்டது' : '✓ MOVED TO ORDER') : (language === 'ta' ? 'வரைவு' : 'DRAFT')}
                        </span>
                      </div>

                      <div style={{ padding: '12px 14px', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12.5, color: '#4b5563' }}>
                          <span>
                            {language === 'ta' ? 'மொத்த பொருட்கள்' : 'Items'}: <b style={{ color: 'var(--primary-dark-green)' }}>{draft.itemCount}</b>
                          </span>
                          <span>
                            {language === 'ta' ? 'மொத்த அளவு' : 'Total Qty'}: <b style={{ color: 'var(--primary-dark-green)' }}>{draft.totalQuantity}</b>
                          </span>
                        </div>

                        {/* Items Preview Chips */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                          {(draft.items || []).slice(0, 4).map((it, idx) => (
                            <span
                              key={idx}
                              style={{
                                background: '#F5EFE0',
                                color: '#17352B',
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 500
                              }}
                            >
                              {translateItem(it.itemName)}: <b>{it.requestedQuantity} {translateUnit(it.unit)}</b>
                            </span>
                          ))}
                          {(draft.items || []).length > 4 && (
                            <span style={{ fontSize: 11, color: '#5A6962', alignSelf: 'center' }}>
                              +${(draft.items || []).length - 4} {language === 'ta' ? 'கூடுதல்' : 'more'}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: 11, color: '#5A6962' }}>
                          <span>🕒 {language === 'ta' ? 'சேமிக்கப்பட்ட நேரம்' : 'Saved'}: {dateStr}</span>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div style={{ padding: '10px 14px', background: '#FDFBF7', borderTop: '1px solid #F5EFE0', display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="secondary small"
                            id={`btn-review-draft-${draft.id}`}
                            onClick={() => handleOpenDraftReview(draft)}
                            style={{ height: 30, padding: '0 10px', fontSize: 12, fontWeight: 600 }}
                            title={language === 'ta' ? 'வரைவை பார்க்க மற்றும் திருத்த' : 'Review and edit draft items'}
                          >
                            <span>👁️</span> {language === 'ta' ? 'திருத்து' : 'Review & Edit'}
                          </button>

                          <button
                            type="button"
                            className="secondary small"
                            id={`btn-pdf-draft-${draft.id}`}
                            onClick={() => handleDownloadDraftPdf(draft)}
                            disabled={downloadingDraftPdfId === draft.id}
                            style={{ height: 30, padding: '0 8px', fontSize: 12 }}
                            title={language === 'ta' ? 'வரைவை PDF ஆக பதிவிறக்கவும்' : 'Download draft PDF'}
                          >
                            <span>📄</span> {downloadingDraftPdfId === draft.id ? '...' : 'PDF'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="primary small"
                            id={`btn-move-draft-${draft.id}`}
                            onClick={() => handlePromptMoveDraftToOrder(draft)}
                            style={{
                              height: 30,
                              padding: '0 10px',
                              fontSize: 12,
                              fontWeight: 700,
                              background: isMoved ? '#4b5563' : 'var(--primary-dark-green)',
                              color: '#ffffff'
                            }}
                            title={language === 'ta' ? 'இந்த வரைவை நேரடி ஆர்டராக மாற்றி சேமிப்பக மேலாளருக்கு அனுப்பவும்' : 'Submit this draft as an active order to Store Manager'}
                          >
                            <span>📥</span> {language === 'ta' ? 'ஆர்டர் செய் (Move to Order)' : 'Move to Order'}
                          </button>

                          <button
                            type="button"
                            className="secondary small"
                            id={`btn-load-draft-${draft.id}`}
                            onClick={() => handleLoadDraftIntoOrderForm(draft)}
                            style={{ height: 30, padding: '0 8px', fontSize: 12 }}
                            title={language === 'ta' ? 'படிவத்தில் ஏற்றவும் (கூடுதல் பொருட்களை சேர்த்து அனுப்ப)' : 'Load items into order form to add more items before sending'}
                          >
                            <span>📝</span> {language === 'ta' ? 'படிவத்தில் ஏற்று' : 'Load into Form'}
                          </button>

                          <button
                            type="button"
                            className="danger small"
                            id={`btn-delete-draft-${draft.id}`}
                            onClick={() => setDeleteConfirmDraft(draft)}
                            style={{ height: 30, padding: '0 8px', fontSize: 12 }}
                            title={language === 'ta' ? 'வரைவை நீக்கு' : 'Delete draft'}
                          >
                            <span>🗑️</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                {t('Grouped by original dispatch date...', 'Grouped by original dispatch date. Please click Acknowledge Received only after physically receiving and verifying the delivery at your branch.')}
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
            label={t('Original Dispatch Date', 'Original Dispatch Date')}
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
                          <th style={{ width: '155px' }}>{t('Dispatch Date & Time', 'Dispatch Date & Time')}</th>
                          <th>{t('Item Name', 'Item Name')}</th>
                          <th style={{ width: '75px', textAlign: 'center' }}>{t('Unit', 'Unit')}</th>
                          <th style={{ width: '105px', textAlign: 'center' }}>{t('Dispatched Quantity', 'Dispatched Quantity')}</th>
                          <th style={{ width: '115px', textAlign: 'center' }}>{t('Actual Received Quantity', 'Actual Received Quantity')}</th>
                          <th style={{ width: '105px', textAlign: 'center' }}>{t('Shortage Quantity', 'Shortage Quantity')}</th>
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
                                    title={isFullyReturned ? t('Fully Returned', 'Dispatched quantity has been fully returned') : t('Return', 'Return item to central inventory')}
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
                      <th style={{ width: '155px' }}>{t('Dispatch Date & Time', 'Dispatch Date & Time')}</th>
                      <th>{t('Item Name', 'Item Name')}</th>
                      <th style={{ width: '75px', textAlign: 'center' }}>{t('Unit', 'Unit')}</th>
                      <th style={{ width: '105px', textAlign: 'center' }}>{t('Dispatched Quantity', 'Dispatched Quantity')}</th>
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
                                title={isFullyReturned ? t('Fully Returned', 'Dispatched quantity has been fully returned') : t('Return', 'Return item to central inventory')}
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
                    minWidth: '160px'
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
                            <th>{t('Original Dispatch Date & Time', 'Original Dispatch Date & Time')}</th>
                            <th>{t('Item Name', 'Item Name')}</th>
                            <th style={{ width: '75px', textAlign: 'center' }}>{t('Unit', 'Unit')}</th>
                            <th style={{ width: '95px', textAlign: 'center' }}>{t('Dispatched Quantity', 'Dispatched Quantity')}</th>
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
                      <th>{t('Original Dispatch Date & Time', 'Original Dispatch Date & Time')}</th>
                      <th>{t('Item Name', 'Item Name')}</th>
                      <th style={{ width: '75px', textAlign: 'center' }}>{t('Unit', 'Unit')}</th>
                      <th style={{ width: '95px', textAlign: 'center' }}>{t('Dispatched Quantity', 'Dispatched Quantity')}</th>
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

      {/* Save Draft Prompt Modal */}
      {showSaveDraftModal && (
        <div className="modal-overlay" onClick={() => setShowSaveDraftModal(false)} style={{ zIndex: 1250 }}>
          <div
            className="modal-content"
            style={{ maxWidth: 440, padding: '22px 26px', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header" style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'var(--primary-dark-green)', fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>💾</span> {language === 'ta' ? 'வரைவாக சேமி' : 'Save Order as Draft'}
              </h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowSaveDraftModal(false)}
                disabled={savingDraft}
              >
                ✕
              </button>
            </div>

            <p className="muted" style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.5 }}>
              {language === 'ta'
                ? `தற்போதைய ${orderItemsList.length} பொருட்களையும் வரைவாக சேமிக்கவும். பின்னர் வரைவுகள் பக்கத்தில் திறந்து திருத்தலாம் அல்லது அனுப்பலாம்.`
                : `Save current ${orderItemsList.length} item(s) as a draft for ${user?.branchName}. This will NOT send an order to the Store Manager.`}
            </p>

            <form onSubmit={handleSaveCurrentAsDraft}>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label
                  htmlFor="input-save-draft-name"
                  style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--primary-dark-green)', marginBottom: 6 }}
                >
                  {language === 'ta' ? 'வரைவு பெயர்' : 'Draft Name'}
                </label>
                <input
                  id="input-save-draft-name"
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Vegetables & Dairy Draft"
                  value={newDraftNameInput}
                  onChange={e => setNewDraftNameInput(e.target.value)}
                  disabled={savingDraft}
                  style={{ width: '100%', height: 38, padding: '6px 12px', fontSize: 14, borderRadius: 6, border: '1px solid var(--border-color)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowSaveDraftModal(false)}
                  disabled={savingDraft}
                  style={{ height: 36, padding: '0 16px', borderRadius: 6 }}
                >
                  {t('Cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="primary"
                  disabled={savingDraft}
                  id="btn-confirm-save-draft"
                  style={{ height: 36, padding: '0 18px', fontWeight: 700, borderRadius: 6, background: 'var(--primary-dark-green)', color: '#ffffff' }}
                >
                  {savingDraft ? (language === 'ta' ? 'சேமிக்கிறது...' : 'Saving...') : (language === 'ta' ? 'வரைவை சேமிக்கவும்' : 'Save Draft')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review / Edit Draft Modal */}
      {viewingDraft && (
        <div className="modal-overlay" onClick={handleCloseDraftReview} style={{ zIndex: 1250 }}>
          <div
            className="modal-content"
            style={{ maxWidth: 650, width: '95%', padding: '24px 28px', borderRadius: 8, boxShadow: '0 12px 35px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header" style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--primary-dark-green)', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📑</span> {language === 'ta' ? 'வரைவை மதிப்பாய்வு / திருத்து' : 'Review & Edit Draft'}
                </h3>
                <span className="muted" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
                  {t('Branch')}: <b>{viewingDraft.branchName}</b> | {formatDisplayDateTime(viewingDraft.updatedAt || viewingDraft.createdAt)}
                </span>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={handleCloseDraftReview}
                disabled={savingEditDraft}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="input-edit-draft-name"
                style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--primary-dark-green)', marginBottom: 6 }}
              >
                {language === 'ta' ? 'வரைவு பெயர்' : 'Draft Name'}
              </label>
              <input
                id="input-edit-draft-name"
                type="text"
                value={editDraftName}
                onChange={e => setEditDraftName(e.target.value)}
                disabled={savingEditDraft}
                style={{ width: '100%', height: 36, padding: '6px 12px', fontSize: 13.5, borderRadius: 6, border: '1px solid var(--border-color)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: 13.5, color: 'var(--primary-dark-green)' }}>
                {language === 'ta' ? 'வரைவு பொருட்கள்' : 'Draft Items'} ({editDraftItems.length})
              </h4>
              <span className="muted" style={{ fontSize: 12 }}>
                {language === 'ta' ? 'மொத்த அளவு' : 'Total Qty'}: <b>{editDraftItems.reduce((acc, it) => acc + (it.requestedQuantity || 0), 0)}</b>
              </span>
            </div>

            <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 20 }}>
              <table className="compact-table" style={{ width: '100%', margin: 0 }}>
                <thead>
                  <tr>
                    <th>{t('Item Name')}</th>
                    <th>{t('Category')}</th>
                    <th>{t('Unit')}</th>
                    <th style={{ textAlign: 'center', width: 110 }}>{t('Quantity')}</th>
                    <th style={{ textAlign: 'center', width: 70 }}>{t('Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {editDraftItems.length > 0 ? (
                    editDraftItems.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <b>{translateItem(item.itemName)}</b>
                          {item.isNewItem && (
                            <span style={{ fontSize: 10, color: '#b45309', marginLeft: 6, fontWeight: 700 }}>
                              [{language === 'ta' ? 'புதியது' : 'New'}]
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ background: '#e2ece9', color: '#003B2B', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                            {translateCategory(item.category)}
                          </span>
                        </td>
                        <td>{translateUnit(item.unit)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            value={item.requestedQuantity}
                            onChange={e => handleUpdateEditDraftItemQty(idx, e.target.value)}
                            disabled={savingEditDraft}
                            style={{ width: 75, height: 30, textAlign: 'right', padding: '3px 6px', fontSize: 13, borderRadius: 5, border: '1px solid var(--border-color)' }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="danger small"
                            onClick={() => handleRemoveEditDraftItem(idx)}
                            disabled={savingEditDraft}
                            style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="empty" style={{ padding: 20 }}>
                        {language === 'ta' ? 'இந்த வரைவில் பொருட்கள் எதுவும் இல்லை.' : 'No items in this draft.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderTop: '1px solid #E5DDC9', paddingTop: 16 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => handleDownloadDraftPdf(viewingDraft)}
                  disabled={savingEditDraft || editDraftItems.length === 0}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34 }}
                >
                  <span>📄</span> {language === 'ta' ? 'PDF பதிவிறக்கு' : 'Download PDF'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleCloseDraftReview}
                  disabled={savingEditDraft}
                  style={{ height: 36, padding: '0 14px', borderRadius: 6 }}
                >
                  {t('Cancel', 'Cancel')}
                </button>

                <button
                  type="button"
                  className="secondary"
                  onClick={handleSaveEditDraftChanges}
                  disabled={savingEditDraft || editDraftItems.length === 0}
                  id="btn-save-draft-changes"
                  style={{ height: 36, padding: '0 16px', fontWeight: 600, borderRadius: 6 }}
                >
                  <span>💾</span> {savingEditDraft ? (language === 'ta' ? 'சேமிக்கிறது...' : 'Saving...') : (language === 'ta' ? 'மாற்றங்களை சேமி' : 'Save Changes')}
                </button>

                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleLoadDraftIntoOrderForm(viewingDraft)}
                  disabled={savingEditDraft || editDraftItems.length === 0}
                  id="btn-load-draft-from-modal"
                  style={{ height: 36, padding: '0 14px', fontWeight: 600, borderRadius: 6 }}
                  title={language === 'ta' ? 'படிவத்தில் ஏற்றவும் (கூடுதல் பொருட்களை சேர்க்க)' : 'Load items into order form to add more items before sending'}
                >
                  <span>📝</span> {language === 'ta' ? 'படிவத்தில் ஏற்று' : 'Load into Form'}
                </button>

                <button
                  type="button"
                  className="primary"
                  onClick={async () => {
                    if (viewingDraft) {
                      await handleSaveEditDraftChanges();
                      handlePromptMoveDraftToOrder({
                        ...viewingDraft,
                        draftName: editDraftName,
                        items: editDraftItems,
                        itemCount: editDraftItems.length,
                        totalQuantity: editDraftItems.reduce((acc, it) => acc + (it.requestedQuantity || 0), 0)
                      });
                    }
                  }}
                  disabled={savingEditDraft || editDraftItems.length === 0}
                  id="btn-move-draft-from-modal"
                  style={{ height: 36, padding: '0 18px', fontWeight: 700, borderRadius: 6, background: 'var(--primary-dark-green)', color: '#ffffff' }}
                >
                  <span>📥</span> {language === 'ta' ? 'ஆர்டர் செய் (Move to Order)' : 'Make Order (Move to Order)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Draft Confirmation Modal */}
      {deleteConfirmDraft && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmDraft(null)} style={{ zIndex: 1260 }}>
          <div
            className="modal-content"
            style={{ maxWidth: 420, padding: '22px 24px', borderRadius: 8 }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0, color: '#dc2626', fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>⚠️</span> {language === 'ta' ? 'வரைவை நீக்குவதை உறுதிசெய்' : 'Delete Draft Confirmation'}
              </h3>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 13.5, color: '#374151', lineHeight: 1.5 }}>
              {language === 'ta'
                ? `"${deleteConfirmDraft.draftName}" என்ற வரைவை நிச்சயமாக நீக்க விரும்புகிறீர்களா? இந்த செயலை மாற்ற முடியாது.`
                : `Are you sure you want to permanently delete draft "${deleteConfirmDraft.draftName}"? This action cannot be undone.`}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setDeleteConfirmDraft(null)}
                disabled={deletingDraft}
                style={{ height: 34, padding: '0 14px' }}
              >
                {t('Cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="danger"
                id="btn-confirm-delete-draft"
                onClick={handleDeleteDraft}
                disabled={deletingDraft}
                style={{ height: 34, padding: '0 16px', fontWeight: 700 }}
              >
                {deletingDraft ? (language === 'ta' ? 'நீக்குகிறது...' : 'Deleting...') : (language === 'ta' ? 'நீக்கு' : 'Delete Draft')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Move to Order Modal */}
      {confirmMoveDraft && (
        <div className="modal-overlay" onClick={() => !movingDraft && setConfirmMoveDraft(null)} style={{ zIndex: 1260 }}>
          <div
            className="modal-content"
            style={{ maxWidth: 480, padding: '22px 24px', borderRadius: 8 }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header" style={{ marginBottom: 14 }}>
              <h3 style={{ margin: 0, color: 'var(--primary-dark-green)', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📥</span> {language === 'ta' ? 'வரைவை ஆர்டராக மாற்றி அனுப்புதல்' : 'Confirm Order Submission'}
              </h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setConfirmMoveDraft(null)}
                disabled={movingDraft}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.5 }}>
              {language === 'ta' ? (
                <>
                  வரைவு <b>"{confirmMoveDraft.draftName}"</b>-ல் உள்ள <b>{confirmMoveDraft.itemCount || confirmMoveDraft.items?.length}</b> பொருட்களை உடனடியாக ஆர்டராக மாற்றி சேமிப்பக மேலாளருக்கு அனுப்ப விரும்புகிறீர்களா?
                </>
              ) : (
                <>
                  Are you sure you want to submit draft <b>"{confirmMoveDraft.draftName}"</b> with <b>{confirmMoveDraft.itemCount || confirmMoveDraft.items?.length} item(s)</b> (Total Qty: <b>{confirmMoveDraft.totalQuantity}</b>) as an active order to the Store Manager?
                </>
              )}
            </p>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#166534' }}>
              ℹ️ {language === 'ta'
                ? 'இந்த ஆர்டர் சேமிப்பக மேலாளரின் அனுப்புதல் பக்கத்திலும் உங்கள் வரலாறு பக்கத்திலும் உடனடியாக தோன்றும்.'
                : 'This will immediately place the order with PENDING status in Store Manager\'s dispatch and your History.'}
            </div>

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setConfirmMoveDraft(null)}
                disabled={movingDraft}
                style={{ height: 36, padding: '0 16px' }}
              >
                {t('Cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="primary"
                id="btn-confirm-place-draft-order"
                onClick={handleExecuteMoveDraftToOrder}
                disabled={movingDraft}
                style={{
                  height: 36,
                  padding: '0 20px',
                  fontWeight: 700,
                  background: 'var(--primary-dark-green)',
                  color: '#ffffff'
                }}
              >
                {movingDraft
                  ? (language === 'ta' ? 'அனுப்புகிறது...' : 'Submitting Order...')
                  : (language === 'ta' ? 'உறுதிசெய்து ஆர்டர் செய்' : 'Confirm & Place Order')}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {t('Return Dispatched Item', 'Return Dispatched Item')}
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
                    <div style={{ fontSize: 11, color: '#666' }}>{t('Dispatched', 'Dispatched')}</div>
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
                      min="1"
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
                  disabled={isSubmittingReturn || !returnQty || parseInt(returnQty, 10) <= 0}
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
        const parsedVal = actualReceivedQty === '' ? NaN : parseInt(actualReceivedQty, 10);
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
                    <span>{t('Original Dispatch Date & Time', 'Original Dispatch Date & Time')}:</span>
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
                        {t('Dispatched Quantity', 'Dispatched Quantity')}
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
                        step="1"
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
                        ({t('Shortage Quantity = Dispatched Quantity - Actual Received Quantity', 'Shortage = Dispatched - Received')})
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
                            ? `பெறப்பட்ட அளவு (${parsedVal}) அனுப்பப்பட்ட அளவை (${dispatched}) விட அதிகமாக இருக்க முடியாது.`
                            : `Actual received quantity (${parsedVal}) cannot exceed dispatched quantity (${dispatched}).`}
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
                              {t('Zero Receipt — Entire Dispatched Quantity Missing', 'Zero Receipt — Entire Dispatched Quantity Missing')}
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
