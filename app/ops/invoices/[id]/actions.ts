"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { invoiceCheckout } from "@/lib/invoice-checkout";

function fail(id: string, error: unknown): never {
  redirect(`/ops/invoices/${id}?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to update invoice.")}`);
}

export async function payInvoice(id: string) {
  let url: string;
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    if (!host) throw new Error("Application URL unavailable.");
    url = await invoiceCheckout(id, `${h.get("x-forwarded-proto") || "https"}://${host}`);
  } catch (error) { fail(id, error); }
  redirect(url);
}

export async function recordEft(id: string, form: FormData) {
  try {
    if (form.get("confirmed") !== "yes") throw new Error("Confirm that the funds have reached the bank account.");
    const amount = String(form.get("amount") ?? "");
    const received = String(form.get("received_at") ?? "");
    if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw new Error("Enter the amount in rand with at most two decimal places.");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(received)) throw new Error("Enter the received date and time in SAST.");
    const date = new Date(received + ":00+02:00");
    if (Number.isNaN(date.getTime())) throw new Error("Invalid received date.");
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_invoice_eft", {
      p_invoice_id: id, p_amount: Number(amount), p_reference: String(form.get("reference") ?? "").trim(), p_received_at: date.toISOString(),
    });
    if (error) throw new Error(error.message);
  } catch (error) { fail(id, error); }
  revalidatePath("/ops");
  revalidatePath(`/ops/invoices/${id}`);
  revalidatePath("/ops/quotations", "layout");
  redirect(`/ops/invoices/${id}?saved=eft`);
}

export async function discardTestCheckout(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("discard_sandbox_checkout", { p_invoice_id: id });
  if (error) fail(id, new Error(error.message));
  revalidatePath("/ops");
  revalidatePath(`/ops/invoices/${id}`);
  redirect(`/ops/invoices/${id}?saved=discarded`);
}
