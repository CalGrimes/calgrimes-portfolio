"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import type { InvoiceWithLines } from "@/lib/invoices/types";
import { formatMoney } from "@/lib/invoices/money";

const statusColors = {
  draft: "secondary",
  sent: "outline",
  paid: "default",
  overdue: "destructive",
  void: "secondary",
} as const;

export function InvoiceTable({ invoices }: { invoices: InvoiceWithLines[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="px-6 py-3 text-left text-sm font-semibold">Number</th>
            <th className="px-6 py-3 text-left text-sm font-semibold">Client</th>
            <th className="px-6 py-3 text-left text-sm font-semibold">Amount</th>
            <th className="px-6 py-3 text-left text-sm font-semibold">Due Date</th>
            <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
            <th className="px-6 py-3 text-right text-sm font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 ? (
            <tr className="border-b">
              <td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">
                No invoices yet
              </td>
            </tr>
          ) : (
            invoices.map((invoice) => (
              <tr key={invoice.id} className="border-b hover:bg-muted/50">
                <td className="px-6 py-4 text-sm font-medium">{invoice.number}</td>
                <td className="px-6 py-4 text-sm">{invoice.clientName}</td>
                <td className="px-6 py-4 text-sm">
                  {formatMoney(invoice.totalMinor, invoice.currency)}
                </td>
                <td className="px-6 py-4 text-sm">{invoice.dueDate}</td>
                <td className="px-6 py-4 text-sm">
                  <Badge variant={statusColors[invoice.status]}>
                    {invoice.status}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/invoices/${invoice.id}`}>View Details</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/invoices/${invoice.id}/edit`}>Edit</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/invoices/${invoice.id}?export=pdf`}>Download PDF</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/invoices/${invoice.id}?export=email`}>Email Draft</Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
