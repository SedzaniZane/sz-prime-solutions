import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import "../ops.css";

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: invoices, error } = await supabase.from("invoices")
    .select("id, invoice_number, quotation_number, customer_name, total, currency, issued_at, mode")
    .order("issued_at", { ascending: false });
  if (error) throw new Error("Unable to load invoices.");

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
          <table>
            <thead><tr><th>Invoice</th><th>Quote</th><th>Customer</th><th>Issued</th><th>Total</th></tr></thead>
            <tbody>
              {(invoices ?? []).map((invoice) => (
                <tr key={invoice.id}>
                  <td><Link href={`/ops/invoices/${invoice.id}`} className="table-link">{invoice.invoice_number}</Link>
                    {invoice.mode === "test" && <span> · Sandbox</span>}
                  </td>
                  <td>{invoice.quotation_number}</td>
                  <td>{invoice.customer_name}</td>
                  <td>{date.format(new Date(invoice.issued_at))}</td>
                  <td>{new Intl.NumberFormat("en-ZA", { style: "currency", currency: invoice.currency })
                    .format(Number(invoice.total))}</td>
                </tr>
              ))}
              {!invoices?.length && <tr><td colSpan={5}>No invoices issued yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
