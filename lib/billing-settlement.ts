export type BillingMode = "test" | "live";
export type SettlementPayment = {
  amount: number | string;
  currency: string;
  status: string;
  metadata?: { processing_mode?: string | null } | null;
};

export function billingMode(secret: string | undefined): BillingMode | null {
  return secret?.startsWith("sk_test_") ? "test" : secret?.startsWith("sk_live_") ? "live" : null;
}

export function paymentMethodLabel(method: string | null | undefined, provider?: string | null) {
  const labels: Record<string, string> = { eft: "EFT", apple_pay: "Apple Pay", google_pay: "Google Pay", card: "Card" };
  return (method && labels[method]) || (provider === "eft" ? "EFT" : provider === "yoco" ? "Yoco" : "Payment");
}

export function billingSettlement(total: number | string, currency: string, mode: BillingMode | null, payments: SettlementPayment[]) {
  const paidCents = payments.filter(p => mode && p.status === "paid" && p.currency === currency && p.metadata?.processing_mode === mode)
    .reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0);
  const totalCents = Math.round(Number(total) * 100);
  const balanceCents = Math.max(totalCents - paidCents, 0);
  const status = totalCents === 0 ? "No payment due" : balanceCents === 0 ? "Paid" : paidCents > 0 ? "Partially paid" : "Unpaid";
  return { paidCents, balanceCents, status };
}

export function quotationStatus(quote: { total: number | string; currency: string; approval_status: string; status: string },
  mode: BillingMode | null, payments: SettlementPayment[]) {
  const settlement = billingSettlement(quote.total, quote.currency, mode, payments);
  if (settlement.paidCents > 0) return settlement.status;
  if (quote.approval_status === "declined") return "Declined";
  if (quote.approval_status === "accepted") return Number(quote.total) === 0 ? "No payment due" : "Awaiting payment";
  if (quote.status === "sent" || quote.approval_status === "pending") return "Awaiting approval";
  return "Draft";
}
