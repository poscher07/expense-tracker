/**
 * PDF Report Generator for ClearLedger
 * Generates client-side PDF reports using jsPDF and jspdf-autotable.
 */

function formatCurrency(val) {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function getFormattedDate(dateStr) {
  if (!dateStr) return '—';
  const parts = String(dateStr).split('-');
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return dateStr;
}

/**
 * Generates and triggers download of the Expense & Transaction PDF report.
 * @param {Array} transactions - Array of transaction objects to include in the report.
 * @param {Object} filterContext - Optional metadata about currently applied filters.
 */
export function exportTransactionsToPdf(transactions, filterContext = {}) {
  const jspdfModule = window.jspdf;
  if (!jspdfModule) {
    throw new Error('PDF generator library is still loading. Please check your internet connection and try again.');
  }

  const jsPDF = jspdfModule.jsPDF || jspdfModule.default;
  if (!jsPDF) {
    throw new Error('Could not initialize jsPDF. Please verify that jsPDF is loaded.');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 40;
  const marginRight = 40;
  const contentWidth = pageWidth - marginLeft - marginRight;

  // 1. Calculate Summary Totals
  let totalCredited = 0;
  let totalDebited = 0;

  transactions.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      totalCredited += amt;
    } else {
      totalDebited += amt;
    }
  });

  const netBalance = totalCredited - totalDebited;

  // 2. Dates
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const currentDateStr = `${yyyy}-${mm}-${dd}`;
  const generatedDateTimeStr = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // 3. Header Section
  doc.setFillColor(15, 23, 42); // #0F172A dark slate accent
  doc.rect(marginLeft, 32, 4, 34, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('Expense & Transaction Report', marginLeft + 12, 48);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // #64748B
  doc.text(`ClearLedger Personal Finance  ·  Generated on: ${generatedDateTimeStr}`, marginLeft + 12, 62);

  // Active filters info
  const scopeNotes = [];
  if (filterContext.search) scopeNotes.push(`Search: "${filterContext.search}"`);
  if (filterContext.type && filterContext.type !== 'all') scopeNotes.push(`Type: ${filterContext.type.toUpperCase()}`);
  if (filterContext.category && filterContext.category !== 'all') scopeNotes.push(`Category: ${filterContext.category}`);
  if (filterContext.month && filterContext.month !== 'all') scopeNotes.push(`Month: ${filterContext.month}`);

  const scopeText = scopeNotes.length > 0 
    ? `Active Filters: ${scopeNotes.join('  |  ')} (${transactions.length} record${transactions.length === 1 ? '' : 's'})`
    : `Showing all ${transactions.length} transaction record${transactions.length === 1 ? '' : 's'}`;

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(scopeText, marginLeft, 84);

  // Separator rule
  doc.setDrawColor(226, 232, 240); // #E2E8F0
  doc.setLineWidth(0.75);
  doc.line(marginLeft, 92, marginLeft + contentWidth, 92);

  // 4. Prepare Table Rows
  const tableData = transactions.map((tx) => {
    const isIncome = tx.type === 'income';
    const typeLabel = isIncome ? 'Credit' : 'Debit';
    const amountLabel = `${isIncome ? '+' : '-'}${formatCurrency(tx.amount)}`;

    let desc = tx.title || 'Untitled';
    if (tx.description && tx.description.trim()) {
      desc += `\n${tx.description.trim()}`;
    }

    return [
      getFormattedDate(tx.date),
      desc,
      tx.category || 'Other',
      typeLabel,
      amountLabel,
    ];
  });

  // 5. Draw Table with autoTable
  doc.autoTable({
    startY: 100,
    margin: { left: marginLeft, right: marginRight, bottom: 40 },
    head: [['Date', 'Description / Title', 'Category', 'Type (Credit/Debit)', 'Amount']],
    body: tableData.length > 0 ? tableData : [['—', 'No transactions found for the selected criteria.', '—', '—', '$0.00']],
    theme: 'striped',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
      valign: 'middle',
      overflow: 'linebreak',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      lineColor: [15, 23, 42],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // #F8FAFC alternating row shading
    },
    columnStyles: {
      0: { cellWidth: 70 }, // Date
      1: { cellWidth: 'auto' }, // Description / Title
      2: { cellWidth: 80 }, // Category
      3: { cellWidth: 95, halign: 'center' }, // Type (Credit/Debit)
      4: { cellWidth: 85, halign: 'right', fontStyle: 'bold' }, // Amount
    },
    didParseCell: function(data) {
      if (data.section === 'body' && tableData.length > 0) {
        const row = transactions[data.row.index];
        if (row) {
          const isIncome = row.type === 'income';
          if (data.column.index === 3 || data.column.index === 4) {
            data.cell.styles.textColor = isIncome ? [22, 163, 74] : [220, 38, 38];
          }
        }
      }
    },
    didDrawPage: function(data) {
      // Running Page Footer
      const totalPages = doc.internal.getNumberOfPages();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // #94A3B8
      doc.text(
        `ClearLedger Report · Page ${data.pageNumber} of ${totalPages}`,
        marginLeft,
        pageHeight - 16
      );
      doc.text(
        `Expense & Transaction Report · Confidential`,
        pageWidth - marginRight,
        pageHeight - 16,
        { align: 'right' }
      );
    },
  });

  // 6. Footer Summary Box Below the Table
  const boxHeight = 68;
  const marginBottom = 40;
  let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 18 : 120;

  // Move to next page if summary box doesn't fit on current page
  if (finalY + boxHeight > pageHeight - marginBottom) {
    doc.addPage();
    finalY = 40;
  }

  // Draw summary box container
  doc.setFillColor(248, 250, 252); // #F8FAFC
  doc.setDrawColor(203, 213, 225); // #CBD5E1
  doc.setLineWidth(0.75);
  doc.roundedRect(marginLeft, finalY, contentWidth, boxHeight, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('FINANCIAL SUMMARY', marginLeft + 14, finalY + 16);

  const colWidth = contentWidth / 3;

  // Total Money Credited (Green)
  const col1X = marginLeft + 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Total Money Credited:', col1X, finalY + 34);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(22, 163, 74); // #16A34A green
  doc.text(`+${formatCurrency(totalCredited)}`, col1X, finalY + 50);

  // Total Money Debited (Red)
  const col2X = marginLeft + colWidth + 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Total Money Debited:', col2X, finalY + 34);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(220, 38, 38); // #DC2626 red
  doc.text(`-${formatCurrency(totalDebited)}`, col2X, finalY + 50);

  // Net Balance
  const col3X = marginLeft + colWidth * 2 + 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Net Balance:', col3X, finalY + 34);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  if (netBalance >= 0) {
    doc.setTextColor(22, 163, 74);
    doc.text(`+${formatCurrency(netBalance)}`, col3X, finalY + 50);
  } else {
    doc.setTextColor(220, 38, 38);
    doc.text(`-${formatCurrency(Math.abs(netBalance))}`, col3X, finalY + 50);
  }

  // 7. Save / Trigger Download
  const fileName = `Expense_Report_${currentDateStr}.pdf`;
  doc.save(fileName);
  return fileName;
}
