import { billingSettlement } from "@/lib/billing-settlement";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import "../ops.css";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: invoices, error } = await supabase.from("invoices")
    .select("id, invoice_number, quotation_number, quotation_id, customer_name, total, currency, issued_at, mode")
    .order("issued_at", { ascending: false });
  if (error) throw new Error("Unable to load invoices.");

  const { data: payments, error: paymentsError } = invoices?.length
    ? await supabase.from("payments").select("quotation_id, amount, currency, status, metadata").eq("status", "paid").in("quotation_id", invoices.map(invoice => invoice.quotation_id))
    : { data: [], error: null };
  if (paymentsError) throw new Error("Unable to verify invoice balances.");
  const date = new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium", timeZone: "Africa/Johannesburg",
  });

  return (
    <main className="ops-form-page">
      <section className="ops-form-shell">
        <div className="form-topbar">
          <h1>Invoices</h1>
          <Link href="/ops" className="button-link secondary-action">Back to operations</Link>
        </div>
        <div className="table-wrap">
          <table className="mobile-card-table">
            <thead><tr><th>Invoice</th><th>Quote</th><th>Customer</th><th>Issued</th><th>Total</th><th>Balance due</th><th>Status</th></tr></thead>
            <tbody>
              {(invoices ?? []).map((invoice) => {
                const settlement = billingSettlement(invoice.total, invoice.currency, invoice.mode,
                  (payments ?? []).filter(payment => payment.quotation_id === invoice.quotation_id));
                const money = (value: number | string) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: invoice.currency }).format(Number(value));
                return (
                <tr key={invoice.id}>
                  <td data-label="Invoice"><div><Link href={`/ops/invoices/${invoice.id}`} className="table-link">{invoice.invoice_number}</Link>
                    {invoice.mode === "test" && <span> · Sandbox</span>}
                  </div></td>
                  <td data-label="Quotation">{invoice.quotation_number}</td>
                  <td data-label="Customer">{invoice.customer_name}</td>
                  <td data-label="Issued">{date.format(new Date(invoice.issued_at))}</td>
                  <td data-label="Total">{money(invoice.total)}</td>
                  <td data-label="Balance due">{money(settlement.balanceCents / 100)}</td>
                  <td data-label="Status"><span className="status">{settlement.status}</span></td>
                </tr>
              ); })}
              {!invoices?.length && <tr><td colSpan={7}>No invoices issued yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
