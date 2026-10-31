import { describe, expect, it } from "vitest";

import { invoiceFormSchema, toNewInvoiceRecords } from "./types";

const validValues = {
  clientName: "Acme Ltd",
  clientEmail: "sarah@acme.com",
  clientAddress: "1 High Street\nLondon",
  issueDate: "2026-09-01",
  dueDate: "2026-09-30",
  currency: "GBP",
  status: "draft" as const,
  notes: "Thanks!",
  lineItems: [
    { description: "Consulting", quantity: "7.5", unitPrice: "80.00" },
    { description: "Setup fee", quantity: "1", unitPrice: "250" },
  ],
};

describe("invoiceFormSchema", () => {
  it("accepts a well-formed invoice", () => {
    expect(invoiceFormSchema.safeParse(validValues).success).toBe(true);
  });

  it("rejects an invalid client email", () => {
    const result = invoiceFormSchema.safeParse({
      ...validValues,
      clientEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one line item", () => {
    const result = invoiceFormSchema.safeParse({
      ...validValues,
      lineItems: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a due date before the issue date", () => {
    const result = invoiceFormSchema.safeParse({
      ...validValues,
      issueDate: "2026-09-30",
      dueDate: "2026-09-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric unit price", () => {
    const result = invoiceFormSchema.safeParse({
      ...validValues,
      lineItems: [{ description: "x", quantity: "1", unitPrice: "free" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("toNewInvoiceRecords", () => {
  const records = toNewInvoiceRecords(validValues, {
    id: "11111111-1111-1111-1111-111111111111",
    number: "INV-2026-0007",
  });

  it("converts money to integer minor units", () => {
    expect(records.invoice.totalMinor).toBe(85000);
    expect(records.lineItems[0].amountMinor).toBe(60000);
    expect(records.lineItems[1].amountMinor).toBe(25000);
  });

  it("converts quantities to thousandths", () => {
    expect(records.lineItems[0].quantityMilli).toBe(7500);
    expect(records.lineItems[1].quantityMilli).toBe(1000);
  });

  it("stamps the id and number onto the invoice", () => {
    expect(records.invoice.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(records.invoice.number).toBe("INV-2026-0007");
  });

  it("links every line item to the invoice and preserves order", () => {
    expect(records.lineItems.map((l) => l.invoiceId)).toEqual([
      "11111111-1111-1111-1111-111111111111",
      "11111111-1111-1111-1111-111111111111",
    ]);
    expect(records.lineItems.map((l) => l.position)).toEqual([0, 1]);
  });

  it("makes the total the sum of the line amounts", () => {
    const sum = records.lineItems.reduce((acc, l) => acc + l.amountMinor, 0);
    expect(records.invoice.totalMinor).toBe(sum);
  });
});
