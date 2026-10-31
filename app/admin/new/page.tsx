"use client";

import { useRouter } from "next/navigation";
import { InvoiceForm } from "@/components/invoices/invoice-form";

export default function NewInvoicePage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">Invoices</p>
        <h1 className="font-heading text-3xl">New invoice</h1>
      </div>

      <InvoiceForm
        onSuccess={(id) => {
          router.push(`/admin/${id}`);
        }}
      />
    </div>
  );
}
