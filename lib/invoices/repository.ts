import "server-only";

import { asc, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import type { InvoiceStatus } from "@/lib/db/schema";
import { invoiceLineItems, invoices } from "@/lib/db/schema";

import { nextInvoiceNumber } from "./numbering";
import type { InvoiceFormValues, InvoiceWithLines } from "./types";
import { toNewInvoiceRecords } from "./types";

export async function listInvoices(): Promise<InvoiceWithLines[]> {
  return getDb().query.invoices.findMany({
    with: {
      lineItems: { orderBy: [asc(invoiceLineItems.position)] },
    },
    orderBy: [desc(invoices.issueDate), desc(invoices.createdAt)],
  });
}

export async function getInvoice(id: string): Promise<InvoiceWithLines | null> {
  const invoice = await getDb().query.invoices.findFirst({
    where: eq(invoices.id, id),
    with: {
      lineItems: { orderBy: [asc(invoiceLineItems.position)] },
    },
  });
  return invoice ?? null;
}

export async function createInvoice(
  values: InvoiceFormValues
): Promise<{ id: string; number: string }> {
  const db = getDb();

  const year = Number(values.issueDate.slice(0, 4));
  const existing = await db.select({ number: invoices.number }).from(invoices);

  const number = nextInvoiceNumber(
    existing.map((row) => row.number),
    year
  );

  const id = crypto.randomUUID();
  const records = toNewInvoiceRecords(values, { id, number });

  await db.batch([
    db.insert(invoices).values(records.invoice),
    db.insert(invoiceLineItems).values(records.lineItems),
  ]);

  return { id, number };
}

export async function setInvoiceStatus(
  id: string,
  status: InvoiceStatus
): Promise<void> {
  await getDb()
    .update(invoices)
    .set({
      status,
      updatedAt: new Date(),
      paidAt: status === "paid" ? new Date() : null,
    })
    .where(eq(invoices.id, id));
}
