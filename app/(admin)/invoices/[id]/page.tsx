import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExportButtons } from "@/components/invoices/export-buttons";
import { getInvoice } from "@/lib/invoices/repository";
import { formatMoney } from "@/lib/invoices/money";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  return { title: invoice?.number ? `Invoice ${invoice.number}` : "Invoice" };
}

const statusColors = {
  draft: "secondary",
  sent: "outline",
  paid: "default",
  overdue: "destructive",
  void: "secondary",
} as const;

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);

  if (!invoice) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Invoice</p>
          <h1 className="font-heading text-3xl">{invoice.number}</h1>
        </div>
        <div className="flex gap-3">
          <ExportButtons invoiceId={invoice.id} />
          <Button asChild variant="outline">
            <Link href="/invoices">Back</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border p-6">
          <h2 className="font-heading text-lg mb-4">Details</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Number</dt>
              <dd className="font-medium">{invoice.number}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={statusColors[invoice.status]}>
                  {invoice.status}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Issue Date</dt>
              <dd>{invoice.issueDate}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Due Date</dt>
              <dd>{invoice.dueDate}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Currency</dt>
              <dd>{invoice.currency}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="font-heading text-lg mb-4">Client</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{invoice.clientName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd>
                <a href={`mailto:${invoice.clientEmail}`} className="text-blue-600 hover:underline">
                  {invoice.clientEmail}
                </a>
              </dd>
            </div>
            {invoice.clientAddress && (
              <div>
                <dt className="text-muted-foreground">Address</dt>
                <dd className="whitespace-pre-line text-sm">{invoice.clientAddress}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="rounded-lg border p-6">
        <h2 className="font-heading text-lg mb-4">Line Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-semibold">Description</th>
                <th className="px-4 py-2 text-right font-semibold">Quantity</th>
                <th className="px-4 py-2 text-right font-semibold">Unit Price</th>
                <th className="px-4 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item, i) => (
                <tr key={i} className="border-b">
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="px-4 py-3 text-right">{(item.quantityMilli / 1000).toFixed(3)}</td>
                  <td className="px-4 py-3 text-right">
                    {formatMoney(item.unitPriceMinor, invoice.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatMoney(item.amountMinor, invoice.currency)}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-semibold">
                <td colSpan={3} className="px-4 py-3 text-right">Total:</td>
                <td className="px-4 py-3 text-right">
                  {formatMoney(invoice.totalMinor, invoice.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {invoice.notes && (
        <div className="rounded-lg border p-6">
          <h2 className="font-heading text-lg mb-4">Notes</h2>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}
