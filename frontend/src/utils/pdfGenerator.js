import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { itemTranslations, unitTranslations } from '../i18n/translations';

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
async function generateTamilPdf({ orderNumber, items, formatType, orderDate, createdAt }) {
  const isOrgAdmin = formatType === 'ORG_ADMIN';
  const { dateStr, timeStr } = parseOrderDateTime(createdAt, orderDate, 'ta');
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
      pageEl.style.fontFamily = "'Noto Sans Tamil', 'Nirmala UI', 'Latha', system-ui, -apple-system, sans-serif";
      pageEl.style.color = '#17352B';

      let itemsRowsHtml = '';
      if (pageItems.length === 0) {
        itemsRowsHtml = `
          <tr>
            <td colspan="${isOrgAdmin ? 2 : 3}" style="padding: 18px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9;">
              இந்த ஆர்டரில் எந்தப் பொருட்களும் இல்லை.
            </td>
          </tr>
        `;
      } else {
        pageItems.forEach((line) => {
          const rawName = String(line.itemName || line.item || '').trim();
          const translatedName = translateItemName(rawName);
          const rawUnit = String(line.unit || '').trim();
          const translatedUnit = translateUnitName(rawUnit);
          const rawQty = line.quantity ?? line.orderQuantity ?? 0;

          if (isOrgAdmin) {
            const qtyText = rawUnit ? `${rawQty} ${translatedUnit}` : `${rawQty}`;
            itemsRowsHtml += `
              <tr style="border-bottom: 1px solid #E5DDC9;">
                <td style="padding: 10px 14px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 13.5px;">
                  ${translatedName}
                </td>
                <td style="padding: 10px 14px; border: 1px solid #E5DDC9; text-align: right; font-weight: 700; color: #003B2B; font-size: 14px;">
                  ${qtyText}
                </td>
              </tr>
            `;
          } else {
            itemsRowsHtml += `
              <tr style="border-bottom: 1px solid #E5DDC9;">
                <td style="padding: 10px 14px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 13.5px;">
                  ${translatedName}
                </td>
                <td style="padding: 10px 14px; border: 1px solid #E5DDC9; text-align: center; color: #5A6962; font-size: 13px;">
                  ${translatedUnit || '—'}
                </td>
                <td style="padding: 10px 14px; border: 1px solid #E5DDC9; text-align: right; font-weight: 700; color: #003B2B; font-size: 14px;">
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
              அன்னமித்ரா
            </h1>
            <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 700; color: #D4A63B; text-transform: uppercase;">
              உணவக மற்றும் கிளை மேலாண்மை
            </p>
          </div>
          ${totalPages > 1 ? `
            <div style="font-size: 12px; font-weight: 600; color: #5A6962; padding: 4px 10px; background: #F5EFE0; border-radius: 4px;">
              பக்கம் ${pageIdx + 1} / ${totalPages}
            </div>
          ` : ''}
        </div>

        <div style="height: 2px; background: #D4A63B; margin: 10px 0 16px 0;"></div>

        <!-- Order Metadata Card -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: #FCFAF3; border: 1px solid #E5DDC9; border-radius: 6px; padding: 12px 18px; margin-bottom: 18px;">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: #5A6962; text-transform: uppercase; margin-bottom: 2px;">
              ஆர்டர் எண்
            </div>
            <div style="font-size: 18px; font-weight: 800; color: #003B2B;">
              ${orderNumber}
            </div>
          </div>
          <div style="text-align: right; font-size: 12.5px;">
            <div style="margin-bottom: 4px;">
              <span style="color: #5A6962; font-weight: 600;">ஆர்டர் தேதி:</span>
              <strong style="color: #17352B; margin-left: 6px;">${dateStr}</strong>
            </div>
            <div>
              <span style="color: #5A6962; font-weight: 600;">உருவாக்கப்பட்ட நேரம்:</span>
              <strong style="color: #17352B; margin-left: 6px;">${timeStr}</strong>
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <thead>
            <tr style="background: #F5EFE0; border: 1px solid #E5DDC9;">
              <th style="padding: 10px 14px; text-align: left; font-size: 13px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: ${isOrgAdmin ? '70%' : '54%'};">
                பொருளின் பெயர்
              </th>
              ${!isOrgAdmin ? `
                <th style="padding: 10px 14px; text-align: center; font-size: 13px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: 22%;">
                  அலகு
                </th>
              ` : ''}
              <th style="padding: 10px 14px; text-align: right; font-size: 13px; font-weight: 700; color: #003B2B; border: 1px solid #E5DDC9; width: ${isOrgAdmin ? '30%' : '24%'};">
                ${isOrgAdmin ? 'அளவு' : 'ஆர்டர் அளவு'}
              </th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
        </table>

        ${isLastPage ? `
          <!-- Summary Footer -->
          <div style="display: flex; justify-content: flex-end; align-items: center; background: #F5EFE0; border: 1px solid #E5DDC9; border-radius: 6px; padding: 10px 18px; margin-top: 10px;">
            <span style="font-size: 13.5px; font-weight: 700; color: #003B2B;">
              மொத்த பொருட்கள்: ${items.length}
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

  // If language is Tamil, generate the Tamil Unicode PDF
  if (language === 'ta') {
    return generateTamilPdf({
      orderNumber,
      items,
      formatType,
      orderDate,
      createdAt
    });
  }

  // English vector PDF generation
  const { dateStr, timeStr } = parseOrderDateTime(createdAt, orderDate, 'en');

  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait'
  });

  // Palette grounded in Annamithra design system
  const darkGreen = [0, 59, 43];      // #003B2B
  const gold = [212, 166, 59];         // #D4A63B
  const headerCream = [245, 239, 224]; // #F5EFE0
  const lightCream = [252, 250, 243];  // #FCFAF3
  const borderTone = [229, 221, 201];  // #E5DDC9
  const darkText = [23, 53, 43];       // #17352B
  const mutedText = [90, 105, 98];     // #5A6962

  const marginX = 44;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableWidth = pageWidth - marginX * 2; // ~507.28 pt

  // Column definitions based on formatType
  const isOrgAdmin = formatType === 'ORG_ADMIN';

  const col1Width = isOrgAdmin ? Math.floor(tableWidth * 0.68) : Math.floor(tableWidth * 0.52);
  const col2Width = isOrgAdmin ? (tableWidth - col1Width) : Math.floor(tableWidth * 0.20);

  // Helper to draw table header
  const drawTableHeader = (startY) => {
    const headerHeight = 26;
    doc.setFillColor(...headerCream);
    doc.rect(marginX, startY, tableWidth, headerHeight, 'F');
    doc.setDrawColor(...borderTone);
    doc.setLineWidth(1);
    doc.rect(marginX, startY, tableWidth, headerHeight, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...darkGreen);

    if (isOrgAdmin) {
      doc.line(marginX + col1Width, startY, marginX + col1Width, startY + headerHeight);
      doc.text('Item Name', marginX + 14, startY + 17);
      doc.text('Quantity', marginX + col1Width + col2Width - 14, startY + 17, { align: 'right' });
    } else {
      doc.line(marginX + col1Width, startY, marginX + col1Width, startY + headerHeight);
      doc.line(marginX + col1Width + col2Width, startY, marginX + col1Width + col2Width, startY + headerHeight);
      doc.text('Item Name', marginX + 14, startY + 17);
      doc.text('Unit', marginX + col1Width + (col2Width / 2), startY + 17, { align: 'center' });
      doc.text('Ordered Quantity', marginX + tableWidth - 14, startY + 17, { align: 'right' });
    }

    return startY + headerHeight;
  };

  // 1. Branding Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...darkGreen);
  doc.text('Annamithra', marginX, 48);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...gold);
  doc.text('Food & Restaurant Management', marginX, 64);

  // Decorative gold separator
  doc.setDrawColor(...gold);
  doc.setLineWidth(1.5);
  doc.line(marginX, 74, marginX + tableWidth, 74);

  // 2. Order Metadata Box
  let currentY = 86;
  const metaBoxHeight = 44;
  doc.setFillColor(...lightCream);
  doc.rect(marginX, currentY, tableWidth, metaBoxHeight, 'F');
  doc.setDrawColor(...borderTone);
  doc.setLineWidth(1);
  doc.rect(marginX, currentY, tableWidth, metaBoxHeight, 'S');

  // Left side: Order Number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...darkGreen);
  doc.text(String(orderNumber), marginX + 14, currentY + 26);

  // Right side: Order Date and Exact Creation Time
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...mutedText);
  doc.text('Order Date: ', marginX + tableWidth - 220, currentY + 19);
  doc.setTextColor(...darkText);
  doc.text(dateStr, marginX + tableWidth - 155, currentY + 19);

  doc.setTextColor(...mutedText);
  doc.text('Creation Time: ', marginX + tableWidth - 220, currentY + 34);
  doc.setTextColor(...darkText);
  doc.text(timeStr, marginX + tableWidth - 155, currentY + 34);

  currentY += metaBoxHeight + 14;

  // 3. Table Header
  currentY = drawTableHeader(currentY);

  // 4. Data Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...darkText);

  if (!items || items.length === 0) {
    const emptyRowHeight = 28;
    doc.setFillColor(255, 255, 255);
    doc.rect(marginX, currentY, tableWidth, emptyRowHeight, 'F');
    doc.setDrawColor(...borderTone);
    doc.rect(marginX, currentY, tableWidth, emptyRowHeight, 'S');

    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...mutedText);
    doc.text('No items found in this order.', marginX + 14, currentY + 18);
    currentY += emptyRowHeight;
  } else {
    items.forEach((line) => {
      const name = String(line.itemName || line.item || '').trim();
      const unit = String(line.unit || '').trim();
      const rawQty = line.quantity ?? line.orderQuantity ?? 0;

      const textLines = doc.splitTextToSize(name, col1Width - 24);
      const rowHeight = Math.max(26, textLines.length * 13 + 12);

      if (currentY + rowHeight > pageHeight - 55) {
        doc.addPage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...darkGreen);
        doc.text(`Annamithra — Food & Restaurant Management (${orderNumber})`, marginX, 36);

        doc.setDrawColor(...gold);
        doc.setLineWidth(1);
        doc.line(marginX, 42, marginX + tableWidth, 42);

        currentY = drawTableHeader(50);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...darkText);
      }

      doc.setFillColor(255, 255, 255);
      doc.rect(marginX, currentY, tableWidth, rowHeight, 'F');
      doc.setDrawColor(...borderTone);
      doc.rect(marginX, currentY, tableWidth, rowHeight, 'S');

      if (isOrgAdmin) {
        doc.line(marginX + col1Width, currentY, marginX + col1Width, currentY + rowHeight);
      } else {
        doc.line(marginX + col1Width, currentY, marginX + col1Width, currentY + rowHeight);
        doc.line(marginX + col1Width + col2Width, currentY, marginX + col1Width + col2Width, currentY + rowHeight);
      }

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkText);
      doc.text(textLines, marginX + 14, currentY + 17);

      if (isOrgAdmin) {
        const qtyDisplay = unit ? `${rawQty} ${unit}` : `${rawQty}`;
        doc.setFont('helvetica', 'bold');
        doc.text(qtyDisplay, marginX + col1Width + col2Width - 14, currentY + 17, { align: 'right' });
      } else {
        doc.setFont('helvetica', 'normal');
        doc.text(unit || '—', marginX + col1Width + (col2Width / 2), currentY + 17, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.text(String(rawQty), marginX + tableWidth - 14, currentY + 17, { align: 'right' });
      }

      currentY += rowHeight;
    });
  }

  // 5. Total Item Count Summary at the Bottom
  const summaryHeight = 26;
  if (currentY + summaryHeight > pageHeight - 40) {
    doc.addPage();
    currentY = 40;
  }

  doc.setFillColor(...headerCream);
  doc.rect(marginX, currentY, tableWidth, summaryHeight, 'F');
  doc.setDrawColor(...borderTone);
  doc.rect(marginX, currentY, tableWidth, summaryHeight, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...darkGreen);
  doc.text(`Total Items: ${items.length}`, marginX + tableWidth - 14, currentY + 17, { align: 'right' });

  // 6. Save PDF with Order Number in Filename
  const cleanOrderNum = String(orderNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${cleanOrderNum}.pdf`;
  doc.save(fileName);
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
  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait'
  });

  const darkGreen = [0, 59, 43];      // #003B2B
  const gold = [212, 166, 59];         // #D4A63B
  const creamSurface = [253, 251, 247]; // #FDFBF7
  const borderTone = [229, 221, 201];  // #E5DDC9
  const darkText = [34, 40, 49];       // #222831
  const mutedText = [102, 102, 102];

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 36;
  const tableWidth = pageWidth - (marginX * 2);

  // 1. Header Banner
  doc.setFillColor(...darkGreen);
  doc.rect(0, 0, pageWidth, 54, 'F');

  doc.setFillColor(...gold);
  doc.rect(0, 54, pageWidth, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('Annamithra — Branch Requests Report', marginX, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(230, 240, 235);
  const generatedText = `Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  doc.text(generatedText, pageWidth - marginX - doc.getTextWidth(generatedText), 34);

  // 2. Filters Box
  let currentY = 74;
  doc.setFillColor(...creamSurface);
  doc.roundedRect(marginX, currentY, tableWidth, 42, 4, 4, 'FD');
  doc.setDrawColor(...borderTone);
  doc.setLineWidth(1);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkGreen);
  doc.text('Report Filters & Scope:', marginX + 12, currentY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...darkText);
  const branchLabel = branch ? branch : 'All Branches';
  const dateLabel = isAllDates ? 'All Dates' : (dateStr || 'All Dates');
  const catLabel = category && category !== 'ALL' ? category : 'All Categories';
  const filterDesc = `Branch: ${branchLabel}   |   Date: ${dateLabel}   |   Category: ${catLabel}   |   Total Rows: ${items.length}`;
  doc.text(filterDesc, marginX + 12, currentY + 31);

  currentY += 54;

  // 3. Category Breakdown Summary Cards (Quantities grouped by Category)
  const categoryStats = {};
  items.forEach(it => {
    const c = it.category || 'Unassigned';
    if (!categoryStats[c]) {
      categoryStats[c] = { count: 0, totalQty: 0 };
    }
    categoryStats[c].count += 1;
    categoryStats[c].totalQty += (Number(it.requestedQuantity || it.requested || 0));
  });

  const catKeys = Object.keys(categoryStats);
  if (catKeys.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...darkGreen);
    doc.text('Category-wise Breakdown Summary:', marginX, currentY);
    currentY += 12;

    const chipWidth = (tableWidth - (3 * 8)) / 4;
    const chipHeight = 28;
    let colIdx = 0;
    let rowY = currentY;

    catKeys.forEach(catName => {
      const stats = categoryStats[catName];
      const chipX = marginX + (colIdx * (chipWidth + 8));

      doc.setFillColor(255, 255, 255);
      doc.roundedRect(chipX, rowY, chipWidth, chipHeight, 3, 3, 'FD');
      doc.setDrawColor(...borderTone);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...darkGreen);
      doc.text(catName.length > 18 ? catName.slice(0, 16) + '..' : catName, chipX + 6, rowY + 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...gold);
      doc.text(`${stats.count} items (${stats.totalQty} total qty)`, chipX + 6, rowY + 22);

      colIdx++;
      if (colIdx >= 4) {
        colIdx = 0;
        rowY += chipHeight + 6;
      }
    });

    currentY = (colIdx === 0 ? rowY : rowY + chipHeight + 6) + 10;
  }

  // 4. Data Table
  const colWidths = {
    idx: 24,
    date: 70,
    branch: 85,
    category: 85,
    item: 135,
    unit: 40,
    requested: 44,
    status: 40
  };

  const drawTableHeader = (yPos) => {
    doc.setFillColor(...creamSurface);
    doc.rect(marginX, yPos, tableWidth, 22, 'F');
    doc.setDrawColor(...borderTone);
    doc.rect(marginX, yPos, tableWidth, 22, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...darkGreen);

    let curX = marginX + 4;
    doc.text('#', curX, yPos + 14);
    curX += colWidths.idx;

    doc.text('Date', curX, yPos + 14);
    curX += colWidths.date;

    doc.text('Branch', curX, yPos + 14);
    curX += colWidths.branch;

    doc.text('Category', curX, yPos + 14);
    curX += colWidths.category;

    doc.text('Item Name', curX, yPos + 14);
    curX += colWidths.item;

    doc.text('Unit', curX, yPos + 14);
    curX += colWidths.unit;

    doc.text('Req Qty', curX, yPos + 14);
    curX += colWidths.requested;

    doc.text('Status', curX, yPos + 14);

    return yPos + 22;
  };

  currentY = drawTableHeader(currentY);

  if (!items || items.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(marginX, currentY, tableWidth, 30, 'F');
    doc.setDrawColor(...borderTone);
    doc.rect(marginX, currentY, tableWidth, 30, 'S');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...mutedText);
    doc.text('No branch requests recorded matching the selected filter criteria.', marginX + 14, currentY + 18);
    currentY += 30;
  } else {
    items.forEach((it, idx) => {
      const rowHeight = 20;
      if (currentY + rowHeight > pageHeight - 45) {
        doc.addPage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...darkGreen);
        doc.text('Annamithra — Branch Requests Report (Continued)', marginX, 30);
        currentY = drawTableHeader(40);
      }

      doc.setFillColor(idx % 2 === 0 ? 255 : 252, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 246);
      doc.rect(marginX, currentY, tableWidth, rowHeight, 'F');
      doc.setDrawColor(...borderTone);
      doc.rect(marginX, currentY, tableWidth, rowHeight, 'S');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...darkText);

      let curX = marginX + 4;
      doc.text(String(idx + 1), curX, currentY + 13);
      curX += colWidths.idx;

      const dateStrClean = String(it.date || it.requestDate || it.createdAt || '').slice(0, 10);
      doc.text(dateStrClean, curX, currentY + 13);
      curX += colWidths.date;

      const branchName = String(it.branchName || it.branch || '—');
      doc.text(branchName.length > 14 ? branchName.slice(0, 12) + '..' : branchName, curX, currentY + 13);
      curX += colWidths.branch;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkGreen);
      const catVal = String(it.category || '—');
      doc.text(catVal.length > 15 ? catVal.slice(0, 13) + '..' : catVal, curX, currentY + 13);
      curX += colWidths.category;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkText);
      const itemName = String(it.itemName || it.item || '—');
      doc.text(itemName.length > 25 ? itemName.slice(0, 23) + '..' : itemName, curX, currentY + 13);
      curX += colWidths.item;

      doc.text(String(it.unit || 'KG'), curX, currentY + 13);
      curX += colWidths.unit;

      doc.setFont('helvetica', 'bold');
      doc.text(String(it.requestedQuantity || it.requested || 0), curX, currentY + 13);
      curX += colWidths.requested;

      doc.setFont('helvetica', 'normal');
      doc.text(String(it.status || 'PENDING'), curX, currentY + 13);

      currentY += rowHeight;
    });
  }

  // Footer / Totals
  const totalQty = items.reduce((sum, it) => sum + (Number(it.requestedQuantity || it.requested || 0)), 0);
  const footerHeight = 24;
  if (currentY + footerHeight > pageHeight - 35) {
    doc.addPage();
    currentY = 40;
  }

  doc.setFillColor(...creamSurface);
  doc.rect(marginX, currentY, tableWidth, footerHeight, 'F');
  doc.setDrawColor(...borderTone);
  doc.rect(marginX, currentY, tableWidth, footerHeight, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkGreen);
  doc.text(`Total Records: ${items.length}   |   Cumulative Quantity: ${totalQty}`, marginX + 10, currentY + 16);

  const fileName = `branch_requests_report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
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
  singleBranch = null
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
    'packaging': 'பேக்கேஜிங் பொருட்கள்'
  };

  const translateCategory = (cat) => {
    if (!cat) return isTa ? 'வகைப்படுத்தப்படாதது' : 'Uncategorized';
    if (!isTa) return cat;
    const lower = String(cat).toLowerCase().trim();
    return categoryTranslations[lower] || cat;
  };

  // Status helper mapping to match existing application logic
  const getStatusBadge = (req) => {
    const reqQty = Number(req.requested || req.requestedQuantity || 0);
    const dispQty = Number(req.dispatched || req.dispatchedQuantity || 0);
    const recQty = Number(req.received || req.acknowledgedReceivedQuantity || 0);

    if (reqQty > 0 && recQty >= reqQty) {
      return {
        text: isTa ? 'நிறைவடைந்தது' : 'Completed',
        color: '#15803d',
        bg: '#f0fdf4',
        border: '#bbf7d0'
      };
    }
    if (recQty > 0) {
      return {
        text: isTa ? 'பகுதி பெறப்பட்டது' : 'Partially Delivered',
        color: '#b45309',
        bg: '#fffbeb',
        border: '#fde68a'
      };
    }
    if (dispQty >= reqQty && reqQty > 0) {
      return {
        text: isTa ? 'ஒப்புதல் நிலுவை' : 'Pending Acknowledgement',
        color: '#0369a1',
        bg: '#f0f9ff',
        border: '#bae6fd'
      };
    }
    if (dispQty > 0) {
      return {
        text: isTa ? 'பகுதி விநியோகம்' : 'Partially Dispatched',
        color: '#c2410c',
        bg: '#fff7ed',
        border: '#fed7aa'
      };
    }
    return {
      text: isTa ? 'நிலுவையில்' : 'Pending',
      color: '#b91c1c',
      bg: '#fef2f2',
      border: '#fecaca'
    };
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
  let grandTotalDispatchedQty = 0;
  let grandTotalRemainingQty = 0;

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
    const bDispQty = branchReqs.reduce((sum, r) => sum + (Number(r.dispatched || r.dispatchedQuantity || 0)), 0);
    const bRemQty = Math.max(0, bReqQty - bDispQty);

    grandTotalRequests += branchReqs.length;
    grandTotalRequestedQty += bReqQty;
    grandTotalDispatchedQty += bDispQty;
    grandTotalRemainingQty += bRemQty;

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
      totalDispatched: bDispQty,
      totalRemaining: bRemQty,
      earliestTimeStr
    };
  });

  // Page construction engine (discrete A4 pages)
  // Standard A4 at 96 DPI: 794px width x 1122px height
  const PAGE_WIDTH_PX = 794;
  const PAGE_HEIGHT_PX = 1122;

  // Maximum content heights before breaking to new page
  const PAGE_1_MAX_HEIGHT = 830; // Accounts for large header banner + filters card + footer
  const SUBSEQUENT_PAGE_MAX_HEIGHT = 930; // Accounts for compact running header + footer

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
    pageEl.style.fontFamily = "'Noto Sans Tamil', 'Nirmala UI', system-ui, -apple-system, sans-serif";
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
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; color: #ffffff;">
                ${singleBranch
                  ? (isTa ? `அன்னமித்ரா — ${singleBranch.name || 'கிளை'} கோரிக்கை அறிக்கை` : `Annamithra — ${singleBranch.name || 'Branch'} Request Report`)
                  : (isTa ? 'அன்னமித்ரா — அனைத்து கிளைகள் கோரிக்கைகள் அறிக்கை' : 'Annamithra — All Branches Requests Report')}
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
            <div style="font-size: 12px; font-weight: 700; color: #ffffff; margin-top: 2px;">
              ${generationTimestamp}
            </div>
          </div>
        </div>

        <!-- Scope & Summary Details Bar -->
        <div style="background: #FCFAF3; border: 1px solid #E5DDC9; border-top: none; border-radius: 0 0 8px 8px; padding: 12px 18px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; gap: 16px; font-size: 12px; flex-wrap: wrap; align-items: center;">
            ${singleBranch ? `
              <div>
                <span style="color: #5A6962; font-weight: 600;">${isTa ? 'கிளை:' : 'Branch:'}</span>
                <strong style="color: #003B2B; margin-left: 5px;">
                  🏪 ${singleBranch.name || ''} ${singleBranch.location ? `(📍 ${singleBranch.location})` : ''}
                </strong>
              </div>
            ` : ''}
            <div>
              <span style="color: #5A6962; font-weight: 600;">${isTa ? 'தேர்வு வரம்பு:' : 'Selected Filter Scope:'}</span>
              <strong style="color: #003B2B; margin-left: 5px; background: #F5EFE0; padding: 2px 8px; border-radius: 4px; border: 1px solid #E5DDC9;">
                📅 ${filterScopeLabel}
              </strong>
            </div>
            ${!singleBranch ? `
              <div>
                <span style="color: #5A6962; font-weight: 600;">${isTa ? 'வரிசை முறை:' : 'Display Order:'}</span>
                <strong style="color: #003B2B; margin-left: 5px;">
                  ${isTa ? 'முதல் கோரிக்கை முதலில் (Oldest Request First)' : 'First Request Submission Order'}
                </strong>
              </div>
            ` : ''}
          </div>

          <div style="font-size: 12px; color: #17352B; font-weight: 700;">
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
            ? (isTa ? `அன்னமித்ரா — ${singleBranch.name || 'கிளை'} கோரிக்கைகள் (தொடர்ச்சி)` : `Annamithra — ${singleBranch.name || 'Branch'} Requests (Continued)`)
            : (isTa ? 'அன்னமித்ரா — அனைத்து கிளைகள் கோரிக்கைகள் அறிக்கை (தொடர்ச்சி)' : 'Annamithra — All Branches Requests Report (Continued)')}
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
      const tableHeaderHeight = 32;
      const rowHeight = 30;
      const summaryRowHeight = 34;

      // Estimate space needed for at least 1 row
      const minNeededSpace = branchHeaderHeight + tableHeaderHeight + rowHeight + 16;
      if (currentContentHeight + minNeededSpace > currentMax && currentContentHeight > 0) {
        startNewPage();
      }

      const remainingSpace = (currentPageIndex === 0 ? PAGE_1_MAX_HEIGHT : SUBSEQUENT_PAGE_MAX_HEIGHT) - currentContentHeight;
      const rowsAvailableSpace = remainingSpace - branchHeaderHeight - tableHeaderHeight - 16;
      let rowsToTake = Math.max(1, Math.floor(rowsAvailableSpace / rowHeight));

      const isLastChunk = (rowIndex + rowsToTake) >= bReqs.length;
      // Reserve space for summary row if this is the last chunk
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
        <div style="background: #FDFBF7; padding: 8px 14px; border-bottom: 1px solid #E5DDC9; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #003B2B;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <strong style="font-size: 13.5px; color: #003B2B;">🏪 ${bName}${branchTitleSuffix}</strong>
            ${bLoc ? `<span style="font-size: 11px; color: #5A6962;">📍 ${bLoc}</span>` : ''}
            ${!isBranchContinuation && bData.earliestTimeStr !== '—' ? `
              <span style="font-size: 10.5px; color: #003B2B; background: #F5EFE0; padding: 2px 7px; border-radius: 4px; font-weight: 600; border: 1px solid #E5DDC9;">
                🕒 ${isTa ? 'முதல் கோரிக்கை:' : 'Earliest Req:'} ${bData.earliestTimeStr}
              </span>
            ` : ''}
          </div>
          <div style="font-size: 11.5px; font-weight: 700; color: #003B2B;">
            ${bData.totalItems} ${isTa ? 'பொருட்கள்' : 'Items'} &nbsp;|&nbsp;
            ${isTa ? 'கோரிக்கை:' : 'Req:'} ${bData.totalRequested} &nbsp;|&nbsp;
            ${isTa ? 'விநியோகம்:' : 'Dispatched:'} ${bData.totalDispatched} &nbsp;|&nbsp;
            ${isTa ? 'மீதம்:' : 'Remaining:'} <span style="color: ${bData.totalRemaining > 0 ? '#b91c1c' : '#15803d'}">${bData.totalRemaining}</span>
          </div>
        </div>
      `;

      // Table Element
      const table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.fontSize = '11px';

      // Table Header
      table.innerHTML = `
        <thead>
          <tr style="background: #F5EFE0; border-bottom: 1px solid #E5DDC9; color: #003B2B; font-weight: 700;">
            <th style="padding: 7px 8px; text-align: center; width: 28px; border-right: 1px solid #E5DDC9;">#</th>
            <th style="padding: 7px 8px; text-align: left; width: 115px; border-right: 1px solid #E5DDC9;">
              ${isTa ? 'கோரிக்கை நேரம்' : 'Req Date & Time'}
            </th>
            <th style="padding: 7px 8px; text-align: left; width: 140px; border-right: 1px solid #E5DDC9;">
              ${isTa ? 'பொருளின் பெயர்' : 'Item Name'}
            </th>
            <th style="padding: 7px 8px; text-align: left; width: 95px; border-right: 1px solid #E5DDC9;">
              ${isTa ? 'வகை' : 'Category'}
            </th>
            <th style="padding: 7px 8px; text-align: center; width: 45px; border-right: 1px solid #E5DDC9;">
              ${isTa ? 'அலகு' : 'Unit'}
            </th>
            <th style="padding: 7px 8px; text-align: right; width: 55px; border-right: 1px solid #E5DDC9;">
              ${isTa ? 'மொத்த அளவு' : 'Total Req'}
            </th>
            <th style="padding: 7px 8px; text-align: right; width: 55px; border-right: 1px solid #E5DDC9;">
              ${isTa ? 'விநியோகம்' : 'Dispatched'}
            </th>
            <th style="padding: 7px 8px; text-align: right; width: 55px; border-right: 1px solid #E5DDC9;">
              ${isTa ? 'மீதமுள்ளவை' : 'Remaining'}
            </th>
            <th style="padding: 7px 8px; text-align: center; width: 110px;">
              ${isTa ? 'தற்போதைய நிலை' : 'Dispatch Status'}
            </th>
          </tr>
        </thead>
      `;

      const tbody = document.createElement('tbody');

      currentChunkRows.forEach((r, idx) => {
        const itemGlobalIndex = rowIndex + idx + 1;
        const itemName = isTa ? translateItemName(r.item || r.itemName) : (r.item || r.itemName || '—');
        const unitName = isTa ? translateUnitName(r.unit) : (r.unit || 'KG');
        const categoryName = translateCategory(r.category);
        const reqQty = Number(r.requested || r.requestedQuantity || 0);
        const dispQty = Number(r.dispatched || r.dispatchedQuantity || 0);
        const remQty = Math.max(0, reqQty - dispQty);
        const statusBadge = getStatusBadge(r);
        const reqDateTimeStr = formatDateTime(r.createdAt, r.requestDate);

        const rowBg = idx % 2 === 0 ? '#ffffff' : '#FCFAF3';
        const tr = document.createElement('tr');
        tr.style.backgroundColor = rowBg;
        tr.style.borderBottom = '1px solid #E5DDC9';

        tr.innerHTML = `
          <td style="padding: 6px 8px; text-align: center; color: #5A6962; border-right: 1px solid #E5DDC9;">
            ${itemGlobalIndex}
          </td>
          <td style="padding: 6px 8px; color: #17352B; font-weight: 500; font-size: 10.5px; border-right: 1px solid #E5DDC9;">
            ${reqDateTimeStr}
          </td>
          <td style="padding: 6px 8px; color: #17352B; font-weight: 700; border-right: 1px solid #E5DDC9;">
            ${itemName}
          </td>
          <td style="padding: 6px 8px; color: #5A6962; border-right: 1px solid #E5DDC9;">
            <span style="background: #F5EFE0; padding: 2px 6px; border-radius: 3px; font-size: 10px; color: #003B2B; font-weight: 600;">
              ${categoryName}
            </span>
          </td>
          <td style="padding: 6px 8px; text-align: center; color: #5A6962; font-weight: 500; border-right: 1px solid #E5DDC9;">
            ${unitName}
          </td>
          <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: #003B2B; border-right: 1px solid #E5DDC9;">
            ${reqQty}
          </td>
          <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: #0369a1; border-right: 1px solid #E5DDC9;">
            ${dispQty}
          </td>
          <td style="padding: 6px 8px; text-align: right; font-weight: 700; color: ${remQty > 0 ? '#b91c1c' : '#15803d'}; border-right: 1px solid #E5DDC9;">
            ${remQty}
          </td>
          <td style="padding: 6px 8px; text-align: center;">
            <span style="background: ${statusBadge.bg}; color: ${statusBadge.color}; border: 1px solid ${statusBadge.border}; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; display: inline-block;">
              ${statusBadge.text}
            </span>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // If last chunk for this branch, append Branch Total Subtotal Row
      if (isActualLastChunk) {
        const subtotalTr = document.createElement('tr');
        subtotalTr.style.background = '#F5EFE0';
        subtotalTr.style.borderTop = '2px solid #D4A63B';
        subtotalTr.style.fontWeight = '700';
        subtotalTr.style.fontSize = '11px';
        subtotalTr.style.color = '#003B2B';
        subtotalTr.innerHTML = `
          <td colspan="5" style="padding: 6px 12px; text-align: right; border-right: 1px solid #E5DDC9;">
            ${isTa ? `கிளை சுருக்கம் (${bName}):` : `Branch Total (${bName}):`}
          </td>
          <td style="padding: 6px 8px; text-align: right; border-right: 1px solid #E5DDC9;">
            ${bData.totalRequested}
          </td>
          <td style="padding: 6px 8px; text-align: right; border-right: 1px solid #E5DDC9; color: #0369a1;">
            ${bData.totalDispatched}
          </td>
          <td style="padding: 6px 8px; text-align: right; border-right: 1px solid #E5DDC9; color: ${bData.totalRemaining > 0 ? '#b91c1c' : '#15803d'};">
            ${bData.totalRemaining}
          </td>
          <td style="padding: 6px 8px; text-align: center; color: #5A6962; font-size: 10px;">
            ${bData.totalItems} ${isTa ? 'உருப்படிகள்' : 'Items'}
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
        <div style="font-size: 13.5px; font-weight: 800; color: #ffffff;">
          🏆 ${singleBranch
            ? (isTa ? `${singleBranch.name || 'கிளை'} ஒட்டுமொத்த சுருக்கம்` : `${singleBranch.name || 'Branch'} — Summary Totals`)
            : (isTa ? 'அறிக்கை ஒட்டுமொத்த சுருக்கம் (Grand Report Totals)' : 'Grand Report Summary')}
        </div>
        <div style="font-size: 11px; color: #D4A63B; margin-top: 2px;">
          ${singleBranch
            ? (isTa ? `கிளை: ${singleBranch.name}  |  மொத்த கோரிக்கைப் பதிவுகள்: ${grandTotalRequests}` : `Branch: ${singleBranch.name}  |  Total Request Records: ${grandTotalRequests}`)
            : (isTa ? `மொத்த அங்கீகரிக்கப்பட்ட கிளைகள்: ${grandTotalBranches}  |  மொத்த கோரிக்கைப் பதிவுகள்: ${grandTotalRequests}` : `Total Authorized Branches: ${grandTotalBranches}  |  Total Request Records: ${grandTotalRequests}`)}
        </div>
      </div>
      <div style="display: flex; gap: 20px; font-size: 12px; font-weight: 700;">
        <div style="text-align: right;">
          <div style="font-size: 10px; color: #E5DDC9; font-weight: 500;">${isTa ? 'மொத்த கோரிக்கை' : 'Total Requested'}</div>
          <div style="font-size: 15px; color: #ffffff;">${grandTotalRequestedQty}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 10px; color: #E5DDC9; font-weight: 500;">${isTa ? 'மொத்த விநியோகம்' : 'Total Dispatched'}</div>
          <div style="font-size: 15px; color: #7dd3fc;">${grandTotalDispatchedQty}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 10px; color: #E5DDC9; font-weight: 500;">${isTa ? 'மீதமுள்ள நிலுவை' : 'Total Remaining'}</div>
          <div style="font-size: 15px; color: ${grandTotalRemainingQty > 0 ? '#fca5a5' : '#86efac'};">${grandTotalRemainingQty}</div>
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
      fileName = `${cleanBranch}_Requests_${cleanDate}.pdf`;
    } else {
      fileName = `Annamithra_All_Branches_Requests_${cleanDate}.pdf`;
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
 * Generates and downloads a clean, professional PDF of the Branch Order Items list or Draft.
 * Contains Annamithra heading, organisation, branch name, order/draft date, item name, category, unit, quantity, and total item count.
 */
export async function downloadBranchOrderListPdf({
  organisationName = 'Annamithra',
  branchName = 'Branch',
  department = '',
  date = '',
  items = [],
  isDraft = false,
  draftName = '',
  language = 'en'
} = {}) {
  const isTa = language === 'ta';
  const displayDate = date || new Date().toISOString().split('T')[0];
  const ITEMS_PER_PAGE = 18;
  const safeItems = Array.isArray(items) ? items : [];
  const totalPages = Math.max(1, Math.ceil(safeItems.length / ITEMS_PER_PAGE));
  const totalQuantity = Math.round(safeItems.reduce((acc, it) => acc + (Number(it.requestedQuantity ?? it.quantity) || 0), 0) * 1000) / 1000;
  const totalItemCount = safeItems.length;

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
    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const startIdx = pageIdx * ITEMS_PER_PAGE;
      const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, safeItems.length);
      const pageItems = safeItems.slice(startIdx, endIdx);
      const isLastPage = pageIdx === totalPages - 1;

      const pageEl = document.createElement('div');
      pageEl.style.width = `${PAGE_WIDTH_PX}px`;
      pageEl.style.minHeight = `${PAGE_MIN_HEIGHT_PX}px`;
      pageEl.style.padding = '40px 48px';
      pageEl.style.boxSizing = 'border-box';
      pageEl.style.background = '#FDFBF7';
      pageEl.style.fontFamily = "'Noto Sans Tamil', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      pageEl.style.color = '#17352B';
      pageEl.style.display = 'flex';
      pageEl.style.flexDirection = 'column';
      pageEl.style.justifyContent = 'space-between';

      let itemsRowsHtml = '';
      if (pageItems.length === 0) {
        itemsRowsHtml = `
          <tr>
            <td colspan="5" style="padding: 24px 14px; text-align: center; color: #5A6962; font-style: italic; border: 1px solid #E5DDC9; background: #ffffff;">
              ${isTa ? 'கோரிக்கை பட்டியலில் பொருட்கள் எதுவும் இல்லை.' : 'No items in the order list.'}
            </td>
          </tr>
        `;
      } else {
        pageItems.forEach((it, idx) => {
          const rowNum = startIdx + idx + 1;
          const rawName = String(it.itemName || it.item || '').trim();
          const translatedName = isTa ? translateItemName(rawName) : rawName;
          const rawDepartment = String(it.department || it.category || department || 'General').trim();
          const rawUnit = String(it.unit || 'KG').trim();
          const translatedUnit = isTa ? translateUnitName(rawUnit) : rawUnit;
          const qty = Number(it.requestedQuantity ?? it.quantity) || 0;
          const bg = idx % 2 === 0 ? '#ffffff' : '#FAF6EC';

          itemsRowsHtml += `
            <tr style="background: ${bg}; border-bottom: 1px solid #E5DDC9;">
              <td style="padding: 9px 12px; text-align: center; color: #5A6962; font-size: 12px; border: 1px solid #E5DDC9; width: 45px;">
                ${rowNum}
              </td>
              <td style="padding: 9px 14px; border: 1px solid #E5DDC9; font-weight: 600; color: #17352B; font-size: 13.5px;">
                ${translatedName}
                ${it.isNewItem ? `<span style="font-size: 10px; color: #b45309; margin-left: 6px; font-weight: 700;">[${isTa ? 'புதிய பொருள்' : 'New'}]</span>` : ''}
              </td>
              <td style="padding: 9px 12px; border: 1px solid #E5DDC9; font-size: 12.5px; color: #4b5563;">
                <span style="background: #e2ece9; color: #003B2B; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">
                  ${rawDepartment}
                </span>
              </td>
              <td style="padding: 9px 12px; text-align: center; border: 1px solid #E5DDC9; color: #5A6962; font-size: 12.5px; font-weight: 600;">
                ${translatedUnit}
              </td>
              <td style="padding: 9px 14px; text-align: right; border: 1px solid #E5DDC9; font-weight: 700; color: #003B2B; font-size: 14px;">
                ${qty}
              </td>
            </tr>
          `;
        });
      }

      pageEl.innerHTML = `
        <div>
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
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
              <p style="margin: 3px 0 0 0; font-size: 12.5px; font-weight: 700; color: #D4A63B; text-transform: uppercase; letter-spacing: 0.8px;">
                ${isTa ? 'உணவக மற்றும் கிளை மேலாண்மை' : 'FOOD & RESTAURANT MANAGEMENT'}
              </p>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 15px; font-weight: 800; color: #003B2B;">
                ${isDraft ? (isTa ? 'கிளை வரைவு ஆர்டர்' : 'Branch Order Draft') : (isTa ? 'கிளை ஆர்டர் பட்டியல்' : 'Branch Order List')}
              </div>
              <div style="font-size: 11.5px; color: #5A6962; margin-top: 2px;">
                ${isTa ? `பக்கம் ${pageIdx + 1} / ${totalPages}` : `Page ${pageIdx + 1} of ${totalPages}`}
              </div>
            </div>
          </div>

          <!-- Gold Accent Bar -->
          <div style="height: 3px; background: linear-gradient(90deg, #D4A63B, #F3D98B, #D4A63B); margin: 12px 0 16px 0; border-radius: 2px;"></div>

          <!-- Metadata Box -->
          <div style="background: #ffffff; border: 1.5px solid #D4A63B; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; font-size: 13px;">
              <div>
                <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                  ${isTa ? 'நிறுவனம் (Organisation)' : 'Organisation'}
                </span>
                <strong style="color: #003B2B; font-size: 14px;">${organisationName || 'Saravana Bhavan'}</strong>
              </div>
              <div>
                <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                  ${isTa ? 'கிளை பெயர் (Branch)' : 'Branch Name'}
                </span>
                <strong style="color: #003B2B; font-size: 14px;">${branchName || 'Branch'}</strong>
              </div>
              <div>
                <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                  ${isTa ? 'தேதி (Date)' : 'Order Date'}
                </span>
                <strong style="color: #17352B; font-size: 14px;">${displayDate}</strong>
              </div>
              <div>
                <span style="color: #5A6962; font-size: 11px; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">
                  ${isTa ? 'பிரிவு (Department)' : 'Department'}
                </span>
                <strong style="color: #003B2B; font-size: 14px;">
                  ${department || (safeItems[0] && (safeItems[0].department || safeItems[0].category)) || 'General'}
                </strong>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <thead>
              <tr style="background: #003B2B; color: #ffffff;">
                <th style="padding: 10px 12px; text-align: center; font-size: 12px; font-weight: 700; border: 1px solid #003B2B; width: 45px;">
                  #
                </th>
                <th style="padding: 10px 14px; text-align: left; font-size: 12.5px; font-weight: 700; border: 1px solid #003B2B;">
                  ${isTa ? 'பொருளின் பெயர் (Item Name)' : 'Item Name'}
                </th>
                <th style="padding: 10px 12px; text-align: left; font-size: 12.5px; font-weight: 700; border: 1px solid #003B2B; width: 140px;">
                  ${isTa ? 'பிரிவு (Department)' : 'Department'}
                </th>
                <th style="padding: 10px 12px; text-align: center; font-size: 12.5px; font-weight: 700; border: 1px solid #003B2B; width: 90px;">
                  ${isTa ? 'அலகு (Unit)' : 'Unit'}
                </th>
                <th style="padding: 10px 14px; text-align: right; font-size: 12.5px; font-weight: 700; border: 1px solid #003B2B; width: 110px;">
                  ${isTa ? 'அளவு (Quantity)' : 'Quantity'}
                </th>
              </tr>
            </thead>
            <tbody>
              ${itemsRowsHtml}
            </tbody>
            ${isLastPage && safeItems.length > 0 ? `
              <tfoot>
                <tr style="background: #F5EFE0; border: 2px solid #D4A63B; font-weight: 800; color: #003B2B;">
                  <td colspan="4" style="padding: 11px 14px; text-align: right; font-size: 13.5px; border: 1px solid #E5DDC9;">
                    ${isTa ? `மொத்தம் (${totalItemCount} உருப்படிகள்):` : `Grand Total (${totalItemCount} Items):`}
                  </td>
                  <td style="padding: 11px 14px; text-align: right; font-size: 15px; color: #003B2B; border: 1px solid #E5DDC9;">
                    ${totalQuantity}
                  </td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
        </div>

        <!-- Footer -->
        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #E5DDC9; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #5A6962;">
          <div>
            ${isTa ? 'அன்னமித்ரா உணவக மேலாண்மை அமைப்பு • அதிகாரப்பூர்வ ஆவணம்' : 'Annamithra Restaurant Management System • Official Document'}
          </div>
          <div>
            ${isTa ? `உருவாக்கப்பட்ட தேதி: ${new Date().toLocaleDateString('ta-IN')}` : `Generated on ${new Date().toLocaleDateString('en-GB')}`}
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
      if (pageIdx > 0) {
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

// =========================================================================
// SIMPLIFIED OPERATIONAL REPORT PDF & CSV EXPORTERS
// =========================================================================

const THEME = {
  darkGreen: [0, 59, 43],       // #003B2B
  secondaryGreen: [7, 84, 61],  // #07543D
  gold: [212, 166, 59],         // #D4A63B
  creamSurface: [251, 247, 236],// #FBF7EC
  headerBg: [245, 239, 224],    // #F5EFE0
  borderTone: [229, 221, 201],  // #E5DDC9
  darkText: [23, 53, 43],       // #17352B
  mutedText: [102, 102, 102],
  rowAlt: [252, 250, 243]
};

function drawReportHeader(doc, title, subtitle, dateLabel) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 36;

  // Header Banner
  doc.setFillColor(...THEME.darkGreen);
  doc.rect(0, 0, pageWidth, 52, 'F');

  doc.setFillColor(...THEME.gold);
  doc.rect(0, 52, pageWidth, 3.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text(`Annamithra — ${title}`, marginX, 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(230, 240, 235);
  const genStr = `Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  doc.text(genStr, pageWidth - marginX - doc.getTextWidth(genStr), 32);

  // Scope box
  const boxY = 66;
  const boxWidth = pageWidth - (marginX * 2);
  doc.setFillColor(...THEME.creamSurface);
  doc.roundedRect(marginX, boxY, boxWidth, 34, 4, 4, 'FD');
  doc.setDrawColor(...THEME.borderTone);
  doc.setLineWidth(1);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...THEME.darkGreen);
  doc.text(subtitle, marginX + 12, boxY + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...THEME.mutedText);
  doc.text(`Date Scope: ${dateLabel || 'All Dates'}`, marginX + 12, boxY + 27);

  return boxY + 44;
}

function drawReportFooter(doc, pageNum, totalPages) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 36;
  const footerY = pageHeight - 22;

  doc.setDrawColor(...THEME.borderTone);
  doc.setLineWidth(0.5);
  doc.line(marginX, footerY - 8, pageWidth - marginX, footerY - 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...THEME.mutedText);
  doc.text('Annamithra Food & Restaurant Management • Confidential', marginX, footerY);

  const pageStr = `Page ${pageNum} of ${totalPages}`;
  doc.text(pageStr, pageWidth - marginX - doc.getTextWidth(pageStr), footerY);
}

/**
 * 1. Simple Inventory Report PDF
 * Columns: Item Name, Unit, Current Stock, Last Updated Date
 */
export async function downloadSimpleInventoryPdf({ items = [], dateLabel = 'All Dates' } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 36;
  const tableWidth = pageWidth - (marginX * 2);

  const colWidths = { idx: 28, item: 235, unit: 65, stock: 85, updated: 110 };
  const totalStock = items.reduce((sum, it) => sum + (Number(it.currentStock) || 0), 0);

  const subtitle = `Total Items: ${items.length}   |   Total Central Stock: ${totalStock.toLocaleString()}`;
  let currentY = drawReportHeader(doc, 'Inventory Report', subtitle, dateLabel);

  const drawHeaders = (y) => {
    doc.setFillColor(...THEME.headerBg);
    doc.rect(marginX, y, tableWidth, 22, 'F');
    doc.setDrawColor(...THEME.borderTone);
    doc.rect(marginX, y, tableWidth, 22, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...THEME.darkGreen);

    let x = marginX + 4;
    doc.text('#', x, y + 14); x += colWidths.idx;
    doc.text('Item Name', x, y + 14); x += colWidths.item;
    doc.text('Unit', x, y + 14); x += colWidths.unit;
    doc.text('Current Stock', x + colWidths.stock - 8, y + 14, { align: 'right' }); x += colWidths.stock;
    doc.text('Last Updated', x, y + 14);

    return y + 22;
  };

  currentY = drawHeaders(currentY);

  if (items.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(marginX, currentY, tableWidth, 30, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...THEME.mutedText);
    doc.text('No inventory records found matching the selected filter criteria.', marginX + 12, currentY + 18);
  } else {
    items.forEach((it, idx) => {
      if (currentY + 20 > pageHeight - 45) {
        doc.addPage();
        currentY = drawHeaders(36);
      }

      doc.setFillColor(...(idx % 2 === 1 ? THEME.rowAlt : [255, 255, 255]));
      doc.rect(marginX, currentY, tableWidth, 20, 'F');
      doc.setDrawColor(...THEME.borderTone);
      doc.setLineWidth(0.5);
      doc.line(marginX, currentY + 20, marginX + tableWidth, currentY + 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...THEME.darkText);

      let x = marginX + 4;
      doc.text(String(idx + 1), x, currentY + 13); x += colWidths.idx;

      const itemDisplay = String(it.itemName || it.name || '—');
      doc.text(itemDisplay.length > 38 ? itemDisplay.slice(0, 36) + '..' : itemDisplay, x, currentY + 13);
      x += colWidths.item;

      doc.text(String(it.unit || '—'), x, currentY + 13); x += colWidths.unit;

      doc.setFont('helvetica', 'bold');
      const stockVal = Number(it.currentStock) || 0;
      doc.text(stockVal.toLocaleString(), x + colWidths.stock - 8, currentY + 13, { align: 'right' });
      x += colWidths.stock;

      doc.setFont('helvetica', 'normal');
      const dateDisplay = String(it.formattedLastUpdated || it.lastUpdated || '—');
      doc.text(dateDisplay.length > 22 ? dateDisplay.slice(0, 20) + '..' : dateDisplay, x, currentY + 13);

      currentY += 20;
    });

    // Summary Row
    if (currentY + 24 > pageHeight - 45) {
      doc.addPage();
      currentY = 36;
    }
    doc.setFillColor(...THEME.headerBg);
    doc.rect(marginX, currentY, tableWidth, 22, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...THEME.darkGreen);
    doc.text(`Total Items: ${items.length}`, marginX + 8, currentY + 15);
    doc.text(`Total Stock: ${totalStock.toLocaleString()}`, marginX + tableWidth - 12, currentY + 15, { align: 'right' });
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawReportFooter(doc, i, pageCount);
  }

  const filename = `Annamithra_Inventory_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return true;
}

/**
 * 2. Simple Branch Request Report PDF
 * Columns: Branch Name, Item Name, Requested Quantity, Request Date, Status
 */
export async function downloadSimpleBranchRequestPdf({ items = [], branch = 'All Branches', dateLabel = 'All Dates' } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 36;
  const tableWidth = pageWidth - (marginX * 2);

  const colWidths = { idx: 24, branch: 95, dept: 75, item: 140, unit: 38, qty: 52, date: 50, status: 49 };
  const totalQty = items.reduce((sum, it) => sum + (Number(it.requestedQuantity) || 0), 0);

  const subtitle = `Branch: ${branch || 'All Branches'}   |   Total Requests: ${items.length}   |   Total Requested: ${totalQty.toLocaleString()}`;
  let currentY = drawReportHeader(doc, 'Branch Request Report', subtitle, dateLabel);

  const drawHeaders = (y) => {
    doc.setFillColor(...THEME.headerBg);
    doc.rect(marginX, y, tableWidth, 22, 'F');
    doc.setDrawColor(...THEME.borderTone);
    doc.rect(marginX, y, tableWidth, 22, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...THEME.darkGreen);

    let x = marginX + 4;
    doc.text('#', x, y + 14); x += colWidths.idx;
    doc.text('Branch Name', x, y + 14); x += colWidths.branch;
    doc.text('Department', x, y + 14); x += colWidths.dept;
    doc.text('Item Name', x, y + 14); x += colWidths.item;
    doc.text('Unit', x, y + 14); x += colWidths.unit;
    doc.text('Requested', x + colWidths.qty - 6, y + 14, { align: 'right' }); x += colWidths.qty;
    doc.text('Date', x, y + 14); x += colWidths.date;
    doc.text('Status', x, y + 14);

    return y + 22;
  };

  currentY = drawHeaders(currentY);

  if (items.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(marginX, currentY, tableWidth, 30, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...THEME.mutedText);
    doc.text('No branch request records found matching the selected filter criteria.', marginX + 12, currentY + 18);
  } else {
    items.forEach((it, idx) => {
      if (currentY + 20 > pageHeight - 45) {
        doc.addPage();
        currentY = drawHeaders(36);
      }

      doc.setFillColor(...(idx % 2 === 1 ? THEME.rowAlt : [255, 255, 255]));
      doc.rect(marginX, currentY, tableWidth, 20, 'F');
      doc.setDrawColor(...THEME.borderTone);
      doc.setLineWidth(0.5);
      doc.line(marginX, currentY + 20, marginX + tableWidth, currentY + 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...THEME.darkText);

      let x = marginX + 4;
      doc.text(String(idx + 1), x, currentY + 13); x += colWidths.idx;

      const brName = String(it.branchName || it.branch || '—');
      doc.text(brName.length > 15 ? brName.slice(0, 13) + '..' : brName, x, currentY + 13);
      x += colWidths.branch;

      const deptName = String(it.department || it.category || 'Not specified');
      doc.text(deptName.length > 13 ? deptName.slice(0, 11) + '..' : deptName, x, currentY + 13);
      x += colWidths.dept;

      const itName = String(it.itemName || it.item || '—');
      doc.text(itName.length > 22 ? itName.slice(0, 20) + '..' : itName, x, currentY + 13);
      x += colWidths.item;

      doc.text(String(it.unit || '—'), x, currentY + 13); x += colWidths.unit;

      doc.setFont('helvetica', 'bold');
      const reqVal = Number(it.requestedQuantity) || 0;
      doc.text(reqVal.toLocaleString(), x + colWidths.qty - 6, currentY + 13, { align: 'right' });
      x += colWidths.qty;

      doc.setFont('helvetica', 'normal');
      const dateDisplay = String(it.formattedDate || it.date || '—');
      doc.text(dateDisplay.length > 12 ? dateDisplay.slice(0, 10) + '..' : dateDisplay, x, currentY + 13);
      x += colWidths.date;

      const st = String(it.meaningfulStatus || it.status || '—');
      doc.text(st.length > 11 ? st.slice(0, 9) + '..' : st, x, currentY + 13);

      currentY += 20;
    });

    // Summary Row
    if (currentY + 24 > pageHeight - 45) {
      doc.addPage();
      currentY = 36;
    }
    doc.setFillColor(...THEME.headerBg);
    doc.rect(marginX, currentY, tableWidth, 22, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...THEME.darkGreen);
    doc.text(`Total Requests: ${items.length}`, marginX + 8, currentY + 15);
    doc.text(`Total Requested Qty: ${totalQty.toLocaleString()}`, marginX + tableWidth - 12, currentY + 15, { align: 'right' });
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawReportFooter(doc, i, pageCount);
  }

  const filename = `Annamithra_Branch_Request_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return true;
}

/**
 * 3. Simple Dispatch Report PDF
 * Columns: Branch Name, Item Name, Dispatched Quantity, Dispatch Date, Acknowledgement Status
 */
export async function downloadSimpleDispatchPdf({ items = [], branch = 'All Branches', dateLabel = 'All Dates' } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 36;
  const tableWidth = pageWidth - (marginX * 2);

  const colWidths = { idx: 26, branch: 105, item: 165, unit: 45, qty: 65, date: 55, status: 62 };
  const totalQty = items.reduce((sum, it) => sum + (Number(it.dispatchedQuantity) || 0), 0);

  const subtitle = `Branch: ${branch || 'All Branches'}   |   Total Dispatches: ${items.length}   |   Total Dispatched: ${totalQty.toLocaleString()}`;
  let currentY = drawReportHeader(doc, 'Dispatch Report', subtitle, dateLabel);

  const drawHeaders = (y) => {
    doc.setFillColor(...THEME.headerBg);
    doc.rect(marginX, y, tableWidth, 22, 'F');
    doc.setDrawColor(...THEME.borderTone);
    doc.rect(marginX, y, tableWidth, 22, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...THEME.darkGreen);

    let x = marginX + 4;
    doc.text('#', x, y + 14); x += colWidths.idx;
    doc.text('Branch Name', x, y + 14); x += colWidths.branch;
    doc.text('Item Name', x, y + 14); x += colWidths.item;
    doc.text('Unit', x, y + 14); x += colWidths.unit;
    doc.text('Dispatched', x + colWidths.qty - 6, y + 14, { align: 'right' }); x += colWidths.qty;
    doc.text('Date', x, y + 14); x += colWidths.date;
    doc.text('Ack Status', x, y + 14);

    return y + 22;
  };

  currentY = drawHeaders(currentY);

  if (items.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(marginX, currentY, tableWidth, 30, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...THEME.mutedText);
    doc.text('No dispatch records found matching the selected filter criteria.', marginX + 12, currentY + 18);
  } else {
    items.forEach((it, idx) => {
      if (currentY + 20 > pageHeight - 45) {
        doc.addPage();
        currentY = drawHeaders(36);
      }

      doc.setFillColor(...(idx % 2 === 1 ? THEME.rowAlt : [255, 255, 255]));
      doc.rect(marginX, currentY, tableWidth, 20, 'F');
      doc.setDrawColor(...THEME.borderTone);
      doc.setLineWidth(0.5);
      doc.line(marginX, currentY + 20, marginX + tableWidth, currentY + 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...THEME.darkText);

      let x = marginX + 4;
      doc.text(String(idx + 1), x, currentY + 13); x += colWidths.idx;

      const brName = String(it.branchName || '—');
      doc.text(brName.length > 17 ? brName.slice(0, 15) + '..' : brName, x, currentY + 13);
      x += colWidths.branch;

      const itName = String(it.itemName || '—');
      doc.text(itName.length > 26 ? itName.slice(0, 24) + '..' : itName, x, currentY + 13);
      x += colWidths.item;

      doc.text(String(it.unit || '—'), x, currentY + 13); x += colWidths.unit;

      doc.setFont('helvetica', 'bold');
      const dispVal = Number(it.dispatchedQuantity) || 0;
      doc.text(dispVal.toLocaleString(), x + colWidths.qty - 6, currentY + 13, { align: 'right' });
      x += colWidths.qty;

      doc.setFont('helvetica', 'normal');
      const dateDisplay = String(it.formattedDate || it.dispatchDate || '—');
      doc.text(dateDisplay.length > 12 ? dateDisplay.slice(0, 10) + '..' : dateDisplay, x, currentY + 13);
      x += colWidths.date;

      const ackSt = String(it.meaningfulStatus || it.acknowledgementStatus || it.status || '—');
      doc.text(ackSt.length > 14 ? ackSt.slice(0, 12) + '..' : ackSt, x, currentY + 13);

      currentY += 20;
    });

    // Summary Row
    if (currentY + 24 > pageHeight - 45) {
      doc.addPage();
      currentY = 36;
    }
    doc.setFillColor(...THEME.headerBg);
    doc.rect(marginX, currentY, tableWidth, 22, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...THEME.darkGreen);
    doc.text(`Total Dispatches: ${items.length}`, marginX + 8, currentY + 15);
    doc.text(`Total Dispatched Qty: ${totalQty.toLocaleString()}`, marginX + tableWidth - 12, currentY + 15, { align: 'right' });
  }

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawReportFooter(doc, i, pageCount);
  }

  const filename = `Annamithra_Dispatch_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
  return true;
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


