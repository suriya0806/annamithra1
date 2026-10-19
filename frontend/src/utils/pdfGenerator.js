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
