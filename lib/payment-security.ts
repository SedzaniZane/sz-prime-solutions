import crypto from "node:crypto";

export const MAX_WEBHOOK_BYTES = 64 * 1024;

export function verifyYocoSignature(rawBody: string, headers: Headers, secret: string | undefined, now = Date.now()) {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader || !secret?.startsWith("whsec_") || !/^\d+$/.test(timestamp)) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(now - seconds * 1000) > 180_000) return false;
  const key = Buffer.from(secret.slice(6), "base64");
  if (!key.length) return false;
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  return signatureHeader.split(" ").some(entry => {
    const [version, signature] = entry.split(",");
    return version === "v1" && !!signature && Buffer.byteLength(signature) === Buffer.byteLength(expected) &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  });
}

export function successfulPayment(event: any) {
  const p = event?.payload;
  if (event?.type !== "payment.succeeded" || typeof event.id !== "string" || !event.id ||
      typeof p?.id !== "string" || !p.id || typeof p.metadata?.checkoutId !== "string" || !p.metadata.checkoutId ||
      p.status !== "succeeded" || !Number.isSafeInteger(p.amount) || p.amount <= 0 ||
      p.currency !== "ZAR" || !["test", "live"].includes(p.mode)) {
    throw new Error("Invalid payment event");
  }
  return { reference: p.metadata.checkoutId as string, paymentId: p.id as string, eventId: event.id as string,
    mode: p.mode as "test" | "live", amountCents: p.amount as number, currency: p.currency as string,
    method: typeof p.paymentMethodDetails?.type === "string" ? p.paymentMethodDetails.type : null };
}

export function checkoutUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "c.yoco.com" || url.username || url.password || url.port) {
    throw new Error("Invalid Yoco checkout destination");
  }
  return url.href;
}
