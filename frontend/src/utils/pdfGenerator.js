import { formatQuantityWithUnit, formatUnitSummary, cleanUnitName } from './quantityFormatter.js';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { itemTranslations, unitTranslations, statusTranslations, categoryTranslations } from '../i18n/translations.js';
import { printThermalReceipt, generateThermalReceiptHtml } from '../components/ThermalPrintLayout.jsx';
import { getTodayDateString } from './dateGrouping.js';

export { printThermalReceipt, generateThermalReceiptHtml };

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

const translateCategoryGlobal = (cat) => {
  if (!cat) return '';
  const lower = String(cat).toLowerCase().trim();
  return categoryTranslations[lower] || categoryTranslations[cat] || cat;
};

const translateStatusGlobal = (st) => {
  if (!st) return '';
  return statusTranslations[st] || st;
};

/**
 * Direct Print Engine
 * Opens the native browser print dialog with isolated A4 page styling,
 * preserving Annamithra green (#003B2B) and gold (#D4A63B) branding, repeated table headers,
 * and hiding all outer application navigation, sidebars, and form controls.
 */
export async function printHtmlPages({ pages, orientation = 'portrait' }) {
  await ensureTamilFontLoaded();

  const safePages = Array.isArray(pages) ? pages : [];
  if (safePages.length === 0) return false;

  const isLandscape = orientation === 'landscape';

  // Create an isolated hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.id = 'ann-print-iframe-' + Date.now();
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Annamithra Print</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page {
            size: A4 ${isLandscape ? 'landscape' : 'portrait'};
            margin: 8mm 10mm 8mm 10mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: 'Noto Sans Tamil', 'Outfit', 'Inter', 'Nirmala UI', system-ui, -apple-system, sans-serif;
            color: #17352B;
          }
          .print-page-wrapper {
            width: 100%;
            page-break-after: always;
            break-after: page;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: ${isLandscape ? '185mm' : '265mm'};
            box-sizing: border-box;
            background: #ffffff;
            padding: 0;
          }
          .print-page-wrapper:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          thead {
            display: table-header-group;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .no-print {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div id="print-root"></div>
      </body>
    </html>
  `);
  doc.close();

  const printRoot = doc.getElementById('print-root');
  safePages.forEach((pageEl) => {
    const wrapper = doc.createElement('div');
    wrapper.className = 'print-page-wrapper';
    const clone = pageEl.cloneNode(true);
    clone.style.width = '100%';
    clone.style.minHeight = 'auto';
    clone.style.boxSizing = 'border-box';
    wrapper.appendChild(clone);
    printRoot.appendChild(wrapper);
  });

  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        resolve(true);
      } catch (e) {
        console.error('Direct print failed:', e);
        resolve(false);
      } finally {
        setTimeout(() => {
          if (iframe && iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 5000);
      }
    }, 350);
  });
}

/**
 * Builds printable HTML page elements for a purchase order.
 */
export function buildOrderPages({ orderNumber, items = [], formatType, orderDate, createdAt, language = 'ta' }) {
  const isTa = language === 'ta';
  const { dateStr, timeStr } = parseOrderDateTime(createdAt, orderDate, language);
  const ITEMS_PER_PAGE = 14;
  const safeItems = Array.isArray(items) ? items : [];
  const totalPages = Math.max(1, Math.ceil((safeItems.length || 1) / ITEMS_PER_PAGE));
  const pages = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const startIdx = pageIdx * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, safeItems.length);
    const pageItems = safeItems.slice(startIdx, endIdx);
    const isLastPage = pageIdx === totalPages - 1;

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
          <td colspan="2" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; font-size: 14px;">
            ${isTa ? 'இந்த ஆர்டரில் எந்தப் பொருட்களும் இல்லை.' : 'No items found in this order.'}
          </td>
        </tr>
      `;
    } else {
      pageItems.forEach((line) => {
        const rawName = String(line.itemName || line.item || '').trim();
        const translatedName = isTa ? translateItemName(rawName) : rawName;
        const rawUnit = String(line.unit || '').trim();
        const rawQty = line.quantity ?? line.orderQuantity ?? 0;
        const combinedQty = formatQuantityWithUnit(rawQty, rawUnit, isTa);

        itemsRowsHtml += `
          <tr style="border-bottom: 1px solid #E5DDC9;">
            <td style="padding: 11px 14px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 14.5px;">
              ${translatedName}
            </td>
            <td style="padding: 11px 14px; border: 1px solid #E5DDC9; text-align: right; font-weight: 700; color: #003B2B; font-size: 15px;">
              ${combinedQty}
            </td>
          </tr>
        `;
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
            <th style="padding: 11px 14px; text-align: left; font-size: 15.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 68%;">
              ${isTa ? 'பொருளின் பெயர்' : 'Item Name'}
            </th>
            <th style="padding: 11px 14px; text-align: right; font-size: 15.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 32%;">
              ${isTa ? 'ஆர்டர் அளவு' : 'Ordered Quantity'}
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
            ${isTa ? `மொத்த பொருட்கள்: ${safeItems.length}` : `Total Items: ${safeItems.length}`}
          </span>
        </div>
      ` : ''}
    `;

    pages.push(pageEl);
  }

  return pages;
}

/**
 * Renders and downloads a Tamil Unicode PDF with accurate Tamil typography,
 * ligatures, and styling matching the Annamithra theme.
 */
async function generateOrderHtmlPdf({ orderNumber, items, formatType, orderDate, createdAt, language = 'ta' }) {
  await ensureTamilFontLoaded();
  const pages = buildOrderPages({ orderNumber, items, formatType, orderDate, createdAt, language });

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
 * Normalizes input arguments for purchase order printing / downloading.
 */
function resolveOrderArgs(orderOrNumber, itemsOrOptions = [], options = {}) {
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

  if (!createdAt && items.length > 0 && items[0].createdAt) {
    createdAt = items[0].createdAt;
  }
  if (!orderDate && items.length > 0 && items[0].orderDate) {
    orderDate = items[0].orderDate;
  }

  return { orderNumber, items, formatType, orderDate, createdAt, language };
}

/**
 * Generates and downloads a clean, printable purchase order PDF.
 * Automatically chooses English or Tamil layout based on current language choice.
 */
export async function downloadOrderPdf(orderOrNumber, itemsOrOptions = [], options = {}) {
  const args = resolveOrderArgs(orderOrNumber, itemsOrOptions, options);
  return generateOrderHtmlPdf(args);
}

/**
 * Direct print for Purchase Orders without downloading a PDF.
 * Immediately opens the browser print dialog with POS 80mm monochrome thermal receipt layout.
 */
export async function printOrderDirect(orderOrNumber, itemsOrOptions = [], options = {}) {
  const args = resolveOrderArgs(orderOrNumber, itemsOrOptions, options);
  const { orderNumber, items = [], formatType, orderDate, createdAt, language = 'ta' } = args;
  const isTa = language === 'ta';
  const { dateStr, timeStr } = parseOrderDateTime(createdAt, orderDate, language);
  const safeItems = Array.isArray(items) ? items : [];

  return printThermalReceipt({
    organisationName: isTa ? 'சரவண பவன் குழுமம்' : 'Saravana Bhavan Group',
    branchName: formatType === 'ORG_ADMIN'
      ? (isTa ? 'நிர்வாகக் கொள்முதல்' : 'Organisation Admin Purchase')
      : (isTa ? 'சேமிப்பக மேலாளர்' : 'Store Central Inventory'),
    title: isTa ? `*** கொள்முதல் ஆர்டர்: ${orderNumber} ***` : `*** PURCHASE ORDER: ${orderNumber} ***`,
    dateLabel: dateStr || orderDate || '',
    generatedAt: `${dateStr || ''} ${timeStr || ''}`.trim(),
    metadata: [
      { label: isTa ? 'ஆர்டர் எண்' : 'Order #', value: orderNumber },
      { label: isTa ? 'வகை' : 'PO Type', value: formatType === 'ORG_ADMIN' ? 'Org Admin' : 'Store Manager' }
    ],
    columns: [
      { header: '#', key: '#', align: 'center', width: '22px' },
      { header: isTa ? 'பொருள்' : 'Item Name', key: 'name', align: 'left', render: r => isTa ? translateItemName(r.name || r.itemName) : (r.name || r.itemName) },
      { header: isTa ? 'அளவு' : 'Qty', key: 'quantity', align: 'right', render: r => `${r.quantity || r.orderQuantity || 0} ${cleanUnitName(r.unit || '')}` }
    ],
    items: safeItems,
    summaryRows: [
      { label: isTa ? 'மொத்த வரிகள்:' : 'Total Lines:', value: safeItems.length, isTotal: true }
    ],
    footerNotes: [
      isTa ? '*** கொள்முதல் ஆர்டர் சரிபார்க்கப்பட்டது ***' : '*** PURCHASE ORDER VERIFIED ***',
      'Annamithra Food Management',
      isTa ? '*** ரசீது முடிவு ***' : '*** END OF RECEIPT ***'
    ],
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
 * Direct print for Branch Request report wrapper.
 */
export async function printBranchRequestReportDirect({
  branch = '',
  dateStr = '',
  isAllDates = false,
  category = '',
  items = [],
  language = 'en'
} = {}) {
  const dateLabel = isAllDates ? 'All Dates' : (dateStr || 'All Dates');
  return printSimpleBranchRequestReport({
    items,
    branch: branch || 'All Branches',
    department: 'All Departments',
    dateLabel
  });
}

/**
 * Builds HTML page elements for Branch Requests organized by branch in request submission order.
 */
export function buildBranchRequestsPages({
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
                  ? (isTa ? `அன்னமித்ரா — ${singleBranch.name || 'கிளை'} விநியோக அறிக்கை` : `Annamithra — ${singleBranch.name || 'Branch'} Delivery Report`)
                  : (isTa ? 'அன்னமித்ரா — ஸ்டோர் மேலாளர் விநியோக அறிக்கை' : 'Annamithra — Store Manager Delivery Report')}
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
            ? (isTa ? `அன்னமித்ரா — ${singleBranch.name || 'கிளை'} விநியோக அறிக்கை (தொடர்ச்சி)` : `Annamithra — ${singleBranch.name || 'Branch'} Delivery Report (Continued)`)
            : (isTa ? 'அன்னமித்ரா — ஸ்டோர் மேலாளர் விநியோக அறிக்கை (தொடர்ச்சி)' : 'Annamithra — Store Manager Delivery Report (Continued)')}
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

  return pages.map(p => p.pageEl);
}

/**
 * Generates and downloads a comprehensive, printable Branch Requests PDF report
 * organized by branch in request submission order. Supports both English and Tamil Unicode.
 */
export async function downloadBranchRequestsPdf(options = {}) {
  await ensureTamilFontLoaded();
  const pageEls = buildBranchRequestsPages(options);
  const totalPagesCount = pageEls.length;

  const pdf = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait'
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-1000';
  document.body.appendChild(container);

  try {
    for (let pageIdx = 0; pageIdx < totalPagesCount; pageIdx++) {
      const el = pageEls[pageIdx];
      container.innerHTML = '';
      container.appendChild(el);

      const canvas = await html2canvas(el, {
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

    const cleanDate = options.dateFilter ? String(options.dateFilter).replace(/[^0-9-]/g, '') : 'All_Dates';
    let fileName = '';
    if (options.singleBranch) {
      const cleanBranch = String(options.singleBranch.name || 'Branch').replace(/[^a-zA-Z0-9_-]/g, '_');
      fileName = `${cleanBranch}_Delivery_Report_${cleanDate}.pdf`;
    } else {
      fileName = `Annamithra_Store_Manager_Delivery_Report_${cleanDate}.pdf`;
    }
    pdf.save(fileName);
    return true;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Direct print for Branch Requests (Store Manager View)
 * Immediately opens the native browser print dialog using POS 80mm monochrome thermal receipt layout.
 */
export async function printBranchRequestsDirect(options = {}) {
  const {
    sortedBranches = [],
    requests = [],
    dateFilter = '',
    isAllDates = false,
    language = 'ta',
    singleBranch = null
  } = options;
  const isTa = language === 'ta';

  const isSingle = Boolean(singleBranch);
  const targetBranches = isSingle ? [singleBranch] : sortedBranches;
  const branchName = isSingle ? (singleBranch.name || 'Branch') : (isTa ? 'அனைத்து கிளைகள்' : 'All Branches');

  const flatItems = [];
  targetBranches.forEach(b => {
    const bName = b.name || '';
    const bReqs = requests.filter(r => (r.branch || '').trim().toLowerCase() === bName.trim().toLowerCase());
    bReqs.forEach(r => {
      flatItems.push({
        branch: bName,
        itemName: isTa ? translateItemName(r.itemName) : r.itemName,
        department: r.department || r.category || 'General',
        quantity: r.quantity || r.requestedQuantity || 0,
        unit: cleanUnitName(r.unit || '')
      });
    });
  });

  const columns = isSingle ? [
    { header: '#', key: '#', align: 'center', width: '20px' },
    { header: isTa ? 'பொருள்' : 'Item', key: 'itemName', align: 'left' },
    { header: isTa ? 'துறை' : 'Dept', key: 'department', align: 'left' },
    { header: isTa ? 'அளவு' : 'Qty', key: 'quantity', align: 'right', render: r => `${r.quantity} ${r.unit}` }
  ] : [
    { header: '#', key: '#', align: 'center', width: '18px' },
    { header: isTa ? 'கிளை' : 'Branch', key: 'branch', align: 'left' },
    { header: isTa ? 'பொருள்' : 'Item', key: 'itemName', align: 'left' },
    { header: isTa ? 'அளவு' : 'Qty', key: 'quantity', align: 'right', render: r => `${r.quantity} ${r.unit}` }
  ];

  return printThermalReceipt({
    organisationName: isTa ? 'சரவண பவன் குழுமம்' : 'Saravana Bhavan Group',
    branchName: isSingle ? `${isTa ? 'கிளை:' : 'Branch:'} ${branchName}` : (isTa ? 'சேமிப்பகம் - அனைத்து கிளைகள்' : 'Store - All Branches'),
    title: isTa ? '*** கிளை கோரிக்கைகள் பட்டியல் ***' : '*** BRANCH REQUESTS LIST ***',
    dateLabel: isAllDates ? (isTa ? 'அனைத்து தேதிகள்' : 'All Dates') : (dateFilter || (isTa ? 'இன்று' : 'Today')),
    metadata: [
      { label: isTa ? 'நோக்கம்' : 'Scope', value: isSingle ? branchName : (isTa ? 'அனைத்து கிளைகள்' : 'All Branches') },
      { label: isTa ? 'வடிகட்டி' : 'Filter', value: isAllDates ? (isTa ? 'அனைத்து தேதிகள்' : 'All Dates') : (dateFilter || (isTa ? 'இன்று' : 'Today')) }
    ],
    columns,
    items: flatItems,
    summaryRows: [
      { label: isTa ? 'மொத்த கோரிக்கை பொருட்கள்:' : 'Total Request Lines:', value: flatItems.length, isTotal: true }
    ],
    footerNotes: [
      isTa ? '*** கிடங்கு விநியோக ரசீது ***' : '*** STORE DELIVERY RECEIPT ***',
      'Annamithra Food Management',
      isTa ? '*** ரசீது முடிவு ***' : '*** END OF RECEIPT ***'
    ],
    language
  });
}

// Alias export for downloadStoreManagerDispatchPdf & printStoreManagerDispatchDirect
export const downloadStoreManagerDispatchPdf = downloadBranchRequestsPdf;
export const printStoreManagerDispatchDirect = printBranchRequestsDirect;

export function buildBranchOrderListPages({
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

  const totalItemCount = safeItems.length;
  const orderListUnitTotals = {};
  safeItems.forEach(it => {
    const u = it.unit || 'KG';
    const q = Number(it.requestedQuantity ?? it.quantity) || 0;
    orderListUnitTotals[u] = (orderListUnitTotals[u] || 0) + q;
  });
  const summaryTotalQuantityStr = formatUnitSummary(orderListUnitTotals, isTa);

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
  const PAGE_WIDTH_PX = 794;
  const PAGE_MIN_HEIGHT_PX = 1122;
  const pageEls = [];

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
            <td colspan="4" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; background: #ffffff;">
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
              <td style="padding: 8px 14px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 15px; width: 150px;">
                ${formatQuantityWithUnit(qty, rawUnit, isTa)}
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
                <th style="padding: 10px 12px; text-align: left; font-size: 14.5px; font-weight: 700; border: 1px solid #003B2B; width: 160px;">
                  ${isTa ? 'துறை (Department)' : 'Department'}
                </th>
                <th style="padding: 10px 14px; text-align: right; font-size: 15px; font-weight: 700; border: 1px solid #003B2B; width: 150px;">
                  ${isTa ? 'கோரப்பட்ட அளவு (Requested Quantity)' : 'Requested Quantity'}
                </th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
            ${pageInfo.isLastPage && safeItems.length > 0 ? `
              <tfoot>
                <tr style="background: #F5EFE0; border: 2px solid #D4A63B; font-weight: 800; color: #003B2B;">
                  <td colspan="3" style="padding: 10px 14px; text-align: right; font-size: 15.5px; border: 1px solid #E5DDC9;">
                    ${isTa ? ('மொத்தம் (' + totalItemCount + ' பொருட்கள்):') : ('Grand Total (' + totalItemCount + ' Items):')}
                  </td>
                  <td style="padding: 10px 14px; text-align: right; font-size: 16px; font-weight: 800; color: #003B2B; border: 1px solid #E5DDC9;">
                    ${summaryTotalQuantityStr}
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

      pageEls.push(pageEl);
    }

    return pageEls;
}

/**
 * Generates and downloads a clean, professional PDF of the Branch Order List (Section A ONLY).
 */
export async function downloadBranchOrderListPdf(options = {}) {
  await ensureTamilFontLoaded();
  const pageEls = buildBranchOrderListPages(options);
  const pdf = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait'
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-1000';
  document.body.appendChild(container);

  try {
    for (let pIdx = 0; pIdx < pageEls.length; pIdx++) {
      const pageEl = pageEls[pIdx];
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

    const cleanBranch = String(options.branchName || 'Branch').replace(/[^a-zA-Z0-9_-]/g, '_');
    const displayDate = options.date || new Date().toISOString().split('T')[0];
    const cleanDate = String(displayDate).replace(/[^0-9-]/g, '');
    const prefix = options.isDraft ? 'Draft' : 'Order';
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
 * Direct Print for Branch Order List (Section A & Drafts)
 * Immediately opens the native browser print dialog with POS 80mm monochrome thermal receipt layout.
 */
export async function printBranchOrderListDirect(options = {}) {
  const {
    organisationName = 'Saravana Bhavan',
    branchName = 'Branch 1',
    branchManager = '',
    date = '',
    items = [],
    isDraft = false,
    draftName = '',
    language = 'ta'
  } = options;
  const isTa = language === 'ta';
  const safeItems = Array.isArray(items) ? items : [];

  const title = isDraft
    ? (isTa ? `*** வரைவு: ${(draftName || 'ஆர்டர் வரைவு').toUpperCase()} ***` : `*** DRAFT: ${(draftName || 'ORDER DRAFT').toUpperCase()} ***`)
    : (isTa ? '*** கிளை ஆர்டர் பட்டியல் ***' : '*** BRANCH ORDER LIST ***');

  const metadata = [
    { label: isTa ? 'கிளை' : 'Branch', value: branchName },
    branchManager ? { label: isTa ? 'மேலாளர்' : 'Manager', value: branchManager } : null,
    { label: isTa ? 'வகை' : 'Type', value: isDraft ? (isTa ? 'சேமிக்கப்பட்ட வரைவு' : 'Saved Draft') : (isTa ? 'நேரடி ஆர்டர்' : 'Active Order Request') }
  ].filter(Boolean);

  const columns = [
    { header: '#', key: '#', align: 'center', width: '22px' },
    { header: isTa ? 'பொருள்' : 'Item Name', key: 'itemName', align: 'left', render: r => isTa ? translateItemName(r.itemName || r.name) : (r.itemName || r.name) },
    { header: isTa ? 'துறை' : 'Dept', key: 'department', align: 'left', render: r => r.department || r.category || 'General' },
    { header: isTa ? 'அளவு' : 'Qty', key: 'quantity', align: 'right', render: r => `${r.quantity} ${cleanUnitName(r.unit || '')}` }
  ];

  return printThermalReceipt({
    organisationName,
    branchName,
    title,
    dateLabel: date,
    metadata,
    columns,
    items: safeItems,
    summaryRows: [
      { label: isTa ? 'மொத்த பொருட்கள்:' : 'Total Items Requested:', value: safeItems.length, isTotal: true }
    ],
    footerNotes: [
      isTa ? '*** கிளை மேலாளர் ஒப்புதல் ***' : '*** BRANCH MANAGER ACK ***',
      'Annamithra Food Management',
      isTa ? '*** ரசீது முடிவு ***' : '*** END OF RECEIPT ***'
    ],
    language
  });
}

/**
 * Builds HTML page elements for Recent Requests Submitted for Branch (Section B ONLY).
 */
export function buildBranchRecentRequestsPages({
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

  const totalCount = safeRecentRequests.length;
  const recentReqUnitTotals = {};
  const recentDispUnitTotals = {};
  const recentRecUnitTotals = {};
  safeRecentRequests.forEach(r => {
    const u = r.unit || 'KG';
    recentReqUnitTotals[u] = (recentReqUnitTotals[u] || 0) + (Number(r.requested) || 0);
    recentDispUnitTotals[u] = (recentDispUnitTotals[u] || 0) + (Number(r.dispatched) || 0);
    recentRecUnitTotals[u] = (recentRecUnitTotals[u] || 0) + (Number(r.received) || 0);
  });
  const totalReqSummary = formatUnitSummary(recentReqUnitTotals, isTa);
  const totalDispSummary = formatUnitSummary(recentDispUnitTotals, isTa);
  const totalRecSummary = formatUnitSummary(recentRecUnitTotals, isTa);

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
    if (upper === 'DISPATCHED' || upper === 'DELIVERED') return 'Delivered';
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
  const PAGE_WIDTH_PX = 794;
  const PAGE_MIN_HEIGHT_PX = 1122;
  const pageEls = [];

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
            <td colspan="8" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; background: #ffffff;">
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
              <td style="padding: 7px 8px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 13.5px; width: 90px;">
                ${formatQuantityWithUnit(reqQty, rawUnit, isTa)}
              </td>
              <td style="padding: 7px 8px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #8c671b; font-size: 13.5px; width: 90px;">
                ${formatQuantityWithUnit(dispQty, rawUnit, isTa)}
              </td>
              <td style="padding: 7px 8px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 13.5px; width: 95px;">
                ${formatQuantityWithUnit(recQty, rawUnit, isTa)}
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
                <th style="padding: 9px 8px; text-align: right; font-size: 13px; font-weight: 700; border: 1px solid #003B2B; width: 90px;">
                  ${isTa ? 'கோரப்பட்ட அளவு' : 'Requested Quantity'}
                </th>
                <th style="padding: 9px 8px; text-align: right; font-size: 13px; font-weight: 700; border: 1px solid #003B2B; width: 90px;">
                  ${isTa ? 'விநியோகிக்கப்பட்ட அளவு' : 'Delivered Quantity'}
                </th>
                <th style="padding: 9px 8px; text-align: right; font-size: 13px; font-weight: 700; border: 1px solid #003B2B; width: 95px;">
                  ${isTa ? 'பெறப்பட்ட அளவு' : 'Received Quantity'}
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
                  <td colspan="4" style="padding: 9px 10px; text-align: right; font-size: 13.5px; border: 1px solid #E5DDC9;">
                    ${isTa ? ('மொத்தம் (' + totalCount + ' பதிவுகள்):') : ('Total (' + totalCount + ' Records):')}
                  </td>
                  <td style="padding: 9px 8px; text-align: right; font-size: 13px; font-weight: 800; color: #003B2B; border: 1px solid #E5DDC9;">
                    ${totalReqSummary}
                  </td>
                  <td style="padding: 9px 8px; text-align: right; font-size: 13px; font-weight: 800; color: #8c671b; border: 1px solid #E5DDC9;">
                    ${totalDispSummary}
                  </td>
                  <td style="padding: 9px 8px; text-align: right; font-size: 13px; font-weight: 800; color: #003B2B; border: 1px solid #E5DDC9;">
                    ${totalRecSummary}
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

      pageEls.push(pageEl);
    }

    return pageEls;
}

/**
 * Generates and downloads a clean, professional PDF of Recent Requests (Section B ONLY).
 */
export async function downloadBranchRecentRequestsPdf(options = {}) {
  await ensureTamilFontLoaded();
  const pageEls = buildBranchRecentRequestsPages(options);
  const pdf = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait'
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  container.style.zIndex = '-1000';
  document.body.appendChild(container);

  try {
    for (let pIdx = 0; pIdx < pageEls.length; pIdx++) {
      const pageEl = pageEls[pIdx];
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

    const cleanBranch = String(options.branchName || 'Branch').replace(/[^a-zA-Z0-9_-]/g, '_');
    const displayDate = options.date || new Date().toISOString().split('T')[0];
    const rangeSuffix = options.dateFilterLabel ? String(options.dateFilterLabel).replace(/[^a-zA-Z0-9_-]/g, '_') : String(displayDate).replace(/[^0-9-]/g, '');
    const fileName = `${cleanBranch}_Recent_Requests_${rangeSuffix}.pdf`;
    pdf.save(fileName);
    return true;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Direct Print for Recent Requests Submitted for Branch (Section B ONLY).
 * Immediately opens the native browser print dialog with POS 80mm monochrome thermal receipt layout.
 */
export async function printBranchRecentRequestsDirect(options = {}) {
  const {
    organisationName = 'Saravana Bhavan',
    branchName = 'Branch 1',
    branchManager = '',
    recentRequests = [],
    dateFilterLabel = '',
    language = 'ta'
  } = options;
  const isTa = language === 'ta';
  const safeRequests = Array.isArray(recentRequests) ? recentRequests : [];

  const columns = [
    { header: '#', key: '#', align: 'center', width: '20px' },
    { header: isTa ? 'பொருள்' : 'Item Name', key: 'itemName', align: 'left', render: r => isTa ? translateItemName(r.itemName) : r.itemName },
    { header: isTa ? 'துறை' : 'Dept', key: 'department', align: 'left', render: r => r.department || r.category || '—' },
    { header: isTa ? 'அளவு' : 'Qty', key: 'quantity', align: 'right', render: r => `${r.requestedQuantity || r.quantity || 0} ${cleanUnitName(r.unit || '')}` },
    { header: isTa ? 'நிலை' : 'Status', key: 'status', align: 'center', render: r => isTa ? translateStatusGlobal(r.dispatchStatus || r.status || 'Pending') : (r.dispatchStatus || r.status || 'Pending') }
  ];

  return printThermalReceipt({
    organisationName,
    branchName,
    title: isTa ? '*** சமீபத்திய கோரிக்கைகள் ***' : '*** RECENT BRANCH REQUESTS ***',
    dateLabel: dateFilterLabel || '',
    metadata: [
      { label: isTa ? 'கிளை' : 'Branch', value: branchName },
      branchManager ? { label: isTa ? 'மேலாளர்' : 'Manager', value: branchManager } : null
    ].filter(Boolean),
    columns,
    items: safeRequests,
    summaryRows: [
      { label: isTa ? 'மொத்த சமீபத்திய கோரிக்கைகள்:' : 'Total Recent Requests:', value: safeRequests.length, isTotal: true }
    ],
    footerNotes: [
      isTa ? '*** கோரிக்கை பதிவு சரிபார்க்கப்பட்டது ***' : '*** REQUEST LOG VERIFIED ***',
      'Annamithra Food Management',
      isTa ? '*** ரசீது முடிவு ***' : '*** END OF RECEIPT ***'
    ],
    language
  });
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
 * Escapes HTML special characters to prevent broken markup when interpolating user/API strings.
 */
function escapeHtml(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sums item quantities grouped cleanly by unit without hardcoding or mixing units.
 */
function accumulateUnitTotals(items, getVal) {
  const unitTotals = {};
  (Array.isArray(items) ? items : []).forEach(it => {
    if (!it) return;
    const key = cleanUnitName(it.unit || '');
    const val = Number(getVal(it)) || 0;
    unitTotals[key] = (unitTotals[key] || 0) + val;
  });
  return unitTotals;
}

/**
 * Helper to construct an offscreen HTML page container with standard Annamithra branding.
 */
function createReportPageEl({ title, subtitle, dateLabel, pageIndex, totalPages, isLandscape = false }) {
  const pageEl = document.createElement('div');
  pageEl.style.width = isLandscape ? '1122px' : '794px';
  pageEl.style.minHeight = isLandscape ? '794px' : '1122px';
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
            Annamithra — ${escapeHtml(title)}
          </h1>
        </div>
        <div style="text-align: right; font-size: 11.5px; color: #4A6B5F; font-weight: 600;">
          Generated: ${escapeHtml(genDateStr)}
        </div>
      </div>

      <!-- Gold Accent Line -->
      <div style="height: 3px; background: linear-gradient(90deg, #D4A63B, #F0D58A, #D4A63B); margin: 8px 0 14px 0; border-radius: 2px;"></div>

      <!-- Scope Card -->
      <div style="background: #FBF7EC; border: 1px solid #E5DDC9; border-radius: 6px; padding: 10px 16px; margin-bottom: 16px;">
        <div style="font-size: 13px; font-weight: 700; color: #003B2B; margin-bottom: 3px;">
          ${escapeHtml(subtitle)}
        </div>
        <div style="font-size: 11.5px; color: #5A6962; font-weight: 500;">
          Date Scope: ${escapeHtml(dateLabel || 'Today')}
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
  const safePages = Array.isArray(pages) ? pages : [];
  const pdf = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: isLandscape ? 'landscape' : 'portrait'
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const pagePxWidth = isLandscape ? 1122 : 794;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = `${pagePxWidth}px`;
  container.style.background = '#ffffff';
  container.style.zIndex = '-9999';
  document.body.appendChild(container);

  try {
    for (let pageIdx = 0; pageIdx < safePages.length; pageIdx++) {
      const pageEl = safePages[pageIdx];
      container.innerHTML = '';
      container.appendChild(pageEl);

      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0
      });

      const imgData = canvas.toDataURL('image/png');
      if (pageIdx > 0) {
        pdf.addPage('a4', isLandscape ? 'landscape' : 'portrait');
      }

      const imgAspect = canvas.width / Math.max(1, canvas.height);
      const pageAspect = pdfWidth / pdfHeight;
      let renderW = pdfWidth;
      let renderH = pdfHeight;
      if (imgAspect < pageAspect - 0.01) {
        renderH = pdfHeight;
        renderW = pdfHeight * imgAspect;
      }
      const offsetX = Math.max(0, (pdfWidth - renderW) / 2);
      pdf.addImage(imgData, 'PNG', offsetX, 0, renderW, renderH);
    }

    pdf.save(filename || 'Annamithra_Report.pdf');
    return true;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Renders an 80mm thermal receipt HTML into a dynamic-height POS thermal PDF.
 * Uses exact 80mm width (226.77 pt), avoids forced A4 dimensions and blank gaps,
 * starts immediately after the header, and preserves Tamil & Unicode fonts cleanly.
 */
export async function renderThermalReceiptToPdf(thermalOptions = {}, filename = 'Annamithra_Report.pdf') {
  await ensureTamilFontLoaded();

  // 1. Generate pure self-contained 80mm POS monochrome thermal receipt HTML
  const htmlContent = generateThermalReceiptHtml(thermalOptions);

  // 2. Create offscreen container directly in document.body
  // 80mm in 96 DPI CSS pixels is 80 * (96 / 25.4) = ~302.36 px. We use 302px width.
  const container = document.createElement('div');
  container.id = 'ann-thermal-pdf-temp-' + Date.now();
  container.style.position = 'fixed';
  container.style.top = '-99999px';
  container.style.left = '-99999px';
  container.style.width = '302px';
  container.style.maxWidth = '302px';
  container.style.background = '#ffffff';
  container.style.color = '#000000';
  container.style.boxSizing = 'border-box';
  container.style.margin = '0';
  container.style.padding = '0';
  container.style.zIndex = '-9999';

  // Extract <style> and .thermal-receipt-root
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;

  const styleEl = tempDiv.querySelector('style');
  if (styleEl) {
    container.appendChild(styleEl.cloneNode(true));
  }

  const rootEl = tempDiv.querySelector('.thermal-receipt-root') || tempDiv;
  rootEl.style.width = '100%';
  rootEl.style.maxWidth = '100%';
  rootEl.style.boxSizing = 'border-box';
  rootEl.style.padding = '6px 8px 12px 8px';
  rootEl.style.margin = '0';
  rootEl.style.background = '#ffffff';
  rootEl.style.color = '#000000';
  rootEl.style.fontFamily = "'Noto Sans Tamil', 'Outfit', 'Inter', 'Courier New', monospace, sans-serif";
  rootEl.style.webkitFontSmoothing = 'antialiased';

  container.appendChild(rootEl);
  document.body.appendChild(container);

  try {
    // Wait briefly for font rendering & layout calculation
    await new Promise(resolve => setTimeout(resolve, 100));

    // Render using html2canvas with scale: 2 for retina sharpness
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0
    });

    // 80mm in PDF points: (80 / 25.4) * 72 = ~226.77 pt
    const pdfWidthPt = (80 / 25.4) * 72;
    // Calculate total dynamic height in pt
    const totalHeightPt = (canvas.height / canvas.width) * pdfWidthPt;

    // Up to 5000 pt (approx 1.76 meters) is supported in a single continuous page.
    const MAX_PAGE_HEIGHT_PT = 5000;

    if (totalHeightPt <= MAX_PAGE_HEIGHT_PT) {
      // Single continuous dynamic-height 80mm PDF
      const pdf = new jsPDF({
        unit: 'pt',
        format: [pdfWidthPt, Math.max(120, totalHeightPt)]
      });
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidthPt, totalHeightPt);
      pdf.save(filename);
    } else {
      // Clean multi-page 80mm pagination without blank gaps
      const totalPages = Math.ceil(totalHeightPt / MAX_PAGE_HEIGHT_PT);
      const chunkCanvasHeight = Math.floor(canvas.height / totalPages);

      const pdf = new jsPDF({
        unit: 'pt',
        format: [pdfWidthPt, MAX_PAGE_HEIGHT_PT]
      });

      for (let p = 0; p < totalPages; p++) {
        const sourceY = p * chunkCanvasHeight;
        const currentChunkHeight = Math.min(chunkCanvasHeight, canvas.height - sourceY);
        const currentChunkHeightPt = (currentChunkHeight / canvas.width) * pdfWidthPt;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = currentChunkHeight;
        const ctx = pageCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, sourceY, canvas.width, currentChunkHeight, 0, 0, canvas.width, currentChunkHeight);

        if (p > 0) {
          pdf.addPage([pdfWidthPt, currentChunkHeightPt]);
        }
        pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidthPt, currentChunkHeightPt);
      }
      pdf.save(filename);
    }

    return true;
  } catch (err) {
    console.error('Failed to render thermal receipt PDF:', err);
    throw err;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * 1. Simple Inventory Report PDF
 * Columns: Item Name, Available Stock, Last Updated Date
 */
export function buildSimpleInventoryPages({ items = [], dateLabel = 'Today' } = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const ITEMS_PER_PAGE = 14;
  const totalPages = Math.max(1, Math.ceil(safeItems.length / ITEMS_PER_PAGE));
  const invStockUnitTotals = accumulateUnitTotals(safeItems, it => it.currentStock);
  const summaryStockStr = formatUnitSummary(invStockUnitTotals, false);
  const subtitle = `Total Items: ${safeItems.length}   |   Total Central Stock: ${summaryStockStr}`;

  const pages = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const startIdx = pageIdx * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, safeItems.length);
    const pageRows = safeItems.slice(startIdx, endIdx);
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
    if (safeItems.length === 0) {
      tableRowsHtml = `
        <tr>
          <td colspan="4" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; font-size: 14px;">
            No inventory records found matching the selected filter criteria.
          </td>
        </tr>
      `;
    } else {
      pageRows.forEach((it, i) => {
        const rowIdx = startIdx + i + 1;
        const bg = (rowIdx % 2 === 0) ? '#FCFAF3' : '#ffffff';
        const itemDisplay = escapeHtml(it.itemName || it.name || '—');
        const unitDisplay = cleanUnitName(it.unit || '');
        const stockVal = Number(it.currentStock) || 0;
        const dateDisplay = escapeHtml(it.formattedLastUpdated || it.lastUpdated || '—');

        tableRowsHtml += `
          <tr style="background: ${bg}; border-bottom: 1px solid #E5DDC9;">
            <td style="padding: 9px 10px; text-align: center; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 600; color: #5A6962; width: 42px;">
              ${rowIdx}
            </td>
            <td style="padding: 9px 12px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 14.5px; word-break: break-word;">
              ${itemDisplay}
            </td>
            <td style="padding: 9px 14px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 15px; width: 160px;">
              ${escapeHtml(formatQuantityWithUnit(stockVal, unitDisplay))}
            </td>
            <td style="padding: 9px 12px; text-align: center; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 500; color: #5A6962; width: 145px;">
              ${dateDisplay}
            </td>
          </tr>
        `;
      });
    }

    const summaryFooterHtml = isLastPage && safeItems.length > 0 ? `
      <tfoot>
        <tr style="background: #F5EFE0; border: 1.5px solid #D4A63B; font-weight: 700; color: #003B2B;">
          <td colspan="2" style="padding: 10px 14px; border: 1px solid #E5DDC9; font-size: 16px; font-weight: 700;">
            Total Items: ${safeItems.length}
          </td>
          <td style="padding: 10px 14px; text-align: right; border: 1px solid #E5DDC9; font-size: 15.5px; font-weight: 800; color: #003B2B;">
            ${escapeHtml(summaryStockStr)}
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
              <th style="padding: 11px 14px; text-align: right; font-size: 15.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 160px;">Available Stock</th>
              <th style="padding: 11px 12px; text-align: center; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 160px;">Last Updated</th>
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

  return pages;
}

export async function downloadSimpleInventoryPdf({ items = [], dateLabel = 'Today', filename } = {}) {
  const pages = buildSimpleInventoryPages({ items, dateLabel });
  const defaultFilename = `Annamithra_Inventory_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  return await renderHtmlPagesToPdf({ pages, filename: filename || defaultFilename, orientation: 'portrait' });
}

export async function printSimpleInventoryReport({ items = [], dateLabel = 'Today', language = 'en' } = {}) {
  const isTa = language === 'ta';
  const safeItems = Array.isArray(items) ? items : [];
  const invUnitTotals = accumulateUnitTotals(safeItems, it => it.stock || it.currentStock);
  const summaryInvStr = formatUnitSummary(invUnitTotals, false);

  const columns = [
    { header: '#', key: '#', align: 'center', width: '22px' },
    { header: isTa ? 'பொருள்' : 'Item Name', key: 'name', align: 'left', render: r => {
      const raw = String(r.itemName || r.name || '—').trim();
      return isTa ? translateItemName(raw) : raw;
    }},
    { header: isTa ? 'பிரிவு' : 'Category', key: 'category', align: 'left', render: r => isTa ? translateCategoryGlobal(r.category || '') : (r.category || 'General') },
    { header: isTa ? 'இருப்பு' : 'Stock', key: 'stock', align: 'right', render: r => `${r.stock || r.currentStock || 0} ${cleanUnitName(r.unit || '')}` }
  ];

  const summaryRows = [
    { label: isTa ? 'மொத்த தனி பொருட்கள்:' : 'Total Unique Items:', value: safeItems.length, isBold: true },
    { label: isTa ? 'மொத்த இருப்பு:' : 'Total Stock:', value: summaryInvStr, isTotal: true }
  ];

  return printThermalReceipt({
    organisationName: isTa ? 'அன்னமித்ரா உணவு மேலாண்மை' : 'Annamithra Food Management',
    branchName: isTa ? 'மத்திய சேமிப்பக இருப்பு' : 'Central Store Inventory',
    title: isTa ? '*** நடப்பு இருப்பு அறிக்கை ***' : '*** CURRENT INVENTORY REPORT ***',
    dateLabel,
    metadata: [
      { label: isTa ? 'அறிக்கை நோக்கம்' : 'Scope', value: isTa ? 'மத்திய கிடங்கு இருப்பு' : 'Central Inventory Stock' }
    ],
    columns,
    items: safeItems,
    summaryRows,
    footerNotes: [
      isTa ? '*** இருப்பு சரிபார்க்கப்பட்டது ***' : '*** STOCK AUDIT VERIFIED ***',
      'Annamithra POS System',
      isTa ? '*** அறிக்கை முடிவு ***' : '*** END OF REPORT ***'
    ],
    language
  });
}

/**
 * 2. Simple Branch Request Report PDF
 * Supports Consolidated View (Item, Total Quantity, Unit) and Department-wise View (Department, Item, Total Quantity, Unit)
 */
export function buildSimpleBranchRequestPages({ items = [], branch = 'All Branches', department = 'All Departments', dateLabel = 'Today', departmentBreakdown = false } = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const ITEMS_PER_PAGE = 16;
  const totalPages = Math.max(1, Math.ceil(safeItems.length / ITEMS_PER_PAGE));
  const branchReqUnitTotals = accumulateUnitTotals(safeItems, it => it.requestedQuantity ?? it.requested);
  const summaryBranchReqStr = formatUnitSummary(branchReqUnitTotals, false);
  const deptPart = department && department !== 'All Departments' ? `   |   Dept: ${department}` : '';
  const viewTitle = departmentBreakdown ? 'Department-wise View' : 'Consolidated View';
  const subtitle = `Branch: ${branch || 'All Branches'}${deptPart}   |   ${viewTitle}   |   ${departmentBreakdown ? 'Total Rows' : 'Total Unique Items'}: ${safeItems.length}   |   Total Quantity: ${summaryBranchReqStr}`;

  const pages = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const startIdx = pageIdx * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, safeItems.length);
    const pageRows = safeItems.slice(startIdx, endIdx);
    const isLastPage = pageIdx === totalPages - 1;

    const { pageEl, headerHtml, footerHtml } = createReportPageEl({
      title: `Branch Request Report — ${viewTitle}`,
      subtitle,
      dateLabel,
      pageIndex: pageIdx,
      totalPages,
      isLandscape: false
    });

    let tableRowsHtml = '';
    const colCount = departmentBreakdown ? 5 : 4;
    if (safeItems.length === 0) {
      tableRowsHtml = `
        <tr>
          <td colspan="${colCount}" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; font-size: 14px;">
            No branch request records found matching the selected filter criteria.
          </td>
        </tr>
      `;
    } else {
      pageRows.forEach((it, i) => {
        const rowIdx = startIdx + i + 1;
        const bg = (rowIdx % 2 === 0) ? '#FCFAF3' : '#ffffff';
        const deptName = escapeHtml(it.department || it.departmentName || it.category || 'Not specified');
        const itName = escapeHtml(it.itemName || it.item || '—');
        const unitName = cleanUnitName(it.unit || '');
        const reqVal = Number(it.requestedQuantity ?? it.requested) || 0;

        tableRowsHtml += `
          <tr style="background: ${bg}; border-bottom: 1px solid #E5DDC9;">
            <td style="padding: 9px 8px; text-align: center; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 600; color: #5A6962; width: 45px;">
              ${rowIdx}
            </td>
            ${departmentBreakdown ? `
            <td style="padding: 9px 12px; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 600; color: #17352B; width: 160px; word-break: break-word;">
              ${deptName}
            </td>
            ` : ''}
            <td style="padding: 9px 12px; border: 1px solid #E5DDC9; font-weight: 700; color: #17352B; font-size: 14.5px; word-break: break-word;">
              ${itName}
            </td>
            <td style="padding: 9px 14px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 14.5px; width: 140px;">
              ${Number(reqVal).toLocaleString()}
            </td>
            <td style="padding: 9px 12px; text-align: left; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 600; color: #5A6962; width: 100px;">
              ${unitName}
            </td>
          </tr>
        `;
      });
    }

    const summaryFooterHtml = isLastPage && safeItems.length > 0 ? `
      <tfoot>
        <tr style="background: #F5EFE0; border: 1.5px solid #D4A63B; font-weight: 700; color: #003B2B;">
          <td colspan="${departmentBreakdown ? 3 : 2}" style="padding: 10px 12px; border: 1px solid #E5DDC9; font-size: 14.5px; font-weight: 700;">
            Total: ${safeItems.length} ${departmentBreakdown ? 'rows' : 'unique items'}
          </td>
          <td style="padding: 10px 14px; text-align: right; border: 1px solid #E5DDC9; font-size: 15px; font-weight: 800; color: #003B2B;">
            ${escapeHtml(summaryBranchReqStr)}
          </td>
          <td style="padding: 10px 12px; text-align: left; border: 1px solid #E5DDC9; font-size: 13px; font-weight: 600; color: #5A6962;">
            Grand Total
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
              <th style="padding: 10px 8px; text-align: center; font-size: 14px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 45px;">#</th>
              ${departmentBreakdown ? `
              <th style="padding: 10px 12px; text-align: left; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 160px;">Department</th>
              ` : ''}
              <th style="padding: 10px 12px; text-align: left; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9;">Item Name</th>
              <th style="padding: 10px 14px; text-align: right; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 140px;">Total Quantity</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 14px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 100px;">Unit</th>
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

  return pages;
}

export function buildSimpleBranchRequestThermalOptions({
  items = [],
  branch = 'All Branches',
  department = 'All Departments',
  dateLabel = 'Today',
  departmentBreakdown = false,
  language = 'en'
} = {}) {
  const isTa = language === 'ta';
  const safeItems = Array.isArray(items) ? items : [];
  const branchReqUnitTotals = accumulateUnitTotals(safeItems, it => it.totalQuantity ?? it.requestedQuantity ?? it.quantity ?? it.requested);
  const summaryBranchReqStr = formatUnitSummary(branchReqUnitTotals, false);

  const viewTitle = departmentBreakdown
    ? (isTa ? 'துறை வாரியான விவரம்' : 'Department-wise Breakdown')
    : (isTa ? 'ஒருங்கிணைந்த பட்டியல்' : 'Consolidated View');

  const metadata = [
    { label: isTa ? 'கிளை' : 'Branch', value: branch || (isTa ? 'அனைத்து கிளைகள்' : 'All Branches') },
    department && department !== 'All Departments' ? { label: isTa ? 'துறை' : 'Department', value: department } : null,
    { label: isTa ? 'பார்வை' : 'View Mode', value: viewTitle }
  ].filter(Boolean);

  const columns = departmentBreakdown ? [
    { header: '#', key: '#', align: 'center', width: '20px' },
    { header: isTa ? 'துறை' : 'Dept', key: 'department', align: 'left', render: r => r.department || r.category || 'General' },
    { header: isTa ? 'பொருள்' : 'Item Name', key: 'itemName', align: 'left', render: r => {
      const raw = String(r.itemName || r.name || '—').trim();
      return isTa ? translateItemName(raw) : raw;
    }},
    { header: isTa ? 'அளவு' : 'Qty', key: 'quantity', align: 'right', render: r => `${r.totalQuantity ?? r.requestedQuantity ?? r.quantity ?? 0} ${cleanUnitName(r.unit || '')}` }
  ] : [
    { header: '#', key: '#', align: 'center', width: '22px' },
    { header: isTa ? 'பொருள் பெயர்' : 'Item Name', key: 'itemName', align: 'left', render: r => {
      const raw = String(r.itemName || r.name || '—').trim();
      return isTa ? translateItemName(raw) : raw;
    }},
    { header: isTa ? 'மொத்த அளவு' : 'Total Qty', key: 'quantity', align: 'right', render: r => `${r.totalQuantity ?? r.requestedQuantity ?? r.quantity ?? 0} ${cleanUnitName(r.unit || '')}` }
  ];

  const summaryRows = [
    { label: departmentBreakdown ? (isTa ? 'மொத்த வரிகள்:' : 'Total Rows:') : (isTa ? 'மொத்த தனி பொருட்கள்:' : 'Total Unique Items:'), value: safeItems.length, isBold: true },
    { label: isTa ? 'மொத்த கோரிக்கை அளவு:' : 'Total Requested Qty:', value: summaryBranchReqStr, isTotal: true }
  ];

  return {
    organisationName: isTa ? 'அன்னமித்ரா உணவு மேலாண்மை' : 'Annamithra Food Management',
    branchName: branch || (isTa ? 'அனைத்து கிளைகள்' : 'All Branches'),
    title: isTa ? '*** கிளை கோரிக்கை அறிக்கை ***' : '*** BRANCH REQUEST REPORT ***',
    subtitle: viewTitle,
    dateLabel,
    metadata,
    columns,
    items: safeItems,
    summaryRows,
    footerNotes: [
      isTa ? '*** கிளை கோரிக்கை ஆவணம் ***' : '*** BRANCH REQUEST DOCUMENT ***',
      'Annamithra POS System',
      isTa ? '*** அறிக்கை முடிவு ***' : '*** END OF REPORT ***'
    ],
    language
  };
}

export async function downloadSimpleBranchRequestPdf({ items = [], branch = 'All Branches', department = 'All Departments', dateLabel = 'Today', filename, departmentBreakdown = false, language = 'en' } = {}) {
  const thermalOptions = buildSimpleBranchRequestThermalOptions({ items, branch, department, dateLabel, departmentBreakdown, language });
  const defaultFilename = `Annamithra_Branch_Request_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  return renderThermalReceiptToPdf(thermalOptions, filename || defaultFilename);
}

export async function printSimpleBranchRequestReport(options = {}) {
  const thermalOptions = buildSimpleBranchRequestThermalOptions(options);
  return printThermalReceipt(thermalOptions);
}

/**
 * 3. Simple Dispatch Report PDF
 * Columns: #, Branch Name, Department, Item Name, Dispatched Quantity, Dispatch Date, Acknowledgement Status
 */
export function buildSimpleDispatchPages({ items = [], branch = 'All Branches', department = 'All Departments', dateLabel = 'Today' } = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const ITEMS_PER_PAGE = 14;
  const totalPages = Math.max(1, Math.ceil(safeItems.length / ITEMS_PER_PAGE));
  const branchDispUnitTotals = accumulateUnitTotals(safeItems, it => it.dispatchedQuantity ?? it.quantity);
  const summaryBranchDispStr = formatUnitSummary(branchDispUnitTotals, false);
  const deptPart = department && department !== 'All Departments' ? `   |   Dept: ${department}` : '';
  const subtitle = `Branch: ${branch || 'All Branches'}${deptPart}   |   Total Deliveries: ${safeItems.length}   |   Total Delivered: ${summaryBranchDispStr}`;

  const pages = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const startIdx = pageIdx * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, safeItems.length);
    const pageRows = safeItems.slice(startIdx, endIdx);
    const isLastPage = pageIdx === totalPages - 1;

    const { pageEl, headerHtml, footerHtml } = createReportPageEl({
      title: 'Delivery Report',
      subtitle,
      dateLabel,
      pageIndex: pageIdx,
      totalPages,
      isLandscape: false
    });

    let tableRowsHtml = '';
    if (safeItems.length === 0) {
      tableRowsHtml = `
        <tr>
          <td colspan="7" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; font-size: 14px;">
            No delivery records found matching the selected filter criteria.
          </td>
        </tr>
      `;
    } else {
      pageRows.forEach((it, i) => {
        const rowIdx = startIdx + i + 1;
        const bg = (rowIdx % 2 === 0) ? '#FCFAF3' : '#ffffff';
        const brName = escapeHtml(it.branchName || it.branch || '—');
        const deptName = escapeHtml(it.department || it.departmentName || it.category || 'Not specified');
        const itName = escapeHtml(it.itemName || it.item || '—');
        const unitName = cleanUnitName(it.unit || '');
        const dispVal = Number(it.dispatchedQuantity ?? it.quantity) || 0;
        const dateDisplay = escapeHtml(it.formattedDate || it.dispatchDate || '—');
        const ackSt = escapeHtml(it.meaningfulStatus || it.acknowledgementStatus || it.status || '—');

        tableRowsHtml += `
          <tr style="background: ${bg}; border-bottom: 1px solid #E5DDC9;">
            <td style="padding: 9px 6px; text-align: center; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 600; color: #5A6962; width: 34px;">
              ${rowIdx}
            </td>
            <td style="padding: 9px 8px; border: 1px solid #E5DDC9; font-weight: 700; color: #17352B; font-size: 14.5px; width: 115px; word-break: break-word;">
              ${brName}
            </td>
            <td style="padding: 9px 8px; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 500; color: #5A6962; width: 100px; word-break: break-word;">
              ${deptName}
            </td>
            <td style="padding: 9px 10px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 14.5px; word-break: break-word;">
              ${itName}
            </td>
            <td style="padding: 9px 10px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 14.5px; width: 120px;">
              ${escapeHtml(formatQuantityWithUnit(dispVal, unitName))}
            </td>
            <td style="padding: 9px 8px; text-align: center; border: 1px solid #E5DDC9; font-size: 13px; font-weight: 500; color: #5A6962; width: 85px;">
              ${dateDisplay}
            </td>
            <td style="padding: 9px 8px; text-align: center; border: 1px solid #E5DDC9; width: 90px;">
              <span style="background: #F5EFE0; border: 1px solid #E5DDC9; padding: 3px 6px; border-radius: 4px; font-weight: 700; font-size: 12px; color: #17352B; display: inline-block;">
                ${ackSt}
              </span>
            </td>
          </tr>
        `;
      });
    }

    const summaryFooterHtml = isLastPage && safeItems.length > 0 ? `
      <tfoot>
        <tr style="background: #F5EFE0; border: 1.5px solid #D4A63B; font-weight: 700; color: #003B2B;">
          <td colspan="4" style="padding: 10px 12px; border: 1px solid #E5DDC9; font-size: 15.5px; font-weight: 700;">
            Total Deliveries: ${safeItems.length}
          </td>
          <td style="padding: 10px 10px; text-align: right; border: 1px solid #E5DDC9; font-size: 15px; font-weight: 800; color: #003B2B;">
            ${escapeHtml(summaryBranchDispStr)}
          </td>
          <td colspan="2" style="padding: 10px 10px; text-align: center; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 600; color: #5A6962;">
            Grand Delivered Total
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
              <th style="padding: 10px 6px; text-align: center; font-size: 14px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 34px;">#</th>
              <th style="padding: 10px 8px; text-align: left; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 115px;">Branch Name</th>
              <th style="padding: 10px 8px; text-align: left; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 100px;">Department</th>
              <th style="padding: 10px 10px; text-align: left; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9;">Item Name</th>
              <th style="padding: 10px 10px; text-align: right; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 120px;">Delivered Quantity</th>
              <th style="padding: 10px 8px; text-align: center; font-size: 14px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 85px;">Date</th>
              <th style="padding: 10px 8px; text-align: center; font-size: 14px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 90px;">Status</th>
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

  return pages;
}

export async function downloadSimpleDispatchPdf({ items = [], branch = 'All Branches', department = 'All Departments', dateLabel = 'Today', filename } = {}) {
  const pages = buildSimpleDispatchPages({ items, branch, department, dateLabel });
  const defaultFilename = `Annamithra_Delivery_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  return await renderHtmlPagesToPdf({ pages, filename: filename || defaultFilename, orientation: 'portrait' });
}

export async function printSimpleDispatchReport({
  items = [],
  branch = 'All Branches',
  department = 'All Departments',
  dateLabel = 'Today',
  language = 'en'
} = {}) {
  const isTa = language === 'ta';
  const safeItems = Array.isArray(items) ? items : [];
  const branchDispUnitTotals = accumulateUnitTotals(safeItems, it => it.dispatchedQuantity ?? it.quantity);
  const summaryBranchDispStr = formatUnitSummary(branchDispUnitTotals, false);

  const metadata = [
    { label: isTa ? 'கிளை' : 'Branch', value: branch || (isTa ? 'அனைத்து கிளைகள்' : 'All Branches') },
    department && department !== 'All Departments' ? { label: isTa ? 'துறை' : 'Department', value: department } : null
  ].filter(Boolean);

  const columns = [
    { header: '#', key: '#', align: 'center', width: '20px' },
    { header: isTa ? 'பொருள்' : 'Item', key: 'itemName', align: 'left', render: r => {
      const raw = String(r.itemName || r.name || '—').trim();
      return isTa ? translateItemName(raw) : raw;
    }},
    { header: isTa ? 'கிளை' : 'Branch', key: 'branchName', align: 'left', render: r => r.branchName || r.branch || '—' },
    { header: isTa ? 'துறை' : 'Dept', key: 'department', align: 'left', render: r => r.department || r.departmentName || '—' },
    { header: isTa ? 'அளவு' : 'Qty', key: 'dispatchedQuantity', align: 'right', render: r => `${r.dispatchedQuantity ?? r.quantity ?? 0} ${cleanUnitName(r.unit || '')}` }
  ];

  const summaryRows = [
    { label: isTa ? 'மொத்த விநியோகங்கள்:' : 'Total Deliveries:', value: safeItems.length, isBold: true },
    { label: isTa ? 'மொத்த விநியோகித்த அளவு:' : 'Total Delivered Qty:', value: summaryBranchDispStr, isTotal: true }
  ];

  return printThermalReceipt({
    organisationName: isTa ? 'அன்னமித்ரா உணவு மேலாண்மை' : 'Annamithra Food Management',
    branchName: isTa ? 'மத்திய கிடங்கு விநியோகம்' : 'Central Store Delivery',
    title: isTa ? '*** விநியோக அறிக்கை ***' : '*** DELIVERY REPORT ***',
    dateLabel,
    metadata,
    columns,
    items: safeItems,
    summaryRows,
    footerNotes: [
      isTa ? '*** பொருட்கள் விநியோகிக்கப்பட்டது சரிபார்க்கப்பட்டது ***' : '*** DELIVERY VERIFIED ***',
      'Annamithra POS System',
      isTa ? '*** அறிக்கை முடிவு ***' : '*** END OF REPORT ***'
    ],
    language
  });
}

/**
 * 4. Category-Wise Summary Report PDF & Direct Print
 * Columns: Category, Total Items, Requested Quantity, Dispatched Quantity, Pending Quantity
 * Accurately renders English, Tamil, and Bilingual Unicode Categories.
 */
export function buildCategorySummaryPages({
  summary = [],
  branch = 'All Branches',
  department = 'All Departments',
  category = 'All Categories',
  dateLabel = 'Today'
} = {}) {
  const safeSummary = Array.isArray(summary) ? summary : [];
  const ITEMS_PER_PAGE = 14;
  const totalPages = Math.max(1, Math.ceil(safeSummary.length / ITEMS_PER_PAGE));

  const subtitle = `Branch: ${branch}   |   Dept: ${department}   |   Categories: ${safeSummary.length}`;
  const pages = [];

  const totalDistinctItems = safeSummary.reduce((sum, r) => sum + (Number(r.totalItems) || 0), 0);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const startIdx = pageIdx * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, safeSummary.length);
    const pageRows = safeSummary.slice(startIdx, endIdx);
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
    if (safeSummary.length === 0) {
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
        const cName = escapeHtml(row.category || 'Uncategorised');
        const reqStr = escapeHtml(formatUnitSummary(row.requestedByUnit, false, '0'));
        const dispStr = escapeHtml(formatUnitSummary(row.dispatchedByUnit, false, '0'));
        const pendStr = escapeHtml(formatUnitSummary(row.pendingByUnit, false, '0'));

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
            <td style="padding: 9px 12px; text-align: right; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 14.5px; width: 125px;">
              ${reqStr}
            </td>
            <td style="padding: 9px 12px; text-align: right; border: 1px solid #E5DDC9; font-weight: 600; color: #07543D; font-size: 14.5px; width: 125px;">
              ${dispStr}
            </td>
            <td style="padding: 9px 12px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 14.5px; width: 125px;">
              ${pendStr}
            </td>
          </tr>
        `;
      });
    }

    const summaryFooterHtml = isLastPage && safeSummary.length > 0 ? `
      <tfoot>
        <tr style="background: #F5EFE0; border: 1.5px solid #D4A63B; font-weight: 700; color: #003B2B;">
          <td colspan="2" style="padding: 10px 14px; border: 1px solid #E5DDC9; font-size: 16px; font-weight: 700;">
            Total Categories: ${safeSummary.length}
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
              <th style="padding: 11px 12px; text-align: right; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 125px;">Requested Quantity</th>
              <th style="padding: 11px 12px; text-align: right; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 125px;">Delivered Quantity</th>
              <th style="padding: 11px 12px; text-align: right; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 125px;">Pending Quantity</th>
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

  return pages;
}

export async function downloadCategorySummaryPdf(options = {}) {
  const pages = buildCategorySummaryPages(options);
  const defaultFilename = `Annamithra_Category_Summary_${new Date().toISOString().slice(0, 10)}.pdf`;
  return await renderHtmlPagesToPdf({ pages, filename: options.filename || defaultFilename, orientation: 'portrait' });
}

export async function printCategorySummaryReport(options = {}) {
  const {
    summary = [],
    branch = 'All Branches',
    department = 'All Departments',
    category = 'All Categories',
    dateLabel = 'Today',
    language = 'en'
  } = options;
  const isTa = language === 'ta';
  const safeSummary = Array.isArray(summary) ? summary : [];
  const totalDistinctItems = safeSummary.reduce((sum, r) => sum + (Number(r.totalItems) || 0), 0);

  const columns = [
    { header: '#', key: '#', align: 'center', width: '20px' },
    { header: isTa ? 'வகை' : 'Category', key: 'category', align: 'left', render: r => isTa ? translateCategoryGlobal(r.category || 'Uncategorised') : (r.category || 'Uncategorised') },
    { header: isTa ? 'பொருட்கள்' : 'Items', key: 'totalItems', align: 'center' },
    { header: isTa ? 'கோரியவை' : 'Req', key: 'req', align: 'right', render: r => formatUnitSummary(r.requestedByUnit, false, '0') },
    { header: isTa ? 'விநியோகம்' : 'Delivered', key: 'disp', align: 'right', render: r => formatUnitSummary(r.dispatchedByUnit, false, '0') }
  ];

  const summaryRows = [
    { label: isTa ? 'மொத்த வகைகள்:' : 'Total Categories:', value: safeSummary.length, isBold: true },
    { label: isTa ? 'தனித்துவ பொருட்கள்:' : 'Distinct Items:', value: totalDistinctItems, isTotal: true }
  ];

  return printThermalReceipt({
    organisationName: isTa ? 'அன்னமித்ரா உணவு மேலாண்மை' : 'Annamithra Food Management',
    branchName: branch || (isTa ? 'அனைத்து கிளைகள்' : 'All Branches'),
    title: isTa ? '*** வகை வாரியான சுருக்கம் ***' : '*** CATEGORY SUMMARY REPORT ***',
    dateLabel,
    metadata: [
      { label: isTa ? 'கிளை' : 'Branch', value: branch },
      { label: isTa ? 'துறை' : 'Department', value: department }
    ],
    columns,
    items: safeSummary,
    summaryRows,
    footerNotes: [
      isTa ? '*** வகை சுருக்கம் ***' : '*** CATEGORY SUMMARY ***',
      'Annamithra POS System',
      isTa ? '*** அறிக்கை முடிவு ***' : '*** END OF REPORT ***'
    ],
    language
  });
}

/**
 * 5. Category Details Report PDF & Direct Print (Item-level)
 * Accurately renders English, Tamil, and Bilingual Unicode Categories and Item Names.
 */
export function buildCategoryDetailPages({
  categoryName = 'Category',
  items = [],
  branch = 'All Branches',
  department = 'All Departments',
  dateLabel = 'Today'
} = {}) {
  const safeItems = Array.isArray(items) ? items : [];
  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(safeItems.length / ITEMS_PER_PAGE));
  const catDetailReqUnitTotals = accumulateUnitTotals(safeItems, it => it.requestedQuantity);
  const catDetailDispUnitTotals = accumulateUnitTotals(safeItems, it => it.dispatchedQuantity);
  const catDetailPendUnitTotals = accumulateUnitTotals(safeItems, it => it.pendingQuantity);
  const summaryCatReqStr = formatUnitSummary(catDetailReqUnitTotals, false);
  const summaryCatDispStr = formatUnitSummary(catDetailDispUnitTotals, false);
  const summaryCatPendStr = formatUnitSummary(catDetailPendUnitTotals, false);

  const subtitle = `Category: ${categoryName}   |   Branch: ${branch}   |   Dept: ${department}   |   Items: ${safeItems.length}`;
  const pages = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const startIdx = pageIdx * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, safeItems.length);
    const pageRows = safeItems.slice(startIdx, endIdx);
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
    if (safeItems.length === 0) {
      tableRowsHtml = `
        <tr>
          <td colspan="10" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; font-size: 14px;">
            No items found matching the selected filter criteria.
          </td>
        </tr>
      `;
    } else {
      pageRows.forEach((it, i) => {
        const rowIdx = startIdx + i + 1;
        const bg = (rowIdx % 2 === 0) ? '#FCFAF3' : '#ffffff';
        const iName = escapeHtml(it.itemName || '—');
        const bName = escapeHtml(it.branchName || '—');
        const dName = escapeHtml(it.department || it.departmentName || 'Not specified');
        const rDateStr = escapeHtml(it.requestDate || '—');
        const dDateStr = escapeHtml(it.dispatchDate || '—');
        const st = escapeHtml(it.dispatchStatus || it.status || 'Pending');

        tableRowsHtml += `
          <tr style="background: ${bg}; border-bottom: 1px solid #E5DDC9;">
            <td style="padding: 8px 6px; text-align: center; border: 1px solid #E5DDC9; font-size: 13px; font-weight: 600; color: #5A6962; width: 34px;">
              ${rowIdx}
            </td>
            <td style="padding: 8px 8px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 14.5px; width: 190px; word-break: break-word;">
              ${iName}
            </td>
            <td style="padding: 8px 8px; border: 1px solid #E5DDC9; font-weight: 700; color: #17352B; font-size: 15px; width: 125px; word-break: break-word;">
              ${bName}
            </td>
            <td style="padding: 8px 8px; border: 1px solid #E5DDC9; font-size: 14px; font-weight: 500; color: #5A6962; width: 110px; word-break: break-word;">
              ${dName}
            </td>
            <td style="padding: 8px 8px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 15px; width: 100px;">
              ${escapeHtml(formatQuantityWithUnit(it.requestedQuantity, it.unit))}
            </td>
            <td style="padding: 8px 8px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #07543D; font-size: 15px; width: 100px;">
              ${escapeHtml(formatQuantityWithUnit(it.dispatchedQuantity, it.unit))}
            </td>
            <td style="padding: 8px 8px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 15px; width: 100px;">
              ${escapeHtml(formatQuantityWithUnit(it.pendingQuantity, it.unit))}
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

    const summaryFooterHtml = isLastPage && safeItems.length > 0 ? `
      <tfoot>
        <tr style="background: #F5EFE0; border: 1.5px solid #D4A63B; font-weight: 700; color: #003B2B;">
          <td colspan="4" style="padding: 9px 10px; border: 1px solid #E5DDC9; font-size: 15.5px; font-weight: 700;">
            Total Items: ${safeItems.length}
          </td>
          <td style="padding: 9px 8px; text-align: right; border: 1px solid #E5DDC9; font-size: 15px; font-weight: 800; color: #003B2B;">
            ${escapeHtml(summaryCatReqStr)}
          </td>
          <td style="padding: 9px 8px; text-align: right; border: 1px solid #E5DDC9; font-size: 15px; font-weight: 800; color: #07543D;">
            ${escapeHtml(summaryCatDispStr)}
          </td>
          <td style="padding: 9px 8px; text-align: right; border: 1px solid #E5DDC9; font-size: 15px; font-weight: 800; color: #003B2B;">
            ${escapeHtml(summaryCatPendStr)}
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
              <th style="padding: 9px 8px; text-align: left; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 190px;">Item Name</th>
              <th style="padding: 9px 8px; text-align: left; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 125px;">Branch</th>
              <th style="padding: 9px 8px; text-align: left; font-size: 14.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 110px;">Department</th>
              <th style="padding: 9px 8px; text-align: right; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 100px;">Requested Quantity</th>
              <th style="padding: 9px 8px; text-align: right; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 100px;">Delivered Quantity</th>
              <th style="padding: 9px 8px; text-align: right; font-size: 15px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 100px;">Pending Quantity</th>
              <th style="padding: 9px 6px; text-align: center; font-size: 14px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 85px;">Req Date</th>
              <th style="padding: 9px 6px; text-align: center; font-size: 14px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 85px;">Del Date</th>
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

  return pages;
}

export async function downloadCategoryDetailPdf(options = {}) {
  const pages = buildCategoryDetailPages(options);
  const cleanCategory = String(options.categoryName || 'Category').replace(/\s*\/\s*/g, '_').replace(/[/\\?%*:|"<>]/g, '_').trim().replace(/\s+/g, '_');
  const defaultFilename = `Annamithra_${cleanCategory}_Item_Details_${new Date().toISOString().slice(0, 10)}.pdf`;
  return await renderHtmlPagesToPdf({ pages, filename: options.filename || defaultFilename, orientation: 'landscape' });
}

export async function printCategoryDetailReport(options = {}) {
  const {
    categoryName = 'Category',
    items = [],
    branch = 'All Branches',
    department = 'All Departments',
    dateLabel = 'Today',
    language = 'en'
  } = options;
  const isTa = language === 'ta';
  const safeItems = Array.isArray(items) ? items : [];

  const columns = [
    { header: '#', key: '#', align: 'center', width: '20px' },
    { header: isTa ? 'பொருள்' : 'Item', key: 'itemName', align: 'left', render: r => {
      const raw = String(r.itemName || '—').trim();
      return isTa ? translateItemName(raw) : raw;
    }},
    { header: isTa ? 'கிளை' : 'Branch', key: 'branchName', align: 'left' },
    { header: isTa ? 'கோரியவை' : 'Req', key: 'requestedQuantity', align: 'right', render: r => `${r.requestedQuantity || 0} ${cleanUnitName(r.unit || '')}` },
    { header: isTa ? 'விநியோகம்' : 'Delivered', key: 'dispatchedQuantity', align: 'right', render: r => `${r.dispatchedQuantity || 0} ${cleanUnitName(r.unit || '')}` }
  ];

  const summaryRows = [
    { label: isTa ? 'மொத்த பொருட்கள்:' : 'Total Items in Category:', value: safeItems.length, isTotal: true }
  ];

  return printThermalReceipt({
    organisationName: isTa ? 'அன்னமித்ரா உணவு மேலாண்மை' : 'Annamithra Food Management',
    branchName: branch || (isTa ? 'அனைத்து கிளைகள்' : 'All Branches'),
    title: isTa ? `*** பிரிவு: ${categoryName} ***` : `*** CATEGORY: ${categoryName.toUpperCase()} ***`,
    dateLabel,
    metadata: [
      { label: isTa ? 'கிளை' : 'Branch', value: branch },
      { label: isTa ? 'துறை' : 'Department', value: department }
    ],
    columns,
    items: safeItems,
    summaryRows,
    footerNotes: [
      isTa ? '*** பொருட்கள் விவரம் ***' : '*** ITEM DETAILS ***',
      'Annamithra POS System',
      isTa ? '*** அறிக்கை முடிவு ***' : '*** END OF REPORT ***'
    ],
    language
  });
}

/**
 * Downloads / Prints a high-fidelity PDF receipt for Vendor Inventory Entry.
 * Includes: Vendor Name, Entry Date, Received By, Brought By, Mode of Payment,
 * Item-wise table (Name, Category, Unit, Quantity, Unit Rate, Total Rate), and Grand Total.
 */
export function buildVendorInventoryEntryPages({
  vendorName = '',
  entryDate = '',
  paymentMode = 'CASH',
  receivedBy = '',
  broughtBy = '',
  items = [],
  grandTotal = 0,
  language = 'en'
} = {}) {
  const isTa = language === 'ta';
  const safeItems = Array.isArray(items) ? items : [];
  const ITEMS_PER_PAGE = 12;
  const totalPages = Math.max(1, Math.ceil(safeItems.length / ITEMS_PER_PAGE));
  const totalQtySum = safeItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const resolvedGrandTotal = (grandTotal !== undefined && grandTotal !== null && !isNaN(grandTotal))
    ? Number(grandTotal)
    : safeItems.reduce((sum, it) => sum + (Number(it.totalRate) || 0), 0);

  const pages = [];

  const genDateStr = new Date().toLocaleDateString(isTa ? 'ta-IN' : 'en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const paymentLabels = {
    CASH: isTa ? 'ரொக்கம்' : 'Cash',
    UPI: isTa ? 'யுபிஐ' : 'UPI',
    BANK_TRANSFER: isTa ? 'வங்கி பரிமாற்றம்' : 'Bank Transfer',
    CREDIT: isTa ? 'கடன்' : 'Credit'
  };
  const paymentModeLabel = paymentLabels[paymentMode] || paymentMode || 'Cash';

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const startIdx = pageIdx * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, safeItems.length);
    const pageRows = safeItems.slice(startIdx, endIdx);
    const isFirstPage = pageIdx === 0;
    const isLastPage = pageIdx === totalPages - 1;

    const pageEl = document.createElement('div');
    pageEl.style.width = '794px';
    pageEl.style.minHeight = '1122px';
    pageEl.style.padding = '32px 36px 28px 36px';
    pageEl.style.boxSizing = 'border-box';
    pageEl.style.background = '#ffffff';
    pageEl.style.fontFamily = "'Noto Sans Tamil', 'Inter', system-ui, -apple-system, sans-serif";
    pageEl.style.color = '#17352B';
    pageEl.style.display = 'flex';
    pageEl.style.flexDirection = 'column';
    pageEl.style.justifyContent = 'space-between';

    let tableRowsHtml = '';
    if (safeItems.length === 0) {
      tableRowsHtml = `
        <tr>
          <td colspan="6" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; font-size: 14px;">
            ${isTa ? 'எந்தப் பொருட்களும் சேர்க்கப்படவில்லை.' : 'No items added in this entry.'}
          </td>
        </tr>
      `;
    } else {
      pageRows.forEach((it, i) => {
        const rowIdx = startIdx + i + 1;
        const bg = (rowIdx % 2 === 0) ? '#FCFAF3' : '#ffffff';
        const rawName = String(it.itemName || it.name || '—').trim();
        const itemDisplay = escapeHtml(isTa ? translateItemName(rawName) : rawName);
        const unitDisplay = escapeHtml(cleanUnitName(it.unit || ''));
        const qtyVal = Number(it.quantity) || 0;
        const unitRateVal = Number(it.unitRate) || 0;
        const totalRateVal = Number(it.totalRate !== undefined ? it.totalRate : (qtyVal * unitRateVal)) || 0;

        tableRowsHtml += `
          <tr style="background: ${bg}; border-bottom: 1px solid #E5DDC9;">
            <td style="padding: 8px 10px; text-align: center; border: 1px solid #E5DDC9; font-size: 13px; font-weight: 600; color: #5A6962; width: 36px;">
              ${rowIdx}
            </td>
            <td style="padding: 8px 12px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 13.5px; word-break: break-word;">
              ${itemDisplay}
              ${it.category ? `<span style="font-size: 11px; color: #6D8B80; margin-left: 6px; font-weight: normal;">(${escapeHtml(it.category)})</span>` : ''}
            </td>
            <td style="padding: 8px 10px; text-align: center; border: 1px solid #E5DDC9; font-size: 12.5px; font-weight: 600; color: #333; width: 70px;">
              <span style="background: #EFEFEF; padding: 2px 6px; border-radius: 4px;">${unitDisplay}</span>
            </td>
            <td style="padding: 8px 12px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 13.5px; width: 95px;">
              ${escapeHtml(formatQuantityWithUnit(qtyVal, unitDisplay, isTa))}
            </td>
            <td style="padding: 8px 12px; text-align: right; border: 1px solid #E5DDC9; font-size: 13px; color: #333; width: 105px;">
              ₹ ${unitRateVal.toFixed(2)}
            </td>
            <td style="padding: 8px 12px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 13.5px; width: 115px;">
              ₹ ${totalRateVal.toFixed(2)}
            </td>
          </tr>
        `;
      });
    }

    const summaryFooterHtml = isLastPage && safeItems.length > 0 ? `
      <tfoot>
        <tr style="background: #F5EFE0; border: 1.5px solid #D4A63B; font-weight: 700; color: #003B2B;">
          <td colspan="3" style="padding: 10px 14px; border: 1px solid #E5DDC9; font-size: 14px; font-weight: 700;">
            ${isTa ? 'மொத்த பொருட்கள்' : 'Total Items'}: ${safeItems.length}
          </td>
          <td style="padding: 10px 12px; text-align: right; border: 1px solid #E5DDC9; font-size: 14px; font-weight: 700; color: #003B2B;">
            ${Math.round(totalQtySum * 1000) / 1000}
          </td>
          <td style="padding: 10px 12px; text-align: right; border: 1px solid #E5DDC9; font-size: 13px; font-weight: 700; color: #5A6962;">
            ${isTa ? 'மொத்தத் தொகை' : 'Grand Total'}
          </td>
          <td style="padding: 10px 12px; text-align: right; border: 1px solid #E5DDC9; font-size: 15px; font-weight: 800; color: #B45309;">
            ₹ ${resolvedGrandTotal.toFixed(2)}
          </td>
        </tr>
      </tfoot>
    ` : '';

    const metadataCardHtml = isFirstPage ? `
      <!-- Vendor & Entry Details Card -->
      <div style="background: #FBF7EC; border: 1.5px solid #D4A63B; border-radius: 8px; padding: 12px 18px; margin-bottom: 16px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px;">
          <div>
            <span style="color: #5A6962; font-weight: 600;">${isTa ? 'விற்பனையாளர் பெயர்' : 'Vendor Name'}:</span>
            <strong style="color: #003B2B; font-size: 14px; margin-left: 6px;">${escapeHtml(vendorName || '—')}</strong>
          </div>
          <div>
            <span style="color: #5A6962; font-weight: 600;">${isTa ? 'வரவு தேதி' : 'Entry Date'}:</span>
            <strong style="color: #003B2B; margin-left: 6px;">${escapeHtml(entryDate || '—')}</strong>
          </div>
          <div>
            <span style="color: #5A6962; font-weight: 600;">${isTa ? 'பணம் செலுத்தும் முறை' : 'Mode of Payment'}:</span>
            <span style="background: #E8F5E9; color: #1B5E20; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 12px; margin-left: 6px;">
              ${escapeHtml(paymentModeLabel)}
            </span>
          </div>
          <div>
            <span style="color: #5A6962; font-weight: 600;">${isTa ? 'பெற்றவர்' : 'Received By'}:</span>
            <strong style="color: #17352B; margin-left: 6px;">${escapeHtml(receivedBy || '—')}</strong>
          </div>
          <div>
            <span style="color: #5A6962; font-weight: 600;">${isTa ? 'கொண்டு வந்தவர்' : 'Brought By'}:</span>
            <strong style="color: #17352B; margin-left: 6px;">${escapeHtml(broughtBy || '—')}</strong>
          </div>
          <div>
            <span style="color: #5A6962; font-weight: 600;">${isTa ? 'மொத்தத் தொகை' : 'Grand Total'}:</span>
            <strong style="color: #B45309; font-size: 15px; margin-left: 6px;">₹ ${resolvedGrandTotal.toFixed(2)}</strong>
          </div>
        </div>
      </div>
    ` : '';

    const contentHtml = `
      <div>
        <!-- Top Title Bar -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #003B2B; letter-spacing: 0.3px;">
              Annamithra — ${isTa ? 'விற்பனையாளர் இருப்பு வரவு ரசீது' : 'Vendor Inventory Receipt'}
            </h1>
          </div>
          <div style="text-align: right; font-size: 11.5px; color: #4A6B5F; font-weight: 600;">
            ${isTa ? 'உருவாக்கப்பட்டது' : 'Generated'}: ${escapeHtml(genDateStr)}
          </div>
        </div>

        <!-- Gold Accent Line -->
        <div style="height: 3px; background: linear-gradient(90deg, #D4A63B, #F0D58A, #D4A63B); margin: 6px 0 14px 0; border-radius: 2px;"></div>

        ${metadataCardHtml}

        <!-- Items Table -->
        <div style="margin-top: 4px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #003B2B; color: #ffffff;">
                <th style="padding: 9px 8px; text-align: center; border: 1px solid #002A1F; font-size: 12.5px; font-weight: 700; width: 36px;">#</th>
                <th style="padding: 9px 12px; text-align: left; border: 1px solid #002A1F; font-size: 12.5px; font-weight: 700;">${isTa ? 'பொருள் பெயர்' : 'Item Name'}</th>
                <th style="padding: 9px 10px; text-align: center; border: 1px solid #002A1F; font-size: 12.5px; font-weight: 700; width: 70px;">${isTa ? 'அலகு' : 'Unit'}</th>
                <th style="padding: 9px 12px; text-align: right; border: 1px solid #002A1F; font-size: 12.5px; font-weight: 700; width: 95px;">${isTa ? 'அளவு' : 'Quantity'}</th>
                <th style="padding: 9px 12px; text-align: right; border: 1px solid #002A1F; font-size: 12.5px; font-weight: 700; width: 105px;">${isTa ? 'அலகு விலை' : 'Unit Rate'} (₹)</th>
                <th style="padding: 9px 12px; text-align: right; border: 1px solid #002A1F; font-size: 12.5px; font-weight: 700; width: 115px;">${isTa ? 'மொத்த விலை' : 'Total Rate'} (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
            ${summaryFooterHtml}
          </table>
        </div>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid #E5DDC9; padding-top: 10px; margin-top: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #6D8B80;">
        <div>
          Annamithra Food & Restaurant Management • Vendor Inventory Receipt • Confidential
        </div>
        <div style="font-weight: 600;">
          Page ${pageIdx + 1} of ${totalPages}
        </div>
      </div>
    `;

    pageEl.innerHTML = contentHtml;
    pages.push(pageEl);
  }

  return pages;
}

export async function downloadVendorInventoryEntryPdf(options = {}) {
  const pages = buildVendorInventoryEntryPages(options);
  const cleanVendor = String(options.vendorName || 'Vendor').replace(/[/\\?%*:|"<>]/g, '_').trim().replace(/\s+/g, '_');
  const cleanDate = String(options.entryDate || new Date().toISOString().slice(0, 10));
  const defaultFilename = `Annamithra_Vendor_Entry_${cleanVendor}_${cleanDate}.pdf`;

  return await renderHtmlPagesToPdf({ pages, filename: options.filename || defaultFilename, orientation: 'portrait' });
}

export async function printVendorInventoryEntryDirect(options = {}) {
  const {
    vendorName = '',
    entryDate = '',
    paymentMode = 'CASH',
    receivedBy = '',
    broughtBy = '',
    items = [],
    grandTotal = 0,
    language = 'en'
  } = options;
  const isTa = language === 'ta';
  const safeItems = Array.isArray(items) ? items : [];
  const totalQtySum = safeItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const resolvedGrandTotal = (grandTotal !== undefined && grandTotal !== null && !isNaN(grandTotal))
    ? Number(grandTotal)
    : safeItems.reduce((sum, it) => sum + (Number(it.totalRate) || 0), 0);

  const paymentLabels = {
    CASH: isTa ? 'ரொக்கம்' : 'Cash',
    UPI: isTa ? 'யுபிஐ' : 'UPI',
    BANK_TRANSFER: isTa ? 'வங்கி பரிமாற்றம்' : 'Bank Transfer',
    CREDIT: isTa ? 'கடன்' : 'Credit'
  };
  const paymentModeLabel = paymentLabels[paymentMode] || paymentMode || 'Cash';

  const metadata = [
    { label: isTa ? 'விற்பனையாளர்' : 'Vendor Name', value: vendorName || '—' },
    { label: isTa ? 'வரவு தேதி' : 'Entry Date', value: entryDate || getTodayDateString() },
    { label: isTa ? 'பணம் செலுத்துதல்' : 'Mode of Payment', value: paymentModeLabel },
    receivedBy ? { label: isTa ? 'பெற்றவர்' : 'Received By', value: receivedBy } : null,
    broughtBy ? { label: isTa ? 'கொண்டு வந்தவர்' : 'Brought By', value: broughtBy } : null
  ].filter(Boolean);

  const columns = [
    { header: '#', key: '#', align: 'center', width: '20px' },
    { header: isTa ? 'பொருள் பெயர்' : 'Item Name', key: 'itemName', align: 'left', render: r => {
      const rawName = String(r.itemName || r.name || '—').trim();
      return isTa ? translateItemName(rawName) : rawName;
    }},
    { header: isTa ? 'அளவு' : 'Qty', key: 'quantity', align: 'right', render: r => `${r.quantity} ${cleanUnitName(r.unit || '')}` },
    { header: isTa ? 'விலை' : 'Rate', key: 'unitRate', align: 'right', render: r => `₹${Number(r.unitRate || 0).toFixed(2)}` },
    { header: isTa ? 'மொத்தம்' : 'Total', key: 'totalRate', align: 'right', render: r => {
      const tot = Number(r.totalRate !== undefined ? r.totalRate : ((r.quantity || 0) * (r.unitRate || 0))) || 0;
      return `₹${tot.toFixed(2)}`;
    }}
  ];

  const summaryRows = [
    { label: isTa ? 'மொத்த பொருட்கள்:' : 'Total Items:', value: safeItems.length },
    { label: isTa ? 'மொத்த அளவு:' : 'Total Quantity:', value: Math.round(totalQtySum * 1000) / 1000 },
    { label: isTa ? 'மொத்தத் தொகை:' : 'Grand Total:', value: `₹${resolvedGrandTotal.toFixed(2)}`, isTotal: true }
  ];

  return printThermalReceipt({
    organisationName: isTa ? 'அன்னமித்ரா உணவு மேலாண்மை' : 'Annamithra Food Management',
    branchName: isTa ? 'மத்திய சேமிப்பக வரவு' : 'Central Inventory Entry',
    title: isTa ? '*** இருப்பு வரவு ரசீது ***' : '*** VENDOR INVENTORY ENTRY ***',
    dateLabel: entryDate || getTodayDateString(),
    metadata,
    columns,
    items: safeItems,
    summaryRows,
    footerNotes: [
      isTa ? '*** பொருட்கள் சரிபார்க்கப்பட்டு பெறப்பட்டது ***' : '*** GOODS VERIFIED & RECEIVED ***',
      'Annamithra POS System',
      isTa ? '*** ரசீது முடிவு ***' : '*** END OF RECEIPT ***'
    ],
    language
  });
}

/**
 * 8. Consolidated Vendor Entry History Report Thermal Direct Print
 * Supports both Summary View and Details View in standard 80mm format
 */
export async function printVendorEntryReportDirect(options = {}) {
  const {
    viewMode = 'summary', // 'summary' | 'details'
    reportData = {},
    dateRangeLabel = 'Today',
    language = 'en'
  } = options;

  const isTa = language === 'ta';
  const grandTotalAmount = Number(reportData.grandTotalAmount || 0);
  const totalVendors = Number(reportData.totalVendors || (viewMode === 'summary' ? (reportData.summaryRows || []).length : (reportData.detailsGroups || []).length));
  const grandQtyFormatted = reportData.grandTotalQuantityFormatted || '0';

  if (viewMode === 'summary') {
    const safeRows = Array.isArray(reportData.summaryRows) ? reportData.summaryRows : [];
    const columns = [
      { header: '#', key: '#', align: 'center', width: '20px' },
      { header: isTa ? 'விற்பனையாளர்' : 'Vendor Name', key: 'vendorName', align: 'left', render: r => escapeHtml(r.vendorName || '—') },
      { header: isTa ? 'மொத்த அளவு' : 'Total Qty', key: 'totalQuantityFormatted', align: 'right', render: r => escapeHtml(r.totalQuantityFormatted || '0') },
      { header: isTa ? 'மொத்த விலை' : 'Total Rate', key: 'totalRate', align: 'right', render: r => `₹${Number(r.totalRate || 0).toFixed(2)}` }
    ];

    const summaryRows = [
      { label: isTa ? 'மொத்த விற்பனையாளர்கள்:' : 'Total Vendors:', value: totalVendors, isBold: true },
      { label: isTa ? 'மொத்த அளவு:' : 'Total Quantity:', value: grandQtyFormatted },
      { label: isTa ? 'மொத்தத் தொகை:' : 'Grand Total:', value: `₹${grandTotalAmount.toFixed(2)}`, isTotal: true }
    ];

    return printThermalReceipt({
      organisationName: isTa ? 'அன்னமித்ரா உணவு மேலாண்மை' : 'Annamithra Food Management',
      branchName: isTa ? 'மைய சேமிப்பகம்' : 'Central Store',
      title: isTa ? '*** விற்பனையாளர் சுருக்க அறிக்கை ***' : '*** VENDOR SUMMARY REPORT ***',
      subtitle: isTa ? 'விற்பனையாளர் வாரியாக சுருக்கம்' : 'Consolidated Vendor Summary',
      dateLabel: dateRangeLabel,
      columns,
      items: safeRows,
      summaryRows,
      footerNotes: [
        isTa ? '*** விற்பனையாளர் வரவு சுருக்கம் ***' : '*** VENDOR INVENTORY SUMMARY ***',
        'Annamithra POS System',
        isTa ? '*** அறிக்கை முடிவு ***' : '*** END OF REPORT ***'
      ],
      language
    });
  } else {
    // Details View: Grouped by Vendor with items and vendor subtotals
    const safeGroups = Array.isArray(reportData.detailsGroups) ? reportData.detailsGroups : [];

    let customBodyHtml = '';
    if (safeGroups.length === 0) {
      customBodyHtml = `
        <div style="padding: 12px 0; text-align: center; font-style: italic; font-size: 11px;">
          ${isTa ? 'பதிவுகள் எதுவும் இல்லை' : 'No records found matching filters'}
        </div>
      `;
    } else {
      customBodyHtml = safeGroups.map((g, gIdx) => {
        const vName = escapeHtml(g.vendorName || 'Unknown Vendor');
        const vItems = Array.isArray(g.items) ? g.items : [];
        const vSubtotalAmount = Number(g.subtotalAmount || 0);
        const vSubtotalQty = escapeHtml(g.subtotalQuantityFormatted || '0');

        const rowsHtml = vItems.map((it, itIdx) => {
          const rawItemName = String(it.itemName || '—').trim();
          const itemName = isTa ? translateItemName(rawItemName) : rawItemName;
          const qtyStr = `${it.quantity} ${cleanUnitName(it.unit || '')}`;
          const rateStr = `₹${Number(it.unitRate || 0).toFixed(2)}`;
          const totalStr = `₹${Number(it.totalRate || 0).toFixed(2)}`;

          return `
            <tr style="page-break-inside: avoid; break-inside: avoid;">
              <td style="padding: 2.5px 2px; text-align: left; font-size: 10.5px; word-break: break-word;">${escapeHtml(itemName)}</td>
              <td style="padding: 2.5px 2px; text-align: right; font-size: 10.5px; white-space: nowrap;">${escapeHtml(qtyStr)}</td>
              <td style="padding: 2.5px 2px; text-align: right; font-size: 10.5px; white-space: nowrap;">${escapeHtml(rateStr)}</td>
              <td style="padding: 2.5px 2px; text-align: right; font-size: 10.5px; white-space: nowrap;">${escapeHtml(totalStr)}</td>
            </tr>
          `;
        }).join('');

        return `
          <div class="branch-section" style="margin: 6px 0 10px 0; page-break-inside: auto; break-inside: auto; page-break-before: auto; break-before: auto;">
            <div class="branch-header" style="font-weight: 800; font-size: 12px; padding: 3px 0; border-bottom: 1px solid #000000; text-transform: uppercase; page-break-after: avoid; break-after: avoid; page-break-inside: avoid; break-inside: avoid;">
              🏢 ${vName}
            </div>
            <table class="thermal-receipt-table" style="margin: 2px 0; page-break-inside: auto; break-inside: auto; page-break-before: avoid; break-before: avoid;">
              <thead style="display: table-header-group; page-break-after: avoid; break-after: avoid;">
                <tr>
                  <th style="padding: 3px 2px; text-align: left; font-size: 10px;">${isTa ? 'பொருள்' : 'Item'}</th>
                  <th style="padding: 3px 2px; text-align: right; font-size: 10px; width: 55px;">${isTa ? 'அளவு' : 'Qty'}</th>
                  <th style="padding: 3px 2px; text-align: right; font-size: 10px; width: 45px;">${isTa ? 'விலை' : 'Rate'}</th>
                  <th style="padding: 3px 2px; text-align: right; font-size: 10px; width: 55px;">${isTa ? 'மொத்தம்' : 'Total'}</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || `<tr><td colspan="4" style="text-align: center; font-style: italic; padding: 4px;">No items</td></tr>`}
              </tbody>
            </table>
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; border-top: 1px dashed #000000; padding: 2px 0 4px 0;">
              <span>${isTa ? 'விற்பனையாளர் உபமொத்தம்' : 'Vendor Subtotal'} (${vSubtotalQty}):</span>
              <span>₹${vSubtotalAmount.toFixed(2)}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    const summaryRows = [
      { label: isTa ? 'மொத்த விற்பனையாளர்கள்:' : 'Total Vendors:', value: totalVendors, isBold: true },
      { label: isTa ? 'மொத்த அளவு:' : 'Total Quantity:', value: grandQtyFormatted },
      { label: isTa ? 'மொத்தத் தொகை:' : 'Grand Total:', value: `₹${grandTotalAmount.toFixed(2)}`, isTotal: true }
    ];

    return printThermalReceipt({
      organisationName: isTa ? 'அன்னமித்ரா உணவு மேலாண்மை' : 'Annamithra Food Management',
      branchName: isTa ? 'மைய சேமிப்பகம்' : 'Central Store',
      title: isTa ? '*** விற்பனையாளர் விரிவான அறிக்கை ***' : '*** VENDOR DETAILS REPORT ***',
      subtitle: isTa ? 'விற்பனையாளர் வாரியாக பொருள் விவரங்கள்' : 'Vendor-wise Item Breakdown',
      dateLabel: dateRangeLabel,
      customBodyHtml,
      summaryRows,
      footerNotes: [
        isTa ? '*** விற்பனையாளர் விரிவான வரவு அறிக்கை ***' : '*** VENDOR INVENTORY DETAILS ***',
        'Annamithra POS System',
        isTa ? '*** அறிக்கை முடிவு ***' : '*** END OF REPORT ***'
      ],
      language
    });
  }
}

/**
 * 8b. Consolidated Vendor Inventory Entry History A4 PDF Report
 * Supports both Summary View and Details View with multi-vendor, multi-page layout
 */
export function buildVendorEntryReportPages(options = {}) {
  const {
    viewMode = 'summary', // 'summary' | 'details'
    reportData = {},
    dateRangeLabel = 'Today',
    organisationName = 'Annamithra Food Management',
    language = 'en'
  } = options;

  const isTa = language === 'ta';
  const grandTotalAmount = Number(reportData.grandTotalAmount || 0);
  const totalVendors = Number(reportData.totalVendors || (viewMode === 'summary' ? (reportData.summaryRows || []).length : (reportData.detailsGroups || []).length));
  const grandQtyFormatted = reportData.grandTotalQuantityFormatted || '0';

  const pages = [];

  if (viewMode === 'summary') {
    const safeRows = Array.isArray(reportData.summaryRows) ? reportData.summaryRows : [];
    const ITEMS_PER_PAGE = 18;
    const totalPages = Math.max(1, Math.ceil(safeRows.length / ITEMS_PER_PAGE));

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const startIdx = pageIdx * ITEMS_PER_PAGE;
      const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, safeRows.length);
      const pageRows = safeRows.slice(startIdx, endIdx);
      const isLastPage = pageIdx === totalPages - 1;

      const { pageEl, headerHtml, footerHtml } = createReportPageEl({
        title: isTa ? 'விற்பனையாளர் வரவு அறிக்கை — சுருக்கப் பார்வை' : 'Vendor Inventory Entry Report — Summary View',
        subtitle: isTa
          ? `சுருக்கப் பார்வை   |   மொத்த விற்பனையாளர்கள்: ${totalVendors}   |   மொத்த அளவு: ${grandQtyFormatted}   |   மொத்தத் தொகை: ₹${grandTotalAmount.toFixed(2)}`
          : `Consolidated Vendor Summary   |   Total Vendors: ${totalVendors}   |   Total Quantity: ${grandQtyFormatted}   |   Grand Total: ₹${grandTotalAmount.toFixed(2)}`,
        dateLabel: dateRangeLabel,
        pageIndex: pageIdx,
        totalPages,
        isLandscape: false
      });

      let tableRowsHtml = '';
      if (safeRows.length === 0) {
        tableRowsHtml = `
          <tr>
            <td colspan="4" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; font-size: 14px;">
              ${isTa ? 'விற்பனையாளர் வரவு பதிவுகள் எதுவும் இல்லை.' : 'No vendor inventory entry records found matching the selected filter criteria.'}
            </td>
          </tr>
        `;
      } else {
        pageRows.forEach((row, i) => {
          const rowIdx = startIdx + i + 1;
          const bg = (rowIdx % 2 === 0) ? '#FCFAF3' : '#ffffff';
          const vName = escapeHtml(row.vendorName || '—');
          const qtyStr = escapeHtml(row.totalQuantityFormatted || '0');
          const rateVal = Number(row.totalRate || 0);

          tableRowsHtml += `
            <tr style="background: ${bg}; border-bottom: 1px solid #E5DDC9;">
              <td style="padding: 10px 8px; text-align: center; border: 1px solid #E5DDC9; font-size: 13.5px; font-weight: 600; color: #5A6962; width: 45px;">
                ${rowIdx}
              </td>
              <td style="padding: 10px 14px; border: 1px solid #E5DDC9; font-weight: 700; color: #17352B; font-size: 14px; word-break: break-word;">
                ${vName}
              </td>
              <td style="padding: 10px 14px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 14px; width: 160px; white-space: nowrap;">
                ${qtyStr}
              </td>
              <td style="padding: 10px 14px; text-align: right; border: 1px solid #E5DDC9; font-weight: 800; color: #003B2B; font-size: 14px; width: 160px; white-space: nowrap;">
                ₹ ${rateVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          `;
        });
      }

      const summaryFooterHtml = isLastPage && safeRows.length > 0 ? `
        <tfoot>
          <tr style="background: #F5EFE0; border: 1.5px solid #D4A63B; font-weight: 700; color: #003B2B;">
            <td colspan="2" style="padding: 11px 14px; border: 1px solid #E5DDC9; font-size: 14.5px; font-weight: 800;">
              ${isTa ? 'ஒட்டுமொத்த மொத்தம்' : 'Grand Total'} (${totalVendors} ${isTa ? 'விற்பனையாளர்கள்' : 'Vendors'}):
            </td>
            <td style="padding: 11px 14px; text-align: right; border: 1px solid #E5DDC9; font-size: 14.5px; font-weight: 800; color: #003B2B; white-space: nowrap;">
              ${escapeHtml(grandQtyFormatted)}
            </td>
            <td style="padding: 11px 14px; text-align: right; border: 1px solid #E5DDC9; font-size: 15px; font-weight: 800; color: #003B2B; white-space: nowrap;">
              ₹ ${grandTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                <th style="padding: 10px 8px; text-align: center; font-size: 13.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 45px;">#</th>
                <th style="padding: 10px 14px; text-align: left; font-size: 14px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9;">
                  ${isTa ? 'விற்பனையாளர் பெயர்' : 'Vendor Name'}
                </th>
                <th style="padding: 10px 14px; text-align: right; font-size: 14px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 160px;">
                  ${isTa ? 'மொத்த அளவு' : 'Total Quantity'}
                </th>
                <th style="padding: 10px 14px; text-align: right; font-size: 14px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 160px;">
                  ${isTa ? 'மொத்த விலை (₹)' : 'Total Rate (₹)'}
                </th>
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
  } else {
    // Details View: Vendor groups with items and vendor subtotals
    const safeGroups = Array.isArray(reportData.detailsGroups) ? reportData.detailsGroups : [];

    // Paginate vendor details into pages cleanly
    // A standard A4 portrait page has room for ~16 content rows (including headers and subtotals)
    const MAX_PAGE_UNITS = 16;
    const pageChunks = [];
    let currentChunk = [];
    let currentUnits = 0;

    if (safeGroups.length === 0) {
      pageChunks.push([]);
    } else {
      for (const group of safeGroups) {
        const items = Array.isArray(group.items) ? group.items : [];
        let itemIndex = 0;

        while (itemIndex < items.length || items.length === 0) {
          const isFirstSlice = itemIndex === 0;
          const headerCost = 2.5;

          const remainingUnits = MAX_PAGE_UNITS - currentUnits;
          if (remainingUnits < headerCost + 1 && currentUnits > 0) {
            pageChunks.push(currentChunk);
            currentChunk = [];
            currentUnits = 0;
          }

          const availableForItems = Math.max(1, Math.floor(MAX_PAGE_UNITS - currentUnits - headerCost));
          const itemsSlice = items.slice(itemIndex, itemIndex + availableForItems);
          itemIndex += itemsSlice.length;

          const isLastSlice = itemIndex >= items.length;
          const subtotalCost = isLastSlice ? 1.5 : 0;

          currentChunk.push({
            vendorName: group.vendorName,
            isContinued: !isFirstSlice,
            items: itemsSlice,
            showSubtotal: isLastSlice,
            subtotalQuantityFormatted: group.subtotalQuantityFormatted,
            subtotalAmount: group.subtotalAmount,
            startIndex: isFirstSlice ? 1 : (itemIndex - itemsSlice.length + 1)
          });

          currentUnits += headerCost + itemsSlice.length + subtotalCost;

          if (currentUnits >= MAX_PAGE_UNITS) {
            pageChunks.push(currentChunk);
            currentChunk = [];
            currentUnits = 0;
          }

          if (items.length === 0) break;
        }
      }

      if (currentChunk.length > 0) {
        pageChunks.push(currentChunk);
      }
    }

    const totalPages = Math.max(1, pageChunks.length);

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const pageVendorSections = pageChunks[pageIdx] || [];
      const isLastPage = pageIdx === totalPages - 1;

      const { pageEl, headerHtml, footerHtml } = createReportPageEl({
        title: isTa ? 'விற்பனையாளர் வரவு அறிக்கை — விரிவான பார்வை' : 'Vendor Inventory Entry Report — Details View',
        subtitle: isTa
          ? `விரிவான பார்வை   |   மொத்த விற்பனையாளர்கள்: ${totalVendors}   |   மொத்த அளவு: ${grandQtyFormatted}   |   மொத்தத் தொகை: ₹${grandTotalAmount.toFixed(2)}`
          : `Vendor-wise Item Breakdown   |   Total Vendors: ${totalVendors}   |   Total Quantity: ${grandQtyFormatted}   |   Grand Total: ₹${grandTotalAmount.toFixed(2)}`,
        dateLabel: dateRangeLabel,
        pageIndex: pageIdx,
        totalPages,
        isLandscape: false
      });

      let sectionsHtml = '';
      if (pageVendorSections.length === 0 && safeGroups.length === 0) {
        sectionsHtml = `
          <div style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; font-size: 14px; border-radius: 6px; background: #FCFAF3; margin-top: 10px;">
            ${isTa ? 'விற்பனையாளர் வரவு பதிவுகள் எதுவும் இல்லை.' : 'No vendor inventory entry records found matching the selected filter criteria.'}
          </div>
        `;
      } else {
        sectionsHtml = pageVendorSections.map(sec => {
          const vName = escapeHtml(sec.vendorName || 'Unknown Vendor');
          const titleSuffix = sec.isContinued ? (isTa ? ' (தொடர்ச்சி)' : ' (Continued)') : '';
          const subtotalAmt = Number(sec.subtotalAmount || 0);

          let itemRowsHtml = '';
          if (sec.items.length === 0) {
            itemRowsHtml = `
              <tr>
                <td colspan="5" style="padding: 10px; text-align: center; font-style: italic; color: #6D8B80; font-size: 12.5px;">
                  ${isTa ? 'பொருட்கள் எதுவும் இல்லை' : 'No items recorded'}
                </td>
              </tr>
            `;
          } else {
            sec.items.forEach((it, itIdx) => {
              const rowNum = sec.startIndex + itIdx;
              const bg = (itIdx % 2 === 0) ? '#ffffff' : '#FCFAF3';
              const rawItemName = String(it.itemName || '—').trim();
              const itemName = escapeHtml(isTa ? translateItemName(rawItemName) : rawItemName);
              const unitStr = escapeHtml(cleanUnitName(it.unit || ''));
              const qtyVal = Number(it.quantity) || 0;
              const unitRateVal = Number(it.unitRate) || 0;
              const totalRateVal = Number(it.totalRate) || 0;

              itemRowsHtml += `
                <tr style="background: ${bg}; border-bottom: 1px solid #E5DDC9;">
                  <td style="padding: 7px 8px; text-align: center; border: 1px solid #E5DDC9; font-size: 13px; font-weight: 600; color: #5A6962; width: 40px;">
                    ${rowNum}
                  </td>
                  <td style="padding: 7px 12px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 13.5px; word-break: break-word;">
                    ${itemName}
                  </td>
                  <td style="padding: 7px 12px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 13.5px; width: 130px; white-space: nowrap;">
                    ${qtyVal} ${unitStr}
                  </td>
                  <td style="padding: 7px 12px; text-align: right; border: 1px solid #E5DDC9; font-size: 13px; color: #333; width: 120px; white-space: nowrap;">
                    ₹ ${unitRateVal.toFixed(2)}
                  </td>
                  <td style="padding: 7px 12px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 13.5px; width: 130px; white-space: nowrap;">
                    ₹ ${totalRateVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              `;
            });
          }

          const subtotalHtml = sec.showSubtotal ? `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #F8F4EA; border: 1px solid #E5DDC9; border-top: none; padding: 7px 12px; border-radius: 0 0 6px 6px; font-size: 13px; font-weight: 700; color: #003B2B;">
              <span>
                ${isTa ? 'விற்பனையாளர் உபமொத்தம்' : 'Vendor Subtotal'} (${escapeHtml(sec.subtotalQuantityFormatted || '0')}):
              </span>
              <span style="font-size: 14px; font-weight: 800; color: #003B2B;">
                ₹ ${subtotalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ` : '';

          return `
            <div style="margin-bottom: 14px;">
              <div style="background: #003B2B; color: #ffffff; padding: 7px 12px; border-radius: 6px 6px 0 0; font-size: 13.5px; font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
                <span>🏢 ${vName}${titleSuffix}</span>
              </div>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #F5EFE0; border: 1px solid #E5DDC9;">
                    <th style="padding: 7px 8px; text-align: center; font-size: 12.5px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 40px;">#</th>
                    <th style="padding: 7px 12px; text-align: left; font-size: 13px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9;">
                      ${isTa ? 'பொருள் பெயர்' : 'Item Name'}
                    </th>
                    <th style="padding: 7px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 130px;">
                      ${isTa ? 'அளவு' : 'Quantity'}
                    </th>
                    <th style="padding: 7px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 120px;">
                      ${isTa ? 'அலகு விலை (₹)' : 'Unit Rate (₹)'}
                    </th>
                    <th style="padding: 7px 12px; text-align: right; font-size: 13px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 130px;">
                      ${isTa ? 'மொத்த விலை (₹)' : 'Total Rate (₹)'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRowsHtml}
                </tbody>
              </table>
              ${subtotalHtml}
            </div>
          `;
        }).join('');
      }

      const grandTotalCardHtml = isLastPage && safeGroups.length > 0 ? `
        <div style="background: #F5EFE0; border: 1.5px solid #D4A63B; border-radius: 6px; padding: 12px 16px; margin-top: auto; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 14.5px; font-weight: 800; color: #003B2B;">
            ${isTa ? 'ஒட்டுமொத்த மொத்தம்' : 'Grand Total'} (${totalVendors} ${isTa ? 'விற்பனையாளர்கள்' : 'Vendors'}):
          </span>
          <div style="text-align: right; display: flex; gap: 20px; align-items: center;">
            <div style="font-size: 13.5px; font-weight: 700; color: #17352B;">
              ${isTa ? 'மொத்த அளவு' : 'Total Quantity'}: <span style="font-weight: 800; color: #003B2B;">${escapeHtml(grandQtyFormatted)}</span>
            </div>
            <div style="font-size: 16px; font-weight: 800; color: #003B2B;">
              ${isTa ? 'மொத்தத் தொகை' : 'Grand Total'}: ₹ ${grandTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      ` : '';

      const contentHtml = `
        <div style="flex: 1; display: flex; flex-direction: column;">
          ${headerHtml}
          <div style="flex: 1; display: flex; flex-direction: column;">
            ${sectionsHtml}
            ${grandTotalCardHtml}
          </div>
        </div>
        ${footerHtml}
      `;

      pageEl.innerHTML = contentHtml;
      pages.push(pageEl);
    }
  }

  return pages;
}

export async function downloadVendorEntryReportPdf(options = {}) {
  const pages = buildVendorEntryReportPages(options);
  const viewMode = options.viewMode || 'summary';
  const cleanDate = String(options.dateRangeLabel || new Date().toISOString().slice(0, 10))
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_');
  const defaultFilename = `Annamithra_Vendor_Entry_${viewMode === 'summary' ? 'Summary' : 'Details'}_Report_${cleanDate}.pdf`;

  return await renderHtmlPagesToPdf({
    pages,
    filename: options.filename || defaultFilename,
    orientation: 'portrait'
  });
}

/**
 * 9. Common Consolidated Branch Report Thermal Options Builder
 * Reusable for Branch Requests, Deliveries, and Inventory Reports in standard 80mm POS format.
 * Shared between Direct Print and Download PDF for 100% consistent output.
 */
export function buildConsolidatedBranchReportThermalOptions(options = {}) {
  const {
    reportType = 'requests', // 'requests' | 'dispatches' | 'inventory'
    viewMode = 'summary', // 'summary' | 'details'
    reportData = {},
    dateRangeLabel = 'Today',
    branchFilter = 'All Branches',
    departmentBreakdown = false,
    language = 'en'
  } = options;

  const isTa = language === 'ta';
  const totalGroups = Number(reportData.totalGroups || (viewMode === 'summary' ? (reportData.summaryRows || []).length : (reportData.detailsGroups || []).length));
  const overallTotalItems = Number(reportData.overallTotalItems || 0);
  const grandQtyFormatted = reportData.grandTotalQuantityFormatted || '0';

  let reportTitle = '';
  let groupTypeLabel = '';
  let measureLabel = '';

  if (reportType === 'requests') {
    reportTitle = viewMode === 'summary'
      ? (isTa ? '*** கிளை கோரிக்கை சுருக்க அறிக்கை ***' : '*** BRANCH REQUEST SUMMARY ***')
      : (isTa ? '*** கிளை கோரிக்கை விரிவான அறிக்கை ***' : '*** BRANCH REQUEST DETAILS ***');
    groupTypeLabel = isTa ? 'கிளை' : 'Branch';
    measureLabel = isTa ? 'கோரப்பட்ட அளவு' : 'Requested Qty';
  } else if (reportType === 'dispatches') {
    reportTitle = viewMode === 'summary'
      ? (isTa ? '*** விநியோக சுருக்க அறிக்கை ***' : '*** DELIVERY SUMMARY ***')
      : (isTa ? '*** விநியோக விரிவான அறிக்கை ***' : '*** DELIVERY DETAILS ***');
    groupTypeLabel = isTa ? 'கிளை' : 'Branch';
    measureLabel = isTa ? 'விநியோகிக்கப்பட்ட அளவு' : 'Delivered Qty';
  } else {
    reportTitle = viewMode === 'summary'
      ? (isTa ? '*** சரக்கு இருப்பு சுருக்க அறிக்கை ***' : '*** INVENTORY SUMMARY ***')
      : (isTa ? '*** சரக்கு இருப்பு விரிவான அறிக்கை ***' : '*** INVENTORY DETAILS ***');
    groupTypeLabel = isTa ? 'பிரிவு' : 'Category';
    measureLabel = isTa ? 'இருப்பு அளவு' : 'Stock Qty';
  }

  const subtitle = `${groupTypeLabel} ${viewMode === 'summary' ? (isTa ? 'சுருக்கம்' : 'Consolidated Summary') : (isTa ? 'விவரங்கள்' : 'Item Breakdown')}${departmentBreakdown ? (isTa ? ' • துறை வாரியாக' : ' • Dept Breakdown') : ''}`;

  const metadata = [];
  if (branchFilter && branchFilter !== 'All Branches') {
    metadata.push({ label: isTa ? 'கிளை' : 'Branch', value: branchFilter });
  }
  if (departmentBreakdown) {
    metadata.push({ label: isTa ? 'பிரிவு' : 'View', value: isTa ? 'துறை வாரியானது' : 'Department-wise' });
  }

  if (viewMode === 'summary') {
    const safeRows = Array.isArray(reportData.summaryRows) ? reportData.summaryRows : [];
    let columns = [];
    if (reportType === 'requests') {
      columns = [
        { header: '#', key: '#', align: 'center', width: '22px' },
        { header: isTa ? 'கிளை பெயர்' : 'Branch Name', key: 'groupName', align: 'left', render: r => escapeHtml(r.groupName || '—') },
        { header: isTa ? 'மொத்த அளவு' : 'Total Quantity', key: 'qty', align: 'right', render: r => {
          const qMap = r.quantityByUnit || {};
          const keys = Object.keys(qMap);
          if (keys.length === 1) return Number(qMap[keys[0]]).toLocaleString();
          return escapeHtml(r.totalQuantityFormatted || '0');
        }},
        { header: isTa ? 'அலகு' : 'Unit', key: 'unit', align: 'left', width: '42px', render: r => {
          const qMap = r.quantityByUnit || {};
          const keys = Object.keys(qMap);
          if (keys.length === 1) return escapeHtml(keys[0]);
          return keys.join(', ');
        }}
      ];
    } else {
      columns = [
        { header: '#', key: '#', align: 'center', width: '22px' },
        { header: isTa ? 'கிளை பெயர்' : 'Branch Name', key: 'groupName', align: 'left', render: r => escapeHtml(r.groupName || '—') },
        { header: isTa ? 'பொருட்கள்' : 'Items', key: 'totalItems', align: 'center', width: '40px', render: r => r.totalItems || 0 },
        { header: measureLabel, key: 'totalQuantityFormatted', align: 'right', render: r => escapeHtml(r.totalQuantityFormatted || '0') }
      ];
    }

    const summaryRows = [
      { label: `${isTa ? 'மொத்த ' + groupTypeLabel + 'கள்:' : 'Total ' + groupTypeLabel + 's:'}`, value: totalGroups, isBold: true },
      { label: isTa ? 'மொத்த பொருட்கள்:' : 'Total Items:', value: overallTotalItems },
      { label: isTa ? 'ஒட்டுமொத்த அளவு:' : 'Total Quantity:', value: grandQtyFormatted, isTotal: true }
    ];

    return {
      organisationName: isTa ? 'அன்னமித்ரா உணவு மேலாண்மை' : 'Annamithra Food Management',
      branchName: branchFilter !== 'All Branches' ? branchFilter : (isTa ? 'அனைத்து கிளைகள்' : 'All Branches'),
      title: reportTitle,
      subtitle,
      dateLabel: dateRangeLabel,
      metadata,
      columns,
      items: safeRows,
      summaryRows,
      footerNotes: [
        `*** ${isTa ? 'அறிக்கை சரிபார்க்கப்பட்டது' : 'REPORT VERIFIED'} ***`,
        'Annamithra POS System',
        isTa ? '*** அறிக்கை முடிவு ***' : '*** END OF REPORT ***'
      ],
      language
    };
  } else {
    // Details View: Grouped by Branch heading with full item details
    const safeGroups = Array.isArray(reportData.detailsGroups) ? reportData.detailsGroups : [];

    let customBodyHtml = '';
    if (safeGroups.length === 0) {
      customBodyHtml = `
        <div style="padding: 12px 0; text-align: center; font-style: italic; font-size: 11px;">
          ${isTa ? 'பதிவுகள் எதுவும் இல்லை' : 'No records found matching filters'}
        </div>
      `;
    } else {
      customBodyHtml = safeGroups.map(g => {
        const gName = escapeHtml(g.groupName || 'Unknown');
        const gItems = Array.isArray(g.items) ? g.items : [];
        const gSubtotalQty = escapeHtml(g.subtotalQuantityFormatted || '0');

        const rowsHtml = gItems.map(it => {
          const rawItemName = String(it.itemName || '—').trim();
          const itemName = isTa ? translateItemName(rawItemName) : rawItemName;
          const reqQty = Number(it.requestedQuantity ?? it.totalQuantity ?? 0);
          const delQty = Number(it.deliveredQuantity || 0);
          const balQty = Number(it.deliveryQuantity !== undefined ? it.deliveryQuantity : Math.max(0, reqQty - delQty));
          const unitStr = cleanUnitName(it.unit || '');
          const deptStr = it.department ? String(it.department).trim() : '';
          const delDateStr = it.deliveryDate ? String(it.deliveryDate).slice(0, 10) : '';
          const ackStatus = it.acknowledgementStatus || '';

          if (reportType === 'requests') {
            let ackDisplay = '';
            if (ackStatus === 'ACKNOWLEDGED' || ackStatus === 'COMPLETED') {
              ackDisplay = `<span style="font-size: 8.5px; font-weight: 800; color: #166534;">✓ ${isTa ? 'பெறப்பட்டது' : 'Ack'}</span>`;
            } else if (ackStatus === 'PARTIALLY_DELIVERED') {
              ackDisplay = `<span style="font-size: 8.5px; font-weight: 800; color: #D97706;">⚡ ${isTa ? 'பகுதி' : 'Partial'}</span>`;
            } else if (ackStatus === 'PENDING_DELIVERY') {
              ackDisplay = `<span style="font-size: 8.5px; font-weight: 800; color: #DC2626;">⏳ ${isTa ? 'நிலுவை' : 'Pending'}</span>`;
            } else if (ackStatus === 'PENDING_ACKNOWLEDGEMENT' || ackStatus === 'DISPATCHED') {
              ackDisplay = `<span style="font-size: 8.5px; font-weight: 800; color: #2563EB;">📬 ${isTa ? 'ஒப்புதல்' : 'Sent'}</span>`;
            } else if (ackStatus) {
              ackDisplay = `<span style="font-size: 8px; font-weight: 600; color: #555;">${escapeHtml(ackStatus)}</span>`;
            }

            return `
              <tr style="page-break-inside: avoid; break-inside: avoid; border-bottom: 1px dashed #dddddd;">
                <td style="padding: 4px 2px; text-align: left; vertical-align: top;">
                  <div style="font-weight: 700; font-size: 11px; line-height: 1.25; color: #000000; word-break: break-word;">${escapeHtml(itemName)}</div>
                  ${deptStr && deptStr !== 'All Departments' ? `<div style="font-size: 9.5px; color: #4B5563; margin-top: 1.5px; word-break: break-word;">[ ${escapeHtml(deptStr)} ]</div>` : ''}
                  ${delDateStr ? `<div style="font-size: 8.5px; color: #6B7280; margin-top: 1.5px;">📅 ${isTa ? 'விநியோகம்' : 'Deliv'}: ${escapeHtml(delDateStr)}</div>` : ''}
                </td>
                <td style="padding: 4px 2px; text-align: right; vertical-align: top; white-space: nowrap;">
                  <div style="font-weight: 800; font-size: 11px; color: #000000;">Req: ${reqQty.toLocaleString()}</div>
                  ${delQty > 0 ? `<div style="font-size: 9px; color: #166534; font-weight: 600;">Del: ${delQty.toLocaleString()}</div>` : ''}
                  <div style="font-size: 9px; color: #B45309; font-weight: 700;">Bal: ${balQty.toLocaleString()}</div>
                </td>
                <td style="padding: 4px 2px; text-align: center; vertical-align: top; white-space: nowrap;">
                  <div style="font-weight: 700; font-size: 10.5px; color: #111827;">${escapeHtml(unitStr)}</div>
                  ${ackDisplay ? `<div style="margin-top: 2px;">${ackDisplay}</div>` : ''}
                </td>
              </tr>
            `;
          }

          return `
            <tr style="page-break-inside: avoid; break-inside: avoid; border-bottom: 1px dashed #dddddd;">
              <td style="padding: 3px 2px; text-align: left; font-size: 11px; word-break: break-word;">${escapeHtml(itemName)}</td>
              <td style="padding: 3px 2px; text-align: right; font-size: 11px; white-space: nowrap; font-weight: 700;">${escapeHtml(reqQty)}</td>
              <td style="padding: 3px 2px; text-align: center; font-size: 10px; white-space: nowrap;">${escapeHtml(unitStr)}</td>
            </tr>
          `;
        }).join('');

        return `
          <div class="branch-section" style="margin: 8px 0 12px 0; page-break-inside: auto; break-inside: auto; page-break-before: auto; break-before: auto;">
            <div class="branch-header" style="font-weight: 800; font-size: 12px; padding: 3px 0 4px 0; border-bottom: 1.5px solid #000000; text-transform: uppercase; letter-spacing: 0.3px; page-break-after: avoid; break-after: avoid; page-break-inside: avoid; break-inside: avoid;">
              🏢 ${gName} <span style="font-size: 10px; font-weight: 600; opacity: 0.85;">(${g.totalItems || gItems.length} ${isTa ? 'பொருட்கள்' : 'Items'})</span>
            </div>
            <table class="thermal-receipt-table" style="width: 100%; border-collapse: collapse; margin: 2px 0; table-layout: fixed; page-break-inside: auto; break-inside: auto; page-break-before: avoid; break-before: avoid;">
              <thead style="display: table-header-group; page-break-after: avoid; break-after: avoid;">
                <tr>
                  <th style="padding: 3px 2px; text-align: left; font-size: 10px; border-bottom: 1px dashed #000; width: 50%;">${isTa ? 'பொருள் / துறை' : 'Item / Department'}</th>
                  <th style="padding: 3px 2px; text-align: right; font-size: 10px; width: 28%; border-bottom: 1px dashed #000;">${isTa ? 'கோரிய/விநியோகம்' : 'Req / Deliv'}</th>
                  <th style="padding: 3px 2px; text-align: center; font-size: 10px; width: 22%; border-bottom: 1px dashed #000;">${isTa ? 'அலகு/நிலை' : 'Unit/Status'}</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || `<tr><td colspan="3" style="text-align: center; font-style: italic; padding: 6px;">${isTa ? 'பதிவுகள் இல்லை' : 'No items'}</td></tr>`}
              </tbody>
            </table>
            <div class="branch-subtotal" style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 800; border-top: 1px dashed #000000; padding: 3px 0 6px 0; page-break-inside: avoid; break-inside: avoid;">
              <span>${gName} ${isTa ? 'துணை மொத்தம்' : 'Subtotal'}:</span>
              <span>${gSubtotalQty}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    const summaryRows = [
      { label: `${isTa ? 'மொத்த ' + groupTypeLabel + 'கள்:' : 'Total ' + groupTypeLabel + 's:'}`, value: totalGroups, isBold: true },
      { label: isTa ? 'மொத்த தனி பொருட்கள்:' : 'Total Unique Items:', value: overallTotalItems },
      { label: isTa ? 'ஒட்டுமொத்த அளவு:' : 'Overall Total Quantity:', value: grandQtyFormatted, isTotal: true }
    ];

    return {
      organisationName: isTa ? 'அன்னமித்ரா உணவு மேலாண்மை' : 'Annamithra Food Management',
      branchName: branchFilter !== 'All Branches' ? branchFilter : (isTa ? 'அனைத்து கிளைகள்' : 'All Branches'),
      title: reportTitle,
      subtitle,
      dateLabel: dateRangeLabel,
      metadata,
      customBodyHtml,
      summaryRows,
      footerNotes: [
        `*** ${isTa ? 'அறிக்கை சரிபார்க்கப்பட்டது' : 'REPORT VERIFIED'} ***`,
        'Annamithra POS System',
        isTa ? '*** அறிக்கை முடிவு ***' : '*** END OF REPORT ***'
      ],
      language
    };
  }
}

export async function printConsolidatedBranchReportDirect(options = {}) {
  const thermalOptions = buildConsolidatedBranchReportThermalOptions(options);
  return printThermalReceipt(thermalOptions);
}

export async function downloadConsolidatedBranchReportPdf(options = {}) {
  const thermalOptions = buildConsolidatedBranchReportThermalOptions(options);
  const viewMode = options.viewMode || 'summary';
  const reportType = options.reportType || 'requests';
  const cleanDate = String(options.dateRangeLabel || new Date().toISOString().slice(0, 10))
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_');
  const defaultFilename = `Annamithra_${reportType}_${viewMode === 'summary' ? 'Summary' : 'Details'}_Report_${cleanDate}.pdf`;

  return renderThermalReceiptToPdf(thermalOptions, options.filename || defaultFilename);
}

/**
 * Universal CSV Export for Simplified & Consolidated Reports
 */
export function exportReportCsv({ reportType, items = [], filename = 'report.csv', departmentBreakdown = false, viewMode = 'summary', consolidatedData = null }) {
  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    const s = String(val).replace(/"/g, '""');
    return (s.search(/("|,|\n|\r)/g) >= 0) ? `"${s}"` : s;
  };

  let headers = [];
  let rows = [];

  // Check if consolidatedData is provided for summary / details views
  if (consolidatedData && (viewMode === 'summary' || viewMode === 'details')) {
    if (viewMode === 'summary') {
      const summaryRows = consolidatedData.summaryRows || [];
      const groupHeader = (reportType === 'inventory') ? 'Category' : 'Branch Name';
      const measureHeader = (reportType === 'requests') ? 'Total Requested Quantity' : ((reportType === 'dispatches') ? 'Total Delivered Quantity' : 'Available Stock');
      headers = ['S.No', groupHeader, 'Total Items', measureHeader];
      rows = summaryRows.map((r, idx) => [
        escapeCsv(idx + 1),
        escapeCsv(r.groupName),
        escapeCsv(r.totalItems),
        escapeCsv(r.totalQuantityFormatted)
      ]);
    } else {
      const detailsGroups = consolidatedData.detailsGroups || [];
      const groupHeader = (reportType === 'inventory') ? 'Category' : 'Branch Name';
      const measureHeader = (reportType === 'requests') ? 'Total Requested Quantity' : ((reportType === 'dispatches') ? 'Total Delivered Quantity' : 'Available Stock');
      headers = ['S.No', groupHeader, 'Item Name', measureHeader, 'Unit'];
      let rowIdx = 1;
      detailsGroups.forEach(g => {
        (g.items || []).forEach(it => {
          rows.push([
            escapeCsv(rowIdx++),
            escapeCsv(g.groupName),
            escapeCsv(it.itemName),
            escapeCsv(it.totalQuantity),
            escapeCsv(it.unit)
          ]);
        });
      });
    }

    if (rows.length === 0) {
      alert('No records found matching filters to export.');
      return false;
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

  // Fallback to legacy raw item export
  if (!items || items.length === 0) {
    alert('No records found matching filters to export.');
    return false;
  }

  headers = [];
  rows = [];

  if (reportType === 'inventory') {
    headers = ['Item Name', 'Available Stock', 'Last Updated Date'];
    rows = items.map(it => [
      escapeCsv(it.itemName || it.name),
      escapeCsv(formatQuantityWithUnit(it.currentStock, it.unit)),
      escapeCsv(it.formattedLastUpdated || it.lastUpdated)
    ]);
  } else if (reportType === 'requests') {
    if (departmentBreakdown) {
      headers = ['S.No', 'Department', 'Item Name', 'Total Quantity', 'Unit'];
      rows = items.map((it, idx) => [
        escapeCsv(idx + 1),
        escapeCsv(it.department || it.category || 'Not specified'),
        escapeCsv(it.itemName || it.item),
        escapeCsv(it.requestedQuantity ?? it.requested ?? 0),
        escapeCsv(it.unit || '')
      ]);
    } else {
      headers = ['S.No', 'Item Name', 'Total Quantity', 'Unit'];
      rows = items.map((it, idx) => [
        escapeCsv(idx + 1),
        escapeCsv(it.itemName || it.item),
        escapeCsv(it.requestedQuantity ?? it.requested ?? 0),
        escapeCsv(it.unit || '')
      ]);
    }
  } else if (reportType === 'dispatches') {
    headers = ['Branch Name', 'Department', 'Item Name', 'Delivered Quantity', 'Delivery Date', 'Acknowledgement Status'];
    rows = items.map(it => [
      escapeCsv(it.branchName),
      escapeCsv(it.department || it.category || 'Not specified'),
      escapeCsv(it.itemName),
      escapeCsv(formatQuantityWithUnit(it.dispatchedQuantity, it.unit)),
      escapeCsv(it.formattedDate || it.dispatchDate),
      escapeCsv(it.meaningfulStatus || it.acknowledgementStatus || it.status)
    ]);
  } else if (reportType === 'category-summary') {
    headers = ['Category', 'Total Distinct Items', 'Requested Quantity', 'Delivered Quantity', 'Pending Quantity'];
    rows = items.map(c => [
      escapeCsv(c.category),
      escapeCsv(c.totalItems),
      escapeCsv(formatUnitSummary(c.requestedByUnit)),
      escapeCsv(formatUnitSummary(c.dispatchedByUnit)),
      escapeCsv(formatUnitSummary(c.pendingByUnit))
    ]);
  } else if (reportType === 'category-details') {
    headers = ['Item Name', 'Category', 'Branch Name', 'Department', 'Requested Quantity', 'Delivered Quantity', 'Pending Quantity', 'Request Date', 'Delivery Date', 'Delivery Status'];
    rows = items.map(it => [
      escapeCsv(it.itemName),
      escapeCsv(it.category),
      escapeCsv(it.branchName),
      escapeCsv(it.department),
      escapeCsv(formatQuantityWithUnit(it.requestedQuantity, it.unit)),
      escapeCsv(formatQuantityWithUnit(it.dispatchedQuantity, it.unit)),
      escapeCsv(formatQuantityWithUnit(it.pendingQuantity, it.unit)),
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
