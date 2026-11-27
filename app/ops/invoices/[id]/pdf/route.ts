import { paymentMethodLabel } from "@/lib/billing-settlement";
import { invoicePaymentOptions } from "@/lib/invoice-payment-options";
import { createClient } from "@/utils/supabase/server";
import { unitLabels } from "@/lib/business-unit-labels";
import { loadInvoice } from "@/lib/billing-documents";
import { billingPdfResponse } from "@/lib/billing-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { invoice, paidCents, balanceCents, payments, settlementStatus, date, dateTime, formatMoney, items, checkoutUrl } =
    await loadInvoice(await createClient(), id);
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
    note: (payments ?? []).length ? (settlementStatus === "Paid" ? "Paid in full" : "Payment received; remaining balance shown above.") : undefined,
    payments: (payments ?? []).map(entry => ({
      method: paymentMethodLabel(entry.payment_method, entry.provider), amount: formatMoney(entry.amount),
      receivedAt: entry.paid_at ? dateTime.format(new Date(entry.paid_at)) + " SAST" : "Not recorded",
      reference: entry.metadata?.bank_reference ?? undefined,
    })),
    paymentOptions: invoice.mode === 'live' && balanceCents > 0 ? invoicePaymentOptions(invoice.invoice_number) : undefined,
    sandbox: invoice.mode === "test",
    checkoutUrl: checkoutUrl ?? undefined,
  });
}
