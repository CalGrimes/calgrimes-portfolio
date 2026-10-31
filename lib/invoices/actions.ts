"use server";

import { invoiceFormSchema } from "./types";
import { createInvoice, setInvoiceStatus } from "./repository";
import type { InvoiceStatus } from "@/lib/db/schema";

export type ServerActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export async function createInvoiceAction(
  formData: unknown
): Promise<ServerActionResult<{ id: string; number: string }>> {
  try {
    const values = invoiceFormSchema.parse(formData);
    const result = await createInvoice(values);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error && "fieldErrors" in error) {
      const fieldErrors = (error as any).fieldErrors as Record<string, string[]>;
      const flatErrors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(fieldErrors)) {
        flatErrors[field] = messages[0] || "Invalid value";
      }
      return { success: false, error: "Validation failed", fieldErrors: flatErrors };
    }
    return { success: false, error: error instanceof Error ? error.message : "Failed to create invoice" };
  }
}

export async function setInvoiceStatusAction(
  id: string,
  status: InvoiceStatus
): Promise<ServerActionResult<void>> {
  try {
    if (!id || !status) {
      return { success: false, error: "Invalid invoice ID or status" };
    }

    await setInvoiceStatus(id, status);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update invoice status" };
  }
}
