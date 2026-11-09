import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { validateCustomerContacts } from "@/lib/customer-validation";
import SubmitButton from "./submit-button";
import "../../ops.css";

const units = [
  ["prime_living", "SZ Prime Living Accommodations"],
  ["prime_relocations", "SZ Prime Relocations"],
  ["pristine_cleaning", "SZ Pristine Cleaning"],
  ["prime_plug_connect", "SZ Prime Plug-Connect"],
  ["prime_facilities", "SZ Prime Facilities"],
  ["prime_tech_hub", "SZ Prime Tech Hub"],
  ["prime_business_solutions", "SZ Prime Business Solutions"],
] as const;

type SearchParams = Promise<{ error?: string }>;

function fail(message: string): never {
  redirect(`/ops/requests/new?error=${encodeURIComponent(message)}`);
}

async function createRequest(formData: FormData) {
  "use server";

  const fullName = String(formData.get("full_name") ?? "").trim();
  const serviceType = String(formData.get("service_type") ?? "").trim();
  const unit = String(formData.get("unit") ?? "");
  const preferredDate = String(formData.get("preferred_date") ?? "").trim();
  const phoneInput = String(formData.get("phone") ?? "");
  const emailInput = String(formData.get("email") ?? "");

  if (!fullName) fail("Enter the customer's full name.");
  if (!serviceType) fail("Enter the service the customer is requesting.");
  if (!units.some(([value]) => value === unit)) fail("Select a valid SZ Prime business unit.");

  const contacts = validateCustomerContacts(phoneInput, emailInput);
  if (!contacts.ok) fail(contacts.message);

  let preferredDateIso: string | null = null;
  if (preferredDate) {
    const date = new Date(preferredDate);
    if (Number.isNaN(date.getTime())) fail("Enter a valid requested service date and time.");
    preferredDateIso = date.toISOString();
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_customer_service_request", {
    p_full_name: fullName,
    p_phone: contacts.phone,
    p_email: contacts.email,
    p_preferred_language: String(formData.get("preferred_language") ?? "English"),
    p_location_text: String(formData.get("location_text") ?? ""),
    p_unit: unit,
    p_service_type: serviceType,
    p_description: String(formData.get("description") ?? ""),
    p_preferred_date: preferredDateIso,
    p_source: String(formData.get("source") ?? "other"),
  });

  if (error) {
    fail(error.message || "Unable to create the customer request.");
  }

  redirect("/ops");
}

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;

  return (
    <main className="ops-form-page">
      <section className="ops-form-shell">
        <div className="form-topbar">
          <div>
            <p className="eyebrow">STAFF CUSTOMER INTAKE</p>
            <h1>Capture a new customer request</h1>
            <p>
              This is an internal SZ Prime staff form. Record the customer's contact details,
              then capture the service they are requesting.
            </p>
          </div>
          <Link href="/ops" className="button-link">Back to Operations</Link>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form action={createRequest} className="request-form">
          <fieldset>
            <legend>Customer contact details</legend>
            <p className="fieldset-help">
              Enter the customer's information, not the staff member's. At least one contact method
              (mobile number or email address) is required.
            </p>

            <div className="form-grid">
              <label>
                Customer full name *
                <input name="full_name" required autoComplete="name" placeholder="e.g. Naledi Mokoena" />
              </label>

              <label>
                Customer mobile number
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="e.g. 082 123 4567"
                  pattern="[+0-9()\s-]{10,20}"
                  title="Enter a South African mobile number such as 082 123 4567 or +27 82 123 4567"
                />
                <span className="field-hint">We store valid South African mobile numbers in +27 format.</span>
              </label>

              <label>
                Customer email address
                <input
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="e.g. customer@example.com"
                />
                <span className="field-hint">The browser and server both validate the email format.</span>
              </label>

              <label>
                Customer preferred language
                <select name="preferred_language" defaultValue="English">
                  <option>English</option>
                  <option>Tshivenda</option>
                  <option>Sepedi</option>
                  <option>isiZulu</option>
                  <option>Setswana</option>
                  <option>Sesotho</option>
                  <option>isiXhosa</option>
                  <option>Afrikaans</option>
                </select>
              </label>

              <label className="form-span-2">
                Customer suburb / area
                <input name="location_text" placeholder="e.g. Arcadia, Pretoria" />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Request details</legend>
            <p className="fieldset-help">
              Select the SZ Prime unit that should handle the enquiry and describe the actual
              service required.
            </p>

            <div className="form-grid">
              <label>
                Assigned business unit *
                <select name="unit" defaultValue="pristine_cleaning" required>
                  {units.map(([value, label]) => (
                    <option value={value} key={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label>
                Service requested *
                <input
                  name="service_type"
                  required
                  placeholder="e.g. Move-out cleaning"
                />
                <span className="field-hint">
                  Use a short service name. Put the customer's full explanation below.
                </span>
              </label>

              <label>
                Requested service date / time
                <input name="preferred_date" type="datetime-local" />
              </label>

              <label>
                How did the customer contact us?
                <select name="source" defaultValue="whatsapp">
                  <option value="whatsapp">WhatsApp</option>
                  <option value="website">Website</option>
                  <option value="phone">Phone call</option>
                  <option value="referral">Referral</option>
                  <option value="social_media">Social media</option>
                  <option value="walk_in">Walk-in / in person</option>
                  <option value="other">Other / staff-created</option>
                </select>
              </label>

              <label className="form-span-2">
                Customer request notes
                <textarea
                  name="description"
                  rows={5}
                  placeholder="e.g. Customer is moving out of a two-bedroom flat and needs a full move-out clean before key handover."
                />
              </label>
            </div>
          </fieldset>

          <div className="form-actions">
            <Link href="/ops" className="button-link secondary-action">Cancel</Link>
            <SubmitButton />
          </div>
        </form>
      </section>
    </main>
  );
}
