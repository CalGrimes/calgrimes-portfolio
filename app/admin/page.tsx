import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listInvoices } from "@/lib/invoices/repository";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { DashboardAnalytics } from "@/components/invoices/dashboard-analytics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function AdminPage() {
  const invoices = await listInvoices();

  // Convert to aggregatable format (strip lineItems for aggregation)
  const aggregatableInvoices = invoices.map((inv) => ({
    id: inv.id,
    number: inv.number,
    issueDate: inv.issueDate,
    status: inv.status,
    totalMinor: inv.totalMinor,
    currency: inv.currency,
    clientName: inv.clientName,
  }));

  return (
    <div className="space-y-8">
      <Tabs defaultValue="list" className="w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-muted-foreground">Admin workspace</p>
            <h1 className="font-heading text-3xl">Invoices</h1>
          </div>
          <Button asChild>
            <Link href="/admin/new">New invoice</Link>
          </Button>
        </div>

        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-8">
          {invoices.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <p className="text-muted-foreground">No invoices yet.</p>
              <Button asChild variant="link" className="mt-2">
                <Link href="/admin/new">Create your first invoice</Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border">
              <InvoiceTable invoices={invoices} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="mt-8">
          {invoices.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <p className="text-muted-foreground">No invoices yet. Create one to see analytics.</p>
              <Button asChild variant="link" className="mt-2">
                <Link href="/admin/new">Create your first invoice</Link>
              </Button>
            </div>
          ) : (
            <DashboardAnalytics invoices={aggregatableInvoices} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
