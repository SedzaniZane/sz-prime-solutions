import { billingContact } from "@/lib/billing-contact";

export default function BillingEnquiries() {
  const { email, whatsapp } = billingContact();
  return (
    <section className="quote-footer" aria-label="SZ Prime Solutions enquiries">
      <strong>Queries and more information</strong>
      <p>Email: <a href={`mailto:${email}`}>{email}</a></p>
      {whatsapp && <p>WhatsApp: <a href={`https://wa.me/${whatsapp.slice(1)}`}>{whatsapp}</a></p>}
    </section>
  );
}
