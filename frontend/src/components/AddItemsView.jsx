import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api';
import { Alert } from './Alert';
import { useLanguage } from '../i18n/LanguageContext';

export const STANDARD_UNITS = [
  'KG',
  'LITRE',
  'PACKET',
  'PIECE',
  'GRAM',
  'BOX',
  'TIN',
  'BUNDLE'
];

export function AddItemsView({ userRole }) {
  const { language, t, translateItem, translateUnit, translateCategory } = useLanguage();

  // Active view: 'items' (Item Master list & search) | 'add-item' | 'categories' (Category Management)
  const [activeSubTab, setActiveSubTab] = useState('items');

  // Alerts
  const [alert, setAlert] = useState(null);
  const showAlert = (type, message) => {
    setAlert({ type, message });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Data state
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Filters for Item Master table
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');

  // Form state: Add Item
  const [itemName, setItemName] = useState('');
  const [itemUnit, setItemUnit] = useState('KG');
  const [customUnit, setCustomUnit] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [savingItem, setSavingItem] = useState(false);

  // Edit Item Modal state
  const [editingItem, setEditingItem] = useState(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemUnit, setEditItemUnit] = useState('KG');
  const [editCustomUnit, setEditCustomUnit] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [savingItemEdit, setSavingItemEdit] = useState(false);

  // Category Modal / Quick Create state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // Delete Category confirmation state
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [permanentDeleteOption, setPermanentDeleteOption] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState(false);

  // Category search filter in dropdown
  const [catSearchQuery, setCatSearchQuery] = useState('');
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const catDropdownRef = useRef(null);

  // Load items from backend
  const loadItems = async () => {
    try {
      setLoadingItems(true);
      const data = await api.getItems();
      if (Array.isArray(data)) {
        setItems(data);
      }
    } catch (err) {
      console.error('Failed to load items', err);
      showAlert('error', err.message || t('Failed to load items'));
    } finally {
      setLoadingItems(false);
    }
  };

  // Load categories from backend (including inactive when in category management)
  const loadCategories = async () => {
    try {
      setLoadingCategories(true);
      const data = await api.getCategories(true);
      if (Array.isArray(data)) {
        setCategories(data);
      }
    } catch (err) {
      console.error('Failed to load categories', err);
      showAlert('error', err.message || t('Failed to load categories'));
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    loadItems();
    loadCategories();
  }, []);

  // Close custom dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (catDropdownRef.current && !catDropdownRef.current.contains(e.target)) {
        setIsCatDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered active categories for dropdown
  const activeCategories = useMemo(() => {
    return categories.filter(c => c.active !== false);
  }, [categories]);

  // Filtered categories in searchable dropdown
  const filteredDropdownCategories = useMemo(() => {
    if (!catSearchQuery.trim()) return activeCategories;
    const q = catSearchQuery.trim().toLowerCase();
    return activeCategories.filter(c => c.name.toLowerCase().includes(q));
  }, [activeCategories, catSearchQuery]);

  // Selected category object in Add form
  const currentSelectedCategory = useMemo(() => {
    return categories.find(c => String(c.id) === String(selectedCategoryId));
  }, [categories, selectedCategoryId]);

  // Filtered items list
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (selectedCategoryFilter !== 'ALL') {
        const itemCat = (item.category || '').toLowerCase();
        if (itemCat !== selectedCategoryFilter.toLowerCase()) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const nameMatch = (item.name || '').toLowerCase().includes(q);
        const catMatch = (item.category || '').toLowerCase().includes(q);
        const unitMatch = (item.unit || '').toLowerCase().includes(q);
        if (!nameMatch && !catMatch && !unitMatch) return false;
      }
      return true;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [items, searchQuery, selectedCategoryFilter]);

  // -------------------------------------------------------------------------
  // ITEM CREATION (Item Master only - Stock = 0, no stock receipts created)
  // -------------------------------------------------------------------------
  const handleAddItem = async (e) => {
    e.preventDefault();
    const finalName = itemName.trim();
    if (!finalName) {
      return showAlert('error', t('Please enter a valid item name.'));
    }

    const finalUnit = (itemUnit === 'CUSTOM' ? customUnit : itemUnit).trim().toUpperCase();
    if (!finalUnit) {
      return showAlert('error', t('Please select a unit.'));
    }

    if (!selectedCategoryId) {
      return showAlert('error', t('Please select a category.'));
    }

    const catObj = categories.find(c => String(c.id) === String(selectedCategoryId));
    const catName = catObj ? catObj.name : null;

    try {
      setSavingItem(true);
      const created = await api.createItem({
        name: finalName,
        unit: finalUnit,
        category: catName,
        categoryId: selectedCategoryId ? Number(selectedCategoryId) : null
      });

      showAlert('success', language === 'ta'
        ? `✓ பொருள் "${created.name}" பொருள் முதன்மை பட்டியலில் வெற்றிகரமாக சேர்க்கப்பட்டது!`
        : `✓ Item "${created.name}" added to item master successfully! (Current stock: 0)`);

      // Reset form
      setItemName('');
      setItemUnit('KG');
      setCustomUnit('');
      setSelectedCategoryId('');

      await loadItems();
      setActiveSubTab('items');
    } catch (err) {
      console.error('Failed to add item', err);
      showAlert('error', err.message || t('Failed to create item'));
    } finally {
      setSavingItem(false);
    }
  };

  // -------------------------------------------------------------------------
  // ITEM EDITING (Name, Unit, Category only - Stock is preserved unchanged)
  // -------------------------------------------------------------------------
  const handleOpenEditItem = (item) => {
    setEditingItem(item);
    setEditItemName(item.name || '');
    const isStdUnit = STANDARD_UNITS.includes((item.unit || '').toUpperCase());
    if (isStdUnit) {
      setEditItemUnit((item.unit || 'KG').toUpperCase());
      setEditCustomUnit('');
    } else {
      setEditItemUnit('CUSTOM');
      setEditCustomUnit(item.unit || '');
    }

    // Match category by ID or name
    const matchedCat = categories.find(c => 
      (item.categoryId && c.id === item.categoryId) ||
      (c.name && item.category && c.name.toLowerCase() === item.category.toLowerCase())
    );
    setEditCategoryId(matchedCat ? String(matchedCat.id) : '');
  };

  const handleSaveItemEdit = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    const finalName = editItemName.trim();
    if (!finalName) {
      return showAlert('error', t('Please enter a valid item name.'));
    }

    const finalUnit = (editItemUnit === 'CUSTOM' ? editCustomUnit : editItemUnit).trim().toUpperCase();
    if (!finalUnit) {
      return showAlert('error', t('Please select a unit.'));
    }

    if (!editCategoryId) {
      return showAlert('error', t('Please select a category.'));
    }

    const catObj = categories.find(c => String(c.id) === String(editCategoryId));
    const catName = catObj ? catObj.name : null;

    try {
      setSavingItemEdit(true);
      const updated = await api.updateItem(editingItem.id, {
        name: finalName,
        unit: finalUnit,
        category: catName,
        categoryId: editCategoryId ? Number(editCategoryId) : null
      });

      showAlert('success', language === 'ta'
        ? `✓ பொருள் "${updated.name}" வெற்றிகரமாக புதுப்பிக்கப்பட்டது!`
        : `✓ Item "${updated.name}" updated successfully!`);

      setEditingItem(null);
      await loadItems();
    } catch (err) {
      console.error('Failed to update item', err);
      showAlert('error', err.message || t('Failed to update item'));
    } finally {
      setSavingItemEdit(false);
    }
  };

  // -------------------------------------------------------------------------
  // CATEGORY CREATION & EDITING
  // -------------------------------------------------------------------------
  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setCategoryNameInput('');
    setShowCategoryModal(true);
  };

  const handleOpenEditCategory = (cat) => {
    setEditingCategory(cat);
    setCategoryNameInput(cat.name || '');
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    const finalName = categoryNameInput.trim();
    if (!finalName) {
      return showAlert('error', language === 'ta' ? 'வகையின் பெயரை உள்ளிடவும்.' : 'Please enter a category name.');
    }

    try {
      setSavingCategory(true);
      if (editingCategory) {
        // Edit Category
        const updated = await api.updateCategory(editingCategory.id, {
          name: finalName,
          active: editingCategory.active !== false
        });

        showAlert('success', language === 'ta'
          ? `✓ வகை "${updated.name}" வெற்றிகரமாக புதுப்பிக்கப்பட்டது!`
          : `✓ Category "${updated.name}" updated successfully!`);
      } else {
        // Create Category
        const created = await api.createCategory({ name: finalName });

        showAlert('success', language === 'ta'
          ? `✓ புதிய வகை "${created.name}" வெற்றிகரமாக உருவாக்கப்பட்டது!`
          : `✓ New category "${created.name}" created successfully!`);

        // Automatically select the new category in Add Item form
        setSelectedCategoryId(String(created.id));
      }

      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryNameInput('');
      await loadCategories();
      await loadItems(); // Refresh items in case renamed category updated item display
    } catch (err) {
      console.error('Failed to save category', err);
      showAlert('error', err.message || t('Category already exists.'));
    } finally {
      setSavingCategory(false);
    }
  };

  const handleToggleCategoryActive = async (cat) => {
    try {
      const newActive = !cat.active;
      await api.updateCategory(cat.id, {
        name: cat.name,
        active: newActive
      });

      showAlert('success', language === 'ta'
        ? `✓ வகை "${cat.name}" ${newActive ? 'செயல்படுத்தப்பட்டது' : 'செயலிழக்கப்பட்டது'}.`
        : `✓ Category "${cat.name}" has been ${newActive ? 'activated' : 'deactivated'}.`);

      await loadCategories();
    } catch (err) {
      console.error('Failed to toggle category status', err);
      showAlert('error', err.message || t('Failed to update category'));
    }
  };

  const handleOpenDeleteCategory = (cat) => {
    setCategoryToDelete(cat);
    setPermanentDeleteOption(false);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      setDeletingCategory(true);
      const res = await api.deleteCategory(categoryToDelete.id, permanentDeleteOption);
      const isDeactivated = res && res.action === 'deactivated';

      showAlert('success', language === 'ta'
        ? `✓ வகை "${categoryToDelete.name}" ${isDeactivated ? 'விருப்பங்களிலிருந்து நீக்கப்பட்டது (செயலிழக்கப்பட்டது)' : 'வெற்றிகரமாக நீக்கப்பட்டது'}!`
        : `✓ Category "${categoryToDelete.name}" has been ${isDeactivated ? 'removed from active options' : 'permanently deleted'}!`);

      if (String(selectedCategoryId) === String(categoryToDelete.id)) {
        setSelectedCategoryId('');
      }
      if (String(editCategoryId) === String(categoryToDelete.id)) {
        setEditCategoryId('');
      }

      setCategoryToDelete(null);
      await loadCategories();
      await loadItems();
    } catch (err) {
      console.error('Failed to remove category', err);
      showAlert('error', err.message || t('Failed to remove category'));
    } finally {
      setDeletingCategory(false);
    }
  };

  return (
    <section className="add-items-module">
      <Alert
        type={alert?.type}
        message={alert?.message}
        onDismiss={() => setAlert(null)}
      />

      {/* Module Title Banner */}
      <div className="card" style={{ marginBottom: 18, borderLeft: '4px solid var(--primary-gold, #d4a373)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--primary-dark-green, #1b4332)' }}>
              🏷️ {t('Add Items', 'Add Items')} — {t('Item Master & Reusable Categories', 'Item Master & Reusable Categories')}
            </h2>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
              {language === 'ta'
                ? 'பொருள் பட்டியல் மற்றும் மறுபயன்பாட்டு வகைகளை நிர்வகிக்கவும். (இருப்பு அளவுகள் இதில் மாற்றப்படாது).'
                : 'Maintain the master catalog of items and reusable classifications. This module does NOT modify inventory stock balances.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className={activeSubTab === 'items' ? 'primary small' : 'secondary small'}
              onClick={() => setActiveSubTab('items')}
            >
              📋 {t('Item Master')} ({items.length})
            </button>
            <button
              type="button"
              className={activeSubTab === 'add-item' ? 'primary small' : 'secondary small'}
              onClick={() => setActiveSubTab('add-item')}
            >
              ➕ {t('Add New Item', 'Add New Item')}
            </button>
            <button
              type="button"
              className={activeSubTab === 'categories' ? 'primary small' : 'secondary small'}
              onClick={() => setActiveSubTab('categories')}
            >
              🗂️ {t('Manage Categories', 'Manage Categories')} ({categories.length})
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SUB-TAB 1: VIEW & SEARCH ITEM MASTER LIST
          ========================================================================= */}
      {activeSubTab === 'items' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <h3 className="card-title" style={{ fontSize: 16, margin: 0 }}>
              📋 {t('Item Master', 'Item Master')} ({filteredItems.length} {t('items')})
            </h3>
            <button
              type="button"
              className="primary small"
              onClick={() => setActiveSubTab('add-item')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              ➕ {t('Add Item', 'Add Item')}
            </button>
          </div>

          {/* Search and Category Filter Bar */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 14, marginBottom: 16 }}>
            <div style={{ flex: '1 1 240px', minWidth: 200 }}>
              <input
                type="text"
                placeholder={t('Search by item name or category...', 'Search by item name or category...')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 6, border: '1px solid #ccc' }}
              />
            </div>
            <div style={{ flex: '0 1 200px', minWidth: 160 }}>
              <select
                value={selectedCategoryFilter}
                onChange={e => setSelectedCategoryFilter(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', fontSize: 14, borderRadius: 6, border: '1px solid #ccc' }}
              >
                <option value="ALL">-- {t('All Categories', 'All Categories')} --</option>
                {activeCategories.map(cat => (
                  <option key={cat.id} value={cat.name}>
                    {translateCategory(cat.name)}
                  </option>
                ))}
              </select>
            </div>
            {(searchQuery || selectedCategoryFilter !== 'ALL') && (
              <button
                type="button"
                className="secondary small"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategoryFilter('ALL');
                }}
              >
                ✕ {t('Clear')}
              </button>
            )}
          </div>

          {loadingItems ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#666' }}>
              {t('Loading items...')}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="mobile-empty-card" style={{ padding: 30, textAlign: 'center', color: '#888' }}>
              {searchQuery || selectedCategoryFilter !== 'ALL'
                ? t('No items match the current search or category filter.')
                : t('No items in the item master catalogue yet.')}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>{t('Item Name')}</th>
                    <th>{t('Category')}</th>
                    <th>{t('Unit')}</th>
                    <th style={{ textAlign: 'center', width: 120 }}>{t('Current Stock')}</th>
                    <th style={{ textAlign: 'center', width: 90 }}>{t('Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td>{idx + 1}</td>
                      <td>
                        <b style={{ color: 'var(--primary-dark-green, #1b4332)' }}>
                          {translateItem(item.name)}
                        </b>
                      </td>
                      <td>
                        <span className="badge badge-ordered" style={{ fontSize: 12 }}>
                          {translateCategory(item.category) || 'General'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{translateUnit(item.unit)}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 700,
                            background: item.stock > 0 ? '#e8f5e9' : '#f5f5f5',
                            color: item.stock > 0 ? '#2e7d32' : '#757575',
                            border: '1px solid ' + (item.stock > 0 ? '#c8e6c9' : '#e0e0e0')
                          }}
                          title={language === 'ta' ? 'சரக்கு இருப்பு (படிக்க மட்டும்)' : 'Current stock quantity (Read-only)'}
                        >
                          {item.stock} {translateUnit(item.unit)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="secondary small"
                          onClick={() => handleOpenEditItem(item)}
                          style={{ fontSize: 12, padding: '4px 10px' }}
                        >
                          ✏️ {t('Edit')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 2: ADD NEW ITEM FORM
          ========================================================================= */}
      {activeSubTab === 'add-item' && (
        <div className="card narrow" style={{ maxWidth: 640, margin: '0 auto' }}>
          <div className="card-header" style={{ marginBottom: 12 }}>
            <h3 className="card-title" style={{ fontSize: 17, margin: 0 }}>
              ➕ {t('Add Item', 'Add Item')}
            </h3>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
              {language === 'ta'
                ? 'பொருள் பெயர், அளவு மற்றும் வகையைக் குறிப்பிட்டு பட்டியலில் சேர்க்கவும்.'
                : 'Define item attributes in the item master. Stock starts at 0 without altering inventory.'}
            </p>
          </div>

          <form onSubmit={handleAddItem} style={{ marginTop: 12 }}>
            <div className="form-grid">
              {/* 1. Item Name */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--primary-dark-green)', marginBottom: 6 }}>
                  {t('Item Name')} *
                </label>
                <input
                  type="text"
                  placeholder={language === 'ta' ? 'எ.கா: பால், துவரம் பருப்பு, தக்காளி' : 'e.g. Milk, Toor Dal, Tomato, Tea Powder'}
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 6, border: '1.5px solid #ccc' }}
                />
              </div>

              {/* 2. Unit */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, color: 'var(--primary-dark-green)', marginBottom: 6 }}>
                  {t('Unit')} *
                </label>
                <select
                  value={itemUnit}
                  onChange={e => setItemUnit(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', fontSize: 14, borderRadius: 6, border: '1.5px solid #ccc' }}
                >
                  {STANDARD_UNITS.map(u => (
                    <option key={u} value={u}>
                      {u} ({translateUnit(u.toLowerCase())})
                    </option>
                  ))}
                  <option value="CUSTOM">-- {t('Custom Unit', 'Custom Unit')} --</option>
                </select>
                {itemUnit === 'CUSTOM' && (
                  <input
                    type="text"
                    placeholder={language === 'ta' ? 'தனிப்பயன் அலகு (எ.கா: Bag)' : 'Custom unit (e.g. Bag, Tray)'}
                    value={customUnit}
                    onChange={e => setCustomUnit(e.target.value)}
                    required
                    style={{ marginTop: 6, width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #aaa' }}
                  />
                )}
              </div>

              {/* 3. Category Searchable Dropdown with + New Category option */}
              <div ref={catDropdownRef} style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary-dark-green)', margin: 0 }}>
                    {t('Category')} *
                  </label>
                  <button
                    type="button"
                    onClick={handleOpenCreateCategory}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary-dark-green)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'underline'
                    }}
                  >
                    + {t('Create Category', 'Create Category')}
                  </button>
                </div>

                {/* Dropdown Display Button */}
                <div
                  onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: '1.5px solid #ccc',
                    background: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 14
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <span style={{
                      color: currentSelectedCategory ? 'inherit' : '#888',
                      fontWeight: currentSelectedCategory ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {currentSelectedCategory ? translateCategory(currentSelectedCategory.name) : `-- ${t('Select Category')} --`}
                    </span>
                    {currentSelectedCategory && (
                      <span
                        title={t('Clear selected category', 'தேர்ந்தெடுக்கப்பட்ட வகையை நீக்கு')}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCategoryId('');
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: '#e5e7eb',
                          color: '#4b5563',
                          fontSize: 11,
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#e5e7eb'; e.currentTarget.style.color = '#4b5563'; }}
                      >
                        ✕
                      </span>
                    )}
                  </div>
                  <span>▼</span>
                </div>

                {/* Dropdown Menu */}
                {isCatDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      background: '#fff',
                      border: '1px solid #ccc',
                      borderRadius: 6,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      marginTop: 4,
                      maxHeight: 240,
                      overflowY: 'auto'
                    }}
                  >
                    <div style={{ padding: 6, borderBottom: '1px solid #eee' }}>
                      <input
                        type="text"
                        placeholder={t('Search categories...', 'Search categories...')}
                        value={catSearchQuery}
                        onChange={e => setCatSearchQuery(e.target.value)}
                        autoFocus
                        style={{ width: '100%', padding: '6px 8px', fontSize: 13, borderRadius: 4, border: '1px solid #ddd' }}
                      />
                    </div>
                    {filteredDropdownCategories.length === 0 ? (
                      <div style={{ padding: '10px 12px', fontSize: 13, color: '#888', textAlign: 'center' }}>
                        {t('No categories found.')}
                        <div style={{ marginTop: 6 }}>
                          <button
                            type="button"
                            className="secondary small"
                            onClick={() => {
                              setIsCatDropdownOpen(false);
                              handleOpenCreateCategory();
                            }}
                            style={{ fontSize: 11 }}
                          >
                            + {t('Create', 'Create')} "{catSearchQuery}"
                          </button>
                        </div>
                      </div>
                    ) : (
                      filteredDropdownCategories.map(cat => (
                        <div
                          key={cat.id}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: String(cat.id) === String(selectedCategoryId) ? '#f0fdf4' : 'transparent',
                            fontWeight: String(cat.id) === String(selectedCategoryId) ? 700 : 400,
                            color: String(cat.id) === String(selectedCategoryId) ? 'var(--primary-dark-green)' : 'inherit',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                          onMouseLeave={e => e.currentTarget.style.background = String(cat.id) === String(selectedCategoryId) ? '#f0fdf4' : 'transparent'}
                        >
                          <span
                            style={{ flex: 1, paddingRight: 8 }}
                            onClick={() => {
                              setSelectedCategoryId(String(cat.id));
                              setIsCatDropdownOpen(false);
                              setCatSearchQuery('');
                            }}
                          >
                            {translateCategory(cat.name)}
                          </span>
                          <button
                            type="button"
                            title={t('Remove this category option', 'இந்த வகை தேர்வை நீக்கு')}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDeleteCategory(cat);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 13,
                              color: '#dc2626',
                              opacity: 0.7,
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = '#fee2e2'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'none'; }}
                          >
                            🗑️
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="card-actions" style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <button
                type="submit"
                className="primary"
                disabled={savingItem}
                style={{ minHeight: 40, flex: 1 }}
              >
                {savingItem ? t('Saving...') : t('Save Item', 'Save to Item Master')}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setActiveSubTab('items')}
                disabled={savingItem}
              >
                {t('Cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          SUB-TAB 3: REUSABLE CATEGORIES MANAGEMENT
          ========================================================================= */}
      {activeSubTab === 'categories' && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 className="card-title" style={{ fontSize: 16, margin: 0 }}>
                🗂️ {t('Categories', 'Reusable Categories')} ({categories.length})
              </h3>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
                {language === 'ta'
                  ? 'பொருட்களின் வகைகளை நிர்வகிக்கவும். பெயரைத் திருத்தும்போது தொடர்புடைய அனைத்து பொருட்களும் தானாக புதுப்பிக்கப்படும்.'
                  : 'Manage persistent item categories. Renaming a category automatically updates all associated items.'}
              </p>
            </div>
            <button
              type="button"
              className="primary small"
              onClick={handleOpenCreateCategory}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              ➕ {t('Create Category', 'Create Category')}
            </button>
          </div>

          {loadingCategories ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#666' }}>
              {t('Loading categories...')}
            </div>
          ) : (
            <div className="table-responsive" style={{ marginTop: 14 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>{t('Category Name')}</th>
                    <th>{t('Tamil Translation', 'தமிழ் பெயர்')}</th>
                    <th style={{ textAlign: 'center', width: 100 }}>{t('Status')}</th>
                    <th style={{ textAlign: 'center', width: 220 }}>{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat, idx) => (
                    <tr key={cat.id || idx} style={{ opacity: cat.active === false ? 0.6 : 1 }}>
                      <td>{idx + 1}</td>
                      <td>
                        <b style={{ color: 'var(--primary-dark-green, #1b4332)' }}>
                          {cat.name}
                        </b>
                      </td>
                      <td>
                        <span style={{ color: '#555' }}>
                          {translateCategory(cat.name)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`badge ${cat.active !== false ? 'badge-approved' : 'badge-rejected'}`}
                          style={{ fontSize: 11 }}
                        >
                          {cat.active !== false ? t('Active') : t('Inactive')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="secondary small"
                            onClick={() => handleOpenEditCategory(cat)}
                            style={{ fontSize: 11, padding: '3px 8px' }}
                          >
                            ✏️ {t('Edit')}
                          </button>
                          <button
                            type="button"
                            className="secondary small"
                            onClick={() => handleToggleCategoryActive(cat)}
                            style={{
                              fontSize: 11,
                              padding: '3px 8px',
                              color: cat.active !== false ? '#b91c1c' : '#15803d'
                            }}
                          >
                            {cat.active !== false ? t('Deactivate') : t('Activate')}
                          </button>
                          <button
                            type="button"
                            className="secondary small"
                            onClick={() => handleOpenDeleteCategory(cat)}
                            style={{
                              fontSize: 11,
                              padding: '3px 8px',
                              color: '#b91c1c',
                              borderColor: '#fca5a5',
                              backgroundColor: '#fef2f2'
                            }}
                            title={t('Remove Category')}
                          >
                            🗑️ {t('Remove', 'Remove')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL: EDIT ITEM MODAL
          ========================================================================= */}
      {editingItem && (
        <div className="modal-backdrop" onClick={() => setEditingItem(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--primary-dark-green)' }}>
                ✏️ {t('Edit Item', 'Edit Item')}
              </h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setEditingItem(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItemEdit} style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 5 }}>
                    {t('Item Name')} *
                  </label>
                  <input
                    type="text"
                    value={editItemName}
                    onChange={e => setEditItemName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #ccc' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 5 }}>
                    {t('Unit')} *
                  </label>
                  <select
                    value={editItemUnit}
                    onChange={e => setEditItemUnit(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #ccc' }}
                  >
                    {STANDARD_UNITS.map(u => (
                      <option key={u} value={u}>
                        {u} ({translateUnit(u.toLowerCase())})
                      </option>
                    ))}
                    <option value="CUSTOM">-- {t('Custom Unit', 'Custom Unit')} --</option>
                  </select>
                  {editItemUnit === 'CUSTOM' && (
                    <input
                      type="text"
                      placeholder="Custom unit"
                      value={editCustomUnit}
                      onChange={e => setEditCustomUnit(e.target.value)}
                      required
                      style={{ marginTop: 6, width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #aaa' }}
                    />
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 5 }}>
                    {t('Category')} *
                  </label>
                  <select
                    value={editCategoryId}
                    onChange={e => setEditCategoryId(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #ccc' }}
                  >
                    <option value="">-- {t('Select Category')} --</option>
                    {activeCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {translateCategory(cat.name)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ background: '#f9f9f9', padding: '8px 12px', borderRadius: 6, fontSize: 12, color: '#666' }}>
                  ℹ️ {t('Current Stock')}: <b>{editingItem.stock} {translateUnit(editingItem.unit)}</b> (Stock quantity is read-only and preserved).
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => setEditingItem(null)}
                  disabled={savingItemEdit}
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  className="primary small"
                  disabled={savingItemEdit}
                >
                  {savingItemEdit ? t('Saving...') : t('Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CREATE / EDIT CATEGORY MODAL
          ========================================================================= */}
      {showCategoryModal && (
        <div className="modal-backdrop" onClick={() => setShowCategoryModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--primary-dark-green)' }}>
                {editingCategory ? `✏️ ${t('Edit Category', 'Edit Category')}` : `➕ ${t('Create Category', 'Create Category')}`}
              </h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowCategoryModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} style={{ marginTop: 14 }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 5 }}>
                  {t('Category Name')} *
                </label>
                <input
                  type="text"
                  placeholder={language === 'ta' ? 'எ.கா: Dairy, Pulses, Vegetables' : 'e.g. Dairy, Pulses, Vegetables'}
                  value={categoryNameInput}
                  onChange={e => setCategoryNameInput(e.target.value)}
                  required
                  autoFocus
                  style={{ width: '100%', padding: '8px 10px', fontSize: 14, borderRadius: 6, border: '1px solid #ccc' }}
                />
                <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                  {editingCategory
                    ? (language === 'ta'
                        ? 'வகையின் பெயரை மாற்றினால், இந்த வகையிலுள்ள அனைத்து பொருட்களும் தானாக புதுப்பிக்கப்படும்.'
                        : 'Renaming will automatically update all existing items associated with this category.')
                    : (language === 'ta'
                        ? 'புதிய வகை உடனடியாக பயன்பாட்டிற்கு வரும் மற்றும் சேமிக்கப்படும்.'
                        : 'New category will be persistently stored and available across all sessions.')}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => setShowCategoryModal(false)}
                  disabled={savingCategory}
                >
                  {t('Cancel')}
                </button>
                <button
                  type="submit"
                  className="primary small"
                  disabled={savingCategory}
                >
                  {savingCategory ? t('Saving...') : (editingCategory ? t('Save Changes') : t('Create'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: REMOVE / DELETE CATEGORY CONFIRMATION MODAL
          ========================================================================= */}
      {categoryToDelete && (
        <div className="modal-backdrop" onClick={() => setCategoryToDelete(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #fee2e2', paddingBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
                🗑️ {t('Remove Category', 'Remove Category Option')}
              </h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setCategoryToDelete(null)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: 14 }}>
              <p style={{ fontSize: 14, margin: '0 0 12px', color: '#1f2937' }}>
                {language === 'ta'
                  ? `"${categoryToDelete.name}" வகையை நிச்சயமாக நீக்க விரும்புகிறீர்களா?`
                  : `Are you sure you want to remove the category option "${categoryToDelete.name}"?`}
              </p>

              {(() => {
                const linkedCount = items.filter(i =>
                  (i.categoryId && String(i.categoryId) === String(categoryToDelete.id)) ||
                  (i.category && i.category.toLowerCase() === categoryToDelete.name.toLowerCase())
                ).length;

                if (linkedCount > 0) {
                  return (
                    <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: '#92400e', marginBottom: 14 }}>
                      ⚠️ <b>{linkedCount} {language === 'ta' ? 'பொருட்கள் இந்த வகையுடன் இணைக்கப்பட்டுள்ளன.' : 'item(s) currently belong to this category.'}</b>
                      <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.4 }}>
                        {language === 'ta'
                          ? 'இந்த வகையை நீக்குவது, எதிர்கால தேர்வுகளில் இருந்து பாதுகாப்பாக அகற்றும்; தற்போதுள்ள பொருட்கள் மற்றும் இருப்பு தரவு அப்படியே பாதுகாக்கப்படும்.'
                          : 'Removing this category will deactivate it from active dropdown options while preserving all existing catalog items and their records.'}
                      </p>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, cursor: 'pointer', color: '#b91c1c' }}>
                        <input
                          type="checkbox"
                          checked={permanentDeleteOption}
                          onChange={e => setPermanentDeleteOption(e.target.checked)}
                        />
                        {language === 'ta' ? 'முற்றிலும் நீக்கு (பொருட்களிலிருந்து இணைப்பைத் துண்டி)' : 'Permanently delete and unlink from existing items'}
                      </label>
                    </div>
                  );
                } else {
                  return (
                    <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: 6, padding: '10px 12px', fontSize: 13, color: '#166534', marginBottom: 14 }}>
                      ✓ {language === 'ta'
                        ? 'எந்தப் பொருளும் இந்த வகையுடன் இணைக்கப்படவில்லை. இது தரவுத்தளத்திலிருந்து முழுமையாக நீக்கப்படும்.'
                        : 'No items are linked to this category. It will be permanently removed from the database.'}
                    </div>
                  );
                }
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => setCategoryToDelete(null)}
                  disabled={deletingCategory}
                >
                  {t('Cancel')}
                </button>
                <button
                  type="button"
                  className="primary small"
                  onClick={handleConfirmDeleteCategory}
                  disabled={deletingCategory}
                  style={{ background: '#dc2626', borderColor: '#b91c1c' }}
                >
                  {deletingCategory ? t('Removing...') : t('Remove', 'Remove Category')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

