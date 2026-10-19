import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Alert } from '../components/Alert';
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

export function BranchPortal({ user, activeTab }) {
  const { language, t, translateItem, translateUnit, translateStatus, translateRole } = useLanguage();
  // Alerts
  const [alert, setAlert] = useState(null);
  const showAlert = (type, message) => setAlert({ type, message });

  // Common data
  const [catalogueItems, setCatalogueItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // 1. Order Items states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemUnit, setItemUnit] = useState('');
  const [requestedQty, setRequestedQty] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const [orderItemsList, setOrderItemsList] = useState([]);
  const [submittingBranchOrder, setSubmittingBranchOrder] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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
  const [acknowledgingId, setAcknowledgingId] = useState(null);

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

    // Prevent duplicate item lines in the same unsent request list
    const existingIndex = orderItemsList.findIndex(
      x => x.itemName.trim().toLowerCase() === finalName.toLowerCase()
    );
    if (existingIndex >= 0) {
      const existing = orderItemsList[existingIndex];
      const updatedQty = existing.requestedQuantity + q;
      showAlert('warning', `"${finalName}" is already in your request list. Updated its quantity to ${updatedQty}. You can edit it directly in the table.`);
      setOrderItemsList(prev => prev.map((item, idx) => {
        if (idx === existingIndex) {
          return { ...item, requestedQuantity: updatedQty };
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
        unit: finalUnit,
        requestedQuantity: q,
        isNewItem: !selectedItem && !catalogueItems.some(it => it.name.toLowerCase() === finalName.toLowerCase())
      }
    ]);

    showAlert('success', `✓ Added ${q} ${finalUnit} of "${finalName}" to request list.`);

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

    for (const it of orderItemsList) {
      if (!it.requestedQuantity || it.requestedQuantity <= 0) {
        showAlert('error', `Requested quantity for "${it.itemName}" must be greater than 0.`);
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const handleCancelConfirmModal = () => {
    if (submittingBranchOrder) return;
    setShowConfirmModal(false);
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

    try {
      setSubmittingBranchOrder(true);
      await api.submitBranchRequest(orderItemsList.map(it => ({
        itemName: it.itemName,
        unit: it.unit,
        requestedQuantity: it.requestedQuantity,
        isNewItem: it.isNewItem
      })));

      showAlert('success', `✓ Your request with ${orderItemsList.length} distinct item line(s) was sent to the Store Manager successfully!`);
      setOrderItemsList([]);
      setShowConfirmModal(false);
      await loadMyRequests(requestFilterDate, requestIsAllDates);
      // Return focus automatically to the Item Name input for entering the next order
      setTimeout(() => {
        itemInputRef.current?.focus();
      }, 50);
    } catch (err) {
      showAlert('error', err.message || 'Failed to submit request.');
    } finally {
      setSubmittingBranchOrder(false);
    }
  };

  // Acknowledge Received Delivery
  const handleAcknowledgeDelivery = async (dispatchRecord) => {
    if (acknowledgingId) return;
    try {
      setAcknowledgingId(dispatchRecord.id);
      await api.acknowledgeDelivery(dispatchRecord.id);
      showAlert('success', `✓ Successfully confirmed receipt of ${dispatchRecord.quantity} ${dispatchRecord.unit} of ${dispatchRecord.itemName}! Confirmed received quantity updated.`);
      await loadDeliveries(deliveryDate, deliveryIsAllDates);
    } catch (err) {
      showAlert('error', err.message || 'Failed to acknowledge delivery');
    } finally {
      setAcknowledgingId(null);
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
              <div className="card-header">
                <div>
                  <h3 className="card-title">{t('Items Being Requested', 'கோரப்படும் பொருட்கள்')} ({orderItemsList.length})</h3>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {t('Review and edit quantities before sending your request to the Store Manager.', 'கிடங்கு மேலாளருக்கு கோரிக்கையை அனுப்பும் முன் அளவுகளை சரிபார்க்கவும்.')}
                  </p>
                </div>
              </div>

              <div className="table-wrap">
                <table className="branch-request-table">
                  <thead>
                    <tr>
                      <th>{t('Item Name')}</th>
                      <th>{t('Unit')}</th>
                      <th>{t('Requested Quantity')}</th>
                      <th>{t('Category', 'வகை')}</th>
                      <th>{t('Action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItemsList.length > 0 ? (
                      orderItemsList.map(item => (
                        <tr key={item.id}>
                          <td><b>{translateItem(item.itemName)}</b></td>
                          <td><span className="autocomplete-unit-badge">{translateUnit(item.unit)}</span></td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              className="qty-input"
                              value={item.requestedQuantity}
                              onChange={e => handleUpdateOrderItemQty(item.id, e.target.value)}
                            />
                          </td>
                          <td>
                            <span style={{ fontSize: 12, color: item.isNewItem ? '#8c671b' : 'var(--green)', fontWeight: 600 }}>
                              {item.isNewItem ? t('New Item') : t('Catalogue', 'பட்டியல்')}
                            </span>
                          </td>
                          <td>
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

              <div className="form-actions" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="primary"
                  id="send-order-btn"
                  ref={sendOrderBtnRef}
                  disabled={orderItemsList.length === 0}
                  onClick={handleOpenConfirmModal}
                >
                  {t('Send Order', 'கோரிக்கையை அனுப்பு')} ({orderItemsList.length} {t('items')})
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
                        <th>{t('Unit')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Requested Quantity')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItemsList.map((item, idx) => (
                        <tr key={item.id}>
                          <td style={{ color: 'var(--muted)' }}>{idx + 1}</td>
                          <td><b>{translateItem(item.itemName)}</b></td>
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
                          <th style={{ width: '180px' }}>{t('Dispatch Date & Time', 'Dispatch Date & Time')}</th>
                          <th>{t('Item Name', 'Item Name')}</th>
                          <th style={{ width: '85px', textAlign: 'center' }}>{t('Unit', 'Unit')}</th>
                          <th style={{ width: '150px', textAlign: 'center' }}>{t('Dispatched Quantity', 'Dispatched Quantity')}</th>
                          <th style={{ width: '190px', textAlign: 'center' }}>{t('Acknowledgement Action', 'Acknowledgement Action')}</th>
                          <th style={{ width: '160px', textAlign: 'center' }}>{t('Return Action', 'Return Action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grp.items.map(d => {
                          const isAck = (d.status || '').toUpperCase() === 'ACKNOWLEDGED';
                          const isProc = acknowledgingId === d.id;
                          const alreadyReturned = d.returnedQuantity || 0;
                          const isFullyReturned = alreadyReturned >= d.quantity;
                          return (
                            <tr
                              key={d.id}
                              style={isAck ? {
                                backgroundColor: '#edf7ee',
                                borderLeft: '4px solid #2e7d32',
                                transition: 'background-color 0.25s ease'
                              } : {
                                borderLeft: '4px solid transparent',
                                transition: 'background-color 0.25s ease'
                              }}
                            >
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
                                {!isAck ? (
                                  <button
                                    type="button"
                                    className="primary small"
                                    disabled={isProc}
                                    onClick={() => handleAcknowledgeDelivery(d)}
                                    style={{ width: '100%', maxWidth: '160px' }}
                                  >
                                    {isProc ? t('Confirming...', 'Confirming...') : t('Acknowledge Received', 'Acknowledge Received')}
                                  </button>
                                ) : (
                                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                    <span style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      color: '#1b5e20',
                                      fontWeight: 700,
                                      fontSize: '12px',
                                      background: 'rgba(46, 125, 50, 0.15)',
                                      padding: '3px 8px',
                                      borderRadius: '4px'
                                    }}>
                                      ✓ {t('Received', 'Received')}
                                    </span>
                                    {d.acknowledgedAt && (
                                      <span className="muted" style={{ fontSize: '11px' }}>
                                        {formatDateTime(d.acknowledgedAt, language)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                  <button
                                    type="button"
                                    className="secondary small"
                                    disabled={isFullyReturned}
                                    onClick={() => handleOpenReturnModal(d)}
                                    title={isFullyReturned ? t('Fully Returned', 'Dispatched quantity has been fully returned') : t('Return', 'Return item to central inventory')}
                                    style={{
                                      width: '100%',
                                      maxWidth: '120px',
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
                      <th style={{ width: '180px' }}>{t('Dispatch Date & Time', 'Dispatch Date & Time')}</th>
                      <th>{t('Item Name', 'Item Name')}</th>
                      <th style={{ width: '85px', textAlign: 'center' }}>{t('Unit', 'Unit')}</th>
                      <th style={{ width: '150px', textAlign: 'center' }}>{t('Dispatched Quantity', 'Dispatched Quantity')}</th>
                      <th style={{ width: '190px', textAlign: 'center' }}>{t('Acknowledgement Action', 'Acknowledgement Action')}</th>
                      <th style={{ width: '160px', textAlign: 'center' }}>{t('Return Action', 'Return Action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map(d => {
                      const isAck = (d.status || '').toUpperCase() === 'ACKNOWLEDGED';
                      const isProc = acknowledgingId === d.id;
                      const alreadyReturned = d.returnedQuantity || 0;
                      const isFullyReturned = alreadyReturned >= d.quantity;
                      return (
                        <tr
                          key={d.id}
                          style={isAck ? {
                            backgroundColor: '#edf7ee',
                            borderLeft: '4px solid #2e7d32',
                            transition: 'background-color 0.25s ease'
                          } : {
                            borderLeft: '4px solid transparent',
                            transition: 'background-color 0.25s ease'
                          }}
                        >
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
                            {!isAck ? (
                              <button
                                type="button"
                                className="primary small"
                                disabled={isProc}
                                onClick={() => handleAcknowledgeDelivery(d)}
                                style={{ width: '100%', maxWidth: '160px' }}
                              >
                                {isProc ? t('Confirming...', 'Confirming...') : t('Acknowledge Received', 'Acknowledge Received')}
                              </button>
                            ) : (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  color: '#1b5e20',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  background: 'rgba(46, 125, 50, 0.15)',
                                  padding: '3px 8px',
                                  borderRadius: '4px'
                                }}>
                                  ✓ {t('Received', 'Received')}
                                </span>
                                {d.acknowledgedAt && (
                                  <span className="muted" style={{ fontSize: '11px' }}>
                                    {formatDateTime(d.acknowledgedAt, language)}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                              <button
                                type="button"
                                className="secondary small"
                                disabled={isFullyReturned}
                                onClick={() => handleOpenReturnModal(d)}
                                title={isFullyReturned ? t('Fully Returned', 'Dispatched quantity has been fully returned') : t('Return', 'Return item to central inventory')}
                                style={{
                                  width: '100%',
                                  maxWidth: '120px',
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
                            <th>{t('Unit', 'Unit')}</th>
                            <th>{t('Received Quantity', 'Received Quantity')}</th>
                            <th>{t('Status', 'Status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grp.items.map(d => (
                            <tr key={d.id}>
                              <td><b>{formatDateTime(d.acknowledgedAt, language)}</b></td>
                              <td>{formatDateTime(d.createdAt || d.dispatchDate, language)}</td>
                              <td><b>{translateItem(d.itemName)}</b></td>
                              <td>{translateUnit(d.unit)}</td>
                              <td>
                                <span style={{ fontWeight: 700, color: 'var(--green)' }}>
                                  {d.quantity} {translateUnit(d.unit)}
                                </span>
                                {(d.returnedQuantity || 0) > 0 && (
                                  <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                                    {t('Returned', 'Returned')}: {d.returnedQuantity} {translateUnit(d.unit)}
                                  </div>
                                )}
                              </td>
                              <td>
                                <span className="badge badge-completed">
                                  ✓ {t('Acknowledged', 'Acknowledged')}
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
                      <th>{t('Acknowledgement Date & Time', 'Acknowledgement Date & Time')}</th>
                      <th>{t('Original Dispatch Date & Time', 'Original Dispatch Date & Time')}</th>
                      <th>{t('Item Name', 'Item Name')}</th>
                      <th>{t('Unit', 'Unit')}</th>
                      <th>{t('Received Quantity', 'Received Quantity')}</th>
                      <th>{t('Status', 'Status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedHistory.map(d => (
                      <tr key={d.id}>
                        <td><b>{formatDateTime(d.acknowledgedAt, language)}</b></td>
                        <td>{formatDateTime(d.createdAt || d.dispatchDate, language)}</td>
                        <td><b>{translateItem(d.itemName)}</b></td>
                        <td>{translateUnit(d.unit)}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: 'var(--green)' }}>
                            {d.quantity} {translateUnit(d.unit)}
                          </span>
                          {(d.returnedQuantity || 0) > 0 && (
                            <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600, marginTop: '2px' }}>
                              {t('Returned', 'Returned')}: {d.returnedQuantity} {translateUnit(d.unit)}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-completed">
                            ✓ {t('Acknowledged', 'Acknowledged')}
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

      {/* Return Dispatched Item Modal Popup */}
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
    </div>
  );
}
