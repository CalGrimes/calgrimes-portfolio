import { notFound } from "next/navigation";
import { getInvoice } from "@/lib/invoices/repository";
import { generateInvoiceEmailContent } from "@/lib/invoices/eml";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoice = await getInvoice(id);

  if (!invoice) {
    notFound();
  }

  const emailContent = generateInvoiceEmailContent(invoice);

  // Generate .eml file content (RFC 5322 format)
  const emlContent = `From: sender@example.com
To: ${emailContent.to}
Subject: ${emailContent.subject}
Content-Type: multipart/alternative; boundary="boundary123"
MIME-Version: 1.0

--boundary123
Content-Type: text/plain; charset=UTF-8

${emailContent.text}

--boundary123
Content-Type: text/html; charset=UTF-8

${emailContent.html}

--boundary123--`;

  return new Response(emlContent, {
    headers: {
      "Content-Type": "message/rfc822",
      "Content-Disposition": `attachment; filename="invoice-${invoice.number}.eml"`,
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const invoice = await getInvoice(id);

  if (!invoice) {
    notFound();
  }

  const emailContent = generateInvoiceEmailContent(invoice);

  // Return email content as JSON for previewing or sending
  return Response.json(emailContent);
}
