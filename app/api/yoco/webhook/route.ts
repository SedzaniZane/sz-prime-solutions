import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { MAX_WEBHOOK_BYTES, successfulPayment, verifyYocoSignature } from "@/lib/payment-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  // Bound the stream too: Content-Length is not trustworthy and may be absent.
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: "Payload too large" }, { status: 413 });
      }
      chunks.push(value);
    }
  }
  const rawBody = Buffer.concat(chunks).toString("utf8");
  if (!verifyYocoSignature(rawBody, request.headers, process.env.YOCO_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 403 });
  }
  let event;
  try { event = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (event?.type !== "payment.succeeded") return NextResponse.json({ received: true });
  let payment;
  try { payment = successfulPayment(event); }
  catch { return NextResponse.json({ error: "Invalid payment event" }, { status: 400 }); }
  const { error } = await createAdminClient().rpc("settle_yoco_checkout_verified", {
    p_reference: payment.reference, p_mode: payment.mode, p_method: payment.method,
    p_payment_reference: payment.paymentId, p_event_id: payment.eventId,
    p_amount_cents: payment.amountCents, p_currency: payment.currency,
  });
  if (error) {
    // Only a code is logged; never log payloads, keys or customer details.
    console.error("Yoco settlement rejected", { code: error.code });
    return NextResponse.json({ error: "Unable to settle payment" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
