const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../frontend/src/utils/pdfGenerator.js');
let code = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');

function doReplace(searchStr, replaceStr, label) {
  if (!code.includes(searchStr)) {
    throw new Error(`Failed to find search string for [${label}]`);
  }
  code = code.replace(searchStr, replaceStr);
  console.log(`✓ Replaced [${label}] successfully.`);
}

// 1. Signature
doReplace(
  `export async function downloadBranchRequestsPdf({
  sortedBranches = [],
  requests = [],
  dateFilter = '',
  isAllDates = false,
  language = 'en',
  organisationName = 'Annamithra'
} = {}) {`,
  `export async function downloadBranchRequestsPdf({
  sortedBranches = [],
  requests = [],
  dateFilter = '',
  isAllDates = false,
  language = 'en',
  organisationName = 'Annamithra',
  singleBranch = null
} = {}) {`,
  'Signature singleBranch parameter'
);

// 2. targetBranchesList
doReplace(
  `  // Calculate grand totals across all branches
  let grandTotalBranches = sortedBranches.length;
  let grandTotalRequests = 0;
  let grandTotalRequestedQty = 0;
  let grandTotalDispatchedQty = 0;
  let grandTotalRemainingQty = 0;

  // Prepare branch datasets
  const branchDataList = sortedBranches.map(branch => {`,
  `  // If single branch specified, filter target list to only this branch
  const targetBranchesList = singleBranch ? [singleBranch] : sortedBranches;
  const grandTotalBranches = targetBranchesList.length;

  // Calculate grand totals across branches
  let grandTotalRequests = 0;
  let grandTotalRequestedQty = 0;
  let grandTotalDispatchedQty = 0;
  let grandTotalRemainingQty = 0;

  // Prepare branch datasets
  const branchDataList = targetBranchesList.map(branch => {`,
  'targetBranchesList filtering'
);

// 3. Header title on Page 1
doReplace(
  `<h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; color: #ffffff;">
                \${isTa ? 'அன்னமித்ரா — கிளை கோரிக்கைகள் அறிக்கை' : 'Annamithra — Branch Requests Report'}
              </h1>`,
  `<h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; color: #ffffff;">
                \${singleBranch
                  ? (isTa ? \`அன்னமித்ரா — \${singleBranch.name || 'கிளை'} கோரிக்கை அறிக்கை\` : \`Annamithra — \${singleBranch.name || 'Branch'} Request Report\`)
                  : (isTa ? 'அன்னமித்ரா — அனைத்து கிளைகள் கோரிக்கைகள் அறிக்கை' : 'Annamithra — All Branches Requests Report')}
              </h1>`,
  'Header title Page 1'
);

// 4. Scope bar on Page 1
const oldScopeBar = `<div style="display: flex; gap: 18px; font-size: 12px;">
            <div>
              <span style="color: #5A6962; font-weight: 600;">\${isTa ? 'தேர்வு வரம்பு:' : 'Selected Filter Scope:'}</span>
              <strong style="color: #003B2B; margin-left: 5px; background: #F5EFE0; padding: 2px 8px; border-radius: 4px; border: 1px solid #E5DDC9;">
                📅 \${filterScopeLabel}
              </strong>
            </div>
            <div>
              <span style="color: #5A6962; font-weight: 600;">\${isTa ? 'வரிசை முறை:' : 'Display Order:'}</span>
              <strong style="color: #003B2B; margin-left: 5px;">
                \${isTa ? 'முதல் கோரிக்கை முதலில் (Oldest Request First)' : 'First Request Submission Order'}
              </strong>
            </div>
          </div>

          <div style="font-size: 12px; color: #17352B; font-weight: 700;">
            🏢 \${grandTotalBranches} \${isTa ? 'கிளைகள்' : 'Branches'} &nbsp;|&nbsp; 📋 \${grandTotalRequests} \${isTa ? 'கோரிக்கைகள்' : 'Items'}
          </div>`;

const newScopeBar = `<div style="display: flex; gap: 16px; font-size: 12px; flex-wrap: wrap; align-items: center;">
            \${singleBranch ? \`
              <div>
                <span style="color: #5A6962; font-weight: 600;">\${isTa ? 'கிளை:' : 'Branch:'}</span>
                <strong style="color: #003B2B; margin-left: 5px;">
                  🏪 \${singleBranch.name || ''} \${singleBranch.location ? \`(📍 \${singleBranch.location})\` : ''}
                </strong>
              </div>
            \` : ''}
            <div>
              <span style="color: #5A6962; font-weight: 600;">\${isTa ? 'தேர்வு வரம்பு:' : 'Selected Filter Scope:'}</span>
              <strong style="color: #003B2B; margin-left: 5px; background: #F5EFE0; padding: 2px 8px; border-radius: 4px; border: 1px solid #E5DDC9;">
                📅 \${filterScopeLabel}
              </strong>
            </div>
            \${!singleBranch ? \`
              <div>
                <span style="color: #5A6962; font-weight: 600;">\${isTa ? 'வரிசை முறை:' : 'Display Order:'}</span>
                <strong style="color: #003B2B; margin-left: 5px;">
                  \${isTa ? 'முதல் கோரிக்கை முதலில் (Oldest Request First)' : 'First Request Submission Order'}
                </strong>
              </div>
            \` : ''}
          </div>

          <div style="font-size: 12px; color: #17352B; font-weight: 700;">
            \${singleBranch
              ? \`📋 \${grandTotalRequests} \${isTa ? 'கோரிக்கைகள்' : 'Items'} (\${grandTotalRequestedQty} \${isTa ? 'மொத்த அளவு' : 'Total Qty'})\`
              : \`🏢 \${grandTotalBranches} \${isTa ? 'கிளைகள்' : 'Branches'} &nbsp;|&nbsp; 📋 \${grandTotalRequests} \${isTa ? 'கோரிக்கைகள்' : 'Items'}\`
            }
          </div>`;

doReplace(oldScopeBar, newScopeBar, 'Scope bar Page 1');

// 5. Filename logic
const oldSave = `    const cleanDate = dateFilter ? String(dateFilter).replace(/[^0-9-]/g, '') : 'All_Dates';
    const fileName = \`Annamithra_Branch_Requests_\${cleanDate}.pdf\`;
    pdf.save(fileName);`;

const newSave = `    const cleanDate = dateFilter ? String(dateFilter).replace(/[^0-9-]/g, '') : 'All_Dates';
    let fileName = '';
    if (singleBranch) {
      const cleanBranch = String(singleBranch.name || 'Branch').replace(/[^a-zA-Z0-9_-]/g, '_');
      fileName = \`\${cleanBranch}_Requests_\${cleanDate}.pdf\`;
    } else {
      fileName = \`Annamithra_All_Branches_Requests_\${cleanDate}.pdf\`;
    }
    pdf.save(fileName);`;

doReplace(oldSave, newSave, 'Filename generation');

fs.writeFileSync(targetPath, code, 'utf8');
console.log('ALL UPDATES APPLIED TO pdfGenerator.js');
