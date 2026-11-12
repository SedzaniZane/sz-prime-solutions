import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type InvoiceItem = {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type Client = Awaited<ReturnType<typeof createClient>>;

export async function loadQuotation(supabase: Client, id: string) {
  const { data: quote, error: quoteError } = await supabase
    .from("quotations")
    .select(`
      id,
      quotation_number,
      issuing_unit,
      service_request_id,
      currency,
      subtotal,
      fees,
      total,
      status,
      approval_status,
      approved_at,
      declined_at,
      valid_until,
      created_at,
      service_requests(
        id,
        service_type,
        unit,
        description,
        customers(
          full_name,
          phone,
          email,
          location_text
        )
      )
    `)
    .eq("id", id)
    .single();

  if (quoteError || !quote) notFound();

  const request = Array.isArray(quote.service_requests)
    ? quote.service_requests[0]
    : quote.service_requests;

  if (!request) notFound();

  const customer = Array.isArray(request.customers)
    ? request.customers[0]
    : request.customers;

  const { data: items, error: itemsError } = await supabase
    .from("quotation_items")
    .select("id, description, quantity, unit_price, line_total, sort_order")
    .eq("quotation_id", id)
    .order("sort_order", { ascending: true });

  if (itemsError) notFound();
  return { quote, request, customer, items };
}

export async function loadInvoice(supabase: Client, id: string) {
  const { data: invoice, error } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (error || !invoice) notFound();

  const { data: payments, error: paymentError } = await supabase.from("payments")
    .select("amount, paid_at, payment_method")
    .eq("quotation_id", invoice.quotation_id)
    .eq("currency", invoice.currency)
    .eq("status", "paid")
    .eq("metadata->>processing_mode", invoice.mode)
    .order("paid_at", { ascending: false });
  if (paymentError) throw new Error("Unable to verify invoice settlement.");

  const paidCents = (payments ?? []).reduce((sum, payment) =>
    sum + Math.round(Number(payment.amount) * 100), 0);
  const balanceCents = Math.max(Math.round(Number(invoice.total) * 100) - paidCents, 0);
  const payment = payments?.[0];
  const method = payment?.payment_method;
  const methodLabel = method === "apple_pay" ? "Apple Pay" : method === "google_pay" ? "Google Pay" : method === "card" ? "Card" : null;
  const date = new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium", timeZone: "Africa/Johannesburg",
  });
  const dateTime = new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium", timeStyle: "medium", timeZone: "Africa/Johannesburg", hour12: false,
  });
  const money = new Intl.NumberFormat("en-ZA", { style: "currency", currency: invoice.currency });
  const formatMoney = (value: number | string) => money.format(Number(value));
  const items = invoice.items as InvoiceItem[];
  return { invoice, paidCents, balanceCents, payment, methodLabel, date, dateTime, formatMoney, items };
}
