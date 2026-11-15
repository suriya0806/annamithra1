import React from 'react';

/**
 * Escapes HTML characters for safe injection into raw HTML strings.
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates pure self-contained HTML for an 80mm POS monochrome thermal receipt.
 * Optimized for thermal printers (ESC/POS, Epson, Star, TVS, Sunmi) and browser print preview.
 */
export function generateThermalReceiptHtml({
  organisationName = 'Annamithra Food & Restaurant Management',
  branchName = '',
  title = 'RECEIPT',
  subtitle = '',
  dateLabel = '',
  generatedAt = '',
  metadata = [], // Array of { label, value } or strings
  columns = [], // Array of { header, key, align, width, render }
  items = [], // Array of row objects
  customBodyHtml = '', // Custom body HTML if provided
  summaryRows = [], // Array of { label, value, isBold, isTotal, isDoubleBorder }
  footerNotes = [], // Array of string lines
  language = 'en'
} = {}) {
  const isTa = language === 'ta';
  const printTimestamp = generatedAt || new Date().toLocaleString(isTa ? 'ta-IN' : 'en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  // Metadata lines
  const metaHtml = (metadata || []).map(m => {
    if (typeof m === 'string') {
      return `<div style="margin: 2px 0; font-size: 11px; word-break: break-word;">${escapeHtml(m)}</div>`;
    }
    if (!m || !m.label) return '';
    return `
      <div style="display: flex; justify-content: space-between; margin: 2px 0; font-size: 11px;">
        <span style="font-weight: 600;">${escapeHtml(m.label)}:</span>
        <span style="font-weight: 700; text-align: right; margin-left: 8px;">${escapeHtml(m.value || '—')}</span>
      </div>
    `;
  }).filter(Boolean).join('');

  // Table Headers
  const tableHeadersHtml = (columns || []).map(col => {
    const align = col.align || 'left';
    const widthStyle = col.width ? `width: ${col.width};` : '';
    return `
      <th style="padding: 4px 2px; text-align: ${align}; ${widthStyle} font-size: 10.5px; font-weight: 800; text-transform: uppercase;">
        ${escapeHtml(col.header)}
      </th>
    `;
  }).join('');

  // Table Rows
  let tableRowsHtml = '';
  if (!items || items.length === 0) {
    const colSpan = (columns || []).length || 1;
    tableRowsHtml = `
      <tr>
        <td colspan="${colSpan}" style="padding: 10px 2px; text-align: center; font-style: italic; font-size: 11px;">
          ${isTa ? 'பதிவுகள் எதுவும் இல்லை' : 'No records found'}
        </td>
      </tr>
    `;
  } else {
    tableRowsHtml = items.map((row, idx) => {
      const cellsHtml = (columns || []).map(col => {
        const align = col.align || 'left';
        let cellVal = '';
        if (typeof col.render === 'function') {
          cellVal = col.render(row, idx);
        } else if (col.key === '#') {
          cellVal = idx + 1;
        } else {
          cellVal = row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '—';
        }
        return `
          <td style="padding: 3px 2px; text-align: ${align}; vertical-align: top; font-size: 11px; word-break: break-word;">
            ${typeof cellVal === 'string' && cellVal.includes('<') ? cellVal : escapeHtml(cellVal)}
          </td>
        `;
      }).join('');

      return `
        <tr style="page-break-inside: avoid; break-inside: avoid;">
          ${cellsHtml}
        </tr>
      `;
    }).join('');
  }

  // Summary Rows
  const summaryHtml = (summaryRows || []).map(s => {
    if (!s) return '';
    const isTotal = s.isTotal;
    const isBold = s.isBold || isTotal;
    const borderStyle = isTotal
      ? 'border-top: 1px dashed #000000; border-bottom: 1px dashed #000000; padding: 4px 0; margin-top: 3px; font-size: 12.5px; font-weight: 800;'
      : 'padding: 2px 0; font-size: 11px;';
    const fontWeight = isBold ? 'font-weight: 700;' : 'font-weight: normal;';

    return `
      <div style="display: flex; justify-content: space-between; ${borderStyle} ${fontWeight}">
        <span>${escapeHtml(s.label)}</span>
        <span style="text-align: right;">${escapeHtml(s.value)}</span>
      </div>
    `;
  }).join('');

  // Default Footer
  const defaultFooters = footerNotes && footerNotes.length > 0 ? footerNotes : [
    isTa ? '*** நன்றி ***' : '*** THANK YOU ***',
    'Annamithra Food Management',
    isTa ? '*** அறிக்கையின் முடிவு ***' : '*** END OF REPORT ***'
  ];
  const footerHtml = defaultFooters.map(f => `
    <div style="margin: 2px 0; font-size: 10px; text-align: center; letter-spacing: 0.3px;">
      ${escapeHtml(f)}
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="${isTa ? 'ta' : 'en'}">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title || 'Annamithra Receipt')}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;600;700;800&family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page {
            size: 80mm auto;
            margin: 2mm 3mm 4mm 3mm;
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
            width: 80mm;
            max-width: 80mm;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', 'Consolas', 'Segoe UI Mono', 'Menlo', 'Noto Sans Tamil', 'Inter', monospace, sans-serif;
            font-size: 11.5px;
            line-height: 1.35;
            -webkit-font-smoothing: antialiased;
          }
          .thermal-receipt-root {
            width: 74mm;
            max-width: 74mm;
            margin: 0 auto;
            padding: 2mm 0 6mm 0;
            background: #ffffff;
            color: #000000;
          }
          .dashed-divider {
            border-top: 1px dashed #000000;
            margin: 5px 0;
            width: 100%;
          }
          .double-divider {
            border-top: 1px double #000000;
            border-bottom: 1px double #000000;
            height: 3px;
            margin: 5px 0;
            width: 100%;
          }
          .branch-section {
            page-break-inside: auto !important;
            break-inside: auto !important;
            page-break-before: auto !important;
            break-before: auto !important;
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .branch-header {
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .branch-subtotal {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table.thermal-receipt-table {
            width: 100%;
            border-collapse: collapse;
            margin: 3px 0;
            font-size: 11px;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }
          table.thermal-receipt-table thead {
            display: table-header-group;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          table.thermal-receipt-table th {
            border-top: 1px dashed #000000;
            border-bottom: 1px dashed #000000;
            color: #000000;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table.thermal-receipt-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table.thermal-receipt-table td {
            color: #000000;
          }
          @media screen {
            body {
              background: #f3f4f6 !important;
              padding: 20px;
            }
            .thermal-receipt-root {
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
              padding: 16px 14px;
              background: #ffffff;
            }
          }
          @media print {
            body {
              width: 80mm;
              max-width: 80mm;
              margin: 0;
              padding: 0;
            }
            .thermal-receipt-root {
              width: 74mm;
              max-width: 74mm;
              margin: 0 auto;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="thermal-receipt-root">
          <!-- HEADER -->
          <div style="text-align: center; margin-bottom: 4px;">
            <div style="font-size: 14px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
              ${escapeHtml(organisationName)}
            </div>
            ${branchName ? `
              <div style="font-size: 12px; font-weight: 700; margin-top: 2px;">
                ${escapeHtml(branchName)}
              </div>
            ` : ''}
          </div>

          <div class="dashed-divider"></div>

          <!-- DOCUMENT TITLE -->
          <div style="text-align: center; margin: 4px 0;">
            <div style="font-size: 13px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
              ${escapeHtml(title)}
            </div>
            ${subtitle ? `
              <div style="font-size: 10.5px; font-weight: 600; margin-top: 2px;">
                ${escapeHtml(subtitle)}
              </div>
            ` : ''}
          </div>

          <!-- DATE & TIMESTAMP -->
          <div style="margin: 4px 0; font-size: 10.5px;">
            ${dateLabel ? `
              <div style="display: flex; justify-content: space-between;">
                <span style="font-weight: 600;">${isTa ? 'தேதி / காலம்' : 'Date / Period'}:</span>
                <span style="font-weight: 700;">${escapeHtml(dateLabel)}</span>
              </div>
            ` : ''}
            <div style="display: flex; justify-content: space-between; margin-top: 2px;">
              <span style="font-weight: 600;">${isTa ? 'அச்சிடப்பட்டது' : 'Printed'}:</span>
              <span>${escapeHtml(printTimestamp)}</span>
            </div>
          </div>

          ${metaHtml ? `
            <div class="dashed-divider"></div>
            <div style="margin: 4px 0;">
              ${metaHtml}
            </div>
          ` : ''}

          ${customBodyHtml ? customBodyHtml : `
          <!-- ITEMS TABLE -->
          <table class="thermal-receipt-table">
            <thead>
              <tr>
                ${tableHeadersHtml}
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
          `}

          <div class="dashed-divider"></div>

          <!-- SUMMARY SECTION -->
          ${summaryHtml ? `
            <div style="margin: 4px 0;">
              ${summaryHtml}
            </div>
            <div class="dashed-divider"></div>
          ` : ''}

          <!-- FOOTER -->
          <div style="margin-top: 6px;">
            ${footerHtml}
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Triggers native browser print dialog for an 80mm POS monochrome thermal receipt
 * using an isolated off-screen iframe.
 */
export async function printThermalReceipt(options = {}) {
  const htmlContent = generateThermalReceiptHtml(options);

  // Remove existing print iframes if any
  const oldIframes = document.querySelectorAll("iframe[id^='ann-thermal-print-iframe-']");
  oldIframes.forEach(el => el.remove());

  const iframe = document.createElement('iframe');
  iframe.id = 'ann-thermal-print-iframe-' + Date.now();
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
  doc.write(htmlContent);
  doc.close();

  return new Promise((resolve) => {
    // Wait for fonts & stylesheet rendering
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error('Thermal direct print failed:', err);
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
          resolve(true);
        }, 1500);
      }
    }, 350);
  });
}

/**
 * Reusable React Component for 80mm POS Thermal Receipt Layout.
 * Can be displayed inside a preview modal or embedded in any portal.
 */
export default function ThermalPrintLayout({
  organisationName = 'Annamithra Food & Restaurant Management',
  branchName = '',
  title = 'RECEIPT',
  subtitle = '',
  dateLabel = '',
  generatedAt = '',
  metadata = [],
  columns = [],
  items = [],
  summaryRows = [],
  footerNotes = [],
  language = 'en',
  onPrint = null
}) {
  const isTa = language === 'ta';
  const printTimestamp = generatedAt || new Date().toLocaleString(isTa ? 'ta-IN' : 'en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const handleTriggerPrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      printThermalReceipt({
        organisationName,
        branchName,
        title,
        subtitle,
        dateLabel,
        generatedAt: printTimestamp,
        metadata,
        columns,
        items,
        summaryRows,
        footerNotes,
        language
      });
    }
  };

  return (
    <div
      className="thermal-receipt-preview-wrap"
      style={{
        background: '#f3f4f6',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      <div
        className="thermal-receipt-paper"
        style={{
          width: '74mm',
          maxWidth: '100%',
          background: '#ffffff',
          color: '#000000',
          fontFamily: "'Courier New', 'Consolas', 'Segoe UI Mono', 'Menlo', 'Noto Sans Tamil', monospace, sans-serif",
          fontSize: '11.5px',
          lineHeight: '1.35',
          padding: '14px 10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            {organisationName}
          </div>
          {branchName && (
            <div style={{ fontSize: '11.5px', fontWeight: 700, marginTop: 2 }}>
              {branchName}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px dashed #000000', margin: '5px 0' }} />

        {/* Title */}
        <div style={{ textAlign: 'center', margin: '4px 0' }}>
          <div style={{ fontSize: '12.5px', fontWeight: 800, textTransform: 'uppercase' }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: '10.5px', fontWeight: 600, marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* Date / Timestamp */}
        <div style={{ margin: '4px 0', fontSize: '10.5px' }}>
          {dateLabel && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>{isTa ? 'தேதி / காலம்' : 'Date / Period'}:</span>
              <span style={{ fontWeight: 700 }}>{dateLabel}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontWeight: 600 }}>{isTa ? 'அச்சிடப்பட்டது' : 'Printed'}:</span>
            <span>{printTimestamp}</span>
          </div>
        </div>

        {/* Metadata */}
        {metadata && metadata.length > 0 && (
          <>
            <div style={{ borderTop: '1px dashed #000000', margin: '5px 0' }} />
            <div style={{ margin: '4px 0', fontSize: '10.5px' }}>
              {metadata.map((m, idx) => {
                if (typeof m === 'string') {
                  return <div key={idx} style={{ margin: '2px 0' }}>{m}</div>;
                }
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                    <span style={{ fontWeight: 600 }}>{m.label}:</span>
                    <span style={{ fontWeight: 700, textAlign: 'right' }}>{m.value || '—'}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{ borderTop: '1px dashed #000000', margin: '5px 0' }} />

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '4px 0', fontSize: '11px' }}>
          <thead>
            <tr>
              {(columns || []).map((col, idx) => (
                <th
                  key={idx}
                  style={{
                    padding: '3px 2px',
                    textAlign: col.align || 'left',
                    width: col.width || 'auto',
                    borderTop: '1px dashed #000000',
                    borderBottom: '1px dashed #000000',
                    fontWeight: 800,
                    fontSize: '10.5px',
                    textTransform: 'uppercase'
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(!items || items.length === 0) ? (
              <tr>
                <td
                  colSpan={(columns || []).length || 1}
                  style={{ padding: '8px 2px', textAlign: 'center', fontStyle: 'italic', fontSize: '10.5px' }}
                >
                  {isTa ? 'பதிவுகள் எதுவும் இல்லை' : 'No records found'}
                </td>
              </tr>
            ) : (
              items.map((row, rIdx) => (
                <tr key={rIdx}>
                  {(columns || []).map((col, cIdx) => {
                    let val = '';
                    if (typeof col.render === 'function') {
                      val = col.render(row, rIdx);
                    } else if (col.key === '#') {
                      val = rIdx + 1;
                    } else {
                      val = row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '—';
                    }
                    return (
                      <td
                        key={cIdx}
                        style={{
                          padding: '3px 2px',
                          textAlign: col.align || 'left',
                          verticalAlign: 'top',
                          fontSize: '10.5px',
                          wordBreak: 'break-word'
                        }}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div style={{ borderTop: '1px dashed #000000', margin: '5px 0' }} />

        {/* Summary */}
        {summaryRows && summaryRows.length > 0 && (
          <div style={{ margin: '4px 0' }}>
            {summaryRows.map((s, sIdx) => {
              const isTotal = s.isTotal;
              const isBold = s.isBold || isTotal;
              return (
                <div
                  key={sIdx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: isTotal ? '4px 0' : '2px 0',
                    fontSize: isTotal ? '12px' : '10.5px',
                    fontWeight: isBold ? 800 : 500,
                    borderTop: isTotal ? '1px dashed #000000' : 'none',
                    borderBottom: isTotal ? '1px dashed #000000' : 'none',
                    marginTop: isTotal ? 2 : 0
                  }}
                >
                  <span>{s.label}</span>
                  <span style={{ textAlign: 'right' }}>{s.value}</span>
                </div>
              );
            })}
            <div style={{ borderTop: '1px dashed #000000', margin: '5px 0' }} />
          </div>
        )}

        {/* Footer Notes */}
        <div style={{ marginTop: 6, textAlign: 'center', fontSize: '9.5px' }}>
          {(footerNotes && footerNotes.length > 0 ? footerNotes : [
            isTa ? '*** நன்றி ***' : '*** THANK YOU ***',
            'Annamithra Food Management',
            isTa ? '*** அறிக்கையின் முடிவு ***' : '*** END OF REPORT ***'
          ]).map((note, nIdx) => (
            <div key={nIdx} style={{ margin: '2px 0' }}>
              {note}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={handleTriggerPrint}
          style={{
            padding: '6px 16px',
            fontSize: '12px',
            fontWeight: 700,
            background: '#000000',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🖨️ {isTa ? 'அச்சிடுக' : 'Print Receipt'}
        </button>
      </div>
    </div>
  );
}

