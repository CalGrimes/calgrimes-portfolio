import Link from "next/link";

import { Button } from "@/components/ui/button";
import { listInvoices } from "@/lib/invoices/repository";
import { InvoiceTable } from "@/components/invoices/invoice-table";

export default async function InvoicesPage() {
  const invoices = await listInvoices();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Admin workspace</p>
          <h1 className="font-heading text-3xl">Invoices</h1>
        </div>
        <Button asChild>
          <Link href="/invoices/new">New invoice</Link>
        </Button>
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-muted-foreground">No invoices yet.</p>
          <Button asChild variant="link" className="mt-2">
            <Link href="/invoices/new">Create your first invoice</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <InvoiceTable invoices={invoices} />
        </div>
      )}
    </div>
  );
}
