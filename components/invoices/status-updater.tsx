"use client";

import { useState } from "react";
import { setInvoiceStatusAction } from "@/lib/invoices/actions";
import { Button } from "@/components/ui/button";
import type { InvoiceStatus } from "@/lib/db/schema";

interface StatusUpdaterProps {
  invoiceId: string;
  currentStatus: InvoiceStatus;
}

const statusTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["sent", "void"],
  sent: ["paid", "overdue", "void"],
  paid: ["void"],
  overdue: ["paid", "void"],
  void: [],
};

const statusLabels: Record<InvoiceStatus, string> = {
  draft: "Mark as Sent",
  sent: "Mark as Paid",
  paid: "Archive",
  overdue: "Mark as Paid",
  void: "Void",
};

export function StatusUpdater({ invoiceId, currentStatus }: StatusUpdaterProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTransitions = statusTransitions[currentStatus];

  if (availableTransitions.length === 0) {
    return null;
  }

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    setIsUpdating(true);
    setError(null);

    try {
      const result = await setInvoiceStatusAction(invoiceId, newStatus);
      if (!result.success) {
        setError(result.error);
      } else {
        window.location.reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {availableTransitions.map((status) => (
          <Button
            key={status}
            variant="outline"
            size="sm"
            disabled={isUpdating}
            onClick={() => handleStatusChange(status)}
          >
            {isUpdating ? "Updating..." : statusLabels[status]}
          </Button>
        ))}
      </div>
    </div>
  );
}
