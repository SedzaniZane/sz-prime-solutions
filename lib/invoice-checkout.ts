import { createAdminClient } from "@/utils/supabase/admin";
import { checkoutUrl } from "./payment-security";
import { createClient } from "@/utils/supabase/server";
import { createYocoCheckout } from "./yoco";

export async function invoiceCheckout(invoiceId: string, origin: string) {
  const key = process.env.YOCO_SECRET_KEY;
  const mode = key?.startsWith("sk_test_") ? "test" : key?.startsWith("sk_live_") ? "live" : null;
  if (!mode) throw new Error("Yoco is not configured.");
  if (mode === "live" && process.env.BILLING_LIVE_ENABLED !== "true") throw new Error("Live payments remain disabled until launch checks are complete.");
  const supabase = await createClient();
  const { data: paymentId, error } = await supabase.rpc("reserve_invoice_checkout", { p_invoice_id: invoiceId, p_mode: mode });
  if (error || !paymentId) throw new Error(error?.message ?? "Unable to reserve checkout.");
  const { data: payment, error: loadError } = await supabase.from("payments")
    .select("id, amount, quotation_id, service_request_id, checkout_url, metadata")
    .eq("id", paymentId).single();
  if (loadError || !payment) throw new Error("Unable to load reserved checkout.");
  if (payment.checkout_url) return checkoutUrl(payment.checkout_url);
  const { data: invoice } = await supabase.from("invoices").select("quotation_number").eq("id", invoiceId).single();
  if (!invoice) throw new Error("Invoice unavailable.");
  const returnUrl = `${origin}/ops/invoices/${invoiceId}`;
  const checkout = await createYocoCheckout({
    amountCents: Math.round(Number(payment.amount) * 100),
    idempotencyKey: `sz-invoice-${payment.id}`,
    quotationId: payment.quotation_id, quotationNumber: invoice.quotation_number,
    serviceRequestId: payment.service_request_id,
    successUrl: `${returnUrl}?payment_return=success`,
    cancelUrl: `${returnUrl}?payment_return=cancelled`,
    failureUrl: `${returnUrl}?payment_return=failed`,
  });
  const { error: attachError } = await createAdminClient().rpc("attach_invoice_checkout", {
    p_payment_id: payment.id, p_reference: checkout.id, p_url: checkout.redirectUrl,
    p_mode: checkout.processingMode ?? mode, p_amount_cents: checkout.amount,
  });
  if (attachError) throw new Error(attachError.message);
  return checkoutUrl(checkout.redirectUrl);
}
