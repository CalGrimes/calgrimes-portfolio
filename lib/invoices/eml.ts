import type { InvoiceWithLines } from "./types";
import { formatMoney } from "./money";

export function generateInvoiceEmailHTML(invoice: InvoiceWithLines): string {
  const lineItemsHTML = invoice.lineItems
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; text-align: left;">${item.description}</td>
      <td style="padding: 12px; text-align: right;">${(item.quantityMilli / 1000).toFixed(3)}</td>
      <td style="padding: 12px; text-align: right;">${formatMoney(item.unitPriceMinor, invoice.currency)}</td>
      <td style="padding: 12px; text-align: right; font-weight: 600;">${formatMoney(item.amountMinor, invoice.currency)}</td>
    </tr>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { margin-bottom: 30px; }
    h1 { font-size: 24px; margin: 0; }
    .section { margin: 30px 0; }
    .section h2 { font-size: 14px; font-weight: 600; text-transform: uppercase; color: #666; margin: 0 0 12px 0; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 30px 0; }
    .details-item { font-size: 14px; }
    .details-item strong { display: block; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { text-align: left; padding: 12px; font-weight: 600; font-size: 12px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
    td { padding: 12px; }
    .total { font-weight: 600; font-size: 16px; border-top: 2px solid #ddd; }
    .notes { background: #f9f9f9; padding: 15px; margin: 20px 0; white-space: pre-wrap; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Invoice ${invoice.number}</h1>
    </div>

    <div class="details-grid">
      <div>
        <h2>Invoice Details</h2>
        <div class="details-item"><strong>Number:</strong> ${invoice.number}</div>
        <div class="details-item"><strong>Issue Date:</strong> ${invoice.issueDate}</div>
        <div class="details-item"><strong>Due Date:</strong> ${invoice.dueDate}</div>
        <div class="details-item"><strong>Status:</strong> ${invoice.status}</div>
      </div>
      <div>
        <h2>Bill To</h2>
        <div class="details-item"><strong>Name:</strong> ${invoice.clientName}</div>
        <div class="details-item"><strong>Email:</strong> ${invoice.clientEmail}</div>
        ${invoice.clientAddress ? `<div class="details-item"><strong>Address:</strong> ${invoice.clientAddress}</div>` : ""}
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
        <tr class="total">
          <td colspan="3" style="text-align: right;">Total:</td>
          <td style="text-align: right; border-top: 2px solid #ddd;">${formatMoney(invoice.totalMinor, invoice.currency)}</td>
        </tr>
      </tbody>
    </table>

    ${invoice.notes ? `<div class="notes">${invoice.notes}</div>` : ""}

    <div class="footer">
      <p>This is an automated email. Please do not reply to this address.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function generateInvoiceEmailContent(invoice: InvoiceWithLines): {
  subject: string;
  to: string;
  text: string;
  html: string;
} {
  const lineItemsText = invoice.lineItems
    .map(
      (item) =>
        `${item.description.padEnd(40)} | ${(item.quantityMilli / 1000).toFixed(3).padStart(10)} | ${formatMoney(item.unitPriceMinor, invoice.currency).padStart(15)} | ${formatMoney(item.amountMinor, invoice.currency).padStart(15)}`
    )
    .join("\n");

  const text = `
Invoice ${invoice.number}

Bill To:
${invoice.clientName}
${invoice.clientEmail}
${invoice.clientAddress ? invoice.clientAddress : ""}

Details:
Invoice Number: ${invoice.number}
Issue Date: ${invoice.issueDate}
Due Date: ${invoice.dueDate}
Status: ${invoice.status}

Line Items:
${"Description".padEnd(40)} | ${"Qty".padStart(10)} | ${"Unit Price".padStart(15)} | ${"Amount".padStart(15)}
${"-".repeat(100)}
${lineItemsText}

Total: ${formatMoney(invoice.totalMinor, invoice.currency)}

${invoice.notes ? `\nNotes:\n${invoice.notes}` : ""}

---
Generated on ${new Date().toLocaleDateString()}
  `.trim();

  return {
    subject: `Invoice ${invoice.number} from ${new Date().getFullYear()}`,
    to: invoice.clientEmail,
    text,
    html: generateInvoiceEmailHTML(invoice),
  };
}
