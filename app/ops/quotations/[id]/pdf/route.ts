import { createClient } from "@/utils/supabase/server";
import { unitLabels } from "@/lib/business-unit-labels";
import { loadQuotation } from "@/lib/billing-documents";
import { billingPdfResponse } from "@/lib/billing-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { quote, request, customer, items } = await loadQuotation(await createClient(), id);
  const currency = new Intl.NumberFormat("en-ZA", {
    style: "currency", currency: quote.currency ?? "ZAR",
  });
  const money = (value: number | string) => currency.format(Number(value));
  const date = new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium", timeZone: "Africa/Johannesburg",
  });

  return billingPdfResponse({
    title: "Quotation",
    reference: quote.quotation_number,
    unit: unitLabels[quote.issuing_unit ?? request.unit] ?? request.unit,
    metadata: [
      ["Date", date.format(new Date(quote.created_at))],
      ["Valid until", quote.valid_until ? date.format(new Date(quote.valid_until)) : "Not specified"],
    ],
    customer: [customer?.full_name ?? "Customer", customer?.phone, customer?.email, customer?.location_text]
      .filter((value): value is string => Boolean(value)),
    service: [request.service_type, request.description].filter((value): value is string => Boolean(value)),
    items: (items ?? []).map((item) => ({
      description: item.description,
      quantity: Number(item.quantity).toFixed(2),
      unitPrice: money(item.unit_price),
      total: money(item.line_total),
    })),
    totals: [
      ["Subtotal", money(quote.subtotal)],
      ["Additional fees", money(quote.fees)],
      ["Total", money(quote.total)],
    ],
    note: "Final scheduling is confirmed after customer approval and any required payment.",
  });
}
