import { createClient } from "@/utils/supabase/server";
import { unitLabels } from "@/lib/business-unit-labels";
import { loadInvoice } from "@/lib/billing-documents";
import { billingPdfResponse } from "@/lib/billing-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { invoice, paidCents, balanceCents, payment, methodLabel, date, dateTime, formatMoney, items } =
    await loadInvoice(await createClient(), id);
  const paymentNote = payment?.paid_at
    ? [balanceCents === 0 ? "Paid" : "Payment received", methodLabel,
        dateTime.format(new Date(payment.paid_at)) + " SAST"].filter(Boolean).join(" · ")
    : undefined;

  return billingPdfResponse({
    title: "Invoice",
    reference: invoice.invoice_number,
    unit: unitLabels[invoice.unit] ?? invoice.unit,
    metadata: [
      ["Issue date", date.format(new Date(invoice.issued_at))],
      ["Quotation No", invoice.quotation_number],
      ["Currency", invoice.currency],
    ],
    customer: [
      "Customer name: " + invoice.customer_name,
      ...(invoice.customer_email ? ["Customer email: " + invoice.customer_email] : []),
      ...(invoice.customer_location ? ["Customer location: " + invoice.customer_location] : []),
    ],
    service: [invoice.service_type],
    items: items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity).toFixed(2),
      unitPrice: formatMoney(item.unit_price),
      total: formatMoney(item.line_total),
    })),
    totals: [
      ["Subtotal", formatMoney(invoice.subtotal)],
      ["Additional fees", formatMoney(invoice.fees)],
      ["Invoice total", formatMoney(invoice.total)],
      ["Amount paid", formatMoney(paidCents / 100)],
      ["Balance due", formatMoney(balanceCents / 100)],
    ],
    note: paymentNote,
    sandbox: invoice.mode === "test",
  });
}
