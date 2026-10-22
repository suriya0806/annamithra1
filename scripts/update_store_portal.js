const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../frontend/src/portals/StorePortal.jsx');
let code = fs.readFileSync(targetPath, 'utf8');

// Normalize line endings to \n for consistent matching
code = code.replace(/\r\n/g, '\n');

// 1. Insert sortedBranches & handleDownloadBranchRequestsPdf
const memoTarget = '  }, [outstandingRequests, catalogueItems, branches]);';
const memoInsert = `  }, [outstandingRequests, catalogueItems, branches]);

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

  // Handler to download Branch Requests PDF report
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

if (!code.includes('const sortedBranches = useMemo')) {
  if (code.includes(memoTarget)) {
    code = code.replace(memoTarget, memoInsert);
    console.log('✓ sortedBranches and handleDownloadBranchRequestsPdf inserted');
  } else {
    console.error('✗ memoTarget not found');
  }
} else {
  console.log('sortedBranches already present');
}

// 2. Add Download PDF button beside Refresh button
const refreshBtnTarget = `<button
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
                </button>`;

const downloadBtnReplacement = `<button
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

if (!code.includes('btn-download-branch-requests-pdf')) {
  if (code.includes(refreshBtnTarget)) {
    code = code.replace(refreshBtnTarget, downloadBtnReplacement);
    console.log('✓ Download PDF button added beside Refresh button');
  } else {
    console.error('✗ refreshBtnTarget not found');
  }
} else {
  console.log('Download PDF button already present');
}

// 3. Update branches.map to sortedBranches.map with earliest time extraction
const mapTarget = `{branches.map(branch => {
                const bName = branch.name || '';`;

const mapReplacement = `{sortedBranches.map(branch => {
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
                  : null;`;

if (code.includes(mapTarget)) {
  code = code.replace(mapTarget, mapReplacement);
  console.log('✓ branches.map replaced with sortedBranches.map and earliest time calculation');
} else {
  console.log('mapTarget not found or already replaced');
}

// 4. In branch card header, add branchEarliestTime badge if available
const headerBadgeTarget = `{branchConsolidated.length > 0
                            ? \`\${branchConsolidated.length} \${language === 'ta' ? 'நிலுவை பொருட்கள்' : 'Pending Items'}\`
                            : (language === 'ta' ? 'நிலுவை கோரிக்கைகள் இல்லை' : 'No Pending Requests')}
                        </span>
                      </div>`;

const headerBadgeReplacement = `{branchConsolidated.length > 0
                            ? \`\${branchConsolidated.length} \${language === 'ta' ? 'நிலுவை பொருட்கள்' : 'Pending Items'}\`
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
                      </div>`;

if (!code.includes('First Request:')) {
  if (code.includes(headerBadgeTarget)) {
    code = code.replace(headerBadgeTarget, headerBadgeReplacement);
    console.log('✓ branchEarliestTime badge added to branch card header');
  } else {
    console.error('✗ headerBadgeTarget not found');
  }
} else {
  console.log('branchEarliestTime badge already present');
}

fs.writeFileSync(targetPath, code, 'utf8');
console.log('✓ StorePortal.jsx updated successfully');
