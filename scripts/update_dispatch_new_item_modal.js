const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../frontend/src/portals/StorePortal.jsx');
let code = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');

function doReplace(searchStr, replaceStr, label) {
  if (!code.includes(searchStr)) {
    throw new Error(`Failed to find search string for [${label}]`);
  }
  code = code.replace(searchStr, replaceStr);
  console.log(`✓ Replaced [${label}] successfully.`);
}

// 1. Add state for Dispatch New Item modal
const oldStateAnchor = `  const [downloadingBranchRequestsPdf, setDownloadingBranchRequestsPdf] = useState(false);
  const [downloadingBranchPdf, setDownloadingBranchPdf] = useState(null); // branchName currently generating PDF`;

const newState = `  const [downloadingBranchRequestsPdf, setDownloadingBranchRequestsPdf] = useState(false);
  const [downloadingBranchPdf, setDownloadingBranchPdf] = useState(null); // branchName currently generating PDF

  // Dispatch Additional Items "+ New Item" modal state
  const [showDispatchNewItemModal, setShowDispatchNewItemModal] = useState(false);
  const [dispatchNewItemTarget, setDispatchNewItemTarget] = useState(null); // { branchName, rowId }
  const [newItemFormName, setNewItemFormName] = useState('');
  const [newItemFormUnit, setNewItemFormUnit] = useState('KG');
  const [savingDispatchNewItem, setSavingDispatchNewItem] = useState(false);`;

doReplace(oldStateAnchor, newState, 'State declarations for new item modal');

// 2. Add handlers for Dispatch New Item modal
const oldHandlerAnchor = `  const handleRemoveAdditionalItem = (branchName, id) => {
    if (!branchName) return;
    setAdditionalItemsByBranch(prev => {
      const existing = prev[branchName] || [];
      return {
        ...prev,
        [branchName]: existing.filter(item => item.id !== id)
      };
    });
  };`;

const newHandlers = `  const handleRemoveAdditionalItem = (branchName, id) => {
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
        ? \`"\${cleanedName}" (\${cleanedUnit}) என்ற பொருள் ஏற்கனவே பட்டியலில் உள்ளது.\`
        : \`Item "\${cleanedName}" (\${cleanedUnit}) already exists in the catalogue.\`);
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
        ? \`✓ புதிய பொருள் "\${cleanedName}" (\${cleanedUnit}) வெற்றிகரமாக உருவாக்கப்பட்டு தேர்ந்தெடுக்கப்பட்டது!\`
        : \`✓ New item "\${cleanedName}" (\${cleanedUnit}) successfully created and selected!\`);

      handleCloseDispatchNewItemModal();
    } catch (err) {
      console.error('Failed to create new item for dispatch', err);
      showAlert('error', err.message || (language === 'ta'
        ? 'புதிய பொருளை உருவாக்க முடியவில்லை'
        : 'Failed to create new item'));
    } finally {
      setSavingDispatchNewItem(false);
    }
  };`;

doReplace(oldHandlerAnchor, newHandlers, 'Handlers for new item modal');

// 3. Update the dropdown in Additional Items table to include "+ New Item" option at top
const oldDropdown = `                                        <select
                                          data-additional-id={item.id}
                                          value={item.itemName}
                                          onChange={e => handleUpdateAdditionalItem(bName, item.id, 'itemName', e.target.value)}
                                          style={{ height: 32, padding: '4px 8px', fontSize: 13 }}
                                        >
                                          {catalogueItems.map(it => (
                                            <option key={it.id} value={it.name}>{translateItem(it.name)} ({translateUnit(it.unit)})</option>
                                          ))}
                                        </select>`;

const newDropdown = `                                        <select
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
                                          id={\`select-item-\${(bName || '').toLowerCase().replace(/[^a-z0-9]/g, '-')}-\${item.id}\`}
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
                                        </select>`;

doReplace(oldDropdown, newDropdown, 'Additional items select with + New Item option');

// 4. Render the modal inside the branch-requests / dispatch section
const oldSectionEnd = `              })}
            </div>
          )}
        </section>
      )}`;

const newSectionEnd = `              })}
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
                          {u} {translateUnit(u) !== u ? \`— \${translateUnit(u)}\` : ''}
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
      )}`;

doReplace(oldSectionEnd, newSectionEnd, 'Render New Item modal in Dispatch section');

fs.writeFileSync(targetPath, code, 'utf8');
console.log('✓ SUCCESS: StorePortal.jsx updated with New Item modal and dropdown support!');
