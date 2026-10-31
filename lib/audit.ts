import { getDb } from "@/lib/db";

export type AuditAction =
  | "invoice_created"
  | "invoice_updated"
  | "invoice_deleted"
  | "invoice_exported"
  | "status_changed"
  | "admin_login"
  | "admin_logout";

export async function logAudit(
  action: AuditAction,
  userId: string,
  invoiceId?: string,
  details?: Record<string, string>
) {
  try {
    // Log to database or file
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      action,
      userId,
      invoiceId,
      details: JSON.stringify(details || {}),
    };

    console.log("[AUDIT]", logEntry);

    // TODO: Store in database audit_logs table when ready
    // await getDb().insert(auditLogs).values(logEntry);
  } catch (error) {
    console.error("Failed to log audit", error);
    // Don't throw - audit logging shouldn't break the app
  }
}
