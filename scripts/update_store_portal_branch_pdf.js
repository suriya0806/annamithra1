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

// 1. Add downloadingBranchPdf state
doReplace(
  `  const [allTimeRawRequests, setAllTimeRawRequests] = useState([]); // All-time requests for fallback sorting
  const [downloadingBranchRequestsPdf, setDownloadingBranchRequestsPdf] = useState(false);`,
  `  const [allTimeRawRequests, setAllTimeRawRequests] = useState([]); // All-time requests for fallback sorting
  const [downloadingBranchRequestsPdf, setDownloadingBranchRequestsPdf] = useState(false);
  const [downloadingBranchPdf, setDownloadingBranchPdf] = useState(null); // branchName currently generating PDF`,
  'State downloadingBranchPdf'
);

// 2. Add handleDownloadSingleBranchPdf
const oldPdfHandler = `  // Handler to download Branch Requests PDF report
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
        ? '✓ கிளை கோரிக்கைகள் அறிக்கை PDF வெற்றிகரமாக பதிவிறக்கப்பட்டது!'
        : '✓ Branch Requests Report PDF downloaded successfully!');
    } catch (err) {
      console.error('Failed to generate branch requests PDF', err);
      showAlert('error', err.message || (language === 'ta'
        ? 'கிளை கோரிக்கைகள் அறிக்கை PDF உருவாக்க முடியவில்லை'
        : 'Failed to generate Branch Requests PDF'));
    } finally {
      setDownloadingBranchRequestsPdf(false);
    }
  };`;

const newPdfHandler = `  // Handler to download All Branches Requests PDF report
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
        ? \`✓ \${branchName} கிளையின் கோரிக்கை அறிக்கை PDF வெற்றிகரமாக பதிவிறக்கப்பட்டது!\`
        : \`✓ \${branchName} Requests Report PDF downloaded successfully!\`);
    } catch (err) {
      console.error(\`Failed to generate PDF for branch \${branchName}\`, err);
      showAlert('error', err.message || (language === 'ta'
        ? \`\${branchName} கிளையின் கோரிக்கை அறிக்கை PDF உருவாக்க முடியவில்லை\`
        : \`Failed to generate PDF for \${branchName}\`));
    } finally {
      setDownloadingBranchPdf(null);
    }
  };`;

doReplace(oldPdfHandler, newPdfHandler, 'Individual branch PDF handler');

// 3. Update top "Download All Branches PDF" button
const oldTopButton = `                <button
                  type="button"
                  className="primary small btn-download-branch-requests-pdf"
                  id="btn-download-branch-requests-pdf"
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
                  title={language === 'ta' ? 'கிளை கோரிக்கைகள் அறிக்கையை PDF ஆக பதிவிறக்கவும்' : 'Download Branch Requests Report as PDF'}
                >
                  <span>📄</span>
                  {downloadingBranchRequestsPdf
                    ? (language === 'ta' ? 'தயாராகிறது...' : 'Generating PDF...')
                    : (language === 'ta' ? 'PDF பதிவிறக்கு' : 'Download PDF')}
                </button>`;

const newTopButton = `                <button
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
                </button>`;

doReplace(oldTopButton, newTopButton, 'Top Download All Branches PDF button');

// 4. In branch card header, add Download PDF button near branch name
const oldCardHeaderAction = `                      {/* ADD ADDITIONAL NON-REQUESTED ITEM BUTTON */}
                      <button
                        type="button"
                        className="primary small"
                        id={\`btn-add-item-\${(bName || '').toLowerCase().replace(/[^a-z0-9]/g, '-')}\`}
                        onClick={() => handleAddAdditionalItem(bName, true)}
                        style={{
                          height: 32,
                          padding: '0 12px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          borderRadius: 6,
                          whiteSpace: 'nowrap'
                        }}
                        title={language === 'ta' ? \`\${bName} கிளைக்கு கூடுதல் உருப்படியைச் சேர்\` : \`Add Additional Non-Requested Item to \${bName}\`}
                      >
                        <span>➕</span> {t('addItem', 'Add Item')}
                      </button>
                    </div>`;

const newCardHeaderAction = `                      {/* ACTIONS: DOWNLOAD INDIVIDUAL BRANCH PDF & ADD ADDITIONAL ITEM */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {/* DOWNLOAD INDIVIDUAL BRANCH PDF BUTTON */}
                        <button
                          type="button"
                          className="secondary small btn-download-branch-pdf"
                          id={\`btn-download-pdf-\${(bName || '').toLowerCase().replace(/[^a-z0-9]/g, '-')}\`}
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
                          title={language === 'ta' ? \`\${bName} கிளையின் கோரிக்கைகளை PDF ஆக பதிவிறக்கவும்\` : \`Download PDF for \${bName}\`}
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
                          id={\`btn-add-item-\${(bName || '').toLowerCase().replace(/[^a-z0-9]/g, '-')}\`}
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
                          title={language === 'ta' ? \`\${bName} கிளைக்கு கூடுதல் உருப்படியைச் சேர்\` : \`Add Additional Non-Requested Item to \${bName}\`}
                        >
                          <span>➕</span> {t('addItem', 'Add Item')}
                        </button>
                      </div>
                    </div>`;

doReplace(oldCardHeaderAction, newCardHeaderAction, 'Card header actions with Download PDF button');

fs.writeFileSync(targetPath, code, 'utf8');
console.log('✓ SUCCESS: StorePortal.jsx updated successfully with individual branch PDF download buttons!');
