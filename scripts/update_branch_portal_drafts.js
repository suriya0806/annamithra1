const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../frontend/src/portals/BranchPortal.jsx');
let code = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');

function doReplace(searchStr, replaceStr, label) {
  if (!code.includes(searchStr)) {
    throw new Error(`Failed to find search string for [${label}]`);
  }
  code = code.replace(searchStr, replaceStr);
  console.log(`✓ Replaced [${label}] successfully.`);
}

// 1. Update imports to include downloadBranchOrderListPdf
const oldImports = `import { useLanguage } from '../i18n/LanguageContext';
import {
  getTodayDateString,`;

const newImports = `import { useLanguage } from '../i18n/LanguageContext';
import { downloadBranchOrderListPdf } from '../utils/pdfGenerator';
import {
  getTodayDateString,`;

doReplace(oldImports, newImports, 'Import downloadBranchOrderListPdf');

// 2. Update function signature to accept onSelectTab
const oldSignature = `export function BranchPortal({ user, activeTab }) {`;
const newSignature = `export function BranchPortal({ user, activeTab, onSelectTab }) {`;

doReplace(oldSignature, newSignature, 'Function signature with onSelectTab');

// 3. Add Draft states
const oldStateAnchor = `  // 3. History states (Confirmed received history)
  const [receivedHistory, setReceivedHistory] = useState([]);
  const [historyDate, setHistoryDate] = useState(getTodayDateString());
  const [historyIsAllDates, setHistoryIsAllDates] = useState(false);
  const [historyFromDate, setHistoryFromDate] = useState('');
  const [historyToDate, setHistoryToDate] = useState('');
  const [historySearch, setHistorySearch] = useState('');`;

const newState = `  // 3. History states (Confirmed received history)
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

  // Save as Draft Modal / Prompt state
  const [showSaveDraftModal, setShowSaveDraftModal] = useState(false);
  const [newDraftNameInput, setNewDraftNameInput] = useState('');`;

doReplace(oldStateAnchor, newState, 'Drafts state declarations');

// 4. Update tab effect to load drafts when drafts tab is opened
const oldTabEffect = `    if (activeTab === 'order-items') {
      loadCatalogue();
      loadMyRequests(requestFilterDate, requestIsAllDates);
    } else if (activeTab === 'entry') {
      loadDeliveries(deliveryDate, deliveryIsAllDates);
    } else if (activeTab === 'history') {
      loadReceivedHistory();
    }`;

const newTabEffect = `    if (activeTab === 'order-items') {
      loadCatalogue();
      loadMyRequests(requestFilterDate, requestIsAllDates);
      loadSavedDrafts();
    } else if (activeTab === 'drafts') {
      loadSavedDrafts();
    } else if (activeTab === 'entry') {
      loadDeliveries(deliveryDate, deliveryIsAllDates);
    } else if (activeTab === 'history') {
      loadReceivedHistory();
    }`;

doReplace(oldTabEffect, newTabEffect, 'Tab effect handling for drafts');

// 5. Add Draft handlers
const oldHandlerAnchor = `  // Load items catalogue
  const loadCatalogue = async () => {`;

const newHandlers = `  // Load branch's saved order drafts
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
    const defaultName = \`Draft #\${savedDrafts.length + 1} (\${getTodayDateString()})\`;
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
      const name = (newDraftNameInput || '').trim() || \`Draft #\${savedDrafts.length + 1} (\${getTodayDateString()})\`;
      const saved = await api.saveBranchDraft(name, orderItemsList.map(it => ({
        itemName: it.itemName,
        unit: it.unit,
        category: it.category,
        requestedQuantity: it.requestedQuantity,
        isNewItem: it.isNewItem
      })));

      showAlert('success', language === 'ta'
        ? \`✓ வரைவு "\${saved.draftName || name}" வெற்றிகரமாக சேமிக்கப்பட்டது! வரைவுகள் பக்கத்தில் எந்த நேரமும் அணுகலாம்.\`
        : \`✓ Draft "\${saved.draftName || name}" saved successfully! You can review or edit it from the Drafts tab.\`);

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
      showAlert('success', language === 'ta' ? \`✓ வரைவு "\${draft.draftName}" PDF பதிவிறக்கப்பட்டது!\` : \`✓ Draft "\${draft.draftName}" PDF downloaded successfully!\`);
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
        showAlert('error', \`Requested quantity for "\${it.itemName}" must be greater than 0.\`);
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

  // Move Draft to Order List
  const handleMoveDraftToOrderList = async (draftToMove) => {
    const draft = draftToMove || viewingDraft;
    if (!draft || !draft.items || draft.items.length === 0) {
      showAlert('error', language === 'ta' ? 'நகர்த்துவதற்கு இந்த வரைவில் பொருட்கள் இல்லை.' : 'No items in this draft to move.');
      return;
    }

    try {
      const itemsToTransfer = draft.items;
      setOrderItemsList(prev => {
        const nextList = [...prev];
        itemsToTransfer.forEach(draftItem => {
          const matchIdx = nextList.findIndex(
            x => x.itemName.trim().toLowerCase() === draftItem.itemName.trim().toLowerCase() &&
                 (x.category || '').trim().toLowerCase() === (draftItem.category || '').trim().toLowerCase()
          );
          if (matchIdx >= 0) {
            // Avoid duplicate lines; preserve draft requested quantity
            nextList[matchIdx] = {
              ...nextList[matchIdx],
              requestedQuantity: draftItem.requestedQuantity || nextList[matchIdx].requestedQuantity,
              unit: draftItem.unit || nextList[matchIdx].unit
            };
          } else {
            nextList.push({
              id: Date.now() + Math.random(),
              itemName: draftItem.itemName,
              unit: draftItem.unit || 'KG',
              requestedQuantity: draftItem.requestedQuantity,
              category: draftItem.category || 'General',
              isNewItem: draftItem.isNewItem || false
            });
          }
        });
        return nextList;
      });

      // Update draft status in database
      await api.markBranchDraftMoved(draft.id);
      await loadSavedDrafts();

      if (viewingDraft && viewingDraft.id === draft.id) {
        handleCloseDraftReview();
      }

      showAlert('success', language === 'ta'
        ? \`✓ வரைவு "\${draft.draftName}"-ல் இருந்து \${draft.items.length} பொருட்கள் ஆர்டர் பட்டியலுக்கு வெற்றிகரமாக மாற்றப்பட்டன!\`
        : \`✓ Transferred \${draft.items.length} item(s) from draft "\${draft.draftName}" into your Order List! Review them and send order when ready.\`);

      if (typeof onSelectTab === 'function') {
        onSelectTab('order-items');
      }
    } catch (err) {
      console.error('Failed to move draft to order list', err);
      showAlert('error', err.message || 'Failed to move draft to order list');
    }
  };

  // Delete draft
  const handleDeleteDraft = async () => {
    if (!deleteConfirmDraft) return;
    try {
      setDeletingDraft(true);
      await api.deleteBranchDraft(deleteConfirmDraft.id);
      showAlert('success', language === 'ta' ? '✓ வரைவு வெற்றிகரமாக நீக்கப்பட்டது!' : \`✓ Draft "\${deleteConfirmDraft.draftName}" deleted successfully!\`);
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
  const loadCatalogue = async () => {`;

doReplace(oldHandlerAnchor, newHandlers, 'Draft handlers definition');

// 6. Update card header of Items Being Requested with Print / Download PDF button
const oldOrderListHeader = `            {/* Right column — Items Being Requested */}
            <div className="card branch-order-list-card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">{t('Items Being Requested', 'கோரப்படும் பொருட்கள்')} ({orderItemsList.length})</h3>
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {t('Review and edit quantities before sending your request to the Store Manager.', 'கிடங்கு மேலாளருக்கு கோரிக்கையை அனுப்பும் முன் அளவுகளை சரிபார்க்கவும்.')}
                  </p>
                </div>
              </div>`;

const newOrderListHeader = `            {/* Right column — Items Being Requested */}
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
              </div>`;

doReplace(oldOrderListHeader, newOrderListHeader, 'Order list header with PDF button');

// 7. Update form-actions of Items Being Requested to include Save as Draft button
const oldFormActions = `              <div className="form-actions" style={{ marginTop: 16 }}>
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
              </div>`;

const newFormActions = `              <div className="form-actions" style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
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
              </div>`;

doReplace(oldFormActions, newFormActions, 'Save as Draft button next to Send Order');

// 8. Add Drafts Section for activeTab === 'drafts'
const oldTabTransition = `        </section>
      )}

      {/* =========================================================================
          2. ENTRY TAB (Deliveries & Physical Acknowledgement)
          ========================================================================= */}`;

const newDraftsSection = `        </section>
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
                  {language === 'ta' ? \`\${user?.branchName} கிளைக்கு சேமிக்கப்பட்ட வரைவுகள் எதுவும் இல்லை\` : \`No saved drafts for \${user?.branchName}\`}
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
                      id={\`draft-card-\${draft.id}\`}
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
                              {draft.draftName || \`Draft #\${draft.id}\`}
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
                              +\${(draft.items || []).length - 4} {language === 'ta' ? 'கூடுதல்' : 'more'}
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
                            id={\`btn-review-draft-\${draft.id}\`}
                            onClick={() => handleOpenDraftReview(draft)}
                            style={{ height: 30, padding: '0 10px', fontSize: 12, fontWeight: 600 }}
                            title={language === 'ta' ? 'வரைவை பார்க்க மற்றும் திருத்த' : 'Review and edit draft items'}
                          >
                            <span>👁️</span> {language === 'ta' ? 'திருத்து' : 'Review & Edit'}
                          </button>

                          <button
                            type="button"
                            className="secondary small"
                            id={\`btn-pdf-draft-\${draft.id}\`}
                            onClick={() => handleDownloadDraftPdf(draft)}
                            disabled={downloadingDraftPdfId === draft.id}
                            style={{ height: 30, padding: '0 8px', fontSize: 12 }}
                            title={language === 'ta' ? 'வரைவை PDF ஆக பதிவிறக்கவும்' : 'Download draft PDF'}
                          >
                            <span>📄</span> {downloadingDraftPdfId === draft.id ? '...' : 'PDF'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="primary small"
                            id={\`btn-move-draft-\${draft.id}\`}
                            onClick={() => handleMoveDraftToOrderList(draft)}
                            style={{
                              height: 30,
                              padding: '0 10px',
                              fontSize: 12,
                              fontWeight: 700,
                              background: isMoved ? '#4b5563' : 'var(--primary-dark-green)',
                              color: '#ffffff'
                            }}
                            title={language === 'ta' ? 'இந்த வரைவை பொருட்கள் ஆர்டர் பட்டியலுக்கு மாற்றவும்' : 'Transfer draft items into Order List'}
                          >
                            <span>📥</span> {language === 'ta' ? 'பட்டியலுக்கு நகர்த்து' : 'Move to Order List'}
                          </button>

                          <button
                            type="button"
                            className="danger small"
                            id={\`btn-delete-draft-\${draft.id}\`}
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
          ========================================================================= */}`;

doReplace(oldTabTransition, newDraftsSection, 'Drafts section JSX');

// 9. Add Modals: Save Draft Modal, Review/Edit Draft Modal, Delete Confirm Modal
const oldReturnModalAnchor = `      {/* Return Dispatched Item Modal Popup */}`;

const newModals = `      {/* Save Draft Prompt Modal */}
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
                ? \`தற்போதைய \${orderItemsList.length} பொருட்களையும் வரைவாக சேமிக்கவும். பின்னர் வரைவுகள் பக்கத்தில் திறந்து திருத்தலாம் அல்லது அனுப்பலாம்.\`
                : \`Save current \${orderItemsList.length} item(s) as a draft for \${user?.branchName}. This will NOT send an order to the Store Manager.\`}
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
                  className="primary"
                  onClick={() => handleMoveDraftToOrderList(viewingDraft)}
                  disabled={savingEditDraft || editDraftItems.length === 0}
                  id="btn-move-draft-from-modal"
                  style={{ height: 36, padding: '0 18px', fontWeight: 700, borderRadius: 6, background: 'var(--primary-dark-green)', color: '#ffffff' }}
                >
                  <span>📥</span> {language === 'ta' ? 'பட்டியலுக்கு நகர்த்து' : 'Move to Order List'}
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
                ? \`"\${deleteConfirmDraft.draftName}" என்ற வரைவை நிச்சயமாக நீக்க விரும்புகிறீர்களா? இந்த செயலை மாற்ற முடியாது.\`
                : \`Are you sure you want to permanently delete draft "\${deleteConfirmDraft.draftName}"? This action cannot be undone.\`}
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

      {/* Return Items Confirmation Modal */}`;

doReplace(oldReturnModalAnchor, newModals, 'Modals for save, review, and delete draft');

fs.writeFileSync(targetPath, code, 'utf8');
console.log('✓ Successfully written all changes to BranchPortal.jsx!');
