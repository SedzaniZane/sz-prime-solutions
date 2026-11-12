export type YocoCheckout = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  redirectUrl: string;
  paymentId?: string | null;
  processingMode?: string;
};

export async function createYocoCheckout(input: {
  amountCents: number;
  quotationId: string;
  quotationNumber: string;
  serviceRequestId: string;
  successUrl: string;
  cancelUrl: string;
  failureUrl: string;
}) {
  const secretKey = process.env.YOCO_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Yoco is not configured yet. Add YOCO_SECRET_KEY in Vercel.");
  }

  const response = await fetch("https://payments.yoco.com/api/checkouts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `sz-prime-${input.quotationId}`,
    },
    body: JSON.stringify({
      amount: input.amountCents,
      currency: "ZAR",
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      failureUrl: input.failureUrl,
      clientReferenceId: input.quotationNumber,
      externalId: input.quotationId,
      metadata: {
        quotation_id: input.quotationId,
        quotation_number: input.quotationNumber,
        service_request_id: input.serviceRequestId,
      },
    }),
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.id || !body?.redirectUrl) {
    throw new Error(
      body?.message || body?.error || `Yoco checkout creation failed (${response.status}).`,
    );
  }

  return body as YocoCheckout;
}
