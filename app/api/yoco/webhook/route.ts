import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

function verifyYocoSignature(rawBody: string, headers: Headers) {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  const secret = process.env.YOCO_WEBHOOK_SECRET;

  if (!id || !timestamp || !signatureHeader || !secret?.startsWith("whsec_")) {
    return false;
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;

  const ageMs = Math.abs(Date.now() - timestampSeconds * 1000);
  if (ageMs > 3 * 60 * 1000) return false;

  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const secretBytes = Buffer.from(secret.split("_")[1], "base64");
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");

  const signatures = signatureHeader
    .split(" ")
    .map((entry) => entry.split(","))
    .filter(([version, value]) => version === "v1" && value)
    .map(([, value]) => value);

  return signatures.some((signature) => {
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(signature);
    return (
      expectedBuffer.length === actualBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, actualBuffer)
    );
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!verifyYocoSignature(rawBody, request.headers)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 403 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event?.type !== "payment.succeeded") {
    return NextResponse.json({ received: true });
  }

  const checkoutId = event?.payload?.metadata?.checkoutId;
  const paymentId = event?.payload?.id;

  if (!checkoutId) {
    return NextResponse.json({ error: "Missing checkout reference" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error } = await supabase.rpc("settle_yoco_checkout", {
    p_reference: checkoutId,
    p_mode: event?.payload?.mode ?? null,
    p_method: event?.payload?.paymentMethodDetails?.type ?? null,
    p_payment_reference: paymentId ?? null,
    p_event_id: event?.id ?? null,
  });
  if (error) return NextResponse.json({ error: "Unable to settle payment" }, { status: 500 });

  return NextResponse.json({ received: true });
}
