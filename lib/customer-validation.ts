export type ContactValidationResult =
  | { ok: true; phone: string | null; email: string | null }
  | { ok: false; message: string };

export function normaliseSouthAfricanMobile(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  const compact = raw.replace(/[\s()-]/g, "");

  let local: string;
  if (/^\+27\d{9}$/.test(compact)) {
    local = "0" + compact.slice(3);
  } else if (/^27\d{9}$/.test(compact)) {
    local = "0" + compact.slice(2);
  } else if (/^0\d{9}$/.test(compact)) {
    local = compact;
  } else {
    return null;
  }

  if (!/^0[6-8]\d{8}$/.test(local)) return null;

  return "+27" + local.slice(1);
}

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateCustomerContacts(
  phoneInput: string,
  emailInput: string,
): ContactValidationResult {
  const phoneRaw = phoneInput.trim();
  const email = emailInput.trim().toLowerCase();
  const phone = phoneRaw ? normaliseSouthAfricanMobile(phoneRaw) : null;

  if (!phoneRaw && !email) {
    return {
      ok: false,
      message: "Enter at least one customer contact method: mobile number or email address.",
    };
  }

  if (phoneRaw && !phone) {
    return {
      ok: false,
      message:
        "Enter a valid South African mobile number, for example 082 123 4567 or +27 82 123 4567.",
    };
  }

  if (email && !isValidEmail(email)) {
    return {
      ok: false,
      message: "Enter a valid customer email address.",
    };
  }

  return { ok: true, phone, email: email || null };
}
