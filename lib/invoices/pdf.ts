import PDFDocument from "pdfkit";
import type { InvoiceWithLines } from "./types";
import { formatMoney, toMajor } from "./money";

export function generateInvoicePDF(invoice: InvoiceWithLines): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const buffers: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 50;
    const colWidth = (pageWidth - 3 * margin) / 2;

    // Left column: Client Info
    doc.fontSize(14).font("Helvetica-Bold").text(invoice.clientName, margin, margin, { width: colWidth });
    doc.fontSize(10).font("Helvetica").text(invoice.clientAddress || "", margin, doc.y + 5, { width: colWidth });

    // Right column: Invoice title and details
    const rightCol = margin + colWidth + margin;
    doc.fontSize(32).font("Helvetica-Bold").text("Invoice", rightCol, margin, { align: "right", width: colWidth });

    // Invoice details box
    doc.fontSize(10).font("Helvetica");
    const detailsY = margin + 50;
    const details = [
      [`Invoice #: ${invoice.number}`],
      [`Date: ${invoice.issueDate}`],
      [`Due: ${invoice.dueDate}`],
    ];

    let y = detailsY;
    details.forEach(([text]) => {
      doc.text(text, rightCol, y, { align: "right", width: colWidth });
      y += 15;
    });

    // Separator line
    doc.moveTo(margin, margin + 90).lineTo(pageWidth - margin, margin + 90).stroke();

    doc.moveDown(3);

    // Line Items Table
    const tableTop = doc.y + 20;
    const descCol = margin;
    const amountCol = pageWidth - margin - 80;

    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Description", descCol, tableTop);
    doc.text("Amount", amountCol, tableTop, { width: 80, align: "right" });

    // Separator
    doc.moveTo(margin, tableTop + 15).lineTo(pageWidth - margin, tableTop + 15).stroke();

    let itemY = tableTop + 25;
    doc.font("Helvetica").fontSize(9);

    invoice.lineItems.forEach((item) => {
      const amount = formatMoney(item.amountMinor, invoice.currency);
      doc.text(item.description, descCol, itemY, { width: amountCol - descCol - 10 });
      doc.text(amount, amountCol, itemY, { width: 80, align: "right" });
      itemY += 15;
    });

    // Separator before total
    doc.moveTo(margin, itemY).lineTo(pageWidth - margin, itemY).stroke();
    itemY += 15;

    // Total
    doc.fontSize(14).font("Helvetica-Bold");
    doc.text("Total", descCol, itemY);
    doc.text(formatMoney(invoice.totalMinor, invoice.currency), amountCol, itemY, {
      width: 80,
      align: "right",
    });

    // Notes section
    if (invoice.notes) {
      doc.moveDown(3);
      doc.fontSize(10).font("Helvetica-Bold").text("Notes");
      doc.fontSize(9).font("Helvetica").text(invoice.notes, { align: "left" });
    }

    // Footer with payment info
    doc.moveDown(2);
    // doc.fontSize(8)
    //   .fillColor("#999999")
    //   .text("Sole Trader - VAT not charged", { align: "center" });

    doc.end();
  });
}

export function generateInvoiceHTML(invoice: InvoiceWithLines): string {
  const lineItemsHTML = invoice.lineItems
    .map(
      (item) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${(item.quantityMilli / 1000).toFixed(3)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatMoney(item.unitPriceMinor, invoice.currency)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formatMoney(item.amountMinor, invoice.currency)}</td>
    </tr>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.number}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
      margin: 0;
      padding: 20px;
      background: #f9fafb;
    }
    .invoice {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .header {
      margin-bottom: 40px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 20px;
    }
    h1 { margin: 0; font-size: 28px; }
    .details {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin: 40px 0;
    }
    .detail-section h2 {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      color: #6b7280;
      margin: 0 0 16px 0;
    }
    .detail-section dl {
      margin: 0;
    }
    .detail-section dt {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 12px;
    }
    .detail-section dd {
      font-size: 14px;
      margin: 4px 0 0 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 30px 0;
    }
    th {
      text-align: left;
      padding: 12px 8px;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      border-bottom: 2px solid #e5e7eb;
    }
    .total-row {
      font-weight: 600;
      font-size: 16px;
    }
    .total-row td {
      padding: 12px 8px;
      border-top: 2px solid #e5e7eb;
      border-bottom: 2px solid #e5e7eb;
    }
    .notes {
      margin-top: 40px;
      padding: 20px;
      background: #f3f4f6;
      border-radius: 6px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
    @media print {
      body { background: white; }
      .invoice { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <h1>Invoice ${invoice.number}</h1>
    </div>

    <div class="details">
      <div class="detail-section">
        <h2>Invoice Details</h2>
        <dl>
          <dt>Number</dt>
          <dd>${invoice.number}</dd>
          <dt>Issue Date</dt>
          <dd>${invoice.issueDate}</dd>
          <dt>Due Date</dt>
          <dd>${invoice.dueDate}</dd>
          <dt>Status</dt>
          <dd>${invoice.status}</dd>
        </dl>
      </div>

      <div class="detail-section">
        <h2>Bill To</h2>
        <dl>
          <dt>Name</dt>
          <dd>${invoice.clientName}</dd>
          <dt>Email</dt>
          <dd>${invoice.clientEmail}</dd>
          ${invoice.clientAddress ? `<dt>Address</dt><dd>${invoice.clientAddress.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</dd>` : ""}
        </dl>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: right;">Quantity</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHTML}
        <tr class="total-row">
          <td colspan="3" style="text-align: right; padding: 12px 8px;">Total:</td>
          <td style="text-align: right; padding: 12px 8px; border-top: 2px solid #e5e7eb; border-bottom: 2px solid #e5e7eb;">${formatMoney(invoice.totalMinor, invoice.currency)}</td>
        </tr>
      </tbody>
    </table>

    ${invoice.notes ? `<div class="notes">${invoice.notes.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ""}

    <div class="footer">
      <p>Generated on ${new Date().toLocaleDateString()}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
