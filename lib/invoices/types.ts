import { z } from "zod";

import type {
  Invoice,
  InvoiceLineItem,
  NewInvoice,
  NewInvoiceLineItem,
} from "@/lib/db/schema";

import { computeLineAmountMinor, toMilli, toMinor } from "./money";

export type InvoiceWithLines = Invoice & { lineItems: InvoiceLineItem[] };

const moneyString = z
  .string()
  .trim()
  .min(1, "Required")
  .refine((value) => {
    try {
      toMinor(value);
      return true;
    } catch {
      return false;
    }
  }, "Enter an amount like 1234.56");

const quantityString = z
  .string()
  .trim()
  .min(1, "Required")
  .refine((value) => {
    try {
      return toMilli(value) > 0;
    } catch {
      return false;
    }
  }, "Enter a quantity like 7.5");

export const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Required").max(500),
  quantity: quantityString,
  unitPrice: moneyString,
});

export const invoiceFormSchema = z
  .object({
    clientName: z.string().trim().min(1, "Required").max(200),
    clientEmail: z.string().trim().email("Enter a valid email"),
    clientAddress: z.string().trim().max(1000).optional().or(z.literal("")),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    currency: z.string().trim().length(3).default("GBP"),
    status: z.enum(["draft", "sent", "paid", "overdue", "void"]).default("draft"),
    notes: z.string().trim().max(2000).optional().or(z.literal("")),
    lineItems: z.array(lineItemSchema).min(1, "Add at least one line item"),
  })
  .refine((values) => values.dueDate >= values.issueDate, {
    message: "Due date cannot be before the issue date",
    path: ["dueDate"],
  });

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export function toNewInvoiceRecords(
  values: InvoiceFormValues,
  identity: { id: string; number: string }
): { invoice: NewInvoice; lineItems: NewInvoiceLineItem[] } {
  const lineItems: NewInvoiceLineItem[] = values.lineItems.map(
    (line, position) => {
      const quantityMilli = toMilli(line.quantity);
      const unitPriceMinor = toMinor(line.unitPrice);
      return {
        invoiceId: identity.id,
        position,
        description: line.description,
        quantityMilli,
        unitPriceMinor,
        amountMinor: computeLineAmountMinor(quantityMilli, unitPriceMinor),
      };
    }
  );

  const totalMinor = lineItems.reduce((sum, line) => sum + line.amountMinor, 0);

  return {
    invoice: {
      id: identity.id,
      number: identity.number,
      clientName: values.clientName,
      clientEmail: values.clientEmail,
      clientAddress: values.clientAddress || null,
      issueDate: values.issueDate,
      dueDate: values.dueDate,
      currency: values.currency,
      totalMinor,
      status: values.status,
      notes: values.notes || null,
    },
    lineItems,
  };
}
