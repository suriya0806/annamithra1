import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { itemTranslations, unitTranslations, statusTranslations, categoryTranslations } from '../i18n/translations';

/**
 * Extracts and formats the saved order date and creation time without shifting timezones
 * or falling back to current system time.
 */
export function parseOrderDateTime(createdAt, orderDate, lang = 'en') {
  const locale = lang === 'ta' ? 'ta-IN' : 'en-IN';

  if (createdAt) {
    const str = String(createdAt);
    // Regex parses ISO strings like "2026-10-19T18:24:00" or "2026-10-19 18:24:00"
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const day = parseInt(m[3], 10);
      const hasTime = m[4] !== undefined;
      const hour = hasTime ? parseInt(m[4], 10) : 0;
      const min = hasTime ? parseInt(m[5], 10) : 0;
      const sec = hasTime && m[6] !== undefined ? parseInt(m[6], 10) : 0;

      const d = new Date(year, month, day, hour, min, sec);
      const dateStr = d.toLocaleDateString(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      let timeStr = '—';
      if (hasTime) {
        timeStr = d.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }

      const connector = lang === 'ta' ? ' நேரம் ' : ' at ';
      return {
        dateStr,
        timeStr,
        fullStr: hasTime ? `${dateStr}${connector}${timeStr}` : dateStr
      };
    }

    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      const dateStr = d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const connector = lang === 'ta' ? ' நேரம் ' : ' at ';
      return {
        dateStr,
        timeStr,
        fullStr: `${dateStr}${connector}${timeStr}`
      };
    }
  }

  // Fallback to orderDate
  if (orderDate) {
    const str = String(orderDate);
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const day = parseInt(m[3], 10);
      const d = new Date(year, month, day);
      const dateStr = d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
      return {
        dateStr,
        timeStr: '—',
        fullStr: dateStr
      };
    }
    const d = new Date(orderDate);
    if (!isNaN(d.getTime())) {
      const dateStr = d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
      return {
        dateStr,
        timeStr: '—',
        fullStr: dateStr
      };
    }
  }

  return { dateStr: '—', timeStr: '—', fullStr: '—' };
}

const translateItemName = (name) => {
  if (!name) return '';
  const lower = String(name).toLowerCase().trim();
  return itemTranslations[lower] || name;
};

const translateUnitName = (unit) => {
  if (!unit) return '';
  const lower = String(unit).toLowerCase().trim();
  return unitTranslations[lower] || unit;
};

/**
 * Renders and downloads a Tamil Unicode PDF with accurate Tamil typography,
 * ligatures, and styling matching the Annamithra theme.
 */
async function generateOrderHtmlPdf({ orderNumber, items, formatType, orderDate, createdAt, language = 'ta' }) {
  const isTa = language === 'ta';
  const isOrgAdmin = formatType === 'ORG_ADMIN';
  const { dateStr, timeStr } = parseOrderDateTime(createdAt, orderDate, language);
  const ITEMS_PER_PAGE = 14;

  const totalPages = Math.max(1, Math.ceil((items.length || 1) / ITEMS_PER_PAGE));
  const pdf = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait'
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  // Create temporary container offscreen
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-1000';
  document.body.appendChild(container);

  try {
    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const startIdx = pageIdx * ITEMS_PER_PAGE;
      const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, items.length);
      const pageItems = items.slice(startIdx, endIdx);
      const isLastPage = pageIdx === totalPages - 1;

      // Construct HTML for this page
      const pageEl = document.createElement('div');
      pageEl.style.width = '794px';
      pageEl.style.minHeight = '1122px';
      pageEl.style.padding = '44px 50px';
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.background = '#ffffff';
      pageEl.style.fontFamily = "'Noto Sans Tamil', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      pageEl.style.color = '#17352B';

      let itemsRowsHtml = '';
      if (pageItems.length === 0) {
        itemsRowsHtml = `
          <tr>
            <td colspan="${isOrgAdmin ? 2 : 3}" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; font-size: 14px;">
              ${isTa ? 'இந்த ஆர்டரில் எந்தப் பொருட்களும் இல்லை.' : 'No items found in this order.'}
            </td>
          </tr>
        `;
      } else {
        pageItems.forEach((line) => {
          const rawName = String(line.itemName || line.item || '').trim();
          const translatedName = isTa ? translateItemName(rawName) : rawName;
          const rawUnit = String(line.unit || '').trim();
          const translatedUnit = isTa ? translateUnitName(rawUnit) : rawUnit;
          const rawQty = line.quantity ?? line.orderQuantity ?? 0;

          if (isOrgAdmin) {
            const qtyText = rawUnit ? `${rawQty} ${translatedUnit}` : `${rawQty}`;
            itemsRowsHtml += `
              <tr style="border-bottom: 1px solid #E5DDC9;">
                <td style="padding: 11px 14px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 14.5px;">
                  ${translatedName}
                </td>
                <td style="padding: 11px 14px; border: 1px solid #E5DDC9; text-align: right; font-weight: 700; color: #003B2B; font-size: 15px;">
                  ${qtyText}
                </td>
              </tr>
            `;
          } else {
            itemsRowsHtml += `
              <tr style="border-bottom: 1px solid #E5DDC9;">
                <td style="padding: 11px 14px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 14.5px;">
                  ${translatedName}
                </td>
                <td style="padding: 11px 14px; border: 1px solid #E5DDC9; text-align: center; color: #5A6962; font-size: 14px; font-weight: 500;">
                  ${translatedUnit || '—'}
                </td>
                <td style="padding: 11px 14px; border: 1px solid #E5DDC9; text-align: right; font-weight: 700; color: #003B2B; font-size: 15px;">
                  ${rawQty}
                </td>
              </tr>
            `;
          }
        });
      }

      pageEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div>
            <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #003B2B; letter-spacing: 0.5px;">
              ${isTa ? 'அன்னமித்ரா' : 'ANNAMITHRA'}
            </h1>
            <p style="margin: 4px 0 0 0; font-size: 13.5px; font-weight: 700; color: #D4A63B; text-transform: uppercase; letter-spacing: 0.8px;">
              ${isTa ? 'உணவக மற்றும் கிளை மேலாண்மை' : 'FOOD & RESTAURANT MANAGEMENT'}
            </p>
          </div>
          ${totalPages > 1 ? `
            <div style="font-size: 13px; font-weight: 600; color: #5A6962; padding: 4px 10px; background: #F5EFE0; border-radius: 4px;">
              ${isTa ? `பக்கம் ${pageIdx + 1} / ${totalPages}` : `Page ${pageIdx + 1} of ${totalPages}`}
            </div>
          ` : ''}
        </div>

        <div style="height: 3px; background: linear-gradient(90deg, #D4A63B, #F0D58A, #D4A63B); margin: 10px 0 16px 0; border-radius: 2px;"></div>

        <!-- Order Metadata Card -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: #FCFAF3; border: 1.5px solid #E5DDC9; border-radius: 8px; padding: 14px 20px; margin-bottom: 20px;">
          <div>
            <div style="font-size: 12px; font-weight: 700; color: #5A6962; text-transform: uppercase; margin-bottom: 2px;">
              ${isTa ? 'ஆர்டர் எண்' : 'ORDER NUMBER'}
            </div>
            <div style="font-size: 20px; font-weight: 800; color: #003B2B;">
              ${orderNumber}
            </div>
          </div>
          <div style="text-align: right; font-size: 13.5px;">
            <div style="margin-bottom: 4px;">
              <span style="color: #5A6962; font-weight: 600;">${isTa ? 'ஆர்டர் தேதி:' : 'Order Date:'}</span>
              <strong style="color: #17352B; margin-left: 6px; font-size: 14px;">${dateStr}</strong>
            </div>
            <div>
              <span style="color: #5A6962; font-weight: 600;">${isTa ? 'உருவாக்கப்பட்ட நேரம்:' : 'Creation Time:'}</span>
              <strong style="color: #17352B; margin-left: 6px; font-size: 14px;">${timeStr}</strong>
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <thead>
            <tr style="background: #F5EFE0; border: 1px solid #E5DDC9;">
              <th style="padding: 11px 14px; text-align: left; font-size: 15.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: ${isOrgAdmin ? '70%' : '54%'};">
                ${isTa ? 'பொருளின் பெயர்' : 'Item Name'}
              </th>
              ${!isOrgAdmin ? `
                <th style="padding: 11px 14px; text-align: center; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 22%;">
                  ${isTa ? 'அலகு' : 'Unit'}
                </th>
              ` : ''}
              <th style="padding: 11px 14px; text-align: right; font-size: 15.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: ${isOrgAdmin ? '30%' : '24%'};">
                ${isOrgAdmin ? (isTa ? 'அளவு' : 'Quantity') : (isTa ? 'ஆர்டர் அளவு' : 'Ordered Quantity')}
              </th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
        </table>

        ${isLastPage ? `
          <!-- Summary Footer -->
          <div style="display: flex; justify-content: flex-end; align-items: center; background: #F5EFE0; border: 1.5px solid #D4A63B; border-radius: 6px; padding: 12px 20px; margin-top: 12px;">
            <span style="font-size: 16.5px; font-weight: 700; color: #003B2B;">
              ${isTa ? `மொத்த பொருட்கள்: ${items.length}` : `Total Items: ${items.length}`}
            </span>
          </div>
        ` : ''}
      `;

      container.innerHTML = '';
      container.appendChild(pageEl);

      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      if (pageIdx > 0) {
        pdf.addPage();
      }
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    }

    const cleanOrderNum = String(orderNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${cleanOrderNum}.pdf`;
    pdf.save(fileName);
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Generates and downloads a clean, printable purchase order PDF.
 * Automatically chooses English or Tamil layout based on current language choice.
 *
 * @param {Object|string} orderOrNumber - Order object or orderNumber string
 * @param {Array|Object} itemsOrOptions - Lines array or options object
 * @param {Object} options - Config options ({ formatType, orderDate, createdAt, language })
 */
export async function downloadOrderPdf(orderOrNumber, itemsOrOptions = [], options = {}) {
  let orderNumber = 'ORDER';
  let items = [];
  let formatType = 'STORE_MANAGER';
  let orderDate = null;
  let createdAt = null;
  let language = 'en';

  if (orderOrNumber && typeof orderOrNumber === 'object') {
    const order = orderOrNumber;
    orderNumber = order.orderNumber || order.poNumber || 'ORDER';
    items = order.lines || order.items || [];
    orderDate = order.orderDate;
    createdAt = order.createdAt;

    const opts = (itemsOrOptions && typeof itemsOrOptions === 'object' && !Array.isArray(itemsOrOptions))
      ? itemsOrOptions
      : (options || {});

    if (opts.formatType) formatType = opts.formatType;
    if (opts.orderDate) orderDate = opts.orderDate;
    if (opts.createdAt) createdAt = opts.createdAt;
    if (opts.language) language = opts.language;
  } else {
    orderNumber = String(orderOrNumber || 'ORDER');
    items = Array.isArray(itemsOrOptions) ? itemsOrOptions : [];
    const opts = options || {};
    if (opts.formatType) formatType = opts.formatType;
    if (opts.orderDate) orderDate = opts.orderDate;
    if (opts.createdAt) createdAt = opts.createdAt;
    if (opts.language) language = opts.language;
  }

  // Detect language from localStorage if not explicitly passed
  if (!language || language === 'en') {
    try {
      const savedLang = localStorage.getItem('annamithra_lang');
      if (savedLang === 'ta') {
        language = 'ta';
      }
    } catch {
      // ignore
    }
  }

  // If first item in lines has a createdAt and order doesn't, use it
  if (!createdAt && items.length > 0 && items[0].createdAt) {
    createdAt = items[0].createdAt;
  }
  if (!orderDate && items.length > 0 && items[0].orderDate) {
    orderDate = items[0].orderDate;
  }

  // Use high-fidelity HTML-canvas PDF generator for both English & Tamil
  // Ensures Inter & Noto Sans Tamil fonts, bold weights, and clean unicode shaping
  return generateOrderHtmlPdf({
    orderNumber,
    items,
    formatType,
    orderDate,
    createdAt,
    language
  });
}

/**
 * Generates and downloads a PDF report for Branch Requests with Category, Branch, and Date grouping.
 */
export async function downloadBranchRequestReportPdf({
  branch = '',
  dateStr = '',
  isAllDates = false,
  category = '',
  items = [],
  language = 'en'
} = {}) {
  const dateLabel = isAllDates ? 'All Dates' : (dateStr || 'All Dates');
  return downloadSimpleBranchRequestPdf({
    items,
    branch: branch || 'All Branches',
    department: 'All Departments',
    dateLabel
  });
}

/**
 * Generates and downloads a comprehensive, printable Branch Requests PDF report
 * organized by branch in request submission order. Supports both English and Tamil Unicode.
 */
export async function downloadBranchRequestsPdf({
  sortedBranches = [],
  requests = [],
  dateFilter = '',
  isAllDates = false,
  language = 'en',
  organisationName = 'Annamithra',
  singleBranch = null,
  catalogueItems = []
} = {}) {
  const isTa = language === 'ta';

  // Category translation mapping
  const categoryTranslations = {
    'vegetables': 'காய்கறிகள்',
    'fruits': 'பழங்கள்',
    'dairy': 'பால் பொருட்கள்',
    'groceries': 'மளிகைப் பொருட்கள்',
    'provisions': 'மளிகை',
    'spices': 'மசாலாப் பொருட்கள்',
    'meat': 'இறைச்சி',
    'poultry': 'கோழி இறைச்சி',
    'bakery': 'பேக்கரி',
    'beverages': 'பானங்கள்',
    'cleaning': 'சுத்தம் செய்யும் பொருட்கள்',
    'packaging': 'பேக்கேஜிங் பொருட்கள்',
    'oil': 'எண்ணெய்',
    'pickles': 'ஊறுகாய்'
  };

  const translateCategory = (cat) => {
    if (!cat || !String(cat).trim()) return isTa ? 'வகைப்படுத்தப்படாதது' : 'Uncategorised';
    const catStr = String(cat).trim();
    if (!isTa) return catStr;
    const lower = catStr.toLowerCase();
    return categoryTranslations[lower] || catStr;
  };

  // Format request date and time
  const formatDateTime = (createdAt, requestDate) => {
    const parsed = parseOrderDateTime(createdAt, requestDate, language);
    return parsed.fullStr || '—';
  };

  // Format filter label
  let filterScopeLabel = '';
  if (isAllDates || !dateFilter) {
    filterScopeLabel = isTa ? 'அனைத்து தேதிகள் (All Dates)' : 'All Dates';
  } else {
    const todayStr = new Date().toISOString().slice(0, 10);
    const isToday = dateFilter === todayStr;
    const parts = String(dateFilter).split('-');
    const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateFilter;
    if (isToday) {
      filterScopeLabel = isTa ? `இன்று (${formattedDate})` : `Today (${formattedDate})`;
    } else {
      filterScopeLabel = formattedDate;
    }
  }

  // Current generation timestamp
  const now = new Date();
  const generationTimestamp = now.toLocaleDateString(isTa ? 'ta-IN' : 'en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) + ' ' + now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // If single branch specified, filter target list to only this branch
  const targetBranchesList = singleBranch ? [singleBranch] : sortedBranches;
  const grandTotalBranches = targetBranchesList.length;

  // Calculate grand totals across branches
  let grandTotalRequests = 0;
  let grandTotalRequestedQty = 0;

  // Prepare branch datasets
  const branchDataList = targetBranchesList.map(branch => {
    const bName = (branch.name || '').trim().toLowerCase();
    const bId = branch.id;

    // Filter requests belonging to this branch
    const branchReqs = requests.filter(r => {
      const rName = (r.branch || '').trim().toLowerCase();
      const rId = r.branchId;
      return (bId && rId && bId === rId) || (bName && rName && bName === rName);
    });

    // Sort requests within the branch chronologically by createdAt / ID (FIFO)
    branchReqs.sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (tA !== tB) return tA - tB;
      return (a.id || 0) - (b.id || 0);
    });

    const bReqQty = branchReqs.reduce((sum, r) => sum + (Number(r.requested || r.requestedQuantity || 0)), 0);

    grandTotalRequests += branchReqs.length;
    grandTotalRequestedQty += bReqQty;

    // Determine earliest request timestamp for this branch
    let earliestTimeStr = '—';
    if (branchReqs.length > 0 && branchReqs[0].createdAt) {
      earliestTimeStr = formatDateTime(branchReqs[0].createdAt, branchReqs[0].requestDate);
    }

    return {
      branch,
      requests: branchReqs,
      totalItems: branchReqs.length,
      totalRequested: bReqQty,
      earliestTimeStr
    };
  });

  // Page construction engine (discrete A4 pages)
  const PAGE_WIDTH_PX = 794;
  const PAGE_HEIGHT_PX = 1122;

  const PAGE_1_MAX_HEIGHT = 830;
  const SUBSEQUENT_PAGE_MAX_HEIGHT = 930;

  const pages = [];
  let currentPageIndex = 0;
  let currentContentHeight = 0;

  const createPageStructure = (pageIdx) => {
    const pageEl = document.createElement('div');
    pageEl.className = 'annamithra-pdf-page';
    pageEl.style.width = `${PAGE_WIDTH_PX}px`;
    pageEl.style.height = `${PAGE_HEIGHT_PX}px`;
    pageEl.style.minHeight = `${PAGE_HEIGHT_PX}px`;
    pageEl.style.maxHeight = `${PAGE_HEIGHT_PX}px`;
    pageEl.style.padding = '36px 40px';
    pageEl.style.boxSizing = 'border-box';
    pageEl.style.background = '#ffffff';
    pageEl.style.fontFamily = "'Noto Sans Tamil', 'Inter', system-ui, -apple-system, sans-serif";
    pageEl.style.color = '#17352B';
    pageEl.style.position = 'relative';
    pageEl.style.display = 'flex';
    pageEl.style.flexDirection = 'column';
    pageEl.style.justifyContent = 'space-between';

    const topSection = document.createElement('div');
    topSection.style.width = '100%';

    // Page Header
    if (pageIdx === 0) {
      // Full Header Banner for Page 1
      topSection.innerHTML = `
        <div style="background: #003B2B; border-radius: 8px 8px 0 0; padding: 16px 20px; color: #ffffff; display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #D4A63B;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">🍲</span>
              <h1 style="margin: 0; font-size: 25px; font-weight: 800; letter-spacing: 0.3px; color: #ffffff;">
                ${singleBranch
                  ? (isTa ? `அன்னமித்ரா — ${singleBranch.name || 'கிளை'} விநியோக அறிக்கை` : `Annamithra — ${singleBranch.name || 'Branch'} Dispatch Report`)
                  : (isTa ? 'அன்னமித்ரா — ஸ்டோர் மேலாளர் விநியோக அறிக்கை' : 'Annamithra — Store Manager Dispatch Report')}
              </h1>
            </div>
            <div style="font-size: 11px; color: #D4A63B; margin-top: 3px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">
              ${isTa ? 'உணவக மற்றும் கிளை ஆர்டர் மேலாண்மை' : 'Restaurant & Branch Order Management'}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: #E5DDC9; font-weight: 500;">
              ${isTa ? 'அறிக்கை உருவாக்கப்பட்ட நேரம்:' : 'Generated on:'}
            </div>
            <div style="font-size: 13.5px; font-weight: 600; color: #ffffff; margin-top: 2px;">
              ${generationTimestamp}
            </div>
          </div>
        </div>

        <!-- Scope & Summary Details Bar -->
        <div style="background: #FCFAF3; border: 1px solid #E5DDC9; border-top: none; border-radius: 0 0 8px 8px; padding: 12px 18px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; gap: 18px; font-size: 14px; flex-wrap: wrap; align-items: center;">
            ${singleBranch ? `
              <div>
                <span style="color: #5A6962; font-weight: 600;">${isTa ? 'கிளை:' : 'Branch:'}</span>
                <strong style="color: #003B2B; margin-left: 5px; font-size: 15px;">
                  🏪 ${singleBranch.name || ''} ${singleBranch.location ? `(📍 ${singleBranch.location})` : ''}
                </strong>
              </div>
            ` : ''}
            <div>
              <span style="color: #5A6962; font-weight: 600;">${isTa ? 'தேர்வு வரம்பு:' : 'Selected Filter Scope:'}</span>
              <strong style="color: #003B2B; margin-left: 5px; background: #F5EFE0; padding: 3px 8px; border-radius: 4px; border: 1px solid #E5DDC9; font-size: 14px;">
                📅 ${filterScopeLabel}
              </strong>
            </div>
            ${!singleBranch ? `
              <div>
                <span style="color: #5A6962; font-weight: 600;">${isTa ? 'வரிசை முறை:' : 'Display Order:'}</span>
                <strong style="color: #003B2B; margin-left: 5px; font-size: 14px;">
                  ${isTa ? 'முதல் கோரிக்கை முதலில்' : 'First Request Submission Order'}
                </strong>
              </div>
            ` : ''}
          </div>

          <div style="font-size: 14.5px; color: #17352B; font-weight: 700;">
            ${singleBranch
              ? `📋 ${grandTotalRequests} ${isTa ? 'கோரிக்கைகள்' : 'Items'} (${grandTotalRequestedQty} ${isTa ? 'மொத்த அளவு' : 'Total Qty'})`
              : `🏢 ${grandTotalBranches} ${isTa ? 'கிளைகள்' : 'Branches'} &nbsp;|&nbsp; 📋 ${grandTotalRequests} ${isTa ? 'கோரிக்கைகள்' : 'Items'}`
            }
          </div>
        </div>
      `;
    } else {
      // Compact Running Header for Continuation Pages
      topSection.innerHTML = `
        <div style="background: #003B2B; border-radius: 6px; padding: 8px 16px; color: #ffffff; display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #D4A63B; margin-bottom: 14px;">
          <div style="font-size: 14px; font-weight: 700; color: #ffffff;">
            🍲 ${singleBranch
            ? (isTa ? `அன்னமித்ரா — ${singleBranch.name || 'கிளை'} விநியோக அறிக்கை (தொடர்ச்சி)` : `Annamithra — ${singleBranch.name || 'Branch'} Dispatch Report (Continued)`)
            : (isTa ? 'அன்னமித்ரா — ஸ்டோர் மேலாளர் விநியோக அறிக்கை (தொடர்ச்சி)' : 'Annamithra — Store Manager Dispatch Report (Continued)')}
          </div>
          <div style="font-size: 11px; color: #D4A63B; font-weight: 600;">
            📅 ${filterScopeLabel} &nbsp;|&nbsp; 🕒 ${generationTimestamp}
          </div>
        </div>
      `;
    }

    const contentSection = document.createElement('div');
    contentSection.className = 'page-content-area';
    topSection.appendChild(contentSection);
    pageEl.appendChild(topSection);

    // Footer with Page Number Placeholder
    const footerEl = document.createElement('div');
    footerEl.className = 'page-footer-area';
    footerEl.style.borderTop = '1px solid #E5DDC9';
    footerEl.style.paddingTop = '8px';
    footerEl.style.display = 'flex';
    footerEl.style.justifyContent = 'space-between';
    footerEl.style.alignItems = 'center';
    footerEl.style.fontSize = '11px';
    footerEl.style.color = '#5A6962';
    footerEl.innerHTML = `
      <div>
        <strong style="color: #003B2B;">Annamithra</strong> — ${isTa ? 'மைய கிடங்கு & கிளை மேலாண்மை அமைப்பு' : 'Central Warehouse & Branch Order Management'}
      </div>
      <div class="page-number-text" style="font-weight: 600; color: #17352B;">
        Page ${pageIdx + 1}
      </div>
    `;
    pageEl.appendChild(footerEl);

    return { pageEl, contentSection, footerEl };
  };

  // Helper to start a new page
  let currentPage = createPageStructure(0);
  pages.push(currentPage);
  currentContentHeight = 0;

  const startNewPage = () => {
    currentPageIndex++;
    currentPage = createPageStructure(currentPageIndex);
    pages.push(currentPage);
    currentContentHeight = 0;
  };

  // Build Branch Sections into Pages
  branchDataList.forEach((bData, bIdx) => {
    const branch = bData.branch;
    const bName = branch.name || `Branch #${bIdx + 1}`;
    const bLoc = branch.location || '';
    const bReqs = bData.requests;
    const maxAllowedHeight = currentPageIndex === 0 ? PAGE_1_MAX_HEIGHT : SUBSEQUENT_PAGE_MAX_HEIGHT;

    // If branch has no requests
    if (bReqs.length === 0) {
      const emptyCardHeight = 90;
      if (currentContentHeight + emptyCardHeight > maxAllowedHeight && currentContentHeight > 0) {
        startNewPage();
      }

      const emptyDiv = document.createElement('div');
      emptyDiv.style.marginBottom = '16px';
      emptyDiv.style.border = '1px solid #E5DDC9';
      emptyDiv.style.borderRadius = '6px';
      emptyDiv.style.overflow = 'hidden';
      emptyDiv.innerHTML = `
        <div style="background: #FDFBF7; padding: 8px 14px; border-bottom: 1px solid #E5DDC9; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong style="font-size: 14px; color: #003B2B;">🏪 ${bName}</strong>
            ${bLoc ? `<span style="font-size: 11px; color: #5A6962;">📍 ${bLoc}</span>` : ''}
          </div>
          <span style="font-size: 11px; font-weight: 600; color: #5A6962; background: #F5EFE0; padding: 2px 8px; border-radius: 4px;">
            ${isTa ? 'கோரிக்கைகள் இல்லை' : '0 Requests'}
          </span>
        </div>
        <div style="padding: 12px 16px; font-size: 12px; font-style: italic; color: #73827B; background: #ffffff;">
          ${isTa ? 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டி தேதிக்கு எந்த கோரிக்கைகளும் சமர்ப்பிக்கப்படவில்லை.' : 'No branch requests submitted for the selected filter.'}
        </div>
      `;
      currentPage.contentSection.appendChild(emptyDiv);
      currentContentHeight += emptyCardHeight;
      return;
    }

    // Branch has requests -> chunk table rows across pages seamlessly
    let rowIndex = 0;
    let isBranchContinuation = false;

    while (rowIndex < bReqs.length) {
      const currentMax = currentPageIndex === 0 ? PAGE_1_MAX_HEIGHT : SUBSEQUENT_PAGE_MAX_HEIGHT;
      const branchHeaderHeight = 44;
      const tableHeaderHeight = 38;
      const rowHeight = 36;
      const summaryRowHeight = 38;

      // Estimate space needed for at least 1 row
      const minNeededSpace = branchHeaderHeight + tableHeaderHeight + rowHeight + 16;
      if (currentContentHeight + minNeededSpace > currentMax && currentContentHeight > 0) {
        startNewPage();
      }

      const remainingSpace = (currentPageIndex === 0 ? PAGE_1_MAX_HEIGHT : SUBSEQUENT_PAGE_MAX_HEIGHT) - currentContentHeight;
      const rowsAvailableSpace = remainingSpace - branchHeaderHeight - tableHeaderHeight - 16;
      let rowsToTake = Math.max(1, Math.floor(rowsAvailableSpace / rowHeight));

      const isLastChunk = (rowIndex + rowsToTake) >= bReqs.length;
      if (isLastChunk && (rowsToTake * rowHeight + summaryRowHeight) > rowsAvailableSpace) {
        rowsToTake = Math.max(1, rowsToTake - 1);
      }

      const currentChunkRows = bReqs.slice(rowIndex, rowIndex + rowsToTake);
      const isActualLastChunk = (rowIndex + currentChunkRows.length) >= bReqs.length;

      // Build Branch Section Container
      const branchSectionEl = document.createElement('div');
      branchSectionEl.style.marginBottom = '16px';
      branchSectionEl.style.border = '1px solid #E5DDC9';
      branchSectionEl.style.borderRadius = '6px';
      branchSectionEl.style.overflow = 'hidden';

      // Branch Section Header
      const branchTitleSuffix = isBranchContinuation ? (isTa ? ' (தொடர்ச்சி)' : ' (Continued)') : '';
      branchSectionEl.innerHTML = `
        <div style="background: #FDFBF7; padding: 10px 16px; border-bottom: 1px solid #E5DDC9; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #003B2B;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong style="font-size: 15.5px; color: #003B2B;">🏪 ${bName}${branchTitleSuffix}</strong>
            ${bLoc ? `<span style="font-size: 13px; color: #5A6962;">📍 ${bLoc}</span>` : ''}
            ${!isBranchContinuation && bData.earliestTimeStr !== '—' ? `
              <span style="font-size: 12px; color: #003B2B; background: #F5EFE0; padding: 2px 7px; border-radius: 4px; font-weight: 600; border: 1px solid #E5DDC9;">
                🕒 ${isTa ? 'முதல் கோரிக்கை:' : 'Earliest Req:'} ${bData.earliestTimeStr}
              </span>
            ` : ''}
          </div>
          <div style="font-size: 14.5px; font-weight: 700; color: #003B2B;">
            ${bData.totalItems} ${isTa ? 'பொருட்கள்' : 'Items'} &nbsp;|&nbsp;
            ${isTa ? 'மொத்த கோரிக்கை:' : 'Total Requested:'} ${bData.totalRequested}
          </div>
        </div>
      `;

      // Table Element - ONLY 3 columns: Item Name, Category, Requested Quantity (unit combined)
      const table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.fontSize = '12px';

      // Table Header - Exactly 3 columns
      table.innerHTML = `
        <thead>
          <tr style="background: #F5EFE0; border-bottom: 2px solid #D4A63B; color: #003B2B; font-weight: 700;">
            <th style="padding: 11px 16px; text-align: left; width: 48%; font-size: 15.5px; border-right: 1px solid #E5DDC9;">
              ${isTa ? 'பொருளின் பெயர் (Item Name)' : 'Item Name'}
            </th>
            <th style="padding: 11px 14px; text-align: left; width: 26%; font-size: 15px; border-right: 1px solid #E5DDC9;">
              ${isTa ? 'வகை (Category)' : 'Category'}
            </th>
            <th style="padding: 11px 16px; text-align: right; width: 26%; font-size: 15.5px;">
              ${isTa ? 'கோரப்பட்ட அளவு (Requested Quantity)' : 'Requested Quantity'}
            </th>
          </tr>
        </thead>
      `;

      const tbody = document.createElement('tbody');

      currentChunkRows.forEach((r, idx) => {
        const rawName = String(r.item || r.itemName || '').trim();
        const itemName = isTa ? translateItemName(rawName) : (rawName || '—');

        // Look up item master / catalogue if available
        const matchedCat = (catalogueItems || []).find(ci =>
          (r.itemId && (ci.id === r.itemId || String(ci.id) === String(r.itemId))) ||
          (ci.name && rawName && ci.name.trim().toLowerCase() === rawName.toLowerCase())
        );

        // Category resolution: use item master or record category; default 'Uncategorised'
        const rawCategory = (matchedCat && (matchedCat.category || matchedCat.categoryName)) || r.category || '';
        const categoryName = translateCategory(rawCategory);

        // Unit resolution: fetch from item master if available, fallback to record unit, default 'KG'
        let cleanUnit = String((matchedCat && matchedCat.unit) || r.unit || 'KG').trim();
        // Avoid duplicate units (e.g. 'KG KG' -> 'KG')
        const unitWords = cleanUnit.split(/\s+/).filter(Boolean);
        if (unitWords.length > 1 && unitWords[0].toLowerCase() === unitWords[1].toLowerCase()) {
          cleanUnit = unitWords[0];
        } else if (unitWords.length > 0) {
          cleanUnit = unitWords.join(' ');
        }

        // Requested quantity: use actual requested quantity, NOT dispatched or remaining
        let reqNum = 0;
        if (r.requestedQuantity !== undefined && r.requestedQuantity !== null && r.requestedQuantity !== '') {
          reqNum = parseFloat(r.requestedQuantity);
        } else if (r.requested !== undefined && r.requested !== null && r.requested !== '') {
          reqNum = parseFloat(r.requested);
        }
        if (isNaN(reqNum)) reqNum = 0;

        // Preserve decimal quantities
        const qtyNumStr = Number.isInteger(reqNum) ? String(reqNum) : String(Math.round(reqNum * 1000) / 1000);
        const translatedUnit = isTa ? translateUnitName(cleanUnit) : cleanUnit;
        let requestedQuantityStr = `${qtyNumStr} ${translatedUnit}`.trim();
        // Extra safeguard: avoid duplicate unit words like '3 KG KG'
        requestedQuantityStr = requestedQuantityStr.replace(/([A-Za-z\u0B80-\u0BFF]+)\s+\1\b/gi, '$1');

        const rowBg = idx % 2 === 0 ? '#ffffff' : '#FCFAF3';
        const tr = document.createElement('tr');
        tr.style.backgroundColor = rowBg;
        tr.style.borderBottom = '1px solid #E5DDC9';

        tr.innerHTML = `
          <td style="padding: 10px 16px; color: #17352B; font-weight: 700; font-size: 15px; border-right: 1px solid #E5DDC9; word-break: break-word;">
            ${itemName}
          </td>
          <td style="padding: 10px 14px; border-right: 1px solid #E5DDC9; font-size: 14px;">
            <span style="background: #F5EFE0; padding: 3px 8px; border-radius: 4px; font-size: 13.5px; color: #003B2B; font-weight: 600;">
              ${categoryName}
            </span>
          </td>
          <td style="padding: 10px 16px; text-align: right; font-weight: 700; font-size: 15.5px; color: #003B2B;">
            ${requestedQuantityStr}
          </td>
        `;
        tbody.appendChild(tr);
      });

      // If last chunk for this branch, append Branch Total Subtotal Row (3 columns)
      if (isActualLastChunk) {
        const subtotalTr = document.createElement('tr');
        subtotalTr.style.background = '#F5EFE0';
        subtotalTr.style.borderTop = '2px solid #D4A63B';
        subtotalTr.style.fontWeight = '700';
        subtotalTr.style.fontSize = '15px';
        subtotalTr.style.color = '#003B2B';
        subtotalTr.innerHTML = `
          <td colspan="2" style="padding: 10px 16px; text-align: right; font-size: 15.5px; font-weight: 700; border-right: 1px solid #E5DDC9;">
            ${isTa ? `கிளை சுருக்கம் (${bName}) — மொத்த உருப்படிகள்: ${bData.totalItems}` : `Branch Total (${bName}) — Total Items: ${bData.totalItems}`}
          </td>
          <td style="padding: 10px 16px; text-align: right; font-size: 16px; font-weight: 800; color: #003B2B;">
            ${bData.totalRequested}
          </td>
        `;
        tbody.appendChild(subtotalTr);
      }

      table.appendChild(tbody);
      branchSectionEl.appendChild(table);
      currentPage.contentSection.appendChild(branchSectionEl);

      currentContentHeight += branchHeaderHeight + tableHeaderHeight + (currentChunkRows.length * rowHeight) + (isActualLastChunk ? summaryRowHeight : 0) + 16;
      rowIndex += currentChunkRows.length;
      isBranchContinuation = true;
    }
  });

  // Grand Total Summary Box on Last Page
  const summaryBoxHeight = 85;
  const lastPageMax = currentPageIndex === 0 ? PAGE_1_MAX_HEIGHT : SUBSEQUENT_PAGE_MAX_HEIGHT;
  if (currentContentHeight + summaryBoxHeight > lastPageMax && currentContentHeight > 0) {
    startNewPage();
  }

  const grandTotalEl = document.createElement('div');
  grandTotalEl.style.marginTop = '14px';
  grandTotalEl.style.background = '#003B2B';
  grandTotalEl.style.color = '#ffffff';
  grandTotalEl.style.borderRadius = '6px';
  grandTotalEl.style.padding = '12px 18px';
  grandTotalEl.style.border = '2px solid #D4A63B';
  grandTotalEl.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
      <div>
        <div style="font-size: 16.5px; font-weight: 800; color: #ffffff;">
          🏆 ${singleBranch
            ? (isTa ? `${singleBranch.name || 'கிளை'} ஒட்டுமொத்த சுருக்கம்` : `${singleBranch.name || 'Branch'} — Summary Totals`)
            : (isTa ? 'அறிக்கை ஒட்டுமொத்த சுருக்கம் (Grand Report Totals)' : 'Grand Report Summary')}
        </div>
        <div style="font-size: 13.5px; color: #D4A63B; margin-top: 3px; font-weight: 600;">
          ${singleBranch
            ? (isTa ? `கிளை: ${singleBranch.name}  |  மொத்த கோரிக்கைப் பதிவுகள்: ${grandTotalRequests}` : `Branch: ${singleBranch.name}  |  Total Request Records: ${grandTotalRequests}`)
            : (isTa ? `மொத்த அங்கீகரிக்கப்பட்ட கிளைகள்: ${grandTotalBranches}  |  மொத்த கோரிக்கைப் பதிவுகள்: ${grandTotalRequests}` : `Total Authorized Branches: ${grandTotalBranches}  |  Total Request Records: ${grandTotalRequests}`)}
        </div>
      </div>
      <div style="display: flex; gap: 24px; font-size: 14.5px; font-weight: 700;">
        <div style="text-align: right;">
          <div style="font-size: 11px; color: #E5DDC9; font-weight: 500;">${isTa ? 'மொத்த கோரிக்கைப் பதிவுகள்' : 'Total Request Items'}</div>
          <div style="font-size: 16px; color: #ffffff;">${grandTotalRequests}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 11px; color: #E5DDC9; font-weight: 500;">${isTa ? 'ஒட்டுமொத்த கோரிக்கை அளவு' : 'Total Requested Quantity'}</div>
          <div style="font-size: 16px; color: #D4A63B; font-weight: 800;">${grandTotalRequestedQty}</div>
        </div>
      </div>
    </div>
  `;
  currentPage.contentSection.appendChild(grandTotalEl);

  // Update total pages in footers
  const totalPagesCount = pages.length;
  pages.forEach((p, idx) => {
    const numEl = p.footerEl.querySelector('.page-number-text');
    if (numEl) {
      numEl.textContent = isTa
        ? `பக்கம் ${idx + 1} / ${totalPagesCount}`
        : `Page ${idx + 1} of ${totalPagesCount}`;
    }
  });

  // Render to PDF via html2canvas and jsPDF
  const pdf = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait'
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  // Create temporary offscreen container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = `${PAGE_WIDTH_PX}px`;
  container.style.background = '#ffffff';
  container.style.zIndex = '-1000';
  document.body.appendChild(container);

  try {
    for (let pageIdx = 0; pageIdx < totalPagesCount; pageIdx++) {
      const pageObj = pages[pageIdx];
      container.innerHTML = '';
      container.appendChild(pageObj.pageEl);

      const canvas = await html2canvas(pageObj.pageEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      if (pageIdx > 0) {
        pdf.addPage();
      }
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    }

    const cleanDate = dateFilter ? String(dateFilter).replace(/[^0-9-]/g, '') : 'All_Dates';
    let fileName = '';
    if (singleBranch) {
      const cleanBranch = String(singleBranch.name || 'Branch').replace(/[^a-zA-Z0-9_-]/g, '_');
      fileName = `${cleanBranch}_Dispatch_Report_${cleanDate}.pdf`;
    } else {
      fileName = `Annamithra_Store_Manager_Dispatch_Report_${cleanDate}.pdf`;
    }
    pdf.save(fileName);
    return true;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

// Alias export for downloadStoreManagerDispatchPdf
export const downloadStoreManagerDispatchPdf = downloadBranchRequestsPdf;

export async function downloadBranchOrderListPdf({
  organisationName = 'Annamithra',
  branchName = 'Branch',
  branchManager = '',
  department = '',
  date = '',
  items = [],
  isDraft = false,
  draftName = '',
  language = 'en'
} = {}) {
  const isTa = language === 'ta';
  const displayDate = date || new Date().toISOString().split('T')[0];
  const safeItems = Array.isArray(items) ? items : [];

  const totalQuantity = Math.round(safeItems.reduce((acc, it) => acc + (Number(it.requestedQuantity ?? it.quantity) || 0), 0) * 1000) / 1000;
  const totalItemCount = safeItems.length;

  // Generate current timestamp for report
  const now = new Date();
  const generatedAtStr = now.toLocaleDateString(isTa ? 'ta-IN' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) + (isTa ? ' நேரம் ' : ' at ') + now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // Calculate pagination:
  // Page 1 budget: ~15 items with full header + metadata box.
  // Subsequent pages budget: ~22 items with compact running header.
  const pages = [];
  let currentIdx = 0;
  let pageIdx = 0;
  const PAGE_1_CAPACITY = 15;
  const SUBSEQUENT_CAPACITY = 22;

  while (currentIdx < safeItems.length || pages.length === 0) {
    const isFirstPage = pageIdx === 0;
    const capacity = isFirstPage ? PAGE_1_CAPACITY : SUBSEQUENT_CAPACITY;
    const chunk = safeItems.slice(currentIdx, currentIdx + capacity);
    const startIndex = currentIdx;
    currentIdx += chunk.length;

    pages.push({
      pageIndex: pageIdx,
      isFirstPage,
      items: chunk,
      startIndex,
      isLastPage: currentIdx >= safeItems.length
    });
    pageIdx++;
    if (pageIdx > 100) break;
  }

  const totalPages = pages.length;

  const pdf = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait'
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const PAGE_WIDTH_PX = 794;
  const PAGE_MIN_HEIGHT_PX = 1122;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = `${PAGE_WIDTH_PX}px`;
  container.style.background = '#ffffff';
  container.style.zIndex = '-1000';
  document.body.appendChild(container);

  try {
    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const pageInfo = pages[pIdx];

      const pageEl = document.createElement('div');
      pageEl.style.width = `${PAGE_WIDTH_PX}px`;
      pageEl.style.minHeight = `${PAGE_MIN_HEIGHT_PX}px`;
      pageEl.style.padding = '36px 42px';
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.background = '#FDFBF7';
      pageEl.style.fontFamily = "'Noto Sans Tamil', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      pageEl.style.color = '#17352B';
      pageEl.style.display = 'flex';
      pageEl.style.flexDirection = 'column';
      pageEl.style.justifyContent = 'space-between';

      // Header
      let headerHtml = '';
      if (pageInfo.isFirstPage) {
        const reportTitle = isDraft
          ? (isTa ? 'கிளை வரைவு ஆர்டர்' : 'Branch Order Draft')
          : (isTa ? 'கிளை ஆர்டர் பட்டியல்' : 'Branch Order Report');

        headerHtml = `
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #003B2B; letter-spacing: 0.5px;">
                    ${isTa ? 'அன்னமித்ரா' : 'ANNAMITHRA'}
                  </h1>
                  ${isDraft ? `
                    <span style="background: #F5EFE0; color: #b45309; border: 1.5px solid #D4A63B; padding: 2px 10px; border-radius: 6px; font-size: 12px; font-weight: 800; text-transform: uppercase;">
                      ${isTa ? 'வரைவு (DRAFT)' : 'DRAFT'}
                    </span>
                  ` : ''}
                </div>
                <p style="margin: 3px 0 0 0; font-size: 12px; font-weight: 700; color: #D4A63B; text-transform: uppercase; letter-spacing: 0.8px;">
                  ${isTa ? 'உணவக மற்றும் கிளை மேலாண்மை' : 'FOOD & RESTAURANT MANAGEMENT'}
                </p>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 16px; font-weight: 800; color: #003B2B;">
                  ${reportTitle}
                </div>
                <div style="font-size: 11.5px; color: #5A6962; margin-top: 2px; font-weight: 600;">
                  ${isTa ? ('பக்கம் ' + (pIdx + 1) + ' / ' + totalPages) : ('Page ' + (pIdx + 1) + ' of ' + totalPages)}
                </div>
              </div>
            </div>

            <!-- Gold Accent Bar -->
            <div style="height: 3px; background: linear-gradient(90deg, #D4A63B, #F3D98B, #D4A63B); margin: 8px 0 12px 0; border-radius: 2px;"></div>

            <!-- Metadata Box -->
            <div style="background: #ffffff; border: 1.5px solid #D4A63B; border-radius: 8px; padding: 10px 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px 16px; font-size: 13px;">
                <div>
                  <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                    ${isTa ? 'நிறுவனம் (Organisation)' : 'Organisation'}
                  </span>
                  <strong style="color: #003B2B; font-size: 14.5px;">${organisationName || 'Saravana Bhavan'}</strong>
                </div>
                <div>
                  <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                    ${isTa ? 'கிளை பெயர் (Branch)' : 'Branch Name'}
                  </span>
                  <strong style="color: #003B2B; font-size: 14.5px;">${branchName || 'Branch'}</strong>
                </div>
                <div>
                  <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                    ${isTa ? 'கிளை மேலாளர் (Branch Manager)' : 'Branch Manager'}
                  </span>
                  <strong style="color: #003B2B; font-size: 14.5px;">${branchManager || 'Branch Manager'}</strong>
                </div>
                <div>
                  <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                    ${isTa ? 'ஆர்டர் தேதி (Order Date)' : 'Order Date'}
                  </span>
                  <strong style="color: #17352B; font-size: 14px;">${displayDate}</strong>
                </div>
                ${isDraft ? `
                  <div>
                    <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                      ${isTa ? 'வரைவு பெயர் (Draft Name)' : 'Draft Name'}
                    </span>
                    <strong style="color: #003B2B; font-size: 14px;">${draftName || 'Saved Draft'}</strong>
                  </div>
                ` : `
                  <div>
                    <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                      ${isTa ? 'உருப்படிகள் எண்ணிக்கை' : 'Total Items Count'}
                    </span>
                    <strong style="color: #003B2B; font-size: 14px;">${totalItemCount} ${isTa ? 'உருப்படிகள்' : 'Items'}</strong>
                  </div>
                `}
                <div>
                  <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                    ${isTa ? 'உருவாக்கப்பட்ட நேரம் (Generated)' : 'Generated On'}
                  </span>
                  <strong style="color: #17352B; font-size: 13.5px;">${generatedAtStr}</strong>
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        // Compact Running Header for Pages 2+
        headerHtml = `
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-size: 15px; font-weight: 900; color: #003B2B; letter-spacing: 0.5px;">
                  ${isTa ? 'அன்னமித்ரா' : 'ANNAMITHRA'}
                </span>
                <span style="font-size: 13px; color: #5A6962; margin-left: 10px; font-weight: 600;">
                  • ${organisationName} • ${branchName} • ${isDraft ? (isTa ? 'வரைவு' : 'Draft') : (isTa ? 'ஆர்டர் பட்டியல்' : 'Order List')}
                </span>
              </div>
              <div style="font-size: 12px; font-weight: 700; color: #5A6962;">
                ${isTa ? ('பக்கம் ' + (pIdx + 1) + ' / ' + totalPages) : ('Page ' + (pIdx + 1) + ' of ' + totalPages)}
              </div>
            </div>
            <div style="height: 2px; background: linear-gradient(90deg, #D4A63B, #F3D98B, #D4A63B); margin-top: 6px; border-radius: 1px;"></div>
          </div>
        `;
      }

      // Rows for Section A
      let rowsHtml = '';
      if (pageInfo.items.length === 0) {
        rowsHtml = `
          <tr>
            <td colspan="5" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; background: #ffffff;">
              ${isTa ? 'கோரிக்கை பட்டியலில் பொருட்கள் எதுவும் இல்லை.' : 'No items in the order list.'}
            </td>
          </tr>
        `;
      } else {
        pageInfo.items.forEach((it, idx) => {
          const rowNum = pageInfo.startIndex + idx + 1;
          const rawName = String(it.itemName || it.item || '').trim();
          const translatedName = isTa ? translateItemName(rawName) : rawName;
          const rawDepartment = String(it.department || it.departmentName || it.category || department || 'General').trim();
          const rawUnit = String(it.unit || 'KG').trim();
          const translatedUnit = isTa ? translateUnitName(rawUnit) : rawUnit;
          const qty = Number(it.requestedQuantity ?? it.quantity) || 0;
          const bg = idx % 2 === 0 ? '#ffffff' : '#FAF6EC';

          rowsHtml += `
            <tr style="background: ${bg}; border-bottom: 1px solid #E5DDC9;">
              <td style="padding: 8px 10px; text-align: center; color: #5A6962; font-size: 13.5px; font-weight: 600; border: 1px solid #E5DDC9; width: 45px;">
                ${rowNum}
              </td>
              <td style="padding: 8px 12px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 14.5px; word-break: break-word;">
                ${translatedName}
                ${it.isNewItem ? `<span style="font-size: 11px; color: #b45309; margin-left: 6px; font-weight: 700;">[${isTa ? 'புதிய பொருள்' : 'New'}]</span>` : ''}
              </td>
              <td style="padding: 8px 12px; border: 1px solid #E5DDC9; width: 140px;">
                <span style="background: #e2ece9; color: #003B2B; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 13px;">
                  ${rawDepartment}
                </span>
              </td>
              <td style="padding: 8px 10px; text-align: center; border: 1px solid #E5DDC9; color: #5A6962; font-size: 14px; font-weight: 600; width: 85px;">
                ${translatedUnit}
              </td>
              <td style="padding: 8px 14px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 15px; width: 120px;">
                ${qty}
              </td>
            </tr>
          `;
        });
      }

      pageEl.innerHTML = `
        <div>
          ${headerHtml}

          <!-- Items Table -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 6px; margin-bottom: 12px;">
            <thead>
              <tr style="background: #003B2B; color: #ffffff;">
                <th style="padding: 10px 10px; text-align: center; font-size: 14.5px; font-weight: 700; border: 1px solid #003B2B; width: 45px;">#</th>
                <th style="padding: 10px 12px; text-align: left; font-size: 15px; font-weight: 700; border: 1px solid #003B2B;">
                  ${isTa ? 'பொருளின் பெயர் (Item Name)' : 'Item Name'}
                </th>
                <th style="padding: 10px 12px; text-align: left; font-size: 14.5px; font-weight: 700; border: 1px solid #003B2B; width: 140px;">
                  ${isTa ? 'துறை (Department)' : 'Department'}
                </th>
                <th style="padding: 10px 10px; text-align: center; font-size: 14.5px; font-weight: 700; border: 1px solid #003B2B; width: 85px;">
                  ${isTa ? 'அலகு (Unit)' : 'Unit'}
                </th>
                <th style="padding: 10px 14px; text-align: right; font-size: 15px; font-weight: 700; border: 1px solid #003B2B; width: 120px;">
                  ${isTa ? 'கோரப்பட்ட அளவு (Quantity)' : 'Requested Quantity'}
                </th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            ${pageInfo.isLastPage && safeItems.length > 0 ? `
              <tfoot>
                <tr style="background: #F5EFE0; border: 2px solid #D4A63B; font-weight: 800; color: #003B2B;">
                  <td colspan="4" style="padding: 10px 14px; text-align: right; font-size: 15.5px; border: 1px solid #E5DDC9;">
                    ${isTa ? ('மொத்தம் (' + totalItemCount + ' பொருட்கள்):') : ('Grand Total (' + totalItemCount + ' Items):')}
                  </td>
                  <td style="padding: 10px 14px; text-align: right; font-size: 16px; font-weight: 800; color: #003B2B; border: 1px solid #E5DDC9;">
                    ${totalQuantity}
                  </td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>

        <!-- Footer -->
        <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #E5DDC9; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #5A6962;">
          <div>
            ${isTa ? 'அன்னமித்ரா உணவக மேலாண்மை அமைப்பு • அதிகாரப்பூர்வ ஆவணம்' : 'Annamithra Restaurant Management System • Official Document'}
          </div>
          <div>
            ${isTa ? ('உருவாக்கப்பட்ட தேதி: ' + new Date().toLocaleDateString('ta-IN')) : ('Generated on ' + new Date().toLocaleDateString('en-GB'))}
          </div>
        </div>
      `;

      container.innerHTML = '';
      container.appendChild(pageEl);

      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FDFBF7'
      });

      const imgData = canvas.toDataURL('image/png');
      if (pIdx > 0) {
        pdf.addPage();
      }
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    }

    const cleanBranch = String(branchName || 'Branch').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanDate = String(displayDate).replace(/[^0-9-]/g, '');
    const prefix = isDraft ? 'Draft' : 'Order';
    const fileName = `${cleanBranch}_${prefix}_${cleanDate}.pdf`;
    pdf.save(fileName);
    return true;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Generates and downloads a clean, professional PDF of the Recent Requests Submitted for Branch (Section B ONLY).
 * Contains Annamithra heading, organisation, branch name, branch manager, selected date filter,
 * Request Date & Time, Item Name, Department, Unit, Requested Quantity, Dispatched Quantity, Confirmed Received Quantity, Status,
 * and Grand Total requested, dispatched, and received quantities.
 * Completely independent: Does NOT contain Branch Order Form items or Section A.
 */
export async function downloadBranchRecentRequestsPdf({
  organisationName = 'Annamithra',
  branchName = 'Branch',
  branchManager = '',
  date = '',
  recentRequests = [],
  dateFilterLabel = '',
  language = 'en'
} = {}) {
  const isTa = language === 'ta';
  const displayDate = date || new Date().toISOString().split('T')[0];
  const safeRecentRequests = Array.isArray(recentRequests) ? recentRequests : [];

  const totalBReq = Math.round(safeRecentRequests.reduce((acc, r) => acc + (Number(r.requested) || 0), 0) * 1000) / 1000;
  const totalBDisp = Math.round(safeRecentRequests.reduce((acc, r) => acc + (Number(r.dispatched) || 0), 0) * 1000) / 1000;
  const totalBRec = Math.round(safeRecentRequests.reduce((acc, r) => acc + (Number(r.received) || 0), 0) * 1000) / 1000;
  const totalCount = safeRecentRequests.length;

  // Formatting helpers
  const formatDateTimeStr = (dtStr) => {
    if (!dtStr) return '—';
    try {
      const d = new Date(dtStr);
      if (isNaN(d.getTime())) return String(dtStr).slice(0, 16);
      const datePart = d.toLocaleDateString(isTa ? 'ta-IN' : 'en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const timePart = d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return `${datePart} ${timePart}`;
    } catch (e) {
      return String(dtStr).slice(0, 16);
    }
  };

  const getStatusDisplay = (st) => {
    if (!st) return '—';
    const upper = String(st).toUpperCase().trim();
    if (isTa) {
      return statusTranslations?.[upper] || st;
    }
    if (upper === 'PARTIALLY_RECEIVED') return 'Partially Received';
    if (upper === 'COMPLETED') return 'Completed';
    if (upper === 'DISPATCHED') return 'Dispatched';
    if (upper === 'PENDING') return 'Pending';
    return st;
  };

  const getStatusBadgeStyle = (st) => {
    const upper = String(st).toUpperCase().trim();
    if (upper === 'COMPLETED') {
      return 'background: #dcfce7; color: #166534; border: 1px solid #86efac;';
    } else if (upper === 'DISPATCHED') {
      return 'background: #fef3c7; color: #b45309; border: 1px solid #fde68a;';
    } else if (upper === 'PARTIALLY_RECEIVED') {
      return 'background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd;';
    }
    return 'background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb;';
  };

  // Generate current timestamp for report
  const now = new Date();
  const generatedAtStr = now.toLocaleDateString(isTa ? 'ta-IN' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }) + (isTa ? ' நேரம் ' : ' at ') + now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // Calculate pagination:
  // Page 1 budget: ~14 items with full header + metadata box.
  // Subsequent pages budget: ~20 items with compact running header.
  const pages = [];
  let currentIdx = 0;
  let pageIdx = 0;
  const PAGE_1_CAPACITY = 14;
  const SUBSEQUENT_CAPACITY = 20;

  while (currentIdx < safeRecentRequests.length || pages.length === 0) {
    const isFirstPage = pageIdx === 0;
    const capacity = isFirstPage ? PAGE_1_CAPACITY : SUBSEQUENT_CAPACITY;
    const chunk = safeRecentRequests.slice(currentIdx, currentIdx + capacity);
    const startIndex = currentIdx;
    currentIdx += chunk.length;

    pages.push({
      pageIndex: pageIdx,
      isFirstPage,
      items: chunk,
      startIndex,
      isLastPage: currentIdx >= safeRecentRequests.length
    });
    pageIdx++;
    if (pageIdx > 100) break;
  }

  const totalPages = pages.length;

  const pdf = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait'
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const PAGE_WIDTH_PX = 794;
  const PAGE_MIN_HEIGHT_PX = 1122;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = `${PAGE_WIDTH_PX}px`;
  container.style.background = '#ffffff';
  container.style.zIndex = '-1000';
  document.body.appendChild(container);

  try {
    for (let pIdx = 0; pIdx < totalPages; pIdx++) {
      const pageInfo = pages[pIdx];

      const pageEl = document.createElement('div');
      pageEl.style.width = `${PAGE_WIDTH_PX}px`;
      pageEl.style.minHeight = `${PAGE_MIN_HEIGHT_PX}px`;
      pageEl.style.padding = '36px 42px';
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.background = '#FDFBF7';
      pageEl.style.fontFamily = "'Noto Sans Tamil', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      pageEl.style.color = '#17352B';
      pageEl.style.display = 'flex';
      pageEl.style.flexDirection = 'column';
      pageEl.style.justifyContent = 'space-between';

      // Header
      let headerHtml = '';
      if (pageInfo.isFirstPage) {
        headerHtml = `
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #003B2B; letter-spacing: 0.5px;">
                  ${isTa ? 'அன்னமித்ரா' : 'ANNAMITHRA'}
                </h1>
                <p style="margin: 3px 0 0 0; font-size: 12px; font-weight: 700; color: #D4A63B; text-transform: uppercase; letter-spacing: 0.8px;">
                  ${isTa ? 'உணவக மற்றும் கிளை மேலாண்மை' : 'FOOD & RESTAURANT MANAGEMENT'}
                </p>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 16px; font-weight: 800; color: #003B2B;">
                  ${isTa ? 'கிளை சமீபத்திய கோரிக்கைகள் அறிக்கை' : 'Recent Requests Submitted for Branch'}
                </div>
                <div style="font-size: 11.5px; color: #5A6962; margin-top: 2px; font-weight: 600;">
                  ${isTa ? ('பக்கம் ' + (pIdx + 1) + ' / ' + totalPages) : ('Page ' + (pIdx + 1) + ' of ' + totalPages)}
                </div>
              </div>
            </div>

            <!-- Gold Accent Bar -->
            <div style="height: 3px; background: linear-gradient(90deg, #D4A63B, #F3D98B, #D4A63B); margin: 8px 0 12px 0; border-radius: 2px;"></div>

            <!-- Metadata Box -->
            <div style="background: #ffffff; border: 1.5px solid #D4A63B; border-radius: 8px; padding: 10px 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px 16px; font-size: 13px;">
                <div>
                  <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                    ${isTa ? 'நிறுவனம் (Organisation)' : 'Organisation'}
                  </span>
                  <strong style="color: #003B2B; font-size: 14.5px;">${organisationName || 'Saravana Bhavan'}</strong>
                </div>
                <div>
                  <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                    ${isTa ? 'கிளை பெயர் (Branch)' : 'Branch Name'}
                  </span>
                  <strong style="color: #003B2B; font-size: 14.5px;">${branchName || 'Branch'}</strong>
                </div>
                <div>
                  <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                    ${isTa ? 'கிளை மேலாளர் (Branch Manager)' : 'Branch Manager'}
                  </span>
                  <strong style="color: #003B2B; font-size: 14.5px;">${branchManager || 'Branch Manager'}</strong>
                </div>
                <div>
                  <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                    ${isTa ? 'தேதி வடிகட்டி (Date Filter)' : 'Date Filter'}
                  </span>
                  <strong style="color: #003B2B; font-size: 14px;">${dateFilterLabel || (isTa ? 'இன்று' : 'Today')}</strong>
                </div>
                <div>
                  <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                    ${isTa ? 'மொத்த பதிவுகள் (Total Records)' : 'Total Records'}
                  </span>
                  <strong style="color: #003B2B; font-size: 14px;">${totalCount} ${isTa ? 'கோரிக்கைகள்' : 'Requests'}</strong>
                </div>
                <div>
                  <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                    ${isTa ? 'உருவாக்கப்பட்ட நேரம் (Generated)' : 'Generated On'}
                  </span>
                  <strong style="color: #17352B; font-size: 13.5px;">${generatedAtStr}</strong>
                </div>
              </div>
            </div>
          </div>
        `;
      } else {
        // Compact Running Header for Pages 2+
        headerHtml = `
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-size: 15px; font-weight: 900; color: #003B2B; letter-spacing: 0.5px;">
                  ${isTa ? 'அன்னமித்ரா' : 'ANNAMITHRA'}
                </span>
                <span style="font-size: 13px; color: #5A6962; margin-left: 10px; font-weight: 600;">
                  • ${organisationName} • ${branchName} • ${isTa ? 'சமீபத்திய கோரிக்கைகள்' : 'Recent Requests'}
                </span>
              </div>
              <div style="font-size: 12px; font-weight: 700; color: #5A6962;">
                ${isTa ? ('பக்கம் ' + (pIdx + 1) + ' / ' + totalPages) : ('Page ' + (pIdx + 1) + ' of ' + totalPages)}
              </div>
            </div>
            <div style="height: 2px; background: linear-gradient(90deg, #D4A63B, #F3D98B, #D4A63B); margin-top: 6px; border-radius: 1px;"></div>
          </div>
        `;
      }

      // Rows for Section B
      let rowsHtml = '';
      if (pageInfo.items.length === 0) {
        rowsHtml = `
          <tr>
            <td colspan="9" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; background: #ffffff;">
              ${isTa ? 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டிக்கு சமீபத்திய கோரிக்கைகள் எதுவும் இல்லை.' : 'No recent requests found for the selected filter.'}
            </td>
          </tr>
        `;
      } else {
        pageInfo.items.forEach((r, idx) => {
          const rowNum = pageInfo.startIndex + idx + 1;
          const rawName = String(r.item || r.itemName || '').trim();
          const translatedName = isTa ? translateItemName(rawName) : rawName;
          const rawDept = String(r.department || r.departmentName || r.category || 'General').trim();
          const rawUnit = String(r.unit || 'KG').trim();
          const translatedUnit = isTa ? translateUnitName(rawUnit) : rawUnit;
          const dtStr = formatDateTimeStr(r.createdAt || r.requestDate);
          const reqQty = Number(r.requested) || 0;
          const dispQty = Number(r.dispatched) || 0;
          const recQty = Number(r.received) || 0;
          const statusText = getStatusDisplay(r.status);
          const badgeStyle = getStatusBadgeStyle(r.status);
          const bg = idx % 2 === 0 ? '#ffffff' : '#FAF6EC';

          rowsHtml += `
            <tr style="background: ${bg}; border-bottom: 1px solid #E5DDC9;">
              <td style="padding: 7px 6px; text-align: center; color: #5A6962; font-size: 12px; font-weight: 600; border: 1px solid #E5DDC9; width: 32px;">
                ${rowNum}
              </td>
              <td style="padding: 7px 8px; border: 1px solid #E5DDC9; font-size: 12px; color: #17352B; width: 110px; white-space: nowrap;">
                ${dtStr}
              </td>
              <td style="padding: 7px 10px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 13.5px; word-break: break-word;">
                ${translatedName}
              </td>
              <td style="padding: 7px 8px; border: 1px solid #E5DDC9; width: 95px;">
                <span style="background: #e2ece9; color: #003B2B; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 11.5px; display: inline-block;">
                  ${rawDept}
                </span>
              </td>
              <td style="padding: 7px 6px; text-align: center; border: 1px solid #E5DDC9; color: #5A6962; font-size: 12.5px; font-weight: 600; width: 55px;">
                ${translatedUnit}
              </td>
              <td style="padding: 7px 8px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 13.5px; width: 68px;">
                ${reqQty}
              </td>
              <td style="padding: 7px 8px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #8c671b; font-size: 13.5px; width: 68px;">
                ${dispQty}
              </td>
              <td style="padding: 7px 8px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 13.5px; width: 68px;">
                ${recQty}
              </td>
              <td style="padding: 7px 8px; text-align: center; border: 1px solid #E5DDC9; width: 100px;">
                <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 700; ${badgeStyle}">
                  ${statusText}
                </span>
              </td>
            </tr>
          `;
        });
      }

      pageEl.innerHTML = `
        <div>
          ${headerHtml}

          <!-- Recent Requests Table -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 6px; margin-bottom: 12px;">
            <thead>
              <tr style="background: #003B2B; color: #ffffff;">
                <th style="padding: 9px 6px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #003B2B; width: 32px;">#</th>
                <th style="padding: 9px 8px; text-align: left; font-size: 13px; font-weight: 700; border: 1px solid #003B2B; width: 110px;">
                  ${isTa ? 'தேதி & நேரம்' : 'Request Date & Time'}
                </th>
                <th style="padding: 9px 10px; text-align: left; font-size: 13.5px; font-weight: 700; border: 1px solid #003B2B;">
                  ${isTa ? 'பொருளின் பெயர் (Item Name)' : 'Item Name'}
                </th>
                <th style="padding: 9px 8px; text-align: left; font-size: 13px; font-weight: 700; border: 1px solid #003B2B; width: 95px;">
                  ${isTa ? 'துறை' : 'Department'}
                </th>
                <th style="padding: 9px 6px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #003B2B; width: 55px;">
                  ${isTa ? 'அலகு' : 'Unit'}
                </th>
                <th style="padding: 9px 8px; text-align: right; font-size: 13px; font-weight: 700; border: 1px solid #003B2B; width: 68px;">
                  ${isTa ? 'கோரியது' : 'Requested'}
                </th>
                <th style="padding: 9px 8px; text-align: right; font-size: 13px; font-weight: 700; border: 1px solid #003B2B; width: 68px;">
                  ${isTa ? 'அனுப்பியது' : 'Dispatched'}
                </th>
                <th style="padding: 9px 8px; text-align: right; font-size: 13px; font-weight: 700; border: 1px solid #003B2B; width: 68px;">
                  ${isTa ? 'பெற்றது' : 'Received'}
                </th>
                <th style="padding: 9px 8px; text-align: center; font-size: 13px; font-weight: 700; border: 1px solid #003B2B; width: 100px;">
                  ${isTa ? 'நிலை (Status)' : 'Status'}
                </th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            ${pageInfo.isLastPage && safeRecentRequests.length > 0 ? `
              <tfoot>
                <tr style="background: #F5EFE0; border: 2px solid #D4A63B; font-weight: 800; color: #003B2B;">
                  <td colspan="5" style="padding: 9px 10px; text-align: right; font-size: 14px; border: 1px solid #E5DDC9;">
                    ${isTa ? ('மொத்தம் (' + totalCount + ' பதிவுகள்):') : ('Total (' + totalCount + ' Records):')}
                  </td>
                  <td style="padding: 9px 8px; text-align: right; font-size: 14px; font-weight: 800; color: #003B2B; border: 1px solid #E5DDC9;">
                    ${totalBReq}
                  </td>
                  <td style="padding: 9px 8px; text-align: right; font-size: 14px; font-weight: 800; color: #8c671b; border: 1px solid #E5DDC9;">
                    ${totalBDisp}
                  </td>
                  <td style="padding: 9px 8px; text-align: right; font-size: 14px; font-weight: 800; color: #003B2B; border: 1px solid #E5DDC9;">
                    ${totalBRec}
                  </td>
                  <td style="padding: 9px 8px; border: 1px solid #E5DDC9;"></td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>

        <!-- Footer -->
        <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #E5DDC9; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #5A6962;">
          <div>
            ${isTa ? 'அன்னமித்ரா உணவக மேலாண்மை அமைப்பு • அதிகாரப்பூர்வ ஆவணம்' : 'Annamithra Restaurant Management System • Official Document'}
          </div>
          <div>
            ${isTa ? ('உருவாக்கப்பட்ட தேதி: ' + new Date().toLocaleDateString('ta-IN')) : ('Generated on ' + new Date().toLocaleDateString('en-GB'))}
          </div>
        </div>
      `;

      container.innerHTML = '';
      container.appendChild(pageEl);

      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FDFBF7'
      });

      const imgData = canvas.toDataURL('image/png');
      if (pIdx > 0) {
        pdf.addPage();
      }
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    }

    const cleanBranch = String(branchName || 'Branch').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanDate = String(displayDate).replace(/[^0-9-]/g, '');
    const fileName = `${cleanBranch}_Recent_Requests_${cleanDate}.pdf`;
    pdf.save(fileName);
    return true;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

// =========================================================================
// SIMPLIFIED OPERATIONAL REPORT PDF & CSV EXPORTERS
// High-Fidelity Unicode & Tamil Script Rendering Engine via html2canvas & jsPDF
// =========================================================================

let fontLoadPromise = null;

/**
 * Ensures Tamil Unicode font (Noto Sans Tamil) is ready in document.fonts before rendering.
 */
export async function ensureTamilFontLoaded() {
  if (typeof document === 'undefined') return;
  if (fontLoadPromise) return fontLoadPromise;

  fontLoadPromise = (async () => {
    try {
      if (document.fonts) {
        let hasFont = false;
        document.fonts.forEach((f) => {
          if (f.family && f.family.includes('Noto Sans Tamil')) {
            hasFont = true;
          }
        });

        if (!hasFont && typeof FontFace !== 'undefined') {
          try {
            const regularFont = new FontFace('Noto Sans Tamil', 'url(/fonts/NotoSansTamil-Regular.ttf)', { weight: '400' });
            const boldFont = new FontFace('Noto Sans Tamil', 'url(/fonts/NotoSansTamil-Bold.ttf)', { weight: '700' });
            const [loadedReg, loadedBold] = await Promise.all([regularFont.load(), boldFont.load()]);
            document.fonts.add(loadedReg);
            document.fonts.add(loadedBold);
          } catch (e) {
            console.warn('Local FontFace load fallback:', e);
          }
        }
        await document.fonts.ready;
      }
    } catch (err) {
      console.warn('ensureTamilFontLoaded notice:', err);
    }
  })();

  return fontLoadPromise;
}

/**
 * Helper to construct an offscreen HTML page container with standard Annamithra branding.
 */
function createReportPageEl({ title, subtitle, dateLabel, pageIndex, totalPages, isLandscape = false }) {
  const pageEl = document.createElement('div');
  pageEl.style.width = isLandscape ? '1122px' : '794px';
  pageEl.style.minHeight = isLandscape ? '794px' : '1122px';
  pageEl.style.height = isLandscape ? '794px' : '1122px';
  pageEl.style.padding = isLandscape ? '28px 36px 24px 36px' : '32px 36px 28px 36px';
  pageEl.style.boxSizing = 'border-box';
  pageEl.style.background = '#ffffff';
  pageEl.style.fontFamily = "'Noto Sans Tamil', 'Outfit', 'Nirmala UI', system-ui, -apple-system, sans-serif";
  pageEl.style.color = '#17352B';
  pageEl.style.display = 'flex';
  pageEl.style.flexDirection = 'column';
  pageEl.style.justifyContent = 'space-between';

  const genDateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const headerHtml = `
    <div>
      <!-- Top Title Bar -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <h1 style="margin: 0; font-size: 21px; font-weight: 800; color: #003B2B; letter-spacing: 0.3px;">
            Annamithra — ${title}
          </h1>
        </div>
        <div style="text-align: right; font-size: 11.5px; color: #4A6B5F; font-weight: 600;">
          Generated: ${genDateStr}
        </div>
      </div>

      <!-- Gold Accent Line -->
      <div style="height: 3px; background: linear-gradient(90deg, #D4A63B, #F0D58A, #D4A63B); margin: 8px 0 14px 0; border-radius: 2px;"></div>

      <!-- Scope Card -->
      <div style="background: #FBF7EC; border: 1px solid #E5DDC9; border-radius: 6px; padding: 10px 16px; margin-bottom: 16px;">
        <div style="font-size: 13px; font-weight: 700; color: #003B2B; margin-bottom: 3px;">
          ${subtitle}
        </div>
        <div style="font-size: 11.5px; color: #5A6962; font-weight: 500;">
          Date Scope: ${dateLabel || 'All Dates'}
        </div>
      </div>
    </div>
  `;

  const footerHtml = `
    <!-- Footer -->
    <div style="border-top: 1px solid #E5DDC9; padding-top: 10px; margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #6D8B80;">
      <div>
        Annamithra Food & Restaurant Management • Confidential
      </div>
      <div style="font-weight: 600;">
        Page ${pageIndex + 1} of ${totalPages}
      </div>
    </div>
  `;

  return { pageEl, headerHtml, footerHtml };
}

/**
 * Generic renderer that converts an array of HTML page elements into a jsPDF document.
 */
async function renderHtmlPagesToPdf({ pages, filename, orientation = 'portrait' }) {
  await ensureTamilFontLoaded();

  const isLandscape = orientation === 'landscape';
  const pdf = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: isLandscape ? 'landscape' : 'portrait'
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = isLandscape ? '1122px' : '794px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-9999';
  document.body.appendChild(container);

  try {
    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pageEl = pages[pageIdx];
      container.innerHTML = '';
      container.appendChild(pageEl);

      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      if (pageIdx > 0) {
        pdf.addPage('a4', isLandscape ? 'landscape' : 'portrait');
      }
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    }

    pdf.save(filename);
    return true;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * 1. Simple Inventory Report PDF
 * Columns: Item Name, Unit, Current Stock, Last Updated Date
 */
export async function downloadSimpleInventoryPdf({ items = [], dateLabel = 'All Dates' } = {}) {
  const ITEMS_PER_PAGE = 14;
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const totalStock = items.reduce((sum, it) => sum + (Number(it.currentStock) || 0), 0);
  const subtitle = `Total Items: ${items.length}   |   Total Central Stock: ${totalStock.toLocaleString()}`;

  const pages = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const startIdx = pageIdx * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, items.length);
    const pageRows = items.slice(startIdx, endIdx);
    const isLastPage = pageIdx === totalPages - 1;

    const { pageEl, headerHtml, footerHtml } = createReportPageEl({
      title: 'Inventory Report',
      subtitle,
      dateLabel,
      pageIndex: pageIdx,
      totalPages,
      isLandscape: false
    });

    let tableRowsHtml = '';
    if (items.length === 0) {
      tableRowsHtml = `
        <tr>
          <td colspan="5" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; font-size: 14px;">
            No inventory records found matching the selected filter criteria.
          </td>
        </tr>
      `;
    } else {
      pageRows.forEach((it, i) => {
        const rowIdx = startIdx + i + 1;
        const bg = (rowIdx % 2 === 0) ? '#FCFAF3' : '#ffffff';
        const itemDisplay = String(it.itemName || it.name || '—');
        const unitDisplay = String(it.unit || '—');
        const stockVal = Number(it.currentStock) || 0;
        const dateDisplay = String(it.formattedLastUpdated || it.lastUpdated || '—');

        tableRowsHtml += `
          <tr style="background: ${bg}; border-bottom: 1px solid #E5DDC9;">
            <td style="padding: 9px 10px; text-align: center; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 600; color: #5A6962; width: 42px;">
              ${rowIdx}
            </td>
            <td style="padding: 9px 12px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 14.5px; word-break: break-word;">
              ${itemDisplay}
            </td>
            <td style="padding: 9px 10px; text-align: center; border: 1px solid #E5DDC9; font-size: 14px; font-weight: 500; color: #5A6962; width: 85px;">
              ${unitDisplay}
            </td>
            <td style="padding: 9px 14px; text-align: right; border: 1px solid #E5DDC9; font-weight: 600; color: #003B2B; font-size: 15px; width: 130px;">
              ${stockVal.toLocaleString()}
            </td>
            <td style="padding: 9px 12px; text-align: center; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 500; color: #5A6962; width: 145px;">
              ${dateDisplay}
            </td>
          </tr>
        `;
      });
    }

    const summaryFooterHtml = isLastPage && items.length > 0 ? `
      <tfoot>
        <tr style="background: #F5EFE0; border: 1.5px solid #D4A63B; font-weight: 700; color: #003B2B;">
          <td colspan="3" style="padding: 10px 14px; border: 1px solid #E5DDC9; font-size: 16px; font-weight: 700;">
            Total Items: ${items.length}
          </td>
          <td style="padding: 10px 14px; text-align: right; border: 1px solid #E5DDC9; font-size: 16.5px; font-weight: 800; color: #003B2B;">
            ${totalStock.toLocaleString()}
          </td>
          <td style="padding: 10px 12px; text-align: center; border: 1px solid #E5DDC9; font-size: 14px; font-weight: 600; color: #5A6962;">
            Central Stock Total
          </td>
        </tr>
      </tfoot>
    ` : '';

    const contentHtml = `
      <div style="flex: 1; display: flex; flex-direction: column;">
        ${headerHtml}
        <table style="width: 100%; border-collapse: collapse; margin-bottom: auto;">
          <thead>
            <tr style="background: #F5EFE0; border: 1px solid #E5DDC9;">
              <th style="padding: 11px 10px; text-align: center; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 42px;">#</th>
              <th style="padding: 11px 12px; text-align: left; font-size: 15.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9;">Item Name</th>
              <th style="padding: 11px 10px; text-align: center; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 85px;">Unit</th>
              <th style="padding: 11px 14px; text-align: right; font-size: 15.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 130px;">Current Stock</th>
              <th style="padding: 11px 12px; text-align: center; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 145px;">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          ${summaryFooterHtml}
        </table>
      </div>
      ${footerHtml}
    `;

    pageEl.innerHTML = contentHtml;
    pages.push(pageEl);
  }

  const filename = `Annamithra_Inventory_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  return await renderHtmlPagesToPdf({ pages, filename, orientation: 'portrait' });
}

/**
 * 2. Simple Branch Request Report PDF
 * Columns: Branch Name, Department, Item Name, Unit, Requested Quantity, Request Date, Status
 */
export async function downloadSimpleBranchRequestPdf({ items = [], branch = 'All Branches', department = 'All Departments', dateLabel = 'All Dates' } = {}) {
  const ITEMS_PER_PAGE = 14;
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const totalQty = items.reduce((sum, it) => sum + (Number(it.requestedQuantity) || 0), 0);

  const deptPart = department && department !== 'All Departments' ? `   |   Dept: ${department}` : '';
  const subtitle = `Branch: ${branch || 'All Branches'}${deptPart}   |   Total Requests: ${items.length}   |   Total Requested: ${totalQty.toLocaleString()}`;

  const pages = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const startIdx = pageIdx * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, items.length);
    const pageRows = items.slice(startIdx, endIdx);
    const isLastPage = pageIdx === totalPages - 1;

    const { pageEl, headerHtml, footerHtml } = createReportPageEl({
      title: 'Branch Request Report',
      subtitle,
      dateLabel,
      pageIndex: pageIdx,
      totalPages,
      isLandscape: false
    });

    let tableRowsHtml = '';
    if (items.length === 0) {
      tableRowsHtml = `
        <tr>
          <td colspan="8" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; font-size: 14px;">
            No branch request records found matching the selected filter criteria.
          </td>
        </tr>
      `;
    } else {
      pageRows.forEach((it, i) => {
        const rowIdx = startIdx + i + 1;
        const bg = (rowIdx % 2 === 0) ? '#FCFAF3' : '#ffffff';
        const brName = String(it.branchName || it.branch || '—');
        const deptName = String(it.department || it.category || 'Not specified');
        const itName = String(it.itemName || it.item || '—');
        const unitName = String(it.unit || '—');
        const reqVal = Number(it.requestedQuantity) || 0;
        const dateDisplay = String(it.formattedDate || it.date || '—');
        const st = String(it.meaningfulStatus || it.status || '—');

        tableRowsHtml += `
          <tr style="background: ${bg}; border-bottom: 1px solid #E5DDC9;">
            <td style="padding: 9px 6px; text-align: center; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 600; color: #5A6962; width: 34px;">
              ${rowIdx}
            </td>
            <td style="padding: 9px 8px; border: 1px solid #E5DDC9; font-weight: 700; color: #17352B; font-size: 15px; width: 115px; word-break: break-word;">
              ${brName}
            </td>
            <td style="padding: 9px 8px; border: 1px solid #E5DDC9; font-size: 14px; font-weight: 500; color: #5A6962; width: 100px; word-break: break-word;">
              ${deptName}
            </td>
            <td style="padding: 9px 10px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 14.5px; word-break: break-word;">
              ${itName}
            </td>
            <td style="padding: 9px 6px; text-align: center; border: 1px solid #E5DDC9; font-size: 14px; font-weight: 500; color: #5A6962; width: 55px;">
              ${unitName}
            </td>
            <td style="padding: 9px 10px; text-align: right; border: 1px solid #E5DDC9; font-weight: 600; color: #003B2B; font-size: 15px; width: 85px;">
              ${reqVal.toLocaleString()}
            </td>
            <td style="padding: 9px 8px; text-align: center; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 500; color: #5A6962; width: 80px;">
              ${dateDisplay}
            </td>
            <td style="padding: 9px 8px; text-align: center; border: 1px solid #E5DDC9; width: 85px;">
              <span style="background: #F5EFE0; border: 1px solid #E5DDC9; padding: 3px 6px; border-radius: 4px; font-weight: 700; font-size: 12.5px; color: #17352B; display: inline-block;">
                ${st}
              </span>
            </td>
          </tr>
        `;
      });
    }

    const summaryFooterHtml = isLastPage && items.length > 0 ? `
      <tfoot>
        <tr style="background: #F5EFE0; border: 1.5px solid #D4A63B; font-weight: 700; color: #003B2B;">
          <td colspan="5" style="padding: 10px 12px; border: 1px solid #E5DDC9; font-size: 16px; font-weight: 700;">
            Total Requests: ${items.length}
          </td>
          <td style="padding: 10px 10px; text-align: right; border: 1px solid #E5DDC9; font-size: 16.5px; font-weight: 800; color: #003B2B;">
            ${totalQty.toLocaleString()}
          </td>
          <td colspan="2" style="padding: 10px 10px; text-align: center; border: 1px solid #E5DDC9; font-size: 14px; font-weight: 600; color: #5A6962;">
            Grand Requested Total
          </td>
        </tr>
      </tfoot>
    ` : '';

    const contentHtml = `
      <div style="flex: 1; display: flex; flex-direction: column;">
        ${headerHtml}
        <table style="width: 100%; border-collapse: collapse; margin-bottom: auto;">
          <thead>
            <tr style="background: #F5EFE0; border: 1px solid #E5DDC9;">
              <th style="padding: 10px 6px; text-align: center; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 34px;">#</th>
              <th style="padding: 10px 8px; text-align: left; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 115px;">Branch Name</th>
              <th style="padding: 10px 8px; text-align: left; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 100px;">Department</th>
              <th style="padding: 10px 10px; text-align: left; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9;">Item Name</th>
              <th style="padding: 10px 6px; text-align: center; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 55px;">Unit</th>
              <th style="padding: 10px 10px; text-align: right; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 85px;">Requested</th>
              <th style="padding: 10px 8px; text-align: center; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 80px;">Date</th>
              <th style="padding: 10px 8px; text-align: center; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 85px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          ${summaryFooterHtml}
        </table>
      </div>
      ${footerHtml}
    `;

    pageEl.innerHTML = contentHtml;
    pages.push(pageEl);
  }

  const filename = `Annamithra_Branch_Request_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  return await renderHtmlPagesToPdf({ pages, filename, orientation: 'portrait' });
}

/**
 * 3. Simple Dispatch Report PDF
 * Columns: Branch Name, Department, Item Name, Unit, Dispatched Quantity, Dispatch Date, Acknowledgement Status
 */
export async function downloadSimpleDispatchPdf({ items = [], branch = 'All Branches', department = 'All Departments', dateLabel = 'All Dates' } = {}) {
  const ITEMS_PER_PAGE = 14;
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const totalQty = items.reduce((sum, it) => sum + (Number(it.dispatchedQuantity) || 0), 0);

  const deptPart = department && department !== 'All Departments' ? `   |   Dept: ${department}` : '';
  const subtitle = `Branch: ${branch || 'All Branches'}${deptPart}   |   Total Dispatches: ${items.length}   |   Total Dispatched: ${totalQty.toLocaleString()}`;

  const pages = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const startIdx = pageIdx * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, items.length);
    const pageRows = items.slice(startIdx, endIdx);
    const isLastPage = pageIdx === totalPages - 1;

    const { pageEl, headerHtml, footerHtml } = createReportPageEl({
      title: 'Dispatch Report',
      subtitle,
      dateLabel,
      pageIndex: pageIdx,
      totalPages,
      isLandscape: false
    });

    let tableRowsHtml = '';
    if (items.length === 0) {
      tableRowsHtml = `
        <tr>
          <td colspan="8" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; font-size: 14px;">
            No dispatch records found matching the selected filter criteria.
          </td>
        </tr>
      `;
    } else {
      pageRows.forEach((it, i) => {
        const rowIdx = startIdx + i + 1;
        const bg = (rowIdx % 2 === 0) ? '#FCFAF3' : '#ffffff';
        const brName = String(it.branchName || '—');
        const deptName = String(it.department || it.category || 'Not specified');
        const itName = String(it.itemName || '—');
        const unitName = String(it.unit || '—');
        const dispVal = Number(it.dispatchedQuantity) || 0;
        const dateDisplay = String(it.formattedDate || it.dispatchDate || '—');
        const ackSt = String(it.meaningfulStatus || it.acknowledgementStatus || it.status || '—');

        tableRowsHtml += `
          <tr style="background: ${bg}; border-bottom: 1px solid #E5DDC9;">
            <td style="padding: 9px 6px; text-align: center; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 600; color: #5A6962; width: 34px;">
              ${rowIdx}
            </td>
            <td style="padding: 9px 8px; border: 1px solid #E5DDC9; font-weight: 700; color: #17352B; font-size: 15px; width: 115px; word-break: break-word;">
              ${brName}
            </td>
            <td style="padding: 9px 8px; border: 1px solid #E5DDC9; font-size: 14px; font-weight: 500; color: #5A6962; width: 100px; word-break: break-word;">
              ${deptName}
            </td>
            <td style="padding: 9px 10px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 14.5px; word-break: break-word;">
              ${itName}
            </td>
            <td style="padding: 9px 6px; text-align: center; border: 1px solid #E5DDC9; font-size: 14px; font-weight: 500; color: #5A6962; width: 55px;">
              ${unitName}
            </td>
            <td style="padding: 9px 10px; text-align: right; border: 1px solid #E5DDC9; font-weight: 600; color: #003B2B; font-size: 15px; width: 85px;">
              ${dispVal.toLocaleString()}
            </td>
            <td style="padding: 9px 8px; text-align: center; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 500; color: #5A6962; width: 80px;">
              ${dateDisplay}
            </td>
            <td style="padding: 9px 8px; text-align: center; border: 1px solid #E5DDC9; width: 85px;">
              <span style="background: #F5EFE0; border: 1px solid #E5DDC9; padding: 3px 6px; border-radius: 4px; font-weight: 700; font-size: 12.5px; color: #17352B; display: inline-block;">
                ${ackSt}
              </span>
            </td>
          </tr>
        `;
      });
    }

    const summaryFooterHtml = isLastPage && items.length > 0 ? `
      <tfoot>
        <tr style="background: #F5EFE0; border: 1.5px solid #D4A63B; font-weight: 700; color: #003B2B;">
          <td colspan="5" style="padding: 10px 12px; border: 1px solid #E5DDC9; font-size: 16px; font-weight: 700;">
            Total Dispatches: ${items.length}
          </td>
          <td style="padding: 10px 10px; text-align: right; border: 1px solid #E5DDC9; font-size: 16.5px; font-weight: 800; color: #003B2B;">
            ${totalQty.toLocaleString()}
          </td>
          <td colspan="2" style="padding: 10px 10px; text-align: center; border: 1px solid #E5DDC9; font-size: 14px; font-weight: 600; color: #5A6962;">
            Grand Dispatched Total
          </td>
        </tr>
      </tfoot>
    ` : '';

    const contentHtml = `
      <div style="flex: 1; display: flex; flex-direction: column;">
        ${headerHtml}
        <table style="width: 100%; border-collapse: collapse; margin-bottom: auto;">
          <thead>
            <tr style="background: #F5EFE0; border: 1px solid #E5DDC9;">
              <th style="padding: 10px 6px; text-align: center; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 34px;">#</th>
              <th style="padding: 10px 8px; text-align: left; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 115px;">Branch Name</th>
              <th style="padding: 10px 8px; text-align: left; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 100px;">Department</th>
              <th style="padding: 10px 10px; text-align: left; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9;">Item Name</th>
              <th style="padding: 10px 6px; text-align: center; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 55px;">Unit</th>
              <th style="padding: 10px 10px; text-align: right; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 85px;">Dispatched</th>
              <th style="padding: 10px 8px; text-align: center; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 80px;">Date</th>
              <th style="padding: 10px 8px; text-align: center; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 85px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          ${summaryFooterHtml}
        </table>
      </div>
      ${footerHtml}
    `;

    pageEl.innerHTML = contentHtml;
    pages.push(pageEl);
  }

  const filename = `Annamithra_Dispatch_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  return await renderHtmlPagesToPdf({ pages, filename, orientation: 'portrait' });
}

/**
 * 4. Category-Wise Summary Report PDF
 * Columns: Category, Total Items, Branch Requested Quantity, Store Dispatched Quantity, Pending Quantity
 * Accurately renders English, Tamil, and Bilingual Unicode Categories.
 */
export async function downloadCategorySummaryPdf({
  summary = [],
  branch = 'All Branches',
  department = 'All Departments',
  category = 'All Categories',
  dateLabel = 'All Dates'
} = {}) {
  const ITEMS_PER_PAGE = 14;
  const totalPages = Math.max(1, Math.ceil(summary.length / ITEMS_PER_PAGE));
  const formatUnitMap = (map) => {
    if (!map || Object.keys(map).length === 0) return '0';
    return Object.entries(map)
      .map(([u, val]) => `${Number(val || 0).toLocaleString()} ${u}`)
      .join(', ');
  };

  const subtitle = `Branch: ${branch}   |   Dept: ${department}   |   Categories: ${summary.length}`;
  const pages = [];

  const totalDistinctItems = summary.reduce((sum, r) => sum + (Number(r.totalItems) || 0), 0);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const startIdx = pageIdx * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, summary.length);
    const pageRows = summary.slice(startIdx, endIdx);
    const isLastPage = pageIdx === totalPages - 1;

    const { pageEl, headerHtml, footerHtml } = createReportPageEl({
      title: 'Category-Wise Summary Report',
      subtitle,
      dateLabel,
      pageIndex: pageIdx,
      totalPages,
      isLandscape: false
    });

    let tableRowsHtml = '';
    if (summary.length === 0) {
      tableRowsHtml = `
        <tr>
          <td colspan="6" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; font-size: 14px;">
            No category summary records found matching the selected filter criteria.
          </td>
        </tr>
      `;
    } else {
      pageRows.forEach((row, i) => {
        const rowIdx = startIdx + i + 1;
        const bg = (rowIdx % 2 === 0) ? '#FCFAF3' : '#ffffff';
        const cName = String(row.category || 'Uncategorised');
        const reqStr = formatUnitMap(row.requestedByUnit);
        const dispStr = formatUnitMap(row.dispatchedByUnit);
        const pendStr = formatUnitMap(row.pendingByUnit);

        tableRowsHtml += `
          <tr style="background: ${bg}; border-bottom: 1px solid #E5DDC9;">
            <td style="padding: 9px 10px; text-align: center; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 600; color: #5A6962; width: 38px;">
              ${rowIdx}
            </td>
            <td style="padding: 9px 12px; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 15px; word-break: break-word;">
              ${cName}
            </td>
            <td style="padding: 9px 10px; text-align: center; border: 1px solid #E5DDC9; font-size: 14.5px; font-weight: 600; color: #17352B; width: 95px;">
              ${row.totalItems || 0}
            </td>
            <td style="padding: 9px 12px; text-align: right; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 15px; width: 125px;">
              ${reqStr}
            </td>
            <td style="padding: 9px 12px; text-align: right; border: 1px solid #E5DDC9; font-weight: 600; color: #07543D; font-size: 15px; width: 125px;">
              ${dispStr}
            </td>
            <td style="padding: 9px 12px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 15px; width: 125px;">
              ${pendStr}
            </td>
          </tr>
        `;
      });
    }

    const summaryFooterHtml = isLastPage && summary.length > 0 ? `
      <tfoot>
        <tr style="background: #F5EFE0; border: 1.5px solid #D4A63B; font-weight: 700; color: #003B2B;">
          <td colspan="2" style="padding: 10px 14px; border: 1px solid #E5DDC9; font-size: 16px; font-weight: 700;">
            Total Categories: ${summary.length}
          </td>
          <td style="padding: 10px 10px; text-align: center; border: 1px solid #E5DDC9; font-size: 16.5px; font-weight: 800; color: #003B2B;">
            ${totalDistinctItems}
          </td>
          <td colspan="3" style="padding: 10px 14px; text-align: right; border: 1px solid #E5DDC9; font-size: 14.5px; font-weight: 600; color: #17352B;">
            Report Summary by Category
          </td>
        </tr>
      </tfoot>
    ` : '';

    const contentHtml = `
      <div style="flex: 1; display: flex; flex-direction: column;">
        ${headerHtml}
        <table style="width: 100%; border-collapse: collapse; margin-bottom: auto;">
          <thead>
            <tr style="background: #F5EFE0; border: 1px solid #E5DDC9;">
              <th style="padding: 11px 10px; text-align: center; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 38px;">#</th>
              <th style="padding: 11px 12px; text-align: left; font-size: 15.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9;">Category</th>
              <th style="padding: 11px 10px; text-align: center; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 95px;">Distinct Items</th>
              <th style="padding: 11px 12px; text-align: right; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 125px;">Requested Qty</th>
              <th style="padding: 11px 12px; text-align: right; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 125px;">Dispatched Qty</th>
              <th style="padding: 11px 12px; text-align: right; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 125px;">Pending Qty</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          ${summaryFooterHtml}
        </table>
      </div>
      ${footerHtml}
    `;

    pageEl.innerHTML = contentHtml;
    pages.push(pageEl);
  }

  const filename = `Annamithra_Category_Summary_${new Date().toISOString().slice(0, 10)}.pdf`;
  return await renderHtmlPagesToPdf({ pages, filename, orientation: 'portrait' });
}

/**
 * 5. Category Details Report PDF (Item-level)
 * Accurately renders English, Tamil, and Bilingual Unicode Categories and Item Names.
 */
export async function downloadCategoryDetailPdf({
  categoryName = 'Category',
  items = [],
  branch = 'All Branches',
  department = 'All Departments',
  dateLabel = 'All Dates'
} = {}) {
  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const totalReq = items.reduce((sum, it) => sum + (Number(it.requestedQuantity) || 0), 0);
  const totalDisp = items.reduce((sum, it) => sum + (Number(it.dispatchedQuantity) || 0), 0);
  const totalPend = items.reduce((sum, it) => sum + (Number(it.pendingQuantity) || 0), 0);

  const subtitle = `Category: ${categoryName}   |   Branch: ${branch}   |   Dept: ${department}   |   Items: ${items.length}`;
  const pages = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const startIdx = pageIdx * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, items.length);
    const pageRows = items.slice(startIdx, endIdx);
    const isLastPage = pageIdx === totalPages - 1;

    const { pageEl, headerHtml, footerHtml } = createReportPageEl({
      title: `${categoryName} – Item Details Report`,
      subtitle,
      dateLabel,
      pageIndex: pageIdx,
      totalPages,
      isLandscape: true
    });

    let tableRowsHtml = '';
    if (items.length === 0) {
      tableRowsHtml = `
        <tr>
          <td colspan="11" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; font-size: 14px;">
            No items found matching the selected filter criteria.
          </td>
        </tr>
      `;
    } else {
      pageRows.forEach((it, i) => {
        const rowIdx = startIdx + i + 1;
        const bg = (rowIdx % 2 === 0) ? '#FCFAF3' : '#ffffff';
        const iName = String(it.itemName || '—');
        const uName = String(it.unit || '—');
        const bName = String(it.branchName || '—');
        const dName = String(it.department || 'Not specified');
        const reqQty = Number(it.requestedQuantity || 0).toLocaleString();
        const dispQty = Number(it.dispatchedQuantity || 0).toLocaleString();
        const pendQty = Number(it.pendingQuantity || 0).toLocaleString();
        const rDateStr = String(it.requestDate || '—');
        const dDateStr = String(it.dispatchDate || '—');
        const st = String(it.dispatchStatus || it.status || 'Pending');

        tableRowsHtml += `
          <tr style="background: ${bg}; border-bottom: 1px solid #E5DDC9;">
            <td style="padding: 8px 6px; text-align: center; border: 1px solid #E5DDC9; font-size: 13px; font-weight: 600; color: #5A6962; width: 34px;">
              ${rowIdx}
            </td>
            <td style="padding: 8px 8px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 14.5px; width: 180px; word-break: break-word;">
              ${iName}
            </td>
            <td style="padding: 8px 6px; text-align: center; border: 1px solid #E5DDC9; font-size: 14px; font-weight: 500; color: #5A6962; width: 55px;">
              ${uName}
            </td>
            <td style="padding: 8px 8px; border: 1px solid #E5DDC9; font-weight: 700; color: #17352B; font-size: 15px; width: 120px; word-break: break-word;">
              ${bName}
            </td>
            <td style="padding: 8px 8px; border: 1px solid #E5DDC9; font-size: 14px; font-weight: 500; color: #5A6962; width: 105px; word-break: break-word;">
              ${dName}
            </td>
            <td style="padding: 8px 8px; text-align: right; border: 1px solid #E5DDC9; font-weight: 600; color: #003B2B; font-size: 15px; width: 85px;">
              ${reqQty}
            </td>
            <td style="padding: 8px 8px; text-align: right; border: 1px solid #E5DDC9; font-weight: 600; color: #07543D; font-size: 15px; width: 85px;">
              ${dispQty}
            </td>
            <td style="padding: 8px 8px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 15px; width: 85px;">
              ${pendQty}
            </td>
            <td style="padding: 8px 6px; text-align: center; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 500; color: #5A6962; width: 85px;">
              ${rDateStr}
            </td>
            <td style="padding: 8px 6px; text-align: center; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 500; color: #5A6962; width: 85px;">
              ${dDateStr}
            </td>
            <td style="padding: 8px 6px; text-align: center; border: 1px solid #E5DDC9; width: 95px;">
              <span style="background: #F5EFE0; border: 1px solid #E5DDC9; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 12px; color: #17352B; display: inline-block;">
                ${st}
              </span>
            </td>
          </tr>
        `;
      });
    }

    const summaryFooterHtml = isLastPage && items.length > 0 ? `
      <tfoot>
        <tr style="background: #F5EFE0; border: 1.5px solid #D4A63B; font-weight: 700; color: #003B2B;">
          <td colspan="5" style="padding: 9px 10px; border: 1px solid #E5DDC9; font-size: 15.5px; font-weight: 700;">
            Total Items: ${items.length}
          </td>
          <td style="padding: 9px 8px; text-align: right; border: 1px solid #E5DDC9; font-size: 16px; font-weight: 800; color: #003B2B;">
            ${totalReq.toLocaleString()}
          </td>
          <td style="padding: 9px 8px; text-align: right; border: 1px solid #E5DDC9; font-size: 16px; font-weight: 800; color: #07543D;">
            ${totalDisp.toLocaleString()}
          </td>
          <td style="padding: 9px 8px; text-align: right; border: 1px solid #E5DDC9; font-size: 16px; font-weight: 800; color: #003B2B;">
            ${totalPend.toLocaleString()}
          </td>
          <td colspan="3" style="padding: 9px 8px; text-align: center; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 600; color: #5A6962;">
            Grand Totals
          </td>
        </tr>
      </tfoot>
    ` : '';

    const contentHtml = `
      <div style="flex: 1; display: flex; flex-direction: column;">
        ${headerHtml}
        <table style="width: 100%; border-collapse: collapse; margin-bottom: auto;">
          <thead>
            <tr style="background: #F5EFE0; border: 1px solid #E5DDC9;">
              <th style="padding: 9px 6px; text-align: center; font-size: 14px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 34px;">#</th>
              <th style="padding: 9px 8px; text-align: left; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 180px;">Item Name</th>
              <th style="padding: 9px 6px; text-align: center; font-size: 14px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 55px;">Unit</th>
              <th style="padding: 9px 8px; text-align: left; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 120px;">Branch</th>
              <th style="padding: 9px 8px; text-align: left; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 105px;">Department</th>
              <th style="padding: 9px 8px; text-align: right; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 85px;">Requested</th>
              <th style="padding: 9px 8px; text-align: right; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 85px;">Dispatched</th>
              <th style="padding: 9px 8px; text-align: right; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 85px;">Pending</th>
              <th style="padding: 9px 6px; text-align: center; font-size: 14px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 85px;">Req Date</th>
              <th style="padding: 9px 6px; text-align: center; font-size: 14px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 85px;">Disp Date</th>
              <th style="padding: 9px 6px; text-align: center; font-size: 14px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 95px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          ${summaryFooterHtml}
        </table>
      </div>
      ${footerHtml}
    `;

    pageEl.innerHTML = contentHtml;
    pages.push(pageEl);
  }

  const cleanCategory = String(categoryName || 'Category').replace(/\s*\/\s*/g, '_').replace(/[/\\?%*:|"<>]/g, '_').trim().replace(/\s+/g, '_');
  const filename = `Annamithra_${cleanCategory}_Item_Details_${new Date().toISOString().slice(0, 10)}.pdf`;
  return await renderHtmlPagesToPdf({ pages, filename, orientation: 'landscape' });
}

/**
 * Universal CSV Export for Simplified Reports
 */
export function exportReportCsv({ reportType, items = [], filename = 'report.csv' }) {
  if (!items || items.length === 0) {
    alert('No records found matching filters to export.');
    return false;
  }

  let headers = [];
  let rows = [];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    const s = String(val).replace(/"/g, '""');
    return (s.search(/("|,|\n|\r)/g) >= 0) ? `"${s}"` : s;
  };

  if (reportType === 'inventory') {
    headers = ['Item Name', 'Unit', 'Current Stock', 'Last Updated Date'];
    rows = items.map(it => [
      escapeCsv(it.itemName || it.name),
      escapeCsv(it.unit),
      escapeCsv(it.currentStock),
      escapeCsv(it.formattedLastUpdated || it.lastUpdated)
    ]);
  } else if (reportType === 'requests') {
    headers = ['Branch Name', 'Department', 'Item Name', 'Unit', 'Requested Quantity', 'Request Date', 'Status'];
    rows = items.map(it => [
      escapeCsv(it.branchName || it.branch),
      escapeCsv(it.department || it.category || 'Not specified'),
      escapeCsv(it.itemName || it.item),
      escapeCsv(it.unit),
      escapeCsv(it.requestedQuantity),
      escapeCsv(it.formattedDate || it.date),
      escapeCsv(it.meaningfulStatus || it.status)
    ]);
  } else if (reportType === 'dispatches') {
    headers = ['Branch Name', 'Department', 'Item Name', 'Unit', 'Dispatched Quantity', 'Dispatch Date', 'Acknowledgement Status'];
    rows = items.map(it => [
      escapeCsv(it.branchName),
      escapeCsv(it.department || it.category || 'Not specified'),
      escapeCsv(it.itemName),
      escapeCsv(it.unit),
      escapeCsv(it.dispatchedQuantity),
      escapeCsv(it.formattedDate || it.dispatchDate),
      escapeCsv(it.meaningfulStatus || it.acknowledgementStatus || it.status)
    ]);
  } else if (reportType === 'category-summary') {
    headers = ['Category', 'Total Distinct Items', 'Requested Quantity', 'Dispatched Quantity', 'Pending Quantity'];
    const formatUnitMap = (map) => {
      if (!map || Object.keys(map).length === 0) return '0';
      return Object.entries(map).map(([u, val]) => `${Number(val || 0)} ${u}`).join(', ');
    };
    rows = items.map(c => [
      escapeCsv(c.category),
      escapeCsv(c.totalItems),
      escapeCsv(formatUnitMap(c.requestedByUnit)),
      escapeCsv(formatUnitMap(c.dispatchedByUnit)),
      escapeCsv(formatUnitMap(c.pendingByUnit))
    ]);
  } else if (reportType === 'category-details') {
    headers = ['Item Name', 'Category', 'Unit', 'Branch Name', 'Department', 'Requested Quantity', 'Dispatched Quantity', 'Pending Quantity', 'Request Date', 'Dispatch Date', 'Dispatch Status'];
    rows = items.map(it => [
      escapeCsv(it.itemName),
      escapeCsv(it.category),
      escapeCsv(it.unit),
      escapeCsv(it.branchName),
      escapeCsv(it.department),
      escapeCsv(it.requestedQuantity),
      escapeCsv(it.dispatchedQuantity),
      escapeCsv(it.pendingQuantity),
      escapeCsv(it.requestDate),
      escapeCsv(it.dispatchDate || '—'),
      escapeCsv(it.dispatchStatus || it.status)
    ]);
  }

  const csvContent = '\uFEFF' + [
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}


