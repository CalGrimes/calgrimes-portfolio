import Link from "next/link";
import { listInvoices } from "@/lib/invoices/repository";
import { Button } from "@/components/ui/button";
import { InvoiceTable } from "./invoice-table";
import { Plus } from "lucide-react";

export async function InvoiceDashboard() {
  const invoices = await listInvoices();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-2">Manage and track your invoices</p>
        </div>
        <Button asChild>
          <Link href="/admin/new">
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border">
        <InvoiceTable invoices={invoices} />
      </div>

      <div className="text-sm text-muted-foreground">
        Total invoices: {invoices.length}
      </div>
    </div>
  );
}
