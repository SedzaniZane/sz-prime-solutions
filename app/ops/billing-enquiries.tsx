import Image from "next/image";
import QRCode from "qrcode";
import { billingContact } from "@/lib/billing-contact";
import ContactIcon from "./contact-icon";

export default async function BillingEnquiries() {
  const { email, whatsapp, whatsappUrl } = billingContact();
  const qr = whatsappUrl ? await QRCode.toDataURL(whatsappUrl, { margin: 4, scale: 5 }) : null;
  return (
    <section className="quote-footer" aria-label="SZ Prime Solutions enquiries"
      style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 16 }}>
      <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
        <strong>Queries and more information</strong>
        <p>Email: <a href={`mailto:${email}`}>{email}</a></p>
        {whatsapp && <p><ContactIcon kind="phone" />Contact phone: <a href={`tel:${whatsapp}`}>{whatsapp}</a></p>}
        {whatsappUrl && <p><ContactIcon kind="whatsapp" />WhatsApp: <a href={whatsappUrl}>{whatsappUrl}</a></p>}
      </div>
      {qr && whatsappUrl && (
        <a href={whatsappUrl} style={{ display: "grid", justifyItems: "center", padding: 8, border: "1px solid #bad9cb", borderRadius: 12 }}>
          <Image unoptimized src={qr} alt="" width={96} height={96} />
          <span>Scan to chat with support</span>
        </a>
      )}
    </section>
  );
}
