export function billingContact() {
  const email = process.env.SZ_PRIME_ENQUIRIES_EMAIL?.trim() || "szprimesolutions@gmail.com";
  const number = process.env.SZ_PRIME_WHATSAPP?.trim().replace(/[\s().-]/g, "").replace(/^\+/, "") ?? "";
  const international = /^0\d{9}$/.test(number) ? "27" + number.slice(1) : number;
  const whatsapp = /^[1-9]\d{7,14}$/.test(international) ? "+" + international : null;
  return { email, whatsapp };
}
