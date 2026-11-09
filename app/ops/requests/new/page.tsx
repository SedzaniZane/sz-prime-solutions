import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
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

async function createRequest(formData: FormData) {
  "use server";

  const fullName = String(formData.get("full_name") ?? "").trim();
  const serviceType = String(formData.get("service_type") ?? "").trim();
  const unit = String(formData.get("unit") ?? "");
  const preferredDate = String(formData.get("preferred_date") ?? "").trim();

  if (!fullName || !serviceType || !units.some(([value]) => value === unit)) {
    redirect("/ops/requests/new?error=Please%20complete%20all%20required%20fields.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_customer_service_request", {
    p_full_name: fullName,
    p_phone: String(formData.get("phone") ?? ""),
    p_email: String(formData.get("email") ?? ""),
    p_preferred_language: String(formData.get("preferred_language") ?? "English"),
    p_location_text: String(formData.get("location_text") ?? ""),
    p_unit: unit,
    p_service_type: serviceType,
    p_description: String(formData.get("description") ?? ""),
    p_preferred_date: preferredDate ? new Date(preferredDate).toISOString() : null,
    p_source: String(formData.get("source") ?? "staff"),
  });

  if (error) {
    const message = encodeURIComponent(error.message || "Unable to create request.");
    redirect(`/ops/requests/new?error=${message}`);
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
            <p className="eyebrow">CUSTOMER INTAKE</p>
            <h1>Add customer + service request</h1>
            <p>
              Create the customer record and their first SZ Prime service request in one step.
            </p>
          </div>
          <Link href="/ops" className="button-link">Back to Operations</Link>
        </div>

        {error && <div className="form-error">{error}</div>}

        <form action={createRequest} className="request-form">
          <fieldset>
            <legend>Customer details</legend>
            <div className="form-grid">
              <label>
                Full name *
                <input name="full_name" required autoComplete="name" />
              </label>

              <label>
                Phone
                <input name="phone" type="tel" autoComplete="tel" placeholder="+27..." />
              </label>

              <label>
                Email
                <input name="email" type="email" autoComplete="email" />
              </label>

              <label>
                Preferred language
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
                Location / area
                <input name="location_text" placeholder="e.g. Menlyn, Pretoria" />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Service request</legend>
            <div className="form-grid">
              <label>
                Business unit *
                <select name="unit" defaultValue="pristine_cleaning" required>
                  {units.map(([value, label]) => (
                    <option value={value} key={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label>
                Service *
                <input
                  name="service_type"
                  required
                  placeholder="e.g. Move-out cleaning"
                />
              </label>

              <label>
                Preferred date
                <input name="preferred_date" type="datetime-local" />
              </label>

              <label>
                Lead source
                <select name="source" defaultValue="staff">
                  <option value="staff">Staff capture</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="website">Website</option>
                  <option value="phone">Phone</option>
                  <option value="referral">Referral</option>
                  <option value="social_media">Social media</option>
                </select>
              </label>

              <label className="form-span-2">
                Request description
                <textarea
                  name="description"
                  rows={5}
                  placeholder="Capture the customer's requirements, quantities, access notes or other context."
                />
              </label>
            </div>
          </fieldset>

          <div className="form-actions">
            <Link href="/ops" className="button-link secondary-action">Cancel</Link>
            <button type="submit">Create request</button>
          </div>
        </form>
      </section>
    </main>
  );
}
