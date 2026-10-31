"use server";

import { invoiceFormSchema } from "./types";
import { createInvoice, setInvoiceStatus } from "./repository";
import { requireAdmin } from "@/lib/auth-guard";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";
import type { InvoiceStatus } from "@/lib/db/schema";

export type ServerActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export async function createInvoiceAction(
  formData: unknown
): Promise<ServerActionResult<{ id: string; number: string }>> {
  try {
    // Verify admin access
    const session = await requireAdmin();

    // Rate limit
    const rateLimit = checkRateLimit(
      `invoice-create:${session.user.id}`,
      LIMITS.API.max,
      LIMITS.API.window
    );

    if (!rateLimit.success) {
      return {
        success: false,
        error: `Too many requests. Try again in ${Math.ceil((rateLimit.resetTime.getTime() - Date.now()) / 1000)} seconds`
      };
    }

    // Validate
    const values = invoiceFormSchema.parse(formData);

    // Create
    const result = await createInvoice(values);

    // Audit log
    await logAudit("invoice_created", session.user.id, result.id, {
      client: values.clientName,
      amount: String(values.lineItems.length),
    });

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
    // Verify admin access
    const session = await requireAdmin();

    // Rate limit
    const rateLimit = checkRateLimit(
      `invoice-update:${session.user.id}`,
      LIMITS.API.max,
      LIMITS.API.window
    );

    if (!rateLimit.success) {
      return {
        success: false,
        error: `Too many requests. Try again in ${Math.ceil((rateLimit.resetTime.getTime() - Date.now()) / 1000)} seconds`
      };
    }

    // Validate inputs
    if (!id || !status || !/^[a-f0-9-]{36}$/.test(id)) {
      return { success: false, error: "Invalid invoice ID or status" };
    }

    const validStatuses = ["draft", "sent", "paid", "overdue", "void"];
    if (!validStatuses.includes(status)) {
      return { success: false, error: "Invalid status" };
    }

    await setInvoiceStatus(id, status);

    // Audit log
    await logAudit("status_changed", session.user.id, id, {
      newStatus: status,
    });

    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to update invoice status" };
  }
}
