import { notFound } from "next/navigation";
import { getInvoice } from "@/lib/invoices/repository";
import { generateInvoicePDF } from "@/lib/invoices/pdf";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoice = await getInvoice(id);

  if (!invoice) {
    notFound();
  }

  const pdf = await generateInvoicePDF(invoice);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.number}.pdf"`,
      "Content-Length": pdf.length.toString(),
    },
  });
}
